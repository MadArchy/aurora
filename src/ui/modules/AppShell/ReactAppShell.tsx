/**
 * SPEC-010 · React AppShell (wave 1, T-010-111).
 *
 * Authority: presentation only. The shell renders navigation, badge counts and
 * session chrome. It issues no strategic command and stores nothing.
 *
 * Data: every read goes through a query hook → facade → (canonical consumer |
 * labelled compatibility read). This module imports neither `dbService`, nor a
 * `Local*Store`, nor Firestore, nor any AI provider.
 *
 * MULTI-THESIS: the thesis selector lists every viewable thesis and its value is
 * a pure view filter. No thesis is pre-selected as authoritative, nothing reads
 * `theses[0]`, and no ordering is treated as precedence (threat T-010-15). The
 * same holds for the campaign selector.
 *
 * Navigation is local presentation state owned by this shell in Stage B (T-010-403).
 * Legacy islands request navigation through the presentation bridge; they do not
 * own global sidebar or top-level tab authority in normal React mode.
 */

import { useEffect, useState } from 'react';
import { useSession } from '../../providers/SessionProvider';
import {
  useCanonicalOpportunities,
  useClientBadges,
  usePortfolioBadges,
  useShellContext,
  useWorkspaceBadges,
} from '../../hooks/useShellData';
import { sessionCommands } from '../../commands/commandSeam';
import { subscribeShellNavigation } from '../../legacy/navigationBridge';
import { LegacyIslandHost } from '../../legacy/LegacyIslandHost';
import { isLegacyIslandTab, isWorkspaceTab, legacyIslandTabId } from '../../legacy/shellTabs';
import { Wave2Surface, type Wave2Group } from '../wave2/Wave2Surface';
import { ReactManagerCockpitPage } from '../pages/ReactManagerCockpitPage';
import { ReactClientPortalPage, type ClientPortalTab } from '../pages/ReactClientPortalPage';
import { ReactClientWorkspacePage, type WorkspaceTab } from '../pages/ReactClientWorkspacePage';
import { normalizeTab } from '../../presentation/pageTabMeta';

/**
 * Which wave-2 component group, if any, belongs to a tab. A tab with no entry
 * has no migrated component yet; it is not a missing feature, it is a surface
 * whose migration belongs to a later phase.
 */
const WAVE2_BY_TAB: Record<string, Wave2Group> = {
  'client-opps': 'opportunities',
  'client-results': 'results',
  'client-profile': 'profile',
  'ws-sources': 'sources',
};

/**
 * Wave-3 page ownership (T-010-301…305).
 *
 * A tab listed here is rendered by a migrated React page. Every one of these
 * pages is HYBRID or READ_ONLY, never a full cutover, so the legacy surface
 * remains the served default and the pages state which actions still live there.
 *
 * A tab owned by a wave-3 page does not additionally render its wave-2 group:
 * two components must not claim the same surface (threat T-010-24).
 */
const WORKSPACE_TAB_BY_ID: Record<string, WorkspaceTab> = {
  'ws-radar': 'radar',
  'ws-deliver': 'deliver',
  'ws-briefs': 'briefs',
  'ws-sources-react': 'sources',
  'ws-tasks': 'tasks',
  'ws-results': 'results',
  'ws-positioning': 'positioning',
  'ws-production': 'production',
};

const PORTAL_TAB_BY_ID: Record<string, ClientPortalTab> = {
  'client-home': 'home',
  'client-feed': 'tasks',
  'client-content': 'content',
  'client-thesis': 'thesis',
};

const COCKPIT_TABS = new Set(['dashboard', 'clients', 'ai-center']);

interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly badge?: number;
}

function NavGroup({
  label,
  items,
  activeTab,
  onSelect,
}: {
  label: string;
  items: readonly NavItem[];
  activeTab: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="sidebar-group">
      <p className="sidebar-group-label">{label}</p>
      <div className="sidebar-links">
        {items.map(({ id, label: itemLabel, badge }) => (
          <button
            key={id}
            type="button"
            className={`sidebar-link ${activeTab === id ? 'active' : ''}`}
            aria-current={activeTab === id ? 'page' : undefined}
            onClick={() => onSelect(id)}
            data-tab={id}
          >
            <span>{itemLabel}</span>
            {badge ? <span className="sidebar-badge">{badge}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReactAppShell() {
  const { user, tenantScope, isAdmin, isImpersonating } = useSession();
  const [activeTab, setActiveTab] = useState(isAdmin ? 'dashboard' : 'client-home');
  const [activeClientId, setActiveClientId] = useState('all');
  const [moreOpen, setMoreOpen] = useState(false);

  // Presentation filters. Empty string means "all" — an explicit, non-authoritative
  // absence of filter rather than an implicit first-item selection.
  const [campaignFilter, setCampaignFilter] = useState('');
  const [thesisFilter, setThesisFilter] = useState('');

  useEffect(() => {
    return subscribeShellNavigation((intent) => {
      setActiveTab(normalizeTab(intent.tab));
      if (intent.clientId !== undefined) setActiveClientId(intent.clientId);
    });
  }, []);

  useEffect(() => {
    setMoreOpen(false);
  }, [activeTab, activeClientId]);

  const enterClient = (clientId: string, tab = 'ws-radar') => {
    setActiveClientId(clientId);
    setActiveTab(normalizeTab(tab));
  };

  const backToPortfolio = () => {
    setActiveClientId('all');
    setActiveTab('dashboard');
  };

  const selectTab = (tab: string) => {
    const next = normalizeTab(tab);
    if (isAdmin && isWorkspaceTab(next) && activeClientId === 'all') {
      setActiveTab('clients');
      return;
    }
    setActiveTab(next);
  };

  const portfolio = usePortfolioBadges(isAdmin ? tenantScope : null);
  const workspace = useWorkspaceBadges(isAdmin ? null : tenantScope);
  const clientBadges = useClientBadges(isAdmin ? null : tenantScope);
  const canonicalOpportunities = useCanonicalOpportunities(isAdmin ? null : tenantScope);
  const shellContext = useShellContext(
    tenantScope,
    isAdmin && activeClientId !== 'all' ? activeClientId : null
  );

  if (!user) return null;

  if (!tenantScope) {
    // Fail closed: a session without a usable trusted scope reads nothing.
    return (
      <div className="card" role="alert" data-testid="react-shell-no-scope">
        <h2>Sesión sin contexto de organización</h2>
        <p className="muted">
          No se puede determinar el ámbito de organización de forma confiable, así que no se muestran
          datos.
        </p>
      </div>
    );
  }

  const isLoading =
    portfolio.isLoading || workspace.isLoading || clientBadges.isLoading || shellContext.isLoading;

  const campaigns = shellContext.data?.campaigns ?? [];
  const theses = shellContext.data?.theses ?? [];
  const workspaceClientName = shellContext.data?.workspaceClientName?.trim() || null;

  const workspaceTab = WORKSPACE_TAB_BY_ID[activeTab];
  const portalTab = PORTAL_TAB_BY_ID[activeTab];
  const cockpitTab = COCKPIT_TABS.has(activeTab);
  const wave3Owns = Boolean(workspaceTab || portalTab || cockpitTab);
  const wave2Group = wave3Owns ? undefined : WAVE2_BY_TAB[activeTab];
  const legacyIsland = isLegacyIslandTab(activeTab);
  const inWorkspace = isAdmin && activeClientId !== 'all';
  const cockpitSection =
    activeTab === 'clients' ? 'clients' : activeTab === 'ai-center' ? 'ai' : 'portfolio';

  const sidebar = isAdmin ? (
    <>
      <NavGroup
        label="Cartera"
        items={[
          { id: 'dashboard', label: 'Hoy', badge: portfolio.data?.clientsNeedingAttention },
          { id: 'clients', label: 'Clientes' },
        ]}
        activeTab={activeTab}
        onSelect={selectTab}
      />
      {inWorkspace ? (
        <NavGroup
          label={workspaceClientName || 'Cliente activo'}
          items={[
            { id: 'ws-briefing', label: 'Resumen' },
            { id: 'ws-radar', label: 'Radar' },
            { id: 'ws-deliver', label: 'Entregas' },
            { id: 'ws-briefs', label: 'Strategic Briefs' },
            { id: 'ws-positioning', label: 'Posicionamiento' },
            { id: 'ws-sources-react', label: 'Fuentes' },
            { id: 'ws-tasks', label: 'Tareas' },
            { id: 'ws-production', label: 'Producción' },
            { id: 'ws-results', label: 'Resultados' },
          ]}
          activeTab={activeTab}
          onSelect={selectTab}
        />
      ) : null}
      <NavGroup
        label="Sistema"
        items={[{ id: 'ai-center', label: 'IA y operación' }]}
        activeTab={activeTab}
        onSelect={selectTab}
      />
    </>
  ) : (
    <>
      <NavGroup
        label="Mi semana"
        items={[
          { id: 'client-home', label: 'Esta semana', badge: clientBadges.data?.openTasks || undefined },
          {
            id: 'client-content',
            label: 'Revisar',
            badge: clientBadges.data?.pendingContentReview || undefined,
          },
          {
            id: 'client-opps',
            label: 'Oportunidades',
            badge: canonicalOpportunities.data?.length || undefined,
          },
        ]}
        activeTab={activeTab}
        onSelect={selectTab}
      />
      <NavGroup
        label="Mi trayectoria"
        items={[
          {
            id: 'client-profile',
            label: 'Mi perfil',
            badge: clientBadges.data?.profileIncomplete ? 1 : undefined,
          },
          { id: 'client-thesis', label: 'Mi posicionamiento' },
          { id: 'client-results', label: 'Resultados' },
        ]}
        activeTab={activeTab}
        onSelect={selectTab}
      />
    </>
  );

  return (
    <>
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <span className="sidebar-brand-text">
            <span className="brand-logo">POSTURA</span>
            <span className="sidebar-role">
              {isAdmin ? 'Cockpit del manager' : 'Portal del cliente'}
            </span>
          </span>
        </div>

        <nav className="sidebar-nav">{sidebar}</nav>

        <div className="sidebar-footer">
          <span className="sidebar-footnote">{isAdmin ? 'Brand Manager' : 'Cliente'}</span>
        </div>
      </aside>

        <header className="topbar">
        <div className="mobile-brand">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <span className="brand-logo">POSTURA</span>
        </div>
        <nav className="breadcrumb" aria-label="Ubicación">
          <span className="breadcrumb-root">{isAdmin ? 'Cartera' : 'Mi espacio'}</span>
          {inWorkspace ? (
            <>
              <span className="breadcrumb-sep" aria-hidden="true">
                /
              </span>
              <span className="breadcrumb-current" data-testid="react-shell-workspace-name">
                {workspaceClientName || 'Cliente'}
              </span>
              <span className="breadcrumb-sep" aria-hidden="true">
                /
              </span>
              <button type="button" className="link-btn" onClick={backToPortfolio}>
                Volver a cartera
              </button>
            </>
          ) : null}
        </nav>

        <div className="topbar-right">
          {!isAdmin && campaigns.length > 1 ? (
            <label className="campaign-filter-label">
              <span className="sr-only">Campaña activa</span>
              <select
                className="form-select form-select-sm"
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                data-testid="react-campaign-filter"
              >
                <option value="">Todas las campañas</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {!isAdmin && theses.length > 1 ? (
            <label className="campaign-filter-label">
              <span className="sr-only">Tesis activa</span>
              <select
                className="form-select form-select-sm"
                value={thesisFilter}
                onChange={(e) => setThesisFilter(e.target.value)}
                data-testid="react-thesis-filter"
              >
                {/* No thesis is pre-selected: the default is an explicit "all". */}
                <option value="">Todas las tesis</option>
                {theses.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {isLoading ? (
            <span className="status-pill" data-testid="react-shell-loading">
              Cargando…
            </span>
          ) : null}

          <FirebaseModeBadge />

          <span className="topbar-divider" aria-hidden="true" />

          <div className="topbar-user">
            <div className="user-avatar" aria-hidden="true">
              {(user.displayName || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div className="topbar-user-meta">
              <span className="topbar-user-name">{user.displayName || user.email}</span>
              <span className={`role-pill ${isAdmin ? 'admin' : 'client'}`}>
                {isAdmin ? 'Manager' : 'Cliente'}
              </span>
            </div>
          </div>

          <div className="topbar-actions">
            {isImpersonating ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm topbar-return"
                onClick={() => sessionCommands.returnToManager()}
              >
                <span className="topbar-return-full">Volver al cockpit</span>
                <span className="topbar-return-short">Cockpit</span>
              </button>
            ) : null}
            <button
              type="button"
              className="icon-btn"
              title="Salir"
              aria-label="Cerrar sesión"
              onClick={() => sessionCommands.logout()}
              data-testid="react-shell-logout"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="main-wrapper" data-testid="react-shell-body">
        {inWorkspace ? (
          <nav className="mobile-sections" aria-label="Secciones del cliente">
            <button type="button" className="mobile-section" onClick={backToPortfolio}>
              Cartera
            </button>
            {WORKSPACE_SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`mobile-section ${activeTab === item.id ? 'active' : ''}`}
                aria-current={activeTab === item.id ? 'page' : undefined}
                onClick={() => selectTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : null}
        {isAdmin && isWorkspaceTab(activeTab) && activeClientId === 'all' ? (
          <div className="card" data-testid="react-shell-workspace-guard">
            <h3>Selecciona un cliente</h3>
            <p className="muted">Abre un workspace desde la cartera para trabajar en pestañas de cliente.</p>
          </div>
        ) : null}

        {cockpitTab && !(isWorkspaceTab(activeTab) && activeClientId === 'all') ? (
          <ReactManagerCockpitPage
            shellTab={cockpitSection}
            onEnterClient={({ clientId, tab }) => enterClient(clientId, tab || 'ws-radar')}
          />
        ) : null}
        {workspaceTab && activeClientId !== 'all' ? (
          <ReactClientWorkspacePage tab={workspaceTab} clientId={activeClientId} />
        ) : null}
        {portalTab ? <ReactClientPortalPage tab={portalTab} /> : null}
        {wave2Group ? <Wave2Surface group={wave2Group} /> : null}
        {legacyIsland &&
        (!isWorkspaceTab(activeTab) || activeClientId !== 'all') &&
        !(workspaceTab && activeClientId !== 'all') ? (
          <LegacyIslandHost
            tab={legacyIslandTabId(activeTab)}
            clientId={activeClientId}
            campaignId={campaignFilter || null}
            thesisId={thesisFilter || undefined}
            testId="react-legacy-island"
          />
        ) : null}
      </main>

      <MobileTabBar
        isAdmin={isAdmin}
        activeTab={activeTab}
        moreOpen={moreOpen}
        attentionBadge={portfolio.data?.clientsNeedingAttention}
        openTasks={clientBadges.data?.openTasks}
        pendingReview={clientBadges.data?.pendingContentReview}
        opportunityCount={canonicalOpportunities.data?.length}
        profileIncomplete={clientBadges.data?.profileIncomplete}
        onSelect={selectTab}
        onToggleMore={() => setMoreOpen((open) => !open)}
        onCloseMore={() => setMoreOpen(false)}
      />
    </>
  );
}

const WORKSPACE_SECTIONS: readonly NavItem[] = [
  { id: 'ws-briefing', label: 'Resumen' },
  { id: 'ws-radar', label: 'Radar' },
  { id: 'ws-deliver', label: 'Entregas' },
  { id: 'ws-briefs', label: 'Briefs' },
  { id: 'ws-positioning', label: 'Posición' },
  { id: 'ws-sources-react', label: 'Fuentes' },
  { id: 'ws-tasks', label: 'Tareas' },
  { id: 'ws-production', label: 'Producción' },
  { id: 'ws-results', label: 'Resultados' },
];

const CLIENT_MORE: readonly NavItem[] = [
  { id: 'client-profile', label: 'Mi perfil' },
  { id: 'client-thesis', label: 'Mi posicionamiento' },
  { id: 'client-results', label: 'Resultados' },
];

function MobileTabBar({
  isAdmin,
  activeTab,
  moreOpen,
  attentionBadge,
  openTasks,
  pendingReview,
  opportunityCount,
  profileIncomplete,
  onSelect,
  onToggleMore,
  onCloseMore,
}: {
  isAdmin: boolean;
  activeTab: string;
  moreOpen: boolean;
  attentionBadge?: number;
  openTasks?: number;
  pendingReview?: number;
  opportunityCount?: number;
  profileIncomplete?: boolean;
  onSelect: (id: string) => void;
  onToggleMore: () => void;
  onCloseMore: () => void;
}) {
  const moreActive = CLIENT_MORE.some((item) => item.id === activeTab);
  const primary: readonly NavItem[] = isAdmin
    ? [
        { id: 'dashboard', label: 'Hoy', badge: attentionBadge },
        { id: 'clients', label: 'Clientes' },
        { id: 'ai-center', label: 'IA' },
      ]
    : [
        { id: 'client-home', label: 'Semana', badge: openTasks || undefined },
        { id: 'client-content', label: 'Revisar', badge: pendingReview || undefined },
        { id: 'client-opps', label: 'Oportunidades', badge: opportunityCount || undefined },
      ];

  return (
    <>
      {!isAdmin && moreOpen ? (
        <>
          <button type="button" className="mobile-more-backdrop" aria-label="Cerrar menú" onClick={onCloseMore} />
          <div className="mobile-more" role="menu" aria-label="Más secciones">
            {CLIENT_MORE.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`mobile-more-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => onSelect(item.id)}
              >
                <span>{item.label}</span>
                {item.id === 'client-profile' && profileIncomplete ? (
                  <span className="mobile-tab-badge">1</span>
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
      <nav className="mobile-tabbar" aria-label="Navegación móvil">
        {primary.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`mobile-tab ${activeTab === item.id ? 'active' : ''}`}
            aria-current={activeTab === item.id ? 'page' : undefined}
            onClick={() => onSelect(item.id)}
          >
            <span className="mobile-tab-label">{item.label}</span>
            {item.badge ? <span className="mobile-tab-badge">{item.badge}</span> : null}
          </button>
        ))}
        {!isAdmin ? (
          <button
            type="button"
            className={`mobile-tab ${moreActive || moreOpen ? 'active' : ''}`}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            onClick={onToggleMore}
          >
            <span className="mobile-tab-label">Más</span>
          </button>
        ) : null}
      </nav>
    </>
  );
}

/** Presentation-only badge from Vite public env — no Firebase SDK import (T-010-03). */
function FirebaseModeBadge() {
  const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim();
  const apiKey = String(import.meta.env.VITE_FIREBASE_API_KEY || '').trim();
  const enabled = Boolean(projectId && apiKey);
  if (!enabled) {
    return (
      <span
        className="status-pill status-off"
        title="Sin Firebase: datos locales de demo"
        data-testid="react-shell-firebase-badge"
      >
        Local · demo
      </span>
    );
  }
  const emulators = import.meta.env.VITE_FIREBASE_USE_EMULATORS === 'true';
  return (
    <span
      className={`status-pill ${emulators ? 'status-off' : 'status-on'}`}
      title={
        emulators
          ? 'Emulador local — no es datos de producción'
          : 'Backend Firebase en la nube (datos reales)'
      }
      data-testid="react-shell-firebase-badge"
    >
      {emulators ? 'Firebase · Emulator' : `Firebase · ${projectId}`}
    </span>
  );
}
