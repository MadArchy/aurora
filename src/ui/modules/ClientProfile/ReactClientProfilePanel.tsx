/**
 * SPEC-010 · React ClientProfilePanel (wave 2, T-010-203) — DISPLAY_ONLY_REACT.
 *
 * Authority: presentation only.
 *
 * READ SOURCE: compatibility (`readProfileOverview`). Coverage is computed by
 * `domain/profileCoverage` inside the facade, so no threshold, completeness rule
 * or section rule is evaluated here (threat T-010-19).
 *
 * COMMANDS: none. Every action the legacy panel offers is a business write with
 * no canonical Application use case (AUDIT010-09):
 *
 *   add fact            → `dbService.addProfileFact`
 *   confirm fact        → `dbService.confirmProfileFact`
 *   reject fact         → `dbService.rejectProfileFact`
 *   edit fact           → `dbService.updateProfileFact`
 *   extract CV facts    → `dbService.importCandidateFactsFromCv`
 *
 * Confirming a fact in particular changes what the system treats as verified
 * authority, so a React wrapper around the raw write is exactly what the
 * migration rule forbids. The read portion migrates; the writes stay legacy.
 *
 * Capability is preserved: the actions are visibly delegated to the legacy
 * surface, which is still served and unchanged, rather than being silently
 * dropped.
 */

import { useSession } from '../../providers/SessionProvider';
import { useProfileOverview } from '../../hooks/useWave2Data';
import { applyUiMode } from '../../mount';

export function ReactClientProfilePanel() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useProfileOverview(tenantScope);

  if (!tenantScope) {
    return (
      <section className="card" data-testid="react-profile-no-scope">
        <p className="muted">Sesión sin contexto de organización — no se muestra el perfil.</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="card" data-testid="react-profile-loading">
        <p className="muted">Cargando perfil…</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="card" role="alert" data-testid="react-profile-error">
        <p className="muted">No se pudo cargar el perfil.</p>
      </section>
    );
  }

  const profile = data ?? {
    totalConfirmed: 0,
    sectionsWithFacts: 0,
    meetsPilotThreshold: false,
    sections: [],
    clientDisplayName: null,
    profileCompleteness: 0,
    serviceLines: [],
  };

  return (
    <div
      className="profile-page-stack"
      data-testid="react-profile-panel"
      data-authority="DISPLAY_ONLY"
    >
      <section className="card">
        <div className="card-header">
          <div>
            <h3>Cobertura del perfil</h3>
            <p className="muted small">Objetivo piloto: ≥20 facts confirmados en ≥5 secciones.</p>
          </div>
          <span
            className={`badge ${profile.meetsPilotThreshold ? 'badge-ready' : 'badge-progress'}`}
            data-testid="react-profile-coverage"
          >
            {profile.totalConfirmed} facts · {profile.sectionsWithFacts} secciones
          </span>
        </div>

        <div className="coverage-grid">
          {profile.sections.map((section) => (
            <div
              className={`coverage-tile ${section.complete ? 'is-complete' : ''}`}
              key={section.section}
            >
              <strong>{section.label}</strong>
              <span className="muted small">
                {section.confirmed} confirmados
                {section.candidates ? ` · ${section.candidates} candidatos` : ''}
              </span>
            </div>
          ))}
        </div>

        <p className="muted small" data-testid="react-profile-delegation">
          Añadir, confirmar, editar o descartar facts, y extraer facts del CV, se siguen haciendo en
          la interfaz anterior.{' '}
          <button type="button" className="link-btn" onClick={() => void applyUiMode('legacy')}>
            Abrir interfaz anterior
          </button>
        </p>
      </section>

      {profile.sections.map((section) => (
        <section className="card profile-facts-section" key={section.section}>
          <div className="card-header">
            <div>
              <h3>{section.label}</h3>
              <p className="muted small">
                {section.facts.length
                  ? `${section.facts.length} fact(s) en esta sección`
                  : 'Sin facts todavía'}
              </p>
            </div>
          </div>

          {section.facts.length ? (
            <div className="profile-facts-list">
              {section.facts.map((fact) => (
                <div
                  className={`profile-fact-row ${fact.status === 'candidate' ? 'is-candidate' : ''}`}
                  key={fact.id}
                >
                  <div className="profile-fact-main">
                    <span
                      className={`badge ${fact.status === 'confirmed' ? 'badge-ready' : 'badge-progress'}`}
                    >
                      {fact.status === 'confirmed' ? 'Confirmado' : 'Candidato'}
                    </span>
                    <strong>{fact.label}</strong>
                    <p className="muted small">{fact.value}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">
              Añade facts confirmados o extrae candidatos desde tu CV en la interfaz anterior.
            </p>
          )}
        </section>
      ))}

      {profile.serviceLines.length ? (
        <section className="card service-lines-card">
          <div className="card-header">
            <div>
              <h3>Líneas de servicio</h3>
              <p className="muted small">
                Dos vías §3.1–3.2: IP/Patentes y Adopción IA (solo lectura).
              </p>
            </div>
          </div>
          <div className="service-lines-grid">
            {profile.serviceLines.map((line) => (
              <article className="service-line-block" key={line.name}>
                <h4>{line.name}</h4>
                <p className="muted small">{line.description}</p>
                <ul className="policy-list">
                  {line.offerings.map((offering) => (
                    <li key={offering}>{offering}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {profile.clientDisplayName ? (
        <p className="muted small profile-footnote">
          Perfil de {profile.clientDisplayName} · completitud {profile.profileCompleteness}%
        </p>
      ) : null}
    </div>
  );
}
