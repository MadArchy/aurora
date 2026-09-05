import {
  createAddAdviceActionToCuration,
  createAddCurationToDelivery,
  createAddSignalToCuration,
  createAcknowledgeDelivery,
  createCreateContentDraft,
  createDecideCuration,
  createDiscardDraftDelivery,
  createEnsureDraftDelivery,
  createProposeAngle,
  createRemoveCuration,
  createReopenCuration,
  createRemoveDeliveryItemFromDelivery,
  createReviewClientArticle,
  createSaveContentDraft,
  createSendDeliveryPackage,
  createTransitionClientTask,
  createUpdateDeliveryPackageMetadata,
  type AdviceReadPort,
  type AdvisorCurationAnglePort,
  type ContentPublicationGatePort,
  type ContentRepository,
  type ContentStrategicBriefGatePort,
  type CurationAnglePersistencePort,
  type CurationRemovalPersistencePort,
  type CurationReopenPersistencePort,
  type CurationRepositoryPort,
  type CurationStrategicBriefReadPort,
  type CurationThesisReadPort,
  type DeliveryAcknowledgementPersistencePort,
  type DeliveryAssemblyRepositoryPort,
  type DeliverySendPort,
  type SignalReadPort,
  type TaskRepository,
} from '../../application/executionDelivery';
import {
  createDbAdviceReadPort,
  createDbAdvisorCurationAnglePort,
  createDbContentPublicationGate,
  createDbContentRepository,
  createDbContentStrategicBriefGate,
  createDbCurationAnglePersistencePort,
  createDbCurationRemovalPersistencePort,
  createDbCurationReopenPersistencePort,
  createDbCurationRepositoryPort,
  createDbCurationStrategicBriefReadPort,
  createDbCurationThesisReadPort,
  createDbDeliveryAssemblyRepositoryPort,
  createDbDeliveryAcknowledgementPersistencePort,
  createDbContentBriefListPort,
  createDbContentCreationPersistencePort,
  createDbContentDraftGenerationPort,
  createDbContentStrategicDownstreamGatePort,
  createDbRecommendationReadPort,
  createDbSignalReadPort,
  createDbDeliverySendPort,
  createDbTaskRepository,
} from '../../infrastructure/executionDelivery';

export function composeExecutionDelivery(options: {
  tasks?: TaskRepository;
  contents?: ContentRepository;
  publicationGate?: ContentPublicationGatePort;
  strategicBriefGate?: ContentStrategicBriefGatePort;
  deliverySend?: DeliverySendPort;
  signals?: SignalReadPort;
  curation?: CurationRepositoryPort;
  advice?: AdviceReadPort;
  assembly?: DeliveryAssemblyRepositoryPort;
  strategicBriefs?: CurationStrategicBriefReadPort;
  theses?: CurationThesisReadPort;
  advisor?: AdvisorCurationAnglePort;
  angles?: CurationAnglePersistencePort;
  removal?: CurationRemovalPersistencePort;
  reopen?: CurationReopenPersistencePort;
  acknowledgement?: DeliveryAcknowledgementPersistencePort;
  draftGeneration?: import('../../application/executionDelivery').ContentDraftGenerationPort;
  contentCreation?: import('../../application/executionDelivery').ContentCreationPersistencePort;
  downstreamGate?: import('../../application/executionDelivery').ContentStrategicDownstreamGatePort;
  contentBriefs?: import('../../application/executionDelivery').ContentBriefListPort;
  recommendations?: import('../../application/executionDelivery').RecommendationReadPort;
} = {}) {
  const tasks = options.tasks ?? createDbTaskRepository();
  const contents = options.contents ?? createDbContentRepository();
  const publicationGate = options.publicationGate ?? createDbContentPublicationGate();
  const strategicBriefGate = options.strategicBriefGate ?? createDbContentStrategicBriefGate();
  const deliverySend = options.deliverySend ?? createDbDeliverySendPort();
  const signals = options.signals ?? createDbSignalReadPort();
  const curation = options.curation ?? createDbCurationRepositoryPort();
  const advice = options.advice ?? createDbAdviceReadPort();
  const assembly = options.assembly ?? createDbDeliveryAssemblyRepositoryPort();
  const strategicBriefs = options.strategicBriefs ?? createDbCurationStrategicBriefReadPort();
  const theses = options.theses ?? createDbCurationThesisReadPort();
  const advisor = options.advisor ?? createDbAdvisorCurationAnglePort();
  const angles = options.angles ?? createDbCurationAnglePersistencePort();
  const removal = options.removal ?? createDbCurationRemovalPersistencePort();
  const reopen = options.reopen ?? createDbCurationReopenPersistencePort();
  const acknowledgement = options.acknowledgement ?? createDbDeliveryAcknowledgementPersistencePort();
  const draftGeneration = options.draftGeneration ?? createDbContentDraftGenerationPort();
  const contentCreation = options.contentCreation ?? createDbContentCreationPersistencePort();
  const downstreamGate = options.downstreamGate ?? createDbContentStrategicDownstreamGatePort();
  const contentBriefs = options.contentBriefs ?? createDbContentBriefListPort();
  const recommendations = options.recommendations ?? createDbRecommendationReadPort();
  return {
    transitionClientTask: createTransitionClientTask({ tasks }),
    saveContentDraft: createSaveContentDraft({ contents, publicationGate, strategicBriefGate }),
    reviewClientArticle: createReviewClientArticle({ contents, tasks, publicationGate }),
    sendDeliveryPackage: createSendDeliveryPackage({ delivery: deliverySend }),
    addSignalToCuration: createAddSignalToCuration({ signals, curation }),
    addAdviceActionToCuration: createAddAdviceActionToCuration({ advice, curation }),
    decideCuration: createDecideCuration({ curation }),
    ensureDraftDelivery: createEnsureDraftDelivery({ assembly }),
    addCurationToDelivery: createAddCurationToDelivery({ assembly, curation }),
    updateDeliveryPackageMetadata: createUpdateDeliveryPackageMetadata({ assembly }),
    removeDeliveryItemFromDelivery: createRemoveDeliveryItemFromDelivery({ assembly }),
    discardDraftDelivery: createDiscardDraftDelivery({ assembly }),
    proposeAngle: createProposeAngle({
      curation,
      strategicBriefs,
      signals,
      theses,
      advisor,
      angles,
    }),
    removeCuration: createRemoveCuration({ curation, removal }),
    reopenCuration: createReopenCuration({ curation, reopen }),
    acknowledgeDelivery: createAcknowledgeDelivery({ assembly, acknowledgement }),
    createContentDraft: createCreateContentDraft({
      generation: draftGeneration,
      creation: contentCreation,
      downstreamGate,
      briefs: contentBriefs,
      theses,
      recommendations,
      contents,
      publicationGate,
    }),
  };
}
