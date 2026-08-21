import { dbService } from './db';
import { buildProfileKeywords, normalizeSourceUrl } from './sourceDiscovery';
import { buildExtendedSources } from '../domain/extendedSourceDiscoveryCore';
import type { Client, PositioningThesis } from '../types';

export { youtubeFeedUrlFromProfileUrl, buildExtendedSources } from '../domain/extendedSourceDiscoveryCore';

/** Fuentes sociales, YouTube y académicas derivadas del perfil. */
export function discoverExtendedSources(client: Client, thesis?: PositioningThesis) {
  const keywords = buildProfileKeywords(client, thesis);
  const profile = dbService.getMasterProfile(client.id);
  const domainBlob = [thesis?.domain, thesis?.title, client.profession].filter(Boolean).join(' ');
  return buildExtendedSources(keywords, { profile: profile || undefined, domainBlob });
}

export function pendingExtendedSources(client: Client, thesis?: PositioningThesis) {
  const existing = new Set(
    dbService.getSourcesByClient(client.id).map((s) => normalizeSourceUrl(s.url || ''))
  );
  return discoverExtendedSources(client, thesis).filter((d) => !existing.has(normalizeSourceUrl(d.url)));
}
