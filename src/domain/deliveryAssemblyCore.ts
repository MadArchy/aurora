import type { CurationDestination, CurationEntry, DeliveryItemKind } from '../types';

/** Maps decided curation destination to delivery item kind (assembly only). */
export const DESTINATION_TO_DELIVERY_ITEM_KIND: Record<
  Exclude<CurationDestination, 'DISCARD'>,
  DeliveryItemKind
> = {
  TASK_VIDEO: 'TASK',
  TASK_ARTICLE: 'TASK',
  OPPORTUNITY: 'OPPORTUNITY',
  REFERENCE_READING: 'READING',
  EVIDENCE: 'FILE',
};

/** Existing assembly eligibility — no new Domain rule. */
export function canAddCurationToDelivery(entry: CurationEntry): boolean {
  return (
    entry.destination !== null &&
    entry.destination !== 'DISCARD' &&
    !entry.deliveryPackageId
  );
}
