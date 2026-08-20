import type { CurationEntry, DeliveryPackage, Task } from '../types';

/**
 * Etapa única del ciclo de vida de un ítem de trabajo.
 * No es una tabla nueva: se deriva de CurationEntry + DeliveryPackage + Task,
 * que son las tres piezas que hoy viven en pantallas separadas.
 */
export type WorkStage =
  | 'por_decidir'
  | 'decidido'
  | 'en_briefing'
  | 'entregado'
  | 'completado'
  | 'descartado';

export const WORK_STAGE_LABELS: Record<WorkStage, string> = {
  por_decidir: 'Por decidir',
  decidido: 'Decidido, fuera del briefing',
  en_briefing: 'En el briefing',
  entregado: 'Entregado al cliente',
  completado: 'Completado',
  descartado: 'Descartado',
};

export const WORK_STAGE_BADGE: Record<WorkStage, string> = {
  por_decidir: 'badge-pending',
  decidido: 'badge-accent',
  en_briefing: 'badge-progress',
  entregado: 'badge-progress',
  completado: 'badge-ready',
  descartado: 'badge-neutral',
};

/** Orden de avance, para ordenar tableros y listas. */
export const WORK_STAGE_ORDER: WorkStage[] = [
  'por_decidir',
  'decidido',
  'en_briefing',
  'entregado',
  'completado',
  'descartado',
];

export interface WorkStageContext {
  entry: CurationEntry;
  pkg?: DeliveryPackage;
  task?: Task;
}

export function deriveWorkStage({ entry, pkg, task }: WorkStageContext): WorkStage {
  if (entry.destination === null) return 'por_decidir';
  if (entry.destination === 'DISCARD') return 'descartado';

  if (task?.status === 'COMPLETED') return 'completado';
  if (!entry.deliveryPackageId || !pkg) return 'decidido';
  if (pkg.status === 'DRAFT') return 'en_briefing';
  return task?.status === 'CANCELLED' ? 'descartado' : 'entregado';
}

/** Un ítem puede añadirse al briefing si ya tiene destino útil y no está en uno. */
export function canQueueForDelivery(entry: CurationEntry): boolean {
  return entry.destination !== null && entry.destination !== 'DISCARD' && !entry.deliveryPackageId;
}
