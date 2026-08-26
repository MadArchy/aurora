/**
 * SPEC-007 Phase 4 — OpportunityPanel / The Scout display.
 * UI renders canonical Application projections — no lifecycle mutation authority.
 * Buttons emit intent only; main.ts routes through opportunityScoutConsumer.
 */

import { esc } from '../lib/escape';
import {
  listOpportunitiesForClient,
  opportunityStatusDisplayLabel,
  type OpportunityDisplayProjection,
} from '../services/opportunityScoutConsumer';
import { daysUntilDeadline, isCleOpportunity } from '../domain/clientOpportunityCore';
import type { CanonicalOpportunityStatus } from '../domain/opportunityLifecycleCore';

function checklistProgress(
  items: OpportunityDisplayProjection['submissionChecklist'] = []
): { done: number; total: number } {
  return {
    done: items.filter((item) => item.done).length,
    total: items.length,
  };
}

function isChecklistComplete(
  items: OpportunityDisplayProjection['submissionChecklist'] = []
): boolean {
  return items.length > 0 && items.every((item) => item.done);
}

/**
 * DISPLAY_ONLY spotlight pick — sorts by deadline; [0] is never thesis/materialize/lifecycle authority.
 * AUDIT007-08: OPEN_NONBLOCKING while display-only remains.
 */
function pickSpotlightDisplay(
  opportunities: OpportunityDisplayProjection[]
): OpportunityDisplayProjection | undefined {
  const actionable = opportunities.filter(
    (o) => o.status === 'PROPOSED' || o.status === 'ACCEPTED' || o.status === 'CHECKLIST'
  );
  if (!actionable.length) return undefined;
  return [...actionable].sort((a, b) =>
    (a.deadline ?? '').localeCompare(b.deadline ?? '')
  )[0];
}

function formatDeadline(deadline?: string | null): string {
  if (!deadline) return 'Sin fecha límite';
  return new Date(deadline).toLocaleDateString('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function canShowAcceptDecline(status: CanonicalOpportunityStatus): boolean {
  return status === 'PROPOSED';
}

function canShowChecklist(status: CanonicalOpportunityStatus): boolean {
  return status === 'ACCEPTED' || status === 'CHECKLIST';
}

export function renderOpportunityCard(opp: OpportunityDisplayProjection): string {
  const progress = checklistProgress(opp.submissionChecklist);
  const canSubmit =
    opp.status === 'CHECKLIST' && isChecklistComplete(opp.submissionChecklist);
  const daysLeft = opp.deadline ? daysUntilDeadline(opp.deadline) : -1;
  const deadlineSoon = Boolean(opp.deadline) && daysLeft >= 0 && daysLeft <= 3;
  const cleLike = isCleOpportunity({ title: opp.title, type: opp.type });

  return `
    <article class="card opportunity-card" data-opp-id="${esc(opp.id)}" data-authority="CANONICAL">
      <header class="opportunity-head">
        <div>
          <div class="opportunity-title-row">
            <h4>${esc(opp.title)}</h4>
            <span class="badge badge-progress">${esc(opportunityStatusDisplayLabel(opp.status))}</span>
            ${cleLike ? '<span class="badge badge-ready">CLE</span>' : ''}
          </div>
          <p class="muted small">
            <strong>${esc(opp.organization)}</strong> · Cierre: ${formatDeadline(opp.deadline)}
            ${deadlineSoon ? ` · <strong class="warn-text">en ${daysLeft} día${daysLeft === 1 ? '' : 's'}</strong>` : ''}
          </p>
        </div>
      </header>

      <p class="opportunity-desc">${esc(opp.description)}</p>
      <details class="opportunity-rationale">
        <summary>Por qué encaja contigo</summary>
        <p>${esc(opp.fitRationale)}</p>
      </details>

      ${opp.clientNotes ? `<p class="muted small"><em>Tus notas: ${esc(opp.clientNotes)}</em></p>` : ''}

      ${canShowAcceptDecline(opp.status)
        ? `<div class="opportunity-actions">
             <button type="button" class="btn btn-success btn-sm btn-accept-opp" data-opp-id="${esc(opp.id)}">Aceptar</button>
             <button type="button" class="btn btn-secondary btn-sm btn-reject-opp" data-opp-id="${esc(opp.id)}">Declinar</button>
           </div>`
        : ''}

      ${canShowChecklist(opp.status) && opp.submissionChecklist?.length
        ? `<div class="opportunity-checklist">
             <div class="opportunity-checklist-head">
               <strong>Checklist de postulación</strong>
               <span class="muted small">${progress.done}/${progress.total}</span>
             </div>
             <ul class="opportunity-checklist-list">
               ${opp.submissionChecklist
                 .map(
                   (item) => `
                 <li>
                   <label class="opportunity-check-item">
                     <input type="checkbox" class="input-opp-checklist" data-opp-id="${esc(opp.id)}" data-item-id="${esc(item.id)}" ${item.done ? 'checked' : ''} />
                     <span>${esc(item.label)}</span>
                   </label>
                 </li>
               `
                 )
                 .join('')}
             </ul>
             <button type="button" class="btn btn-primary btn-sm btn-submit-opportunity" data-opp-id="${esc(opp.id)}" ${canSubmit ? '' : 'disabled'}>
               Marcar postulación enviada
             </button>
           </div>`
        : ''}

      ${opp.status === 'SUBMITTED'
        ? `<p class="badge badge-ready">Postulación enviada${opp.submittedAt ? ` · ${new Date(opp.submittedAt).toLocaleDateString('es')}` : ''}</p>`
        : ''}
      ${opp.status === 'DECLINED' ? '<p class="badge badge-pending">Declinada</p>' : ''}
    </article>
  `;
}

export function renderOpportunitySpotlight(clientId: string): string {
  let opportunities: OpportunityDisplayProjection[] = [];
  try {
    opportunities = listOpportunitiesForClient(clientId);
  } catch {
    return '';
  }
  const pick = pickSpotlightDisplay(opportunities);
  if (!pick) return '';

  const subtitle =
    pick.status === 'PROPOSED'
      ? 'The Scout te propone esta convocatoria — acéptala para ver el checklist de postulación.'
      : 'Completa el checklist antes del cierre.';

  return `
    <section class="card opportunity-spotlight">
      <div class="card-header">
        <div>
          <h3>Oportunidad destacada</h3>
          <p class="muted small">${subtitle}</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-tab="client-opps">Ver todas</button>
      </div>
      ${renderOpportunityCard(pick)}
    </section>
  `;
}

export function renderClientOpportunitiesBody(clientId: string): string {
  let opportunities: OpportunityDisplayProjection[] = [];
  try {
    opportunities = listOpportunitiesForClient(clientId).sort((a, b) =>
      (a.deadline ?? '').localeCompare(b.deadline ?? '')
    );
  } catch {
    opportunities = [];
  }

  return `
    <div class="opportunities-page">
      <section class="card">
        <div class="card-header">
          <div>
            <h3>Oportunidades (The Scout)</h3>
            <p class="muted small">Propuesta → aceptar/declinar → checklist → postulación enviada.</p>
          </div>
        </div>
        ${
          opportunities.length
            ? `<div class="opportunity-list">${opportunities.map(renderOpportunityCard).join('')}</div>`
            : '<p class="empty-state">No hay oportunidades activas por ahora.</p>'
        }
      </section>
    </div>
  `;
}

export function renderManagerOpportunities(clientId: string, embedded = false): string {
  let opportunities: OpportunityDisplayProjection[] = [];
  try {
    opportunities = listOpportunitiesForClient(clientId);
  } catch {
    return '';
  }
  if (!opportunities.length) return '';

  const body = `
    <div class="opportunity-list compact">
      ${opportunities
        .map((opp) => {
          const progress = checklistProgress(opp.submissionChecklist);
          return `
          <div class="opportunity-manager-row">
            <div>
              <strong>${esc(opp.title)}</strong>
              <p class="muted small">${esc(opportunityStatusDisplayLabel(opp.status))}${
                opp.submissionChecklist?.length
                  ? ` · checklist ${progress.done}/${progress.total}`
                  : ''
              }</p>
            </div>
            <span class="badge ${opp.status === 'SUBMITTED' ? 'badge-ready' : 'badge-progress'}">${esc(opp.status)}</span>
          </div>
        `;
        })
        .join('')}
    </div>
  `;

  if (embedded) return body;

  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h3>Oportunidades — lifecycle</h3>
          <p class="muted small">Estado de convocatorias enviadas al cliente.</p>
        </div>
      </div>
      ${body}
    </section>
  `;
}
