export { ExecutionDeliveryError, type ExecutionDeliveryErrorCode } from './errors';
export {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireAdminRole,
  requireClientRole,
  requireTaskActorRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';
export {
  createTransitionClientTask,
  type ClientTaskTransitionIntent,
  type TransitionClientTaskDeps,
  type TransitionClientTaskInput,
  type TransitionClientTaskResult,
} from './TransitionClientTask';
export {
  classifyContentMutationAuthorization,
  contentHasAuthoritativeGenericProof,
  contentHasStrategicProvenance,
  contentRequiresStrategicBriefAuthorization,
  type ContentMutationAuthorizationClass,
} from './contentMutationAuthorization';
export {
  createSaveContentDraft,
  type SaveContentDraftDeps,
  type SaveContentDraftInput,
  type SaveContentDraftResult,
} from './SaveContentDraft';
export {
  createReviewClientArticle,
  type ClientArticleReviewDecision,
  type ReviewClientArticleDeps,
  type ReviewClientArticleInput,
  type ReviewClientArticleResult,
} from './ReviewClientArticle';
export {
  createSendDeliveryPackage,
  type SendDeliveryPackageDeps,
  type SendDeliveryPackageInput,
  type SendDeliveryPackageResult,
} from './SendDeliveryPackage';
export {
  createAddSignalToCuration,
  type AddSignalToCurationDeps,
  type AddSignalToCurationInput,
  type AddSignalToCurationResult,
} from './AddSignalToCuration';
export type { TaskRepository } from './ports/TaskRepository';
export type {
  ContentDraftFields,
  ContentPublicationGatePort,
  ContentRepository,
  ContentStrategicBriefGatePort,
} from './ports/ContentRepository';
export type { DeliverySendPort } from './ports/DeliverySendPort';
export type { SignalReadPort } from './ports/SignalReadPort';
export type {
  CurationEntryCreateInput,
  CurationRepositoryPort,
} from './ports/CurationRepositoryPort';
