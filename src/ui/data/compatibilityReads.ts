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
import {
  computeProfileCoverage,
  PROFILE_SECTION_LABELS,
  PROFILE_SECTION_ORDER,
} from '../../domain/profileCoverage';
import {
  aggregateWeeklyKpis,
  primaryKpiSeries,
  sumKpi,
  sumKpiThisWeek,
} from '../../domain/kpiWeekly';
import { kpiLabel } from '../../lib/campaignLabels';
import type { BusinessKpiType, Client, MasterDossier } from '../../types';
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

/* ------------------------------------------------------------------------- *
 * Wave-2 reads (T-010-201…204)
 *
 * Every derived number below is computed by a domain function called here, not
 * in a React component: the facade projects, the domain calculates, and the
 * component only renders (threat T-010-19). Each read stays read-only — no
 * mutator exists in this module and none may be added.
 * ------------------------------------------------------------------------- */

export interface MasterDossierRead {
  readonly dossier: MasterDossier | null;
  readonly client: Client | null;
}

/** T-010-201 · `MasterDossierPanel`. No canonical dossier projection exists. */
export function readMasterDossier(scope: TrustedTenantScope): MasterDossierRead {
  const clientId = requireClient(scope);
  if (!clientId) return { dossier: null, client: null };
  return {
    dossier: dbService.getMasterDossier(clientId) ?? null,
    client: dbService.getClientById(clientId) ?? null,
  };
}

/** Same display selection as the legacy chart, so the migrated view is a parity view. */
const CHART_KPIS: readonly BusinessKpiType[] = [
  'consultation_requests',
  'linkedin_profile_views',
  'website_visits_from_linkedin',
];

export interface KpiSeriesRead {
  readonly kpiType: string;
  readonly label: string;
  readonly values: readonly number[];
  readonly max: number;
}

export interface KpiWeeklyRead {
  readonly weekLabels: readonly string[];
  readonly series: readonly KpiSeriesRead[];
  readonly tiles: readonly { readonly label: string; readonly value: number }[];
  readonly consultationsThisWeek: number;
}

/** T-010-203 · `KpiWeeklyChart`. Aggregation is `domain/kpiWeekly`, not this facade and not React. */
export function readKpiWeekly(scope: TrustedTenantScope): KpiWeeklyRead {
  const clientId = requireClient(scope);
  if (!clientId) {
    return { weekLabels: [], series: [], tiles: [], consultationsThisWeek: 0 };
  }

  const results = dbService.getResultsByClient(clientId);
  const buckets = aggregateWeeklyKpis(
    results.filter((result) => result.kpiType),
    8
  );

  return {
    weekLabels: buckets.map((bucket) => bucket.weekLabel.split(' – ')[0]),
    series: primaryKpiSeries(buckets, [...CHART_KPIS]).map((s) => ({
      kpiType: s.kpiType,
      label: s.label,
      values: s.values,
      max: s.max,
    })),
    tiles: CHART_KPIS.map((kpiType) => ({
      label: kpiLabel(kpiType),
      value: sumKpi(results, kpiType),
    })),
    consultationsThisWeek: sumKpiThisWeek(results, 'consultation_requests'),
  };
}

export interface ProfileFactRead {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly status: string;
}

export interface ProfileSectionRead {
  readonly section: string;
  readonly label: string;
  readonly confirmed: number;
  readonly candidates: number;
  readonly complete: boolean;
  readonly facts: readonly ProfileFactRead[];
}

export interface ProfileOverviewRead {
  readonly totalConfirmed: number;
  readonly sectionsWithFacts: number;
  readonly meetsPilotThreshold: boolean;
  readonly sections: readonly ProfileSectionRead[];
  readonly clientDisplayName: string | null;
  readonly profileCompleteness: number;
  readonly serviceLines: readonly {
    readonly name: string;
    readonly description: string;
    readonly offerings: readonly string[];
  }[];
}

/** T-010-203 · `ClientProfilePanel`, display portion only. Fact mutation stays legacy (AUDIT010-09). */
export function readProfileOverview(scope: TrustedTenantScope): ProfileOverviewRead {
  const clientId = requireClient(scope);
  const empty: ProfileOverviewRead = {
    totalConfirmed: 0,
    sectionsWithFacts: 0,
    meetsPilotThreshold: false,
    sections: [],
    clientDisplayName: null,
    profileCompleteness: 0,
    serviceLines: [],
  };
  if (!clientId) return empty;

  const profile = dbService.getMasterProfile(clientId);
  const coverage = computeProfileCoverage(profile);
  const client = dbService.getClientById(clientId);
  const dossier = dbService.getMasterDossier(clientId);
  const facts = profile?.facts || [];

  return {
    totalConfirmed: coverage.totalConfirmed,
    sectionsWithFacts: coverage.sectionsWithFacts,
    meetsPilotThreshold: coverage.meetsPilotThreshold,
    sections: PROFILE_SECTION_ORDER.map((section) => {
      const coverageSection = coverage.sections.find((s) => s.label === PROFILE_SECTION_LABELS[section]);
      return {
        section,
        label: PROFILE_SECTION_LABELS[section],
        confirmed: coverageSection?.confirmed ?? 0,
        candidates: coverageSection?.candidates ?? 0,
        complete: coverageSection?.complete ?? false,
        facts: facts
          .filter((f) => f.section === section && f.status !== 'rejected')
          .map((f) => ({ id: f.id, label: f.label, value: f.value, status: f.status })),
      };
    }),
    clientDisplayName: client?.displayName ?? null,
    profileCompleteness: client?.profileCompleteness || 0,
    serviceLines: (dossier?.serviceLines || []).map((line) => ({
      name: line.name,
      description: line.description,
      offerings: line.offerings,
    })),
  };
}

export interface ProofWallItemRead {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly complete: boolean;
  readonly evidenceUrl: string | null;
}

export interface ProofWallRead {
  readonly items: readonly ProofWallItemRead[];
  readonly complete: number;
  readonly total: number;
  readonly percentComplete: number;
}

/** T-010-203 · `ProofWallPanel`, read-only. The status toggle stays legacy (AUDIT010-09). */
export function readProofWall(scope: TrustedTenantScope): ProofWallRead {
  const clientId = requireClient(scope);
  if (!clientId) return { items: [], complete: 0, total: 0, percentComplete: 0 };

  const items = dbService.getProofWallByClient(clientId);
  const complete = items.filter((item) => item.status === 'complete').length;

  return {
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description ?? null,
      complete: item.status === 'complete',
      evidenceUrl: item.evidenceId
        ? dbService.getEvidenceById(item.evidenceId)?.sourceUrl ?? null
        : null,
    })),
    complete,
    total: items.length,
    percentComplete: items.length ? Math.round((complete / items.length) * 100) : 0,
  };
}

export interface SourceRead {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly url: string | null;
  readonly fetchIntervalMinutes: number;
  readonly hasError: boolean;
}

/**
 * T-010-204 · `SourceRegistryModal`, read-only inventory.
 *
 * The legacy modal also runs the source-discovery agent while rendering. That is
 * a service call with its own side effects, so it is deliberately NOT reproduced
 * here: a read facade must not trigger an agent run.
 */
export function readSources(scope: TrustedTenantScope): readonly SourceRead[] {
  const clientId = requireClient(scope);
  if (!clientId) return [];
  return dbService.getSourcesByClient(clientId).map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    url: s.url ?? null,
    fetchIntervalMinutes: s.fetchIntervalMinutes,
    hasError: s.status === 'ERROR',
  }));
}
