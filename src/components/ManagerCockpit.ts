import { dbService } from '../services/db';
import { aiService } from '../services/ai';
import { FIREBASE_ENABLED } from '../firebase/config';
import { ClientPortfolioSummary, ContentItem } from '../types';
import { esc } from '../lib/escape';
import { renderPage } from './PageHeader';

export function renderManagerCockpit(
  activeTab: string,
  filters: { searchQuery?: string; sourceType?: string; contentStatus?: string } = {}
): string {
  switch (activeTab) {
    case 'clients':
      return renderPage(
        'clients',
        renderClientsBody(),
        `${FIREBASE_ENABLED ? '<button id="btn-firebase-push-local" class="btn btn-secondary">Subir local → Firestore</button>' : ''}
         <button id="btn-open-create-client" class="btn btn-primary">+ Nuevo cliente</button>`
      );
    case 'ai-center':
      return renderPage('ai-center', renderAICenterBody());
    case 'dashboard':
    default:
      return renderPage('dashboard', renderPortfolioBody(filters));
  }
}

// ==========================================
// Nivel 1: cartera
// ==========================================

function attentionLevel(score: number): { label: string; cls: string } {
  if (score >= 45) return { label: 'Requiere acción', cls: 'attention-high' };
  if (score >= 20) return { label: 'Revisar pronto', cls: 'attention-medium' };
  if (score > 0) return { label: 'Menor', cls: 'attention-low' };
  return { label: 'Al día', cls: 'attention-ok' };
}

function renderClientTriageCard(summary: ClientPortfolioSummary): string {
  const { client } = summary;
  const level = attentionLevel(summary.attentionScore);
  const lastDelivery = summary.lastDeliveryAt
    ? new Date(summary.lastDeliveryAt).toLocaleDateString('es', { day: '2-digit', month: 'short' })
    : 'nunca';

  return `
    <article class="triage-card ${level.cls}">
      <header class="triage-head">
        <div class="triage-identity">
          <div class="user-avatar" aria-hidden="true">${esc(client.displayName.slice(0, 2).toUpperCase())}</div>
          <div>
            <h3 class="triage-name">${esc(client.displayName)}</h3>
            <p class="triage-role">${esc(client.profession || 'Sin profesión registrada')}</p>
          </div>
        </div>
        <span class="attention-tag">${level.label}</span>
      </header>

      <div class="triage-metrics">
        <div><span class="triage-metric-value">${summary.unreviewedSignals}</span><span class="triage-metric-label">señales sin revisar</span></div>
        <div><span class="triage-metric-value">${summary.pendingCuration}</span><span class="triage-metric-label">en curación</span></div>
        <div><span class="triage-metric-value">${summary.contentAwaitingManager}</span><span class="triage-metric-label">contenido para ti</span></div>
        <div><span class="triage-metric-value">${summary.overdueTasks}</span><span class="triage-metric-label">tareas vencidas</span></div>
      </div>

      ${summary.attentionReasons.length
        ? `<ul class="triage-reasons">${summary.attentionReasons.slice(0, 3).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`
        : '<p class="triage-clear">Sin pendientes abiertos.</p>'}

      <footer class="triage-foot">
        <span class="triage-last">Última entrega: ${esc(lastDelivery)}</span>
        <button class="btn btn-primary btn-sm btn-enter-client" data-client-id="${esc(client.id)}">
          Entrar al cliente
        </button>
      </footer>
    </article>
  `;
}

function renderPortfolioBody(filters: { searchQuery?: string } = {}): string {
  const summaries = dbService.getPortfolioSummary();
  const query = (filters.searchQuery || '').toLowerCase();
  const filtered = query
    ? summaries.filter(
        (s) =>
          s.client.displayName.toLowerCase().includes(query) ||
          (s.client.profession || '').toLowerCase().includes(query)
      )
    : summaries;

  const totals = summaries.reduce(
    (acc, s) => ({
      signals: acc.signals + s.unreviewedSignals,
      curation: acc.curation + s.pendingCuration,
      content: acc.content + s.contentAwaitingManager,
      overdue: acc.overdue + s.overdueTasks,
      drafts: acc.drafts + s.draftDeliveries,
    }),
    { signals: 0, curation: 0, content: 0, overdue: 0, drafts: 0 }
  );

  const needsAttention = summaries.filter((s) => s.attentionScore >= 20);

  return `
    ${!aiService.getConfig().hasActiveSession
      ? `<div class="info-strip">
           <span><strong>IA desconectada.</strong> El scoring y el asesor funcionan con reglas locales. Conecta claves en Centro de IA para análisis con modelo.</span>
           <button class="btn btn-secondary btn-sm" data-tab="ai-center">Conectar IA</button>
         </div>`
      : ''}

    <section class="grid-4">
      <div class="card stat-card">
        <p class="form-label">Señales sin revisar</p>
        <h2>${totals.signals}</h2>
        <span class="stat-hint">en toda la cartera</span>
      </div>
      <div class="card stat-card">
        <p class="form-label">Ítems en curación</p>
        <h2>${totals.curation}</h2>
        <span class="stat-hint">esperando tu decisión</span>
      </div>
      <div class="card stat-card">
        <p class="form-label">Contenido para revisar</p>
        <h2>${totals.content}</h2>
        <span class="stat-hint">antes de pasar al cliente</span>
      </div>
      <div class="card stat-card ${totals.overdue > 0 ? 'stat-alert' : ''}">
        <p class="form-label">Tareas vencidas</p>
        <h2>${totals.overdue}</h2>
        <span class="stat-hint">${totals.drafts} briefing(s) en borrador</span>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Clientes por prioridad</h3>
          <p style="font-size: 0.9rem;">
            ${needsAttention.length
              ? `${needsAttention.length} cliente(s) requieren tu atención. Ordenados por urgencia.`
              : 'Toda la cartera está al día.'}
          </p>
        </div>
      </div>

      <div class="filter-bar">
        <div class="search-input-group">
          <input type="text" id="input-search-portfolio" placeholder="Buscar cliente por nombre o profesión..." value="${esc(filters.searchQuery || '')}" />
        </div>
      </div>

      <div class="triage-grid">
        ${filtered.length
          ? filtered.map(renderClientTriageCard).join('')
          : '<p class="empty-state">No hay clientes que coincidan con la búsqueda.</p>'}
      </div>
    </section>
  `;
}

function renderClientsBody(): string {
  const summaries = dbService.getPortfolioSummary();
  const subscription = dbService.getSubscription();

  return `
    <section class="grid-4">
      <div class="card stat-card">
        <p class="form-label">Clientes activos</p>
        <h2>${summaries.length} / ${subscription.quotas.maxClients}</h2>
        <span class="stat-hint">Plan ${esc(subscription.tier)}</span>
      </div>
      <div class="card stat-card">
        <p class="form-label">Tesis en ejecución</p>
        <h2>${summaries.reduce((acc, s) => acc + s.client.activeThesesCount, 0)}</h2>
        <span class="stat-hint">filtros de posicionamiento activos</span>
      </div>
      <div class="card stat-card">
        <p class="form-label">Tareas completadas</p>
        <h2>${summaries.reduce((acc, s) => acc + s.client.completedTasksCount, 0)}</h2>
        <span class="stat-hint">histórico acumulado</span>
      </div>
      <div class="card stat-card">
        <p class="form-label">Corridas de IA del mes</p>
        <h2>${subscription.monthlyUsage.aiRuns} / ${subscription.quotas.maxMonthlyAiRuns}</h2>
        <span class="stat-hint">límite del plan</span>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Cartera completa</h3>
          <p style="font-size: 0.9rem;">Entra a un cliente para trabajar su radar, curación y entregas.</p>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${summaries.map(({ client }) => {
          const theses = dbService.getThesesByClient(client.id);
          const campaigns = dbService.getCampaignsByClient(client.id);
          const evidence = dbService.getEvidenceVaultByClient(client.id);
          const thesis = theses[0];

          return `
            <div class="card client-row">
              <div class="client-row-head">
                <div class="client-row-identity">
                  <div class="user-avatar user-avatar-lg" aria-hidden="true">${esc(client.displayName.slice(0, 2).toUpperCase())}</div>
                  <div>
                    <div class="client-row-title">
                      <h4>${esc(client.displayName)}</h4>
                      <span class="badge ${client.status === 'ACTIVE' ? 'badge-ready' : 'badge-pending'}">
                        <span class="badge-dot"></span>${esc(client.status)}
                      </span>
                      <span class="badge badge-progress">${evidence.length} evidencia(s)</span>
                    </div>
                    <p class="client-row-meta">
                      <strong>${esc(client.profession || 'Sin profesión')}</strong>${client.company ? ` · ${esc(client.company)}` : ''}
                    </p>
                    <p class="client-row-audience">Audiencia: ${esc(client.targetMarket || 'sin definir')}</p>
                  </div>
                </div>

                <div class="client-row-actions">
                  <button class="btn btn-secondary btn-sm btn-open-thesis-editor" data-client-id="${esc(client.id)}">Nueva tesis</button>
                  <button class="btn btn-secondary btn-sm btn-login-as-client" data-client-id="${esc(client.id)}">Ver como cliente</button>
                  <button class="btn btn-primary btn-sm btn-enter-client" data-client-id="${esc(client.id)}">Entrar</button>
                </div>
              </div>

              ${thesis
                ? `<div class="thesis-strip">
                     <div class="thesis-strip-head">
                       <strong>Tesis activa: ${esc(thesis.title)}</strong>
                       <div style="display: flex; gap: 0.4rem; align-items: center;">
                         <span class="badge ${thesis.clientApprovalStatus === 'APPROVED' ? 'badge-ready' : 'badge-pending'}">
                           ${thesis.clientApprovalStatus === 'APPROVED' ? 'Aprobada' : 'Pendiente cliente'}
                         </span>
                         <button class="btn btn-secondary btn-sm btn-edit-thesis" data-client-id="${esc(client.id)}" data-thesis-id="${esc(thesis.id)}">Editar</button>
                       </div>
                     </div>
                     <p>${esc(thesis.expertIdentity)} ante ${esc(thesis.targetAudience)} en ${esc(thesis.domain)}.</p>
                   </div>`
                : '<p class="warn-strip">Sin tesis activa. El contenido no tiene filtro estratégico todavía.</p>'}

              ${campaigns.length
                ? `<div class="campaign-strip">
                     <span>${esc(campaigns[0].name)}</span>
                     <span>${campaigns[0].completedDeliverables}/${campaigns[0].targetDeliverables} entregables</span>
                   </div>`
                : ''}
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

// ==========================================
// Pipeline editorial (compartido con el workspace)
// ==========================================

export function renderContentPipeline(
  contents: ContentItem[],
  filters: { searchQuery?: string; contentStatus?: string } = {},
  options: { showCreate?: boolean; clientId?: string } = {}
): string {
  const searchQ = (filters.searchQuery || '').toLowerCase();
  const currentStatusFilter = filters.contentStatus || 'ALL';

  const filtered = contents.filter((c) => {
    const matchesSearch = !searchQ || c.title.toLowerCase().includes(searchQ) || c.body.toLowerCase().includes(searchQ);
    const matchesStatus = currentStatusFilter === 'ALL' || c.status === currentStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusHint = (status: ContentItem['status']): string => {
    switch (status) {
      case 'CLIENT_REVIEW': return 'Esperando al cliente';
      case 'CHANGES_REQUESTED': return 'El cliente pidió ajustes';
      case 'READY': return 'Listo para publicar';
      case 'PUBLISHED': return 'Publicado';
      case 'AI_GENERATED': return 'Generado por IA, revisa antes de enviar';
      default: return 'En preparación';
    }
  };

  return `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Pipeline editorial</h3>
          <p style="font-size: 0.9rem;">Revisa y edita antes de que el material llegue al portal del cliente.</p>
        </div>
        ${options.showCreate
          ? `<button id="btn-generate-article" class="btn btn-primary" data-client-id="${esc(options.clientId || '')}">+ Nuevo contenido</button>`
          : ''}
      </div>

      <div class="filter-bar">
        <div class="search-input-group">
          <input type="text" id="input-search-content" placeholder="Buscar por título o fragmento..." value="${esc(filters.searchQuery || '')}" />
        </div>
        <div class="filter-pills">
          <span class="filter-pill ${currentStatusFilter === 'ALL' ? 'active' : ''}" data-content-filter="ALL">Todos (${contents.length})</span>
          <span class="filter-pill ${currentStatusFilter === 'AI_GENERATED' ? 'active' : ''}" data-content-filter="AI_GENERATED">Por revisar</span>
          <span class="filter-pill ${currentStatusFilter === 'CLIENT_REVIEW' ? 'active' : ''}" data-content-filter="CLIENT_REVIEW">Con el cliente</span>
          <span class="filter-pill ${currentStatusFilter === 'CHANGES_REQUESTED' ? 'active' : ''}" data-content-filter="CHANGES_REQUESTED">Ajustes pedidos</span>
          <span class="filter-pill ${currentStatusFilter === 'READY' ? 'active' : ''}" data-content-filter="READY">Listo</span>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${filtered.length
          ? filtered.map((item) => {
            const clientEdit = dbService.getLatestClientEdit(item.id);
            const showDiff = Boolean(clientEdit);
            return `
            <div class="card content-row status-${esc(item.status.toLowerCase())}">
              <div class="content-row-head">
                <div>
                  <div class="content-row-title">
                    <h4>${esc(item.title)}</h4>
                    <span class="badge ${item.status === 'READY' || item.status === 'PUBLISHED' ? 'badge-ready' : item.status === 'CHANGES_REQUESTED' ? 'badge-pending' : 'badge-progress'}">${esc(item.status)}</span>
                    <span class="badge badge-progress">${esc(item.targetPlatform)}</span>
                    ${showDiff && clientEdit?.diffSummary
                      ? `<span class="badge badge-ready">Cliente editó (+${clientEdit.diffSummary.added}/−${clientEdit.diffSummary.removed})</span>`
                      : ''}
                  </div>
                  <p class="content-row-meta">
                    ${esc(item.type)} · creado ${new Date(item.createdAt).toLocaleDateString('es')}
                  </p>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                  ${showDiff ? `<button class="btn btn-primary btn-sm btn-view-content-diff" data-content-id="${esc(item.id)}">Ver diff</button>` : ''}
                  <button class="btn btn-secondary btn-sm btn-open-content-editor" data-content-id="${esc(item.id)}">Editar</button>
                  <button class="btn btn-secondary btn-sm btn-preview-content" data-content-id="${esc(item.id)}">Ver</button>
                </div>
              </div>

              <div class="content-preview">${esc(item.body.substring(0, 280))}…</div>

              <div class="content-row-foot">
                <span>Notas: ${esc(item.managerNotes || 'sin notas')}</span>
                <span class="content-status-hint">${statusHint(item.status)}</span>
              </div>
            </div>
          `;
          }).join('')
          : '<p class="empty-state">No hay contenido con los filtros actuales.</p>'}
      </div>
    </div>
  `;
}

// ==========================================
// Configuración de la organización
// ==========================================

function renderAICenterBody(): string {
  const config = aiService.getConfig();
  const subscription = dbService.getSubscription();
  const aiRuns = dbService.getAiRuns(10);

  const tokensPercent = Math.min(100, Math.round((subscription.monthlyUsage.tokensUsed / 100000) * 100));
  const runsPercent = Math.min(100, Math.round((subscription.monthlyUsage.aiRuns / subscription.quotas.maxMonthlyAiRuns) * 100));

  return `
    <section class="grid-3">
      <div class="card stat-card">
        <p class="form-label">Corridas del mes</p>
        <h2>${subscription.monthlyUsage.aiRuns} <span class="stat-of">/ ${subscription.quotas.maxMonthlyAiRuns}</span></h2>
        <div class="progress-track"><div class="progress-fill" style="width: ${runsPercent}%"></div></div>
      </div>
      <div class="card stat-card">
        <p class="form-label">Tokens procesados</p>
        <h2>${(subscription.monthlyUsage.tokensUsed / 1000).toFixed(1)}k <span class="stat-of">/ 100k</span></h2>
        <div class="progress-track"><div class="progress-fill progress-cyan" style="width: ${tokensPercent}%"></div></div>
      </div>
      <div class="card stat-card">
        <p class="form-label">Estado de sesión</p>
        <h2>${config.hasActiveSession ? esc(config.provider) : 'Manual'}</h2>
        <span class="stat-hint">${config.hasActiveSession ? 'Claves en memoria del proxy local' : 'Sin claves: modo heurístico'}</span>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Configuración de proveedor</h3>
          <p style="font-size: 0.9rem;">Las claves viajan al proxy local y viven en memoria con caducidad de 60 minutos.</p>
        </div>
      </div>

      <div class="grid-2">
        <div class="card" style="background: var(--bg-surface);">
          <div class="form-group">
            <label class="form-label" for="ai-provider-select">Proveedor</label>
            <select id="ai-provider-select" class="form-select">
              <option value="AUTOMATIC" ${config.provider === 'AUTOMATIC' ? 'selected' : ''}>Automático (router)</option>
              <option value="OPENAI" ${config.provider === 'OPENAI' ? 'selected' : ''}>OpenAI</option>
              <option value="CLAUDE" ${config.provider === 'CLAUDE' ? 'selected' : ''}>Claude</option>
              <option value="COMPARATIVE" ${config.provider === 'COMPARATIVE' ? 'selected' : ''}>Comparativo (síntesis dual)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="ai-depth-select">Profundidad de razonamiento</label>
            <select id="ai-depth-select" class="form-select">
              <option value="deep_reasoning" ${config.modelDepth === 'deep_reasoning' ? 'selected' : ''}>Profunda</option>
              <option value="standard" ${config.modelDepth === 'standard' ? 'selected' : ''}>Estándar</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="openai-key-input">API key de OpenAI</label>
            <input type="password" id="openai-key-input" class="form-input" placeholder="sk-proj-…" />
          </div>

          <div class="form-group">
            <label class="form-label" for="claude-key-input">API key de Claude</label>
            <input type="password" id="claude-key-input" class="form-input" placeholder="sk-ant-…" />
          </div>

          <div style="display: flex; gap: 0.75rem; margin-top: 1.25rem;">
            <button id="btn-save-ai-keys" class="btn btn-primary">Activar sesión</button>
            <button id="btn-clear-ai-keys" class="btn btn-danger">Limpiar claves</button>
          </div>
        </div>

        <div class="card" style="background: var(--bg-surface); border-color: var(--border-accent);">
          <h4 style="margin-bottom: 0.75rem;">Cómo se protegen las claves</h4>
          <ul class="policy-list">
            <li>No se escriben nunca en <code>localStorage</code> ni en disco.</li>
            <li>Viven en memoria del proxy local y se destruyen al cerrar sesión.</li>
            <li>El contenido de las fuentes se marca como no confiable antes de armar el prompt.</li>
            <li>Las afirmaciones se contrastan contra el evidence vault del cliente.</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Corridas recientes</h3>
          <p style="font-size: 0.9rem;">Agente, proveedor, tokens y latencia de cada llamada.</p>
        </div>
      </div>

      <div style="overflow-x: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Hora</th><th>Agente</th><th>Proveedor</th><th>Tokens</th><th>Latencia</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${aiRuns.length
              ? aiRuns.map((run) => `
                <tr>
                  <td class="mono">${new Date(run.createdAt).toLocaleTimeString('es')}</td>
                  <td><strong>${esc(run.agent)}</strong></td>
                  <td>${esc(run.provider)} <span class="muted">(${esc(run.modelName)})</span></td>
                  <td class="mono">${run.promptTokens + run.completionTokens}</td>
                  <td class="mono">${run.latencyMs}ms</td>
                  <td><span class="badge ${run.status === 'SUCCESS' ? 'badge-ready' : 'badge-pending'}">${esc(run.status)}</span></td>
                </tr>
              `).join('')
              : '<tr><td colspan="6" class="empty-cell">Sin corridas registradas todavía.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}