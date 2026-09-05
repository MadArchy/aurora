import type { DeliveryPackage } from '../../../types';

export interface DeliveryAcknowledgementMarkInput {
  acknowledgedAt: string;
  clientAckNote?: string;
}

export interface DeliveryAcknowledgementPersistencePort {
  markAcknowledged(
    packageId: string,
    input: DeliveryAcknowledgementMarkInput
  ): DeliveryPackage | null;
}
