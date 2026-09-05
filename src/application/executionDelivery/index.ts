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
export {
  createEnsureDraftDelivery,
  type EnsureDraftDeliveryDeps,
  type EnsureDraftDeliveryInput,
  type EnsureDraftDeliveryResult,
} from './EnsureDraftDelivery';
export {
  createAddCurationToDelivery,
  type AddCurationToDeliveryDeps,
  type AddCurationToDeliveryInput,
  type AddCurationToDeliveryResult,
} from './AddCurationToDelivery';
export {
  createUpdateDeliveryPackageMetadata,
  type UpdateDeliveryPackageMetadataDeps,
  type UpdateDeliveryPackageMetadataInput,
  type UpdateDeliveryPackageMetadataResult,
} from './UpdateDeliveryPackageMetadata';
export {
  createRemoveDeliveryItemFromDelivery,
  type RemoveDeliveryItemFromDeliveryDeps,
  type RemoveDeliveryItemFromDeliveryInput,
  type RemoveDeliveryItemFromDeliveryResult,
} from './RemoveDeliveryItemFromDelivery';
export {
  createDiscardDraftDelivery,
  type DiscardDraftDeliveryDeps,
  type DiscardDraftDeliveryInput,
  type DiscardDraftDeliveryResult,
} from './DiscardDraftDelivery';
export {
  createProposeAngle,
  type ProposeAngleCompat,
  type ProposeAngleDeps,
  type ProposeAngleInput,
  type ProposeAngleResult,
} from './ProposeAngle';
export {
  createRemoveCuration,
  type RemoveCurationCompat,
  type RemoveCurationDeps,
  type RemoveCurationInput,
  type RemoveCurationResult,
} from './RemoveCuration';
export {
  createReopenCuration,
  type ReopenCurationCompat,
  type ReopenCurationDeps,
  type ReopenCurationInput,
  type ReopenCurationResult,
} from './ReopenCuration';
export {
  createAcknowledgeDelivery,
  type AcknowledgeDeliveryCompat,
  type AcknowledgeDeliveryDeps,
  type AcknowledgeDeliveryInput,
  type AcknowledgeDeliveryResult,
} from './AcknowledgeDelivery';
export {
  createCreateContentDraft,
  type CreateContentDraftDeps,
  type CreateContentDraftGateSnapshot,
  type CreateContentDraftInput,
  type CreateContentDraftIntent,
  type CreateContentDraftResult,
} from './CreateContentDraft';
export type { TaskRepository } from './ports/TaskRepository';
export type {
  ContentDraftFields,
  ContentPublicationGatePort,
  ContentRepository,
  ContentStrategicBriefGatePort,
} from './ports/ContentRepository';
export type { DeliverySendPort } from './ports/DeliverySendPort';
export type { DeliveryAssemblyRepositoryPort } from './ports/DeliveryAssemblyRepositoryPort';
export type { SignalReadPort } from './ports/SignalReadPort';
export type { AdviceReadPort } from './ports/AdviceReadPort';
export type {
  CurationDecisionInput,
  CurationEntryCreateInput,
  CurationRepositoryPort,
} from './ports/CurationRepositoryPort';
export type { CurationAnglePersistencePort } from './ports/CurationAnglePersistencePort';
export type { CurationRemovalPersistencePort } from './ports/CurationRemovalPersistencePort';
export type { CurationReopenPersistencePort } from './ports/CurationReopenPersistencePort';
export type { DeliveryAcknowledgementPersistencePort } from './ports/DeliveryAcknowledgementPersistencePort';
export type { CurationStrategicBriefReadPort } from './ports/CurationStrategicBriefReadPort';
export type { CurationThesisReadPort } from './ports/CurationThesisReadPort';
export type {
  AdvisorCurationAnglePort,
  AdvisorCurationAngleResult,
} from './ports/AdvisorCurationAnglePort';
export type {
  ContentDraftFormat,
  ContentDraftGenerationExtras,
  ContentDraftGenerationPort,
} from './ports/ContentDraftGenerationPort';
export type { ContentCreationPersistencePort } from './ports/ContentCreationPersistencePort';
export type {
  ContentStrategicDownstreamGatePort,
  ContentStrategicDownstreamGateResult,
} from './ports/ContentStrategicDownstreamGatePort';
export type { ContentBriefListPort } from './ports/ContentBriefListPort';
export type { RecommendationReadPort } from './ports/RecommendationReadPort';
