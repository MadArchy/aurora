import type { Opportunity, OpportunityChecklistItem, OpportunityLifecycleStage, OpportunityType } from '../types';
import { createId } from '../lib/id';

export function isCleOpportunity(opp: Pick<Opportunity, 'title' | 'type'>): boolean {
  return /\bCLE\b/i.test(opp.title) || (opp.type === 'PANEL' && /cle|continuing legal education/i.test(opp.title));
}

export const OPPORTUNITY_LIFECYCLE_LABELS: Record<OpportunityLifecycleStage, string> = {
  proposed: 'Propuesta',
  accepted: 'Aceptada',
  declined: 'Declinada',
  checklist: 'Checklist en curso',
  submitted: 'Postulación enviada',
};

export function defaultOpportunityChecklist(
  type: OpportunityType,
  context?: Pick<Opportunity, 'title' | 'type'>
): OpportunityChecklistItem[] {
  if (context && isCleOpportunity(context)) {
    return [
      { id: createId('ocl'), label: 'Confirmar elegibilidad CLE (Texas MCLE)', done: false },
      { id: createId('ocl'), label: 'Enviar abstract / propuesta de sesión', done: false },
      { id: createId('ocl'), label: 'Adjuntar bio, foto y materiales de programa', done: false },
      { id: createId('ocl'), label: 'Coordinar con el organizador (logística / AV)', done: false },
      { id: createId('ocl'), label: 'Confirmar postulación enviada', done: false },
    ];
  }

  const base = [
    { id: createId('ocl'), label: 'Confirmar disponibilidad de fechas', done: false },
    { id: createId('ocl'), label: 'Revisar bio / hoja de ponente', done: false },
    { id: createId('ocl'), label: 'Preparar abstract o talking points', done: false },
    { id: createId('ocl'), label: 'Enviar materiales al organizador', done: false },
    { id: createId('ocl'), label: 'Confirmar postulación enviada', done: false },
  ];

  if (type === 'PODCAST_GUEST') {
    return [
      { id: createId('ocl'), label: 'Confirmar fecha de grabación', done: false },
      { id: createId('ocl'), label: 'Enviar bio corta al host', done: false },
      { id: createId('ocl'), label: 'Preparar 3 mensajes clave', done: false },
      { id: createId('ocl'), label: 'Confirmar publicación programada', done: false },
    ];
  }

  if (type === 'JOURNAL_CALL' || type === 'AWARD_NOMINATION') {
    return [
      { id: createId('ocl'), label: 'Revisar requisitos de la convocatoria', done: false },
      { id: createId('ocl'), label: 'Preparar borrador de postulación', done: false },
      { id: createId('ocl'), label: 'Recopilar evidencias de respaldo', done: false },
      { id: createId('ocl'), label: 'Enviar postulación', done: false },
    ];
  }

  return base;
}

export function mapOpportunityLifecycle(opp: Opportunity): OpportunityLifecycleStage {
  if (opp.lifecycleStage) return opp.lifecycleStage;
  switch (opp.status) {
    case 'SENT_TO_CLIENT':
    case 'RECOMMENDED':
    case 'DETECTED':
    case 'UNDER_REVIEW':
      return 'proposed';
    case 'REJECTED':
      return 'declined';
    case 'COMPLETED':
      return 'submitted';
    case 'IN_PROGRESS':
      return 'checklist';
    case 'ACCEPTED':
      return opp.submissionChecklist?.length ? 'checklist' : 'accepted';
    default:
      return 'proposed';
  }
}

export function checklistProgress(items: OpportunityChecklistItem[] = []): { done: number; total: number } {
  return {
    done: items.filter((item) => item.done).length,
    total: items.length,
  };
}

export function isChecklistComplete(items: OpportunityChecklistItem[] = []): boolean {
  return items.length > 0 && items.every((item) => item.done);
}
