import { authService } from '../services/auth';
import { FIREBASE_ENABLED, readFirebaseConfig } from '../firebase/config';
import { aiService } from '../services/ai';
import { dbService } from '../services/db';
import { mapOpportunityLifecycle } from '../domain/opportunityLifecycle';
import { notificationService } from '../services/notifications';
import { esc } from '../lib/escape';
import { icon } from '../lib/icons';
import { isWorkspaceTab, normalizeTab } from '../ui/presentation/pageTabMeta';
import { computeProfileCoverage } from '../domain/profileCoverage';

type NavItem = { id: string; label: string; icon: string; badge?: number };

function renderNavGroup(label: string, items: NavItem[], activeTab: string): string {
  return `
    <div class="sidebar-group">
      <p class="sidebar-group-label">${esc(label)}</p>
      <div class="sidebar-links">
        ${items.map(({ id, label: itemLabel, icon: iconName, badge }) => `
          <button type="button" class="sidebar-link ${activeTab === id ? 'active' : ''}" data-tab="${esc(id)}"
            ${activeTab === id ? 'aria-current="page"' : ''}>
            ${icon(iconName)}
            <span>${esc(itemLabel)}</span>
            ${badge ? `<span class="sidebar-badge">${badge}</span>` : ''}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function portfolioNav(activeTab: string): string {
  const pendingClients = dbService.getPortfolioSummary().filter((s) => s.attentionScore > 0).length;
  return `
    ${renderNavGroup('Cartera', [
      { id: 'dashboard', label: 'Hoy', icon: 'home', badge: pendingClients },
      { id: 'clients', label: 'Clientes', icon: 'users' },
    ], activeTab)}
    ${renderNavGroup('Sistema', [
      { id: 'ai-center', label: 'IA y operación', icon: 'sparkles' },
    ], activeTab)}
  `;
}

function workspaceNav(activeTab: string, clientId: string): string {
  const pendingCuration = dbService.getPendingCurationByClient(clientId).length;
  const draftItems = dbService.getDraftDelivery(clientId)?.items.length || 0;
  const unreviewed = dbService
    .getSignalsByClient(clientId)
    .filter((s) => s.managerDecision === 'UNREVIEWED' && s.status !== 'DISCARDED').length;
  const sourceErrors = dbService.getSourcesByClient(clientId).filter((source) => source.status === 'ERROR').length;
  const openTasks = dbService.getTasksByClient(clientId).filter(
    (t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
  ).length;
  const inProduction = dbService.getContentByClient(clientId).filter(
    (c) => c.status !== 'PUBLISHED'
  ).length;

  return `
    ${renderNavGroup('Flujo de trabajo', [
      { id: 'ws-briefing', label: 'Resumen', icon: 'clipboard' },
      { id: 'ws-radar', label: 'Radar', icon: 'radar', badge: unreviewed },
      { id: 'ws-deliver', label: 'Entregar', icon: 'send', badge: pendingCuration + draftItems || undefined },
      { id: 'ws-production', label: 'Producción', icon: 'film', badge: inProduction + openTasks || undefined },
    ], activeTab)}
    ${renderNavGroup('Contexto', [
      { id: 'ws-positioning', label: 'Identidad', icon: 'target' },
      ...(sourceErrors ? [{ id: 'ws-sources', label: 'Fuentes con alerta', icon: 'rss', badge: sourceErrors }] : []),
    ], activeTab)}
  `;
}

function clientNav(activeTab: string, clientId?: string | null): string {
  const openTasks = clientId
    ? dbService.getTasksByClient(clientId).filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length
    : 0;
  const pendingContent = clientId
    ? dbService.getContentByClient(clientId).filter((c) => c.status === 'CLIENT_REVIEW').length
    : 0;
  const openOpps = clientId
    ? dbService.getOpportunitiesByClient(clientId).filter((o) => {
        if (o.status === 'ARCHIVED') return false;
        const stage = mapOpportunityLifecycle(o);
        return stage === 'proposed' || stage === 'checklist' || stage === 'accepted';
      }).length
    : 0;
  const profileCoverage = clientId ? computeProfileCoverage(dbService.getMasterProfile(clientId)) : null;
  const profileIncomplete = profileCoverage && !profileCoverage.meetsPilotThreshold ? 1 : undefined;

  return `
    ${renderNavGroup('Mi semana', [
      { id: 'client-home', label: 'Esta semana', icon: 'home', badge: openTasks || undefined },
      { id: 'client-content', label: 'Revisar', icon: 'fileText', badge: pendingContent || undefined },
      { id: 'client-opps', label: 'Oportunidades', icon: 'briefcase', badge: openOpps || undefined },
    ], activeTab)}
    ${renderNavGroup('Mi trayectoria', [
      { id: 'client-profile', label: 'Mi perfil', icon: 'users', badge: profileIncomplete },
      { id: 'client-thesis', label: 'Mi posicionamiento', icon: 'target' },
      { id: 'client-results', label: 'Resultados', icon: 'chart' },
    ], activeTab)}
  `;
}

/**
 * Barra persistente del briefing: funciona como carrito, visible en todo el
 * espacio de trabajo para no obligar a volver a la pestaña de entrega.
 */
export function renderBriefingBar(activeTab: string, clientId: string): string {
  const draft = dbService.getDraftDelivery(clientId);
  if (!draft || !draft.items.length) return '';
  if (normalizeTab(activeTab) === 'ws-deliver') return '';

  return `
    <div class="briefing-bar" role="status">
      <div class="briefing-bar-info">
        ${icon('inbox', 17)}
        <span class="briefing-bar-title">${esc(draft.title)}</span>
        <span class="badge badge-accent">${draft.items.length} ítem${draft.items.length === 1 ? '' : 's'}</span>
      </div>
      <div class="briefing-bar-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-tab="ws-deliver">Revisar</button>
        <button type="button" id="btn-send-delivery-bar" class="btn btn-primary btn-sm"
          data-package-id="${esc(draft.id)}">
          ${icon('send', 15)} Enviar
        </button>
      </div>
    </div>
  `;
}

export function renderAppShell(
  activeTab: string,
  activeClientId: string = 'all',
  activeCampaignId: string | null = null,
  selectedThesisId: string | null = null
): string {
  const user = authService.getCurrentUser();
  if (!user) return '';

  const gatewayAi = aiService.isServerGatewayAvailable();
  const isAdmin = user.role === 'ADMIN';
  const unread = notificationService.unreadCount(user.uid, user.clientId);
  const clientIdForCampaign = !isAdmin ? user.clientId : (activeClientId !== 'all' ? activeClientId : null);
  const clientCampaigns = clientIdForCampaign ? dbService.getCampaignsByClient(clientIdForCampaign) : [];
  const clientTheses = clientIdForCampaign ? dbService.getThesesByClient(clientIdForCampaign) : [];
  const viewableTheses = clientTheses.filter((t) => t.status === 'ACTIVE' || t.status === 'UNDER_REVIEW');
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  const inWorkspace = isAdmin && activeClientId !== 'all' && isWorkspaceTab(activeTab);
  const workspaceClient = inWorkspace ? dbService.getClientById(activeClientId) : null;

  let sidebarNav: string;
  if (!isAdmin) sidebarNav = clientNav(activeTab, user.clientId);
  else if (inWorkspace && workspaceClient) sidebarNav = workspaceNav(activeTab, activeClientId);
  else sidebarNav = portfolioNav(activeTab);

  const breadcrumb = !isAdmin
    ? `<span class="breadcrumb-root">Mi espacio</span>`
    : inWorkspace && workspaceClient
      ? `<button type="button" class="breadcrumb-link" data-go-portfolio="1">Cartera</button>
         <span class="breadcrumb-sep">/</span>
         <span class="breadcrumb-current">${esc(workspaceClient.displayName)}</span>`
      : `<span class="breadcrumb-root">Cartera</span>`;

  const firebaseCfg = FIREBASE_ENABLED ? readFirebaseConfig() : null;
  const firebaseBadge = firebaseCfg
    ? `<span class="status-pill status-on" title="Backend Firebase activo">${firebaseCfg.useEmulators ? 'Firebase · Emulator' : `Firebase · ${esc(firebaseCfg.projectId)}`}</span>`
    : '';

  return `
    <aside class="sidebar" aria-label="Navegación principal">
      ${inWorkspace && workspaceClient
        ? `
          <div class="sidebar-client">
            <button type="button" class="sidebar-back" data-go-portfolio="1">
              ${icon('arrowLeft', 15)}<span>Volver a cartera</span>
            </button>
            <div class="sidebar-client-card">
              <div class="user-avatar" aria-hidden="true">${esc(workspaceClient.displayName.slice(0, 2).toUpperCase())}</div>
              <div class="sidebar-client-meta">
                <span class="sidebar-client-name">${esc(workspaceClient.displayName)}</span>
                <span class="sidebar-client-role">${esc(workspaceClient.profession || 'Cliente')}</span>
              </div>
            </div>
          </div>
        `
        : `
          <div class="sidebar-brand">
            <span class="brand-mark" aria-hidden="true">P</span>
            <span class="sidebar-brand-text">
              <span class="brand-logo">POSTURA</span>
              <span class="sidebar-role">${isAdmin ? 'Cockpit del manager' : 'Portal del cliente'}</span>
            </span>
          </div>
        `}

      <nav class="sidebar-nav">
        ${sidebarNav}
      </nav>

      <div class="sidebar-footer">
        <span class="sidebar-footnote">${isAdmin ? 'Brand Manager' : 'Cliente'}</span>
      </div>
    </aside>

    <header class="topbar">
      <nav class="breadcrumb" aria-label="Ubicación">${breadcrumb}</nav>

      <div class="topbar-right">
        ${!isAdmin && clientCampaigns.length > 1 ? `
          <label class="campaign-filter-label">
            <span class="sr-only">Campaña activa</span>
            <select id="client-campaign-filter" class="form-select form-select-sm">
              ${clientCampaigns.map((c) => `
                <option value="${esc(c.id)}" ${c.id === activeCampaignId ? 'selected' : ''}>${esc(c.name)}</option>
              `).join('')}
            </select>
          </label>
        ` : ''}
        ${!isAdmin && viewableTheses.length > 1 ? `
          <label class="campaign-filter-label">
            <span class="sr-only">Tesis activa</span>
            <select id="client-thesis-filter" class="form-select form-select-sm">
              <option value="">Todas las tesis</option>
              ${viewableTheses.map((t) => `
                <option value="${esc(t.id)}" ${t.id === selectedThesisId ? 'selected' : ''}>${esc(t.title)}</option>
              `).join('')}
            </select>
          </label>
        ` : ''}
        ${firebaseBadge}
        <span class="status-pill ${gatewayAi ? 'status-on' : 'status-off'}" title="Estado del AI Gateway">
          IA ${gatewayAi ? 'Gateway' : 'local'}
        </span>

        <span class="topbar-divider" aria-hidden="true"></span>

        <button type="button" id="btn-toggle-theme" class="icon-btn"
          title="${isLight ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}"
          aria-label="${isLight ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}">
          ${icon(isLight ? 'moon' : 'sun')}
        </button>
        <button type="button" id="btn-open-notifications" class="icon-btn" title="Notificaciones"
          aria-label="Notificaciones${unread ? `: ${unread} sin leer` : ''}">
          ${icon('bell')}
          ${unread ? `<span class="icon-btn-dot">${unread > 9 ? '9+' : unread}</span>` : ''}
        </button>

        <div class="topbar-user">
          <div class="user-avatar" aria-hidden="true">${esc((user.displayName || 'U').slice(0, 2).toUpperCase())}</div>
          <div class="topbar-user-meta">
            <span class="topbar-user-name">${esc(user.displayName || user.email)}</span>
            <span class="role-pill ${isAdmin ? 'admin' : 'client'}">${isAdmin ? 'Manager' : 'Cliente'}</span>
          </div>
        </div>
        <div class="topbar-actions">
          ${isAdmin && !FIREBASE_ENABLED
            ? `<button type="button" id="btn-toggle-role" class="btn btn-ghost btn-sm">Vista cliente</button>`
            : isAdmin && FIREBASE_ENABLED
              ? `<span class="muted small topbar-firebase-hint" title="Con Firebase activo, inicia sesión como cliente para ver su portal">Firebase · sin impersonación local</span>`
              : authService.isImpersonating()
              ? `<button type="button" id="btn-return-manager" class="btn btn-ghost btn-sm">Volver al cockpit</button>`
              : ''}
          <button type="button" id="btn-logout" class="icon-btn" title="Salir" aria-label="Cerrar sesión">
            ${icon('logout')}
          </button>
        </div>
      </div>
    </header>
  `;
}
