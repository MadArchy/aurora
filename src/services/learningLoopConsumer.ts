/**
 * SPEC-008 Phase 4 — Consumer facade for Learning Loop.
 * UI/main issue intent only — never tenant/actor/strategic authority.
 */

import type { BusinessKpiType, SignalOutcome, SignalOutcomeKind } from '../types';
import type { LearningObservationKind } from '../domain/learningObservationCore';
import type { ThesisScope } from '../domain/learningThesisScopeCore';
import {
  LearningApplicationError,
  type TrustedLearningActorContext,
} from '../application/learningLoop';
import { composeLearningLoop, type LearningLoopUseCases } from '../composition/learningLoop/composeLearningLoop';
import {
  createLocalLearningLoopStore,
  type LocalLearningLoopStore,
} from '../infrastructure/learningLoop';
import { LocalOpportunityOutcomeReader } from '../infrastructure/learningLoop/LocalOpportunityOutcomeReader';
import type { LocalOpportunityScoutStore } from '../infrastructure/opportunityScout';
import { createId } from '../lib/id';
import { authService } from './auth';
import { dbService } from './db';

type OutcomeSource = SignalOutcome['source'];

let store: LocalLearningLoopStore = createLocalLearningLoopStore();
let opportunityStore: LocalOpportunityScoutStore | undefined;
let useCases: LearningLoopUseCases = buildUseCases(store);

function buildUseCases(
  nextStore: LocalLearningLoopStore,
  oppStore?: LocalOpportunityScoutStore
): LearningLoopUseCases {
  return composeLearningLoop({
    store: nextStore,
    opportunityOutcomes: oppStore
      ? new LocalOpportunityOutcomeReader(oppStore)
      : new LocalOpportunityOutcomeReader(),
  });
}

/** Wire shared Opportunity store for read-only ingest (avoids import cycle with opportunityScoutConsumer). */
export function registerSharedOpportunityStoreForLearning(
  oppStore: LocalOpportunityScoutStore
): void {
  opportunityStore = oppStore;
  useCases = buildUseCases(store, oppStore);
}

/** Test-only reset — not production API. */
export function resetLearningLoopConsumerForTest(
  nextStore?: LocalLearningLoopStore,
  options?: { opportunityStore?: LocalOpportunityScoutStore }
): void {
  store = nextStore ?? createLocalLearningLoopStore();
  store.resetForTest();
  opportunityStore = options?.opportunityStore;
  useCases = buildUseCases(store, opportunityStore);
}

export function getLearningLoopStoreForTest(): LocalLearningLoopStore {
  return store;
}

/**
 * Trusted context from auth/runtime — never from UI path/query/form tenant claims.
 */
export function buildTrustedLearningContext(
  clientId: string,
  options?: { now?: string }
): TrustedLearningActorContext | undefined {
  const user = authService.getCurrentUser();
  const organizationId = dbService.getClientById(clientId)?.organizationId;
  if (!user || !organizationId) return undefined;
  return {
    actorId: user.uid,
    actorRole: user.role,
    organizationId,
    clientId,
    now: options?.now ?? new Date().toISOString(),
  };
}

function requireTrusted(
  clientId: string,
  options?: { now?: string }
): TrustedLearningActorContext {
  const trusted = buildTrustedLearningContext(clientId, options);
  if (!trusted) {
    throw new LearningApplicationError(
      'TRUSTED_CONTEXT_REQUIRED',
      'Trusted actor/tenant context required for Learning operations.'
    );
  }
  return trusted;
}

function thesisScopeForSignal(thesisId?: string): ThesisScope {
  if (thesisId?.trim()) {
    return { kind: 'SINGLE', thesisId: thesisId.trim() };
  }
  return { kind: 'CLIENT_WIDE' };
}

function mapOpportunityStatusToKind(status: string): LearningObservationKind | undefined {
  switch (status) {
    case 'ACCEPTED':
      return 'OPPORTUNITY_ACCEPTED';
    case 'DECLINED':
      return 'OPPORTUNITY_DECLINED';
    case 'SUBMITTED':
      return 'OPPORTUNITY_SUBMITTED';
    case 'COMPLETED':
      return 'OPPORTUNITY_COMPLETED';
    default:
      return undefined;
  }
}

/** COMPATIBILITY_WRITE_MIRROR — after canonical success only; failures are non-authoritative. */
function mirrorSignalOutcomeAfterCanonical(input: Omit<SignalOutcome, 'id' | 'createdAt'>): boolean {
  try {
    dbService.mirrorSignalOutcomeCompatibility(input);
    return true;
  } catch {
    return false;
  }
}

function mirrorResultAfterCanonical(
  input: Omit<import('../types').ResultRecord, 'id' | 'createdAt'>
): string | undefined {
  try {
    return dbService.mirrorResultRecordCompatibility(input).id;
  } catch {
    return undefined;
  }
}

function observationToSignalOutcome(obs: {
  organizationId: string;
  clientId: string;
  sourceRef: { sourceId: string };
  observationKind: string;
  payload: Record<string, unknown>;
  actorUid: string;
  recordedAt: string;
}): SignalOutcome {
  const kind = obs.observationKind as SignalOutcomeKind;
  const source = (obs.payload.source as OutcomeSource) || 'RADAR';
  return {
    id: obs.sourceRef.sourceId,
    organizationId: obs.organizationId,
    clientId: obs.clientId,
    signalId: obs.sourceRef.sourceId,
    kind: kind === 'USEFUL' || kind === 'NOT_USEFUL' ? kind : 'USEFUL',
    note: typeof obs.payload.note === 'string' ? obs.payload.note : undefined,
    source,
    actorUid: obs.actorUid,
    createdAt: obs.recordedAt,
  };
}

/** Display-only — reads canonical observations first, then legacy compatibility mirror. */
export function getSignalOutcomeForDisplay(
  clientId: string,
  signalId: string
): SignalOutcome | undefined {
  const client = dbService.getClientById(clientId);
  if (!client?.organizationId) {
    return dbService.getSignalOutcome(signalId);
  }
  const tenant = { organizationId: client.organizationId, clientId };
  const canonical = useCases.observations
    .list(tenant)
    .filter(
      (o) =>
        o.sourceKind === 'SIGNAL_OUTCOME' &&
        o.sourceRef.sourceId === signalId &&
        o.status === 'ACTIVE'
    )
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
  if (canonical) return observationToSignalOutcome(canonical);
  return dbService.getSignalOutcome(signalId);
}

/** Display-only projection for thesis metrics / radar UI. */
export function listSignalOutcomesForDisplay(clientId: string): SignalOutcome[] {
  const client = dbService.getClientById(clientId);
  if (!client?.organizationId) {
    return dbService.getSignalOutcomes(clientId);
  }
  const tenant = { organizationId: client.organizationId, clientId };
  const canonical = useCases.observations
    .list(tenant)
    .filter((o) => o.sourceKind === 'SIGNAL_OUTCOME' && o.status === 'ACTIVE')
    .map(observationToSignalOutcome);
  if (canonical.length > 0) {
    const bySignal = new Map<string, SignalOutcome>();
    for (const row of canonical) {
      const prev = bySignal.get(row.signalId);
      if (!prev || row.createdAt > prev.createdAt) bySignal.set(row.signalId, row);
    }
    return [...bySignal.values()];
  }
  return dbService.getSignalOutcomes(clientId);
}

export function registerSignalOutcomeIntent(params: {
  clientId: string;
  signalId: string;
  kind: SignalOutcomeKind;
  source: OutcomeSource;
  note?: string;
  thesisId?: string;
  forgedObservation?: unknown;
  actorType?: string;
  role?: string;
  actorUid?: string;
  createdBy?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  now?: string;
}): { observationId: string; created: boolean; mirrored: boolean } {
  void params.forgedObservation;
  void params.actorType;
  void params.role;
  void params.actorUid;
  void params.createdBy;

  const trusted = requireTrusted(params.clientId, { now: params.now });
  const signal = dbService.getSignalById(params.signalId);
  if (!signal || signal.clientId !== trusted.clientId) {
    throw new LearningApplicationError('INVALID_OBSERVATION', 'Signal not found for tenant.');
  }

  const intentKey = `signal-outcome:${params.signalId}:${params.kind}`;
  const observationId = createId('obs');
  const result = useCases.registerObservation({
    trusted,
    observationId,
    thesisScope: thesisScopeForSignal(params.thesisId ?? signal.thesisId),
    sourceKind: 'SIGNAL_OUTCOME',
    sourceRef: { sourceSpec: 'SPEC-001', sourceId: params.signalId },
    observationKind: params.kind,
    payload: {
      signalId: params.signalId,
      kind: params.kind,
      source: params.source,
      note: params.note,
    },
    intentKey,
    claimedOrganizationId: params.claimedOrganizationId,
    claimedClientId: params.claimedClientId,
  });

  const mirrored = result.writeUnitCommitted
    ? mirrorSignalOutcomeAfterCanonical({
        organizationId: trusted.organizationId,
        clientId: trusted.clientId,
        signalId: params.signalId,
        kind: params.kind,
        source: params.source,
        note: params.note,
        actorUid: trusted.actorId,
      })
    : false;

  return {
    observationId: result.observation.observationId,
    created: result.created,
    mirrored,
  };
}

export function registerResultRecordIntent(params: {
  clientId: string;
  title: string;
  channel: string;
  metricLabel: string;
  metricValue: number;
  kpiType?: BusinessKpiType;
  notes?: string;
  contentId?: string;
  opportunityId?: string;
  taskId?: string;
  intentKey?: string;
  forgedObservation?: unknown;
  actorType?: string;
  role?: string;
  actorUid?: string;
  createdBy?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  now?: string;
}): { observationId: string; resultId?: string; created: boolean; mirrored: boolean } {
  void params.forgedObservation;
  void params.actorType;
  void params.role;
  void params.actorUid;
  void params.createdBy;

  const trusted = requireTrusted(params.clientId, { now: params.now });
  const intentKey =
    params.intentKey?.trim() ||
    `result:${params.title}:${params.metricLabel}:${params.metricValue}:${trusted.now}`;
  const observationId = createId('obs');

  const result = useCases.registerObservation({
    trusted,
    observationId,
    thesisScope: { kind: 'CLIENT_WIDE' },
    sourceKind: 'RESULT_RECORD',
    sourceRef: { sourceSpec: 'LEGACY_RESULT', sourceId: intentKey },
    observationKind: 'KPI',
    payload: {
      title: params.title,
      channel: params.channel,
      metricLabel: params.metricLabel,
      metricValue: params.metricValue,
      kpiType: params.kpiType,
      notes: params.notes,
      contentId: params.contentId,
      opportunityId: params.opportunityId,
      taskId: params.taskId,
    },
    intentKey,
    claimedOrganizationId: params.claimedOrganizationId,
    claimedClientId: params.claimedClientId,
  });

  let resultId: string | undefined;
  const mirrored =
    result.writeUnitCommitted &&
    Boolean(
      (resultId = mirrorResultAfterCanonical({
        organizationId: trusted.organizationId,
        clientId: trusted.clientId,
        title: params.title,
        channel: params.channel,
        metricLabel: params.metricLabel,
        metricValue: params.metricValue,
        kpiType: params.kpiType,
        notes: params.notes,
        contentId: params.contentId,
        opportunityId: params.opportunityId,
        taskId: params.taskId,
        addedToEvidence: false,
        createdBy: trusted.actorId,
      }))
    );

  return {
    observationId: result.observation.observationId,
    resultId,
    created: result.created,
    mirrored,
  };
}

/**
 * Read-only SPEC-007 outcome ingest — does not mutate Opportunity lifecycle.
 */
export function ingestOpportunityOutcomeObservation(params: {
  clientId: string;
  opportunityId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  now?: string;
}): { ingested: boolean; observationId?: string } {
  const trusted = requireTrusted(params.clientId, { now: params.now });
  const projection = useCases.opportunityOutcomes.getOutcome(params.opportunityId, {
    organizationId: trusted.organizationId,
    clientId: trusted.clientId,
  });
  if (!projection) {
    return { ingested: false };
  }

  const observationKind = mapOpportunityStatusToKind(projection.outcomeStatus);
  if (!observationKind) {
    return { ingested: false };
  }

  const intentKey = `opportunity-outcome:${params.opportunityId}:${projection.outcomeStatus}`;
  const observationId = createId('obs');
  const result = useCases.registerObservation({
    trusted,
    observationId,
    thesisScope: { kind: 'SINGLE', thesisId: projection.thesisId },
    sourceKind: 'OPPORTUNITY_OUTCOME',
    sourceRef: { sourceSpec: 'SPEC-007', sourceId: params.opportunityId },
    observationKind,
    payload: {
      opportunityId: params.opportunityId,
      outcomeStatus: projection.outcomeStatus,
      recordedAt: projection.recordedAt,
    },
    intentKey,
    claimedOrganizationId: params.claimedOrganizationId,
    claimedClientId: params.claimedClientId,
  });

  return {
    ingested: result.created,
    observationId: result.observation.observationId,
  };
}

export { LearningApplicationError };
