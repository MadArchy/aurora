/**
 * SPEC-010 · wave-1 shell query hooks.
 *
 * AUTHORITY: NONE. Hooks orchestrate UI and cache concerns only. They contain no
 * Strategic Score formula, routing decision, lifecycle transition, publication
 * gate, opportunity scoring or learning-approval logic (threat T-010-19).
 *
 * Every hook is disabled unless a trusted tenant scope exists, and every cache
 * key is built from that scope, so no read can be issued or cached under an
 * identity the UI invented.
 *
 * Each hook declares ONE read source — canonical or compatibility — and the
 * source is part of the cache key, so the two can never be confused for one
 * another (threat T-010-13).
 */

import { useQuery } from '@tanstack/react-query';
import { tenantQueryKey } from '../query/queryKeys';
import type { TrustedTenantScope } from '../query/tenantScope';
import {
  readClientBadges,
  readPortfolioBadges,
  readShellContext,
  readWorkspaceBadges,
} from '../data/compatibilityReads';
import { readClientOpportunities } from '../data/canonicalReads';

/** READ SOURCE: compatibility (no canonical portfolio projection exists yet). */
export function usePortfolioBadges(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'portfolio-badges') : ['disabled'],
    queryFn: () => readPortfolioBadges(scope!),
    enabled: scope !== null,
  });
}

/** READ SOURCE: compatibility. */
export function useWorkspaceBadges(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'workspace-badges') : ['disabled'],
    queryFn: () => readWorkspaceBadges(scope!),
    enabled: scope !== null,
  });
}

/** READ SOURCE: compatibility. */
export function useClientBadges(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'client-badges') : ['disabled'],
    queryFn: () => readClientBadges(scope!),
    enabled: scope !== null,
  });
}

/** READ SOURCE: compatibility. */
export function useShellContext(scope: TrustedTenantScope | null, workspaceClientId: string | null) {
  return useQuery({
    queryKey: scope
      ? tenantQueryKey(scope, 'compatibility', 'shell-context', workspaceClientId ?? null)
      : ['disabled'],
    queryFn: () => readShellContext(scope!, workspaceClientId),
    enabled: scope !== null,
  });
}

/**
 * READ SOURCE: canonical (SPEC-007 `opportunityScoutConsumer`).
 *
 * Demonstrates the canonical path end to end. The count derived from it is a
 * display badge; it is never an input to a strategic decision.
 */
export function useCanonicalOpportunities(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'canonical', 'opportunities') : ['disabled'],
    queryFn: () => readClientOpportunities(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}
