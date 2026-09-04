import {
  createAddAdviceActionToCuration,
  createAddCurationToDelivery,
  createAddSignalToCuration,
  createDecideCuration,
  createDiscardDraftDelivery,
  createEnsureDraftDelivery,
  createRemoveDeliveryItemFromDelivery,
  createReviewClientArticle,
  createSaveContentDraft,
  createSendDeliveryPackage,
  createTransitionClientTask,
  createUpdateDeliveryPackageMetadata,
  type AdviceReadPort,
  type ContentPublicationGatePort,
  type ContentRepository,
  type ContentStrategicBriefGatePort,
  type CurationRepositoryPort,
  type DeliveryAssemblyRepositoryPort,
  type DeliverySendPort,
  type SignalReadPort,
  type TaskRepository,
} from '../../application/executionDelivery';
import {
  createDbAdviceReadPort,
  createDbContentPublicationGate,
  createDbContentRepository,
  createDbContentStrategicBriefGate,
  createDbCurationRepositoryPort,
  createDbDeliveryAssemblyRepositoryPort,
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
  };
}
