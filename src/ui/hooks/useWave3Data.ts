/**
 * SPEC-010 · wave-3 page query hooks (T-010-301…305).
 *
 * AUTHORITY: NONE. Same contract as the wave-2 hooks: each hook is disabled
 * without a trusted tenant scope, builds its cache key from that scope, and
 * declares exactly ONE read source, which is part of the key so a canonical
 * projection and a compatibility read of the same resource can never collide
 * (threats T-010-08, T-010-13).
 *
 * No hook holds a business rule. Every derived number these hooks expose was
 * computed by a domain function inside the read facade — completeness, weight
 * validation, review readiness, thesis strength, work stage, source health
 * (threat T-010-19).
 *
 * Mutations invalidate by tenant rather than patching the cache, so a command's
 * effect is re-read from the source of truth (threats T-010-06, T-010-07).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantInvalidationKey, tenantQueryKey } from '../query/queryKeys';
import type { TrustedTenantScope } from '../query/tenantScope';
import {
  readAiCenter,
  readClientContent,
  readClientTasks,
  readContentDetail,
  readPortfolioOverview,
  readThesisDetail,
  readThesisOptions,
  readWorkspaceDeliver,
  readWorkspaceRadar,
  readWorkspaceSources,
  readWorkspaceTasks,
} from '../data/compatibilityReads';
import {
  readContentAuthorizingBriefs,
  readSignalOutcomes,
  readStrategicBriefs,
} from '../data/canonicalReads';
import { briefCommands, signalOutcomeCommands, type CommandResult } from '../commands/commandSeam';

const DISABLED = ['disabled'] as const;

/** READ SOURCE: compatibility — T-010-303. Portfolio scope, not client-scoped. */
export function usePortfolioOverview(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'portfolio-overview') : DISABLED,
    queryFn: () => readPortfolioOverview(scope!),
    enabled: scope !== null,
  });
}

/** READ SOURCE: compatibility — T-010-303. */
export function useAiCenter(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'ai-center') : DISABLED,
    queryFn: () => readAiCenter(scope!),
    enabled: scope !== null,
  });
}

/** READ SOURCE: compatibility — T-010-301, T-010-304. Full thesis list, no selection. */
export function useThesisOptions(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'thesis-options') : DISABLED,
    queryFn: () => readThesisOptions(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/**
 * READ SOURCE: compatibility — T-010-301.
 *
 * The thesis id is part of the cache key, so switching thesis cannot serve
 * another thesis's projection from cache. A null id keeps the query disabled
 * rather than resolving to a default thesis (threat T-010-15).
 */
export function useThesisDetail(scope: TrustedTenantScope | null, thesisId: string | null) {
  return useQuery({
    queryKey: scope
      ? tenantQueryKey(scope, 'compatibility', 'thesis-detail', thesisId ?? 'none')
      : DISABLED,
    queryFn: () => readThesisDetail(scope!, thesisId),
    enabled: scope !== null && scope.clientId !== null && thesisId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-304. */
export function useClientTasks(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'client-tasks') : DISABLED,
    queryFn: () => readClientTasks(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-304. */
export function useClientContent(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'client-content') : DISABLED,
    queryFn: () => readClientContent(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-302. */
export function useContentDetail(scope: TrustedTenantScope | null, contentId: string | null) {
  return useQuery({
    queryKey: scope
      ? tenantQueryKey(scope, 'compatibility', 'content-detail', contentId ?? 'none')
      : DISABLED,
    queryFn: () => readContentDetail(scope!, contentId),
    enabled: scope !== null && scope.clientId !== null && contentId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-305. */
export function useWorkspaceRadar(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'workspace-radar') : DISABLED,
    queryFn: () => readWorkspaceRadar(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-305. */
export function useWorkspaceDeliver(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'workspace-deliver') : DISABLED,
    queryFn: () => readWorkspaceDeliver(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-305. */
export function useWorkspaceSources(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'workspace-sources') : DISABLED,
    queryFn: () => readWorkspaceSources(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-305. */
export function useWorkspaceTasks(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'workspace-tasks') : DISABLED,
    queryFn: () => readWorkspaceTasks(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: canonical (SPEC-003 `strategicBriefConsumer`) — T-010-305. */
export function useStrategicBriefs(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'canonical', 'strategic-briefs') : DISABLED,
    queryFn: () => readStrategicBriefs(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: canonical (SPEC-003) — T-010-302. Briefs authorizing content creation. */
export function useContentAuthorizingBriefs(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'canonical', 'briefs-authorizing-content') : DISABLED,
    queryFn: () => readContentAuthorizingBriefs(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: canonical (SPEC-008 `learningLoopConsumer`) — T-010-305. */
export function useSignalOutcomes(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'canonical', 'signal-outcomes') : DISABLED,
    queryFn: () => readSignalOutcomes(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/**
 * SPEC-008 signal-outcome intent — T-010-305.
 *
 * Only ids, a kind and an optional note cross the boundary. The canonical
 * consumer loads current state itself, so nothing here can pass a stale
 * aggregate as authority.
 */
export function useRegisterSignalOutcome(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    CommandResult,
    Error,
    { signalId: string; kind: 'USEFUL' | 'NOT_USEFUL'; thesisId?: string | null; note?: string }
  >({
    mutationFn: async (params) => {
      if (!scope) return { ok: false, message: 'Sesión sin contexto de organización' };
      return signalOutcomeCommands.register(scope, params);
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({ queryKey: tenantInvalidationKey(scope, 'canonical') });
      void queryClient.invalidateQueries({
        queryKey: tenantInvalidationKey(scope, 'compatibility'),
      });
    },
  });
}

/**
 * SPEC-003 brief approval — T-010-305.
 *
 * The React button is enabled from the canonical projection's own status, but
 * the consumer re-validates and may refuse; a refusal invalidates nothing and
 * leaves no UI state claiming the brief was approved.
 */
export function useApproveBrief(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<CommandResult, Error, { briefId: string }>({
    mutationFn: async ({ briefId }) => {
      if (!scope) return { ok: false, message: 'Sesión sin contexto de organización' };
      return briefCommands.approve(scope, briefId);
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({ queryKey: tenantInvalidationKey(scope, 'canonical') });
    },
  });
}
