import { dbService } from '../services/db';
import { esc, escAttr } from '../lib/escape';
import {
  OBJECTIVE_KIND_LABELS,
  VOICE_DIMENSION_LABELS,
  formatAudienceLines,
  formatTerritoryLines,
  normalizeThesis,
  thesisCompleteness,
  assertThesisReadyForReview,
  type CompletenessBlock,
} from '../domain/thesisModelCore';
import {
  THESIS_EDITOR_STEP_LABELS,
  THESIS_EDITOR_STEPS,
  type ThesisEditorStep,
} from '../domain/thesisEditorCore';
import type { PositioningThesis, ThesisObjectiveKind, VoiceProfile } from '../types';

const OBJECTIVE_KINDS: ThesisObjectiveKind[] = [
  'BUSINESS',
  'THOUGHT_LEADERSHIP',
  'SPEAKING',
  'INSTITUTIONAL',
  'NETWORK',
];

type VoiceDimension = keyof typeof VOICE_DIMENSION_LABELS;

const VOICE_DIMENSIONS = Object.keys(VOICE_DIMENSION_LABELS) as VoiceDimension[];

export type { ThesisEditorStep };

export const FOCUS_TO_STEP: Record<string, ThesisEditorStep> = {
  identity: 'identity',
  identityCurrent: 'identity',
  perceptionTarget: 'identity',
  PERCEPTION: 'identity',
  audiences: 'audiences',
  AUDIENCE: 'audiences',
  territories: 'territories',
  TERRITORY: 'territories',
  objectives: 'objectives',
  voice: 'voice',
  voiceProfile: 'voice',
  limits: 'limits',
  proofPoints: 'limits',
  review: 'review',
};

function renderObjectiveInputs(thesis: PositioningThesis | null): string {
  const normalized = thesis ? normalizeThesis(thesis) : null;
  const byKind = new Map((normalized?.objectives || []).map((o) => [o.kind, o.weight]));

  return OBJECTIVE_KINDS.map((kind) => `
    <div class="objective-input">
      <label class="form-label" for="thesis-objective-${kind}">${esc(OBJECTIVE_KIND_LABELS[kind])}</label>
      <input type="number" min="0" max="100" step="5"
             id="thesis-objective-${kind}"
             class="form-input"
             data-objective-kind="${kind}"
             value="${byKind.get(kind) ?? 0}" />
    </div>
  `).join('');
}

function renderVoiceInputs(thesis: PositioningThesis | null): string {
  const voice: VoiceProfile | null = thesis ? normalizeThesis(thesis).voiceProfile : null;

  return VOICE_DIMENSIONS.map((key) => `
    <div class="voice-input">
      <label class="form-label" for="thesis-voice-${key}">${esc(VOICE_DIMENSION_LABELS[key])}</label>
      <input type="number" min="0" max="100" step="5"
             id="thesis-voice-${key}"
             class="form-input"
             data-voice-dimension="${key}"
             value="${voice ? voice[key] : 50}" />
    </div>
  `).join('');
}

function renderReviewPanel(existingThesis: PositioningThesis | null, clientId: string, active: boolean): string {
  const thesis = existingThesis;
  const completeness = thesis
    ? thesisCompleteness(thesis)
    : { score: 0, blocks: [] as CompletenessBlock[], missing: [] as CompletenessBlock[] };
  const readiness = thesis ? assertThesisReadyForReview(thesis) : { ready: false, blockers: ['Completa la tesis'], score: 0 };

  return `
    <fieldset class="thesis-fieldset${active ? ' thesis-fieldset-active' : ''}" data-thesis-panel="review">
      <legend>Resumen antes de enviar</legend>
      <p class="muted small">Revisa la estructura. Puedes guardar borrador o enviar al cliente cuando esté lista.</p>

      <div id="thesis-review-live">
        <div class="completeness-head">
          <strong class="completeness-value">${completeness.score}<span>/100</span></strong>
          <div class="progress-track">
            <div id="thesis-review-progress-fill" class="progress-fill ${completeness.score >= 70 ? 'progress-green' : completeness.score >= 40 ? '' : 'progress-red'}" style="width: ${completeness.score}%"></div>
          </div>
        </div>
        ${readiness.ready
          ? '<p class="info-strip">Lista para enviar al cliente.</p>'
          : `<p class="warn-strip">Pendiente: ${esc(readiness.blockers.slice(0, 5).join(' · '))}</p>`}
        ${completeness.missing.length
          ? `<ul class="completeness-missing">
               ${completeness.missing.map((block) => `
                 <li>
                   <strong>${esc(block.label)}</strong>
                   <button type="button" class="btn btn-ghost btn-sm btn-focus-thesis-block"
                           data-client-id="${escAttr(clientId)}"
                           data-thesis-id="${escAttr(thesis?.id || '')}"
                           data-focus-block="${escAttr(block.key || block.label)}">
                     Completar
                   </button>
                 </li>
               `).join('')}
             </ul>`
          : ''}
      </div>
    </fieldset>
  `;
}

export function renderThesisEditorModal(clientId: string, thesisId?: string, focusBlock?: string): string {
  const client = dbService.getClientById(clientId);
  const existingThesis = thesisId
    ? dbService.getThesesByClient(clientId).find((t) => t.id === thesisId) || null
    : null;
  const clientLabel = client?.displayName || client?.firstName || 'Cliente';
  const normalized = existingThesis ? normalizeThesis(existingThesis) : null;
  const initialStep = FOCUS_TO_STEP[focusBlock || ''] || 'identity';
  const initialCompleteness = existingThesis ? thesisCompleteness(existingThesis).score : 0;

  const steps = THESIS_EDITOR_STEPS.map((id) => ({ id, label: THESIS_EDITOR_STEP_LABELS[id] }));

  return `
    <div id="thesis-editor-modal" class="modal-overlay">
      <div class="modal-content modal-wide">
        <div class="modal-header">
          <div>
            <h3>${existingThesis ? 'Editar tesis de posicionamiento' : 'Nueva tesis de posicionamiento'}</h3>
            <p class="muted small">
              Wizard para <strong>${esc(clientLabel)}</strong>. Un bloque cada vez; el borrador no llega al cliente.
            </p>
          </div>
          <button id="btn-close-thesis-editor" class="btn btn-ghost btn-sm" aria-label="Cerrar">✕</button>
        </div>

        <div class="thesis-editor-progress">
          <span class="muted small">Estructura</span>
          <strong id="thesis-editor-progress-value">${initialCompleteness}<span>/100</span></strong>
          <div class="progress-track progress-track-sm">
            <div id="thesis-editor-progress-fill" class="progress-fill" style="width: ${initialCompleteness}%"></div>
          </div>
        </div>

        <nav class="thesis-step-nav" aria-label="Bloques de la tesis">
          ${steps.map((step) => `
            <button type="button"
                    class="thesis-step-chip${step.id === initialStep ? ' thesis-step-chip-active' : ''}"
                    data-thesis-step="${step.id}">
              ${esc(step.label)}
            </button>
          `).join('')}
        </nav>

        <form id="form-save-thesis" novalidate
              data-client-id="${escAttr(clientId)}"
              data-thesis-id="${escAttr(existingThesis?.id || '')}"
              data-thesis-current-step="${initialStep}">

          <fieldset class="thesis-fieldset${initialStep === 'identity' ? ' thesis-fieldset-active' : ''}" data-thesis-panel="identity">
            <legend>Identidad y percepción</legend>

            <div class="thesis-step-actions">
              <button type="button" id="btn-generate-thesis-proposal" class="btn btn-secondary btn-sm"
                      data-client-id="${escAttr(clientId)}">
                Generar propuesta desde perfil
              </button>
            </div>

            <div class="form-group">
              <label class="form-label" for="thesis-title">Título de la tesis</label>
              <input type="text" id="thesis-title" class="form-input" value="${escAttr(existingThesis?.title || '')}"
                     placeholder="Ej. Enterprise AI Adoption & Governance" required />
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label" for="thesis-identity-current">Identidad actual</label>
                <textarea id="thesis-identity-current" class="form-textarea" rows="2"
                          placeholder="Lo que el mercado ya reconoce hoy">${esc(existingThesis?.identityCurrent || '')}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label" for="thesis-expert-identity">Identidad objetivo</label>
                <textarea id="thesis-expert-identity" class="form-textarea" rows="2"
                          placeholder="La autoridad que queremos construir" required>${esc(existingThesis?.expertIdentity || '')}</textarea>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="thesis-perception-target">Percepción objetivo</label>
              <textarea id="thesis-perception-target" class="form-textarea" rows="2"
                        placeholder="Qué debe pensar la audiencia al oír su nombre">${esc(existingThesis?.perceptionTarget || '')}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label" for="thesis-differentiator">Ángulo diferenciador</label>
              <input type="text" id="thesis-differentiator" class="form-input"
                     value="${escAttr(existingThesis?.differentiator || '')}"
                     placeholder="Ej. Intersección derecho × ingeniería × riesgo" />
            </div>
          </fieldset>

          <fieldset class="thesis-fieldset${initialStep === 'audiences' ? ' thesis-fieldset-active' : ''}" data-thesis-panel="audiences">
            <legend>Audiencias</legend>
            <p class="muted small">Una por línea: <code>Nombre | nivel | peso</code>. Niveles: comercial, influencia, amplificación.</p>
            <div class="form-group">
              <label class="form-label" for="thesis-audiences">Audiencias estructuradas</label>
              <textarea id="thesis-audiences" class="form-textarea" rows="5"
                        placeholder="General Counsel | comercial | 95&#10;State Bar | influencia | 70">${esc(normalized ? formatAudienceLines(normalized.audiences) : '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="thesis-target-audience">Resumen de audiencia (texto libre)</label>
              <textarea id="thesis-target-audience" class="form-textarea" rows="2">${esc(existingThesis?.targetAudience || '')}</textarea>
            </div>
          </fieldset>

          <fieldset class="thesis-fieldset${initialStep === 'territories' ? ' thesis-fieldset-active' : ''}" data-thesis-panel="territories">
            <legend>Territorios</legend>
            <p class="muted small">Una por línea: <code>Nombre | peso | pilar</code>.</p>
            <div class="form-group">
              <label class="form-label" for="thesis-territories">Territorios ponderados</label>
              <textarea id="thesis-territories" class="form-textarea" rows="5"
                        placeholder="AI Adoption | 100 | Adopción">${esc(normalized ? formatTerritoryLines(normalized.territories) : '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="thesis-domain">Dominio (texto libre)</label>
              <input type="text" id="thesis-domain" class="form-input" value="${escAttr(existingThesis?.domain || '')}" />
            </div>
          </fieldset>

          <fieldset class="thesis-fieldset${initialStep === 'objectives' ? ' thesis-fieldset-active' : ''}" data-thesis-panel="objectives">
            <legend>Objetivos</legend>
            <p class="muted small">Reparte 100 puntos.</p>
            <div class="objective-grid">${renderObjectiveInputs(existingThesis)}</div>
            <div class="form-group">
              <label class="form-label" for="thesis-objective">Objetivo (texto libre)</label>
              <input type="text" id="thesis-objective" class="form-input" value="${escAttr(existingThesis?.objective || '')}" />
            </div>
          </fieldset>

          <fieldset class="thesis-fieldset${initialStep === 'voice' ? ' thesis-fieldset-active' : ''}" data-thesis-panel="voice">
            <legend>Voz</legend>
            <div class="voice-input-grid">${renderVoiceInputs(existingThesis)}</div>
            <div class="form-group">
              <label class="form-label" for="thesis-voice-style">Estilo y notas de voz</label>
              <textarea id="thesis-voice-style" class="form-textarea" rows="2">${esc(existingThesis?.voiceAndTone || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="thesis-voice-avoid">Evitar en la voz (uno por línea)</label>
              <textarea id="thesis-voice-avoid" class="form-textarea" rows="2">${esc((normalized?.voiceProfile.avoid || []).join('\n'))}</textarea>
            </div>
          </fieldset>

          <fieldset class="thesis-fieldset${initialStep === 'limits' ? ' thesis-fieldset-active' : ''}" data-thesis-panel="limits">
            <legend>Evidencia y límites</legend>
            <div class="form-group">
              <label class="form-label" for="thesis-proof-points">Proof points (uno por línea)</label>
              <textarea id="thesis-proof-points" class="form-textarea" rows="4">${esc((existingThesis?.proofPoints || []).join('\n'))}</textarea>
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label" for="thesis-limits-hard">Límites duros</label>
                <textarea id="thesis-limits-hard" class="form-textarea" rows="4">${esc((normalized?.limits.hardBlocks || []).join('\n'))}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label" for="thesis-limits-soft">Límites blandos</label>
                <textarea id="thesis-limits-soft" class="form-textarea" rows="4">${esc((normalized?.limits.softAvoid || []).join('\n'))}</textarea>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="thesis-compliance">Compliance deontológico</label>
              <input type="text" id="thesis-compliance" class="form-input" value="${escAttr(existingThesis?.complianceRules || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="thesis-priority">Prioridad entre tesis</label>
              <input type="number" id="thesis-priority" class="form-input" min="0" max="100" step="10"
                     value="${existingThesis?.priority ?? 50}" />
            </div>
          </fieldset>

          ${renderReviewPanel(existingThesis, clientId, initialStep === 'review')}

          <div class="modal-footer thesis-editor-footer">
            <button type="button" id="btn-thesis-prev" class="btn btn-secondary"${initialStep === 'identity' ? ' disabled' : ''}>← Anterior</button>
            <button type="button" id="btn-thesis-next" class="btn btn-secondary"${initialStep === 'review' ? ' disabled' : ''}>Siguiente →</button>
            <span class="thesis-editor-footer-spacer"></span>
            <button type="button" id="btn-cancel-thesis-editor" class="btn btn-secondary">Cancelar</button>
            <button type="submit" class="btn btn-secondary" data-thesis-intent="draft">Guardar borrador</button>
            <button type="submit" class="btn btn-primary" data-thesis-intent="submit_review">Enviar al cliente</button>
          </div>
        </form>
      </div>
    </div>
  `;
}
