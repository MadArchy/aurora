import { dbService } from '../services/db';
import { getSourceSuggestions } from '../services/sourceSuggestions';
import { esc } from '../lib/escape';

function renderSuggestionHint(clientId: string): string {
  const client = dbService.getClientById(clientId);
  if (!client) return '';

  const thesis = dbService.getThesesByClient(clientId).find((t) => t.status === 'ACTIVE');
  const suggestions = getSourceSuggestions(client, thesis);

  return `
    <aside class="source-suggestion-hint">
      <div class="source-suggestion-hint-head">
        <div>
          <p class="form-label" style="margin-bottom: 0.2rem;">Según Posicionamiento</p>
          ${thesis
            ? `<p class="muted small">${esc(thesis.domain)} · ${esc(thesis.title.slice(0, 55))}${thesis.title.length > 55 ? '…' : ''}</p>`
            : `<p class="muted small">Sin tesis activa. <button type="button" class="link-btn" data-tab="ws-positioning">Completar perfil</button></p>`}
        </div>
      </div>
      <p class="muted small" style="margin: 0.5rem 0;">Pulsa una sugerencia para prellenar el formulario:</p>
      <div class="source-suggestion-chips">
        ${suggestions.map((s) => `
          <button type="button"
                  class="source-suggestion-chip btn-apply-source-suggestion"
                  data-suggestion-type="${esc(s.type)}"
                  data-suggestion-name="${esc(s.nameHint)}"
                  title="Tipo: ${esc(s.type)}">
            ${esc(s.label)}
          </button>
        `).join('')}
      </div>
    </aside>
  `;
}

export function renderSourceRegistryModal(clientId?: string): string {
  const client = clientId ? dbService.getClientById(clientId) : null;
  const sources = clientId ? dbService.getSourcesByClient(clientId) : dbService.getSources();
  const thesis = clientId ? dbService.getThesesByClient(clientId).find((t) => t.status === 'ACTIVE') : undefined;

  return `
    <div id="source-registry-modal" class="modal-overlay">
      <div class="modal-content" style="max-width: 820px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
          <div>
            <h3>${client ? `Nueva fuente para ${esc(client.displayName)}` : 'Registro de fuentes'}</h3>
            <p style="font-size: 0.85rem; color: var(--text-secondary);">
              ${client
                ? `La fuente quedará ligada a este cliente${thesis ? ` y su tesis «${esc(thesis.title)}»` : ''}.`
                : 'Catálogo de orígenes de información (RSS, regulatorio, académico).'}
            </p>
          </div>
          <button id="btn-close-source-registry" class="btn btn-secondary btn-sm" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;">✕</button>
        </div>

        ${clientId ? renderSuggestionHint(clientId) : ''}

        <form id="form-add-source" data-client-id="${esc(clientId || '')}" style="background: var(--bg-surface); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-medium); margin-bottom: 1.5rem;">
          <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem;">Registrar origen de información</h4>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label" for="src-name">Nombre</label>
              <input type="text" id="src-name" class="form-input" placeholder="Ej. Boletín regulatorio del sector" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="src-type">Tipo</label>
              <select id="src-type" class="form-select">
                <option value="REGULATORY">Regulatorio (BOE, NIST, organismos)</option>
                <option value="RSS">RSS (noticias o blogs)</option>
                <option value="ACADEMIC">Académico (journal, repositorio)</option>
                <option value="MEDIA">Medios y prensa especializada</option>
                <option value="MANUAL">Manual (notas internas)</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="src-url">URL del feed (opcional)</label>
            <input type="url" id="src-url" class="form-input" placeholder="https://..." />
          </div>
          <div style="display: flex; justify-content: flex-end;">
            <button type="submit" class="btn btn-primary btn-sm">+ Agregar fuente</button>
          </div>
        </form>

        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h4 style="font-size: 0.95rem; color: var(--accent-primary);">
              Fuentes activas (${sources.length})
            </h4>
            ${clientId ? `<button id="btn-poll-all-sources" class="btn btn-secondary btn-sm">Ingerir todas ahora</button>` : ''}
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 250px; overflow-y: auto;">
            ${sources.length
              ? sources.map((s) => `
                <div class="source-row" style="padding: 0.75rem 1rem; background: var(--bg-surface-raised); border-radius: var(--radius-sm);">
                  <div>
                    <strong style="font-size: 0.9rem;">${esc(s.name)}</strong>
                    <span class="badge badge-progress" style="font-size: 0.72rem;">${esc(s.type)}</span>
                    <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem;">
                      ${esc(s.url || 'Entrada manual')} · cada ${s.fetchIntervalMinutes} min
                    </p>
                  </div>
                  ${s.url ? `<button class="btn btn-secondary btn-sm btn-poll-one-source" data-source-id="${esc(s.id)}">Ingerir</button>` : ''}
                </div>
              `).join('')
              : '<p class="empty-state small">Sin fuentes registradas todavía.</p>'}
          </div>
        </div>
      </div>
    </div>
  `;
}
