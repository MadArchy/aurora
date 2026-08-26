/**
 * SPEC-007 Phase 2 — MaterializeOpportunity (SPEC-004 authorization required).
 */

import { materializeOpportunity } from '../../domain/opportunityCore';
import type { OpportunityType } from '../../domain/opportunityCandidateCore';
import {
  CREATE_OPPORTUNITY_ACTION,
  assertHighScoreDoesNotAuthorize,
} from '../../domain/opportunityMaterializeGateCore';
import {
  createHistoryEventIntent,
  opportunityCommandFingerprint,
  opportunityMaterialFingerprint,
} from '../../domain/opportunityMaterialityCore';
import { projectMaterializedOpportunityExplainability } from '../../domain/opportunityExplainabilityCore';
import { commitGovernedOpportunityWriteUnit } from './commitWriteUnit';
import { OpportunityApplicationError } from './errors';
import { loadAuthoritativeCandidate } from './loadAggregates';
import { unwrapDomain } from './mapDomainError';
import type { OpportunityCandidateRepository } from './ports/OpportunityCandidateRepository';
import type { OpportunityHistoryPort } from './ports/OpportunityHistoryPort';
import type { OpportunityRepository } from './ports/OpportunityRepository';
import type { OpportunityStrategicBriefReader } from './ports/OpportunityStrategicBriefReader';
import type { StrategicPlanAuthorizationPort } from './ports/StrategicPlanAuthorizationPort';
import {
  assertNoTenantSpoof,
  assertTrustedOpportunityActor,
  ignoreCallerActorClaims,
  resolveTrustedOpportunityActorKind,
  trustedTenant,
  type TrustedOpportunityActorContext,
} from './trustedContext';

export interface MaterializeOpportunityInput {
  trusted: TrustedOpportunityActorContext;
  opportunityId: string;
  planId: string;
  planItemId: string;
  /** Explicit thesis — required; never inferred from highest score. */
  thesisId: string;
  candidateId?: string;
  title: string;
  organization: string;
  type: OpportunityType;
  description: string;
  fitRationale: string;
  deadline?: string | null;
  intentKey: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  /** Caller Plan / Brief / allow — IGNORED. */
  forgedPlan?: unknown;
  forgedBrief?: unknown;
  forgedAuthorizationAllowed?: boolean;
  forgedOpportunity?: unknown;
  forgedCandidate?: unknown;
  actorType?: string;
  role?: string;
  softwareAuthority?: boolean;
  /** Adversarial: high score alone never materializes. */
  opportunityScoreTotal?: number;
  persist?: boolean;
}

export interface MaterializeOpportunityDeps {
  opportunities: OpportunityRepository;
  candidates?: OpportunityCandidateRepository;
  history: OpportunityHistoryPort;
  planAuth: StrategicPlanAuthorizationPort;
  briefs?: OpportunityStrategicBriefReader;
}

export function createMaterializeOpportunity(deps: MaterializeOpportunityDeps) {
  return function materializeOpportunityUseCase(input: MaterializeOpportunityInput) {
    assertTrustedOpportunityActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    void input.forgedPlan;
    void input.forgedBrief;
    void input.forgedAuthorizationAllowed;
    void input.forgedOpportunity;
    void input.forgedCandidate;

    const actorKind = resolveTrustedOpportunityActorKind(input.trusted, 'materialize');
    const tenant = trustedTenant(input.trusted);

    const intentKey = input.intentKey?.trim();
    if (!intentKey) {
      throw new OpportunityApplicationError(
        'INVALID_OPPORTUNITY',
        'intentKey is required for materialize idempotency.'
      );
    }

    const idemKey = opportunityCommandFingerprint({
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      command: 'MaterializeOpportunity',
      intentKey,
    });

    const existingKey = deps.opportunities.findByIdempotencyKey(tenant, idemKey);
    if (existingKey) {
      const existing = deps.opportunities.getById(existingKey.opportunityId, tenant);
      if (existing) {
        return {
          opportunity: existing,
          created: false,
          writeUnitCommitted: false,
          explainability: projectMaterializedOpportunityExplainability(existing),
        };
      }
    }

    const authDecision = deps.planAuth.authorizeCreateOpportunity({
      tenant,
      planId: input.planId,
      planItemId: input.planItemId,
      actorKind: actorKind === 'SOFTWARE' ? 'SOFTWARE' : 'HUMAN',
    });

    // High OpportunityScore never creates execution authority when Plan denies/absent.
    if (
      typeof input.opportunityScoreTotal === 'number' &&
      (authDecision.allowed !== true || authDecision.disposition !== 'ALLOW')
    ) {
      unwrapDomain(
        assertHighScoreDoesNotAuthorize(input.opportunityScoreTotal, false)
      );
    }

    if (authDecision.disposition === 'NONE') {
      throw new OpportunityApplicationError(
        'SPEC004_DENY',
        'SPEC-004 authorization disposition NONE — materialization denied.'
      );
    }
    if (authDecision.disposition === 'RESEARCH_ONLY') {
      throw new OpportunityApplicationError(
        'SPEC004_DENY',
        'SPEC-004 RESEARCH_ONLY cannot materialize Opportunity.'
      );
    }
    if (authDecision.disposition === 'DENY' || authDecision.allowed !== true) {
      throw new OpportunityApplicationError(
        'SPEC004_DENY',
        `SPEC-004 denied CREATE_OPPORTUNITY: ${authDecision.reasons.join('; ') || 'DENY'}`
      );
    }
    if (authDecision.action !== CREATE_OPPORTUNITY_ACTION) {
      throw new OpportunityApplicationError(
        'ACTION_NOT_AUTHORIZED',
        `authorized action must be CREATE_OPPORTUNITY (got ${authDecision.action})`
      );
    }
    if (
      authDecision.organizationId !== tenant.organizationId ||
      authDecision.clientId !== tenant.clientId
    ) {
      throw new OpportunityApplicationError(
        'TENANT_MISMATCH',
        'SPEC-004 authorization tenant mismatch.'
      );
    }
    if (
      authDecision.planStatus === 'SUPERSEDED' ||
      authDecision.reasons.includes('PLAN_SUPERSEDED') ||
      authDecision.reasons.includes('STALE_BRIEF_CONTEXT')
    ) {
      throw new OpportunityApplicationError(
        'STALE_STATE',
        'SPEC-004 authorization references stale or superseded Plan/Brief.'
      );
    }

    const thesisId = input.thesisId?.trim();
    if (!thesisId) {
      throw new OpportunityApplicationError(
        'THESIS_MISMATCH',
        'explicit thesisId required for materialization (no winner selection).'
      );
    }
    if (thesisId !== authDecision.thesisId) {
      throw new OpportunityApplicationError(
        'THESIS_MISMATCH',
        'requested thesisId does not match Plan authorization thesisId.'
      );
    }

    if (deps.briefs) {
      const brief = deps.briefs.getById(authDecision.strategicBriefId, tenant);
      if (!brief) {
        throw new OpportunityApplicationError(
          'NOT_FOUND',
          `StrategicBrief not found: ${authDecision.strategicBriefId}`
        );
      }
      if (brief.version !== authDecision.strategicBriefVersion) {
        throw new OpportunityApplicationError(
          'STALE_STATE',
          'Brief version does not match authorization context.'
        );
      }
      if (brief.thesisId !== thesisId) {
        throw new OpportunityApplicationError(
          'THESIS_MISMATCH',
          'Brief thesisId mismatch.'
        );
      }
    }

    const candidate =
      input.candidateId && deps.candidates
        ? loadAuthoritativeCandidate(deps.candidates, input.trusted, input.candidateId)
        : null;

    const materialized = unwrapDomain(
      materializeOpportunity({
        id: input.opportunityId,
        authorization: {
          organizationId: tenant.organizationId,
          clientId: tenant.clientId,
          thesisId: authDecision.thesisId,
          strategicBriefId: authDecision.strategicBriefId,
          strategicBriefVersion: authDecision.strategicBriefVersion,
          strategicPlanId: authDecision.strategicPlanId,
          strategicPlanVersion: authDecision.strategicPlanVersion,
          planItemId: authDecision.planItemId,
          action: CREATE_OPPORTUNITY_ACTION,
          authorizationAllowed: true,
          actorKind,
        },
        thesisId,
        candidate,
        title: input.title,
        organization: input.organization,
        type: input.type,
        deadline: input.deadline,
        description: input.description,
        fitRationale: input.fitRationale,
        createdAt: input.trusted.now,
        updatedAt: input.trusted.now,
        createdBy: input.trusted.actorId,
      })
    );

    const history = createHistoryEventIntent({
      kind: 'OPPORTUNITY_MATERIALIZED',
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      aggregateKind: 'OPPORTUNITY',
      aggregateId: materialized.opportunity.id,
      aggregateVersion: materialized.opportunity.version,
      actorKind,
      reasonCodes: ['CREATE_OPPORTUNITY_AUTHORIZATION_ALLOW'],
      materialFingerprint: opportunityMaterialFingerprint(materialized.opportunity),
      occurredAt: input.trusted.now,
    });

    let writeUnitCommitted = false;
    if (input.persist !== false) {
      commitGovernedOpportunityWriteUnit(deps, {
        opportunities: [materialized.opportunity],
        history: [history],
        idempotencyKeys: [
          {
            key: idemKey,
            aggregateKind: 'OPPORTUNITY',
            aggregateId: materialized.opportunity.id,
            organizationId: tenant.organizationId,
            clientId: tenant.clientId,
            at: input.trusted.now,
          },
        ],
      });
      writeUnitCommitted = true;
    }

    return {
      opportunity: materialized.opportunity,
      gate: materialized.gate,
      created: true,
      writeUnitCommitted,
      explainability: projectMaterializedOpportunityExplainability(
        materialized.opportunity,
        ['CREATE_OPPORTUNITY_AUTHORIZATION_ALLOW']
      ),
    };
  };
}
