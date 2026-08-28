import {
  createReviewClientArticle,
  createSaveContentDraft,
  createTransitionClientTask,
  type ContentPublicationGatePort,
  type ContentRepository,
  type TaskRepository,
} from '../../application/executionDelivery';
import {
  createDbContentPublicationGate,
  createDbContentRepository,
  createDbTaskRepository,
} from '../../infrastructure/executionDelivery';

export function composeExecutionDelivery(options: {
  tasks?: TaskRepository;
  contents?: ContentRepository;
  publicationGate?: ContentPublicationGatePort;
} = {}) {
  const tasks = options.tasks ?? createDbTaskRepository();
  const contents = options.contents ?? createDbContentRepository();
  const publicationGate = options.publicationGate ?? createDbContentPublicationGate();
  return {
    transitionClientTask: createTransitionClientTask({ tasks }),
    saveContentDraft: createSaveContentDraft({ contents, publicationGate }),
    reviewClientArticle: createReviewClientArticle({ contents, tasks, publicationGate }),
  };
}
