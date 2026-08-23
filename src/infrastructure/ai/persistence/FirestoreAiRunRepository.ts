import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import type { AiRunRepositoryPort, AiRunPersistenceRecord } from '../../../application/ai/ports/outbound/AiRunRepositoryPort';
import { sanitizeAiRunRecord } from '../../../application/ai/audit/sanitizeAiRunRecord';
import { validateAiRunEnvelope } from '../../../application/ai/audit/validateAiRunEnvelope';
import { clientSubPath } from '../../../services/firestore/paths';
import { mapAiRunToFirestore } from './mapAiRunToFirestore';

export class AiRunPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiRunPersistenceError';
  }
}

export interface FirestoreAiRunRepositoryOptions {
  firestore?: Firestore;
}

export class FirestoreAiRunRepository implements AiRunRepositoryPort {
  private readonly db: Firestore;

  constructor(options: FirestoreAiRunRepositoryOptions = {}) {
    this.db = options.firestore ?? getFirestore();
  }

  async save(run: AiRunPersistenceRecord): Promise<string> {
    const sanitized = sanitizeAiRunRecord(run);
    const { clientId } = validateAiRunEnvelope(sanitized);

    const docPath = clientSubPath(clientId, 'aiRuns', sanitized.id);
    const payload = {
      ...mapAiRunToFirestore(sanitized),
      createdAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
    };

    try {
      await this.db.doc(docPath).set(payload, { merge: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Firestore write failed';
      throw new AiRunPersistenceError(message);
    }

    return sanitized.id;
  }
}
