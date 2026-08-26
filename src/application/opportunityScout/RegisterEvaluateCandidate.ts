/**
 * SPEC-007 Phase 2 — Register / Evaluate / Reevaluate OpportunityCandidate.
 */

import {
  attachOpportunityScore,
  createOpportunityCandidate,
  type CreateOpportunityCandidateInput,
  type OpportunityCandidate,
  type ThesisEvaluation,
} from '../../domain/opportunityCandidateCore';
import {
  computeOpportunityScore,
  OPPORTUNITY_SCORE_MODEL_VERSION,
  type OpportunityScoreDimensionInput,
} from '../../domain/opportunityScoreCore';
import {
  candidateMaterialFingerprint,
  createHistoryEventIntent,
  opportunityCommandFingerprint,
} from '../../domain/opportunityMaterialityCore';
import { projectOpportunityCandidateExplainability } from '../../domain/opportunityExplainabilityCore';
import { commitGovernedOpportunityWriteUnit } from './commitWriteUnit';
import { OpportunityApplicationError } from './errors';
import { loadAuthoritativeCandidate } from './loadAggregates';
import { unwrapDomain } from './mapDomainError';
import type { OpportunityCandidateRepository } from './ports/OpportunityCandidateRepository';
import type { OpportunityHistoryPort } from './ports/OpportunityHistoryPort';
import type { OpportunityAdvisorPort } from './ports/OpportunityAdvisorPort';
import {
  assertNoTenantSpoof,
  assertTrustedOpportunityActor,
  ignoreCallerActorClaims,
  resolveTrustedOpportunityActorKind,
  trustedTenant,
  type TrustedOpportunityActorContext,
} from './trustedContext';

export interface RegisterOpportunityCandidateInput {
  trusted: TrustedOpportunityActorContext;
  candidateId: string;
  title: string;
  summary: string;
  whyNow: string;
  opportunityType: CreateOpportunityCandidateInput['opportunityType'];
  sourceRefs: string[];
  signalIds?: string[];
  thesisEvaluations: ThesisEvaluation[];
  riskFlags: string[];
  recommendedNextStep: CreateOpportunityCandidateInput['recommendedNextStep'];
  intentKey: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  /** Caller snapshot — IGNORED. */
  forgedCandidate?: unknown;
  actorType?: string;
  role?: string;
  softwareAuthority?: boolean;
  persist?: boolean;
}

export interface EvaluateOpportunityCandidateInput {
  trusted: TrustedOpportunityActorContext;
  candidateId: string;
  scoreId: string;
  dimensions: OpportunityScoreDimensionInput[];
  evidenceRefs?: string[];
  riskFlags?: string[];
  intentKey: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  forgedCandidate?: unknown;
  forgedScore?: unknown;
  actorType?: string;
  role?: string;
  softwareAuthority?: boolean;
  persist?: boolean;
}

export interface CandidateUseCaseDeps {
  candidates: OpportunityCandidateRepository;
  history: OpportunityHistoryPort;
  advisor?: OpportunityAdvisorPort;
}

export function createRegisterOpportunityCandidate(deps: CandidateUseCaseDeps) {
  return function registerOpportunityCandidate(
    input: RegisterOpportunityCandidateInput
  ): {
    candidate: OpportunityCandidate;
    created: boolean;
    explainability: ReturnType<typeof projectOpportunityCandidateExplainability>;
    writeUnitCommitted: boolean;
  } {
    assertTrustedOpportunityActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    void input.forgedCandidate;
    resolveTrustedOpportunityActorKind(input.trusted, 'intelligence');

    const intentKey = input.intentKey?.trim();
    if (!intentKey) {
      throw new OpportunityApplicationError(
        'INVALID_CANDIDATE',
        'intentKey is required for register idempotency.'
      );
    }

    const tenant = trustedTenant(input.trusted);
    const idemKey = opportunityCommandFingerprint({
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      command: 'RegisterOpportunityCandidate',
      intentKey,
    });

    const existingKey = deps.candidates.findByIdempotencyKey(tenant, idemKey);
    if (existingKey) {
      const existing = deps.candidates.getById(existingKey.candidateId, tenant);
      if (existing) {
        return {
          candidate: existing,
          created: false,
          explainability: projectOpportunityCandidateExplainability(existing),
          writeUnitCommitted: false,
        };
      }
    }

    const candidate = unwrapDomain(
      createOpportunityCandidate({
        id: input.candidateId,
        organizationId: tenant.organizationId,
        clientId: tenant.clientId,
        title: input.title,
        summary: input.summary,
        whyNow: input.whyNow,
        opportunityType: input.opportunityType,
        sourceRefs: input.sourceRefs,
        signalIds: input.signalIds,
        thesisEvaluations: input.thesisEvaluations,
        riskFlags: input.riskFlags,
        recommendedNextStep: input.recommendedNextStep,
        createdAt: input.trusted.now,
        updatedAt: input.trusted.now,
        createdBy: input.trusted.actorId,
      })
    );

    const history = createHistoryEventIntent({
      kind: 'CANDIDATE_EVALUATED',
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      aggregateKind: 'CANDIDATE',
      aggregateId: candidate.id,
      aggregateVersion: candidate.version,
      actorKind: 'HUMAN',
      reasonCodes: ['CANDIDATE_REGISTERED'],
      materialFingerprint: candidateMaterialFingerprint(candidate),
      occurredAt: input.trusted.now,
    });

    let writeUnitCommitted = false;
    if (input.persist !== false) {
      commitGovernedOpportunityWriteUnit(deps, {
        candidates: [candidate],
        history: [history],
        idempotencyKeys: [
          {
            key: idemKey,
            aggregateKind: 'CANDIDATE',
            aggregateId: candidate.id,
            organizationId: tenant.organizationId,
            clientId: tenant.clientId,
            at: input.trusted.now,
          },
        ],
      });
      writeUnitCommitted = true;
    }

    return {
      candidate,
      created: true,
      explainability: projectOpportunityCandidateExplainability(candidate),
      writeUnitCommitted,
    };
  };
}

export function createEvaluateOpportunityCandidate(deps: CandidateUseCaseDeps) {
  return function evaluateOpportunityCandidate(input: EvaluateOpportunityCandidateInput): {
    candidate: OpportunityCandidate;
    writeUnitCommitted: boolean;
    explainability: ReturnType<typeof projectOpportunityCandidateExplainability>;
  } {
    assertTrustedOpportunityActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    void input.forgedCandidate;
    void input.forgedScore;
    // Advisor may suggest dimension hints only — never authoritative score.
    void deps.advisor?.suggest?.({
      organizationId: input.trusted.organizationId,
      clientId: input.trusted.clientId,
      candidateId: input.candidateId,
      title: '',
      summary: '',
    });
    resolveTrustedOpportunityActorKind(input.trusted, 'intelligence');

    const tenant = trustedTenant(input.trusted);
    const intentKey = input.intentKey?.trim();
    if (!intentKey) {
      throw new OpportunityApplicationError(
        'INVALID_SCORE',
        'intentKey is required for evaluate idempotency.'
      );
    }

    const idemKey = opportunityCommandFingerprint({
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      command: 'EvaluateOpportunityCandidate',
      intentKey,
    });
    const existingKey = deps.candidates.findByIdempotencyKey(tenant, idemKey);
    if (existingKey) {
      const existing = deps.candidates.getById(existingKey.candidateId, tenant);
      if (existing) {
        return {
          candidate: existing,
          writeUnitCommitted: false,
          explainability: projectOpportunityCandidateExplainability(existing),
        };
      }
    }

    // Repository current wins — caller snapshot ignored.
    const current = loadAuthoritativeCandidate(
      deps.candidates,
      input.trusted,
      input.candidateId
    );

    const score = unwrapDomain(
      computeOpportunityScore({
        id: input.scoreId,
        organizationId: tenant.organizationId,
        clientId: tenant.clientId,
        candidateId: current.id,
        scoringModelVersion: OPPORTUNITY_SCORE_MODEL_VERSION,
        dimensions: input.dimensions,
        evidenceRefs: input.evidenceRefs ?? [],
        riskFlags: input.riskFlags ?? current.riskFlags,
        computedAt: input.trusted.now,
      })
    );

    const candidate = unwrapDomain(
      attachOpportunityScore(current, score, input.trusted.now)
    );

    const history = createHistoryEventIntent({
      kind: 'CANDIDATE_RESCORDED',
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      aggregateKind: 'CANDIDATE',
      aggregateId: candidate.id,
      aggregateVersion: candidate.version,
      actorKind: 'HUMAN',
      reasonCodes: ['SCORE_COMPUTED'],
      materialFingerprint: candidateMaterialFingerprint(candidate),
      occurredAt: input.trusted.now,
    });

    let writeUnitCommitted = false;
    if (input.persist !== false) {
      commitGovernedOpportunityWriteUnit(deps, {
        candidates: [candidate],
        history: [history],
        idempotencyKeys: [
          {
            key: idemKey,
            aggregateKind: 'CANDIDATE',
            aggregateId: candidate.id,
            organizationId: tenant.organizationId,
            clientId: tenant.clientId,
            at: input.trusted.now,
          },
        ],
      });
      writeUnitCommitted = true;
    }

    return {
      candidate,
      writeUnitCommitted,
      explainability: projectOpportunityCandidateExplainability(candidate),
    };
  };
}

export function createReevaluateOpportunityCandidate(deps: CandidateUseCaseDeps) {
  const evaluate = createEvaluateOpportunityCandidate(deps);
  return function reevaluateOpportunityCandidate(
    input: EvaluateOpportunityCandidateInput
  ) {
    return evaluate({
      ...input,
      intentKey: `reeval:${input.intentKey}`,
    });
  };
}
