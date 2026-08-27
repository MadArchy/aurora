import { assertSafeUrl, assertSafeUrlWithDns } from './ssrf';

export const MAX_RSS_BYTES = 800_000;
export const MAX_REDIRECTS = 4;

export interface FeedItemPayload {
  title: string;
  link: string;
  snippet: string;
  pubDate: string;
}

/** Entidades con nombre que aparecen en feeds reales; el resto se resuelve numéricamente. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, rawCode: string) => {
    const code = rawCode.toLowerCase();
    const named = NAMED_ENTITIES[code];
    if (named !== undefined) return named;
    const point = code.startsWith('#x')
      ? parseInt(code.slice(2), 16)
      : code.startsWith('#')
        ? Number(code.slice(1))
        : NaN;
    if (!Number.isInteger(point) || point < 1 || point > 0x10ffff) return match;
    return String.fromCodePoint(point);
  });
}

/**
 * Quita etiquetas exigiendo nombre de etiqueta tras `<`, para no destruir una
 * comparación en texto legítimo (`5 < 10 y 20 > 3`). El `>|$` final cubre la
 * etiqueta que queda a medias cuando el feed viene truncado.
 */
function stripTags(value: string): string {
  return value.replace(/<\/?[a-z!][^>]*(?:>|$)/gi, ' ');
}

/**
 * Texto plano de un nodo de feed.
 *
 * El marcado puede llegar crudo (`<a href=…>`) o escapado (`&lt;a href=…&gt;`,
 * como hace Google News). Quitar etiquetas sin decodificar primero dejaba el
 * marcado escapado como texto visible, y el href completo desbordaba la tarjeta
 * de señal.
 */
export function toPlainText(raw: string): string {
  const decoded = decodeEntities(stripTags(raw));
  // Al decodificar afloran las etiquetas que venían escapadas.
  const clean = decoded.includes('<') ? stripTags(decoded) : decoded;
  return clean.replace(/\s+/g, ' ').trim();
}

export function parseRssXml(xml: string): FeedItemPayload[] {
  const items: FeedItemPayload[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1).concat(xml.split(/<entry[\s>]/i).slice(1));
  for (const block of blocks.slice(0, 40)) {
    const title = toPlainText(
      block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1] || ''
    );
    const link =
      decodeEntities(block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] || '') ||
      toPlainText(block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || '');
    const snippet = toPlainText(
      block.match(/<(?:description|summary|content)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content)>/i)?.[1] || ''
    ).slice(0, 500);
    const pubDate = (block.match(/<(?:pubDate|updated|published)[^>]*>([\s\S]*?)<\/(?:pubDate|updated|published)>/i)?.[1] || '').trim();
    if (title) items.push({ title, link, snippet, pubDate });
  }
  return items;
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

/** Descarga y parsea un feed RSS/Atom con protección SSRF. */
export async function fetchRssFeed(targetUrl: string, timeoutMs = 15_000): Promise<{ items: FeedItemPayload[]; sourceUrl: string }> {
  const safe = await assertSafeUrlWithDns(targetUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { response, finalUrl } = await fetchFollowingRedirects(safe, controller.signal);
    if (!response.ok) {
      throw new Error(`SOURCE_HTTP_ERROR:${response.status}`);
    }
    const xml = await readResponseTextLimited(response, MAX_RSS_BYTES);
    const items = parseRssXml(xml);
    if (!items.length) throw new Error('FEED_EMPTY_OR_UNPARSEABLE');
    return { items, sourceUrl: finalUrl.toString() };
  } finally {
    clearTimeout(timer);
  }
}

export interface TavilySearchBody {
  query: string;
  topic?: 'news' | 'general' | 'finance';
  max_results?: number;
  time_range?: 'day' | 'week' | 'month' | 'year';
  search_depth?: 'basic' | 'advanced' | 'fast' | 'ultra-fast';
}

export async function callTavilySearch(apiKey: string, body: TavilySearchBody) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: body.query.slice(0, 400),
      topic: body.topic === 'general' || body.topic === 'finance' ? body.topic : 'news',
      max_results: Math.min(Math.max(body.max_results ?? 8, 1), 15),
      search_depth:
        body.search_depth === 'advanced' || body.search_depth === 'fast' || body.search_depth === 'ultra-fast'
          ? body.search_depth
          : 'basic',
      time_range:
        body.time_range === 'day' || body.time_range === 'month' || body.time_range === 'year'
          ? body.time_range
          : 'week',
      include_answer: false,
      include_raw_content: false,
    }),
  });

  const data = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string; score?: number }>;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data?.error || 'TAVILY_PROVIDER_ERROR');
  }

  const results = (data.results || [])
    .filter((item) => item.title && item.url)
    .map((item) => ({
      title: String(item.title),
      url: String(item.url),
      content: item.content ? String(item.content).slice(0, 500) : '',
      score: typeof item.score === 'number' ? item.score : undefined,
    }));

  return { results, query: body.query.slice(0, 400) };
}
