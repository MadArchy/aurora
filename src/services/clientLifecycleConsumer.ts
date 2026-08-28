/**
 * CR-1 Workstream 1 — Client Lifecycle consumer facade.
 *
 * Composition root for main.ts / command seam. UI issues intent only.
 * Security gates (`requireAdminActor`) establish trusted org/actor/role.
 * Application owns business orchestration for registry #34 and #1.
 */

import {
  ClientLifecycleError,
  type CreateClientWithInviteResult,
  type AcceptClientInvitationResult,
} from '../application/clientLifecycle';
import { composeClientLifecycle } from '../composition/clientLifecycle/composeClientLifecycle';
import { requireAdminActor } from '../controllers/trustedTenant';
import { authService } from './auth';
import { auditService } from './audit';
import { notificationService } from './notifications';
import { dbService } from './db';

type ClientLifecycleUseCases = ReturnType<typeof composeClientLifecycle>;

let useCases: ClientLifecycleUseCases = composeClientLifecycle();

/** Test-only reset — not production API. */
export function resetClientLifecycleConsumerForTest(
  next?: ClientLifecycleUseCases
): void {
  useCases = next ?? composeClientLifecycle();
}

function mapError(err: unknown, fallback: string): never {
  if (err instanceof ClientLifecycleError) {
    throw err;
  }
  throw new ClientLifecycleError(
    'PERSISTENCE_ERROR',
    err instanceof Error ? err.message : fallback
  );
}

export interface CreateClientWithInviteIntent {
  firstName: string;
  lastName: string;
  email: string;
  profession?: string;
  company?: string;
  targetMarket?: string;
  /** Never authority — denied if it disagrees with the trusted session org. */
  claimedOrganizationId?: string;
}

/**
 * Registry #34 — CreateClientWithInvite.
 * Organization and actor come exclusively from `requireAdminActor`.
 */
export function createClientWithInvite(
  intent: CreateClientWithInviteIntent
): CreateClientWithInviteResult {
  const gate = requireAdminActor({
    getCurrentUser: () => authService.getCurrentUser(),
  });
  if (!gate.ok) {
    throw new ClientLifecycleError('ACTOR_NOT_AUTHORIZED', gate.message);
  }

  try {
    const result = useCases.createClientWithInvite({
      trusted: {
        actorId: gate.actorId,
        actorRole: gate.actorRole,
        organizationId: gate.organizationId,
        now: new Date().toISOString(),
      },
      firstName: intent.firstName,
      lastName: intent.lastName,
      email: intent.email,
      profession: intent.profession,
      company: intent.company,
      targetMarket: intent.targetMarket,
      claimedOrganizationId: intent.claimedOrganizationId,
    });

    notificationService.push({
      userId: gate.actorId,
      organizationId: gate.organizationId,
      clientId: result.client.id,
      type: 'ONBOARDING',
      title: 'Cliente invitado',
      body: `${result.client.displayName} · token ${result.invitation.token}`,
    });
    auditService.log(
      authService.getCurrentUser(),
      'CREATE_CLIENT',
      'Client',
      result.client.id,
      { email: intent.email }
    );

    return result;
  } catch (err) {
    mapError(err, 'No se pudo crear el cliente');
  }
}

export interface AcceptClientInvitationIntent {
  token: string;
  password: string;
  displayName: string;
}

/**
 * Registry #1 — AcceptClientInvitation.
 * Loads invitation by token; caller never supplies org/client/role authority.
 */
export async function acceptClientInvitation(
  intent: AcceptClientInvitationIntent
): Promise<AcceptClientInvitationResult> {
  try {
    return await useCases.acceptClientInvitation({
      token: intent.token,
      password: intent.password,
      displayName: intent.displayName,
    });
  } catch (err) {
    mapError(err, 'No se pudo aceptar la invitación');
  }
}

/** Re-export for tests that assert gate coupling without importing controllers. */
export function __testOnly_listVisibleClients(): ReturnType<typeof dbService.getClients> {
  return dbService.getClients();
}
