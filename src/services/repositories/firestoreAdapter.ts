import type { PosturaRepository } from './types';
import { localStorageRepository } from './localAdapter';

/**
 * Cuando Firestore es autoritativo, dbService se hidrata desde remoto en login;
 * este adaptador lee el estado en memoria (misma fuente que local).
 */
export const firestoreRepository: PosturaRepository = localStorageRepository;
