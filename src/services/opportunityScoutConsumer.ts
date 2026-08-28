/**
 * SPEC-007 Phase 4 — Consumer facade for Opportunity Scout.
 * Composition root for main/UI. UI issues intent only — never tenant/role/lifecycle authority.
 */

import type { MaterializedOpportunity } from '../domain/opportunityCore';
import type { OpportunityType } from '../domain/opportunityCandidateCore';
import type { CanonicalOpportunityStatus } from '../domain/opportunityLifecycleCore';
import {
  OpportunityApplicationError,
  type StrategicPlanAuthorizationPort,
  type TrustedOpportunityActorContext,
} from '../application/opportunityScout';
import { composeOpportunityScout } from '../composition/opportunityScout/composeOpportunityScout';
import { createStrategicPlanAuthorizationAdapter } from '../composition/opportunityScout/StrategicPlanAuthorizationAdapter';
import {
  createLocalOpportunityScoutStore,
  LocalOpportunityScoutStore,
} from '../infrastructure/opportunityScout';
import { defaultOpportunityChecklist } from '../domain/opportunityLifecycle';
import { createId } from '../lib/id';
import { requireTenantScope } from '../controllers/trustedTenant';
import { authService } from './auth';
import { dbService } from './db';
import { getStrategicBrief } from './strategicBriefConsumer';
import type { Opportunity } from '../types';
import { ingestOpportunityOutcomeObservation, registerSharedOpportunityStoreForLearning } from './learningLoopConsumer';

type OpportunityUseCases = ReturnType<typeof composeOpportunityScout>;

let store: LocalOpportunityScoutStore = createLocalOpportunityScoutStore();
registerSharedOpportunityStoreForLearning(store);
let useCases: OpportunityUseCases = buildUseCases(store);

function buildUseCases(
  nextStore: LocalOpportunityScoutStore,
  planAuth?: StrategicPlanAuthorizationPort
): OpportunityUseCases {
  return composeOpportunityScout({
    store: nextStore,
    planAuth: planAuth ?? createStrategicPlanAuthorizationAdapter(),
    briefs: {
      getById(briefId, tenant) {
        const brief = getStrategicBrief(briefId, tenant.clientId);
        if (!brief) return undefined;
        if (
          brief.organizationId !== tenant.organizationId ||
          brief.clientId !== tenant.clientId
        ) {
          return undefined;
        }
        return {
          id: brief.id,
          organizationId: brief.organizationId,
          clientId: brief.clientId,
          thesisId: brief.thesisId,
          version: brief.version,
          status: brief.status,
        };
      },
    },
  });
}

/** Test-only reset — not production API. */
export function resetOpportunityScoutConsumerForTest(
  nextStore?: LocalOpportunityScoutStore,
  options?: { planAuth?: StrategicPlanAuthorizationPort }
): void {
  store = nextStore ?? createLocalOpportunityScoutStore();
  store.resetForTest();
  registerSharedOpportunityStoreForLearning(store);
  useCases = buildUseCases(store, options?.planAuth);
}

export function getOpportunityScoutStoreForTest(): LocalOpportunityScoutStore {
  return store;
}

/**
 * Trusted context from auth/runtime — never from UI path/query/form tenant claims.
 * `softwareAuthority` is composition-only for materialize paths.
 */
export function buildTrustedOpportunityContext(
  clientId: string,
  options?: { now?: string; softwareAuthority?: boolean }
): TrustedOpportunityActorContext | undefined {
  // CR-3: organization comes from the trusted session via requireTenantScope —
  // never from the requested client record.
  const decision = requireTenantScope(clientId, {
    getCurrentUser: () => authService.getCurrentUser(),
    getClientById: (id) => dbService.getClientById(id),
  });
  if (!decision.ok) return undefined;
  return {
    actorId: decision.actorId,
    actorRole: decision.actorRole === 'CLIENT' ? 'CLIENT' : 'ADMIN',
    organizationId: decision.organizationId,
    clientId: decision.clientId,
    now: options?.now ?? new Date().toISOString(),
    softwareAuthority: options?.softwareAuthority === true ? true : undefined,
  };
}

function requireTrusted(
  clientId: string,
  options?: { now?: string; softwareAuthority?: boolean }
): TrustedOpportunityActorContext {
  const trusted = buildTrustedOpportunityContext(clientId, options);
  if (!trusted) {
    throw new OpportunityApplicationError(
      'TRUSTED_CONTEXT_REQUIRED',
      'Trusted actor/tenant context required for Opportunity operations.'
    );
  }
  return trusted;
}

/** Display-only projection — not Domain authority. */
export interface OpportunityDisplayProjection {
  id: string;
  organizationId: string;
  clientId: string;
  thesisId: string;
  title: string;
  organization: string;
  type: OpportunityType;
  deadline: string | null;
  description: string;
  fitRationale: string;
  /** Canonical lifecycle — sole authoritative status for UI. */
  status: CanonicalOpportunityStatus;
  submissionChecklist: MaterializedOpportunity['submissionChecklist'];
  createdAt: string;
  updatedAt: string;
  clientNotes?: string;
  submittedAt?: string;
  /** Compatibility flag — never execution authority. */
  authority: 'CANONICAL';
}

const CANONICAL_DISPLAY_LABELS: Record<CanonicalOpportunityStatus, string> = {
  PROPOSED: 'Propuesta',
  ACCEPTED: 'Aceptada',
  DECLINED: 'Declinada',
  CHECKLIST: 'Checklist en curso',
  SUBMITTED: 'Postulación enviada',
  COMPLETED: 'Completada',
  ARCHIVED: 'Archivada',
};

export function opportunityStatusDisplayLabel(
  status: CanonicalOpportunityStatus
): string {
  return CANONICAL_DISPLAY_LABELS[status];
}

export function projectOpportunityForDisplay(
  opportunity: MaterializedOpportunity,
  extras?: { clientNotes?: string; submittedAt?: string }
): OpportunityDisplayProjection {
  return {
    id: opportunity.id,
    organizationId: opportunity.organizationId,
    clientId: opportunity.clientId,
    thesisId: opportunity.thesisId,
    title: opportunity.title,
    organization: opportunity.organization,
    type: opportunity.type,
    deadline: opportunity.deadline,
    description: opportunity.description,
    fitRationale: opportunity.fitRationale,
    status: opportunity.status,
    submissionChecklist: opportunity.submissionChecklist.map((c) => ({ ...c })),
    createdAt: opportunity.createdAt,
    updatedAt: opportunity.updatedAt,
    clientNotes: extras?.clientNotes,
    submittedAt: extras?.submittedAt,
    authority: 'CANONICAL',
  };
}

/**
 * Map canonical → legacy COMPATIBILITY mirror fields.
 * Dual OpportunityStatus/lifecycleStage is NON_AUTHORITATIVE after Phase 4.
 */
function toLegacyCompatibilityMirror(
  opportunity: MaterializedOpportunity,
  extras?: { clientDecision?: 'ACCEPTED' | 'REJECTED'; clientNotes?: string; signalId?: string }
): Opportunity {
  const statusPair = (() => {
    switch (opportunity.status) {
      case 'PROPOSED':
        return { status: 'SENT_TO_CLIENT' as const, lifecycleStage: 'proposed' as const };
      case 'ACCEPTED':
        return { status: 'ACCEPTED' as const, lifecycleStage: 'accepted' as const };
      case 'DECLINED':
        return { status: 'REJECTED' as const, lifecycleStage: 'declined' as const };
      case 'CHECKLIST':
        return { status: 'IN_PROGRESS' as const, lifecycleStage: 'checklist' as const };
      case 'SUBMITTED':
        return { status: 'COMPLETED' as const, lifecycleStage: 'submitted' as const };
      case 'COMPLETED':
        return { status: 'COMPLETED' as const, lifecycleStage: 'submitted' as const };
      case 'ARCHIVED':
        return { status: 'ARCHIVED' as const, lifecycleStage: 'submitted' as const };
      default:
        return { status: 'SENT_TO_CLIENT' as const, lifecycleStage: 'proposed' as const };
    }
  })();

  return {
    id: opportunity.id,
    organizationId: opportunity.organizationId,
    clientId: opportunity.clientId,
    thesisId: opportunity.thesisId,
    title: opportunity.title,
    organization: opportunity.organization,
    type: opportunity.type,
    deadline: opportunity.deadline ?? '',
    description: opportunity.description,
    fitRationale: opportunity.fitRationale,
    status: statusPair.status,
    lifecycleStage: statusPair.lifecycleStage,
    submissionChecklist: opportunity.submissionChecklist.map((c) => ({ ...c })),
    createdAt: opportunity.createdAt,
    strategicBriefId: opportunity.strategicBriefId,
    strategicBriefVersion: opportunity.strategicBriefVersion,
    signalId: extras?.signalId,
    clientDecision: extras?.clientDecision,
    clientNotes: extras?.clientNotes,
    submittedAt:
      opportunity.status === 'SUBMITTED' || opportunity.status === 'COMPLETED'
        ? opportunity.updatedAt
        : undefined,
  };
}

/**
 * NON_AUTHORITATIVE / COMPATIBILITY_WRITE_MIRROR — after canonical success only.
 * Never used as fallback after Application deny.
 */
function mirrorCompatibilityAfterCanonicalSuccess(
  opportunity: MaterializedOpportunity,
  extras?: { clientDecision?: 'ACCEPTED' | 'REJECTED'; clientNotes?: string; signalId?: string }
): void {
  dbService.mirrorOpportunityCompatibility(
    toLegacyCompatibilityMirror(opportunity, extras)
  );
}

/** Read-only SPEC-008 ingest — non-blocking; does not mutate Opportunity lifecycle. */
function ingestLearningFromOpportunityOutcome(clientId: string, opportunityId: string, now?: string): void {
  try {
    ingestOpportunityOutcomeObservation({ clientId, opportunityId, now });
  } catch {
    /* learning ingest failure must not affect SPEC-007 authority */
  }
}

/**
 * Strategic CREATE_OPPORTUNITY after SPEC-004 gate.
 * Uses SOFTWARE trusted context (composition-injected) for PROPOSED entry.
 * No legacy dbService.addOpportunity authority; optional mirror AFTER success.
 */
export function materializeOpportunityForDelivery(params: {
  clientId: string;
  planId: string;
  planItemId: string;
  thesisId: string;
  title: string;
  organization: string;
  type?: OpportunityType;
  description: string;
  fitRationale: string;
  deadline?: string;
  strategicBriefId: string;
  strategicBriefVersion?: number;
  signalId?: string;
  intentKey: string;
  opportunityId?: string;
  /** Caller-forged — IGNORED. */
  forgedPlan?: unknown;
  forgedBrief?: unknown;
  forgedAuthorizationAllowed?: boolean;
  opportunityScoreTotal?: number;
  actorType?: string;
  role?: string;
  now?: string;
}): MaterializedOpportunity {
  void params.forgedPlan;
  void params.forgedBrief;
  void params.forgedAuthorizationAllowed;
  void params.actorType;
  void params.role;
  void params.strategicBriefId;
  void params.strategicBriefVersion;

  const trusted = requireTrusted(params.clientId, {
    now: params.now,
    softwareAuthority: true,
  });

  const opportunityId = params.opportunityId?.trim() || createId('opp');
  const result = useCases.materialize({
    trusted,
    opportunityId,
    planId: params.planId,
    planItemId: params.planItemId,
    thesisId: params.thesisId,
    title: params.title,
    organization: params.organization,
    type: params.type ?? 'PANEL',
    description: params.description,
    fitRationale: params.fitRationale,
    deadline: params.deadline ?? null,
    intentKey: params.intentKey,
    opportunityScoreTotal: params.opportunityScoreTotal,
    forgedPlan: params.forgedPlan,
    forgedBrief: params.forgedBrief,
    forgedAuthorizationAllowed: params.forgedAuthorizationAllowed,
    actorType: params.actorType,
    role: params.role,
  });

  mirrorCompatibilityAfterCanonicalSuccess(result.opportunity, {
    signalId: params.signalId,
  });
  return result.opportunity;
}

export function listOpportunitiesForClient(
  clientId: string,
  options?: { now?: string; claimedOrganizationId?: string; claimedClientId?: string }
): OpportunityDisplayProjection[] {
  const trusted = requireTrusted(clientId, { now: options?.now });
  const rows = useCases.listOpportunities({
    trusted,
    claimedOrganizationId: options?.claimedOrganizationId,
    claimedClientId: options?.claimedClientId,
  });
  return rows
    .filter((o) => o.status !== 'ARCHIVED')
    .map((o) => projectOpportunityForDisplay(o));
}

export function getOpportunityForClient(
  clientId: string,
  opportunityId: string,
  options?: {
    now?: string;
    claimedOrganizationId?: string;
    claimedClientId?: string;
    forgedOpportunity?: unknown;
  }
): OpportunityDisplayProjection {
  const trusted = requireTrusted(clientId, { now: options?.now });
  const opportunity = useCases.getOpportunity({
    trusted,
    opportunityId,
    claimedOrganizationId: options?.claimedOrganizationId,
    claimedClientId: options?.claimedClientId,
    forgedOpportunity: options?.forgedOpportunity,
  });
  return projectOpportunityForDisplay(opportunity);
}

export function acceptClientOpportunity(params: {
  clientId: string;
  opportunityId: string;
  notes?: string;
  forgedOpportunity?: unknown;
  forgedStatus?: string;
  actorType?: string;
  role?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  now?: string;
}): OpportunityDisplayProjection {
  const trusted = requireTrusted(params.clientId, { now: params.now });
  const accepted = useCases.accept({
    trusted,
    opportunityId: params.opportunityId,
    forgedOpportunity: params.forgedOpportunity,
    forgedStatus: params.forgedStatus,
    actorType: params.actorType,
    role: params.role,
    claimedOrganizationId: params.claimedOrganizationId,
    claimedClientId: params.claimedClientId,
  });

  let opportunity = accepted.opportunity;
  if (opportunity.submissionChecklist.length === 0) {
    const checklist = defaultOpportunityChecklist(opportunity.type, {
      title: opportunity.title,
      type: opportunity.type,
    });
    opportunity = useCases.updateChecklist({
      trusted,
      opportunityId: params.opportunityId,
      checklist,
    }).opportunity;
  }

  mirrorCompatibilityAfterCanonicalSuccess(opportunity, {
    clientDecision: 'ACCEPTED',
    clientNotes: params.notes,
  });
  ingestLearningFromOpportunityOutcome(params.clientId, params.opportunityId, params.now);
  return projectOpportunityForDisplay(opportunity, { clientNotes: params.notes });
}

export function declineClientOpportunity(params: {
  clientId: string;
  opportunityId: string;
  notes?: string;
  forgedOpportunity?: unknown;
  forgedStatus?: string;
  actorType?: string;
  role?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  now?: string;
}): OpportunityDisplayProjection {
  const trusted = requireTrusted(params.clientId, { now: params.now });
  const declined = useCases.decline({
    trusted,
    opportunityId: params.opportunityId,
    forgedOpportunity: params.forgedOpportunity,
    forgedStatus: params.forgedStatus,
    actorType: params.actorType,
    role: params.role,
    claimedOrganizationId: params.claimedOrganizationId,
    claimedClientId: params.claimedClientId,
  });
  mirrorCompatibilityAfterCanonicalSuccess(declined.opportunity, {
    clientDecision: 'REJECTED',
    clientNotes: params.notes,
  });
  ingestLearningFromOpportunityOutcome(params.clientId, params.opportunityId, params.now);
  return projectOpportunityForDisplay(declined.opportunity, {
    clientNotes: params.notes,
  });
}

export function toggleClientOpportunityChecklistItem(params: {
  clientId: string;
  opportunityId: string;
  itemId: string;
  done: boolean;
  forgedOpportunity?: unknown;
  actorType?: string;
  role?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  now?: string;
}): OpportunityDisplayProjection {
  const trusted = requireTrusted(params.clientId, { now: params.now });
  const current = useCases.getOpportunity({
    trusted,
    opportunityId: params.opportunityId,
    forgedOpportunity: params.forgedOpportunity,
    claimedOrganizationId: params.claimedOrganizationId,
    claimedClientId: params.claimedClientId,
  });
  const checklist = current.submissionChecklist.map((item) =>
    item.id === params.itemId ? { ...item, done: params.done } : { ...item }
  );
  const updated = useCases.updateChecklist({
    trusted,
    opportunityId: params.opportunityId,
    checklist,
    forgedOpportunity: params.forgedOpportunity,
    actorType: params.actorType,
    role: params.role,
    claimedOrganizationId: params.claimedOrganizationId,
    claimedClientId: params.claimedClientId,
  });
  mirrorCompatibilityAfterCanonicalSuccess(updated.opportunity);
  return projectOpportunityForDisplay(updated.opportunity);
}

export function submitClientOpportunity(params: {
  clientId: string;
  opportunityId: string;
  forgedOpportunity?: unknown;
  actorType?: string;
  role?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  now?: string;
}): OpportunityDisplayProjection {
  const trusted = requireTrusted(params.clientId, { now: params.now });
  const current = useCases.getOpportunity({
    trusted,
    opportunityId: params.opportunityId,
    forgedOpportunity: params.forgedOpportunity,
  });
  if (
    current.submissionChecklist.length === 0 ||
    !current.submissionChecklist.every((item) => item.done)
  ) {
    throw new OpportunityApplicationError(
      'INVALID_OPPORTUNITY',
      'Completa todos los ítems del checklist antes de enviar.'
    );
  }
  const submitted = useCases.submit({
    trusted,
    opportunityId: params.opportunityId,
    forgedOpportunity: params.forgedOpportunity,
    actorType: params.actorType,
    role: params.role,
    claimedOrganizationId: params.claimedOrganizationId,
    claimedClientId: params.claimedClientId,
  });
  mirrorCompatibilityAfterCanonicalSuccess(submitted.opportunity);
  ingestLearningFromOpportunityOutcome(params.clientId, params.opportunityId, params.now);
  return projectOpportunityForDisplay(submitted.opportunity, {
    submittedAt: submitted.opportunity.updatedAt,
  });
}

export function completeClientOpportunity(params: {
  clientId: string;
  opportunityId: string;
  now?: string;
}): OpportunityDisplayProjection {
  const trusted = requireTrusted(params.clientId, { now: params.now });
  const completed = useCases.complete({
    trusted,
    opportunityId: params.opportunityId,
  });
  mirrorCompatibilityAfterCanonicalSuccess(completed.opportunity);
  ingestLearningFromOpportunityOutcome(params.clientId, params.opportunityId, params.now);
  return projectOpportunityForDisplay(completed.opportunity);
}

export function archiveClientOpportunity(params: {
  clientId: string;
  opportunityId: string;
  now?: string;
}): OpportunityDisplayProjection {
  const trusted = requireTrusted(params.clientId, { now: params.now });
  const archived = useCases.archive({
    trusted,
    opportunityId: params.opportunityId,
  });
  mirrorCompatibilityAfterCanonicalSuccess(archived.opportunity);
  return projectOpportunityForDisplay(archived.opportunity);
}

export { OpportunityApplicationError };
