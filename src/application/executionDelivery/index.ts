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
export {
  createAddAdviceActionToCuration,
  type AddAdviceActionToCurationDeps,
  type AddAdviceActionToCurationInput,
  type AddAdviceActionToCurationResult,
} from './AddAdviceActionToCuration';
export {
  createDecideCuration,
  type DecideCurationDeps,
  type DecideCurationInput,
  type DecideCurationResult,
} from './DecideCuration';
export type { TaskRepository } from './ports/TaskRepository';
export type {
  ContentDraftFields,
  ContentPublicationGatePort,
  ContentRepository,
  ContentStrategicBriefGatePort,
} from './ports/ContentRepository';
export type { DeliverySendPort } from './ports/DeliverySendPort';
export type { SignalReadPort } from './ports/SignalReadPort';
export type { AdviceReadPort } from './ports/AdviceReadPort';
export type {
  CurationDecisionInput,
  CurationEntryCreateInput,
  CurationRepositoryPort,
} from './ports/CurationRepositoryPort';
