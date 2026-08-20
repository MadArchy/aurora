import { Client, MasterDossier } from '../types';
import { esc } from '../lib/escape';

const CHANNEL_LABELS: Record<MasterDossier['channelGuides'][0]['channel'], string> = {
  LINKEDIN: 'LinkedIn',
  WEBSITE: 'Web',
  YOUTUBE: 'YouTube',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
};

export function renderMasterDossierPanel(dossier: MasterDossier, client: Client): string {
  return `
    <section class="card dossier-card" id="dossier-maestro">
      <div class="card-header">
        <div>
          <h3>Dossier maestro</h3>
          <p style="font-size: 0.9rem;">
            Biografía, servicios, audiencia, diferenciadores y guías por canal — fuente de verdad para ${esc(client.displayName)}.
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <span class="badge badge-progress">v${esc(dossier.version)}</span>
          <button type="button" class="btn btn-secondary btn-sm btn-copy-dossier" data-client-id="${esc(client.id)}">
            Copiar Markdown
          </button>
          <button type="button" class="btn btn-primary btn-sm btn-export-dossier" data-client-id="${esc(client.id)}">
            Descargar .md
          </button>
        </div>
      </div>

      <div class="dossier-hero">
        <p class="dossier-tagline-en">${esc(dossier.taglineEn)}</p>
        <p class="dossier-subtitle-en">${esc(dossier.subtitleEn)}</p>
      </div>

      <div class="dossier-nav">
        ${[
          ['resumen', 'Resumen'],
          ['identidad', 'Identidad'],
          ['servicios', 'Servicios'],
          ['audiencia', 'Audiencia'],
          ['contenido', 'Contenido'],
          ['canales', 'Canales'],
        ].map(([id, label]) => `
          <a class="dossier-nav-link" href="#dossier-${id}">${esc(label)}</a>
        `).join('')}
      </div>

      <div class="dossier-section" id="dossier-resumen">
        <h4 class="dossier-section-title">Resumen ejecutivo</h4>
        <p>${esc(dossier.executiveSummary)}</p>
        <div class="field-block" style="margin-top: 1rem;">
          <label class="form-label">Arco narrativo</label>
          <p class="dossier-arc">${esc(dossier.narrativeArc)}</p>
        </div>
        <div class="info-strip" style="margin-top: 1rem;">
          <span><strong>Regla editorial:</strong> ${esc(dossier.newsEditorialRule)}</span>
        </div>
      </div>

      <div class="dossier-section" id="dossier-identidad">
        <h4 class="dossier-section-title">Identidad — 8 dimensiones</h4>
        <div class="dossier-dimension-grid">
          ${dossier.identityDimensions.map((d) => `
            <div class="dossier-dimension">
              <span class="dossier-dimension-label">${esc(d.label)}</span>
              <p>${esc(d.value)}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="dossier-section" id="dossier-servicios">
        <h4 class="dossier-section-title">Líneas de servicio</h4>
        <div class="workspace-split">
          ${dossier.serviceLines.map((line) => `
            <div class="dossier-service-line">
              <h5>${esc(line.name)}</h5>
              <p class="muted small">${esc(line.description)}</p>
              <ul class="policy-list">
                ${line.offerings.map((o) => `<li>${esc(o)}</li>`).join('')}
              </ul>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="dossier-section" id="dossier-audiencia">
        <h4 class="dossier-section-title">Público objetivo</h4>
        <ul class="policy-list">
          ${dossier.targetAudiences.map((a) => `<li>${esc(a)}</li>`).join('')}
        </ul>
        <h5 style="margin-top: 1.25rem; font-size: 0.95rem;">Preguntas de negocio que resuelve</h5>
        <ul class="policy-list">
          ${dossier.clientQuestions.map((q) => `<li>${esc(q)}</li>`).join('')}
        </ul>
      </div>

      <div class="dossier-section" id="dossier-contenido">
        <div class="grid-2">
          <div>
            <h4 class="dossier-section-title">Temas que debe dominar</h4>
            <ul class="policy-list dossier-list-positive">
              ${dossier.topicsToOwn.map((t) => `<li>${esc(t)}</li>`).join('')}
            </ul>
          </div>
          <div>
            <h4 class="dossier-section-title">Evitar en comunicación</h4>
            <ul class="policy-list dossier-list-negative">
              ${dossier.topicsToAvoid.map((t) => `<li>${esc(t)}</li>`).join('')}
            </ul>
          </div>
        </div>
        ${dossier.pendingVerification.length
          ? `<div class="warn-strip" style="margin-top: 1rem;">
               <strong>Pendiente verificar:</strong>
               <ul class="policy-list" style="margin-top: 0.5rem;">
                 ${dossier.pendingVerification.map((p) => `<li>${esc(p)}</li>`).join('')}
               </ul>
             </div>`
          : ''}
        <div class="field-block" style="margin-top: 1rem;">
          <label class="form-label">Diferenciadores</label>
          <ul class="policy-list">
            ${dossier.differentiators.map((d) => `<li>${esc(d)}</li>`).join('')}
          </ul>
        </div>
      </div>

      <div class="dossier-section" id="dossier-canales">
        <h4 class="dossier-section-title">Guías por canal</h4>
        <div class="dossier-channel-grid">
          ${dossier.channelGuides.map((guide) => `
            <article class="dossier-channel-card">
              <header>
                <span class="badge badge-progress">${esc(CHANNEL_LABELS[guide.channel])}</span>
              </header>
              <div class="field-block">
                <label class="form-label">Headline</label>
                <p><strong>${esc(guide.headline)}</strong></p>
              </div>
              <div class="field-block">
                <label class="form-label">Bio</label>
                <p class="muted small">${esc(guide.bio)}</p>
              </div>
              <div class="field-block">
                <label class="form-label">Hacer</label>
                <ul class="policy-list dossier-list-positive">
                  ${guide.dos.map((d) => `<li>${esc(d)}</li>`).join('')}
                </ul>
              </div>
              <div class="field-block">
                <label class="form-label">Evitar</label>
                <ul class="policy-list dossier-list-negative">
                  ${guide.donts.map((d) => `<li>${esc(d)}</li>`).join('')}
                </ul>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}
