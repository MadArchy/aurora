import {
  createAddAdviceActionToCuration,
  createAddCurationToDelivery,
  createAddSignalToCuration,
  createAcknowledgeDelivery,
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
  };
}
