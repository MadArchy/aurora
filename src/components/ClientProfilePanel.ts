import { dbService } from '../services/db';
import { esc, escAttr } from '../lib/escape';
import { computeProfileCoverage, PROFILE_SECTION_LABELS, PROFILE_SECTION_ORDER } from '../domain/profileCoverage';
import { renderServiceLinesReadOnly } from './ProofWallPanel';

export function renderClientProfileBody(clientId: string): string {
  const client = dbService.getClientById(clientId);
  const profile = dbService.getMasterProfile(clientId);
  const coverage = computeProfileCoverage(profile);

  return `
    <div class="profile-page-stack">
      <section class="card">
        <div class="card-header">
          <div>
            <h3>Cobertura del perfil</h3>
            <p class="muted small">Objetivo piloto: ≥20 facts confirmados en ≥5 secciones.</p>
          </div>
          <span class="badge ${coverage.meetsPilotThreshold ? 'badge-ready' : 'badge-progress'}">
            ${coverage.totalConfirmed} facts · ${coverage.sectionsWithFacts} secciones
          </span>
        </div>
        <div class="coverage-grid">
          ${coverage.sections.map((section) => `
            <div class="coverage-tile ${section.complete ? 'is-complete' : ''}">
              <strong>${esc(section.label)}</strong>
              <span class="muted small">${section.confirmed} confirmados${section.candidates ? ` · ${section.candidates} candidatos` : ''}</span>
            </div>
          `).join('')}
        </div>
        <div class="profile-page-actions">
          <button type="button" class="btn btn-secondary btn-sm btn-open-onboarding" data-client-id="${escAttr(clientId)}">
            Continuar onboarding
          </button>
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <div>
            <h3>Subir CV para extraer facts</h3>
            <p class="muted small">Acepta .txt o .md. También puedes pegar texto plano del CV.</p>
          </div>
        </div>
        <div class="cv-upload-block">
          <label class="btn btn-secondary btn-sm btn-upload-cv">
            Seleccionar archivo
            <input type="file" accept=".txt,.md,text/plain,text/markdown" class="sr-only input-cv-upload" data-client-id="${escAttr(clientId)}" />
          </label>
          <textarea id="input-cv-paste" class="form-textarea cv-paste-area" rows="5" placeholder="O pega aquí el texto de tu CV…">${esc(profile?.cvExtractedText?.slice(0, 2000) || '')}</textarea>
          <button type="button" class="btn btn-primary btn-sm" id="btn-extract-cv-facts" data-client-id="${escAttr(clientId)}">
            Extraer facts candidatos
          </button>
        </div>
      </section>

      ${PROFILE_SECTION_ORDER.map((section) => renderFactSection(clientId, section, profile)).join('')}

      ${renderServiceLinesReadOnly(clientId)}

      ${client ? `<p class="muted small profile-footnote">Perfil de ${esc(client.displayName)} · completitud ${client.profileCompleteness || 0}%</p>` : ''}
    </div>
  `;
}

function renderFactSection(
  clientId: string,
  section: keyof typeof PROFILE_SECTION_LABELS,
  profile: ReturnType<typeof dbService.getMasterProfile>
): string {
  const facts = (profile?.facts || []).filter((f) => f.section === section && f.status !== 'rejected');
  const label = PROFILE_SECTION_LABELS[section];

  return `
    <section class="card profile-facts-section" data-fact-section="${escAttr(section)}">
      <div class="card-header">
        <div>
          <h3>${esc(label)}</h3>
          <p class="muted small">${facts.length ? `${facts.length} fact(s) en esta sección` : 'Sin facts todavía'}</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm btn-add-profile-fact" data-client-id="${escAttr(clientId)}" data-section="${escAttr(section)}">
          + Añadir
        </button>
      </div>

      ${facts.length
        ? `<div class="profile-facts-list">
             ${facts.map((fact) => `
               <div class="profile-fact-row ${fact.status === 'candidate' ? 'is-candidate' : ''}" data-fact-id="${esc(fact.id)}">
                 <div class="profile-fact-main">
                   <span class="badge ${fact.status === 'confirmed' ? 'badge-ready' : 'badge-progress'}">${fact.status === 'confirmed' ? 'Confirmado' : 'Candidato'}</span>
                   <strong>${esc(fact.label)}</strong>
                   <p class="muted small">${esc(fact.value)}</p>
                 </div>
                 <div class="profile-fact-actions">
                   ${fact.status === 'candidate'
                     ? `<button type="button" class="btn btn-success btn-sm btn-confirm-profile-fact" data-fact-id="${esc(fact.id)}" data-client-id="${escAttr(clientId)}">Confirmar</button>
                        <button type="button" class="btn btn-secondary btn-sm btn-reject-profile-fact" data-fact-id="${esc(fact.id)}" data-client-id="${escAttr(clientId)}">Descartar</button>`
                     : `<button type="button" class="btn btn-ghost btn-sm btn-edit-profile-fact" data-fact-id="${esc(fact.id)}" data-client-id="${escAttr(clientId)}">Editar</button>`}
                 </div>
               </div>
             `).join('')}
           </div>`
        : '<p class="empty-state">Añade facts confirmados o extrae candidatos desde tu CV.</p>'}
    </section>
  `;
}
