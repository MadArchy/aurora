import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

initializeApp();

const openAiKey = defineSecret('OPENAI_API_KEY');

interface SetClaimsRequest {
  uid: string;
  role: 'ADMIN' | 'CLIENT';
  organizationId?: string;
  clientId?: string | null;
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

/** Ingesta RSS server-side con validación SSRF compartida. */
export const rssProxy = onRequest({ cors: true }, async (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'Deploy with shared SSRF module from server/ssrf.ts' });
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
