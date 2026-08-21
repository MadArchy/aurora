import type { Source } from '../types';

/** Reintento de fuentes en ERROR (p. ej. proxy caído o 5xx transitorio). */
export const SOURCE_ERROR_RETRY_MS = 15 * 60 * 1000;

export function isLocalDevHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * En GitHub Pages / Firebase Hosting no existe `/api/rss` de Vite.
 * Hace falta Cloud Functions (`VITE_POSTURA_FUNCTIONS_BASE`) o `npm run dev`.
 */
export function isSourceIngestProxyReady(input: {
  functionsBase?: string;
  hostname: string;
}): boolean {
  if (input.functionsBase?.trim()) return true;
  return isLocalDevHost(input.hostname);
}

export function sourceProxyUnavailableMessage(): string {
  return 'SOURCE_PROXY_UNAVAILABLE';
}

export function labelSourceRunError(code: string): string {
  switch (code) {
    case 'SOURCE_PROXY_UNAVAILABLE':
      return 'Sin proxy de ingesta (usa npm run dev, o despliega Cloud Functions).';
    case 'AUTH_REQUIRED':
      return 'Inicia sesión como Brand Manager para usar las APIs de fuentes.';
    case 'ADMIN_REQUIRED':
      return 'Las APIs de fuentes solo están disponibles para el Brand Manager.';
    case 'TAVILY_KEY_MISSING':
      return 'Falta TAVILY_API_KEY en el servidor.';
    case 'YOUTUBE_KEY_MISSING':
      return 'Falta YOUTUBE_API_KEY en el servidor.';
    default:
      return code;
  }
}

export function isSourceEligibleForIngest(source: Pick<Source, 'url' | 'status' | 'lastFetchedAt' | 'fetchIntervalMinutes'>, now = Date.now()): boolean {
  if (!source.url) return false;
  if (source.status === 'ARCHIVED' || source.status === 'PAUSED') return false;
  if (source.status === 'ERROR') {
    if (!source.lastFetchedAt) return true;
    return now - new Date(source.lastFetchedAt).getTime() >= SOURCE_ERROR_RETRY_MS;
  }
  if (!source.lastFetchedAt) return true;
  return now - new Date(source.lastFetchedAt).getTime() >= source.fetchIntervalMinutes * 60_000;
}
