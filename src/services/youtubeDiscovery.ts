import type { DiscoveredSource } from './sourceDiscovery';
import type { ProfileKeywords } from './sourceDiscovery';
import type { ExtendedDiscoveryProfile } from '../domain/extendedSourceDiscoveryCore';
import { youtubeFeedUrlFromProfileUrl, youtubeSearchSourceUrl } from '../domain/youtubeUrlCore';
import { youtubeChannelsUrl, youtubeResolveUrl, youtubeSearchUrl, youtubeStatusUrl, isProductionSourceApi } from './sourceApi';

export async function isYoutubeApiAvailable(): Promise<boolean> {
  try {    const response = await fetch(youtubeStatusUrl());
    if (!response.ok) return false;
    const data = (await response.json()) as { available?: boolean };
    return Boolean(data.available);
  } catch {
    return false;
  }
}

function youtubeActionUrl(action: 'resolve' | 'search' | 'channels'): string {
  if (action === 'search') return youtubeSearchUrl();
  if (action === 'channels') return youtubeChannelsUrl();
  return youtubeResolveUrl();
}

async function postYoutube<T>(action: 'resolve' | 'search' | 'channels', body: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const payload = isProductionSourceApi() ? { action, ...body } : body;
  const response = await fetch(youtubeActionUrl(action), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    return { ok: false, error: data.error || 'YOUTUBE_API_FAILED' };
  }
  return { ok: true, data };
}

/** Enriquece fuentes YouTube con Data API v3 (handles, canales y videos educativos). */
export async function enrichYoutubeDiscoverySources(
  sources: DiscoveredSource[],
  keywords: ProfileKeywords,
  profile?: ExtendedDiscoveryProfile
): Promise<{ sources: DiscoveredSource[]; usedApi: boolean; error?: string }> {
  const available = await isYoutubeApiAvailable();
  if (!available) {
    return { sources, usedApi: false, error: 'YOUTUBE_KEY_MISSING' };
  }

  const merged = [...sources];
  const seenUrls = new Set(merged.map((s) => s.url));

  const youtubeLink = profile?.socialLinks?.youtube;
  if (youtubeLink && !youtubeFeedUrlFromProfileUrl(youtubeLink)) {
    const resolved = await postYoutube<{ channelId: string; title: string; feedUrl: string }>('resolve', {
      url: youtubeLink,
    });    if (resolved.ok && resolved.data.feedUrl && !seenUrls.has(resolved.data.feedUrl)) {
      merged.unshift({
        key: 'youtube_channel_profile_api',
        name: `YouTube — ${resolved.data.title}`,
        type: 'VIDEO',
        url: resolved.data.feedUrl,
        locale: 'ANY',
        rationale: 'Canal del perfil resuelto vía YouTube Data API (@handle → RSS).',
        kind: 'YOUTUBE',
      });
      seenUrls.add(resolved.data.feedUrl);
    }
  }

  const searchQuery = [...keywords.coreEn.slice(0, 2), 'tutorial OR lecture OR webinar']
    .filter(Boolean)
    .join(' ');
  const channels = await postYoutube<{ channels: Array<{ channelId: string; title: string; feedUrl: string }> }>(
    'channels',
    { query: searchQuery, maxResults: 2 }
  );  if (channels.ok) {
    channels.data.channels.forEach((channel, index) => {
      if (seenUrls.has(channel.feedUrl)) return;
      merged.push({
        key: `youtube_api_channel_${index + 1}`,
        name: `YouTube — ${channel.title}`,
        type: 'VIDEO',
        url: channel.feedUrl,
        locale: 'EN_US',
        rationale: 'Canal relevante encontrado con YouTube Data API.',
        kind: 'YOUTUBE',
      });
      seenUrls.add(channel.feedUrl);
    });
  }

  const eduQuery = `${keywords.coreEn.slice(0, 2).join(' ')} educational OR scientific OR tutorial`.trim();
  const eduUrl = youtubeSearchSourceUrl(eduQuery);
  if (!seenUrls.has(eduUrl)) {
    merged.push({
      key: 'youtube_api_education',
      name: 'YouTube — videos educativos/científicos (API)',
      type: 'VIDEO',
      url: eduUrl,
      locale: 'EN_US',
      rationale: 'Búsqueda activa de videos educativos vía YouTube Data API.',
      kind: 'YOUTUBE',
    });
    seenUrls.add(eduUrl);
  }

  return { sources: merged, usedApi: true };
}
