/**
 * SPEC-007 Phase 2 — Application public surface.
 */

export {
  OpportunityApplicationError,
  type OpportunityApplicationErrorCode,
} from './errors';
export {
  assertTrustedOpportunityActor,
  assertNoTenantSpoof,
  resolveTrustedOpportunityActorKind,
  ignoreCallerActorClaims,
  trustedTenant,
  type TrustedOpportunityActorContext,
} from './trustedContext';
export {
  createRegisterOpportunityCandidate,
  createEvaluateOpportunityCandidate,
  createReevaluateOpportunityCandidate,
} from './RegisterEvaluateCandidate';
export type {
  RegisterOpportunityCandidateInput,
  EvaluateOpportunityCandidateInput,
  CandidateUseCaseDeps,
} from './RegisterEvaluateCandidate';
export { createRecommendOpportunityCandidate } from './RecommendOpportunityCandidate';
export type { RecommendOpportunityCandidateInput } from './RecommendOpportunityCandidate';
export { createMaterializeOpportunity } from './MaterializeOpportunity';
export type {
  MaterializeOpportunityInput,
  MaterializeOpportunityDeps,
} from './MaterializeOpportunity';
export {
  createAcceptOpportunity,
  createDeclineOpportunity,
  createUpdateOpportunityChecklist,
  createSubmitOpportunity,
  createCompleteOpportunity,
  createArchiveOpportunity,
} from './LifecycleOpportunity';
export type {
  LifecycleBaseInput,
  UpdateOpportunityChecklistInput,
  OpportunityLifecycleDeps,
} from './LifecycleOpportunity';
export {
  createGetOpportunity,
  createListOpportunities,
  createGetOpportunityCandidate,
  createListOpportunityCandidates,
  denyHistoryAsCurrentAuthority,
} from './GetListOpportunity';
export type {
  GetOpportunityInput,
  ListOpportunitiesInput,
  GetCandidateInput,
} from './GetListOpportunity';
export type {
  OpportunityCandidateRepository,
  OpportunityWriteUnit,
  OpportunityTenantScope,
} from './ports/OpportunityCandidateRepository';
export type { OpportunityRepository } from './ports/OpportunityRepository';
export type {
  OpportunityHistoryPort,
  OpportunityHistoryRecord,
} from './ports/OpportunityHistoryPort';
export type {
  OpportunityStrategicBriefReader,
  OpportunityBriefProjection,
} from './ports/OpportunityStrategicBriefReader';
export type {
  StrategicPlanAuthorizationPort,
  StrategicPlanAuthorizationDecision,
  StrategicPlanAuthorizationRequest,
  PlanAuthorizationDisposition,
} from './ports/StrategicPlanAuthorizationPort';
export type { StrategicContextReader } from './ports/StrategicContextReader';
export type {
  OpportunityAdvisorPort,
  OpportunityAdvisorSuggestion,
} from './ports/OpportunityAdvisorPort';
