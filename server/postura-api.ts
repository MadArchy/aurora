import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { assertSafeUrl, assertSafeUrlWithDns } from './ssrf';

type Session = { openai?: string; claude?: string; createdAt: number };

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_BODY = 1_500_000;
const MAX_RSS_BYTES = 800_000;
const MAX_REDIRECTS = 4;
const MAX_PROMPT_CHARS = 12_000;
const MAX_OUTPUT_TOKENS = 1200;
const AI_RATE_WINDOW_MS = 60_000;
const AI_RATE_MAX = 30;

const ALLOWED_OPENAI_MODELS = new Set(['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini']);
const ALLOWED_CLAUDE_MODELS = new Set(['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022']);

const aiRate = new Map<string, { count: number; windowStart: number }>();

function isLoopbackOrigin(req: IncomingMessage): boolean {
  const origin = String(req.headers.origin || '');
  const host = String(req.headers.host || '');
  const allowed = ['http://127.0.0.1:3000', 'http://localhost:3000'];
  if (origin && allowed.includes(origin)) return true;
  if (!origin && (host.startsWith('127.0.0.1:') || host.startsWith('localhost:'))) return true;
  return false;
}

function checkAiRate(sessionId: string): void {
  const now = Date.now();
  const bucket = aiRate.get(sessionId) || { count: 0, windowStart: now };
  if (now - bucket.windowStart > AI_RATE_WINDOW_MS) {
    bucket.count = 0;
    bucket.windowStart = now;
  }
  bucket.count += 1;
  aiRate.set(sessionId, bucket);
  if (bucket.count > AI_RATE_MAX) throw new Error('AI_RATE_LIMIT');
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('BODY_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readResponseTextLimited(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.byteLength;
    if (size > maxBytes) throw new Error('FETCH_TOO_LARGE');
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

function json(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function parseRss(xml: string) {
  const items: Array<{ title: string; link: string; snippet: string; pubDate: string }> = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1).concat(xml.split(/<entry[\s>]/i).slice(1));
  for (const block of blocks.slice(0, 40)) {
    const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1] || '').replace(/<[^>]+>/g, '').trim();
    const link =
      block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ||
      (block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || '').replace(/<[^>]+>/g, '').trim();
    const snippet = (block.match(/<(?:description|summary|content)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content)>/i)?.[1] || '')
      .replace(/<[^>]+>/g, '')
      .trim()
      .slice(0, 500);
    const pubDate = (block.match(/<(?:pubDate|updated|published)[^>]*>([\s\S]*?)<\/(?:pubDate|updated|published)>/i)?.[1] || '').trim();
    if (title) items.push({ title, link, snippet, pubDate });
  }
  return items;
}

async function fetchFollowingRedirects(startUrl: URL, signal: AbortSignal) {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertSafeUrlWithDns(current.toString());
    const response = await fetch(current.toString(), {
      signal,
      redirect: 'manual',
      headers: {
        'User-Agent': 'PosturaSourceBot/1.0',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    });

    if (response.status < 300 || response.status >= 400) {
      return { response, finalUrl: current };
    }

    const location = response.headers.get('location');
    if (!location) throw new Error('REDIRECT_WITHOUT_LOCATION');
    current = assertSafeUrl(new URL(location, current).toString());
  }
  throw new Error('TOO_MANY_REDIRECTS');
}

function validateAiPayload(raw: string): { validationPassed: boolean; securityCheckPassed: boolean; data: Record<string, unknown> } {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const validationPassed = typeof data === 'object' && data !== null;
    const securityCheckPassed = !JSON.stringify(data).match(/<script|javascript:/i);
    return { validationPassed, securityCheckPassed, data };
  } catch {
    return { validationPassed: false, securityCheckPassed: false, data: {} };
  }
}

export function posturaApiPlugin(): Plugin {
  return {
    name: 'postura-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/')) return next();

        try {
          if (req.method === 'POST' && url.startsWith('/api/ai/session')) {
            if (!isLoopbackOrigin(req)) return json(res, 403, { error: 'ORIGIN_DENIED' });
            const body = JSON.parse((await readBody(req)) || '{}');
            const id = crypto.randomUUID();
            sessions.set(id, {
              openai: typeof body.openaiKey === 'string' ? body.openaiKey.trim() : undefined,
              claude: typeof body.claudeKey === 'string' ? body.claudeKey.trim() : undefined,
              createdAt: Date.now(),
            });
            return json(res, 200, { sessionId: id, ttlMinutes: 60 });
          }

          if (req.method === 'DELETE' && url.startsWith('/api/ai/session')) {
            if (!isLoopbackOrigin(req)) return json(res, 403, { error: 'ORIGIN_DENIED' });
            const sessionId = String(req.headers['x-ai-session'] || '');
            sessions.delete(sessionId);
            return json(res, 200, { ok: true });
          }

          if (req.method === 'POST' && url.startsWith('/api/ai/complete')) {
            if (!isLoopbackOrigin(req)) return json(res, 403, { error: 'ORIGIN_DENIED' });
            const sessionId = String(req.headers['x-ai-session'] || '');
            const session = sessions.get(sessionId);
            if (!session || Date.now() - session.createdAt > SESSION_TTL_MS) {
              sessions.delete(sessionId);
              return json(res, 401, { error: 'AI_SESSION_EXPIRED' });
            }
            checkAiRate(sessionId);
            const body = JSON.parse((await readBody(req)) || '{}');
            const provider: 'OPENAI' | 'CLAUDE' = body.provider === 'CLAUDE' ? 'CLAUDE' : 'OPENAI';
            const prompt = String(body.prompt || '').slice(0, MAX_PROMPT_CHARS);
            const system = String(body.system || 'Eres un analista estratégico de posicionamiento profesional. Responde solo JSON válido.').slice(0, 4000);
            if (!prompt.trim()) return json(res, 400, { error: 'PROMPT_EMPTY' });

            const model = String(body.model || (provider === 'OPENAI' ? 'gpt-4o-mini' : 'claude-3-5-haiku-20241022'));
            if (provider === 'OPENAI' && !ALLOWED_OPENAI_MODELS.has(model)) {
              return json(res, 400, { error: 'MODEL_NOT_ALLOWED' });
            }
            if (provider === 'CLAUDE' && !ALLOWED_CLAUDE_MODELS.has(model)) {
              return json(res, 400, { error: 'MODEL_NOT_ALLOWED' });
            }

            if (provider === 'OPENAI') {
              if (!session.openai) return json(res, 400, { error: 'OPENAI_KEY_MISSING' });
              const started = Date.now();
              const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${session.openai}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model,
                  temperature: 0.3,
                  response_format: { type: 'json_object' },
                  max_tokens: MAX_OUTPUT_TOKENS,
                  messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: prompt },
                  ],
                }),
              });
              const data = (await response.json()) as {
                choices?: Array<{ message?: { content?: string } }>;
                model?: string;
                usage?: { prompt_tokens?: number; completion_tokens?: number };
                error?: { message?: string };
              };
              if (!response.ok) return json(res, response.status, { error: 'PROVIDER_ERROR', detail: data?.error?.message || 'OpenAI error' });
              const text = data.choices?.[0]?.message?.content || '{}';
              const validated = validateAiPayload(text);
              return json(res, 200, {
                text,
                model: data.model,
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                latencyMs: Date.now() - started,
                ...validated,
              });
            }

            if (!session.claude) return json(res, 400, { error: 'CLAUDE_KEY_MISSING' });
            const started = Date.now();
            const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': session.claude,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model,
                max_tokens: MAX_OUTPUT_TOKENS,
                temperature: 0.3,
                system,
                messages: [{ role: 'user', content: prompt }],
              }),
            });
            const data = (await response.json()) as {
              content?: Array<{ text?: string }>;
              model?: string;
              usage?: { input_tokens?: number; output_tokens?: number };
              error?: { message?: string };
            };
            if (!response.ok) return json(res, response.status, { error: 'PROVIDER_ERROR', detail: data?.error?.message || 'Claude error' });
            const text = Array.isArray(data.content) ? data.content.map((c: { text?: string }) => c.text || '').join('\n') : '{}';
            const validated = validateAiPayload(text);
            return json(res, 200, {
              text,
              model: data.model,
              promptTokens: data.usage?.input_tokens || 0,
              completionTokens: data.usage?.output_tokens || 0,
              latencyMs: Date.now() - started,
              ...validated,
            });
          }

          if (req.method === 'GET' && url.startsWith('/api/rss')) {
            const target = new URL(url, 'http://local').searchParams.get('url') || '';
            const safe = await assertSafeUrlWithDns(target);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            try {
              const { response, finalUrl } = await fetchFollowingRedirects(safe, controller.signal);
              if (!response.ok) {
                return json(res, 502, { error: 'SOURCE_HTTP_ERROR', status: response.status });
              }
              const xml = await readResponseTextLimited(response, MAX_RSS_BYTES);
              const items = parseRss(xml);
              if (!items.length) return json(res, 422, { error: 'FEED_EMPTY_OR_UNPARSEABLE' });
              return json(res, 200, { items, sourceUrl: finalUrl.toString() });
            } finally {
              clearTimeout(timer);
            }
          }

          return json(res, 404, { error: 'NOT_FOUND' });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'UNKNOWN';
          const clientErrors = new Set([
            'SSRF_BLOCKED',
            'URL_SCHEME_DENIED',
            'URL_INVALID',
            'SSRF_DNS_FAILED',
            'SSRF_DNS_EMPTY',
            'FETCH_TOO_LARGE',
            'AI_RATE_LIMIT',
            'BODY_TOO_LARGE',
          ]);
          const status = clientErrors.has(message) ? 400 : 500;
          if (message === 'AI_RATE_LIMIT') return json(res, 429, { error: message });
          return json(res, status, { error: message });
        }
      });
    },
  };
}
