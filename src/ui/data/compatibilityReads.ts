/**
 * SPEC-010 · legacy compatibility read facade.
 *
 * STATUS: NONAUTHORITATIVE_COMPATIBILITY_READ.
 *
 * This is the ONLY module in the React presentation layer permitted to import
 * `dbService`. It exists so React modules never import the legacy singleton
 * directly (acceptance A8, threat T-010-01) while the canonical projections for
 * these resources do not yet exist.
 *
 * This facade is NOT canonical and must never be presented as such. It performs
 * reads only — no mutator is exposed, and none may be added. When a canonical
 * projection becomes available for a resource, that resource moves to
 * `canonicalReads.ts` and is removed from here.
 *
 * Tenant note (AUDIT010-05): the underlying legacy reads are `clientId`-scoped
 * only. Callers must pass a `TrustedTenantScope`, so the organization is always
 * part of the cache identity even though the legacy layer cannot enforce it.
 * This narrows cache-level bleed; it does not make the legacy read
 * organization-safe, and that gap stays recorded until the canonical migration.
 */

import { dbService } from '../../services/db';
import { mapOpportunityLifecycle } from '../../domain/opportunityLifecycle';
import { computeProfileCoverage } from '../../domain/profileCoverage';
import type { TrustedTenantScope } from '../query/tenantScope';

export const COMPATIBILITY_READ_STATUS = 'NONAUTHORITATIVE_COMPATIBILITY_READ' as const;

/** Requires a trusted scope so a compatibility read cannot be issued from UI-supplied identity. */
function requireClient(scope: TrustedTenantScope): string | null {
  return scope.clientId;
}

export interface PortfolioBadgeCounts {
  readonly clientsNeedingAttention: number;
}

export function readPortfolioBadges(_scope: TrustedTenantScope): PortfolioBadgeCounts {
  return {
    clientsNeedingAttention: dbService.getPortfolioSummary().filter((s) => s.attentionScore > 0).length,
  };
}

export interface WorkspaceBadgeCounts {
  readonly unreviewedSignals: number;
  readonly pendingCuration: number;
  readonly draftDeliveryItems: number;
  readonly sourceErrors: number;
  readonly openTasks: number;
  readonly inProduction: number;
}

export function readWorkspaceBadges(scope: TrustedTenantScope): WorkspaceBadgeCounts {
  const clientId = requireClient(scope);
  if (!clientId) {
    return {
      unreviewedSignals: 0,
      pendingCuration: 0,
      draftDeliveryItems: 0,
      sourceErrors: 0,
      openTasks: 0,
      inProduction: 0,
    };
  }

  return {
    unreviewedSignals: dbService
      .getSignalsByClient(clientId)
      .filter((s) => s.managerDecision === 'UNREVIEWED' && s.status !== 'DISCARDED').length,
    pendingCuration: dbService.getPendingCurationByClient(clientId).length,
    draftDeliveryItems: dbService.getDraftDelivery(clientId)?.items.length || 0,
    sourceErrors: dbService.getSourcesByClient(clientId).filter((s) => s.status === 'ERROR').length,
    openTasks: dbService
      .getTasksByClient(clientId)
      .filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length,
    inProduction: dbService.getContentByClient(clientId).filter((c) => c.status !== 'PUBLISHED').length,
  };
}

export interface ClientBadgeCounts {
  readonly openTasks: number;
  readonly pendingContentReview: number;
  readonly openOpportunities: number;
  readonly profileIncomplete: boolean;
}

export function readClientBadges(scope: TrustedTenantScope): ClientBadgeCounts {
  const clientId = requireClient(scope);
  if (!clientId) {
    return { openTasks: 0, pendingContentReview: 0, openOpportunities: 0, profileIncomplete: false };
  }

  const coverage = computeProfileCoverage(dbService.getMasterProfile(clientId));

  return {
    openTasks: dbService
      .getTasksByClient(clientId)
      .filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length,
    pendingContentReview: dbService
      .getContentByClient(clientId)
      .filter((c) => c.status === 'CLIENT_REVIEW').length,
    openOpportunities: dbService.getOpportunitiesByClient(clientId).filter((o) => {
      if (o.status === 'ARCHIVED') return false;
      const stage = mapOpportunityLifecycle(o);
      return stage === 'proposed' || stage === 'checklist' || stage === 'accepted';
    }).length,
    profileIncomplete: coverage ? !coverage.meetsPilotThreshold : false,
  };
}

export interface ShellContextRead {
  readonly workspaceClientName: string | null;
  readonly workspaceClientProfession: string | null;
  /** Presentation-only option lists. Selecting an option is never a strategic decision. */
  readonly campaigns: readonly { id: string; name: string }[];
  readonly theses: readonly { id: string; title: string }[];
}

export function readShellContext(
  scope: TrustedTenantScope,
  workspaceClientId: string | null
): ShellContextRead {
  const clientId = workspaceClientId ?? requireClient(scope);
  if (!clientId) {
    return {
      workspaceClientName: null,
      workspaceClientProfession: null,
      campaigns: [],
      theses: [],
    };
  }

  const client = dbService.getClientById(clientId);

  return {
    workspaceClientName: client?.displayName ?? null,
    workspaceClientProfession: client?.profession ?? null,
    campaigns: dbService.getCampaignsByClient(clientId).map((c) => ({ id: c.id, name: c.name })),
    // MULTI-THESIS: every viewable thesis is returned. No primary/first thesis is
    // selected here and no ordering implies authority (threat T-010-15).
    theses: dbService
      .getThesesByClient(clientId)
      .filter((t) => t.status === 'ACTIVE' || t.status === 'UNDER_REVIEW')
      .map((t) => ({ id: t.id, title: t.title })),
  };
}
