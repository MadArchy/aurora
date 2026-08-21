import { dbService } from '../services/db';
import { esc, safeHref } from '../lib/escape';
import { renderPage } from './PageHeader';
import { renderTaskMetaBadges, KPI_LABELS, kpiLabel } from '../lib/campaignLabels';
import { icon } from '../lib/icons';
import { renderClientProfileBody } from './ClientProfilePanel';
import { renderProofWall, renderServiceLinesReadOnly } from './ProofWallPanel';
import { renderClientOpportunitiesBody, renderOpportunityCard, renderOpportunitySpotlight } from './OpportunityPanel';
import { renderKpiSummaryTiles, renderKpiWeeklyChart } from './KpiWeeklyChart';
import { CAMP_ADOPTION } from '../data/juanCampaignSeed';
import { pickWeeklyLinkedInPostTask } from '../domain/clientHomeCore';

function clientPage(tab: string, body: string): string {
  return renderPage(tab, body);
}

/** Briefings que el manager ya envió a este cliente. */
function renderReceivedBriefings(clientId: string, limit = 3): string {
  const deliveries = dbService.getSentDeliveriesByClient(clientId).slice(0, limit);
  if (!deliveries.length) {
    return '<p class="empty-state">Tu Brand Manager aún no te ha enviado un briefing.</p>';
  }

  return deliveries.map((pkg) => `
    <article class="briefing-card">
      <header class="briefing-head">
        <div>
          <h4>${esc(pkg.title)}</h4>
          <p class="muted small">
            ${new Date(pkg.sentAt || pkg.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'long' })}
            · ${pkg.items.length} ítem(s)
          </p>
        </div>
        ${pkg.status === 'SENT'
          ? `<button class="btn btn-secondary btn-sm btn-acknowledge-delivery" data-package-id="${esc(pkg.id)}">
               Marcar como leído
             </button>`
          : '<span class="badge badge-ready">Leído</span>'}
      </header>

      ${pkg.strategicNote
        ? `<blockquote class="briefing-note">${esc(pkg.strategicNote)}</blockquote>`
        : ''}

      <ul class="briefing-items">
        ${pkg.items.map((item) => `
          <li>
            <span class="badge badge-progress">${esc(item.kind)}</span>
            <strong>${esc(item.title)}</strong>
            ${item.rationale
              ? `<details class="briefing-rationale"><summary>Por qué se incluyó</summary><p class="muted small">${esc(item.rationale)}</p></details>`
              : ''}
            ${item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Ver fuente</a>` : ''}
          </li>
        `).join('')}
      </ul>
    </article>
  `).join('');
}

export function renderClientPortal(
  activeTab: string,
  clientId: string = 'client_juan_001',
  activeCampaignId: string | null = CAMP_ADOPTION
): string {
  const client = dbService.getClientById(clientId) || dbService.getClients()[0];
  const campaignId = activeCampaignId || undefined;
  const tasks = dbService.getTasksForClient(client.id, campaignId);
  const theses = dbService.getThesesByClient(client.id);
  const profile = dbService.getMasterProfile(client.id);
  const opportunities = dbService.getOpportunitiesByClient(client.id);
  const campaigns = dbService.getCampaignsByClient(client.id);
  const effectiveCampaignId = campaignId || campaigns[0]?.id || CAMP_ADOPTION;

  switch (activeTab) {
    case 'client-home':
      return clientPage('client-home', renderClientHomeBody(client, tasks, effectiveCampaignId));
    case 'client-feed':
      return clientPage('client-feed', renderClientTaskFeedBody(client, tasks, opportunities));
    case 'client-content':
      return clientPage('client-content', renderClientContentReviewBody(client));
    case 'client-opps':
      return clientPage('client-opps', renderClientOpportunitiesBody(client.id));
    case 'client-profile':
      return clientPage('client-profile', renderClientProfileBody(client.id));
    case 'client-thesis':
      return clientPage('client-thesis', renderClientThesisBody(client, theses, profile));
    case 'client-results':
      return clientPage('client-results', renderClientResultsBody(client));
    case 'client-library':
      return clientPage('client-library', renderClientLibraryBody(client));
    default:
      return clientPage('client-home', renderClientHomeBody(client, tasks, effectiveCampaignId));
  }
}

function formatDeadline(deadline?: string): string {
  if (!deadline) return 'Sin fecha límite';
  return new Date(deadline).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderStatTile(
  iconName: string,
  label: string,
  value: string | number,
  hint: string,
  tone: 'accent' | 'positive' | 'warning' | 'neutral' = 'neutral'
): string {
  const toneClass = tone === 'neutral' ? '' : `stat-tile-${tone}`;
  return `
    <div class="stat-tile">
      <div class="stat-tile-head">${icon(iconName, 15)}<span>${esc(label)}</span></div>
      <p class="stat-tile-value ${toneClass}">${esc(String(value))}</p>
      <p class="stat-tile-hint">${esc(hint)}</p>
    </div>
  `;
}

function renderClientStats(
  campaignId: string,
  tasks: ReturnType<typeof dbService.getTasksForClient>,
  clientId: string
): string {
  const camp = dbService.getCampaignById(campaignId);
  const open = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
  const done = tasks.filter((t) => t.status === 'COMPLETED').length;
  const pendingContent = dbService.getContentByClient(clientId).filter((c) => c.status === 'CLIENT_REVIEW').length;
  const currentDay = camp?.planDays ? dbService.getCurrentPlanDay(campaignId) : 0;

  return `
    <div class="stat-grid">
      ${renderStatTile('zap', 'Acciones abiertas', open.length, open.length ? 'Listas para ejecutar' : 'Todo al día', open.length ? 'accent' : 'positive')}
      ${renderStatTile('check', 'Completadas', done, 'En esta campaña', 'positive')}
      ${renderStatTile('fileText', 'Por revisar', pendingContent, pendingContent ? 'Esperan tu aprobación' : 'Nada pendiente', pendingContent ? 'warning' : 'neutral')}
      ${camp?.planDays ? renderStatTile('calendar', 'Día del plan', `${currentDay}/${camp.planDays}`, camp.name) : ''}
    </div>
  `;
}

function renderPlanProgress(campaignId: string): string {
  const camp = dbService.getCampaignById(campaignId);
  if (!camp?.planDays) return '';
  const currentDay = dbService.getCurrentPlanDay(campaignId);
  const milestones = dbService.getCampaignMilestones(campaignId);
  const completed = milestones.filter((m) => m.status === 'completed').length;
  const pct = Math.min(100, Math.round((currentDay / camp.planDays) * 100));

  return `
    <div class="card plan-progress-card">
      <div class="card-header">
        <div>
          <h3>${esc(camp.name)}</h3>
          <p>Plan de ejecución de ${camp.planDays} días</p>
        </div>
        <span class="badge badge-accent">${pct}% recorrido</span>
      </div>
      <div class="plan-progress-meta">
        <span><span class="plan-progress-day">Día ${currentDay}</span> de ${camp.planDays}</span>
        <span>${completed} hito${completed === 1 ? '' : 's'} completado${completed === 1 ? '' : 's'}</span>
      </div>
      <div class="plan-progress-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
        aria-label="Progreso del plan">
        <div class="plan-progress-fill" style="width: ${pct}%;"></div>
      </div>
    </div>
  `;
}

function renderWeeklyLinkedInSpotlight(
  clientId: string,
  tasks: ReturnType<typeof dbService.getTasksForClient>,
  campaignId: string
): string {
  const contents = dbService.getContentByClient(clientId);
  const currentDay = dbService.getCurrentPlanDay(campaignId);
  const pick = pickWeeklyLinkedInPostTask(tasks, contents, currentDay);
  if (!pick) return '';

  const { task, content } = pick;
  const isChecklist = content.format === 'checklist';
  const preview = content.body.length > 320 ? `${content.body.slice(0, 317)}…` : content.body;

  return `
    <section class="card linkedin-spotlight">
      <div class="card-header">
        <div>
          <h3>${icon('checkSquare', 16)} Post LinkedIn de la semana</h3>
          <p>Aprueba o edita el borrador preparado en tu voz — sin ir a la bandeja de tareas.</p>
        </div>
        <span class="badge ${isChecklist ? 'badge-ready' : 'badge-progress'}">
          ${isChecklist ? 'Checklist' : 'Post'}
        </span>
      </div>
      <article class="linkedin-spotlight-body">
        <h4>${esc(content.title.replace(/^Post:\s*/i, ''))}</h4>
        <p class="muted small">
          ${icon('clock', 13)} ${esc(formatDeadline(task.deadline))}
          · ~${task.estimatedMinutes} min
          ${content.pillar ? ` · ${esc(content.pillar.replace(/_/g, ' '))}` : ''}
        </p>
        <div class="linkedin-spotlight-preview">${esc(preview)}</div>
        <div class="linkedin-spotlight-actions">
          <button
            type="button"
            class="btn btn-secondary btn-sm btn-open-article-review"
            data-content-id="${esc(content.id)}"
            data-task-id="${esc(task.id)}"
          >
            Editar borrador
          </button>
          <button
            type="button"
            class="btn btn-success btn-sm btn-approve-article-task"
            data-content-id="${esc(content.id)}"
            data-task-id="${esc(task.id)}"
          >
            Aprobar sin cambios
          </button>
        </div>
      </article>
    </section>
  `;
}

function renderWeeklyStrip(campaignId: string, tasks: ReturnType<typeof dbService.getTasksForClient>): string {
  const milestones = dbService.getCampaignMilestones(campaignId);
  const currentDay = dbService.getCurrentPlanDay(campaignId);
  const weekStart = currentDay - ((new Date().getDay() + 6) % 7);
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

  return `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Esta semana</h3>
          <p>Ritmo operativo — acciones del plan de ejecución.</p>
        </div>
        <span class="badge badge-neutral">${icon('calendar', 13)} Semana en curso</span>
      </div>
      <div class="week-grid">
        ${days.map((label, i) => {
          const dayNum = weekStart + i;
          const ms = milestones.find((m) => m.dayNumber === dayNum);
          const dayTasks = tasks.filter((t) => t.campaignDay === dayNum && t.status !== 'COMPLETED');
          const isToday = dayNum === currentDay;
          return `
            <div class="week-day ${isToday ? 'week-day-today' : ''}">
              <span class="week-day-label">${label}${isToday ? ' · hoy' : ''}</span>
              <span class="week-day-num">${dayNum > 0 ? `Día ${dayNum}` : '—'}</span>
              ${ms ? `<p class="week-day-title">${esc(ms.title)}</p>` : '<p class="week-day-title muted">Sin hito</p>'}
              ${dayTasks.length ? `<span class="badge badge-accent">${dayTasks.length} tarea${dayTasks.length === 1 ? '' : 's'}</span>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderClientHomeBody(
  client: ReturnType<typeof dbService.getClientById>,
  tasks: ReturnType<typeof dbService.getTasksForClient>,
  campaignId: string
): string {
  const open = tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
  const urgent = open.slice(0, 3);
  const clientId = client?.id || '';

  return `
      <div class="card hero-card">
        <div class="hero-card-inner">
          <div>
            <h2>Hola, ${esc(client?.firstName)}</h2>
            <p>${open.length
              ? `Tienes <strong>${open.length} acción${open.length === 1 ? '' : 'es'}</strong> pendiente${open.length === 1 ? '' : 's'} en esta campaña.`
              : 'No tienes acciones pendientes. Tu Brand Manager está preparando el siguiente lote.'}</p>
          </div>
          <div class="hero-card-meta">
            <button type="button" class="btn btn-secondary btn-sm" data-tab="client-profile">
              ${icon('users', 15)} Mi perfil
            </button>
            <button type="button" class="btn btn-primary btn-sm" data-tab="client-feed">
              ${icon('checkSquare', 15)} Ver mis tareas
            </button>
          </div>
        </div>
      </div>

      ${renderWeeklyLinkedInSpotlight(clientId, tasks, campaignId)}
      ${renderOpportunitySpotlight(clientId)}
      ${renderClientStats(campaignId, tasks, clientId)}
      ${renderKpiSummaryTiles(clientId)}
      ${renderPlanProgress(campaignId)}
      ${renderWeeklyStrip(campaignId, tasks)}

      ${urgent.length ? `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Acciones urgentes</h3>
            <p>Lo primero que conviene resolver.</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" data-tab="client-feed">Ver todas</button>
        </div>
        <ul class="urgent-task-list">
          ${urgent.map((t) => `
            <li>
              <strong>${esc(t.title)}</strong>
              ${renderTaskMetaBadges(t)}
              <span class="muted small">${icon('clock', 13)} ${esc(formatDeadline(t.deadline))}</span>
            </li>
          `).join('')}
        </ul>
      </div>` : ''}

      <div class="card">
        <div class="card-header">
          <div>
            <h3>Briefings de tu Brand Manager</h3>
            <p>Selección curada con el motivo de cada ítem.</p>
          </div>
        </div>
        ${renderReceivedBriefings(clientId)}
      </div>
  `;
}

function renderClientTaskFeedBody(_client: ReturnType<typeof dbService.getClientById>, tasks: ReturnType<typeof dbService.getTasksByClient>, opportunities: ReturnType<typeof dbService.getOpportunitiesByClient>): string {
  const pendingTasks = tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');

  return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Acciones preparadas</h3>
            <p style="font-size: 0.9rem;">Revisa, graba con el teleprompter o aprueba material redactado en tu voz.</p>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          ${pendingTasks.length > 0 ? pendingTasks.map(task => {
            const isVideoTask = task.type === 'RECORD_VIDEO';
            return `
              <div class="card" style="background: var(--bg-surface); border: 1px solid ${isVideoTask ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-medium)'}; padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                  <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span style="font-size: 1.5rem;">${isVideoTask ? '🎬' : '📝'}</span>
                    <div>
                      <h4>${esc(task.title)}</h4>
                      ${renderTaskMetaBadges(task)}
                      <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">
                        Tiempo estimado: ${task.estimatedMinutes} min · Fecha límite: ${formatDeadline(task.deadline)}
                      </p>
                    </div>
                  </div>
                  <span class="badge badge-progress">${esc(task.status)}</span>
                </div>

                <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.25rem; background: var(--bg-surface-raised); padding: 0.85rem; border-radius: var(--radius-md);">
                  ${esc(task.description)}
                </p>

                ${isVideoTask ? `
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.85rem; color: #a5b4fc; font-weight: 500;">
                      Guion cargado y sincronizado con el teleprompter en navegador.
                    </span>
                    <button class="btn btn-primary btn-open-teleprompter" data-task-id="${esc(task.id)}">
                      Abrir Teleprompter y Grabar Video
                    </button>
                  </div>
                ` : task.type === 'REVIEW_ARTICLE' && task.contentItemId ? `
                  <div style="display: flex; justify-content: flex-end; gap: 0.75rem; flex-wrap: wrap;">
                    <button class="btn btn-secondary btn-sm btn-open-article-review" data-content-id="${esc(task.contentItemId)}" data-task-id="${esc(task.id)}">
                      Editar artículo
                    </button>
                    <button class="btn btn-success btn-sm btn-approve-article-task" data-content-id="${esc(task.contentItemId)}" data-task-id="${esc(task.id)}">
                      Aprobar sin cambios
                    </button>
                  </div>
                ` : `
                  <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
                    <button class="btn btn-secondary btn-sm btn-request-task-changes" data-task-id="${esc(task.id)}">
                      Solicitar Ajustes
                    </button>
                    <button class="btn btn-success btn-sm btn-complete-task" data-task-id="${esc(task.id)}">
                      Aprobar y Marcar como Listo
                    </button>
                  </div>
                `}
              </div>
            `;
          }).join('') : `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
              🎉 ¡Excelente! No tienes tareas pendientes por el momento. Tu Brand Manager está preparando las siguientes oportunidades.
            </div>
          `}
        </div>
      </div>

      <!-- Opportunities (The Scout) -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Oportunidades (The Scout)</h3>
            <p style="font-size: 0.9rem;">Acepta, completa el checklist y marca la postulación enviada.</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" data-tab="client-opps">Ver todas</button>
        </div>
        <div class="opportunity-list">
          ${opportunities.length
            ? opportunities
                .filter((o) => o.status !== 'ARCHIVED')
                .map((opp) => renderOpportunityCard(opp))
                .join('')
            : '<p class="empty-state">No hay oportunidades pendientes por ahora.</p>'}
        </div>
      </div>
  `;
}

function renderClientThesisBody(client: ReturnType<typeof dbService.getClientById>, theses: ReturnType<typeof dbService.getThesesByClient>, profile: ReturnType<typeof dbService.getMasterProfile>): string {
  const activeThesis = theses[0];
  const clientId = client ? client.id : 'client_juan_001';
  const campaigns = dbService.getCampaignsByClient(clientId);
  const evidenceList = dbService.getEvidenceVaultByClient(clientId);

  return `
    <div style="display: flex; flex-direction: column; gap: 2rem; width: 100%;">
      <!-- Campaigns Tracker (F8-D08) -->
      ${campaigns.length > 0 ? `
        <div class="card" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%); border: 1px solid var(--border-accent);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="badge badge-progress">${campaigns[0].status}</span>
                <h3 style="color: var(--text-primary); font-size: 1.1rem;">${campaigns[0].name}</h3>
              </div>
              <p style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 0.25rem;">
                ${campaigns[0].description}
              </p>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 0.8rem; color: var(--text-muted);">Entregables Completados:</span>
              <p style="font-size: 1.25rem; font-weight: 700; color: #06b6d4;">${campaigns[0].completedDeliverables} / ${campaigns[0].targetDeliverables}</p>
            </div>
          </div>
          <div style="width: 100%; height: 6px; background: var(--bg-surface-raised); border-radius: 3px; margin-top: 0.75rem; overflow: hidden;">
            <div style="width: ${(campaigns[0].completedDeliverables / campaigns[0].targetDeliverables) * 100}%; height: 100%; background: #06b6d4;"></div>
          </div>
        </div>
      ` : ''}

      <!-- Thesis Definition Card -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Tu Tesis de Posicionamiento Activa</h3>
            <p style="font-size: 0.9rem;">El filtro maestro que define qué temas se publican y ante qué público objetivo.</p>
          </div>
          ${activeThesis
            ? `<span class="badge badge-ready">${esc(activeThesis.status)} · ${esc(activeThesis.clientApprovalStatus)}</span>`
            : ''}
        </div>

        ${activeThesis ? `
          <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            <div class="grid-2">
              <div style="background: var(--bg-surface); padding: 1.25rem; border-radius: var(--radius-md);">
                <label class="form-label">Identidad Experta</label>
                <p style="color: var(--text-primary); font-size: 0.95rem; font-weight: 500; margin-top: 0.25rem;">
                  ${esc(activeThesis.expertIdentity)}
                </p>
              </div>
              <div style="background: var(--bg-surface); padding: 1.25rem; border-radius: var(--radius-md);">
                <label class="form-label">Audiencia Objetivo</label>
                <p style="color: var(--text-primary); font-size: 0.95rem; font-weight: 500; margin-top: 0.25rem;">
                  ${esc(activeThesis.targetAudience)}
                </p>
              </div>
            </div>

            <div class="grid-2">
              <div style="background: var(--bg-surface); padding: 1.25rem; border-radius: var(--radius-md);">
                <label class="form-label">Dominio / Disciplina</label>
                <p style="color: var(--text-primary); font-size: 0.95rem; font-weight: 500; margin-top: 0.25rem;">
                  ${esc(activeThesis.domain)}
                </p>
              </div>
              <div style="background: var(--bg-surface); padding: 1.25rem; border-radius: var(--radius-md);">
                <label class="form-label">Objetivo de Posicionamiento</label>
                <p style="color: var(--text-primary); font-size: 0.95rem; font-weight: 500; margin-top: 0.25rem;">
                  ${esc(activeThesis.objective)}
                </p>
              </div>
            </div>

            <div style="background: var(--bg-surface); padding: 1.25rem; border-radius: var(--radius-md);">
              <label class="form-label">Evidencias & Proof Points Registrados</label>
              <ul style="margin-top: 0.5rem; padding-left: 1.25rem; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.8;">
                ${activeThesis.proofPoints.map(p => `<li>${esc(p)}</li>`).join('')}
              </ul>
            </div>
          </div>
        ` : `
          <p style="color: var(--text-muted);">Sin tesis configurada. Tu Brand Manager aún no ha publicado una tesis para tu aprobación.</p>
        `}
        ${activeThesis && activeThesis.clientApprovalStatus !== 'APPROVED' ? `
          <div style="margin-top: 1rem; display:flex; gap:0.5rem;">
            <button class="btn btn-success btn-approve-thesis" data-thesis-id="${activeThesis.id}">Aprobar tesis</button>
            <button class="btn btn-secondary btn-request-thesis-changes" data-thesis-id="${activeThesis.id}">Pedir cambios</button>
          </div>
        ` : ''}
      </div>

      ${renderProofWall(clientId)}
      ${renderServiceLinesReadOnly(clientId)}

      <!-- Evidence Vault (Módulo C / F7-D07 / F8-D08) -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Evidence Vault & Verificación de Credenciales (Módulo C)</h3>
            <p style="font-size: 0.9rem;">Pruebas verificables, papers y acreditaciones que respaldan el rigor de los contenidos.</p>
          </div>
          <button id="btn-add-evidence-vault" class="btn btn-secondary btn-sm" data-client-id="${clientId}">
            + Añadir Evidencia al Vault
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${evidenceList.map(item => `
            <div class="card" style="background: var(--bg-surface); padding: 1rem; border-left: 3px solid #10b981;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <h4 style="font-size: 0.95rem;">${esc(item.title)}</h4>
                  <span class="badge badge-ready">Verificada (${item.confidenceScore}%)</span>
                </div>
                <span class="badge badge-progress">${esc(item.type)}</span>
              </div>
              <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.35rem;">
                ${esc(item.snippet)}
              </p>
              ${item.sourceUrl ? `
                <a href="${safeHref(item.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="font-size: 0.8rem; color: #a5b4fc; text-decoration: underline;">
                  Ver fuente original / Acreditación
                </a>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Master Profile Preview -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Perfil maestro</h3>
            <p style="font-size: 0.9rem;">Tus credenciales, publicaciones y estilo de voz que alimentan a los agentes de redacción.</p>
          </div>
        </div>

        ${profile ? `
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <div>
              <h4>${esc(client?.displayName || 'Perfil Profesional')}</h4>
              <p style="color: var(--text-secondary); margin-top: 0.2rem;">${esc(profile.identity?.professionalHeadline || profile.career?.currentRole || '')}</p>
              <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 0.5rem;">${esc(profile.identity?.shortBio || '')}</p>
            </div>

            <div class="grid-2">
              <div style="background: var(--bg-surface); padding: 1rem; border-radius: var(--radius-md);">
                <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">🎓 Formación Académica</h4>
                ${(profile.education || []).map(e => `
                  <p style="font-size: 0.85rem; margin-bottom: 0.35rem;">
                    <strong>${esc(e.degree)}</strong> — ${esc(e.institution)} (${esc(e.year || '')})
                  </p>
                `).join('')}
              </div>

              <div style="background: var(--bg-surface); padding: 1rem; border-radius: var(--radius-md);">
                <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">🎙️ Preferencias de Voz</h4>
                <p style="font-size: 0.85rem; margin-bottom: 0.25rem;">
                  <strong>Tono:</strong> ${(profile.voicePreferences?.tone || 'authoritative').toUpperCase()}
                </p>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">
                  <strong>Frases preferidas:</strong> ${esc((profile.voicePreferences?.preferredPhrases || []).join(', '))}
                </p>
              </div>
            </div>
          </div>
        ` : `
          <p style="color: var(--text-muted);">Sin perfil cargado.</p>
        `}
      </div>
    </div>
  `;
}

function renderClientContentReviewBody(client: ReturnType<typeof dbService.getClientById>): string {
  const contents = dbService.getContentByClient(client ? client.id : 'client_juan_001')
    .filter((item) => item.status === 'CLIENT_REVIEW' || item.status === 'CHANGES_REQUESTED');

  return `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Contenido pendiente de tu revisión</h3>
          <p style="font-size: 0.9rem;">Edita el borrador en tu voz, aprueba o rechaza con un motivo claro.</p>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${contents.length
          ? contents.map((item) => renderContentRow(item, true)).join('')
          : '<p class="empty-state">No hay contenido esperando tu revisión.</p>'}
      </div>
    </div>
  `;
}

function renderContentRow(item: ReturnType<typeof dbService.getContentByClient>[number], showReviewActions: boolean): string {
  return `
    <div class="card" style="background: var(--bg-surface); padding: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <h4>${esc(item.title)}</h4>
            <span class="badge ${item.status === 'READY' || item.status === 'PUBLISHED' ? 'badge-ready' : 'badge-progress'}">${esc(item.status)}</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">
            Plataforma: <strong>${esc(item.targetPlatform)}</strong> · Formato: ${esc(item.type)}
          </p>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap: wrap;">
          ${showReviewActions && item.status === 'CLIENT_REVIEW' ? `
            <button class="btn btn-primary btn-sm btn-open-article-review" data-content-id="${esc(item.id)}">Editar</button>
            <button class="btn btn-success btn-sm btn-client-approve-content" data-content-id="${esc(item.id)}">Aprobar</button>
            <button class="btn btn-secondary btn-sm btn-request-content-changes" data-content-id="${esc(item.id)}">Rechazar</button>
          ` : ''}
          <button class="btn btn-secondary btn-sm btn-preview-content" data-content-id="${esc(item.id)}">Ver</button>
        </div>
      </div>
    </div>
  `;
}

function renderClientLibraryBody(client: ReturnType<typeof dbService.getClientById>): string {
  const contents = dbService.getContentByClient(client ? client.id : 'client_juan_001')
    .filter((item) => item.status === 'READY' || item.status === 'PUBLISHED' || item.status === 'DRAFT');
  return `
    <div style="display: flex; flex-direction: column; gap: 2rem; width: 100%;">
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Biblioteca de Publicaciones & Contenido Aprobado</h3>
            <p style="font-size: 0.9rem;">Historial acumulado de autoridad, videos y artículos listos o publicados.</p>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${contents.length
            ? contents.map((item) => renderContentRow(item, false)).join('')
            : '<p class="empty-state">Tu biblioteca aparecerá aquí cuando haya contenido listo o publicado.</p>'}
        </div>
      </div>
    </div>
  `;
}

function renderClientResultsBody(client: ReturnType<typeof dbService.getClientById>): string {
  const results = dbService.getResultsByClient(client ? client.id : 'client_juan_001');
  const kpiOptions = Object.entries(KPI_LABELS)
    .map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`)
    .join('');

  return `
    ${renderKpiSummaryTiles(client ? client.id : 'client_juan_001')}
    ${renderKpiWeeklyChart(client ? client.id : 'client_juan_001')}
    <div class="card" style="width:100%;">
      <div class="card-header">
        <div>
          <h3>Resultados</h3>
          <p>Registra métricas de una publicación o conferencia. Puedes pasarlas al Evidence Vault.</p>
        </div>
      </div>
      <form id="form-add-result" data-client-id="${client?.id || ''}">
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Título</label>
            <input class="form-input" id="result-title" required placeholder="Video LinkedIn: carga de la prueba" />
          </div>
          <div class="form-group">
            <label class="form-label">Canal</label>
            <input class="form-input" id="result-channel" required placeholder="LinkedIn" />
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Tipo KPI (plan §11.3)</label>
            <select class="form-select" id="result-kpi-type">${kpiOptions}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Métrica</label>
            <input class="form-input" id="result-metric-label" value="Impresiones" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Valor</label>
          <input class="form-input" type="number" id="result-metric-value" value="0" />
        </div>
        <button class="btn btn-primary" type="submit">Registrar resultado</button>
      </form>
      <div style="margin-top:1.25rem;">
        ${results.map((r) => `
          <div class="card" style="margin-bottom:0.75rem;">
            <strong>${esc(r.title)}</strong> · ${esc(r.channel)}
            ${r.kpiType ? `<span class="badge badge-neutral">${esc(kpiLabel(r.kpiType))}</span>` : ''}
            · ${esc(r.metricLabel)}: ${r.metricValue}
            ${r.addedToEvidence ? '<span class="badge badge-ready">En vault</span>' : `<button class="btn btn-secondary btn-sm btn-result-to-evidence" data-result-id="${esc(r.id)}">Añadir al vault</button>`}
          </div>
        `).join('') || '<p class="form-label">Aún no hay resultados.</p>'}
      </div>
    </div>
  `;
}


