import type { Firestore, QuerySnapshot, DocumentData } from 'firebase-admin/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { fetchRssFeed } from './sourceFeedCore';
import { isYoutubeSearchSourceUrl, searchYoutubeVideos, youtubeSearchQueryFromUrl } from './youtubeCore';
import {
  assessSourceQuality,
  gateItem,
  newSignalId,
  signalFingerprint,
  type FeedItem,
} from './ingestGate';
import { buildProfileKeywordsFromDocs } from './profileKeywords';
import { scoreSignalCloud } from './scoreSignal';
import { requireMatchingClientId, requireTenantOrganizationId } from './tenantEnvelope';

export const MAX_SOURCES_PER_RUN = 12;

interface SourceDoc {
  id: string;
  organizationId?: string;
  clientId?: string;
  name: string;
  type: string;
  url?: string;
  fetchIntervalMinutes?: number;
  lastFetchedAt?: string;
  status: string;
  itemCount?: number;
}

interface ThesisDoc {
  id: string;
  status?: string;
  domain?: string;
  title?: string;
  expertIdentity?: string;
}

function isSourceDue(source: SourceDoc, nowMs: number): boolean {
  if (source.status !== 'ACTIVE' || !source.url) return false;
  const intervalMs = (source.fetchIntervalMinutes || 360) * 60 * 1000;
  const last = source.lastFetchedAt ? new Date(source.lastFetchedAt).getTime() : 0;
  return nowMs - last >= intervalMs;
}

async function loadExistingFingerprints(db: Firestore, clientId: string): Promise<Set<string>> {
  const snap = await db.collection(`clients/${clientId}/signals`).select('fingerprint').get();
  const set = new Set<string>();
  for (const doc of snap.docs) {
    const fp = doc.data().fingerprint as string | undefined;
    if (fp) set.add(fp);
  }
  return set;
}

async function fetchItemsForSource(url: string, youtubeApiKey?: string): Promise<FeedItem[]> {
  if (isYoutubeSearchSourceUrl(url)) {
    if (!youtubeApiKey) throw new Error('YOUTUBE_KEY_MISSING');
    const query = youtubeSearchQueryFromUrl(url);
    if (!query) throw new Error('YOUTUBE_QUERY_INVALID');
    return searchYoutubeVideos(youtubeApiKey, query);
  }
  const feed = await fetchRssFeed(url);
  return feed.items;
}

async function pollOneSource(
  db: Firestore,
  clientId: string,
  source: SourceDoc,
  keywords: ReturnType<typeof buildProfileKeywordsFromDocs>,
  fingerprints: Set<string>,
  youtubeApiKey?: string,
  thesis?: ThesisDoc
): Promise<{ accepted: number; rejected: number; duplicates: number; fetched: number; error?: string }> {
  if (!source.url) {
    return { accepted: 0, rejected: 0, duplicates: 0, fetched: 0, error: 'SOURCE_URL_MISSING' };
  }

  let organizationId: string;
  let resolvedClientId: string;
  try {
    organizationId = requireTenantOrganizationId(source, `source ${source.id}`);
    resolvedClientId = requireMatchingClientId(clientId, source);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TENANT_ENVELOPE_INVALID';
    await db.doc(`clients/${clientId}/sources/${source.id}`).set(
      {
        lastFetchedAt: new Date().toISOString(),
        lastRunFetched: 0,
        lastRunAccepted: 0,
        lastRunRejected: 0,
        lastError: message,
        status: 'ERROR',
      },
      { merge: true }
    );
    return { accepted: 0, rejected: 0, duplicates: 0, fetched: 0, error: message };
  }

  let items: FeedItem[] = [];
  try {
    items = await fetchItemsForSource(source.url, youtubeApiKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RSS_FAILED';
    await db.doc(`clients/${clientId}/sources/${source.id}`).set(
      {
        lastFetchedAt: new Date().toISOString(),
        lastRunFetched: 0,
        lastRunAccepted: 0,
        lastRunRejected: 0,
        lastError: message,
        status: 'ERROR',
      },
      { merge: true }
    );
    return { accepted: 0, rejected: 0, duplicates: 0, fetched: 0, error: message };
  }

  let accepted = 0;
  let rejected = 0;
  let duplicates = 0;
  let batch = db.batch();
  let batchOps = 0;

  const flush = async () => {
    if (batchOps === 0) return;
    await batch.commit();
    batch = db.batch();
    batchOps = 0;
  };

  for (const item of items) {
    const gate = gateItem(item, keywords, source);
    if (!gate.accepted) {
      rejected += 1;
      continue;
    }

    const fp = signalFingerprint(item.title, item.link);
    if (fingerprints.has(fp)) {
      duplicates += 1;
      continue;
    }

    fingerprints.add(fp);
    const signalId = newSignalId();
    const signalRef = db.doc(`clients/${clientId}/signals/${signalId}`);
    const sourceType =
      source.type === 'REGULATORY'
        ? 'REGULATORY'
        : source.type === 'ACADEMIC'
          ? 'ACADEMIC'
          : source.type === 'VIDEO'
            ? 'VIDEO'
            : source.type === 'SOCIAL'
              ? 'SOCIAL'
              : 'RSS';
    const sourceQuality = assessSourceQuality(source, item);
    const detectedAt = new Date().toISOString();
    const score = scoreSignalCloud({
      title: item.title,
      snippet: item.snippet || item.title,
      sourceType,
      sourceQuality,
      detectedAt,
      domain: thesis?.domain,
      thesisTitle: thesis?.title,
      bilingualTerms: [...keywords.coreEn, ...keywords.coreEs],
    });
    const autoDiscard = score.recommendedAction === 'NO_ACTION' && score.totalScore < 40;

    batch.set(signalRef, {
      id: signalId,
      organizationId,
      clientId: resolvedClientId,
      sourceId: source.id,
      title: item.title,
      sourceType,
      sourceName: source.name,
      sourceUrl: item.link || '',
      contentSnippet: item.snippet || item.title,
      fingerprint: fp,
      detectedAt,
      status: autoDiscard ? 'DISCARDED' : 'NEW',
      aiStatus: 'PENDING_AI',
      managerDecision: autoDiscard ? 'DISCARDED' : 'UNREVIEWED',
      discardReason: autoDiscard ? 'Auto-descartada: score bajo y sin acción recomendada.' : undefined,
      sourceQuality,
      relevanceScore: score.totalScore,
      priorityBand: score.priorityBand,
      recommendedAction: score.recommendedAction,
      scoreRationale: score.strategicRationale,
      ingestedBy: 'cloud_scheduler',
    });
    batchOps += 1;
    if (!autoDiscard) accepted += 1;
    else rejected += 1;

    if (batchOps >= 400) await flush();
  }

  await flush();

  await db.doc(`clients/${clientId}/sources/${source.id}`).set(
    {
      lastFetchedAt: new Date().toISOString(),
      lastRunFetched: items.length,
      lastRunAccepted: accepted,
      lastRunRejected: rejected,
      itemCount: FieldValue.increment(accepted),
      lastError: FieldValue.delete(),
      status: 'ACTIVE',
    },
    { merge: true }
  );

  await db.collection(`clients/${clientId}/sourceRuns`).add({
    organizationId,
    clientId: resolvedClientId,
    sourceId: source.id,
    ranAt: new Date().toISOString(),
    fetched: items.length,
    accepted,
    rejected,
    duplicates,
    runner: 'ingestSourcesScheduled',
  });

  return { accepted, rejected, duplicates, fetched: items.length };
}

export interface ScheduledIngestSummary {
  clientsScanned: number;
  sourcesPolled: number;
  signalsCreated: number;
  errors: number;
}

/** Ingesta programada: recorre clientes y fuentes ACTIVE vencidas por intervalo. */
export async function runScheduledIngest(options?: { youtubeApiKey?: string }): Promise<ScheduledIngestSummary> {
  const db = getFirestore();
  const nowMs = Date.now();
  const summary: ScheduledIngestSummary = {
    clientsScanned: 0,
    sourcesPolled: 0,
    signalsCreated: 0,
    errors: 0,
  };

  const clientsSnap = await db.collection('clients').get();
  const dueSources: Array<{ clientId: string; source: SourceDoc }> = [];

  for (const clientDoc of clientsSnap.docs) {
    summary.clientsScanned += 1;
    const clientId = clientDoc.id;
    const sourcesSnap = await db.collection(`clients/${clientId}/sources`).get();
    for (const sourceDoc of sourcesSnap.docs) {
      const source = { id: sourceDoc.id, ...sourceDoc.data() } as SourceDoc;
      if (isSourceDue(source, nowMs)) {
        dueSources.push({ clientId, source });
      }
    }
  }

  dueSources.sort((a, b) => {
    const la = a.source.lastFetchedAt ? new Date(a.source.lastFetchedAt).getTime() : 0;
    const lb = b.source.lastFetchedAt ? new Date(b.source.lastFetchedAt).getTime() : 0;
    return la - lb;
  });

  const toPoll = dueSources.slice(0, MAX_SOURCES_PER_RUN);

  for (const { clientId, source } of toPoll) {
    const [thesesSnap, profileSnap, dossierSnap] = await Promise.all([
      db.collection(`clients/${clientId}/theses`).where('status', '==', 'ACTIVE').limit(1).get(),
      db.doc(`clients/${clientId}/profile/data`).get(),
      db.doc(`clients/${clientId}/dossier/data`).get(),
    ]);

    const thesis = thesesSnap.docs[0]?.data() as ThesisDoc | undefined;
    const clientData = clientDocData(clientsSnap, clientId);
    const keywords = buildProfileKeywordsFromDocs(
      { id: clientId, profession: clientData?.profession as string | undefined },
      thesis,
      profileSnap.exists ? (profileSnap.data() as object) : undefined,
      dossierSnap.exists ? (dossierSnap.data() as object) : undefined
    );

    const fingerprints = await loadExistingFingerprints(db, clientId);
    const outcome = await pollOneSource(db, clientId, source, keywords, fingerprints, options?.youtubeApiKey, thesis);
    summary.sourcesPolled += 1;
    summary.signalsCreated += outcome.accepted;
    if (outcome.error) summary.errors += 1;
  }

  return summary;
}

function clientDocData(
  clientsSnap: QuerySnapshot<DocumentData>,
  clientId: string
): Record<string, unknown> | undefined {
  return clientsSnap.docs.find((d) => d.id === clientId)?.data();
}
