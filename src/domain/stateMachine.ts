import type { DeliveryPackage, Signal, Task } from '../types';

export const SIGNAL_TRANSITIONS: Record<Signal['status'], Signal['status'][]> = {
  NEW: ['ANALYZED', 'DISCARDED', 'CONVERTED'],
  ANALYZED: ['CONVERTED', 'DISCARDED'],
  CONVERTED: [],
  DISCARDED: [],
};

export const DELIVERY_TRANSITIONS: Record<DeliveryPackage['status'], DeliveryPackage['status'][]> = {
  DRAFT: ['SENT'],
  SENT: ['ACKNOWLEDGED'],
  ACKNOWLEDGED: [],
};

export const TASK_TRANSITIONS: Record<Task['status'], Task['status'][]> = {
  DRAFT: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['VIEWED', 'IN_PROGRESS', 'CANCELLED'],
  VIEWED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'REJECTED', 'CANCELLED'],
  COMPLETED: [],
  REJECTED: ['IN_PROGRESS', 'CANCELLED'],
  CANCELLED: [],
};

export type CurationLifecycle = 'PENDING' | 'READY' | 'PACKAGED' | 'DISCARDED';

export function curationLifecycle(entry: {
  destination: string | null;
  deliveryPackageId?: string | null;
}): CurationLifecycle {
  if (entry.destination === 'DISCARD') return 'DISCARDED';
  if (entry.deliveryPackageId) return 'PACKAGED';
  if (entry.destination) return 'READY';
  return 'PENDING';
}

export function canTransition<T extends string>(
  current: T,
  next: T,
  table: Record<string, T[]>
): boolean {
  return (table[current] || []).includes(next);
}

export function assertTransition<T extends string>(
  current: T,
  next: T,
  table: Record<string, T[]>,
  entity: string
): void {
  if (!canTransition(current, next, table)) {
    throw new Error(`${entity}_INVALID_TRANSITION:${current}->${next}`);
  }
}
