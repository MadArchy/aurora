/**
 * SPEC-010 · trusted session projection.
 *
 * AUTHORITY: NONAUTHORITATIVE_SESSION_PROJECTION.
 *
 * `authService` (SPEC-009) is the single auth authority. This context subscribes
 * to it and re-publishes what it reports. It never manufactures
 * `organizationId`, `clientId`, `actorUid`, `role`, HUMAN, ADMIN or MANAGER, and
 * it exposes no setter — there is no code path by which a component can write a
 * session value (threats T-010-09, T-010-10, T-010-11, T-010-23).
 *
 * Because the projection is read-only and derived, a second auth authority
 * cannot come into existence through it.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService } from '../../services/auth';
import type { User } from '../../types';
import { buildTrustedTenantScope, type TrustedTenantScope } from '../query/tenantScope';

export interface SessionProjection {
  /** Exactly what the trusted runtime reports; `null` when unauthenticated. */
  readonly user: User | null;
  /** Derived from `user` only. `null` when there is no trusted session. */
  readonly tenantScope: TrustedTenantScope | null;
  readonly isAdmin: boolean;
  readonly isImpersonating: boolean;
}

const EMPTY_SESSION: SessionProjection = {
  user: null,
  tenantScope: null,
  isAdmin: false,
  isImpersonating: false,
};

const SessionContext = createContext<SessionProjection>(EMPTY_SESSION);

function project(user: User | null): SessionProjection {
  if (!user) return EMPTY_SESSION;

  let tenantScope: TrustedTenantScope | null = null;
  try {
    tenantScope = buildTrustedTenantScope(user);
  } catch {
    // Fail closed: an unusable trusted identity yields no scope, so every
    // tenant-scoped read and cache key is withheld rather than guessed.
    tenantScope = null;
  }

  return {
    user,
    tenantScope,
    isAdmin: user.role === 'ADMIN',
    isImpersonating: authService.isImpersonating(),
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => authService.getCurrentUser());

  useEffect(() => authService.subscribe(setUser), []);

  const value = useMemo(() => project(user), [user]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionProjection {
  return useContext(SessionContext);
}

/**
 * Trusted tenant scope for the current session, or `null`.
 *
 * Components must treat `null` as "no data may be read", never as a reason to
 * fall back to a UI-supplied identity.
 */
export function useTrustedTenantScope(): TrustedTenantScope | null {
  return useSession().tenantScope;
}
