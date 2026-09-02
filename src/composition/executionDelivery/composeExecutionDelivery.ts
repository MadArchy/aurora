import {
  createReviewClientArticle,
  createSaveContentDraft,
  createSendDeliveryPackage,
  createTransitionClientTask,
  type ContentPublicationGatePort,
  type ContentRepository,
  type ContentStrategicBriefGatePort,
  type DeliverySendPort,
  type TaskRepository,
} from '../../application/executionDelivery';
import {
  createDbContentPublicationGate,
  createDbContentRepository,
  createDbContentStrategicBriefGate,
  createDbDeliverySendPort,
  createDbTaskRepository,
} from '../../infrastructure/executionDelivery';

export function composeExecutionDelivery(options: {
  tasks?: TaskRepository;
  contents?: ContentRepository;
  publicationGate?: ContentPublicationGatePort;
  strategicBriefGate?: ContentStrategicBriefGatePort;
  deliverySend?: DeliverySendPort;
} = {}) {
  const tasks = options.tasks ?? createDbTaskRepository();
  const contents = options.contents ?? createDbContentRepository();
  const publicationGate = options.publicationGate ?? createDbContentPublicationGate();
  const strategicBriefGate = options.strategicBriefGate ?? createDbContentStrategicBriefGate();
  const deliverySend = options.deliverySend ?? createDbDeliverySendPort();
  return {
    transitionClientTask: createTransitionClientTask({ tasks }),
    saveContentDraft: createSaveContentDraft({ contents, publicationGate, strategicBriefGate }),
    reviewClientArticle: createReviewClientArticle({ contents, tasks, publicationGate }),
    sendDeliveryPackage: createSendDeliveryPackage({ delivery: deliverySend }),
  };
}
