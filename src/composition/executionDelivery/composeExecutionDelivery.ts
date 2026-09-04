import {
  createAddSignalToCuration,
  createReviewClientArticle,
  createSaveContentDraft,
  createSendDeliveryPackage,
  createTransitionClientTask,
  type ContentPublicationGatePort,
  type ContentRepository,
  type ContentStrategicBriefGatePort,
  type CurationRepositoryPort,
  type DeliverySendPort,
  type SignalReadPort,
  type TaskRepository,
} from '../../application/executionDelivery';
import {
  createDbContentPublicationGate,
  createDbContentRepository,
  createDbContentStrategicBriefGate,
  createDbCurationRepositoryPort,
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
} = {}) {
  const tasks = options.tasks ?? createDbTaskRepository();
  const contents = options.contents ?? createDbContentRepository();
  const publicationGate = options.publicationGate ?? createDbContentPublicationGate();
  const strategicBriefGate = options.strategicBriefGate ?? createDbContentStrategicBriefGate();
  const deliverySend = options.deliverySend ?? createDbDeliverySendPort();
  const signals = options.signals ?? createDbSignalReadPort();
  const curation = options.curation ?? createDbCurationRepositoryPort();
  return {
    transitionClientTask: createTransitionClientTask({ tasks }),
    saveContentDraft: createSaveContentDraft({ contents, publicationGate, strategicBriefGate }),
    reviewClientArticle: createReviewClientArticle({ contents, tasks, publicationGate }),
    sendDeliveryPackage: createSendDeliveryPackage({ delivery: deliverySend }),
    addSignalToCuration: createAddSignalToCuration({ signals, curation }),
  };
}
