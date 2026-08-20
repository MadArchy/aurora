import { dbService } from '../services/db';
import { escAttr, esc } from '../lib/escape';
import { computeProfileCoverage, nextIncompleteOnboardingStep } from '../domain/profileCoverage';

export function renderOnboardingWizard(clientId: string, currentStep: number = 1): string {
  const client = dbService.getClientById(clientId);
  const profile = dbService.getMasterProfile(clientId);
  const displayName = client?.displayName || `${client?.firstName || ''} ${client?.lastName || ''}`.trim();
  const coverage = computeProfileCoverage(profile);
  const suggestedStep = nextIncompleteOnboardingStep(profile);
  const effectiveStep = currentStep || suggestedStep;

  const steps = [
    { num: 1, title: 'Identidad', code: 'ONB-01' },
    { num: 2, title: 'Objetivos', code: 'ONB-02' },
    { num: 3, title: 'Audiencia', code: 'ONB-03' },
    { num: 4, title: 'Autoridad & Evidencia', code: 'ONB-04' },
    { num: 5, title: 'Presencia Digital', code: 'ONB-05' },
    { num: 6, title: 'Voz & Compliance', code: 'ONB-06' }
  ];

  return `
    <div id="onboarding-modal" class="modal-overlay">
      <div class="modal-content" style="max-width: 780px;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="badge badge-progress">Paso ${effectiveStep} de 6</span>
              <span style="font-size: 0.8rem; color: var(--text-muted);">${steps[effectiveStep - 1].code}</span>
            </div>
            <h3 style="margin-top: 0.35rem;">Onboarding Progresivo de Autoridad</h3>
            <p class="muted small">${coverage.totalConfirmed} facts confirmados · ${coverage.sectionsWithFacts}/5 secciones con cobertura</p>
          </div>
          <button id="btn-close-onboarding" class="btn btn-secondary btn-sm" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;">✕</button>
        </div>

        <div class="onboarding-coverage-grid">
          ${coverage.sections.slice(0, 6).map((section, index) => `
            <button type="button" class="onboarding-coverage-chip ${section.complete ? 'is-complete' : ''} ${effectiveStep === index + 1 ? 'is-active' : ''}" data-onboarding-jump="${index + 1}">
              ${section.complete ? '✓' : '○'} ${esc(section.label)}
            </button>
          `).join('')}
        </div>

        <!-- Step Indicator Bar -->
        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.5rem; margin-bottom: 2rem;">
          ${steps.map(s => `
            <div style="height: 6px; border-radius: var(--radius-full); background: ${s.num <= effectiveStep ? 'var(--accent-primary)' : 'var(--bg-surface-raised)'};"></div>
          `).join('')}
        </div>

        <!-- Step Content -->
        <form id="form-onboarding-step" data-step="${effectiveStep}" data-client-id="${escAttr(clientId)}">
          ${renderStepContent(effectiveStep, client, profile, displayName)}

          <!-- Footer Actions -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; border-top: 1px solid var(--border-subtle); padding-top: 1.25rem;">
            ${effectiveStep > 1 ? `
              <button type="button" id="btn-onboarding-prev" class="btn btn-secondary" data-prev="${effectiveStep - 1}">
                ← Anterior
              </button>
            ` : `<div></div>`}

            <div style="display: flex; gap: 0.75rem;">
              <button type="button" id="btn-onboarding-skip" class="btn btn-secondary btn-sm">
                Guardar y continuar luego
              </button>
              <button type="submit" class="btn btn-primary">
                ${effectiveStep === 6 ? 'Finalizar onboarding' : 'Continuar →'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderStepContent(step: number, client: any, profile: any, displayName: string): string {
  switch (step) {
    case 1:
      return `
        <h4 style="margin-bottom: 0.5rem;">ONB-01: Identidad Profesional & Descripción Esencial</h4>
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
          Define cómo te presentas en el mercado y en qué área ejerces tu liderazgo.
        </p>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Nombre Completo</label>
            <input type="text" id="onb-name" class="form-input" value="${escAttr(displayName)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Profesión / Especialidad</label>
            <input type="text" id="onb-profession" class="form-input" value="${client?.profession || ''}" required />
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Cargo Actual / Rol</label>
            <input type="text" id="onb-role" class="form-input" value="${profile?.career?.currentRole || ''}" placeholder="Ej. Socio Director" />
          </div>
          <div class="form-group">
            <label class="form-label">Firma / Organización</label>
            <input type="text" id="onb-company" class="form-input" value="${client?.company || ''}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">¿Cómo describirías en una o dos frases lo que haces profesionalmente?</label>
          <textarea id="onb-self-desc" class="form-textarea" rows="3" placeholder="Ej. Asesoro a comités directivos en la gobernanza legal y ética de IA...">${profile?.identity?.selfDescription || ''}</textarea>
        </div>
      `;

    case 2:
      return `
        <h4 style="margin-bottom: 0.5rem;">ONB-02: Objetivo Estratégico de Posicionamiento</h4>
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
          ¿Cuál es la meta principal que deseas conseguir con el desarrollo de tu marca?
        </p>
        <div class="form-group">
          <label class="form-label">Objetivo Principal (Primary Goal)</label>
          <select id="onb-primary-goal" class="form-select">
            <option value="Desarrollar una práctica profesional de alto valor">Desarrollar una práctica profesional de alto valor</option>
            <option value="Conseguir nuevos clientes corporativos">Conseguir nuevos clientes corporativos</option>
            <option value="Posicionarme como autoridad técnica y referente de opinión">Posicionarme como autoridad técnica y referente de opinión</option>
            <option value="Conseguir invitaciones a conferencias, keynotes y paneles">Conseguir invitaciones a conferencias, keynotes y paneles</option>
            <option value="Acceder a juntas directivas o comités asesores">Acceder a juntas directivas o comités asesores</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Objetivos Secundarios (Opcional)</label>
          <input type="text" id="onb-sec-goals" class="form-input" value="${(profile?.goals?.secondaryGoals || []).join(', ')}" placeholder="Publicar en revistas indexadas, apariciones en podcasts..." />
        </div>
      `;

    case 3:
      return `
        <h4 style="margin-bottom: 0.5rem;">ONB-03: Audiencia Objetivo & Mercados</h4>
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
          ¿Ante quiénes quieres que tu nombre sea la primera opción de consulta?
        </p>
        <div class="form-group">
          <label class="form-label">Descripción de tu Audiencia Primaria</label>
          <input type="text" id="onb-target-audience" class="form-input" value="${profile?.audience?.targetAudienceDescription || client?.targetMarket || ''}" placeholder="Ej. General Counsel, Directores de Riesgos y CIOs" required />
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Sectores / Industrias Clave</label>
            <input type="text" id="onb-industries" class="form-input" value="${(profile?.audience?.targetIndustries || []).join(', ')}" placeholder="Fintech, Salud, Inteligencia Artificial" />
          </div>
          <div class="form-group">
            <label class="form-label">Países / Mercados Principales</label>
            <input type="text" id="onb-countries" class="form-input" value="${(profile?.audience?.targetCountries || []).join(', ')}" placeholder="Colombia, Estados Unidos, España" />
          </div>
        </div>
      `;

    case 4:
      return `
        <h4 style="margin-bottom: 0.5rem;">ONB-04: Evidence Vault (Autoridad & Credenciales Reales)</h4>
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
          Las pruebas concretas que sustentan tu posicionamiento de forma honesta.
        </p>
        <div class="form-group">
          <label class="form-label">Títulos Académicos y Universidades</label>
          <textarea id="onb-education" class="form-textarea" rows="3" placeholder="LL.M. in Law, Science & Technology - Stanford Law School (2014)...">${(profile?.education || []).map((e: any) => `${e.degree} - ${e.institution} (${e.year || ''})`).join('\n')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Hitos de Carrera / Casos de Éxito</label>
          <textarea id="onb-highlights" class="form-textarea" rows="3" placeholder="Asesor en marco de gobernanza para 3 unicornios fintech...">${(profile?.careerHistory || []).map((h: any) => `${h.role} en ${h.organization}: ${h.highlight}`).join('\n')}</textarea>
        </div>
      `;

    case 5:
      return `
        <h4 style="margin-bottom: 0.5rem;">ONB-05: Presencia Digital & Enlaces</h4>
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
          Canales donde se concentrará la distribución de tu contenido.
        </p>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Perfil de LinkedIn</label>
            <input type="url" id="onb-linkedin" class="form-input" value="${profile?.socialLinks?.linkedin || ''}" placeholder="https://linkedin.com/in/..." />
          </div>
          <div class="form-group">
            <label class="form-label">Sitio Web / Blog Personal</label>
            <input type="url" id="onb-website" class="form-input" value="${profile?.socialLinks?.website || ''}" placeholder="https://tudominio.com" />
          </div>
        </div>
      `;

    case 6:
      return `
        <h4 style="margin-bottom: 0.5rem;">ONB-06: Estilo de Voz & Límites Deontológicos</h4>
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
          Cómo deben sonar tus artículos y qué temas están prohibidos o restringidos.
        </p>
        <div class="form-group">
          <label class="form-label">Tono de Comunicación Preferido</label>
          <select id="onb-tone" class="form-select">
            <option value="authoritative" ${profile?.voicePreferences?.tone === 'authoritative' ? 'selected' : ''}>Autoritativo y Sobrio (Rigor, análisis técnico, sin hype)</option>
            <option value="academic" ${profile?.voicePreferences?.tone === 'academic' ? 'selected' : ''}>Académico (Citas formales y jurisprudencia comparada)</option>
            <option value="conversational" ${profile?.voicePreferences?.tone === 'conversational' ? 'selected' : ''}>Conversacional Directo (Claro, práctico y accesible)</option>
            <option value="provocative" ${profile?.voicePreferences?.tone === 'provocative' ? 'selected' : ''}>Visionario / Provocador (Debates de frontera)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Temas a Evitar (Límites y Compliance)</label>
          <input type="text" id="onb-avoid" class="form-input" value="${(profile?.voicePreferences?.topicsToAvoid || []).join(', ')}" placeholder="Especulación financiera, política partidista..." />
        </div>
        <div class="form-group">
          <label class="form-label">Reglas Deontológicas Profesionales</label>
          <input type="text" id="onb-compliance" class="form-input" value="${profile?.voicePreferences?.complianceGuidelines || ''}" placeholder="No garantizar resultados, secreto profesional estricto..." />
        </div>
      `;

    default:
      return '';
  }
}
