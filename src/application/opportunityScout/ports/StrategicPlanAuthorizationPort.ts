/**
 * SPEC-007 Phase 2 — SPEC-004 authorization reader port (facade).
 * Consumes canonical CREATE_OPPORTUNITY decision — does not reimplement Planner.
 */

import type { OpportunityTenantScope } from './OpportunityCandidateRepository';

export type PlanAuthorizationDisposition =
  | 'ALLOW'
  | 'DENY'
  | 'NONE'
  | 'RESEARCH_ONLY';

export interface StrategicPlanAuthorizationRequest {
  tenant: OpportunityTenantScope;
  planId: string;
  planItemId: string;
  /** Trusted Domain actor kind already resolved by Application. */
  actorKind: 'HUMAN' | 'SOFTWARE';
}

/**
 * Authoritative Plan authorization fact for materialization.
 * Caller-supplied Plan/Brief/allowed flags are never used in Application.
 */
export interface StrategicPlanAuthorizationDecision {
  disposition: PlanAuthorizationDisposition;
  allowed: boolean;
  action: string;
  organizationId: string;
  clientId: string;
  thesisId: string;
  strategicBriefId: string;
  strategicBriefVersion: number;
  strategicPlanId: string;
  strategicPlanVersion: number;
  planItemId: string;
  planStatus: string;
  reasons: string[];
}

export interface StrategicPlanAuthorizationPort {
  authorizeCreateOpportunity(
    request: StrategicPlanAuthorizationRequest
  ): StrategicPlanAuthorizationDecision;
}
