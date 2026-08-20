import { dbService } from '../services/db';
import { buildTopics, momentumLabel } from '../services/topics';
import {
  AdviceAction,
  AdviceCategory,
  Client,
  CurationDestination,
  CurationEntry,
  DeliveryPackage,
  PositioningAdvice,
  PositioningThesis,
  Signal,
  Source,
  Task,
  TaskType,
  Topic,
} from '../types';
import { esc } from '../lib/escape';
import { icon } from '../lib/icons';
import { deriveWorkStage, WORK_STAGE_BADGE, WORK_STAGE_LABELS } from '../domain/workPipeline';
import { renderPage, normalizeTab } from './PageHeader';
import { renderContentPipeline } from './ManagerCockpit';
import { getSourceSuggestions } from '../services/sourceSuggestions';
import { buildProfileKeywords, discoverSources } from '../services/sourceDiscovery';
import { renderMasterDossierPanel } from './MasterDossierPanel';
import { renderProofWall, renderServiceLinesReadOnly } from './ProofWallPanel';
import { renderManagerOpportunities } from './OpportunityPanel';
import { renderKpiSummaryTiles, renderKpiWeeklyChart } from './KpiWeeklyChart';
import { getLatestTopicAgentRun } from '../services/topicAgent';

export interface WorkspaceFilters {
  searchQuery?: string;
  sourceType?: string;
  contentStatus?: string;
  priorityBand?: string;
  topicKey?: string;
}

const DESTINATION_LABELS: Record<CurationDestination, string> = {
  TASK_VIDEO: 'Tarea: grabar video',
  TASK_ARTICLE: 'Tarea: revisar artículo',
  OPPORTUNITY: 'Oportunidad de escenario',
  REFERENCE_READING: 'Lectura de referencia',
  EVIDENCE: 'Guardar como evidencia',
  DISCARD: 'Descartado',
};

const CATEGORY_LABELS: Record<AdviceCategory, string> = {
  CONTENT: 'Contenido',
  CREDENTIAL: 'Credenciales',
  VISIBILITY: 'Visibilidad',
  EVIDENCE: 'Evidencia',
  NETWORK: 'Red de contactos',
  RISK: 'Riesgo',
};

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  RECORD_VIDEO: 'Grabar video',
  REVIEW_ARTICLE: 'Revisar artículo',
  APPROVE_OPPORTUNITY: 'Aprobar oportunidad',
  SUBMIT_INFO: 'Enviar información',
};

const TASK_STATUS_LABELS: Record<Task['status'], string> = {
  DRAFT: 'Borrador',
  ASSIGNED: 'Asignada',
  VIEWED: 'Vista',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};

const HORIZON_LABELS: Record<'DAYS_30' | 'DAYS_60' | 'DAYS_90', string> = {
  DAYS_30: '30 días',
  DAYS_60: '60 días',
  DAYS_90: '90 días',
};

export function renderClientWorkspace(
  activeTab: string,
  clientId: string,
  filters: WorkspaceFilters = {}
): string {
  const client = dbService.getClientById(clientId);
  if (!client) {
    return renderPage('ws-briefing', '<p class="empty-state">Cliente no encontrado. Vuelve a la cartera.</p>');
  }

  const theses = dbService.getThesesByClient(clientId);
  const thesis = theses.find((t) => t.status === 'ACTIVE') || theses[0];

  switch (normalizeTab(activeTab)) {
    case 'ws-sources':
      return renderPage(
        'ws-sources',
        renderSources(client, thesis),
        `<button id="btn-poll-all-sources" class="btn btn-secondary">Ingerir todas</button>
         <button id="btn-open-source-registry" class="btn btn-secondary" data-client-id="${esc(clientId)}">+ Nueva fuente</button>
         <button id="btn-add-manual-signal" class="btn btn-primary" data-client-id="${esc(clientId)}">+ Señal manual</button>`
      );
    case 'ws-tasks':
      return renderPage(
        'ws-tasks',
        renderTasks(client),
        `<button id="btn-open-add-task" class="btn btn-primary" data-client-id="${esc(clientId)}">+ Asignar tarea</button>`
      );
    case 'ws-radar':
      return renderPage(
        'ws-radar',
        renderRadar(client, thesis, filters),
        `<button id="btn-poll-all-sources" class="btn btn-secondary">Buscar novedades</button>
         <button id="btn-add-manual-signal" class="btn btn-secondary" data-client-id="${esc(clientId)}">+ Señal manual</button>`
      );
    case 'ws-deliver':
      return renderPage('ws-deliver', renderDeliver(client, thesis));
    case 'ws-positioning':
      return renderPage(
        'ws-positioning',
        renderPositioning(client, theses),
        `<a class="btn btn-secondary btn-sm" href="#dossier-maestro" style="text-decoration:none;">Ver dossier</a>
         <button class="btn btn-secondary btn-open-thesis-editor" data-client-id="${esc(clientId)}">Nueva tesis</button>
         ${thesis ? `<button class="btn btn-secondary btn-challenge-thesis" data-client-id="${esc(clientId)}">Stress-test</button>` : ''}`
      );
    case 'ws-production':
      return renderPage(
        'ws-production',
        renderContentPipeline(dbService.getContentByClient(clientId), filters, { showCreate: true, clientId })
      );
    case 'ws-results':
      return renderPage('ws-results', renderResults(client));
    case 'ws-briefing':
    default:
      return renderPage('ws-briefing', renderBriefing(client, thesis, filters));
  }
}

// ==========================================
// Resumen del día
// ==========================================

function renderTopicAgentPanel(clientId: string): string {
  const latest = getLatestTopicAgentRun(clientId);

  return `
    <section class="card topic-agent-panel">
      <div class="card-header">
        <div>
          <h3>Topic Agent — ranking diario</h3>
          <p class="muted small">Lista priorizada con rationale. Disparo manual (v1 heurística).</p>
        </div>
        <button type="button" id="btn-run-topic-agent" class="btn btn-secondary btn-sm" data-client-id="${esc(clientId)}">
          Generar ranking
        </button>
      </div>
      ${latest
        ? `<p class="muted small">Última ejecución: ${new Date(latest.run.createdAt).toLocaleString('es')}</p>
           <ol class="topic-agent-list">
             ${latest.items.map((item) => `
               <li class="topic-agent-item">
                 <div class="topic-agent-item-head">
                   <strong>#${item.rank} ${esc(item.label)}</strong>
                   <span class="badge badge-progress">${esc(momentumLabel(item.momentum))}</span>
                 </div>
                 <p class="muted small">${esc(item.rationale)}</p>
               </li>
             `).join('')}
           </ol>`
        : '<p class="empty-state">Aún no hay ranking. Pulsa «Generar ranking» para analizar señales actuales.</p>'}
    </section>
  `;
}

function renderBriefing(client: Client, thesis: PositioningThesis | undefined, _filters: WorkspaceFilters): string {
  const clientId = client.id;
  const signals = dbService.getSignalsByClient(clientId);
  const topics = buildTopics(clientId, signals);
  const unreviewed = signals.filter((s) => s.managerDecision === 'UNREVIEWED' && s.status !== 'DISCARDED');
  const pendingCuration = dbService.getPendingCurationByClient(clientId);
  const readyToDeliver = dbService.getReadyCurationByClient(clientId);
  const tasks = dbService.getTasksByClient(clientId).filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
  const advice = dbService.getLatestAdvice(clientId);
  const lastDelivery = dbService.getSentDeliveriesByClient(clientId)[0];

  const hotTopics = topics.filter((t) => t.momentum === 'RISING' || t.momentum === 'EMERGING').slice(0, 3);

  return `
    ${!thesis
      ? `<div class="info-strip warn">
           <span><strong>Este cliente no tiene tesis activa.</strong> Sin tesis el radar no puede puntuar señales ni filtrar temas.</span>
           <button class="btn btn-primary btn-sm btn-open-thesis-editor" data-client-id="${esc(clientId)}">Definir tesis</button>
         </div>`
      : ''}

    <section class="grid-4">
      <div class="card stat-card">
        <p class="form-label">Señales nuevas</p>
        <h2>${unreviewed.length}</h2>
        <button class="link-btn" data-tab="ws-radar">Ver radar</button>
      </div>
      <div class="card stat-card">
        <p class="form-label">Por decidir</p>
        <h2>${pendingCuration.length}</h2>
        <button class="link-btn" data-tab="ws-curation">Ir a curación</button>
      </div>
      <div class="card stat-card">
        <p class="form-label">Listo para entregar</p>
        <h2>${readyToDeliver.length}</h2>
        <button class="link-btn" data-tab="ws-delivery">Armar briefing</button>
      </div>
      <div class="card stat-card">
        <p class="form-label">Tareas abiertas</p>
        <h2>${tasks.length}</h2>
        <button class="link-btn" data-tab="ws-tasks">Gestionar tareas</button>
      </div>
    </section>

    ${renderTopicAgentPanel(clientId)}

    <section class="workspace-split">
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Qué se mueve en su dominio</h3>
            <p style="font-size: 0.9rem;">Temas agrupados a partir de las señales capturadas.</p>
          </div>
        </div>

        ${hotTopics.length
          ? hotTopics.map((topic) => renderTopicRow(topic, true)).join('')
          : '<p class="empty-state">Sin temas emergentes. Ingiere fuentes para alimentar el radar.</p>'}
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h3>Diagnóstico de imagen</h3>
            <p style="font-size: 0.9rem;">Qué tan sólida es su autoridad y dónde están las brechas.</p>
          </div>
          <button id="btn-generate-advice" class="btn btn-primary btn-sm" data-client-id="${esc(clientId)}">
            ${advice ? 'Recalcular' : 'Generar'}
          </button>
        </div>

        ${advice ? renderAdviceSummary(advice) : `
          <p class="empty-state">
            Aún no hay diagnóstico. Genera el análisis para ver fortalezas, brechas y acciones de mejora.
          </p>
        `}
      </div>
    </section>

    ${advice ? renderAdviceActions(advice) : ''}

    ${renderManagerOpportunities(clientId)}

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Última entrega</h3>
          <p style="font-size: 0.9rem;">Lo que el cliente recibió y cuándo.</p>
        </div>
      </div>
      ${lastDelivery
        ? `<div class="delivery-summary">
             <div>
               <strong>${esc(lastDelivery.title)}</strong>
               <p class="muted">${lastDelivery.items.length} ítem(s) · enviado ${new Date(lastDelivery.sentAt || lastDelivery.createdAt).toLocaleDateString('es')}</p>
             </div>
             <span class="badge ${lastDelivery.status === 'ACKNOWLEDGED' ? 'badge-ready' : 'badge-progress'}">
               ${lastDelivery.status === 'ACKNOWLEDGED' ? 'Visto por el cliente' : 'Enviado'}
             </span>
           </div>`
        : '<p class="empty-state">Este cliente todavía no ha recibido ningún briefing.</p>'}
    </section>
  `;
}

function renderAdviceSummary(advice: PositioningAdvice): string {
  const { diagnosis } = advice;
  const dims: Array<[string, number]> = [
    ['Autoridad', diagnosis.authorityScore],
    ['Consistencia', diagnosis.consistencyScore],
    ['Evidencia', diagnosis.evidenceScore],
    ['Visibilidad', diagnosis.visibilityScore],
  ];

  return `
    <p class="advice-summary">${esc(advice.summary)}</p>

    <div class="dimension-grid">
      ${dims.map(([label, value]) => `
        <div class="dimension">
          <div class="dimension-head">
            <span>${esc(label)}</span>
            <strong>${value}</strong>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${value >= 70 ? 'progress-green' : value >= 45 ? '' : 'progress-red'}" style="width: ${value}%"></div>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="diagnosis-lists">
      <div>
        <h5>Fortalezas</h5>
        <ul>${diagnosis.strengths.slice(0, 3).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </div>
      <div>
        <h5>Brechas</h5>
        <ul>${diagnosis.gaps.slice(0, 3).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </div>
      <div>
        <h5>Riesgos</h5>
        <ul>${diagnosis.risks.slice(0, 3).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </div>
    </div>

    <p class="advice-meta">
      ${advice.usedLiveModel ? 'Generado con modelo conectado' : 'Análisis heurístico local'} ·
      ${new Date(advice.generatedAt).toLocaleString('es')}
    </p>
  `;
}

function renderAdviceActions(advice: PositioningAdvice): string {
  const byHorizon: Array<[AdviceAction['horizon'], AdviceAction[]]> = [
    ['DAYS_30', advice.actions.filter((a) => a.horizon === 'DAYS_30')],
    ['DAYS_60', advice.actions.filter((a) => a.horizon === 'DAYS_60')],
    ['DAYS_90', advice.actions.filter((a) => a.horizon === 'DAYS_90')],
  ];

  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h3>Plan de mejora propuesto</h3>
          <p style="font-size: 0.9rem;">Acciones para elevar su imagen profesional, ordenadas por horizonte.</p>
        </div>
      </div>

      <div class="horizon-grid">
        ${byHorizon.map(([horizon, actions]) => `
          <div class="horizon-column">
            <h5 class="horizon-title">${HORIZON_LABELS[horizon]}</h5>
            ${actions.length
              ? actions.map((action) => `
                <article class="advice-card">
                  <header>
                    <span class="badge badge-progress">${CATEGORY_LABELS[action.category]}</span>
                    <span class="impact-tag">Impacto ${action.impact}</span>
                  </header>
                  <h6>${esc(action.title)}</h6>
                  <p class="advice-why"><strong>Por qué:</strong> ${esc(action.why)}</p>
                  <p class="advice-how"><strong>Cómo:</strong> ${esc(action.how)}</p>
                  <footer>
                    <span class="muted">~${action.effortMinutes} min</span>
                    <button class="btn btn-secondary btn-sm btn-advice-to-curation"
                            data-client-id="${esc(advice.clientId)}"
                            data-action-id="${esc(action.id)}">
                      Llevar a curación
                    </button>
                  </footer>
                </article>
              `).join('')
              : '<p class="empty-state small">Sin acciones en este horizonte.</p>'}
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

// ==========================================
// Radar
// ==========================================

function renderTopicRow(topic: Topic, compact = false): string {
  const trendClass =
    topic.momentum === 'RISING' || topic.momentum === 'EMERGING' ? 'trend-up'
      : topic.momentum === 'FADING' ? 'trend-down' : 'trend-flat';

  return `
    <div class="topic-row ${topic.pinned ? 'pinned' : ''}">
      <div class="topic-main">
        <div class="topic-title-line">
          <strong>${esc(topic.label)}</strong>
          <span class="trend-tag ${trendClass}">${momentumLabel(topic.momentum)}</span>
          <span class="badge ${topic.priorityBand === 'CRITICAL' || topic.priorityBand === 'HIGH' ? 'badge-ready' : 'badge-progress'}">
            Score ${topic.topScore}
          </span>
        </div>
        <p class="topic-keywords">${topic.keywords.slice(0, 5).map((k) => esc(k)).join(' · ')}</p>
        <p class="topic-stats">
          ${topic.signalCount} señal(es) · ${topic.recentCount} esta semana
          ${topic.previousCount ? ` (antes ${topic.previousCount})` : ''}
        </p>
      </div>
      ${compact
        ? `<button class="btn btn-secondary btn-sm" data-tab="ws-radar" data-topic-key="${esc(topic.key)}">Ver señales</button>`
        : `<div class="topic-actions">
             <button class="btn btn-secondary btn-sm btn-toggle-topic-pin" data-topic-key="${esc(topic.key)}">
               ${topic.pinned ? 'Quitar pin' : 'Fijar'}
             </button>
             <button class="btn btn-secondary btn-sm btn-filter-topic" data-topic-key="${esc(topic.key)}">
               Filtrar
             </button>
           </div>`}
    </div>
  `;
}

function renderSignalCard(signal: Signal, thesis: PositioningThesis | undefined, inCuration: boolean): string {
  const score = signal.relevanceScore;
  const band = signal.priorityBand;
  const accent = band === 'CRITICAL' ? 'accent-critical' : band === 'HIGH' ? 'accent-high' : band === 'LOW' ? 'accent-low' : 'accent-medium';

  return `
    <article class="signal-card ${accent}">
      <header class="signal-head">
        <span class="badge badge-pending">${esc(signal.sourceType)}</span>
        ${score !== undefined
          ? `<span class="badge ${band === 'CRITICAL' || band === 'HIGH' ? 'badge-ready' : 'badge-progress'}">
               Score ${score}${band ? ` · ${esc(band)}` : ''}
             </span>`
          : '<span class="badge badge-progress">Sin puntuar</span>'}
      </header>

      <h4 class="signal-title">${esc(signal.title)}</h4>
      <p class="signal-snippet">${esc(signal.contentSnippet)}</p>

      ${signal.recommendedAction
        ? `<p class="signal-suggestion">Sugerencia del sistema: <strong>${esc(signal.recommendedAction)}</strong></p>`
        : ''}

      <footer class="signal-foot">
        <span class="muted">
          ${esc(signal.sourceName)} · ${new Date(signal.detectedAt).toLocaleDateString('es')}
        </span>
        <div class="signal-actions">
          <button class="btn btn-secondary btn-sm btn-discard-signal" data-signal-id="${esc(signal.id)}">Descartar</button>
          ${thesis ? `<button class="btn btn-secondary btn-sm btn-analyze-signal" data-signal-id="${esc(signal.id)}">Puntuar</button>` : ''}
          ${inCuration
            ? '<span class="badge badge-ready">En curación</span>'
            : `<button class="btn btn-primary btn-sm btn-send-to-curation" data-signal-id="${esc(signal.id)}">A curación</button>`}
        </div>
      </footer>
    </article>
  `;
}

function renderRadar(client: Client, thesis: PositioningThesis | undefined, filters: WorkspaceFilters): string {
  const clientId = client.id;
  const allSignals = dbService.getSignalsByClient(clientId);
  const topics = buildTopics(clientId, allSignals);

  const query = (filters.searchQuery || '').toLowerCase();
  const sourceFilter = filters.sourceType || 'ALL';
  const bandFilter = filters.priorityBand || 'ALL';
  const topicFilter = filters.topicKey;
  const topicSignalIds = topicFilter ? topics.find((t) => t.key === topicFilter)?.signalIds : undefined;
  const activeTopic = topicFilter ? topics.find((t) => t.key === topicFilter) : undefined;

  const visible = allSignals.filter((s) => {
    if (s.status === 'DISCARDED') return false;
    if (query && !s.title.toLowerCase().includes(query) && !s.contentSnippet.toLowerCase().includes(query)) return false;
    if (sourceFilter !== 'ALL' && s.sourceType !== sourceFilter) return false;
    if (bandFilter !== 'ALL' && s.priorityBand !== bandFilter) return false;
    if (topicSignalIds && !topicSignalIds.includes(s.id)) return false;
    return true;
  });

  const sorted = [...visible].sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  const unscored = allSignals.filter((s) => s.relevanceScore === undefined && s.status !== 'DISCARDED').length;

  return `
    ${!thesis
      ? `<div class="info-strip warn">
           <span>Sin tesis activa no se puede calcular el score estratégico. Las señales se muestran sin puntuar.</span>
         </div>`
      : unscored > 0
        ? `<div class="info-strip">
             <span>${unscored} señal(es) sin puntuar.</span>
             <button id="btn-score-all-signals" class="btn btn-secondary btn-sm" data-client-id="${esc(clientId)}">
               Puntuar todas
             </button>
           </div>`
        : ''}

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Tendencias del dominio</h3>
          <p style="font-size: 0.9rem;">${topics.length} tema(s) detectado(s) agrupando ${allSignals.length} señal(es).</p>
        </div>
      </div>
      ${topics.length
        ? topics.slice(0, 6).map((t) => renderTopicRow(t)).join('')
        : '<p class="empty-state">Todavía no hay suficientes señales para detectar temas.</p>'}
    </section>

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Señales${activeTopic ? `: ${esc(activeTopic.label)}` : ''}</h3>
          <p style="font-size: 0.9rem;">Ordenadas por score estratégico. Envía a curación lo que valga la pena.</p>
        </div>
        ${activeTopic
          ? '<button class="btn btn-secondary btn-sm btn-clear-topic-filter">Quitar filtro de tema</button>'
          : ''}
      </div>

      <div class="filter-bar">
        <div class="search-input-group">
          <input type="text" id="input-search-signals" placeholder="Buscar en titulares o resúmenes..." value="${esc(filters.searchQuery || '')}" />
        </div>
        <div class="filter-pills">
          <span class="filter-pill ${bandFilter === 'ALL' ? 'active' : ''}" data-band-filter="ALL">Todas (${visible.length})</span>
          <span class="filter-pill ${bandFilter === 'CRITICAL' ? 'active' : ''}" data-band-filter="CRITICAL">Críticas</span>
          <span class="filter-pill ${bandFilter === 'HIGH' ? 'active' : ''}" data-band-filter="HIGH">Altas</span>
          <span class="filter-pill ${bandFilter === 'MEDIUM' ? 'active' : ''}" data-band-filter="MEDIUM">Medias</span>
        </div>
        <div class="filter-pills">
          <span class="filter-pill ${sourceFilter === 'ALL' ? 'active' : ''}" data-source-filter="ALL">Toda fuente</span>
          <span class="filter-pill ${sourceFilter === 'REGULATORY' ? 'active' : ''}" data-source-filter="REGULATORY">Regulatorio</span>
          <span class="filter-pill ${sourceFilter === 'RSS' ? 'active' : ''}" data-source-filter="RSS">RSS</span>
          <span class="filter-pill ${sourceFilter === 'MANUAL' ? 'active' : ''}" data-source-filter="MANUAL">Manual</span>
        </div>
      </div>

      <div class="signal-grid">
        ${sorted.length
          ? sorted.map((s) => renderSignalCard(s, thesis, dbService.isSignalInCuration(clientId, s.id))).join('')
          : '<p class="empty-state">No hay señales con estos filtros.</p>'}
      </div>
    </section>
  `;
}

// ==========================================
// Mesa de curación
// ==========================================

function renderCurationEntry(entry: CurationEntry): string {
  return `
    <article class="curation-card">
      <header class="curation-head">
        ${entry.score !== undefined
          ? `<span class="badge ${entry.priorityBand === 'CRITICAL' || entry.priorityBand === 'HIGH' ? 'badge-ready' : 'badge-progress'}">
               Score ${entry.score}${entry.priorityBand ? ` · ${esc(entry.priorityBand)}` : ''}
             </span>`
          : '<span class="badge badge-progress">Sin puntuar</span>'}
        ${entry.suggestedAction ? `<span class="muted small">Sugerido: ${esc(entry.suggestedAction)}</span>` : ''}
      </header>

      <h4>${esc(entry.title)}</h4>
      <p class="curation-snippet">${esc(entry.snippet)}</p>
      ${entry.sourceUrl ? `<a class="curation-link" href="${esc(entry.sourceUrl)}" target="_blank" rel="noopener noreferrer">Ver fuente original</a>` : ''}

      ${entry.aiAngle
        ? `<p class="curation-angle"><strong>Ángulo propuesto:</strong> ${esc(entry.aiAngle)}</p>`
        : `<button class="btn btn-secondary btn-sm btn-suggest-angle" data-curation-id="${esc(entry.id)}">
             Proponer ángulo
           </button>`}

      <form class="curation-form" data-curation-id="${esc(entry.id)}">
        <div class="form-group">
          <label class="form-label" for="dest-${esc(entry.id)}">Destino</label>
          <select id="dest-${esc(entry.id)}" name="destination" class="form-select" required>
            <option value="">Elige qué hacer con esto…</option>
            ${(Object.keys(DESTINATION_LABELS) as CurationDestination[]).map((d) => `
              <option value="${d}">${DESTINATION_LABELS[d]}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="why-${esc(entry.id)}">Por qué (queda en auditoría)</label>
          <textarea id="why-${esc(entry.id)}" name="rationale" class="form-input" rows="2" minlength="10" required
                    placeholder="Ej.: refuerza el proof point de gobernanza de IA y responde una duda real de la audiencia."></textarea>
        </div>
        <div class="curation-form-actions">
          <button type="submit" class="btn btn-primary btn-sm">Confirmar y añadir al briefing</button>
          <button type="button" class="btn btn-ghost btn-sm btn-remove-curation" data-curation-id="${esc(entry.id)}">Quitar</button>
        </div>
      </form>
    </article>
  `;
}

function renderDeliveryItems(pkg: DeliveryPackage): string {
  if (!pkg.items.length) {
    return `<p class="empty-state small">
      Vacío. Confirma el destino de una señal de la izquierda y entrará aquí automáticamente.
    </p>`;
  }

  return pkg.items.map((item) => `
    <div class="delivery-item">
      <div>
        <span class="badge badge-progress">${esc(item.kind)}</span>
        <strong>${esc(item.title)}</strong>
        ${item.rationale
          ? `<details class="briefing-rationale"><summary>Por qué se incluyó</summary><p class="muted small">${esc(item.rationale)}</p></details>`
          : ''}
      </div>
      <button class="btn btn-ghost btn-sm btn-remove-delivery-item"
              data-package-id="${esc(pkg.id)}" data-item-id="${esc(item.id)}"
              title="Quitar del briefing" aria-label="Quitar del briefing">
        ${icon('x', 15)}
      </button>
    </div>
  `).join('');
}

/** Panel derecho: el briefing funciona como carrito del flujo de entrega. */
function renderBriefingPanel(clientId: string, draft: DeliveryPackage | undefined, loose: CurationEntry[]): string {
  return `
    <div class="card briefing-panel">
      <div class="card-header">
        <div>
          <h3>${icon('inbox', 16)} Briefing en preparación</h3>
          <p>Se envía al portal del cliente cuando tú lo decidas.</p>
        </div>
        ${draft
          ? `<span class="badge badge-accent">${draft.items.length} ítem${draft.items.length === 1 ? '' : 's'}</span>`
          : `<button id="btn-create-delivery" class="btn btn-primary btn-sm" data-client-id="${esc(clientId)}">
               Crear briefing
             </button>`}
      </div>

      ${draft
        ? `
          <form id="form-delivery-meta" data-package-id="${esc(draft.id)}">
            <div class="form-group">
              <label class="form-label" for="delivery-title">Título</label>
              <input id="delivery-title" name="title" class="form-input" value="${esc(draft.title)}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="delivery-note">Nota estratégica para el cliente</label>
              <textarea id="delivery-note" name="strategicNote" class="form-textarea" rows="3"
                        placeholder="Explica en dos frases por qué este es el foco de la semana.">${esc(draft.strategicNote)}</textarea>
            </div>
            <button type="submit" class="btn btn-secondary btn-sm">Guardar nota</button>
          </form>

          <div class="delivery-items">
            ${renderDeliveryItems(draft)}
          </div>

          ${loose.length
            ? `<div class="briefing-loose">
                 <p class="briefing-loose-label">${icon('clock', 13)} Decididos fuera del briefing</p>
                 ${loose.map((entry) => `
                   <div class="ready-item">
                     <div>
                       <span class="badge badge-neutral">${DESTINATION_LABELS[entry.destination as CurationDestination]}</span>
                       <strong>${esc(entry.title)}</strong>
                     </div>
                     <div class="ready-item-actions">
                       <button class="btn btn-secondary btn-sm btn-add-to-delivery"
                               data-curation-id="${esc(entry.id)}" data-client-id="${esc(clientId)}">
                         Añadir
                       </button>
                       <button class="btn btn-ghost btn-sm btn-reopen-curation" data-curation-id="${esc(entry.id)}"
                               title="Volver a decidir" aria-label="Volver a decidir">
                         ${icon('arrowLeft', 15)}
                       </button>
                     </div>
                   </div>
                 `).join('')}
               </div>`
            : ''}

          <div class="delivery-send">
            <button id="btn-send-delivery" class="btn btn-gradient btn-block" data-package-id="${esc(draft.id)}"
                    ${draft.items.length ? '' : 'disabled'}>
              ${icon('send', 16)} Enviar al cliente
            </button>
            <span class="muted small">
              Al enviar se crean las tareas en su portal y recibe una notificación.
            </span>
          </div>
        `
        : '<p class="empty-state">No hay briefing abierto. Crea uno para empezar a agrupar entregables.</p>'}
    </div>
  `;
}

/**
 * Pantalla fusionada: decidir el destino de cada señal y armar el briefing
 * son la misma sesión de trabajo, así que viven en la misma vista.
 */
function renderDeliver(client: Client, thesis: PositioningThesis | undefined): string {
  const clientId = client.id;
  const pending = dbService.getPendingCurationByClient(clientId);
  const draft = dbService.getDraftDelivery(clientId);
  const loose = dbService.getReadyCurationByClient(clientId);
  const sent = dbService.getSentDeliveriesByClient(clientId);
  const all = dbService.getCurationByClient(clientId);
  const discarded = all.filter((c) => c.destination === 'DISCARD').length;
  const delivered = all.filter((c) => {
    const pkg = c.deliveryPackageId ? dbService.getDeliveryById(c.deliveryPackageId) : undefined;
    return pkg && pkg.status !== 'DRAFT';
  }).length;

  return `
    <div class="info-strip">
      <span>
        La IA propone y puntúa; tú decides. Al confirmar un destino el ítem entra directo al briefing.
        ${thesis
          ? `Tesis de referencia: <strong>${esc(thesis.title)}</strong>.`
          : 'Sin tesis activa: define una para tener criterio de filtro.'}
      </span>
    </div>

    <section class="stat-grid">
      <div class="card stat-card"><p class="form-label">Por decidir</p><h2>${pending.length}</h2></div>
      <div class="card stat-card"><p class="form-label">En el briefing</p><h2>${draft?.items.length || 0}</h2></div>
      <div class="card stat-card"><p class="form-label">Entregados</p><h2>${delivered}</h2></div>
      <div class="card stat-card"><p class="form-label">Descartados</p><h2>${discarded}</h2></div>
    </section>

    <section class="workspace-split">
      <div class="card">
        <div class="card-header">
          <div>
            <h3>${icon('filter', 16)} Bandeja por decidir</h3>
            <p>Cada ítem necesita destino y justificación. Nada llega al cliente sin las dos cosas.</p>
          </div>
          <button class="btn btn-ghost btn-sm" data-tab="ws-radar">Ir al radar</button>
        </div>
        <div class="curation-grid">
          ${pending.length
            ? pending.map((e) => renderCurationEntry(e)).join('')
            : `<p class="empty-state">
                 ${icon('check', 22)}
                 <span>Bandeja vacía. Ve al radar y envía a curación las señales que valgan la pena.</span>
               </p>`}
        </div>
      </div>

      ${renderBriefingPanel(clientId, draft, loose)}
    </section>

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Historial de entregas</h3>
          <p>Qué recibió el cliente y cuándo.</p>
        </div>
      </div>

      ${sent.length
        ? sent.map((pkg) => `
          <div class="delivery-summary">
            <div>
              <strong>${esc(pkg.title)}</strong>
              <p class="muted small">
                ${pkg.items.length} ítem(s) · ${new Date(pkg.sentAt || pkg.createdAt).toLocaleString('es')}
              </p>
              ${pkg.strategicNote ? `<p class="muted small">"${esc(pkg.strategicNote)}"</p>` : ''}
            </div>
            <span class="badge ${pkg.status === 'ACKNOWLEDGED' ? 'badge-ready' : 'badge-progress'}">
              ${pkg.status === 'ACKNOWLEDGED' ? 'Visto' : 'Enviado'}
            </span>
          </div>
        `).join('')
        : '<p class="empty-state">Sin entregas enviadas todavía.</p>'}
    </section>
  `;
}

// ==========================================
// Posicionamiento
// ==========================================

function renderPositioning(client: Client, theses: PositioningThesis[]): string {
  const clientId = client.id;
  const thesis = theses.find((t) => t.status === 'ACTIVE') || theses[0];
  const profile = dbService.getMasterProfile(clientId);
  const campaigns = dbService.getCampaignsByClient(clientId);
  const evidence = dbService.getEvidenceVaultByClient(clientId);
  const dossier = dbService.getMasterDossier(clientId);

  return `
    ${dossier ? renderMasterDossierPanel(dossier, client) : ''}

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Tesis de posicionamiento</h3>
          <p style="font-size: 0.9rem;">El filtro maestro que define qué temas se publican y ante quién.</p>
        </div>
        ${thesis
          ? `<span class="badge ${thesis.clientApprovalStatus === 'APPROVED' ? 'badge-ready' : 'badge-pending'}">
               ${esc(thesis.status)} · ${thesis.clientApprovalStatus === 'APPROVED' ? 'aprobada' : 'pendiente del cliente'}
             </span>`
          : ''}
      </div>

      ${thesis
        ? `
          <div class="grid-2">
            <div class="field-block">
              <label class="form-label">Identidad experta</label>
              <p>${esc(thesis.expertIdentity)}</p>
            </div>
            <div class="field-block">
              <label class="form-label">Audiencia primaria</label>
              <p>${esc(thesis.targetAudience)}</p>
            </div>
            <div class="field-block">
              <label class="form-label">Dominio</label>
              <p>${esc(thesis.domain)}</p>
            </div>
            <div class="field-block">
              <label class="form-label">Objetivo</label>
              <p>${esc(thesis.objective)}</p>
            </div>
          </div>

          <div class="field-block">
            <label class="form-label">Proof points (${thesis.proofPoints.length})</label>
            ${thesis.proofPoints.length
              ? `<ul class="policy-list">${thesis.proofPoints.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
              : '<p class="warn-strip">Sin proof points: la tesis promete más de lo que puede respaldar.</p>'}
          </div>

          ${thesis.differentiator ? `
            <div class="field-block">
              <label class="form-label">Diferenciador</label>
              <p>${esc(thesis.differentiator)}</p>
            </div>` : ''}

          <div class="field-block">
            <label class="form-label">Límites deontológicos</label>
            <p>${esc(thesis.complianceRules || 'Sin límites declarados.')}</p>
          </div>

          <button class="btn btn-secondary btn-sm btn-edit-thesis"
                  data-client-id="${esc(clientId)}" data-thesis-id="${esc(thesis.id)}">
            Editar tesis
          </button>
        `
        : '<p class="empty-state">Sin tesis registrada. Créala para activar el radar y el scoring.</p>'}
    </section>

    ${renderRecommendedSources(client, thesis, profile)}

    ${renderProofWall(clientId, { editable: true })}
    ${renderServiceLinesReadOnly(clientId)}

    <section class="workspace-split">
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Perfil maestro</h3>
            <p style="font-size: 0.9rem;">Contexto que alimenta la voz de todo el contenido.</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-open-onboarding" data-client-id="${esc(clientId)}">
            Abrir asistente
          </button>
        </div>

        <p class="muted">Completitud: <strong>${client.profileCompleteness || 0}%</strong> · onboarding ${esc(client.onboardingStatus)}</p>

        ${profile
          ? `
            <div class="field-block">
              <label class="form-label">Objetivo principal</label>
              <p>${esc(profile.goals.primaryGoal || 'sin definir')}</p>
            </div>
            <div class="field-block">
              <label class="form-label">Audiencia declarada</label>
              <p>${esc(profile.audience.targetAudienceDescription || 'sin definir')}</p>
            </div>
            <div class="field-block">
              <label class="form-label">Tono preferido</label>
              <p>${esc(profile.voicePreferences.tone)}</p>
            </div>
            ${profile.education.length
              ? `<div class="field-block">
                   <label class="form-label">Formación</label>
                   <ul class="policy-list">${profile.education.map((e) => `<li>${esc(e.degree)}${e.institution ? ` — ${esc(e.institution)}` : ''}</li>`).join('')}</ul>
                 </div>`
              : ''}
          `
          : '<p class="empty-state">El cliente aún no ha completado el perfil.</p>'}
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h3>Evidence vault</h3>
            <p style="font-size: 0.9rem;">Respaldo verificable de cada afirmación pública.</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-add-evidence-vault" data-client-id="${esc(clientId)}">
            + Evidencia
          </button>
        </div>

        ${evidence.length
          ? evidence.slice(0, 8).map((item) => `
            <div class="evidence-row">
              <div>
                <span class="badge badge-progress">${esc(item.type)}</span>
                <strong>${esc(item.title)}</strong>
                <p class="muted small">${esc(item.snippet)}</p>
              </div>
              <span class="badge ${item.verified ? 'badge-ready' : 'badge-pending'}">
                ${item.verified ? 'Verificada' : 'Sin verificar'}
              </span>
            </div>
          `).join('')
          : '<p class="empty-state">Vault vacío. Sin evidencia no se pueden sostener afirmaciones públicas.</p>'}
      </div>
    </section>

    ${campaigns.length
      ? `<section class="card">
           <div class="card-header">
             <div>
               <h3>Campañas</h3>
               <p style="font-size: 0.9rem;">Progreso de entregables comprometidos.</p>
             </div>
           </div>
           ${campaigns.map((c) => {
             const pct = c.targetDeliverables ? Math.round((c.completedDeliverables / c.targetDeliverables) * 100) : 0;
             return `
               <div class="campaign-block">
                 <div class="campaign-block-head">
                   <strong>${esc(c.name)}</strong>
                   <span class="muted">${c.completedDeliverables}/${c.targetDeliverables}</span>
                 </div>
                 <p class="muted small">${esc(c.description)}</p>
                 <div class="progress-track"><div class="progress-fill" style="width: ${pct}%"></div></div>
               </div>
             `;
           }).join('')}
         </section>`
      : ''}
  `;
}

// ==========================================
// Fuentes (ingesta por cliente)
// ==========================================

function renderRecommendedSources(
  client: Client,
  thesis: PositioningThesis | undefined,
  profile: ReturnType<typeof dbService.getMasterProfile>
): string {
  const clientId = client.id;
  const suggestions = getSourceSuggestions(client, thesis);
  const activeSources = dbService.getSourcesByClient(clientId).filter((s) => s.status === 'ACTIVE').length;

  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h3>Fuentes recomendadas</h3>
          <p style="font-size: 0.9rem;">
            Orígenes de información derivados de la tesis y el perfil. Regístralos en Fuentes para alimentar el radar.
          </p>
        </div>
        <button class="link-btn" data-tab="ws-sources">Ir a Fuentes →</button>
      </div>

      ${thesis
        ? `<div class="grid-2" style="margin-bottom: 1rem;">
             <div class="field-block">
               <label class="form-label">Tesis activa</label>
               <p><strong>${esc(thesis.title)}</strong> · ${esc(thesis.domain)}</p>
               <p class="muted small">Audiencia: ${esc(thesis.targetAudience)}</p>
             </div>
             ${profile?.audience.targetIndustries?.length
               ? `<div class="field-block">
                    <label class="form-label">Industrias objetivo</label>
                    <p>${esc(profile.audience.targetIndustries.join(', '))}</p>
                  </div>`
               : ''}
           </div>`
        : `<p class="warn-strip">
             Sin tesis activa. Define el posicionamiento antes de elegir fuentes.
             <button class="link-btn" data-tab="ws-positioning">Ir a Posicionamiento</button>
           </p>`}

      <div class="field-block">
        <label class="form-label">Sugerencias según perfil</label>
        <ul class="policy-list">
          ${suggestions.map((s) => `<li>${esc(s.label)} <span class="muted small">(${esc(s.type)})</span></li>`).join('')}
        </ul>
      </div>

      <p class="muted small">
        ${activeSources
          ? `${activeSources} fuente(s) activa(s) registrada(s) para este cliente.`
          : 'Aún no hay fuentes registradas.'}
      </p>
    </section>
  `;
}

function renderSources(client: Client, thesis?: PositioningThesis): string {
  const clientId = client.id;
  const sources = dbService.getSourcesByClient(clientId);
  const signalsFromSources = dbService.getSignalsByClient(clientId).filter((s) => s.sourceId).length;

  return `
    <div class="info-strip">
      <span>
        Operación de ingesta para <strong>${esc(client.displayName)}</strong>:
        registra fuentes, ejecuta la recolección automática o añade señales manuales.
        El contexto de perfil y las sugerencias están en
        <button class="link-btn" data-tab="ws-positioning">Posicionamiento</button>.
      </span>
    </div>

    ${!thesis
      ? `<p class="warn-strip">
           Sin tesis activa: el radar puntuará peor las señales.
           <button class="link-btn" data-tab="ws-positioning">Completar en Posicionamiento</button>
         </p>`
      : ''}

    <section class="grid-3">
      <div class="card stat-card">
        <p class="form-label">Fuentes activas</p>
        <h2>${sources.filter((s) => s.status === 'ACTIVE').length}</h2>
      </div>
      <div class="card stat-card">
        <p class="form-label">Señales capturadas</p>
        <h2>${signalsFromSources}</h2>
        <button class="link-btn" data-tab="ws-radar">Ver radar</button>
      </div>
      <div class="card stat-card">
        <p class="form-label">Tesis vinculada</p>
        <h2 style="font-size: 0.95rem;">${esc(thesis?.title?.slice(0, 40) || 'Sin definir')}${thesis && thesis.title.length > 40 ? '…' : ''}</h2>
        <button class="link-btn" data-tab="ws-positioning">Ver posicionamiento</button>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Ingesta manual</h3>
          <p style="font-size: 0.9rem;">Nota, enlace o clip que el cliente te envió fuera de los feeds.</p>
        </div>
      </div>
      <p class="muted" style="margin-bottom: 0.75rem;">
        Las señales manuales entran al radar con el mismo flujo: puntuar → curar → entregar.
      </p>
      <button id="btn-add-manual-signal-inline" class="btn btn-primary" data-client-id="${esc(clientId)}">
        + Registrar señal manual
      </button>
    </section>

    ${renderDiscoveryPanel(client, thesis)}

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Fuentes registradas para este cliente</h3>
          <p style="font-size: 0.9rem;">Ingesta automática. Cada corrida filtra por perfil antes de crear señales.</p>
        </div>
      </div>

      ${sources.length
        ? sources.map((s) => renderSourceRow(s, clientId)).join('')
        : `<p class="empty-state">
             Este cliente no tiene fuentes todavía.
             Activa las sugerencias de arriba o registra una manualmente.
           </p>`}
    </section>
  `;
}

function renderSourceRow(source: Source, clientId: string): string {
  const linkedSignals = dbService.getSignalsByClient(clientId).filter((sig) => sig.sourceId === source.id).length;
  const isQuery = (source.url || '').includes('news.google.com/rss/search');
  const lastRun = source.lastFetchedAt ? new Date(source.lastFetchedAt).toLocaleString('es') : null;

  const statusBadge = source.status === 'ERROR'
    ? '<span class="badge badge-danger">ERROR</span>'
    : `<span class="badge ${source.status === 'ACTIVE' ? 'badge-ready' : 'badge-pending'}">${esc(source.status)}</span>`;

  return `
    <div class="source-row ${source.status === 'ERROR' ? 'source-row-error' : ''}">
      <div style="min-width: 260px; flex: 1;">
        <strong>${esc(source.name)}</strong>
        <span class="badge badge-progress">${esc(source.type)}</span>
        ${isQuery ? '<span class="badge badge-progress">CONSULTA</span>' : ''}
        ${statusBadge}
        <p class="form-label" style="word-break: break-all;">
          ${esc((source.url || 'Entrada manual').slice(0, 110))}${(source.url || '').length > 110 ? '…' : ''}
        </p>
        <p class="muted small">
          cada ${source.fetchIntervalMinutes} min · ${linkedSignals} señal(es) acumulada(s)
          ${lastRun ? ` · última corrida ${esc(lastRun)}` : ' · sin correr todavía'}
        </p>
        ${source.lastRunFetched !== undefined
          ? `<p class="muted small">
               Última corrida: ${source.lastRunFetched} leída(s), <strong>${source.lastRunAccepted || 0} aceptada(s)</strong>,
               ${source.lastRunRejected || 0} filtrada(s) por ruido
             </p>`
          : ''}
        ${source.lastError ? `<p class="source-error-text">Fallo: ${esc(source.lastError)}</p>` : ''}
      </div>
      <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
        ${source.url ? `<button class="btn btn-secondary btn-sm btn-poll-one-source" data-source-id="${esc(source.id)}">Ingerir ahora</button>` : ''}
      </div>
    </div>
  `;
}

function renderDiscoveryPanel(client: Client, thesis?: PositioningThesis): string {
  const clientId = client.id;
  const existing = new Set(dbService.getSourcesByClient(clientId).map((s) => (s.url || '').toLowerCase()));
  const candidates = discoverSources(client, thesis);
  const pending = candidates.filter((c) => !existing.has(c.url.toLowerCase()));
  const keywords = buildProfileKeywords(client, thesis);
  const terms = [...keywords.coreEn, ...keywords.coreEs];

  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h3>Descubrimiento automático por perfil</h3>
          <p style="font-size: 0.9rem;">
            Consultas y feeds derivados de la tesis y el dossier de ${esc(client.displayName)}.
            Cobertura bilingüe: EE.UU. e inglés, México y español.
          </p>
        </div>
        ${pending.length
          ? `<button id="btn-add-all-discovered" class="btn btn-primary btn-sm" data-client-id="${esc(clientId)}">
               Activar ${pending.length} e ingerir
             </button>`
          : '<span class="badge badge-ready">Todas activas</span>'}
      </div>

      ${terms.length
        ? `<div class="field-block">
             <label class="form-label">Términos detectados en el perfil</label>
             <div class="discovery-terms">
               ${terms.map((t) => `<span class="discovery-term">${esc(t)}</span>`).join('')}
             </div>
           </div>`
        : `<p class="warn-strip">
             No se pudieron derivar términos. Completa el dominio de la tesis en
             <button class="link-btn" data-tab="ws-positioning">Posicionamiento</button>.
           </p>`}

      ${pending.length
        ? pending.map((c) => `
            <div class="discovery-row">
              <div style="min-width: 240px; flex: 1;">
                <strong>${esc(c.name)}</strong>
                <span class="badge ${c.kind === 'OFFICIAL' ? 'badge-ready' : 'badge-progress'}">
                  ${c.kind === 'OFFICIAL' ? 'OFICIAL' : 'CONSULTA'}
                </span>
                <p class="muted small">${esc(c.rationale)}</p>
              </div>
              <button class="btn btn-secondary btn-sm btn-add-discovered-source"
                      data-client-id="${esc(clientId)}"
                      data-discovery-key="${esc(c.key)}">
                Activar
              </button>
            </div>
          `).join('')
        : `<p class="muted small">
             Las ${candidates.length} fuentes propuestas ya están registradas. Pulsa <strong>Ingerir todas</strong> para traer novedades.
           </p>`}
    </section>
  `;
}

// ==========================================
// Tareas asignadas al cliente
// ==========================================

function renderTasks(client: Client): string {
  const clientId = client.id;
  const allTasks = dbService.getTasksByClient(clientId);
  const openTasks = allTasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
  const doneTasks = allTasks.filter((t) => t.status === 'COMPLETED');

  return `
    <div class="info-strip">
      <span>
        Las tareas que asignes aquí aparecen de inmediato en el portal de <strong>${esc(client.displayName)}</strong>
        (Mis tareas). Las que nacen de un briefing muestran su procedencia y el motivo original.
      </span>
      <button class="btn btn-ghost btn-sm" data-tab="ws-deliver">Ir a Entregar</button>
    </div>

    <section class="grid-3">
      <div class="card stat-card">
        <p class="form-label">Abiertas</p>
        <h2>${openTasks.length}</h2>
      </div>
      <div class="card stat-card">
        <p class="form-label">Completadas</p>
        <h2>${doneTasks.length}</h2>
      </div>
      <div class="card stat-card">
        <p class="form-label">Total histórico</p>
        <h2>${allTasks.length}</h2>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Pendientes del cliente</h3>
          <p style="font-size: 0.9rem;">Lo que debe hacer ahora mismo.</p>
        </div>
      </div>

      ${openTasks.length
        ? openTasks.map((task) => renderTaskRow(task, true)).join('')
        : `<p class="empty-state">
             No hay tareas abiertas. Pulsa <strong>+ Asignar tarea</strong> arriba para crear una.
           </p>`}
    </section>

    ${doneTasks.length
      ? `<section class="card">
           <div class="card-header">
             <div>
               <h3>Completadas recientemente</h3>
             </div>
           </div>
           ${doneTasks.slice(0, 8).map((task) => renderTaskRow(task, false)).join('')}
         </section>`
      : ''}
  `;
}

/**
 * Cierra el círculo del flujo: muestra de qué ítem curado y de qué briefing
 * nació la tarea, junto con la justificación que se escribió al decidirlo.
 */
function renderTaskProvenance(task: Task): string {
  const entry = task.curationEntryId ? dbService.getCurationById(task.curationEntryId) : undefined;
  const pkg = task.deliveryPackageId ? dbService.getDeliveryById(task.deliveryPackageId) : undefined;
  if (!entry && !pkg) return '';

  const stage = entry
    ? deriveWorkStage({ entry, pkg, task })
    : task.status === 'COMPLETED' ? 'completado' : 'entregado';

  return `
    <div class="task-provenance">
      <span class="badge ${WORK_STAGE_BADGE[stage]}">${WORK_STAGE_LABELS[stage]}</span>
      ${pkg ? `<span class="muted small">${icon('send', 12)} ${esc(pkg.title)}</span>` : ''}
      ${entry?.managerRationale
        ? `<p class="task-provenance-why"><strong>Por qué se pidió:</strong> ${esc(entry.managerRationale)}</p>`
        : ''}
      ${entry?.sourceUrl
        ? `<a class="small" href="${esc(entry.sourceUrl)}" target="_blank" rel="noopener noreferrer">Ver fuente original</a>`
        : ''}
    </div>
  `;
}

function renderTaskRecording(task: Task): string {
  if (task.type !== 'RECORD_VIDEO' || !task.evidenceUrl?.startsWith('indexeddb:')) return '';
  const recordingTaskId = task.evidenceUrl.replace('indexeddb:', '');
  return `
    <div class="task-recording-block" data-recording-task-id="${esc(recordingTaskId)}">
      <video
        class="task-recording-video"
        controls
        playsinline
        preload="metadata"
        data-task-id="${esc(recordingTaskId)}"
      ></video>
      <div class="task-recording-actions">
        <button type="button" class="btn btn-secondary btn-sm btn-download-recording" data-task-id="${esc(recordingTaskId)}">
          Descargar video
        </button>
        <label class="btn btn-ghost btn-sm btn-reupload-recording">
          Re-subir versión
          <input
            type="file"
            accept="video/*"
            class="sr-only input-reupload-recording"
            data-task-id="${esc(recordingTaskId)}"
          />
        </label>
      </div>
      ${task.clientNotes ? `<p class="muted small">${esc(task.clientNotes)}</p>` : ''}
    </div>
  `;
}

function renderTaskRow(task: Task, showActions: boolean): string {
  const overdue = task.deadline && new Date(task.deadline).getTime() < Date.now();
  return `
    <div class="task-row ${overdue ? 'task-overdue' : ''}">
      <div class="task-row-main">
        <div class="task-row-title">
          <span class="badge badge-progress">${TASK_TYPE_LABELS[task.type]}</span>
          <strong>${esc(task.title)}</strong>
          <span class="badge ${task.status === 'COMPLETED' ? 'badge-ready' : 'badge-pending'}">
            ${TASK_STATUS_LABELS[task.status]}
          </span>
        </div>
        <p class="task-row-desc">${esc(task.description)}</p>
        <p class="muted small">
          ~${task.estimatedMinutes} min
          ${task.deadline ? ` · límite ${new Date(task.deadline).toLocaleDateString('es')}` : ''}
          ${task.completedAt ? ` · completada ${new Date(task.completedAt).toLocaleDateString('es')}` : ''}
        </p>
        ${renderTaskProvenance(task)}
        ${renderTaskRecording(task)}
      </div>
      ${showActions
        ? `<div class="task-row-actions">
             <button class="btn btn-secondary btn-sm btn-cancel-task" data-task-id="${esc(task.id)}">Cancelar</button>
           </div>`
        : ''}
    </div>
  `;
}

// ==========================================
// Resultados
// ==========================================

function renderResults(client: Client): string {
  const results = dbService.getResultsByClient(client.id);

  return `
    ${renderKpiSummaryTiles(client.id)}
    ${renderKpiWeeklyChart(client.id, 'KPIs semanales — cliente')}

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Resultados registrados</h3>
          <p style="font-size: 0.9rem;">Métricas de publicaciones y apariciones. Alimentan el diagnóstico de imagen.</p>
        </div>
      </div>

      ${results.length
        ? results.map((r) => `
          <div class="result-row">
            <div>
              <strong>${esc(r.title)}</strong>
              <p class="muted small">${esc(r.channel)} · ${new Date(r.createdAt).toLocaleDateString('es')}</p>
              ${r.notes ? `<p class="muted small">${esc(r.notes)}</p>` : ''}
            </div>
            <div class="result-metric">
              <span class="result-value">${r.metricValue}</span>
              <span class="muted small">${esc(r.metricLabel)}</span>
            </div>
            ${r.addedToEvidence
              ? '<span class="badge badge-ready">En vault</span>'
              : `<button class="btn btn-secondary btn-sm btn-result-to-evidence" data-result-id="${esc(r.id)}">A evidencia</button>`}
          </div>
        `).join('')
        : '<p class="empty-state">Sin resultados registrados. El cliente puede añadirlos desde su portal.</p>'}
    </section>
  `;
}

export { DESTINATION_LABELS };
