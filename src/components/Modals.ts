import { dbService } from '../services/db';
import { esc, escAttr, nl2br } from '../lib/escape';

export function renderTeleprompterModal(taskId: string): string {
  const task = dbService.getAllTasks().find(t => t.id === taskId);
  const scriptText = task?.scriptPayload || 'Guion no disponible.';

  return `
    <div id="teleprompter-modal" class="modal-overlay teleprompter-overlay">
      <div class="modal-content teleprompter-modal">
        <header class="teleprompter-header">
          <div>
            <h3>Teleprompter y grabación</h3>
            <p class="muted small">${esc(task?.title || 'Grabación de video')}</p>
          </div>
          <button id="btn-close-teleprompter" class="btn btn-secondary btn-sm teleprompter-close" type="button" aria-label="Cerrar">✕</button>
        </header>

        <div class="teleprompter-layout">
          <div class="teleprompter-media">
            <video id="teleprompter-camera" class="teleprompter-camera" autoplay muted playsinline></video>
            <video id="teleprompter-preview" class="teleprompter-preview hidden" playsinline controls></video>
            <div id="teleprompter-recording-indicator" class="teleprompter-rec-indicator hidden" aria-live="polite">
              <span class="teleprompter-rec-dot"></span> Grabando
            </div>
            <p id="teleprompter-camera-hint" class="teleprompter-camera-hint muted small">
              Activa cámara y micrófono. Ideal en móvil en vertical.
            </p>
          </div>

          <div class="teleprompter-container">
            <div class="teleprompter-cue"></div>
            <div id="teleprompter-scroll-area" class="teleprompter-glass">
              <p id="teleprompter-text-node" class="teleprompter-text">
                ${nl2br(scriptText)}
              </p>
            </div>
          </div>
        </div>

        <div id="teleprompter-phase-record" class="teleprompter-controls">
          <button id="btn-teleprompter-play" class="btn btn-primary btn-sm" type="button">
            Iniciar desplazamiento
          </button>
          <label class="teleprompter-speed-control">
            <span class="muted small">Velocidad</span>
            <input id="teleprompter-speed" type="range" min="1" max="5" value="2" />
          </label>
          <button id="btn-start-recording" class="btn btn-danger btn-sm" type="button">
            Grabar
          </button>
          <button id="btn-stop-recording" class="btn btn-secondary btn-sm hidden" type="button">
            Detener
          </button>
        </div>

        <div id="teleprompter-phase-preview" class="teleprompter-controls teleprompter-preview-controls hidden">
          <p class="muted small teleprompter-preview-copy">Revisa tu toma antes de enviarla al manager.</p>
          <button id="btn-retake-recording" class="btn btn-secondary btn-sm" type="button">
            Volver a grabar
          </button>
          <button id="btn-confirm-send-recording" class="btn btn-success btn-sm" data-task-id="${escAttr(taskId)}" type="button">
            Enviar video al manager
          </button>
        </div>
      </div>
    </div>
  `;
}

export function renderCreateClientModal(): string {
  return `
    <div id="create-client-modal" class="modal-overlay">
      <div class="modal-content">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h3>Crear Nuevo Cliente (Módulo B)</h3>
          <button id="btn-close-create-client" class="btn btn-secondary btn-sm" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;">✕</button>
        </div>

        <form id="form-create-client">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Nombre</label>
              <input type="text" id="new-client-firstname" class="form-input" required placeholder="Ej. Carlos" />
            </div>
            <div class="form-group">
              <label class="form-label">Apellido</label>
              <input type="text" id="new-client-lastname" class="form-input" required placeholder="Ej. Mendoza" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Correo Electrónico</label>
            <input type="email" id="new-client-email" class="form-input" required placeholder="carlos@despacho.com" />
          </div>

          <div class="form-group">
            <label class="form-label">Profesión / Especialidad</label>
            <input type="text" id="new-client-profession" class="form-input" required placeholder="Abogado en Fusiones y Adquisiciones (M&A)" />
          </div>

          <div class="form-group">
            <label class="form-label">Empresa / Firma</label>
            <input type="text" id="new-client-company" class="form-input" placeholder="Mendoza & Asociados" />
          </div>

          <div class="form-group">
            <label class="form-label">Mercado / Audiencia Objetivo</label>
            <input type="text" id="new-client-target" class="form-input" required placeholder="Fondos de Private Equity y Directores Financieros" />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
            <button type="button" id="btn-cancel-create-client" class="btn btn-secondary">Cancelar</button>
            <button type="submit" class="btn btn-primary">Crear e Invitar Cliente</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function renderComparativeModal(result: any): string {
  return `
    <div id="comparative-modal" class="modal-overlay">
      <div class="modal-content" style="max-width: 850px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h3>⚖️ Síntesis Dual y Análisis Comparativo (Doc 10)</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Consenso entre OpenAI GPT-4o y Claude 3.7 Sonnet con mitigación de alucinaciones.</p>
          </div>
          <button id="btn-close-comparative" class="btn btn-secondary btn-sm" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;">✕</button>
        </div>

        <div class="grid-2" style="margin-bottom: 1.25rem;">
          <div style="background: var(--bg-surface); padding: 1.15rem; border-radius: var(--radius-md); border-top: 3px solid #10a37f;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <strong style="color: #10a37f; font-size: 0.9rem;">OpenAI GPT-4o</strong>
              <span class="badge badge-progress" style="font-size: 0.75rem;">Operativo</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">${esc(result.openaiOutput)}</p>
          </div>

          <div style="background: var(--bg-surface); padding: 1.15rem; border-radius: var(--radius-md); border-top: 3px solid #d97706;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <strong style="color: #d97706; font-size: 0.9rem;">Anthropic Claude 3.7</strong>
              <span class="badge badge-ready" style="font-size: 0.75rem;">Dialéctico</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">${esc(result.claudeOutput)}</p>
          </div>
        </div>

        <div style="background: var(--bg-surface-raised); padding: 1.25rem; border-radius: var(--radius-md); border-left: 3px solid var(--accent-primary); margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong style="color: var(--text-primary); font-size: 0.95rem;">💡 Síntesis Estratégica Recomendada</strong>
            <span class="badge badge-ready">Consenso: ${result.consensusScore}%</span>
          </div>
          <p style="font-size: 0.9rem; color: var(--text-primary); margin-bottom: 0.5rem;">${esc(result.synthesizedRecommendation)}</p>
          <p style="font-size: 0.8rem; color: var(--text-muted);"><strong>Divergencia:</strong> ${esc(result.divergenceSummary)}</p>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button id="btn-close-comparative-bottom" class="btn btn-primary">Entendido y Aplicar Síntesis</button>
        </div>
      </div>
    </div>
  `;
}

export function renderChallengeModal(thesisTitle: string, challenge: any): string {
  return `
    <div id="challenge-modal" class="modal-overlay">
      <div class="modal-content" style="max-width: 650px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h3>⚔️ The Thesis Challenger Agent (Doc 10)</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">${esc(thesisTitle)}</p>
          </div>
          <button id="btn-close-challenge" class="btn btn-secondary btn-sm" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;">✕</button>
        </div>

        <div style="background: var(--bg-surface); padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span class="badge badge-ready">Estado: ${esc(challenge.status)}</span>
            <span style="font-size: 0.85rem; color: #10b981; font-weight: 700;">Riesgo de Saturación: ${esc(challenge.riskScore)}% (Bajo)</span>
          </div>
          <ul style="padding-left: 1.25rem; font-size: 0.88rem; color: var(--text-secondary); line-height: 1.8;">
            ${(challenge.recommendations || []).map((r: string) => `<li>${esc(r)}</li>`).join('')}
          </ul>
        </div>

        <div style="display: flex; justify-content: flex-end;">
          <button id="btn-close-challenge-bottom" class="btn btn-primary">Cerrar Diagnóstico</button>
        </div>
      </div>
    </div>
  `;
}

export function renderAddEvidenceModal(clientId: string): string {
  return `
    <div id="add-evidence-modal" class="modal-overlay">
      <div class="modal-content">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h3>Añadir Evidencia al Vault (F7-D07 / F8-D08)</h3>
          <button id="btn-close-evidence" class="btn btn-secondary btn-sm" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;">✕</button>
        </div>

        <form id="form-add-evidence" data-client-id="${clientId}">
          <div class="form-group">
            <label class="form-label">Título de la Evidencia o Credencial</label>
            <input type="text" id="evidence-title" class="form-input" required placeholder="Ej. Certificación Internacional en Ciberseguridad NIST" />
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Tipo de Evidencia</label>
              <select id="evidence-type" class="form-select">
                <option value="CERTIFICATION">Certificación / Título</option>
                <option value="ACADEMIC_PAPER">Artículo Académico / Paper</option>
                <option value="CASE_STUDY">Caso de Éxito Corporativo</option>
                <option value="MEDIA_MENTION">Mención en Prensa de Prestigio</option>
                <option value="METRIC">Métrica de Impacto Comprobable</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Nivel de Confianza (%)</label>
              <input type="number" id="evidence-confidence" class="form-input" value="95" min="1" max="100" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Enlace de Verificación / URL</label>
            <input type="url" id="evidence-url" class="form-input" placeholder="https://..." />
          </div>

          <div class="form-group">
            <label class="form-label">Extracto o Resumen Verificable</label>
            <textarea id="evidence-snippet" class="form-textarea" rows="3" required placeholder="Detalle concreto de la credencial o cita para ser utilizada por los agentes de IA sin alucinaciones..."></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
            <button type="button" id="btn-cancel-evidence" class="btn btn-secondary">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar en Evidence Vault</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function renderArticleReviewModal(contentId: string, taskId?: string): string {
  const content = dbService.getContentById(contentId);
  if (!content) return '';

  const wordCount = content.body.trim().split(/\s+/).filter(Boolean).length;

  return `
    <div id="article-review-modal" class="modal-overlay">
      <div class="modal-content article-review-modal">
        <header class="article-review-header">
          <div>
            <h3>Revisar artículo en tu voz</h3>
            <p class="muted small">${esc(content.title)} · ${esc(content.targetPlatform)} · ~${wordCount} palabras</p>
          </div>
          <button id="btn-close-article-review" class="btn btn-secondary btn-sm teleprompter-close" type="button" aria-label="Cerrar">✕</button>
        </header>

        ${content.managerNotes
          ? `<div class="article-review-notes">
               <strong>Indicaciones del manager</strong>
               <p class="muted small">${esc(content.managerNotes)}</p>
             </div>`
          : ''}

        <form id="form-article-review" data-content-id="${escAttr(contentId)}" data-task-id="${escAttr(taskId || '')}">
          <div class="form-group">
            <label class="form-label" for="article-review-title">Título</label>
            <input id="article-review-title" class="form-input" value="${escAttr(content.title)}" required />
          </div>

          <div class="form-group">
            <label class="form-label" for="article-review-body">Cuerpo del artículo</label>
            <textarea id="article-review-body" class="form-textarea article-review-body" rows="16" required>${esc(content.body)}</textarea>
            <p class="muted small">Edita el borrador para que suene a ti. Al guardar registramos los cambios para tu Brand Manager.</p>
          </div>

          <div class="article-review-actions">
            <button type="button" id="btn-article-reject" class="btn btn-secondary" data-content-id="${escAttr(contentId)}" data-task-id="${escAttr(taskId || '')}">
              Rechazar con motivo
            </button>
            <div class="article-review-actions-main">
              <button type="submit" class="btn btn-secondary" name="action" value="save">Guardar cambios</button>
              <button type="button" id="btn-article-approve" class="btn btn-success" data-content-id="${escAttr(contentId)}" data-task-id="${escAttr(taskId || '')}">
                Aprobar y enviar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function renderContentDiffModal(contentId: string): string {
  const content = dbService.getContentById(contentId);
  if (!content) return '';

  const events = dbService.getFeedbackEventsForContent(contentId);
  const latestEdit = events.find((event) => event.kind === 'CLIENT_EDIT');
  const latestReject = events.find((event) => event.kind === 'CLIENT_REJECT');
  const latestApprove = events.find((event) => event.kind === 'CLIENT_APPROVE');

  return `
    <div id="content-diff-modal" class="modal-overlay">
      <div class="modal-content content-diff-modal">
        <header class="article-review-header">
          <div>
            <h3>Cambios del cliente</h3>
            <p class="muted small">${esc(content.title)}</p>
          </div>
          <button id="btn-close-content-diff" class="btn btn-secondary btn-sm teleprompter-close" type="button" aria-label="Cerrar">✕</button>
        </header>

        ${latestEdit?.diffSummary
          ? `<div class="diff-summary-bar">
               <span class="badge badge-progress">+${latestEdit.diffSummary.added} líneas</span>
               <span class="badge badge-pending">−${latestEdit.diffSummary.removed} líneas</span>
               <span class="muted small">${latestEdit.diffSummary.unchanged} sin cambio</span>
             </div>`
          : ''}

        ${latestReject?.reason
          ? `<div class="article-review-notes warn">
               <strong>Rechazado por el cliente</strong>
               <p>${esc(latestReject.reason)}</p>
             </div>`
          : ''}

        ${latestApprove
          ? `<p class="muted small">Aprobado ${new Date(latestApprove.createdAt).toLocaleString('es')}</p>`
          : ''}

        <div class="diff-viewport">
          ${latestEdit?.diffHtml || '<p class="empty-state">El cliente aún no ha editado este borrador.</p>'}
        </div>

        <div class="article-review-actions">
          <button type="button" id="btn-close-content-diff-bottom" class="btn btn-secondary">Cerrar</button>
          <button type="button" class="btn btn-primary btn-open-content-editor" data-content-id="${escAttr(contentId)}">
            Abrir editor manager
          </button>
        </div>
      </div>
    </div>
  `;
}

export function renderContentEditorModal(contentId: string): string {
  const content = dbService.getContentById(contentId);
  if (!content) return '';

  return `
    <div id="content-editor-modal" class="modal-overlay">
      <div class="modal-content" style="max-width: 800px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h3>📝 Editor y Validador de Contenido (Doc 13 & 14)</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Revisa, pule el tono y ajusta el estado del entregable de autoridad.</p>
          </div>
          <button id="btn-close-content-editor" class="btn btn-secondary btn-sm" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;">✕</button>
        </div>

        <form id="form-edit-content" data-content-id="${content.id}">
          <div class="form-group">
            <label class="form-label">Título del Contenido</label>
            <input type="text" id="edit-content-title" class="form-input" value="${escAttr(content.title)}" required />
          </div>

          <div class="grid-3">
            <div class="form-group">
              <label class="form-label">Plataforma Destino</label>
              <select id="edit-content-platform" class="form-select">
                <option value="LinkedIn" ${content.targetPlatform === 'LinkedIn' ? 'selected' : ''}>LinkedIn</option>
                <option value="YouTube" ${content.targetPlatform === 'YouTube' ? 'selected' : ''}>YouTube (Video)</option>
                <option value="Substack" ${content.targetPlatform === 'Substack' ? 'selected' : ''}>Substack / Newsletter</option>
                <option value="LegalJournal" ${content.targetPlatform === 'LegalJournal' ? 'selected' : ''}>Revista Especializada</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Formato</label>
              <select id="edit-content-type" class="form-select">
                <option value="VIDEO_SCRIPT" ${content.type === 'VIDEO_SCRIPT' ? 'selected' : ''}>Guion de Video (Teleprompter)</option>
                <option value="LINKEDIN_ARTICLE" ${content.type === 'LINKEDIN_ARTICLE' ? 'selected' : ''}>Artículo de Fondo</option>
                <option value="THOUGHT_LEADERSHIP" ${content.type === 'THOUGHT_LEADERSHIP' ? 'selected' : ''}>Columna de Opinión</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Estado de Aprobación</label>
              <select id="edit-content-status" class="form-select">
                <option value="DRAFT" ${content.status === 'DRAFT' ? 'selected' : ''}>DRAFT (Borrador)</option>
                <option value="CLIENT_REVIEW" ${content.status === 'CLIENT_REVIEW' ? 'selected' : ''}>CLIENT_REVIEW (En Revisión del Cliente)</option>
                <option value="CHANGES_REQUESTED" ${content.status === 'CHANGES_REQUESTED' ? 'selected' : ''}>CHANGES_REQUESTED (Ajustes Solicitados)</option>
                <option value="READY" ${content.status === 'READY' ? 'selected' : ''}>READY (Listo para Publicar)</option>
                <option value="PUBLISHED" ${content.status === 'PUBLISHED' ? 'selected' : ''}>PUBLISHED (Publicado)</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Cuerpo del Contenido / Guion Teleprompter</label>
            <textarea id="edit-content-body" class="form-textarea" rows="10" style="font-family: var(--font-mono); font-size: 0.88rem;" required>${esc(content.body)}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Notas del Brand Manager / Indicaciones de Grabación</label>
            <input type="text" id="edit-content-notes" class="form-input" value="${escAttr(content.managerNotes || '')}" placeholder="Ej. Grabar con energía en los primeros 8 segundos..." />
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
            <span style="font-size: 0.8rem; color: var(--text-muted);">
              Última edición: ${new Date(content.updatedAt).toLocaleTimeString()}
            </span>
            <div style="display: flex; gap: 0.75rem;">
              <button type="button" id="btn-cancel-content-editor" class="btn btn-secondary">Cancelar</button>
              <button type="submit" class="btn btn-primary">💾 Guardar Cambios</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function renderFeedbackModal(targetId: string, itemType: 'TASK' | 'OPPORTUNITY' | 'CONTENT', taskId?: string): string {
  const title = itemType === 'CONTENT'
    ? 'Indica el motivo del rechazo'
    : 'Solicitar ajustes o registrar motivo';
  const subtitle = itemType === 'CONTENT'
    ? 'El motivo es obligatorio. Tu Brand Manager verá el diff y tus observaciones.'
    : 'Tus observaciones serán enviadas al Brand Manager para afinar la propuesta.';

  return `
    <div id="feedback-modal" class="modal-overlay">
      <div class="modal-content" style="max-width: 550px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <div>
            <h3>${title}</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">${subtitle}</p>
          </div>
          <button id="btn-close-feedback" class="btn btn-secondary btn-sm" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;">✕</button>
        </div>

        <form id="form-submit-feedback" data-target-id="${targetId}" data-type="${itemType}" data-task-id="${escAttr(taskId || '')}">
          <div class="form-group">
            <label class="form-label">${itemType === 'CONTENT' ? 'Motivo del rechazo' : 'Detalle de las observaciones / cambios requeridos'}</label>
            <textarea id="feedback-notes" class="form-textarea" rows="4" required placeholder="${itemType === 'CONTENT' ? 'Ej. El tono es demasiado comercial; prefiero un enfoque más técnico en la sección 2…' : 'Ej. Me gustaría enfatizar más el aspecto de la inversión de la carga de la prueba…'}"></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem;">
            <button type="button" id="btn-cancel-feedback" class="btn btn-secondary">Cancelar</button>
            <button type="submit" class="btn btn-primary">${itemType === 'CONTENT' ? 'Enviar rechazo' : 'Enviar observaciones'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function renderContentPreviewModal(contentId: string): string {
  const content = dbService.getContentById(contentId);
  if (!content) return '';

  return `
    <div id="content-preview-modal" class="modal-overlay">
      <div class="modal-content" style="max-width: 720px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <div>
            <h3>Vista previa del contenido</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Solo lectura. Para editar, tu Brand Manager usa el editor de producción.</p>
          </div>
          <button id="btn-close-content-preview" class="btn btn-secondary btn-sm" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;">✕</button>
        </div>

        <div class="field-block">
          <label class="form-label">Título</label>
          <p>${esc(content.title)}</p>
        </div>
        <div class="grid-3" style="margin-bottom: 1rem;">
          <div class="field-block">
            <label class="form-label">Plataforma</label>
            <p>${esc(content.targetPlatform)}</p>
          </div>
          <div class="field-block">
            <label class="form-label">Formato</label>
            <p>${esc(content.type)}</p>
          </div>
          <div class="field-block">
            <label class="form-label">Estado</label>
            <p><span class="badge badge-progress">${esc(content.status)}</span></p>
          </div>
        </div>
        <div class="field-block">
          <label class="form-label">Contenido</label>
          <div style="background: var(--bg-surface); padding: 1rem; border-radius: var(--radius-md); white-space: pre-wrap; font-size: 0.9rem; max-height: 320px; overflow-y: auto;">
            ${nl2br(content.body)}
          </div>
        </div>
        ${content.managerNotes
          ? `<div class="field-block"><label class="form-label">Notas del manager</label><p class="muted small">${esc(content.managerNotes)}</p></div>`
          : ''}

        <div style="display: flex; justify-content: flex-end; margin-top: 1.25rem;">
          <button type="button" id="btn-close-content-preview-bottom" class="btn btn-primary">Cerrar</button>
        </div>
      </div>
    </div>
  `;
}

export function renderAddTaskModal(clientId: string): string {
  const client = dbService.getClientById(clientId);
  const theses = dbService.getThesesByClient(clientId);
  const thesis = theses.find((t) => t.status === 'ACTIVE') || theses[0];

  return `
    <div id="add-task-modal" class="modal-overlay">
      <div class="modal-content" style="max-width: 560px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <div>
            <h3>Asignar tarea al cliente</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">
              ${client ? esc(client.displayName) : 'Cliente'} verá esta tarea en su portal de inmediato.
            </p>
          </div>
          <button id="btn-close-add-task" class="btn btn-secondary btn-sm" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;">✕</button>
        </div>

        <form id="form-add-task" data-client-id="${esc(clientId)}" data-thesis-id="${esc(thesis?.id || '')}">
          <div class="form-group">
            <label class="form-label" for="task-title">Título</label>
            <input type="text" id="task-title" class="form-input" required placeholder="Ej. Grabar video sobre el nuevo marco regulatorio de IA" />
          </div>

          <div class="form-group">
            <label class="form-label" for="task-description">Instrucciones para el cliente</label>
            <textarea id="task-description" class="form-textarea" rows="3" required placeholder="Qué debe hacer y con qué enfoque."></textarea>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label" for="task-type">Tipo de tarea</label>
              <select id="task-type" class="form-select">
                <option value="RECORD_VIDEO">Grabar video</option>
                <option value="REVIEW_ARTICLE">Revisar artículo</option>
                <option value="APPROVE_OPPORTUNITY">Aprobar oportunidad</option>
                <option value="SUBMIT_INFO">Enviar información</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="task-minutes">Tiempo estimado (min)</label>
              <input type="number" id="task-minutes" class="form-input" min="5" max="480" value="15" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="task-deadline">Fecha límite (opcional)</label>
            <input type="date" id="task-deadline" class="form-input" />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem;">
            <button type="button" id="btn-cancel-add-task" class="btn btn-secondary">Cancelar</button>
            <button type="submit" class="btn btn-primary">Asignar al cliente</button>
          </div>
        </form>
      </div>
    </div>
  `;
}


