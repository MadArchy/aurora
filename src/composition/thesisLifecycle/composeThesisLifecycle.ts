import {
  createActivateThesis,
  createDecideThesisClientReview,
  createSaveThesis,
  type ThesisRepository,
} from '../../application/thesisLifecycle';
import { createDbThesisRepository } from '../../infrastructure/thesisLifecycle';

export function composeThesisLifecycle(options: { theses?: ThesisRepository } = {}) {
  const theses = options.theses ?? createDbThesisRepository();
  return {
    saveThesis: createSaveThesis({ theses }),
    decideThesisClientReview: createDecideThesisClientReview({ theses }),
    activateThesis: createActivateThesis({ theses }),
  };
}
