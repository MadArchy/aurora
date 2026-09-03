import { authService } from '../../../services/auth';
import { dbService } from '../../../services/db';
import { aiService } from '../../../services/ai';
import { auditService } from '../../../services/audit';
import { notifyClient } from '../../../services/notifications';
import { createId } from '../../../lib/id';
import { esc } from '../../../lib/escape';
import {
  VOICE_DIMENSION_LABELS,
  parseAudienceLines,
  parseTerritoryLines,
  validateWeights,
  formatAudienceLines,
  formatTerritoryLines,
} from '../../../domain/thesisModelCore';
import {
  evaluateThesisEditorProgress,
  nextThesisEditorStep,
  prevThesisEditorStep,
  validateThesisEditorStep,
  type ThesisEditorFormSnapshot,
  type ThesisEditorStep,
} from '../../../domain/thesisEditorCore';
import { type ThesisSaveIntent } from '../../../domain/thesisRevisionCore';
import { activateThesis, saveThesis } from '../../../services/thesisLifecycleConsumer';
import { ThesisLifecycleError } from '../../../application/thesisLifecycle';
import { StrategicRoutingError } from '../../../application/strategicSignalRouting';
import type {
  ThesisObjective,
  ThesisObjectiveKind,
  VoiceProfile,
  ThesisEditableFields,
} from '../../../types';
import type { ThesisHandlerHost } from '../legacyAppHost';

let thesisProgressTimer: number | null = null;

function collectThesisFormSnapshot(): ThesisEditorFormSnapshot | null {
  const form = document.getElementById('form-save-thesis');
  if (!form) return null;

  const val = (id: string) =>
    (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '';
  const lines = (id: string) => val(id).split('\n').map((l) => l.trim()).filter(Boolean);
  const num = (id: string, fallback: number) => {
    const parsed = Number.parseInt(val(id), 10);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : fallback;
  };

  const objectives: ThesisObjective[] = Array.from(
    document.querySelectorAll<HTMLInputElement>('[data-objective-kind]')
  )
    .map((input) => ({
      id: `obj_${(input.getAttribute('data-objective-kind') || '').toLowerCase()}`,
      kind: input.getAttribute('data-objective-kind') as ThesisObjectiveKind,
      weight: Math.max(0, Math.min(100, Number.parseInt(input.value, 10) || 0)),
    }))
    .filter((o) => o.weight > 0);

  const voiceDimensions = Object.keys(VOICE_DIMENSION_LABELS) as Array<
    keyof Omit<VoiceProfile, 'style' | 'avoid'>
  >;
  const voiceProfile = voiceDimensions.reduce(
    (acc, key) => ({ ...acc, [key]: num(`thesis-voice-${key}`, 50) }),
    {} as VoiceProfile
  );
  voiceProfile.style = val('thesis-voice-style').trim() || undefined;

  return {
    title: val('thesis-title'),
    identityCurrent: val('thesis-identity-current'),
    expertIdentity: val('thesis-expert-identity'),
    perceptionTarget: val('thesis-perception-target'),
    differentiator: val('thesis-differentiator'),
    audiencesText: val('thesis-audiences'),
    targetAudience: val('thesis-target-audience'),
    territoriesText: val('thesis-territories'),
    domain: val('thesis-domain'),
    objective: val('thesis-objective'),
    objectives,
    voiceProfile,
    voiceAvoidText: val('thesis-voice-avoid'),
    proofPoints: lines('thesis-proof-points'),
    hardBlocks: lines('thesis-limits-hard'),
    softAvoid: lines('thesis-limits-soft'),
    compliance: val('thesis-compliance'),
    priority: num('thesis-priority', 50),
  };
}

function showThesisEditorStep(step: ThesisEditorStep) {
  const form = document.getElementById('form-save-thesis');
  form?.setAttribute('data-thesis-current-step', step);

  document.querySelectorAll('[data-thesis-step]').forEach((chip) => {
    chip.classList.toggle('thesis-step-chip-active', chip.getAttribute('data-thesis-step') === step);
  });
  document.querySelectorAll('[data-thesis-panel]').forEach((panel) => {
    panel.classList.toggle('thesis-fieldset-active', panel.getAttribute('data-thesis-panel') === step);
  });

  const prev = document.getElementById('btn-thesis-prev') as HTMLButtonElement | null;
  const next = document.getElementById('btn-thesis-next') as HTMLButtonElement | null;
  if (prev) prev.disabled = step === 'identity';
  if (next) next.disabled = step === 'review';
}

function refreshThesisEditorProgress(host: ThesisHandlerHost) {
  const form = document.getElementById('form-save-thesis');
  const snapshot = collectThesisFormSnapshot();
  if (!form || !snapshot) return;

  const clientId = form.getAttribute('data-client-id') || host.resolveClientId();
  const thesisId = form.getAttribute('data-thesis-id') || 'draft';
  const client = dbService.getClientById(clientId);
  const { completeness, readiness } = evaluateThesisEditorProgress(
    snapshot,
    thesisId,
    clientId,
    client?.organizationId || host.resolveOrganizationId(clientId) || ''
  );

  const valueEl = document.getElementById('thesis-editor-progress-value');
  const fillEl = document.getElementById('thesis-editor-progress-fill');
  if (valueEl) valueEl.innerHTML = `${completeness.score}<span>/100</span>`;
  if (fillEl) {
    fillEl.style.width = `${completeness.score}%`;
    fillEl.classList.toggle('progress-green', completeness.score >= 70);
    fillEl.classList.toggle('progress-red', completeness.score < 40);
  }

  const reviewHost = document.getElementById('thesis-review-live');
  if (reviewHost) {
    reviewHost.innerHTML = `
      <div class="completeness-head">
        <strong class="completeness-value">${completeness.score}<span>/100</span></strong>
        <div class="progress-track">
          <div class="progress-fill ${completeness.score >= 70 ? 'progress-green' : completeness.score >= 40 ? '' : 'progress-red'}" style="width: ${completeness.score}%"></div>
        </div>
      </div>
      ${readiness.ready
        ? '<p class="info-strip">Lista para enviar al cliente.</p>'
        : `<p class="warn-strip">Pendiente: ${esc(readiness.blockers.slice(0, 5).join(' · '))}</p>`}
    `;
  }
}

function applyThesisProposalToForm(host: ThesisHandlerHost, proposal: ThesisEditableFields) {
  const set = (id: string, value: string) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el) el.value = value;
  };

  set('thesis-title', proposal.title);
  set('thesis-identity-current', proposal.identityCurrent || '');
  set('thesis-expert-identity', proposal.expertIdentity);
  set('thesis-perception-target', proposal.perceptionTarget || '');
  set('thesis-differentiator', proposal.differentiator || '');
  set('thesis-target-audience', proposal.targetAudience);
  set('thesis-domain', proposal.domain);
  set('thesis-objective', proposal.objective);
  set('thesis-voice-style', proposal.voiceAndTone);
  set('thesis-compliance', proposal.complianceRules);
  set('thesis-proof-points', (proposal.proofPoints || []).join('\n'));
  set('thesis-limits-hard', (proposal.limits?.hardBlocks || []).join('\n'));
  set('thesis-limits-soft', (proposal.limits?.softAvoid || []).join('\n'));
  set('thesis-voice-avoid', (proposal.voiceProfile?.avoid || []).join('\n'));

  if (proposal.audiences?.length) {
    set('thesis-audiences', formatAudienceLines(proposal.audiences));
  }
  if (proposal.territories?.length) {
    set('thesis-territories', formatTerritoryLines(proposal.territories));
  }

  if (proposal.objectives?.length) {
    for (const obj of proposal.objectives) {
      const input = document.getElementById(`thesis-objective-${obj.kind}`) as HTMLInputElement | null;
      if (input) input.value = String(obj.weight);
    }
  }

  if (proposal.voiceProfile) {
    for (const key of Object.keys(VOICE_DIMENSION_LABELS) as Array<keyof Omit<VoiceProfile, 'style' | 'avoid'>>) {
      const input = document.getElementById(`thesis-voice-${key}`) as HTMLInputElement | null;
      if (input && typeof proposal.voiceProfile![key] === 'number') {
        input.value = String(proposal.voiceProfile![key]);
      }
    }
  }

  if (proposal.priority != null) {
    set('thesis-priority', String(proposal.priority));
  }

  refreshThesisEditorProgress(host);
}

export function bindThesisHandlers(host: ThesisHandlerHost): void  {
  document.querySelectorAll('.btn-open-thesis-editor, .btn-edit-thesis, .btn-focus-thesis-block').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      host.activeModal = 'thesis-editor';
      host.modalData = {
        clientId: target.getAttribute('data-client-id') || host.resolveClientId(),
        thesisId: target.getAttribute('data-thesis-id') || undefined,
        focusBlock: target.getAttribute('data-focus-block') || undefined,
      };
      host.render();
    });
  });

  document.querySelectorAll('[data-thesis-step]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const step = (e.currentTarget as HTMLElement).getAttribute('data-thesis-step') as ThesisEditorStep | null;
      if (!step) return;
      showThesisEditorStep(step);
    });
  });

  document.getElementById('btn-thesis-next')?.addEventListener('click', () => {
    const form = document.getElementById('form-save-thesis');
    const current = (form?.getAttribute('data-thesis-current-step') || 'identity') as ThesisEditorStep;
    const snapshot = collectThesisFormSnapshot();
    if (!snapshot) return;
    const check = validateThesisEditorStep(current, snapshot);
    if (!check.ok) {
      host.showToast(check.message || 'Completa este paso antes de continuar.', 'warning');
      return;
    }
    const next = nextThesisEditorStep(current);
    if (next) {
      showThesisEditorStep(next);
      if (next === 'review') refreshThesisEditorProgress(host);
    }
  });

  document.getElementById('btn-thesis-prev')?.addEventListener('click', () => {
    const form = document.getElementById('form-save-thesis');
    const current = (form?.getAttribute('data-thesis-current-step') || 'identity') as ThesisEditorStep;
    const prev = prevThesisEditorStep(current);
    if (prev) showThesisEditorStep(prev);
  });

  document.getElementById('btn-generate-thesis-proposal')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const grant = host.requireTenant(btn.getAttribute('data-client-id') || host.resolveClientId());
    if (!grant.ok) {
      host.showToast(grant.message, 'warning');
      return;
    }
    const clientId = grant.clientId;
    btn.disabled = true;
    btn.textContent = 'Generando…';
    try {
      const proposal = await aiService.generateThesisProposal(clientId);
      applyThesisProposalToForm(host, proposal);
      host.showToast('Propuesta cargada. Revísala y ajusta antes de guardar.', 'success');
    } catch (error) {
      host.showToast(error instanceof Error ? error.message : 'No se pudo generar la propuesta', 'warning');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generar propuesta desde perfil';
    }
  });

  const thesisForm = document.getElementById('form-save-thesis');
  thesisForm?.addEventListener('input', () => {
    if (thesisProgressTimer) window.clearTimeout(thesisProgressTimer);
    thesisProgressTimer = window.setTimeout(() => refreshThesisEditorProgress(host), 400);
  });

  const thesisModal = host.modalData as {
    generateProposal?: boolean;
    splitHint?: string;
  } | null;

  if (thesisModal?.generateProposal && thesisForm) {
    void (async () => {
      const grant = host.requireTenant(
        thesisForm.getAttribute('data-client-id') || host.resolveClientId(),
      );
      if (!grant.ok) {
        host.showToast(grant.message, 'warning');
        return;
      }
      const clientId = grant.clientId;
      try {
        const proposal = await aiService.generateThesisProposal(clientId);
        applyThesisProposalToForm(host, proposal);
        const hint = thesisModal.splitHint;
        host.showToast(
          hint
            ? `Propuesta generada. ${hint}`
            : 'Propuesta generada desde el perfil. Revisa cada bloque.',
          'info'
        );
      } catch {
        host.showToast('No se pudo generar la propuesta automática.', 'warning');
      } finally {
        host.modalData = { ...(host.modalData ?? {}), generateProposal: false, splitHint: undefined };
      }
    })();
  }

  ['btn-close-thesis-editor', 'btn-cancel-thesis-editor'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => host.closeModal());
  });

  const formSaveThesis = document.getElementById('form-save-thesis');
  formSaveThesis?.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;
      const intent = (submitter?.getAttribute('data-thesis-intent') || 'draft') as ThesisSaveIntent;
      const clientId = formSaveThesis.getAttribute('data-client-id') || host.resolveClientId();
      const thesisId = formSaveThesis.getAttribute('data-thesis-id') || createId('thesis');

      const val = (id: string) =>
        (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '';
      const lines = (id: string) => val(id).split('\n').map((l) => l.trim()).filter(Boolean);
      const num = (id: string, fallback: number) => {
        const parsed = Number.parseInt(val(id), 10);
        return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : fallback;
      };

      const objectives: ThesisObjective[] = Array.from(
        document.querySelectorAll<HTMLInputElement>('[data-objective-kind]')
      )
        .map((input) => ({
          id: `obj_${(input.getAttribute('data-objective-kind') || '').toLowerCase()}`,
          kind: input.getAttribute('data-objective-kind') as ThesisObjectiveKind,
          weight: Math.max(0, Math.min(100, Number.parseInt(input.value, 10) || 0)),
        }))
        .filter((o) => o.weight > 0);

      const voiceDimensions = Object.keys(VOICE_DIMENSION_LABELS) as Array<
        keyof Omit<VoiceProfile, 'style' | 'avoid'>
      >;
      const voiceProfile = voiceDimensions.reduce(
        (acc, key) => ({ ...acc, [key]: num(`thesis-voice-${key}`, 50) }),
        {} as VoiceProfile
      );
      voiceProfile.style = val('thesis-voice-style').trim() || undefined;
      const voiceAvoid = lines('thesis-voice-avoid');
      voiceProfile.avoid = voiceAvoid.length ? voiceAvoid : undefined;

      const audiences = parseAudienceLines(val('thesis-audiences'));
      const territories = parseTerritoryLines(val('thesis-territories'));
      const hardBlocks = lines('thesis-limits-hard');
      const softAvoid = lines('thesis-limits-soft');

      const existing = dbService.getThesisById(clientId, thesisId);

      const title = val('thesis-title').trim();
      if (!title || !val('thesis-expert-identity').trim()) {
        host.showToast('Título e identidad objetivo son obligatorios.', 'warning');
        return;
      }
      const weightCheck = validateWeights(objectives);
      if (!weightCheck.ok && objectives.length) {
        host.showToast(weightCheck.message || 'Los objetivos deben sumar 100.', 'warning');
        return;
      }

      const editable: ThesisEditableFields = {
        title,
        expertIdentity: val('thesis-expert-identity'),
        targetAudience: val('thesis-target-audience'),
        secondaryAudience: existing?.secondaryAudience,
        domain: val('thesis-domain'),
        objective: val('thesis-objective'),
        proofPoints: lines('thesis-proof-points'),
        differentiator: val('thesis-differentiator') || undefined,
        voiceAndTone: val('thesis-voice-style').trim() || 'Autoritativo, claro, orientado a mitigación de riesgos',
        complianceRules: val('thesis-compliance') || '',
        identityCurrent: val('thesis-identity-current').trim() || undefined,
        perceptionTarget: val('thesis-perception-target').trim() || undefined,
        audiences: audiences.length ? audiences : undefined,
        territories: territories.length ? territories : undefined,
        objectives: objectives.length ? objectives : undefined,
        voiceProfile,
        limits: hardBlocks.length || softAvoid.length ? { hardBlocks, softAvoid } : undefined,
        priority: num('thesis-priority', 50),
      };

      // CR-1 #11 — Thesis Lifecycle Application owns save/review-submit.
      const plan = saveThesis({
        requestedClientId: clientId,
        thesisId,
        intent,
        fields: editable,
      });

      if (plan.notifyClient) {
        const notified = notifyClient(clientId, {
          type: 'THESIS',
          title: plan.thesis.status === 'ACTIVE' ? 'Revisión de tesis pendiente' : 'Tesis lista para tu aprobación',
          body: title,
        });
        if (!notified) {
          host.showToast('Tesis guardada. El cliente aún no tiene cuenta para recibir aviso.', 'info');
        }
      }

      host.showToast(plan.toast, 'success');
      host.closeModal();
    } catch (error) {
      host.showToast(
        error instanceof ThesisLifecycleError || error instanceof Error
          ? error.message
          : 'No se pudo guardar la tesis',
        'warning'
      );
    }
  });

  document.querySelectorAll('[data-thesis-select]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      host.filterState.thesisId = (e.currentTarget as HTMLElement).getAttribute('data-thesis-select') || '';
      host.refreshMain();
    });
  });

  document.querySelectorAll('[data-thesis-override]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const signalId = target.getAttribute('data-signal-id') || '';
      const thesisId = target.getAttribute('data-thesis-override') || '';
      const signal = dbService.getSignalById(signalId);
      if (!signal || !thesisId) return;

      const clientId = host.resolveClientId(signal.clientId);
      const organizationId = host.resolveOrganizationId(clientId);
      const user = authService.getCurrentUser();
      if (!organizationId || !user) {
        host.showToast('Sesión sin organizationId — no se puede asignar tesis', 'warning');
        return;
      }

      try {
        const result = host.strategicRouting.overrideSignalThesis({
          signalId,
          clientId,
          organizationId,
          selectedThesisId: thesisId,
          actorId: user.uid,
          actorRole: user.role,
        });
        const title =
          dbService.getThesisById(clientId, result.routing.selectedThesisId || thesisId)?.title ||
          thesisId;
        auditService.log(user, 'THESIS_OVERRIDE', 'Signal', signalId, { thesisId });
        host.showToast(`Señal asignada a «${title}»`, 'success');
        host.refreshMain();
      } catch (error) {
        const message =
          error instanceof StrategicRoutingError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'No se pudo asignar la tesis';
        host.showToast(message, 'warning');
      }
    });
  });

  document.querySelectorAll('[data-evidence-thesis-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const evidenceId = target.getAttribute('data-evidence-thesis-toggle') || '';
      const thesisId = target.getAttribute('data-thesis-id') || '';
      const linked = dbService.toggleEvidenceThesis(evidenceId, thesisId);
      auditService.log(
        authService.getCurrentUser(),
        linked ? 'LINK_EVIDENCE_THESIS' : 'UNLINK_EVIDENCE_THESIS',
        'EvidenceVaultItem',
        evidenceId,
        { thesisId }
      );
      host.showToast(
        linked ? 'Evidencia asignada. El Authority Score se recalcula.' : 'Evidencia desvinculada de la tesis.',
        'success'
      );
      host.refreshMain();
    });
  });

  document.querySelectorAll('.btn-challenge-thesis').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const clientId = target.getAttribute('data-client-id') || host.resolveClientId();
      const theses = dbService.getThesesByClient(clientId);
      const requestedId = target.getAttribute('data-thesis-id');
      const thesis = requestedId ? theses.find((t) => t.id === requestedId) : undefined;
      if (!thesis) {
        host.showToast('Selecciona una tesis válida para someterla a prueba.', 'warning');
        return;
      }
      target.disabled = true;
      target.textContent = 'Diagnosticando…';
      try {
        const challenge = await aiService.challengeThesis(thesis);
        host.activeModal = 'challenge';
        host.modalData = {
          title: thesis.title,
          challenge,
          clientId,
          thesisId: thesis.id,
          thesisStatus: thesis.status,
        };
        host.render();
      } catch (error) {
        host.showToast(error instanceof Error ? error.message : 'No se pudo evaluar la tesis', 'warning');
        host.render();
      } finally {
        target.disabled = false;
        target.textContent = 'Stress-test';
      }
    });
  });

  document.querySelectorAll('.btn-activate-thesis').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const clientId = target.getAttribute('data-client-id') || host.resolveClientId();
      const thesisId = target.getAttribute('data-thesis-id');
      if (!thesisId) {
        host.showToast('Selecciona una tesis explícita para activar.', 'warning');
        return;
      }
      try {
        // CR-1 #12 — Thesis Lifecycle Application owns activation.
        activateThesis({ requestedClientId: clientId, thesisId });
        host.showToast('Tesis activada. El radar y el scoring ya la usan.', 'success');
        host.refreshMain();
      } catch (error) {
        host.showToast(
          error instanceof ThesisLifecycleError || error instanceof Error
            ? error.message
            : 'No se pudo activar la tesis',
          'warning'
        );
      }
    });
  });

  ['btn-close-challenge', 'btn-close-challenge-bottom'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => host.closeModal());
  });

  document.getElementById('btn-challenge-edit-thesis')?.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    host.closeModal();
    host.activeModal = 'thesis-editor';
    host.modalData = {
      clientId: btn.getAttribute('data-client-id') || host.resolveClientId(),
      thesisId: btn.getAttribute('data-thesis-id') || undefined,
    };
    host.render();
  });

  document.getElementById('btn-challenge-split-thesis')?.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    host.closeModal();
    host.activeModal = 'thesis-editor';
    host.modalData = {
      clientId: btn.getAttribute('data-client-id') || host.resolveClientId(),
      generateProposal: true,
      splitHint: btn.getAttribute('data-split-hint') || '',
    };
    host.render();
  });

  document.getElementById('btn-challenge-open-vault')?.addEventListener('click', () => {
    host.closeModal();
    host.setTab('ws-positioning');
    window.setTimeout(() => {
      const panel = document.getElementById('proof-wall-section');
      if (panel instanceof HTMLDetailsElement) panel.open = true;
      panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  });

  document.getElementById('btn-challenge-submit-thesis')?.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    host.closeModal();
    host.activeModal = 'thesis-editor';
    host.modalData = {
      clientId: btn.getAttribute('data-client-id') || host.resolveClientId(),
      thesisId: btn.getAttribute('data-thesis-id') || undefined,
      focusBlock: 'review',
    };
    host.render();
  });
}
