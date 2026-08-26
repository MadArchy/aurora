/**
 * SPEC-007 Phase 1 — Materialized Opportunity aggregate (Stage B, pure).
 * Requires SPEC-004 CREATE_OPPORTUNITY authorization context fact.
 */

import type { OpportunityCandidate, OpportunityType } from './opportunityCandidateCore';
import {
  assertOpportunityTransition,
  type CanonicalOpportunityStatus,
  type OpportunityActorKind,
} from './opportunityLifecycleCore';
import {
  assertMaterializeGate,
  type CreateOpportunityAuthorizationContext,
  type MaterializeGateDecision,
} from './opportunityMaterializeGateCore';
import { oppFail, oppOk, type OpportunityDomainResult } from './opportunityScoutErrors';
import { assertOpportunityTenantStructure } from './opportunityTenantCore';

export const MATERIALIZED_OPPORTUNITY_SCHEMA_VERSION = 'opportunity-v1' as const;

export interface OpportunityChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface MaterializedOpportunity {
  id: string;
  organizationId: string;
  clientId: string;
  thesisId: string;
  candidateId: string | null;
  candidateVersion: number | null;
  strategicBriefId: string;
  strategicBriefVersion: number;
  strategicPlanId: string;
  strategicPlanVersion: number;
  planItemId: string;
  title: string;
  organization: string;
  type: OpportunityType;
  deadline: string | null;
  description: string;
  fitRationale: string;
  status: CanonicalOpportunityStatus;
  submissionChecklist: OpportunityChecklistItem[];
  schemaVersion: typeof MATERIALIZED_OPPORTUNITY_SCHEMA_VERSION;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface MaterializeOpportunityInput {
  id: string;
  authorization: CreateOpportunityAuthorizationContext;
  thesisId: string;
  candidate?: OpportunityCandidate | null;
  title: string;
  organization: string;
  type: OpportunityType;
  deadline?: string | null;
  description: string;
  fitRationale: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  submissionChecklist?: OpportunityChecklistItem[];
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export function materializeOpportunity(
  input: MaterializeOpportunityInput
): OpportunityDomainResult<{
  opportunity: MaterializedOpportunity;
  gate: MaterializeGateDecision;
}> {
  const gate = assertMaterializeGate({
    authorization: input.authorization,
    candidate: input.candidate,
    thesisId: input.thesisId,
  });
  if (!gate.ok) return gate;
  if (!gate.value.allowed) {
    return oppFail(
      'CREATE_OPPORTUNITY_AUTHORIZATION_REQUIRED',
      'materialize gate denied'
    );
  }

  const tenant = assertOpportunityTenantStructure(input.authorization);
  if (!tenant.ok) return tenant;

  const id = nonEmpty(input.id);
  const title = nonEmpty(input.title);
  const organization = nonEmpty(input.organization);
  const description = nonEmpty(input.description);
  const fitRationale = nonEmpty(input.fitRationale);
  const createdAt = nonEmpty(input.createdAt);
  const updatedAt = nonEmpty(input.updatedAt);
  const createdBy = nonEmpty(input.createdBy);
  if (
    !id ||
    !title ||
    !organization ||
    !description ||
    !fitRationale ||
    !createdAt ||
    !updatedAt ||
    !createdBy
  ) {
    return oppFail('INVALID_OPPORTUNITY', 'required materialization fields missing');
  }

  let candidateId: string | null = gate.value.candidateId;
  let candidateVersion: number | null = null;
  if (input.candidate) {
    candidateId = input.candidate.id;
    candidateVersion = input.candidate.version;
  }

  const opportunity: MaterializedOpportunity = {
    id,
    organizationId: tenant.value.organizationId,
    clientId: tenant.value.clientId,
    thesisId: gate.value.thesisId,
    candidateId,
    candidateVersion,
    strategicBriefId: gate.value.strategicBriefId,
    strategicBriefVersion: gate.value.strategicBriefVersion,
    strategicPlanId: gate.value.strategicPlanId,
    strategicPlanVersion: gate.value.strategicPlanVersion,
    planItemId: gate.value.planItemId,
    title,
    organization,
    type: input.type,
    deadline: input.deadline ?? null,
    description,
    fitRationale,
    status: 'PROPOSED',
    submissionChecklist: input.submissionChecklist
      ? input.submissionChecklist.map((c) => ({ ...c }))
      : [],
    schemaVersion: MATERIALIZED_OPPORTUNITY_SCHEMA_VERSION,
    version: 1,
    createdAt,
    updatedAt,
    createdBy,
  };

  return oppOk({ opportunity, gate: gate.value });
}

export function transitionMaterializedOpportunity(
  opportunity: MaterializedOpportunity,
  to: CanonicalOpportunityStatus,
  actorKind: OpportunityActorKind,
  updatedAt: string
): OpportunityDomainResult<MaterializedOpportunity> {
  const transition = assertOpportunityTransition(opportunity.status, to, actorKind);
  if (!transition.ok) return transition;
  const at = nonEmpty(updatedAt);
  if (!at) return oppFail('INVALID_OPPORTUNITY', 'updatedAt required');
  return oppOk({
    ...opportunity,
    status: to,
    updatedAt: at,
    version: opportunity.version + 1,
  });
}
