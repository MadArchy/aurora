const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

export interface YoutubeFeedItem {
  title: string;
  link: string;
  snippet: string;
  pubDate: string;
}

export interface YoutubeChannelResult {
  channelId: string;
  title: string;
  feedUrl: string;
}

interface YoutubeApiError {
  error?: { message?: string; errors?: Array<{ reason?: string }> };
}

function feedUrlForChannel(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

export function parseYoutubeProfileUrl(rawUrl: string): {
  channelId?: string;
  handle?: string;
  username?: string;
  playlistId?: string;
} | null {
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

function directFeedUrl(parts: NonNullable<ReturnType<typeof parseYoutubeProfileUrl>>): string | null {
  if (parts.channelId) return feedUrlForChannel(parts.channelId);
  if (parts.playlistId) {
    return `https://www.youtube.com/feeds/videos.xml?playlist_id=${parts.playlistId}`;
  }
  if (parts.username) {
    return `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(parts.username)}`;
  }
  return null;
}

async function youtubeGet<T>(apiKey: string, path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${YOUTUBE_API}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString());
  const data = (await response.json()) as T & YoutubeApiError;
  if (!response.ok) {
    const reason = data.error?.errors?.[0]?.reason || data.error?.message || 'YOUTUBE_API_ERROR';
    throw new Error(String(reason));
  }
  return data;
}

async function resolveByHandle(apiKey: string, handle: string): Promise<YoutubeChannelResult | null> {
  const data = await youtubeGet<{ items?: Array<{ id?: string; snippet?: { title?: string } }> }>(
    apiKey,
    'channels',
    { part: 'snippet', forHandle: handle.replace(/^@/, '') }
  );
  const channel = data.items?.[0];
  if (!channel?.id) return null;
  return {
    channelId: channel.id,
    title: channel.snippet?.title || handle,
    feedUrl: feedUrlForChannel(channel.id),
  };
}

async function resolveByUsername(apiKey: string, username: string): Promise<YoutubeChannelResult | null> {
  const data = await youtubeGet<{ items?: Array<{ id?: string; snippet?: { title?: string } }> }>(
    apiKey,
    'channels',
    { part: 'snippet', forUsername: username }
  );
  const channel = data.items?.[0];
  if (!channel?.id) return null;
  return {
    channelId: channel.id,
    title: channel.snippet?.title || username,
    feedUrl: feedUrlForChannel(channel.id),
  };
}

async function resolveBySearch(apiKey: string, query: string): Promise<YoutubeChannelResult | null> {
  const data = await youtubeGet<{
    items?: Array<{ id?: { channelId?: string }; snippet?: { channelTitle?: string; title?: string } }>;
  }>(apiKey, 'search', { part: 'snippet', type: 'channel', q: query, maxResults: '1' });
  const hit = data.items?.[0];
  const channelId = hit?.id?.channelId;
  if (!channelId) return null;
  return {
    channelId,
    title: hit.snippet?.channelTitle || hit.snippet?.title || query,
    feedUrl: feedUrlForChannel(channelId),
  };
}

/** Resuelve URL de perfil YouTube (incl. @handle) a feed RSS del canal. */
export async function resolveYoutubeChannel(apiKey: string, rawUrl: string): Promise<YoutubeChannelResult | null> {
  const parts = parseYoutubeProfileUrl(rawUrl);
  if (!parts) return null;

  const direct = directFeedUrl(parts);
  if (direct && parts.channelId) {
    return { channelId: parts.channelId, title: 'YouTube channel', feedUrl: direct };
  }
  if (direct && parts.playlistId) {
    return { channelId: parts.playlistId, title: 'YouTube playlist', feedUrl: direct };
  }

  if (parts.handle) {
    const resolved = await resolveByHandle(apiKey, parts.handle);
    if (resolved) return resolved;
    return resolveBySearch(apiKey, parts.handle);
  }

  if (parts.username) {
    const resolved = await resolveByUsername(apiKey, parts.username);
    if (resolved) return resolved;
    return resolveBySearch(apiKey, parts.username);
  }

  return null;
}

export async function searchYoutubeChannels(
  apiKey: string,
  query: string,
  maxResults = 3
): Promise<YoutubeChannelResult[]> {
  const data = await youtubeGet<{
    items?: Array<{ id?: { channelId?: string }; snippet?: { channelTitle?: string; title?: string } }>;
  }>(apiKey, 'search', {
    part: 'snippet',
    type: 'channel',
    q: query.slice(0, 200),
    maxResults: String(Math.min(Math.max(maxResults, 1), 5)),
    order: 'relevance',
  });

  const out: YoutubeChannelResult[] = [];
  for (const item of data.items || []) {
    const channelId = item.id?.channelId;
    if (!channelId) continue;
    out.push({
      channelId,
      title: item.snippet?.channelTitle || item.snippet?.title || channelId,
      feedUrl: feedUrlForChannel(channelId),
    });
  }
  return out;
}

export async function searchYoutubeVideos(
  apiKey: string,
  query: string,
  maxResults = 15
): Promise<YoutubeFeedItem[]> {
  const data = await youtubeGet<{
    items?: Array<{
      id?: { videoId?: string };
      snippet?: { title?: string; description?: string; publishedAt?: string; channelTitle?: string };
    }>;
  }>(apiKey, 'search', {
    part: 'snippet',
    type: 'video',
    q: query.slice(0, 200),
    maxResults: String(Math.min(Math.max(maxResults, 1), 25)),
    order: 'date',
    videoDuration: 'medium',
    relevanceLanguage: 'en',
  });

  return (data.items || [])
    .map((item) => {
      const videoId = item.id?.videoId;
      if (!videoId || !item.snippet?.title) return null;
      const channel = item.snippet.channelTitle ? ` · ${item.snippet.channelTitle}` : '';
      return {
        title: item.snippet.title,
        link: `https://www.youtube.com/watch?v=${videoId}`,
        snippet: (item.snippet.description || item.snippet.title).slice(0, 500) + channel,
        pubDate: item.snippet.publishedAt || '',
      };
    })
    .filter((x): x is YoutubeFeedItem => Boolean(x));
}

export function isYoutubeSearchSourceUrl(url: string): boolean {
  return url.startsWith('youtube-search:');
}

export function youtubeSearchQueryFromUrl(url: string): string | null {
  if (!isYoutubeSearchSourceUrl(url)) return null;
  try {
    return decodeURIComponent(url.slice('youtube-search:'.length)).trim();
  } catch {
    return null;
  }
}
