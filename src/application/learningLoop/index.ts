/**
 * SPEC-008 Phase 2 — Application public surface.
 */

export {
  LearningApplicationError,
  type LearningApplicationErrorCode,
} from './errors';
export {
  assertTrustedLearningActor,
  assertNoTenantSpoof,
  resolveTrustedLearningActorKind,
  ignoreCallerActorClaims,
  trustedTenant,
  type TrustedLearningActorContext,
} from './trustedContext';
export {
  createRegisterLearningObservation,
  type RegisterLearningObservationInput,
  type RegisterLearningObservationDeps,
} from './RegisterLearningObservation';
export {
  createSupersedeLearningObservation,
  type SupersedeLearningObservationInput,
  type SupersedeLearningObservationDeps,
} from './SupersedeLearningObservation';
export {
  createBuildLearningEvidence,
  createBuildLearningAssessment,
  type BuildLearningEvidenceInput,
  type BuildLearningAssessmentInput,
  type BuildLearningEvidenceDeps,
} from './BuildLearningEvidence';
export {
  createGenerateStrategicRecommendation,
  type GenerateStrategicRecommendationInput,
  type GenerateStrategicRecommendationDeps,
} from './GenerateStrategicRecommendation';
export {
  createReviewStrategicRecommendation,
  type ReviewStrategicRecommendationInput,
  type ReviewStrategicRecommendationDeps,
} from './ReviewStrategicRecommendation';
export {
  createApproveStrategicRecommendation,
  createRejectStrategicRecommendation,
  type RecommendationDecisionInput,
  type RecommendationDecisionDeps,
} from './ApproveRejectStrategicRecommendation';
export {
  createApplyApprovedRecommendation,
  createTargetSpecApplyPortRegistry,
  type ApplyApprovedRecommendationInput,
  type ApplyApprovedRecommendationDeps,
} from './ApplyApprovedRecommendation';
export {
  createGetLearningMetrics,
  createListStrategicRecommendations,
  createGetStrategicRecommendation,
  denyHistoryAsCurrentAuthority,
  denyDecisionHistoryAsCurrentAuthority,
  type GetLearningMetricsInput,
  type ListStrategicRecommendationsInput,
  type GetRecommendationInput,
} from './GetListLearning';
export type {
  LearningTenantScope,
  LearningWriteUnit,
  LearningIdempotencyRecord,
} from './ports/LearningTenantScope';
export type { LearningObservationRepository } from './ports/LearningObservationRepository';
export type { LearningEvidenceRepository } from './ports/LearningEvidenceRepository';
export type {
  StrategicRecommendationRepository,
  StrategicRecommendationListFilter,
} from './ports/StrategicRecommendationRepository';
export type {
  LearningHistoryPort,
  LearningHistoryRecord,
} from './ports/LearningHistoryPort';
export type { RecommendationDecisionRepository } from './ports/RecommendationDecisionRepository';
export type {
  TargetSpecApplyPort,
  TargetSpecApplyPortRegistry,
  TargetSpecApplyRequest,
  TargetSpecApplyResult,
  TargetApplyDisposition,
} from './ports/TargetSpecApplyPort';
export type {
  OpportunityOutcomeReader,
  OpportunityOutcomeProjection,
} from './ports/OpportunityOutcomeReader';
export type {
  SignalOutcomeReader,
  ResultRecordReader,
  FeedbackEventReader,
  SignalOutcomeProjection,
  ResultRecordProjection,
  FeedbackEventProjection,
} from './ports/LearningSourceReaders';
