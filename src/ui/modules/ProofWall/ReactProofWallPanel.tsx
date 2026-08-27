/**
 * SPEC-010 · React ProofWallPanel (wave 2, T-010-203) — READ_ONLY_REACT.
 *
 * Authority: presentation only.
 *
 * READ SOURCE: compatibility (`readProofWall`).
 *
 * COMMAND: none, deliberately. The legacy status toggle completes with
 * `dbService.updateProofWallItem`, a business write with no canonical
 * Application use case (AUDIT010-09). Wrapping it in React would put a legacy
 * business mutation inside the presentation layer, so the toggle is NOT
 * migrated: the React view renders the same read-only status the client-facing
 * legacy view renders, and editing stays on the legacy manager surface, which is
 * still served and unchanged.
 *
 * Capability is therefore preserved rather than removed — the button is absent
 * here exactly as it is absent in the legacy non-editable view, and the notice
 * below points to the surface that still owns the action.
 */

import { useSession } from '../../providers/SessionProvider';
import { useProofWall } from '../../hooks/useWave2Data';
import { applyUiMode } from '../../mount';

export function ReactProofWallPanel() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useProofWall(tenantScope);

  if (!tenantScope) {
    return (
      <section className="card" data-testid="react-proof-wall-no-scope">
        <p className="muted">Sesión sin contexto de organización — no se muestra el muro.</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="card" data-testid="react-proof-wall-loading">
        <p className="muted">Cargando muro de pruebas…</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="card" role="alert" data-testid="react-proof-wall-error">
        <p className="muted">No se pudo cargar el muro de pruebas.</p>
      </section>
    );
  }

  const wall = data ?? { items: [], complete: 0, total: 0, percentComplete: 0 };

  return (
    <section
      className="card proof-wall-card"
      data-testid="react-proof-wall-panel"
      data-authority="READ_ONLY"
    >
      <div className="card-header">
        <div>
          <h3>Muro de pruebas §5.3</h3>
          <p className="muted small">
            Activos que respaldan credenciales públicas — libro, instituciones, servicios y medios.
          </p>
        </div>
        <div className="proof-wall-progress">
          <span
            className={`badge ${wall.percentComplete >= 70 ? 'badge-ready' : 'badge-progress'}`}
            data-testid="react-proof-wall-progress"
          >
            {wall.complete}/{wall.total} listos
          </span>
        </div>
      </div>

      <div className="progress-track proof-wall-track">
        <div className="progress-fill" style={{ width: `${wall.percentComplete}%` }} />
      </div>

      {wall.items.length ? (
        <ul className="proof-wall-list">
          {wall.items.map((item) => (
            <li
              className={`proof-wall-item ${item.complete ? 'is-complete' : 'is-pending'}`}
              key={item.id}
            >
              <span className="proof-wall-status" aria-hidden="true">
                {item.complete ? '✅' : '⏳'}
              </span>
              <div className="proof-wall-item-body">
                <strong>{item.title}</strong>
                {item.description ? <p className="muted small">{item.description}</p> : null}
                {item.evidenceUrl ? (
                  <a
                    className="small"
                    href={item.evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver evidencia
                  </a>
                ) : null}
              </div>
              <span className={`badge ${item.complete ? 'badge-ready' : 'badge-pending'}`}>
                {item.complete ? 'Listo' : 'Pendiente'}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-proof-wall-empty">
          Sin activos registrados todavía.
        </p>
      )}

      <p className="muted small" data-testid="react-proof-wall-delegation">
        Cambiar el estado de un activo se sigue haciendo en la interfaz anterior.{' '}
        <button type="button" className="link-btn" onClick={() => void applyUiMode('legacy')}>
          Abrir interfaz anterior
        </button>
      </p>
    </section>
  );
}
