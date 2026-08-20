import { lookup } from 'node:dns/promises';

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  'metadata.google',
]);

export function normalizeHostname(raw: string): string {
  return raw.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIpv6(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (host === '::1' || host === '::') return true;
  if (host.startsWith('fc') || host.startsWith('fd')) return true;
  if (host.startsWith('fe80:')) return true;
  if (host.startsWith('::ffff:')) {
    const mapped = host.slice('::ffff:'.length);
    if (mapped.includes('.')) return isPrivateIpv4(mapped);
  }
  return false;
}

function isBlockedHostname(host: string): boolean {
  const normalized = normalizeHostname(host);
  if (!normalized) return true;
  if (BLOCKED_HOSTS.has(normalized)) return true;
  if (normalized.endsWith('.localhost') || normalized.endsWith('.local')) return true;
  if (normalized.endsWith('.internal')) return true;
  if (isPrivateIpv4(normalized) || isPrivateIpv6(normalized)) return true;
  return false;
}

export function assertSafeUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('URL_INVALID');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('URL_SCHEME_DENIED');
  if (isBlockedHostname(parsed.hostname)) throw new Error('SSRF_BLOCKED');
  return parsed;
}

async function assertResolvedAddresses(host: string): Promise<void> {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) {
    if (isBlockedHostname(host)) throw new Error('SSRF_BLOCKED');
    return;
  }
  try {
    const results = await lookup(host, { all: true, verbatim: true });
    if (!results.length) throw new Error('SSRF_DNS_EMPTY');
    for (const entry of results) {
      if (isBlockedHostname(entry.address)) throw new Error('SSRF_BLOCKED');
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('SSRF_')) throw error;
    throw new Error('SSRF_DNS_FAILED');
  }
}

/** Valida URL y resuelve DNS antes de conectar (protección contra rebinding). */
export async function assertSafeUrlWithDns(raw: string): Promise<URL> {
  const parsed = assertSafeUrl(raw);
  await assertResolvedAddresses(normalizeHostname(parsed.hostname));
  return parsed;
}
