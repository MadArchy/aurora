export { ThesisLifecycleError, type ThesisLifecycleErrorCode } from './errors';
export {
  assertNoThesisSpoof,
  assertTrustedThesisContext,
  requireAdminRole,
  requireClientRole,
  type TrustedThesisLifecycleContext,
} from './trustedContext';
export {
  createSaveThesis,
  type SaveThesisDeps,
  type SaveThesisInput,
  type SaveThesisResult,
} from './SaveThesis';
export {
  createDecideThesisClientReview,
  type DecideThesisClientReviewDeps,
  type DecideThesisClientReviewInput,
  type DecideThesisClientReviewResult,
  type ThesisClientReviewDecision,
} from './DecideThesisClientReview';
export {
  createActivateThesis,
  type ActivateThesisDeps,
  type ActivateThesisInput,
  type ActivateThesisResult,
} from './ActivateThesis';
export type { ThesisRepository } from './ports/ThesisRepository';
