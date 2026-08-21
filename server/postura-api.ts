import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { callTavilySearch, fetchRssFeed } from './sourceFeedCore';
import { resolveYoutubeChannel, searchYoutubeChannels, searchYoutubeVideos } from './youtubeCore';

type Session = { openai?: string; claude?: string; createdAt: number };

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_BODY = 1_500_000;
const MAX_PROMPT_CHARS = 12_000;
const MAX_OUTPUT_TOKENS = 1200;
const AI_RATE_WINDOW_MS = 60_000;
const AI_RATE_MAX = 30;
const TAVILY_RATE_WINDOW_MS = 60 * 60 * 1000;
const TAVILY_RATE_MAX = 40;
const YOUTUBE_RATE_WINDOW_MS = 60 * 60 * 1000;
const YOUTUBE_RATE_MAX = 60;

const ALLOWED_OPENAI_MODELS = new Set(['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini']);
const ALLOWED_CLAUDE_MODELS = new Set(['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022']);

const aiRate = new Map<string, { count: number; windowStart: number }>();
const tavilyRate = new Map<string, { count: number; windowStart: number }>();
const youtubeRate = new Map<string, { count: number; windowStart: number }>();

function tavilyApiKey(): string {
  return (process.env.TAVILY_API_KEY || '').trim();
}

function youtubeApiKey(): string {
  return (process.env.YOUTUBE_API_KEY || '').trim();
}

function checkRate(
  map: Map<string, { count: number; windowStart: number }>,
  clientKey: string,
  windowMs: number,
  max: number,
  errorCode: string
): void {
  const now = Date.now();
  const bucket = map.get(clientKey) || { count: 0, windowStart: now };
  if (now - bucket.windowStart > windowMs) {
    bucket.count = 0;
    bucket.windowStart = now;
  }
  bucket.count += 1;
  map.set(clientKey, bucket);
  if (bucket.count > max) throw new Error(errorCode);
}

function checkTavilyRate(clientKey: string): void {
  checkRate(tavilyRate, clientKey, TAVILY_RATE_WINDOW_MS, TAVILY_RATE_MAX, 'TAVILY_RATE_LIMIT');
}

function checkYoutubeRate(clientKey: string): void {
  checkRate(youtubeRate, clientKey, YOUTUBE_RATE_WINDOW_MS, YOUTUBE_RATE_MAX, 'YOUTUBE_RATE_LIMIT');
}

function isLoopbackOrigin(req: IncomingMessage): boolean {
  const origin = String(req.headers.origin || '');
  const host = String(req.headers.host || '');
  const allowed = ['http://127.0.0.1:3000', 'http://localhost:3000', 'http://127.0.0.1:3001', 'http://localhost:3001'];
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

function json(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
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

          if (req.method === 'GET' && url.startsWith('/api/tavily/status')) {
            if (!isLoopbackOrigin(req)) return json(res, 403, { error: 'ORIGIN_DENIED' });
            return json(res, 200, { available: Boolean(tavilyApiKey()) });
          }

          if (req.method === 'POST' && url.startsWith('/api/tavily/search')) {
            if (!isLoopbackOrigin(req)) return json(res, 403, { error: 'ORIGIN_DENIED' });
            const apiKey = tavilyApiKey();
            if (!apiKey) return json(res, 503, { error: 'TAVILY_KEY_MISSING' });

            checkTavilyRate(String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local'));

            const body = JSON.parse((await readBody(req)) || '{}');
            const query = String(body.query || '').trim().slice(0, 400);
            if (!query) return json(res, 400, { error: 'QUERY_EMPTY' });

            const topic = body.topic === 'general' || body.topic === 'finance' ? body.topic : 'news';
            const maxResults = Math.min(Math.max(Number(body.max_results) || 8, 1), 15);
            const searchDepth =
              body.search_depth === 'advanced' ||
              body.search_depth === 'fast' ||
              body.search_depth === 'ultra-fast'
                ? body.search_depth
                : 'basic';
            const timeRange =
              body.time_range === 'day' ||
              body.time_range === 'month' ||
              body.time_range === 'year' ||
              body.time_range === 'week'
                ? body.time_range
                : 'week';

            const started = Date.now();
            try {
              const { results, query: q } = await callTavilySearch(apiKey, {
                query,
                topic,
                max_results: maxResults,
                search_depth: searchDepth,
                time_range: timeRange,
              });
              return json(res, 200, { results, query: q, latencyMs: Date.now() - started });
            } catch (error) {
              const detail = error instanceof Error ? error.message : 'TAVILY_PROVIDER_ERROR';
              return json(res, 502, { error: 'TAVILY_PROVIDER_ERROR', detail });
            }
          }

          if (req.method === 'GET' && url.startsWith('/api/youtube/status')) {
            if (!isLoopbackOrigin(req)) return json(res, 403, { error: 'ORIGIN_DENIED' });
            return json(res, 200, { available: Boolean(youtubeApiKey()) });
          }

          if (req.method === 'POST' && url.startsWith('/api/youtube/resolve')) {
            if (!isLoopbackOrigin(req)) return json(res, 403, { error: 'ORIGIN_DENIED' });
            const apiKey = youtubeApiKey();
            if (!apiKey) return json(res, 503, { error: 'YOUTUBE_KEY_MISSING' });
            checkYoutubeRate(String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local'));
            const body = JSON.parse((await readBody(req)) || '{}');
            const targetUrl = String(body.url || '').trim();
            if (!targetUrl) return json(res, 400, { error: 'URL_EMPTY' });
            try {
              const resolved = await resolveYoutubeChannel(apiKey, targetUrl);
              if (!resolved) return json(res, 404, { error: 'YOUTUBE_CHANNEL_NOT_FOUND' });
              return json(res, 200, resolved);
            } catch (error) {
              const detail = error instanceof Error ? error.message : 'YOUTUBE_PROVIDER_ERROR';
              return json(res, 502, { error: 'YOUTUBE_PROVIDER_ERROR', detail });
            }
          }

          if (req.method === 'POST' && url.startsWith('/api/youtube/channels')) {
            if (!isLoopbackOrigin(req)) return json(res, 403, { error: 'ORIGIN_DENIED' });
            const apiKey = youtubeApiKey();
            if (!apiKey) return json(res, 503, { error: 'YOUTUBE_KEY_MISSING' });
            checkYoutubeRate(String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local'));
            const body = JSON.parse((await readBody(req)) || '{}');
            const query = String(body.query || '').trim().slice(0, 200);
            if (!query) return json(res, 400, { error: 'QUERY_EMPTY' });
            const maxResults = Math.min(Math.max(Number(body.maxResults) || 3, 1), 5);
            try {
              const channels = await searchYoutubeChannels(apiKey, query, maxResults);
              return json(res, 200, { channels, query });
            } catch (error) {
              const detail = error instanceof Error ? error.message : 'YOUTUBE_PROVIDER_ERROR';
              return json(res, 502, { error: 'YOUTUBE_PROVIDER_ERROR', detail });
            }
          }

          if (req.method === 'POST' && url.startsWith('/api/youtube/search')) {
            if (!isLoopbackOrigin(req)) return json(res, 403, { error: 'ORIGIN_DENIED' });
            const apiKey = youtubeApiKey();
            if (!apiKey) return json(res, 503, { error: 'YOUTUBE_KEY_MISSING' });
            checkYoutubeRate(String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local'));
            const body = JSON.parse((await readBody(req)) || '{}');
            const query = String(body.query || '').trim().slice(0, 200);
            if (!query) return json(res, 400, { error: 'QUERY_EMPTY' });
            const maxResults = Math.min(Math.max(Number(body.maxResults) || 15, 1), 25);
            try {
              const items = await searchYoutubeVideos(apiKey, query, maxResults);
              return json(res, 200, { items, query });
            } catch (error) {
              const detail = error instanceof Error ? error.message : 'YOUTUBE_PROVIDER_ERROR';
              return json(res, 502, { error: 'YOUTUBE_PROVIDER_ERROR', detail });
            }
          }

          if (req.method === 'GET' && url.startsWith('/api/rss')) {
            const target = new URL(url, 'http://local').searchParams.get('url') || '';
            if (!target) return json(res, 400, { error: 'URL_MISSING' });
            try {
              const { items, sourceUrl } = await fetchRssFeed(target);
              return json(res, 200, { items, sourceUrl });
            } catch (error) {
              const message = error instanceof Error ? error.message : 'RSS_FAILED';
              if (message.startsWith('SOURCE_HTTP_ERROR:')) {
                return json(res, 502, { error: 'SOURCE_HTTP_ERROR', status: Number(message.split(':')[1]) || 0 });
              }
              if (message === 'FEED_EMPTY_OR_UNPARSEABLE') {
                return json(res, 422, { error: message });
              }
              throw error;
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
            'TAVILY_RATE_LIMIT',
            'YOUTUBE_RATE_LIMIT',
            'YOUTUBE_KEY_MISSING',
            'URL_EMPTY',
            'QUERY_EMPTY',
            'YOUTUBE_CHANNEL_NOT_FOUND',
            'FEED_EMPTY_OR_UNPARSEABLE',
          ]);
          const status = clientErrors.has(message) ? 400 : 500;
          if (message === 'AI_RATE_LIMIT' || message === 'TAVILY_RATE_LIMIT' || message === 'YOUTUBE_RATE_LIMIT') {
            return json(res, 429, { error: message });
          }
          return json(res, status, { error: message });
        }
      });
    },
  };
}
