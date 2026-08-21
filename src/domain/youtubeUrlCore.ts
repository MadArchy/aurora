/** Prefijo en Source.url para ingesta vía YouTube Data API (no RSS). */
export const YOUTUBE_SEARCH_PREFIX = 'youtube-search:';

export function isYoutubeSearchSourceUrl(url: string): boolean {
  return url.startsWith(YOUTUBE_SEARCH_PREFIX);
}

export function youtubeSearchQueryFromUrl(url: string): string | null {
  if (!isYoutubeSearchSourceUrl(url)) return null;
  try {
    return decodeURIComponent(url.slice(YOUTUBE_SEARCH_PREFIX.length)).trim();
  } catch {
    return null;
  }
}

export function youtubeSearchSourceUrl(query: string): string {
  return `${YOUTUBE_SEARCH_PREFIX}${encodeURIComponent(query.trim())}`;
}

export interface ParsedYoutubeUrl {
  channelId?: string;
  handle?: string;
  username?: string;
  playlistId?: string;
}

export function parseYoutubeProfileUrl(rawUrl: string): ParsedYoutubeUrl | null {
  try {
    const parsed = new URL(rawUrl.trim());
    if (!parsed.hostname.replace(/^www\./, '').includes('youtube.com')) return null;

    const channelId = parsed.pathname.match(/\/channel\/(UC[\w-]{10,})/i)?.[1];
    if (channelId) return { channelId };

    const playlistId = parsed.searchParams.get('list') || undefined;
    if (playlistId && parsed.pathname.includes('/playlist')) return { playlistId };

    const handle = parsed.pathname.match(/\/@([\w.-]+)/i)?.[1];
    if (handle) return { handle };

    const username = parsed.pathname.match(/\/user\/([\w.-]+)/i)?.[1];
    if (username) return { username };

    const custom = parsed.pathname.match(/\/c\/([\w.-]+)/i)?.[1];
    if (custom) return { handle: custom };

    return {};
  } catch {
    return null;
  }
}

export function youtubeFeedUrlFromParts(parts: ParsedYoutubeUrl): string | null {
  if (parts.channelId) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${parts.channelId}`;
  }
  if (parts.playlistId) {
    return `https://www.youtube.com/feeds/videos.xml?playlist_id=${parts.playlistId}`;
  }
  if (parts.username) {
    return `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(parts.username)}`;
  }
  return null;
}

export function youtubeFeedUrlFromProfileUrl(rawUrl: string): string | null {
  const parts = parseYoutubeProfileUrl(rawUrl);
  if (!parts) return null;
  return youtubeFeedUrlFromParts(parts);
}
