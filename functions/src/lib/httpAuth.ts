import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { parsePosturaClaims, type PosturaAuthClaims } from './posturaClaims';

export interface AuthenticatedPosturaUser extends PosturaAuthClaims {
  uid: string;
}

const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://aurora-postura-app.web.app',
  'https://aurora-postura-app.firebaseapp.com',
  'https://madarchy.github.io',
];

function allowedOrigins(): string[] {
  const extra =
    process.env.POSTURA_ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) || [];
  return [...DEFAULT_ORIGINS, ...extra];
}

function resolveCorsOrigin(req: Request): string | null {
  const origin = String(req.headers.origin || '');
  const allowed = allowedOrigins();
  if (origin && allowed.includes(origin)) return origin;
  if (!origin && process.env.FUNCTIONS_EMULATOR === 'true') return allowed[0];
  return null;
}

export function applyCors(req: Request, res: Response): boolean {
  const origin = resolveCorsOrigin(req);
  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return Boolean(origin);
}

export function handlePreflight(req: Request, res: Response): boolean {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(originAllowed(req) ? 204 : 403).send('');
    return true;
  }
  return false;
}

function originAllowed(req: Request): boolean {
  return resolveCorsOrigin(req) !== null;
}

export async function verifyBearerToken(req: Request): Promise<AuthenticatedPosturaUser | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const idToken = header.slice('Bearer '.length).trim();
  if (!idToken) return null;

  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    const claims = parsePosturaClaims(decoded as Record<string, unknown>);
    if (!claims) return null;
    return { uid: decoded.uid, ...claims };
  } catch {
    return null;
  }
}

type RateBucket = { count: number; windowStart: number };

class RateLimiter {
  private buckets = new Map<string, RateBucket>();

  constructor(
    private windowMs: number,
    private max: number,
    private code: string
  ) {}

  check(key: string): void {
    const now = Date.now();
    const bucket = this.buckets.get(key) || { count: 0, windowStart: now };
    if (now - bucket.windowStart > this.windowMs) {
      bucket.count = 0;
      bucket.windowStart = now;
    }
    bucket.count += 1;
    this.buckets.set(key, bucket);
    if (bucket.count > this.max) throw new Error(this.code);
  }
}

export const rateLimiters = {
  rss: new RateLimiter(60 * 60 * 1000, 120, 'RSS_RATE_LIMIT'),
  tavily: new RateLimiter(60 * 60 * 1000, 40, 'TAVILY_RATE_LIMIT'),
  youtube: new RateLimiter(60 * 60 * 1000, 60, 'YOUTUBE_RATE_LIMIT'),
  ai: new RateLimiter(60 * 1000, 30, 'AI_RATE_LIMIT'),
};

export type ProxyAuthOptions = {
  adminOnly?: boolean;
  rateLimit?: keyof typeof rateLimiters;
};

/** Preflight, CORS, Bearer Firebase + claims POSTURA, rol y rate limit opcional. */
export async function requirePosturaAuth(
  req: Request,
  res: Response,
  options: ProxyAuthOptions = {}
): Promise<AuthenticatedPosturaUser | null> {
  if (handlePreflight(req, res)) return null;

  if (!applyCors(req, res)) {
    res.status(403).json({ error: 'ORIGIN_DENIED' });
    return null;
  }

  const user = await verifyBearerToken(req);
  if (!user) {
    res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Firebase ID token with POSTURA claims required.' });
    return null;
  }

  if (options.adminOnly && user.role !== 'ADMIN') {
    res.status(403).json({ error: 'ADMIN_REQUIRED' });
    return null;
  }

  if (options.rateLimit) {
    try {
      rateLimiters[options.rateLimit].check(user.uid);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'RATE_LIMIT';
      res.status(429).json({ error: code });
      return null;
    }
  }

  return user;
}
