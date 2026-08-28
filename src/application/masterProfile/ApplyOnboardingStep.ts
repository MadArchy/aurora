import type { ClientProfile } from '../../types';
import { applyOnboardingStepToProfile, type OnboardingFieldMap } from './applyOnboardingStepLogic';
import { MasterProfileError } from './errors';
import type { MasterProfileRepository } from './ports/MasterProfileRepository';
import {
  assertNoMasterProfileSpoof,
  assertTrustedMasterProfileContext,
  type TrustedMasterProfileContext,
} from './trustedContext';

export interface ApplyOnboardingStepInput {
  trusted: TrustedMasterProfileContext;
  step: number;
  /** Non-authoritative user-entered field values for the wizard step. */
  fields: OnboardingFieldMap;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedProfileCompleteness?: number;
  claimedOnboardingStatus?: string;
  claimedClientStatus?: string;
}

export interface ApplyOnboardingStepResult {
  profile: ClientProfile;
  completed: boolean;
  step: number;
}

export interface ApplyOnboardingStepDeps {
  profiles: MasterProfileRepository;
}

/**
 * CR-1 #10 — ApplyOnboardingStep.
 *
 * Caller supplies step intent + form fields only. Tenant/actor come from trusted
 * context. Profile/client state is loaded authoritatively. Domain
 * `buildFactsFromProfile` materializes facts; completeness is refreshed by the
 * persistence adapter via Domain `computeProfileCoverage`.
 */
export function createApplyOnboardingStep(deps: ApplyOnboardingStepDeps) {
  return function applyOnboardingStep(
    input: ApplyOnboardingStepInput
  ): ApplyOnboardingStepResult {
    assertTrustedMasterProfileContext(input.trusted);
    assertNoMasterProfileSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
      claimedProfileCompleteness: input.claimedProfileCompleteness,
      claimedOnboardingStatus: input.claimedOnboardingStatus,
      claimedClientStatus: input.claimedClientStatus,
    });

    const client = deps.profiles.getClient(input.trusted.clientId);
    if (!client) {
      throw new MasterProfileError('CLIENT_NOT_FOUND', 'Cliente no encontrado.');
    }
    if (client.organizationId?.trim() !== input.trusted.organizationId) {
      throw new MasterProfileError(
        'TENANT_CONTEXT_INVALID',
        'Client organization does not match trusted session organization.'
      );
    }

    const existing = deps.profiles.getProfile(input.trusted.clientId);
    const applied = applyOnboardingStepToProfile({
      existing,
      organizationId: input.trusted.organizationId,
      clientId: input.trusted.clientId,
      step: input.step,
      fields: input.fields || {},
      now: input.trusted.now,
      actorId: input.trusted.actorId,
    });

    try {
      for (const patch of applied.clientPatches) {
        deps.profiles.updateClient(input.trusted.clientId, patch);
      }
      deps.profiles.saveProfile(applied.profile);
    } catch (err) {
      throw new MasterProfileError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to persist onboarding step.'
      );
    }

    const saved = deps.profiles.getProfile(input.trusted.clientId) ?? applied.profile;
    return {
      profile: saved,
      completed: applied.completed,
      step: input.step,
    };
  };
}
