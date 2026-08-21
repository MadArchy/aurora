import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { callTavilySearch, fetchRssFeed } from './lib/sourceFeedCore';
import {
  resolveYoutubeChannel,
  searchYoutubeChannels,
  searchYoutubeVideos,
} from './lib/youtubeCore';
import { runScheduledIngest } from './lib/scheduledIngest';

initializeApp();

const openAiKey = defineSecret('OPENAI_API_KEY');
const tavilyKey = defineSecret('TAVILY_API_KEY');
const youtubeKey = defineSecret('YOUTUBE_API_KEY');

interface SetClaimsRequest {
  uid: string;
  role: 'ADMIN' | 'CLIENT';
  organizationId?: string;
  clientId?: string | null;
}

function setCors(res: { set: (key: string, value: string) => void }) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/** Provisiona custom claims POSTURA (solo ADMIN). Usar en Emulator / bootstrap piloto. */
export const setPosturaClaims = onCall(async (request) => {
  if (!request.auth?.token?.role || request.auth.token.role !== 'ADMIN') {
    throw new HttpsError('permission-denied', 'ADMIN required');
  }
  const data = request.data as SetClaimsRequest;
  if (!data.uid || (data.role !== 'ADMIN' && data.role !== 'CLIENT')) {
    throw new HttpsError('invalid-argument', 'uid and role required');
  }
  if (data.role === 'CLIENT' && !data.clientId) {
    throw new HttpsError('invalid-argument', 'clientId required for CLIENT role');
  }

  await getAuth().setCustomUserClaims(data.uid, {
    role: data.role,
    organizationId: data.organizationId || 'org_aurora_01',
    clientId: data.role === 'CLIENT' ? data.clientId : null,
  });

  return { ok: true };
});

/** Proxy IA autenticado: secretos en Secret Manager, nunca en Firestore ni frontend. */
export const aiComplete = onRequest({ secrets: [openAiKey], cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  if (!req.headers.authorization?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'AUTH_REQUIRED' });
    return;
  }
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'Wire Firebase Auth + App Check before pilot.' });
});

/** Ingesta RSS server-side con validación SSRF. GET ?url= */
export const rssProxy = onRequest({ cors: true }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const target = String(req.query.url || '');
  if (!target) {
    res.status(400).json({ error: 'URL_MISSING' });
    return;
  }

  try {
    const { items, sourceUrl } = await fetchRssFeed(target);
    res.status(200).json({ items, sourceUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RSS_FAILED';
    const clientErrors = new Set([
      'SSRF_BLOCKED',
      'URL_SCHEME_DENIED',
      'URL_INVALID',
      'SSRF_DNS_FAILED',
      'SSRF_DNS_EMPTY',
      'FETCH_TOO_LARGE',
      'FEED_EMPTY_OR_UNPARSEABLE',
    ]);
    if (message.startsWith('SOURCE_HTTP_ERROR:')) {
      res.status(502).json({ error: 'SOURCE_HTTP_ERROR', status: Number(message.split(':')[1]) || 0 });
      return;
    }
    res.status(clientErrors.has(message) ? 400 : 500).json({ error: message });
  }
});

/** Búsqueda Tavily server-side. POST JSON { query, topic, max_results, ... } */
export const tavilySearch = onRequest({ secrets: [tavilyKey], cors: true }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const apiKey = tavilyKey.value();
  if (!apiKey) {
    res.status(503).json({ error: 'TAVILY_KEY_MISSING' });
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({ available: true });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const query = String(body.query || '').trim();
  if (!query) {
    res.status(400).json({ error: 'QUERY_EMPTY' });
    return;
  }

  try {
    const started = Date.now();
    const { results, query: q } = await callTavilySearch(apiKey, {
      query,
      topic: body.topic as 'news' | 'general' | 'finance' | undefined,
      max_results: Number(body.max_results) || 8,
      time_range: body.time_range as 'day' | 'week' | 'month' | 'year' | undefined,
      search_depth: body.search_depth as 'basic' | 'advanced' | 'fast' | 'ultra-fast' | undefined,
    });
    res.status(200).json({ results, query: q, latencyMs: Date.now() - started });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'TAVILY_PROVIDER_ERROR';
    res.status(502).json({ error: 'TAVILY_PROVIDER_ERROR', detail });
  }
});

/** YouTube Data API v3 — GET status · POST { action: resolve|search|channels, ... } */
export const youtubeApi = onRequest({ secrets: [youtubeKey], cors: true }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const apiKey = youtubeKey.value();
  if (!apiKey) {
    res.status(503).json({ error: 'YOUTUBE_KEY_MISSING' });
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({ available: true });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const action = String(body.action || 'search');

  try {
    if (action === 'resolve') {
      const targetUrl = String(body.url || '').trim();
      if (!targetUrl) {
        res.status(400).json({ error: 'URL_EMPTY' });
        return;
      }
      const resolved = await resolveYoutubeChannel(apiKey, targetUrl);
      if (!resolved) {
        res.status(404).json({ error: 'YOUTUBE_CHANNEL_NOT_FOUND' });
        return;
      }
      res.status(200).json(resolved);
      return;
    }

    if (action === 'channels') {
      const query = String(body.query || '').trim();
      if (!query) {
        res.status(400).json({ error: 'QUERY_EMPTY' });
        return;
      }
      const maxResults = Math.min(Math.max(Number(body.maxResults) || 3, 1), 5);
      const channels = await searchYoutubeChannels(apiKey, query, maxResults);
      res.status(200).json({ channels, query });
      return;
    }

    const query = String(body.query || '').trim();
    if (!query) {
      res.status(400).json({ error: 'QUERY_EMPTY' });
      return;
    }
    const maxResults = Math.min(Math.max(Number(body.maxResults) || 15, 1), 25);
    const items = await searchYoutubeVideos(apiKey, query, maxResults);
    res.status(200).json({ items, query });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'YOUTUBE_PROVIDER_ERROR';
    res.status(502).json({ error: 'YOUTUBE_PROVIDER_ERROR', detail });
  }
});

interface TopicAgentRequest {
  clientId: string;
  signalCount?: number;
}

/** Topic Agent v1 server-side echo (manual trigger desde cliente usa heurística local). */
export const topicAgentRun = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
  const data = request.data as TopicAgentRequest;
  const isAdmin = request.auth.token.role === 'ADMIN';
  const ownClient = request.auth.token.clientId === data.clientId;
  if (!isAdmin && !ownClient) throw new HttpsError('permission-denied', 'Cannot run for this client');

  return {
    ok: true,
    clientId: data.clientId,
    generatedAt: new Date().toISOString(),
    message: 'Use client-side topicAgent v1 heuristic; cloud LLM routing pending.',
  };
});

/** Ingesta RSS programada — corre cada 15 min sin browser abierto. */
export const ingestSourcesScheduled = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'America/Chicago',
    memory: '512MiB',
    timeoutSeconds: 540,
    secrets: [youtubeKey],
  },
  async () => {
    const summary = await runScheduledIngest({ youtubeApiKey: youtubeKey.value() });
    console.log('ingestSourcesScheduled', JSON.stringify(summary));
  }
);

/** Disparo manual de ingesta (solo ADMIN). */
export const ingestSourcesManual = onCall({ secrets: [youtubeKey] }, async (request) => {
  if (!request.auth?.token?.role || request.auth.token.role !== 'ADMIN') {
    throw new HttpsError('permission-denied', 'ADMIN required');
  }
  const summary = await runScheduledIngest({ youtubeApiKey: youtubeKey.value() });
  return { ok: true, ...summary };
});
