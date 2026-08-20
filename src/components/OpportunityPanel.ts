import { dbService } from '../services/db';
import { esc } from '../lib/escape';
import {
  checklistProgress,
  isChecklistComplete,
  mapOpportunityLifecycle,
  OPPORTUNITY_LIFECYCLE_LABELS,
} from '../domain/opportunityLifecycle';
import type { Opportunity } from '../types';

function formatDeadline(deadline?: string): string {
  if (!deadline) return 'Sin fecha límite';
  return new Date(deadline).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderOpportunityCard(opp: Opportunity): string {
  const stage = mapOpportunityLifecycle(opp);
  const progress = checklistProgress(opp.submissionChecklist);
  const canSubmit = stage === 'checklist' && isChecklistComplete(opp.submissionChecklist);

  return `
    <article class="card opportunity-card" data-opp-id="${esc(opp.id)}">
      <header class="opportunity-head">
        <div>
          <div class="opportunity-title-row">
            <h4>${esc(opp.title)}</h4>
            <span class="badge badge-progress">${esc(OPPORTUNITY_LIFECYCLE_LABELS[stage])}</span>
          </div>
          <p class="muted small"><strong>${esc(opp.organization)}</strong> · Cierre: ${formatDeadline(opp.deadline)}</p>
        </div>
      </header>

      <p class="opportunity-desc">${esc(opp.description)}</p>
      <details class="opportunity-rationale">
        <summary>Por qué encaja contigo</summary>
        <p>${esc(opp.fitRationale)}</p>
      </details>

      ${opp.clientNotes ? `<p class="muted small"><em>Tus notas: ${esc(opp.clientNotes)}</em></p>` : ''}

      ${stage === 'proposed'
        ? `<div class="opportunity-actions">
             <button type="button" class="btn btn-success btn-sm btn-accept-opp" data-opp-id="${esc(opp.id)}">Aceptar</button>
             <button type="button" class="btn btn-secondary btn-sm btn-reject-opp" data-opp-id="${esc(opp.id)}">Declinar</button>
           </div>`
        : ''}

      ${stage === 'checklist' && opp.submissionChecklist?.length
        ? `<div class="opportunity-checklist">
             <div class="opportunity-checklist-head">
               <strong>Checklist de postulación</strong>
               <span class="muted small">${progress.done}/${progress.total}</span>
             </div>
             <ul class="opportunity-checklist-list">
               ${opp.submissionChecklist.map((item) => `
                 <li>
                   <label class="opportunity-check-item">
                     <input type="checkbox" class="input-opp-checklist" data-opp-id="${esc(opp.id)}" data-item-id="${esc(item.id)}" ${item.done ? 'checked' : ''} />
                     <span>${esc(item.label)}</span>
                   </label>
                 </li>
               `).join('')}
             </ul>
             <button type="button" class="btn btn-primary btn-sm btn-submit-opportunity" data-opp-id="${esc(opp.id)}" ${canSubmit ? '' : 'disabled'}>
               Marcar postulación enviada
             </button>
           </div>`
        : ''}

      ${stage === 'submitted'
        ? `<p class="badge badge-ready">Postulación enviada${opp.submittedAt ? ` · ${new Date(opp.submittedAt).toLocaleDateString('es')}` : ''}</p>`
        : ''}
      ${stage === 'declined' ? '<p class="badge badge-pending">Declinada</p>' : ''}
    </article>
  `;
}

export function renderClientOpportunitiesBody(clientId: string): string {
  const opportunities = dbService.getOpportunitiesByClient(clientId)
    .filter((opp) => opp.status !== 'ARCHIVED')
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  return `
    <div class="opportunities-page">
      <section class="card">
        <div class="card-header">
          <div>
            <h3>Oportunidades (The Scout)</h3>
            <p class="muted small">Propuesta → aceptar/declinar → checklist → postulación enviada.</p>
          </div>
        </div>
        ${opportunities.length
          ? `<div class="opportunity-list">${opportunities.map(renderOpportunityCard).join('')}</div>`
          : '<p class="empty-state">No hay oportunidades activas por ahora.</p>'}
      </section>
    </div>
  `;
}

export function renderManagerOpportunities(clientId: string): string {
  const opportunities = dbService.getOpportunitiesByClient(clientId);
  if (!opportunities.length) return '';

  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h3>Oportunidades — lifecycle</h3>
          <p class="muted small">Estado de convocatorias enviadas al cliente.</p>
        </div>
      </div>
      <div class="opportunity-list compact">
        ${opportunities.map((opp) => {
          const stage = mapOpportunityLifecycle(opp);
          const progress = checklistProgress(opp.submissionChecklist);
          return `
            <div class="opportunity-manager-row">
              <div>
                <strong>${esc(opp.title)}</strong>
                <p class="muted small">${esc(OPPORTUNITY_LIFECYCLE_LABELS[stage])}${opp.submissionChecklist?.length ? ` · checklist ${progress.done}/${progress.total}` : ''}</p>
              </div>
              <span class="badge ${stage === 'submitted' ? 'badge-ready' : 'badge-progress'}">${esc(stage)}</span>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}
