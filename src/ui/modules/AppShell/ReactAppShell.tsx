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
 * Navigation is local presentation state (see T-010-102 routing decision).
 */

import { useState } from 'react';
import { useSession } from '../../providers/SessionProvider';
import {
  useCanonicalOpportunities,
  useClientBadges,
  usePortfolioBadges,
  useShellContext,
  useWorkspaceBadges,
} from '../../hooks/useShellData';
import { sessionCommands } from '../../commands/commandSeam';
import { applyUiMode } from '../../mount';

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

  // Presentation filters. Empty string means "all" — an explicit, non-authoritative
  // absence of filter rather than an implicit first-item selection.
  const [campaignFilter, setCampaignFilter] = useState('');
  const [thesisFilter, setThesisFilter] = useState('');

  const portfolio = usePortfolioBadges(isAdmin ? tenantScope : null);
  const workspace = useWorkspaceBadges(isAdmin ? null : tenantScope);
  const clientBadges = useClientBadges(isAdmin ? null : tenantScope);
  const canonicalOpportunities = useCanonicalOpportunities(isAdmin ? null : tenantScope);
  const shellContext = useShellContext(tenantScope, null);

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

  const sidebar = isAdmin ? (
    <>
      <NavGroup
        label="Cartera"
        items={[
          { id: 'dashboard', label: 'Hoy', badge: portfolio.data?.clientsNeedingAttention },
          { id: 'clients', label: 'Clientes' },
        ]}
        activeTab={activeTab}
        onSelect={setActiveTab}
      />
      <NavGroup
        label="Sistema"
        items={[{ id: 'ai-center', label: 'IA y operación' }]}
        activeTab={activeTab}
        onSelect={setActiveTab}
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
        onSelect={setActiveTab}
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
        onSelect={setActiveTab}
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
        <nav className="breadcrumb" aria-label="Ubicación">
          <span className="breadcrumb-root">{isAdmin ? 'Cartera' : 'Mi espacio'}</span>
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
                className="btn btn-ghost btn-sm"
                onClick={() => sessionCommands.returnToManager()}
              >
                Volver al cockpit
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void applyUiMode('legacy')}
              data-testid="react-shell-to-legacy"
            >
              Interfaz anterior
            </button>
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

      <main className="main-wrapper">
        <div className="card" data-testid="react-shell-body">
          <h2>Shell React (SPEC-010 · fase 1)</h2>
          <p className="muted">
            Cimiento de presentación. La interfaz anterior sigue siendo la implementación servida por
            defecto hasta que exista evidencia de paridad.
          </p>
          <p className="muted small">Pestaña activa: {activeTab}</p>
        </div>
      </main>
    </>
  );
}
