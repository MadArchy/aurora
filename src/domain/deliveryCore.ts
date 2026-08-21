import type { CurationDestination, DeliveryItem, DeliveryPackage, PositioningThesis } from '../types';

/** Destinos que requieren tesis activa para materializar trabajo. */
const THESIS_REQUIRED_DESTINATIONS: CurationDestination[] = [
  'TASK_VIDEO',
  'TASK_ARTICLE',
  'OPPORTUNITY',
  'REFERENCE_READING',
];

export type DeliverySendValidation =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' | 'NOT_DRAFT' | 'ALREADY_SENT' | 'EMPTY' | 'NO_THESIS'; message: string };

export function destinationNeedsThesis(
  destination: CurationDestination | null | undefined,
  itemKind?: DeliveryItem['kind']
): boolean {
  if (destination && THESIS_REQUIRED_DESTINATIONS.includes(destination)) return true;
  return itemKind === 'READING';
}

/** Valida que el briefing se pueda enviar antes de llamar a IA o escribir en DB. */
export function validateDeliveryForSend(
  pkg: DeliveryPackage | null | undefined,
  resolveDestination: (item: DeliveryItem) => CurationDestination | null | undefined,
  thesis: PositioningThesis | null | undefined
): DeliverySendValidation {
  if (!pkg) {
    return { ok: false, code: 'NOT_FOUND', message: 'Briefing no encontrado.' };
  }
  if (pkg.status === 'SENT' || pkg.status === 'ACKNOWLEDGED') {
    return { ok: false, code: 'ALREADY_SENT', message: 'Este briefing ya fue enviado.' };
  }
  if (pkg.status !== 'DRAFT') {
    return { ok: false, code: 'NOT_DRAFT', message: 'Solo se pueden enviar briefings en borrador.' };
  }
  if (!pkg.items.length) {
    return { ok: false, code: 'EMPTY', message: 'El briefing está vacío.' };
  }

  const needsThesis = pkg.items.some((item) =>
    destinationNeedsThesis(resolveDestination(item), item.kind)
  );
  if (needsThesis && !thesis) {
    return {
      ok: false,
      code: 'NO_THESIS',
      message: 'Define una tesis activa antes de enviar: varios ítems necesitan materializarse como tareas u oportunidades.',
    };
  }

  return { ok: true };
}

export function sortDeliveriesBySentAt(packages: DeliveryPackage[]): DeliveryPackage[] {
  return [...packages].sort((a, b) => {
    const aAt = a.sentAt || a.createdAt;
    const bAt = b.sentAt || b.createdAt;
    return bAt.localeCompare(aAt);
  });
}

export function latestSentAt(packages: DeliveryPackage[]): string | undefined {
  const sorted = sortDeliveriesBySentAt(packages.filter((p) => p.status !== 'DRAFT' && p.sentAt));
  return sorted[0]?.sentAt;
}

export function deliveryItemKindLabel(kind: DeliveryItem['kind']): string {
  switch (kind) {
    case 'TASK':
      return 'Tarea';
    case 'CONTENT':
      return 'Contenido';
    case 'OPPORTUNITY':
      return 'Oportunidad';
    case 'READING':
      return 'Lectura';
    case 'FILE':
      return 'Archivo';
    case 'ADVICE':
      return 'Consejo';
    default:
      return kind;
  }
}

export function readingTaskDescription(item: Pick<DeliveryItem, 'title' | 'note' | 'url' | 'rationale'>): string {
  const parts = [
    item.rationale ? `Por qué leerlo: ${item.rationale}` : null,
    item.note || null,
    item.url ? `Enlace: ${item.url}` : null,
  ].filter(Boolean);
  return parts.join('\n\n') || `Lectura recomendada: ${item.title}`;
}

export function canEditDelivery(pkg: DeliveryPackage | null | undefined): boolean {
  return pkg?.status === 'DRAFT';
}

export function deliveryStatusLabel(status: DeliveryPackage['status']): string {
  switch (status) {
    case 'DRAFT':
      return 'Borrador';
    case 'SENT':
      return 'Enviado';
    case 'ACKNOWLEDGED':
      return 'Visto';
    default:
      return status;
  }
}
