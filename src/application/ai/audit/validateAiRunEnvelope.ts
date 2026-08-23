import {
  requireMatchingClientId,
  requireTenantOrganizationId,
} from '../../../domain/adminTenantEnvelopeCore';
import type { AiRunPersistenceRecord } from '../ports/outbound/AiRunRepositoryPort';

export class AiRunEnvelopeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiRunEnvelopeValidationError';
  }
}

/** Admin SDK writers must validate tenant envelope before persistence. */
export function validateAiRunEnvelope(record: AiRunPersistenceRecord): {
  organizationId: string;
  clientId: string;
} {
  try {
    const organizationId = requireTenantOrganizationId(record, 'aiRun');
    const clientId = requireMatchingClientId(record.clientId, record);
    if (!record.id?.trim()) {
      throw new AiRunEnvelopeValidationError('aiRun.id is required');
    }
    return { organizationId, clientId };
  } catch (error) {
    throw new AiRunEnvelopeValidationError(
      error instanceof Error ? error.message : 'Invalid aiRun tenant envelope'
    );
  }
}
