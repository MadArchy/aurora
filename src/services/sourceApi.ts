/**
 * Rutas de API para ingesta de fuentes (dev: Vite proxy · prod: Cloud Functions).
 */
import { isYoutubeSearchSourceUrl, youtubeSearchQueryFromUrl } from '../domain/youtubeUrlCore';

const FUNCTIONS_BASE = (import.meta.env.VITE_POSTURA_FUNCTIONS_BASE as string | undefined)?.replace(/\/$/, '') || '';

export function rssProxyUrl(feedUrl: string): string {
  if (FUNCTIONS_BASE) {
    return `${FUNCTIONS_BASE}/rssProxy?url=${encodeURIComponent(feedUrl)}`;
  }
  return `/api/rss?url=${encodeURIComponent(feedUrl)}`;
}

export function tavilyStatusUrl(): string {
  if (FUNCTIONS_BASE) {
    return `${FUNCTIONS_BASE}/tavilySearch`;
  }
  return '/api/tavily/status';
}

export function tavilySearchUrl(): string {
  if (FUNCTIONS_BASE) {
    return `${FUNCTIONS_BASE}/tavilySearch`;
  }
  return '/api/tavily/search';
}

export function youtubeStatusUrl(): string {
  if (FUNCTIONS_BASE) {
    return `${FUNCTIONS_BASE}/youtubeApi`;
  }
  return '/api/youtube/status';
}

export function youtubeResolveUrl(): string {
  if (FUNCTIONS_BASE) {
    return `${FUNCTIONS_BASE}/youtubeApi`;
  }
  return '/api/youtube/resolve';
}

export function youtubeSearchUrl(): string {
  if (FUNCTIONS_BASE) {
    return `${FUNCTIONS_BASE}/youtubeApi`;
  }
  return '/api/youtube/search';
}

export function youtubeChannelsUrl(): string {
  if (FUNCTIONS_BASE) {
    return `${FUNCTIONS_BASE}/youtubeApi`;
  }
  return '/api/youtube/channels';
}

export function isProductionSourceApi(): boolean {
  return Boolean(FUNCTIONS_BASE);
}

export async function fetchRssItems(feedUrl: string): Promise<{ items: Array<{ title: string; link?: string; snippet?: string }>; error?: string }> {
  return fetchSourceItems(feedUrl);
}

export async function fetchSourceItems(
  sourceUrl: string
): Promise<{ items: Array<{ title: string; link?: string; snippet?: string; pubDate?: string }>; error?: string }> {
  if (isYoutubeSearchSourceUrl(sourceUrl)) {
    const query = youtubeSearchQueryFromUrl(sourceUrl);
    if (!query) return { items: [], error: 'YOUTUBE_QUERY_INVALID' };
    try {
      const response = await fetch(youtubeSearchUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          FUNCTIONS_BASE ? { action: 'search', query, maxResults: 15 } : { query, maxResults: 15 }
        ),
      });
      const data = (await response.json()) as {
        items?: Array<{ title: string; link?: string; snippet?: string; pubDate?: string }>;
        error?: string;
      };
      if (!response.ok) return { items: [], error: data.error || 'YOUTUBE_SEARCH_FAILED' };
      return { items: data.items || [] };
    } catch {
      return { items: [], error: 'YOUTUBE_SEARCH_FAILED' };
    }
  }

  const response = await fetch(rssProxyUrl(sourceUrl));
  const data = (await response.json()) as { items?: Array<{ title: string; link?: string; snippet?: string }>; error?: string };
  if (!response.ok) {
    return { items: [], error: data.error || 'RSS_FAILED' };
  }
  return { items: data.items || [] };
}

export async function fetchTavilyAvailable(): Promise<boolean> {
  if (FUNCTIONS_BASE) {
    return true;
  }
  try {
    const response = await fetch(tavilyStatusUrl());
    if (!response.ok) return false;
    const data = (await response.json()) as { available?: boolean };
    return Boolean(data.available);
  } catch {
    return false;
  }
}

export async function fetchYoutubeAvailable(): Promise<boolean> {
  if (FUNCTIONS_BASE) {
    return true;
  }
  try {
    const response = await fetch(youtubeStatusUrl());
    if (!response.ok) return false;
    const data = (await response.json()) as { available?: boolean };
    return Boolean(data.available);
  } catch {
    return false;
  }
}

export { isYoutubeSearchSourceUrl, youtubeSearchQueryFromUrl } from '../domain/youtubeUrlCore';
