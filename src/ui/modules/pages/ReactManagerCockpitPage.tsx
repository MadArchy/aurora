/**
 * SPEC-010 · React ManagerCockpit (wave 3, T-010-303) — HYBRID.
 *
 * Authority: presentation only.
 *
 * READ SOURCE: compatibility (`readPortfolioOverview`, `readAiCenter`).
 *
 * COMMAND: #34 CreateClientWithInvite (P14) via `clientLifecycleCommands`.
 * COMMAND: RematerializeLocalSnapshotToFirestore via `localSnapshotCommands`.
 * COMMAND: impersonate / open workspace via `sessionCommands`.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '../../providers/SessionProvider';
import {
  useAiCenter,
  useCreateClientWithInvite,
  usePortfolioOverview,
  useRematerializeLocalSnapshot,
} from '../../hooks/useWave3Data';
import { sessionCommands } from '../../commands/commandSeam';
import { ReactTabHeader } from '../PageHeader/ReactPageHeader';
import { PanelState } from './LegacyHandoff';
import type { PortfolioRowRead } from '../../data/compatibilityReads';

type CockpitTab = 'portfolio' | 'clients' | 'ai';

const COCKPIT_HEADER_TAB: Record<CockpitTab, string> = {
  portfolio: 'dashboard',
  clients: 'clients',
  ai: 'ai-center',
};

type CreateClientFields = {
  firstName: string;
  lastName: string;
  email: string;
  profession: string;
  company: string;
  targetMarket: string;
};

const EMPTY_CREATE_CLIENT: CreateClientFields = {
  firstName: '',
  lastName: '',
  email: '',
  profession: '',
  company: '',
  targetMarket: '',
};

export type EnterClientIntent = { clientId: string; tab?: string };

function portfolioPrimaryAction(row: PortfolioRowRead): { tab: string; label: string } {
  if (row.unreviewedSignals > 0) return { tab: 'ws-radar', label: 'Abrir radar' };
  if (row.pendingCuration > 0 || row.draftDeliveries > 0) {
    return { tab: 'ws-deliver', label: 'Continuar entrega' };
  }
  if (row.contentAwaitingManager > 0) return { tab: 'ws-production', label: 'Revisar producción' };
  if (row.sourcesInError > 0) return { tab: 'ws-sources-react', label: 'Revisar fuentes' };
  return { tab: 'ws-briefing', label: 'Ver resumen' };
}

function attentionLabel(score: number): string {
  if (score >= 45) return 'Requiere acción';
  if (score >= 20) return 'Revisar pronto';
  if (score > 0) return 'Menor';
  return 'Al día';
}

function CreateClientPanel() {
  const { tenantScope } = useSession();
  const createClient = useCreateClientWithInvite(tenantScope);
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<CreateClientFields>(EMPTY_CREATE_CLIENT);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = createClient.isPending;

  const resetForm = () => {
    setFields(EMPTY_CREATE_CLIENT);
    setError(null);
    setMessage(null);
  };

  const closeForm = () => {
    setOpen(false);
    resetForm();
  };

  const setField = (key: keyof CreateClientFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const firstName = fields.firstName.trim();
    const lastName = fields.lastName.trim();
    const email = fields.email.trim();
    if (!firstName || !lastName || !email) {
      setError('Nombre, apellido y correo son obligatorios.');
      return;
    }
    if (!email.includes('@')) {
      setError('Introduce un correo válido.');
      return;
    }

    const result = await createClient.mutateAsync({
      firstName,
      lastName,
      email,
      profession: fields.profession.trim() || undefined,
      company: fields.company.trim() || undefined,
      targetMarket: fields.targetMarket.trim() || undefined,
    });

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setFields(EMPTY_CREATE_CLIENT);
    setError(null);
    setMessage(result.message);
    setOpen(false);
  };

  return (
    <div className="cockpit-create-client" data-testid="react-cockpit-create-client">
      {!open ? (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            setOpen(true);
            setError(null);
          }}
          data-testid="react-cockpit-create-open"
        >
          + Nuevo cliente
        </button>
      ) : (
        <form className="card nested-card" noValidate onSubmit={(event) => void submit(event)}>
          <h4>Crear cliente e invitación</h4>
          <p className="muted small">
            La organización y el actor se resuelven desde la sesión de manager.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="react-cockpit-first-name">
                Nombre
              </label>
              <input
                id="react-cockpit-first-name"
                className="form-input"
                value={fields.firstName}
                onChange={(event) => setField('firstName', event.target.value)}
                required
                disabled={busy}
                data-testid="react-cockpit-first-name"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="react-cockpit-last-name">
                Apellido
              </label>
              <input
                id="react-cockpit-last-name"
                className="form-input"
                value={fields.lastName}
                onChange={(event) => setField('lastName', event.target.value)}
                required
                disabled={busy}
                data-testid="react-cockpit-last-name"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="react-cockpit-email">
              Correo
            </label>
            <input
              id="react-cockpit-email"
              type="email"
              className="form-input"
              value={fields.email}
              onChange={(event) => setField('email', event.target.value)}
              required
              disabled={busy}
              data-testid="react-cockpit-email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="react-cockpit-profession">
              Profesión (opcional)
            </label>
            <input
              id="react-cockpit-profession"
              className="form-input"
              value={fields.profession}
              onChange={(event) => setField('profession', event.target.value)}
              disabled={busy}
              data-testid="react-cockpit-profession"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="react-cockpit-company">
              Empresa (opcional)
            </label>
            <input
              id="react-cockpit-company"
              className="form-input"
              value={fields.company}
              onChange={(event) => setField('company', event.target.value)}
              disabled={busy}
              data-testid="react-cockpit-company"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="react-cockpit-target">
              Mercado objetivo (opcional)
            </label>
            <input
              id="react-cockpit-target"
              className="form-input"
              value={fields.targetMarket}
              onChange={(event) => setField('targetMarket', event.target.value)}
              disabled={busy}
              data-testid="react-cockpit-target"
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={closeForm}
              data-testid="react-cockpit-create-cancel"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy}
              data-testid="react-cockpit-create-submit"
            >
              {busy ? 'Creando…' : 'Crear e invitar'}
            </button>
          </div>
        </form>
      )}

      {message ? (
        <p className="muted small" role="status" data-testid="react-cockpit-create-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert" data-testid="react-cockpit-create-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function RematerializeLocalSnapshotPanel() {
  const { tenantScope } = useSession();
  const rematerialize = useRematerializeLocalSnapshot(tenantScope);
  const overview = usePortfolioOverview(tenantScope);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!rematerialize.available) return null;

  const indicatorsHeld = overview.data?.indicatorStatus === 'PENDING' || overview.data?.indicatorStatus === 'ERROR';
  const busy = rematerialize.isPending;

  const submit = async () => {
    setError(null);
    setMessage(null);
    const result = await rematerialize.mutateAsync();
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message);
  };

  return (
    <details className="cockpit-advanced" data-testid="react-cockpit-rematerialize">
      <summary className="muted small">Herramientas avanzadas</summary>
      <div className="cockpit-advanced-body">
        <p className="muted small">
          Solo para migración de datos locales. No forma parte del flujo diario.
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy || indicatorsHeld}
          onClick={() => void submit()}
          data-testid="react-cockpit-rematerialize-submit"
        >
          {busy ? 'Sincronizando…' : 'Sincronizar copia local'}
        </button>
        {message ? (
          <p className="muted small" role="status" data-testid="react-cockpit-rematerialize-success">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="form-error" role="alert" data-testid="react-cockpit-rematerialize-error">
            {error}
          </p>
        ) : null}
      </div>
    </details>
  );
}

function useOpenWorkspace(onEnterClient?: (intent: EnterClientIntent) => void) {
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openErrorId, setOpenErrorId] = useState<string | null>(null);

  const open = (clientId: string, tab?: string) => {
    if (!onEnterClient || openingId === clientId) return;
    setOpeningId(clientId);
    setOpenErrorId(null);
    void sessionCommands.openAdminClientWorkspace(clientId).then((result) => {
      setOpeningId((current) => (current === clientId ? null : current));
      if (!result.ok) {
        if (result.reason !== 'stale') setOpenErrorId(clientId);
        return;
      }
      onEnterClient({ clientId, tab });
    });
  };

  return { openingId, openErrorId, open };
}

/** Hoy — cola de atención (solo attentionScore > 0, salvo búsqueda). */
function HoyPanel({ onEnterClient }: { onEnterClient?: (intent: EnterClientIntent) => void }) {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = usePortfolioOverview(tenantScope);
  const [search, setSearch] = useState('');
  const { openingId, openErrorId, open } = useOpenWorkspace(onEnterClient);

  if (isLoading || data?.directoryStatus === 'LOADING') {
    return <PanelState kind="loading" message="Cargando cola de atención…" testId="react-cockpit-loading" />;
  }
  if (isError || data?.directoryStatus === 'ERROR') {
    return (
      <PanelState
        kind="error"
        message="No se pudo cargar la cola de atención. La cartera no está vacía: la consulta falló."
        testId="react-cockpit-error"
      />
    );
  }

  const overview = data ?? {
    rows: [],
    totalClients: 0,
    needingAttention: 0,
    totalActiveTheses: 0,
    directoryStatus: 'READY' as const,
    indicatorStatus: 'READY' as const,
  };
  const indicatorsReady = overview.indicatorStatus === 'READY';
  const indicatorLabel =
    overview.indicatorStatus === 'ERROR' ? 'Error' : indicatorsReady ? null : 'Pendiente';

  const term = search.trim().toLowerCase();
  const base = term
    ? overview.rows.filter((row) =>
        `${row.displayName} ${row.profession} ${row.company}`.toLowerCase().includes(term)
      )
    : overview.rows.filter((row) => row.attentionScore > 0);

  const queue = [...base].sort((a, b) => {
    const byScore = b.attentionScore - a.attentionScore;
    if (byScore !== 0) return byScore;
    return a.displayName.localeCompare(b.displayName, 'es');
  });

  return (
    <div data-testid="react-cockpit-hoy" data-directory="ready" className="cockpit-hoy">
      <section className="today-hero editorial-panel" data-testid="react-cockpit-hoy-hero">
        <p className="section-kicker">Estado de la cartera</p>
        <p className="today-hero-lead" data-testid="react-cockpit-hoy-lead">
          {overview.totalClients === 0
            ? 'Cartera vacía en Firestore. Crea el primer cliente en Clientes.'
            : queue.length
              ? `${queue.length} cliente${queue.length === 1 ? '' : 's'} requieren una decisión ahora.`
              : 'Nada urgente en la cartera. Revisa Clientes o prepara la próxima entrega.'}
        </p>
        <p className="today-hero-stats muted small">
          <span data-testid="react-cockpit-attention">{indicatorLabel ?? overview.needingAttention}</span> con
          atención ·{' '}
          <span data-testid="react-cockpit-client-count">{overview.totalClients}</span> en cartera ·{' '}
          <span data-testid="react-cockpit-theses">{indicatorLabel ?? overview.totalActiveTheses}</span> tesis
          activas
        </p>
      </section>

      <section className="card today-queue">
        <div className="section-heading">
          <div className="section-heading-copy">
            <h2>Cola de atención</h2>
            <p>Entra al paso que desbloquea cada cliente.</p>
          </div>
        </div>

        <div className="form-group today-search">
          <label className="form-label sr-only" htmlFor="react-cockpit-hoy-search">
            Buscar en la cola
          </label>
          <input
            id="react-cockpit-hoy-search"
            type="search"
            className="form-input"
            placeholder="Buscar cliente…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            data-testid="react-cockpit-search"
          />
        </div>

        {queue.length ? (
          <ul className="portfolio-queue portfolio-queue-list" data-testid="react-cockpit-queue">
            {queue.map((row) => {
              const action = portfolioPrimaryAction(row);
              const level =
                row.attentionScore >= 45
                  ? 'attention-high'
                  : row.attentionScore >= 20
                    ? 'attention-medium'
                    : 'attention-low';
              return (
                <li className={`portfolio-queue-row ${level}`} key={row.clientId}>
                  <div className="portfolio-queue-copy">
                    <div className="portfolio-queue-title">
                      <strong>{row.displayName}</strong>
                      <span className="attention-tag">{attentionLabel(row.attentionScore)}</span>
                    </div>
                    <p className="portfolio-queue-reason">
                      {row.attentionReasons[0] ||
                        `${row.unreviewedSignals} señales · ${row.pendingCuration} por decidir`}
                    </p>
                  </div>
                  <div className="portfolio-queue-meta">
                    {onEnterClient ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          data-testid={`react-cockpit-open-${row.clientId}`}
                          disabled={openingId === row.clientId}
                          onClick={() => open(row.clientId, action.tab)}
                        >
                          {openingId === row.clientId ? 'Cargando…' : action.label}
                        </button>
                        {openErrorId === row.clientId ? (
                          <p
                            className="form-error small"
                            data-testid={`react-cockpit-open-error-${row.clientId}`}
                          >
                            No se pudieron cargar los datos de este cliente.
                          </p>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-state" data-testid="react-cockpit-empty">
            {term
              ? 'Ningún cliente coincide con la búsqueda.'
              : overview.totalClients === 0
                ? 'Aún no hay clientes en Firestore. Ve a Clientes y crea el primero.'
                : 'Toda la cartera está al día. Ve a Clientes para administrar la cartera.'}
          </p>
        )}
      </section>
      <div hidden data-testid="react-cockpit-indicators" data-state={indicatorsReady ? 'ready' : 'pending'} />
    </div>
  );
}

/** Clientes — directorio completo + alta + impersonar. */
function ClientsPanel({ onEnterClient }: { onEnterClient?: (intent: EnterClientIntent) => void }) {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = usePortfolioOverview(tenantScope);
  const [search, setSearch] = useState('');
  const [impersonateError, setImpersonateError] = useState<string | null>(null);
  const { openingId, openErrorId, open } = useOpenWorkspace(onEnterClient);

  if (isLoading || data?.directoryStatus === 'LOADING') {
    return <PanelState kind="loading" message="Cargando directorio de clientes…" testId="react-cockpit-loading" />;
  }
  if (isError || data?.directoryStatus === 'ERROR') {
    return (
      <PanelState
        kind="error"
        message="No se pudo cargar el directorio de clientes. La cartera no está vacía: la consulta falló."
        testId="react-cockpit-error"
      />
    );
  }

  const overview = data ?? {
    rows: [],
    totalClients: 0,
    needingAttention: 0,
    totalActiveTheses: 0,
    directoryStatus: 'READY' as const,
    indicatorStatus: 'READY' as const,
  };
  const indicatorsReady = overview.indicatorStatus === 'READY';
  const indicatorLabel =
    overview.indicatorStatus === 'ERROR' ? 'Error' : indicatorsReady ? null : 'Pendiente';

  const term = search.trim().toLowerCase();
  const rows = term
    ? overview.rows.filter((row) =>
        `${row.displayName} ${row.profession} ${row.company}`.toLowerCase().includes(term)
      )
    : overview.rows;

  const directory = [...rows].sort((a, b) => {
    const byScore = b.attentionScore - a.attentionScore;
    if (byScore !== 0) return byScore;
    return a.displayName.localeCompare(b.displayName, 'es');
  });

  return (
    <div data-testid="react-cockpit-clients" data-directory="ready" className="cockpit-clients">
      <section className="today-hero editorial-panel">
        <p className="section-kicker">Directorio</p>
        <p className="today-hero-lead">
          {overview.totalClients} cliente{overview.totalClients === 1 ? '' : 's'} en cartera
          {overview.needingAttention
            ? ` · ${overview.needingAttention} con pendientes abiertos`
            : ' · todos al día'}
          .
        </p>
        <p className="today-hero-stats muted small">
          <span data-testid="react-cockpit-client-count">{overview.totalClients}</span> clientes ·{' '}
          <span data-testid="react-cockpit-attention">{indicatorLabel ?? overview.needingAttention}</span>{' '}
          con atención ·{' '}
          <span data-testid="react-cockpit-theses">{indicatorLabel ?? overview.totalActiveTheses}</span> tesis
          activas
        </p>
      </section>

      <div className="cockpit-clients-toolbar">
        <CreateClientPanel />
      </div>

      <section className="card today-queue">
        <div className="section-heading">
          <div className="section-heading-copy">
            <h2>Cartera</h2>
            <p>Ordenada por urgencia. Los números vienen de señales, tareas y entregas reales.</p>
          </div>
        </div>

        <div className="form-group today-search">
          <label className="form-label sr-only" htmlFor="react-cockpit-clients-search">
            Buscar cliente
          </label>
          <input
            id="react-cockpit-clients-search"
            type="search"
            className="form-input"
            placeholder="Buscar por nombre, profesión o empresa…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            data-testid="react-cockpit-search"
          />
        </div>

        {impersonateError ? (
          <p className="form-error" role="alert" data-testid="react-cockpit-impersonate-error">
            {impersonateError}
          </p>
        ) : null}

        {directory.length ? (
          <ul className="portfolio-queue portfolio-queue-list" data-testid="react-cockpit-directory">
            {directory.map((row) => {
              const action = portfolioPrimaryAction(row);
              return (
                <li className="portfolio-queue-row client-directory-row" key={row.clientId}>
                  <div className="portfolio-queue-copy">
                    <div className="portfolio-queue-title">
                      <strong>{row.displayName}</strong>
                      <span className={`badge ${row.status === 'ACTIVE' ? 'badge-ready' : 'badge-pending'}`}>
                        {row.status === 'ACTIVE' ? 'Activo' : row.status}
                      </span>
                      {row.attentionScore > 0 ? (
                        <span className="attention-tag">{attentionLabel(row.attentionScore)}</span>
                      ) : null}
                    </div>
                    <p className="portfolio-queue-reason">
                      {row.profession || 'Sin profesión'}
                      {row.company ? ` · ${row.company}` : ''}
                    </p>
                    <p className="muted small portfolio-queue-meta" data-testid={`react-cockpit-theses-${row.clientId}`}>
                      {row.unreviewedSignals} señales · {row.openTasks} tareas
                      {row.activeThesisCount
                        ? ` · ${row.activeThesisCount} tesis`
                        : ' · sin tesis activa'}
                    </p>
                  </div>
                  <div className="client-directory-actions">
                    {onEnterClient ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        data-testid={`react-cockpit-open-${row.clientId}`}
                        disabled={openingId === row.clientId}
                        onClick={() => open(row.clientId, action.tab)}
                      >
                        {openingId === row.clientId ? 'Cargando…' : action.label}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      data-testid={`react-cockpit-impersonate-${row.clientId}`}
                      onClick={() => {
                        setImpersonateError(null);
                        const result = sessionCommands.viewAsClient(row.clientId, row.displayName);
                        if (!result.ok) setImpersonateError(result.message);
                      }}
                    >
                      Ver como cliente
                    </button>
                    {openErrorId === row.clientId ? (
                      <p className="form-error small" data-testid={`react-cockpit-open-error-${row.clientId}`}>
                        No se pudieron cargar los datos de este cliente.
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-state" data-testid="react-cockpit-empty">
            {term
              ? 'Ningún cliente coincide con la búsqueda.'
              : 'Aún no hay clientes en Firestore. Crea el primero — los datos viven en la nube, no en demo local.'}
          </p>
        )}
      </section>

      <RematerializeLocalSnapshotPanel />
      <div hidden data-testid="react-cockpit-indicators" data-state={indicatorsReady ? 'ready' : 'pending'} />
    </div>
  );
}

function AiCenterPanel() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useAiCenter(tenantScope);

  if (isLoading) {
    return <PanelState kind="loading" message="Cargando consumo…" testId="react-ai-center-loading" />;
  }
  if (isError || !data) {
    return (
      <PanelState
        kind="error"
        message="No se pudo cargar el consumo de IA."
        testId="react-ai-center-error"
      />
    );
  }

  return (
    <div data-testid="react-ai-center">
      <div className="stat-grid">
        <div className="stat-tile">
          <span className="stat-value">{data.tier}</span>
          <span className="stat-label">Plan · {data.status}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{data.aiRunsUsed}</span>
          <span className="stat-label">Ejecuciones este mes</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{data.tokensUsed}</span>
          <span className="stat-label">Tokens</span>
        </div>
      </div>

      {data.runs.length ? (
        <ul className="ai-run-list small" data-testid="react-ai-runs">
          {data.runs.map((run) => (
            <li key={run.id}>
              <span className={`badge ${run.ok ? 'badge-ready' : 'badge-pending'}`}>
                {run.status}
              </span>{' '}
              {run.agent} · {run.provider}/{run.modelName} · {run.createdAt}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-ai-runs-empty">
          Sin ejecuciones registradas.
        </p>
      )}

      <p className="muted small">
        El estado del gateway no se muestra en esta vista: no hace llamadas a servicios durante el
        render.
      </p>
    </div>
  );
}

export function ReactManagerCockpitPage({
  onEnterClient,
  shellTab = 'portfolio',
}: {
  onEnterClient?: (intent: EnterClientIntent) => void;
  shellTab?: CockpitTab;
}) {
  const { tenantScope, isAdmin } = useSession();
  const [tab, setTab] = useState<CockpitTab>(shellTab);

  useEffect(() => {
    setTab(shellTab);
  }, [shellTab]);

  if (!tenantScope) {
    return (
      <PanelState
        kind="no-scope"
        message="Sesión sin contexto de organización — no se muestra la cartera."
        testId="react-cockpit-no-scope"
      />
    );
  }

  if (!isAdmin) {
    return (
      <PanelState
        kind="empty"
        message="Esta vista es para managers."
        testId="react-cockpit-not-admin"
      />
    );
  }

  return (
    <section
      className="card cockpit-card"
      data-testid="react-manager-cockpit"
      data-authority="HYBRID"
      data-cockpit-tab={tab}
    >
      <ReactTabHeader tab={COCKPIT_HEADER_TAB[tab]} />

      {tab === 'ai' ? (
        <AiCenterPanel />
      ) : tab === 'clients' ? (
        <ClientsPanel onEnterClient={onEnterClient} />
      ) : (
        <HoyPanel onEnterClient={onEnterClient} />
      )}
    </section>
  );
}
