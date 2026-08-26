/**
 * SPEC-007 Phase 2 — Lifecycle use cases (Accept/Decline/Checklist/Submit/Complete/Archive).
 */

import {
  transitionMaterializedOpportunity,
  updateMaterializedOpportunityChecklist,
  type MaterializedOpportunity,
  type OpportunityChecklistItem,
} from '../../domain/opportunityCore';
import type { CanonicalOpportunityStatus } from '../../domain/opportunityLifecycleCore';
import {
  createHistoryEventIntent,
  opportunityMaterialFingerprint,
} from '../../domain/opportunityMaterialityCore';
import { projectMaterializedOpportunityExplainability } from '../../domain/opportunityExplainabilityCore';
import { commitGovernedOpportunityWriteUnit } from './commitWriteUnit';
import { loadAuthoritativeOpportunity } from './loadAggregates';
import { unwrapDomain } from './mapDomainError';
import type { OpportunityHistoryPort } from './ports/OpportunityHistoryPort';
import type { OpportunityRepository } from './ports/OpportunityRepository';
import {
  assertNoTenantSpoof,
  assertTrustedOpportunityActor,
  ignoreCallerActorClaims,
  resolveTrustedOpportunityActorKind,
  trustedTenant,
  type TrustedOpportunityActorContext,
} from './trustedContext';

export interface OpportunityLifecycleDeps {
  opportunities: OpportunityRepository;
  history: OpportunityHistoryPort;
}

export interface LifecycleBaseInput {
  trusted: TrustedOpportunityActorContext;
  opportunityId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  /** Caller Opportunity snapshot — IGNORED; repository current wins. */
  forgedOpportunity?: unknown;
  forgedStatus?: string;
  actorType?: string;
  role?: string;
  softwareAuthority?: boolean;
  persist?: boolean;
}

function applyTransition(
  deps: OpportunityLifecycleDeps,
  input: LifecycleBaseInput,
  to: CanonicalOpportunityStatus,
  mode: 'humanLifecycle' | 'softwareLifecycle'
) {
  assertTrustedOpportunityActor(input.trusted);
  assertNoTenantSpoof(input);
  ignoreCallerActorClaims(input);
  void input.forgedOpportunity;
  void input.forgedStatus;

  const actorKind = resolveTrustedOpportunityActorKind(input.trusted, mode);
  // Current repository state wins over caller snapshot.
  const current = loadAuthoritativeOpportunity(
    deps.opportunities,
    input.trusted,
    input.opportunityId
  );

  const opportunity = unwrapDomain(
    transitionMaterializedOpportunity(current, to, actorKind, input.trusted.now)
  );

  const tenant = trustedTenant(input.trusted);
  const history = createHistoryEventIntent({
    kind: 'OPPORTUNITY_TRANSITION',
    organizationId: tenant.organizationId,
    clientId: tenant.clientId,
    aggregateKind: 'OPPORTUNITY',
    aggregateId: opportunity.id,
    aggregateVersion: opportunity.version,
    actorKind,
    reasonCodes: ['TRANSITION_APPLIED'],
    materialFingerprint: opportunityMaterialFingerprint(opportunity),
    occurredAt: input.trusted.now,
  });

  let writeUnitCommitted = false;
  if (input.persist !== false) {
    commitGovernedOpportunityWriteUnit(deps, {
      opportunities: [opportunity],
      history: [history],
    });
    writeUnitCommitted = true;
  }

  return {
    opportunity,
    writeUnitCommitted,
    explainability: projectMaterializedOpportunityExplainability(opportunity, [
      'TRANSITION_APPLIED',
    ]),
  };
}

export function createAcceptOpportunity(deps: OpportunityLifecycleDeps) {
  return (input: LifecycleBaseInput) =>
    applyTransition(deps, input, 'ACCEPTED', 'humanLifecycle');
}

export function createDeclineOpportunity(deps: OpportunityLifecycleDeps) {
  return (input: LifecycleBaseInput) =>
    applyTransition(deps, input, 'DECLINED', 'humanLifecycle');
}

export function createSubmitOpportunity(deps: OpportunityLifecycleDeps) {
  return (input: LifecycleBaseInput) =>
    applyTransition(deps, input, 'SUBMITTED', 'humanLifecycle');
}

export function createCompleteOpportunity(deps: OpportunityLifecycleDeps) {
  return (input: LifecycleBaseInput) => {
    assertTrustedOpportunityActor(input.trusted);
    // SOFTWARE may complete when Domain permits; prefer softwareAuthority if set.
    const mode = input.trusted.softwareAuthority
      ? 'softwareLifecycle'
      : 'humanLifecycle';
    return applyTransition(deps, input, 'COMPLETED', mode);
  };
}

export function createArchiveOpportunity(deps: OpportunityLifecycleDeps) {
  return (input: LifecycleBaseInput) => {
    assertTrustedOpportunityActor(input.trusted);
    const mode = input.trusted.softwareAuthority
      ? 'softwareLifecycle'
      : 'humanLifecycle';
    return applyTransition(deps, input, 'ARCHIVED', mode);
  };
}

export interface UpdateOpportunityChecklistInput extends LifecycleBaseInput {
  checklist: OpportunityChecklistItem[];
}

export function createUpdateOpportunityChecklist(deps: OpportunityLifecycleDeps) {
  return function updateOpportunityChecklist(input: UpdateOpportunityChecklistInput): {
    opportunity: MaterializedOpportunity;
    writeUnitCommitted: boolean;
    explainability: ReturnType<typeof projectMaterializedOpportunityExplainability>;
  } {
    assertTrustedOpportunityActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    void input.forgedOpportunity;
    void input.forgedStatus;

    const mode = input.trusted.softwareAuthority
      ? 'softwareLifecycle'
      : 'humanLifecycle';
    const actorKind = resolveTrustedOpportunityActorKind(input.trusted, mode);
    const current = loadAuthoritativeOpportunity(
      deps.opportunities,
      input.trusted,
      input.opportunityId
    );

    const opportunity = unwrapDomain(
      updateMaterializedOpportunityChecklist(
        current,
        input.checklist,
        actorKind,
        input.trusted.now
      )
    );

    const tenant = trustedTenant(input.trusted);
    const history = createHistoryEventIntent({
      kind: 'OPPORTUNITY_TRANSITION',
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      aggregateKind: 'OPPORTUNITY',
      aggregateId: opportunity.id,
      aggregateVersion: opportunity.version,
      actorKind,
      reasonCodes: ['TRANSITION_APPLIED'],
      materialFingerprint: opportunityMaterialFingerprint(opportunity),
      occurredAt: input.trusted.now,
    });

    let writeUnitCommitted = false;
    if (input.persist !== false) {
      commitGovernedOpportunityWriteUnit(deps, {
        opportunities: [opportunity],
        history: [history],
      });
      writeUnitCommitted = true;
    }

    return {
      opportunity,
      writeUnitCommitted,
      explainability: projectMaterializedOpportunityExplainability(opportunity, [
        'TRANSITION_APPLIED',
      ]),
    };
  };
}
