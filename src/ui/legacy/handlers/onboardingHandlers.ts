import { authService } from '../../../services/auth';
import { dbService } from '../../../services/db';
import { notifyManager } from '../../../services/notifications';
import { applyOnboardingStep } from '../../../services/masterProfileConsumer';
import { MasterProfileError } from '../../../application/masterProfile';
import { nextIncompleteOnboardingStep } from '../../../domain/profileCoverage';
import type { OnboardingHandlerHost } from '../legacyAppHost';

export function bindOnboardingHandlers(host: OnboardingHandlerHost): void  {
  document.querySelectorAll('#btn-open-onboarding, .btn-open-onboarding').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id')
        || authService.getCurrentUser()?.clientId
        || host.resolveClientId();
      const profile = dbService.getMasterProfile(clientId);
      const step = nextIncompleteOnboardingStep(profile);
      host.activeModal = 'onboarding';
      host.modalData = { clientId, step };
      host.render();
    });
  });

  document.querySelectorAll('[data-onboarding-jump]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const step = parseInt((e.currentTarget as HTMLElement).getAttribute('data-onboarding-jump') || '1', 10);
      host.modalData = { clientId: (host.modalData?.clientId as string | undefined) || host.resolveClientId(), step };
      host.render();
    });
  });

  ['btn-close-onboarding', 'btn-onboarding-skip'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => {
      if (id === 'btn-onboarding-skip') {
        // `if (clientId)` era una comprobación de presencia, no de
        // titularidad. El gate valida tenant de confianza antes del write.
        const grant = host.requireTenant(host.modalData?.clientId as string | undefined);
        if (grant.ok) {
          dbService.updateClient(grant.clientId, { onboardingStatus: 'IN_PROGRESS' });
        }
        authService.clearOnboardingFlag();
      }
      host.closeModal();
    });
  });

  const formOnboardingStep = document.getElementById('form-onboarding-step');
  formOnboardingStep?.addEventListener('submit', (e) => {
    e.preventDefault();
    const step = parseInt(formOnboardingStep.getAttribute('data-step') || '1', 10);
    const grant = host.requireTenant(
      formOnboardingStep.getAttribute('data-client-id') || host.resolveClientId(),
    );
    if (!grant.ok) {
      host.showToast(grant.message, 'warning');
      return;
    }
    const clientId = grant.clientId;

    const val = (id: string) =>
      (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null)?.value || '';

    const fields: Record<string, string> = {};
    if (step === 1) {
      fields.displayName = val('onb-name');
      fields.selfDescription = val('onb-self-desc');
      fields.profession = val('onb-profession');
      fields.role = val('onb-role');
      fields.company = val('onb-company');
    }
    if (step === 2) {
      fields.primaryGoal = val('onb-primary-goal');
      fields.secondaryGoals = val('onb-sec-goals');
    }
    if (step === 3) {
      fields.targetAudience = val('onb-target-audience');
      fields.industries = val('onb-industries');
      fields.countries = val('onb-countries');
    }
    if (step === 4) {
      fields.education = val('onb-education');
      fields.highlights = val('onb-highlights');
    }
    if (step === 5) {
      fields.linkedin = val('onb-linkedin');
      fields.website = val('onb-website');
    }
    if (step === 6) {
      fields.tone = val('onb-tone');
      fields.avoid = val('onb-avoid');
      fields.compliance = val('onb-compliance');
    }

    // CR-1 #10 — business authority is ApplyOnboardingStep (Master Profile Application).
    // Tenant/actor come from requireTenantScope inside the consumer; DOM id is only a proposal.
    let result;
    try {
      result = applyOnboardingStep({
        requestedClientId: clientId,
        step,
        fields,
      });
    } catch (err) {
      const message =
        err instanceof MasterProfileError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo guardar el onboarding';
      host.showToast(message, 'warning');
      return;
    }

    if (step < 6) {
      host.modalData = { clientId, step: step + 1 };
      host.render();
      return;
    }

    if (result.completed) {
      notifyManager(clientId, {
        type: 'ONBOARDING',
        title: 'Perfil listo para revisión',
        body: 'El cliente completó el onboarding.',
      });
    }
    authService.clearOnboardingFlag();
    host.showToast('Onboarding completado. Abriendo propuesta de tesis…', 'success');
    host.activeModal = 'thesis-editor';
    host.modalData = { clientId, generateProposal: true };
    host.render();
  });

  document.getElementById('btn-onboarding-prev')?.addEventListener('click', (e) => {
    const prev = parseInt((e.currentTarget as HTMLElement).getAttribute('data-prev') || '1', 10);
    host.modalData = { clientId: (host.modalData?.clientId as string | undefined) || host.resolveClientId(), step: prev };
    host.render();
  });
}
