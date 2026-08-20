import { FIREBASE_ENABLED } from '../../firebase/config';
import type { PosturaRepository } from './types';
import { localStorageRepository } from './localAdapter';
import { firestoreRepository as firestoreRepo } from './firestoreAdapter';

export function getRepository(): PosturaRepository {
  return FIREBASE_ENABLED ? firestoreRepo : localStorageRepository;
}
