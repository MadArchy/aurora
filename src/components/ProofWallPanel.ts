import { dbService } from '../services/db';
import { esc } from '../lib/escape';
import { icon } from '../lib/icons';

export function renderProofWall(clientId: string, options: { editable?: boolean } = {}): string {
  const items = dbService.getProofWallByClient(clientId);
  const complete = items.filter((item) => item.status === 'complete').length;
  const total = items.length;
  const pct = total ? Math.round((complete / total) * 100) : 0;

  return `
    <section class="card proof-wall-card">
      <div class="card-header">
        <div>
          <h3>Muro de pruebas §5.3</h3>
          <p class="muted small">Activos que respaldan credenciales públicas — libro, instituciones, servicios y medios.</p>
        </div>
        <div class="proof-wall-progress">
          <span class="badge ${pct >= 70 ? 'badge-ready' : 'badge-progress'}">${complete}/${total} listos</span>
        </div>
      </div>

      <div class="progress-track proof-wall-track"><div class="progress-fill" style="width: ${pct}%"></div></div>

      <ul class="proof-wall-list">
        ${items.map((item) => {
          const evidence = item.evidenceId ? dbService.getEvidenceById(item.evidenceId) : undefined;
          return `
            <li class="proof-wall-item ${item.status === 'complete' ? 'is-complete' : 'is-pending'}">
              <span class="proof-wall-status" aria-hidden="true">
                ${item.status === 'complete' ? '✅' : '⏳'}
              </span>
              <div class="proof-wall-item-body">
                <strong>${esc(item.title)}</strong>
                ${item.description ? `<p class="muted small">${esc(item.description)}</p>` : ''}
                ${evidence?.sourceUrl
                  ? `<a class="small" href="${esc(evidence.sourceUrl)}" target="_blank" rel="noopener noreferrer">Ver evidencia</a>`
                  : ''}
              </div>
              ${options.editable
                ? `<button type="button" class="btn btn-ghost btn-sm btn-toggle-proof-wall" data-item-id="${esc(item.id)}" data-next-status="${item.status === 'complete' ? 'pending' : 'complete'}">
                     ${item.status === 'complete' ? 'Marcar pendiente' : 'Marcar listo'}
                   </button>`
                : `<span class="badge ${item.status === 'complete' ? 'badge-ready' : 'badge-pending'}">
                     ${item.status === 'complete' ? 'Listo' : 'Pendiente'}
                   </span>`}
            </li>
          `;
        }).join('')}
      </ul>
    </section>
  `;
}

export function renderServiceLinesReadOnly(clientId: string): string {
  const dossier = dbService.getMasterDossier(clientId);
  if (!dossier?.serviceLines?.length) {
    return `
      <section class="card">
        <div class="card-header">
          <div>
            <h3>Líneas de servicio</h3>
            <p class="muted small">Vista de referencia — tu manager mantiene el dossier maestro.</p>
          </div>
        </div>
        <p class="empty-state">Sin dossier de servicios cargado todavía.</p>
      </section>
    `;
  }

  return `
    <section class="card service-lines-card">
      <div class="card-header">
        <div>
          <h3>Líneas de servicio</h3>
          <p class="muted small">Dos vías §3.1–3.2: IP/Patentes y Adopción IA (solo lectura).</p>
        </div>
        ${icon('briefcase', 18)}
      </div>
      <div class="service-lines-grid">
        ${dossier.serviceLines.map((line) => `
          <article class="service-line-block">
            <h4>${esc(line.name)}</h4>
            <p class="muted small">${esc(line.description)}</p>
            <ul class="policy-list">
              ${line.offerings.map((offering) => `<li>${esc(offering)}</li>`).join('')}
            </ul>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}
