import type { Client, DeliveryItem, DeliveryPackage } from '../../../types';

export interface DeliveryAssemblyRepositoryPort {
  getClientById(clientId: string): Client | undefined;
  getDraftByClientId(clientId: string): DeliveryPackage | undefined;
  getPackageById(packageId: string): DeliveryPackage | undefined;
  ensureDraft(clientId: string, createdBy: string): DeliveryPackage;
  addDeliveryItem(packageId: string, item: Omit<DeliveryItem, 'id'>): DeliveryPackage | null;
  removeDeliveryItem(packageId: string, itemId: string): void;
  updateDraftMetadata(
    packageId: string,
    updates: Partial<Pick<DeliveryPackage, 'title' | 'strategicNote' | 'periodLabel'>>
  ): void;
  attachCurationToDelivery(curationId: string, packageId: string | null): void;
  discardDraftDelivery(packageId: string): boolean;
}
