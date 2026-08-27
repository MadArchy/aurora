/**
 * SPEC-010 · trusted tenant scope for the React presentation layer.
 *
 * AUTHORITY: NONE. This module does not establish tenant identity — it only
 * transports a scope that was already resolved by the trusted auth runtime
 * (SPEC-009 `authService`).
 *
 * Caller tenant authority target = 0. A tenant scope may therefore never be
 * built from a URL parameter, a form field, React state or a query cache entry.
 * `buildTrustedTenantScope` accepts only a trusted `User` and is the sole way to
 * obtain a `TrustedTenantScope`, whose brand cannot be forged from UI data.
 */

import type { User } from '../../types';

declare const trustedTenantBrand: unique symbol;

export interface TrustedTenantScope {
  readonly organizationId: string;
  /** `null` for manager/portfolio scope, which is not bound to a single client. */
  readonly clientId: string | null;
  readonly [trustedTenantBrand]: true;
}

export class UntrustedTenantScopeError extends Error {
  constructor(reason: string) {
    super(`Untrusted tenant scope rejected: ${reason}`);
    this.name = 'UntrustedTenantScopeError';
  }
}

/**
 * Derives the tenant scope from the trusted session user. This is the only
 * sanctioned constructor of a `TrustedTenantScope`.
 */
export function buildTrustedTenantScope(user: User): TrustedTenantScope {
  const organizationId = user.organizationId?.trim();
  if (!organizationId) {
    throw new UntrustedTenantScopeError('trusted session carries no organizationId');
  }

  const clientId = user.role === 'ADMIN' ? null : user.clientId?.trim() || null;
  if (user.role !== 'ADMIN' && !clientId) {
    throw new UntrustedTenantScopeError('non-admin trusted session carries no clientId');
  }

  return { organizationId, clientId } as TrustedTenantScope;
}

/**
 * Narrows a trusted scope to one client the session is already entitled to see.
 *
 * A UI selection (sidebar, dropdown, URL) may *request* a client context, but it
 * never establishes one: an admin scope may narrow to any client in its own
 * organization, while a client scope may only narrow to itself. Anything else is
 * rejected rather than silently widened.
 */
export function narrowToClient(scope: TrustedTenantScope, requestedClientId: string): TrustedTenantScope {
  const requested = requestedClientId?.trim();
  if (!requested) {
    throw new UntrustedTenantScopeError('requested clientId is empty');
  }
  if (scope.clientId !== null && scope.clientId !== requested) {
    throw new UntrustedTenantScopeError(
      'client-scoped session may not narrow to a different clientId'
    );
  }
  return { organizationId: scope.organizationId, clientId: requested } as TrustedTenantScope;
}

/** Stable, non-authoritative string form used only to build cache keys. */
export function tenantScopeKey(scope: TrustedTenantScope): readonly [string, string] {
  return [scope.organizationId, scope.clientId ?? '*portfolio*'] as const;
}
