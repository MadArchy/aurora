/**
 * CR-1 Workstream 2 — Master Profile consumer facade.
 *
 * Security: `requireTenantScope` establishes trusted org/client/actor.
 * Application owns ApplyOnboardingStep orchestration (registry #10).
 */

import {
  MasterProfileError,
  type ApplyOnboardingStepResult,
  type OnboardingFieldMap,
} from '../application/masterProfile';
import { composeMasterProfile } from '../composition/masterProfile/composeMasterProfile';
import { requireTenantScope } from '../controllers/trustedTenant';
import { authService } from './auth';
import { auditService } from './audit';
import { dbService } from './db';

type MasterProfileUseCases = ReturnType<typeof composeMasterProfile>;

let useCases: MasterProfileUseCases = composeMasterProfile();

/** Test-only reset — not production API. */
export function resetMasterProfileConsumerForTest(next?: MasterProfileUseCases): void {
  useCases = next ?? composeMasterProfile();
}

function mapError(err: unknown, fallback: string): never {
  if (err instanceof MasterProfileError) throw err;
  throw new MasterProfileError(
    'PERSISTENCE_ERROR',
    err instanceof Error ? err.message : fallback
  );
}

export interface ApplyOnboardingStepIntent {
  /** Untrusted proposal — validated by requireTenantScope. */
  requestedClientId: string | null | undefined;
  step: number;
  fields: OnboardingFieldMap;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedProfileCompleteness?: number;
  claimedOnboardingStatus?: string;
  claimedClientStatus?: string;
}

/**
 * Registry #10 — ApplyOnboardingStep.
 */
export function applyOnboardingStep(
  intent: ApplyOnboardingStepIntent
): ApplyOnboardingStepResult {
  const gate = requireTenantScope(intent.requestedClientId, {
    getCurrentUser: () => authService.getCurrentUser(),
    getClientById: (id) => dbService.getClientById(id),
  });
  if (!gate.ok) {
    throw new MasterProfileError('ACTOR_NOT_AUTHORIZED', gate.message);
  }

  try {
    const result = useCases.applyOnboardingStep({
      trusted: {
        actorId: gate.actorId,
        actorRole: gate.actorRole,
        organizationId: gate.organizationId,
        clientId: gate.clientId,
        now: new Date().toISOString(),
      },
      step: intent.step,
      fields: intent.fields,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
      claimedProfileCompleteness: intent.claimedProfileCompleteness,
      claimedOnboardingStatus: intent.claimedOnboardingStatus,
      claimedClientStatus: intent.claimedClientStatus,
    });

    auditService.log(
      authService.getCurrentUser(),
      'ONBOARDING_STEP_COMPLETED',
      'Client',
      gate.clientId,
      { step: intent.step }
    );
    if (result.completed) {
      auditService.log(
        authService.getCurrentUser(),
        'COMPLETE_ONBOARDING',
        'Client',
        gate.clientId
      );
    }
    return result;
  } catch (err) {
    mapError(err, 'No se pudo guardar el paso de onboarding');
  }
}
