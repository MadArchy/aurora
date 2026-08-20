import { dbService } from '../services/db';
import { esc, escAttr } from '../lib/escape';

export function renderThesisEditorModal(clientId: string, thesisId?: string): string {
  const client = dbService.getClientById(clientId);
  const existingThesis = thesisId ? dbService.getThesesByClient(clientId).find(t => t.id === thesisId) : null;
  const clientLabel = client?.displayName || client?.firstName || 'Cliente';

  return `
    <div id="thesis-editor-modal" class="modal-overlay">
      <div class="modal-content" style="max-width: 820px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
          <div>
            <h3>${existingThesis ? 'Editar Tesis de Posicionamiento' : 'Crear Nueva Tesis de Posicionamiento'}</h3>
            <p style="font-size: 0.85rem; color: var(--text-secondary);">
              Fórmula Maestra de Posicionamiento para <strong>${esc(clientLabel)}</strong> (F8-D08)
            </p>
          </div>
          <button id="btn-close-thesis-editor" class="btn btn-secondary btn-sm" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;">✕</button>
        </div>

        <form id="form-save-thesis" data-client-id="${escAttr(clientId)}" data-thesis-id="${escAttr(existingThesis?.id || '')}">
          <!-- Title -->
          <div class="form-group">
            <label class="form-label">Título de la Campaña / Tesis</label>
            <input type="text" id="thesis-title" class="form-input" value="${escAttr(existingThesis?.title || '')}" placeholder="Ej. Autoridad en Gobernanza de IA y Ciberseguridad Legal" required />
          </div>

          <!-- Formula Variable 1 & 2 -->
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">1. Identidad Experta Objetivo (Expert Identity)</label>
              <textarea id="thesis-expert-identity" class="form-textarea" rows="2" placeholder="Ej. Abogado líder y estratega regulatorio en Gobernanza de IA..." required>${esc(existingThesis?.expertIdentity || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">2. Audiencia Primaria (Target Audience)</label>
              <textarea id="thesis-target-audience" class="form-textarea" rows="2" placeholder="Ej. General Counsel, Directores de Cumplimiento y CIOs..." required>${esc(existingThesis?.targetAudience || '')}</textarea>
            </div>
          </div>

          <!-- Formula Variable 3 & 4 -->
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">3. Dominio Disciplinar / Nicho (Domain)</label>
              <input type="text" id="thesis-domain" class="form-input" value="${escAttr(existingThesis?.domain || '')}" placeholder="Ej. Regulación de IA (EU AI Act, NIST), Litigios de Ciberseguridad" required />
            </div>
            <div class="form-group">
              <label class="form-label">4. Objetivo Estratégico (Strategic Purpose)</label>
              <input type="text" id="thesis-objective" class="form-input" value="${escAttr(existingThesis?.objective || '')}" placeholder="Ej. Desarrollo de práctica legal corporativa y comités directivos" required />
            </div>
          </div>

          <!-- Formula Variable 5 & 6 -->
          <div class="form-group">
            <label class="form-label">5. Evidencias & Proof Points (Respaldos Reales)</label>
            <textarea id="thesis-proof-points" class="form-textarea" rows="3" placeholder="Ingresa un proof point por línea:&#10;LL.M. Stanford Law School&#10;Asesor de 3 unicornios fintech...">${esc((existingThesis?.proofPoints || []).join('\n'))}</textarea>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">6. Perspectiva Diferenciadora (Differentiator)</label>
              <input type="text" id="thesis-differentiator" class="form-input" value="${escAttr(existingThesis?.differentiator || '')}" placeholder="Ej. Enfoque preventivo combinando ingeniería y derecho comparado" />
            </div>
            <div class="form-group">
              <label class="form-label">7. Límites Éticos & Compliance Deontológico</label>
              <input type="text" id="thesis-compliance" class="form-input" value="${escAttr(existingThesis?.complianceRules || '')}" placeholder="Ej. No prometer resultados garantizados, secreto profesional" />
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
            <button type="button" id="btn-cancel-thesis-editor" class="btn btn-secondary">Cancelar</button>
            <button type="submit" class="btn btn-primary">
              💾 Guardar y Activar Tesis
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}
