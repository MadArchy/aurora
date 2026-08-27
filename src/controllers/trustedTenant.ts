import type { Client, User, UserRole } from '../types';

/**
 * SPEC-010 Phase 4C — AUDIT010-10 / AUDIT010-11 remediation.
 *
 * This module is a **gate**, not a tenant authority. It holds no state and
 * invents no identity: the organization always comes from the trusted session
 * and never from the client record or the caller. A caller may *propose* a
 * client id (from a DOM attribute, a form, a route); the gate decides whether
 * the trusted session is entitled to it. That is what keeps caller tenant
 * authority at zero while still letting a manager work across their clients.
 *
 * Why the organization is read from the session rather than the client:
 * `main.ts` `resolveOrganizationId()` reads it from the client record first, so
 * it answers "does this client have an org?" rather than "may this actor act on
 * this client?". Any existing client passes that check. This gate answers the
 * second question.
 */

export type TenantDenialReason =
  | 'NO_SESSION'
  | 'NO_TRUSTED_ORG'
  | 'NO_CLIENT_SCOPE'
  | 'UNKNOWN_CLIENT'
  | 'CROSS_ORG'
  | 'CLIENT_SCOPE_VIOLATION';

export interface TenantGrant {
  ok: true;
  /** Trusted, validated tenant. Safe to use as a command parameter. */
  clientId: string;
  /** Always the actor's own organization. Never the client record's. */
  organizationId: string;
  actorId: string;
  actorRole: UserRole;
}

export interface TenantDenial {
  ok: false;
  reason: TenantDenialReason;
  /** Operator-facing message; safe to surface in a toast. */
  message: string;
}

export type TenantDecision = TenantGrant | TenantDenial;

export interface TenantGateDeps {
  getCurrentUser(): User | null;
  getClientById(id: string): Client | undefined;
}

const DENIALS: Record<TenantDenialReason, string> = {
  NO_SESSION: 'Sesión no disponible — acción cancelada.',
  NO_TRUSTED_ORG: 'Sesión sin organizationId de confianza — acción cancelada.',
  NO_CLIENT_SCOPE: 'Selecciona un cliente antes de continuar.',
  UNKNOWN_CLIENT: 'Cliente no encontrado — acción cancelada.',
  CROSS_ORG: 'El cliente no pertenece a tu organización — acción cancelada.',
  CLIENT_SCOPE_VIOLATION: 'No puedes operar sobre otro cliente.',
};

function deny(reason: TenantDenialReason): TenantDenial {
  return { ok: false, reason, message: DENIALS[reason] };
}

/**
 * Resolves the tenant for a business or agent effect, failing closed.
 *
 * `requested` is untrusted input by construction — pass the DOM/form value
 * straight in and let the gate rule on it.
 */
export function requireTenantScope(
  requested: string | null | undefined,
  deps: TenantGateDeps,
): TenantDecision {
  const user = deps.getCurrentUser();
  if (!user) return deny('NO_SESSION');

  const organizationId = user.organizationId?.trim();
  if (!organizationId) return deny('NO_TRUSTED_ORG');

  const actor = { actorId: user.uid, actorRole: user.role, organizationId } as const;
  const asked = requested?.trim() || '';

  // A CLIENT is pinned to its own tenant. A proposed id is only ever accepted
  // when it matches, so a spoofed attribute cannot redirect the effect.
  if (user.role === 'CLIENT') {
    const own = user.clientId?.trim();
    if (!own) return deny('NO_CLIENT_SCOPE');
    if (asked && asked !== own) return deny('CLIENT_SCOPE_VIOLATION');
    return { ok: true, clientId: own, ...actor };
  }

  // An ADMIN may act across clients, but only inside its own organization, and
  // only on an explicitly chosen one — there is no positional default.
  if (!asked) return deny('NO_CLIENT_SCOPE');

  const client = deps.getClientById(asked);
  if (!client) return deny('UNKNOWN_CLIENT');
  if (client.organizationId?.trim() !== organizationId) return deny('CROSS_ORG');

  return { ok: true, clientId: client.id, ...actor };
}

/**
 * Actor-only gate for effects with no tenant of their own (an organization-wide
 * admin utility, for example). Role is read from the trusted session; a hidden
 * or disabled button is never accepted as authorization.
 */
export function requireAdminActor(deps: Pick<TenantGateDeps, 'getCurrentUser'>): TenantDecision {
  const user = deps.getCurrentUser();
  if (!user) return deny('NO_SESSION');

  const organizationId = user.organizationId?.trim();
  if (!organizationId) return deny('NO_TRUSTED_ORG');
  if (user.role !== 'ADMIN') return deny('CLIENT_SCOPE_VIOLATION');

  return {
    ok: true,
    clientId: '',
    organizationId,
    actorId: user.uid,
    actorRole: user.role,
  };
}
