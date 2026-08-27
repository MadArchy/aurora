/**
 * SPEC-010 · canonical read facade.
 *
 * AUTHORITY: NONE. This facade projects state owned by other SPECs; it neither
 * decides nor stores anything.
 *
 * React modules reach canonical state only through this file, which delegates to
 * the existing canonical consumers. It must never import `dbService`, a
 * `Local*Store`, the Firestore SDK or an AI provider (threats T-010-01…04), and
 * it must never recreate logic owned by another SPEC (threats T-010-17…22) — it
 * forwards calls and returns the consumer's own projection unchanged.
 */

import { listOpportunitiesForClient } from '../../services/opportunityScoutConsumer';
import type { OpportunityDisplayProjection } from '../../services/opportunityScoutConsumer';
import type { TrustedTenantScope } from '../query/tenantScope';

export const CANONICAL_READ_STATUS = 'CANONICAL_PROJECTION' as const;

/**
 * SPEC-007 Opportunity projections for one client.
 *
 * The trusted scope's `clientId` is passed as the read scope, and the same value
 * is passed as the claimed identity so the consumer's own tenant validation runs
 * against trusted input rather than anything the UI invented.
 */
export function readClientOpportunities(
  scope: TrustedTenantScope
): readonly OpportunityDisplayProjection[] {
  if (!scope.clientId) return [];
  return listOpportunitiesForClient(scope.clientId, {
    claimedOrganizationId: scope.organizationId,
    claimedClientId: scope.clientId,
  });
}

export type { OpportunityDisplayProjection };
