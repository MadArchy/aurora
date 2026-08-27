/**
 * SPEC-010 · wave-2 component query hooks (T-010-201…204).
 *
 * AUTHORITY: NONE. These hooks orchestrate cache and loading concerns. They hold
 * no Strategic Score formula, routing decision, lifecycle transition,
 * publication gate, opportunity scoring or learning-approval logic — every
 * derived value they expose was computed by a domain function inside the read
 * facade (threat T-010-19).
 *
 * Each hook is disabled unless a trusted tenant scope exists, and builds its
 * cache key from that scope, so no read is issued or cached under an identity
 * the UI invented (threat T-010-08).
 *
 * Each hook declares exactly ONE read source, and the source is part of the
 * cache key, so a canonical projection and a compatibility read of the same
 * resource can never be confused or collide (threat T-010-13).
 *
 * Mutations invalidate by tenant so a command's effect is re-read from the
 * source of truth instead of being patched into the cache. Nothing here writes
 * an optimistic business outcome (threats T-010-06, T-010-07).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantInvalidationKey, tenantQueryKey } from '../query/queryKeys';
import type { TrustedTenantScope } from '../query/tenantScope';
import {
  readKpiWeekly,
  readMasterDossier,
  readOnboardingContext,
  readProfileOverview,
  readProofWall,
  readSources,
} from '../data/compatibilityReads';
import { readClientOpportunityCards } from '../data/canonicalReads';
import { opportunityCommands, resultCommands, type CommandResult } from '../commands/commandSeam';

const DISABLED = ['disabled'] as const;

/** READ SOURCE: canonical (SPEC-007 `opportunityScoutConsumer`) — T-010-202. */
export function useOpportunities(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'canonical', 'opportunities') : DISABLED,
    queryFn: () => readClientOpportunityCards(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility (no canonical dossier projection exists) — T-010-201. */
export function useMasterDossier(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'master-dossier') : DISABLED,
    queryFn: () => readMasterDossier(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-203. */
export function useKpiWeekly(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'kpi-weekly') : DISABLED,
    queryFn: () => readKpiWeekly(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-203. */
export function useProfileOverview(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'profile-overview') : DISABLED,
    queryFn: () => readProfileOverview(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/**
 * READ SOURCE: compatibility — T-010-205.
 *
 * Read-only: the onboarding step is applied by the legacy controller, so this
 * hook exposes no mutation (AUDIT010-09 #10).
 */
export function useOnboardingContext(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'onboarding-context') : DISABLED,
    queryFn: () => readOnboardingContext(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-203. */
export function useProofWall(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'proof-wall') : DISABLED,
    queryFn: () => readProofWall(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-204. */
export function useSources(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'sources') : DISABLED,
    queryFn: () => readSources(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

type OpportunityIntent =
  | { kind: 'accept'; opportunityId: string; notes?: string }
  | { kind: 'decline'; opportunityId: string; notes: string }
  | { kind: 'toggle'; opportunityId: string; itemId: string; done: boolean }
  | { kind: 'submit'; opportunityId: string };

/**
 * Canonical opportunity commands — T-010-202.
 *
 * The hook forwards an intent to the command seam and, whatever the verdict,
 * invalidates the tenant's canonical cache so the next render reflects the state
 * the canonical layer actually holds rather than what the UI hoped for.
 */
export function useOpportunityCommands(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();

  return useMutation<CommandResult, Error, OpportunityIntent>({
    mutationFn: async (intent) => {
      if (!scope) return { ok: false, message: 'Sesión sin contexto de organización' };
      switch (intent.kind) {
        case 'accept':
          return opportunityCommands.accept(scope, intent.opportunityId, intent.notes);
        case 'decline':
          return opportunityCommands.decline(scope, intent.opportunityId, intent.notes);
        case 'toggle':
          return opportunityCommands.toggleChecklistItem(
            scope,
            intent.opportunityId,
            intent.itemId,
            intent.done
          );
        case 'submit':
          return opportunityCommands.submit(scope, intent.opportunityId);
      }
    },
    onSettled: () => {
      if (scope) {
        void queryClient.invalidateQueries({ queryKey: tenantInvalidationKey(scope, 'canonical') });
      }
    },
  });
}

/** Canonical consultation intent (SPEC-008 learning loop) — T-010-203. */
export function useRegisterConsultation(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();

  return useMutation<CommandResult, Error, string>({
    mutationFn: async (note) => {
      if (!scope) return { ok: false, message: 'Sesión sin contexto de organización' };
      return resultCommands.registerConsultation(scope, note);
    },
    onSettled: () => {
      if (scope) {
        void queryClient.invalidateQueries({
          queryKey: tenantInvalidationKey(scope, 'compatibility'),
        });
      }
    },
  });
}
