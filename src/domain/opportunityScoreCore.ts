/**
 * SPEC-007 Phase 1 — OpportunityScore value object (pure).
 * Distinct from SPEC-002 Strategic Score. No execution authority.
 *
 * Formal contract APPROVED via T-007-010 (complete SPEC-007 package).
 * Formula: opportunity-scoring.md — opportunity-score-v1-proposed weights/bands.
 */

import { oppFail, oppOk, type OpportunityDomainResult } from './opportunityScoutErrors';
import {
  assertOpportunityTenantStructure,
  type OpportunityTenantEnvelope,
} from './opportunityTenantCore';

export const OPPORTUNITY_SCORE_SCHEMA_VERSION = 'opportunity-score-v1' as const;
export const OPPORTUNITY_SCORE_MODEL_VERSION = 'opportunity-score-v1-proposed' as const;

export const OPPORTUNITY_SCORE_DIMENSION_KEYS = [
  'strategicFit',
  'timeliness',
  'actionability',
  'expectedUpside',
  'effortCost',
  'risk',
] as const;

export type OpportunityScoreDimensionKey =
  (typeof OPPORTUNITY_SCORE_DIMENSION_KEYS)[number];

/** Approved weights from opportunity-scoring.md (T-007-010). */
export const OPPORTUNITY_SCORE_WEIGHTS: Record<OpportunityScoreDimensionKey, number> = {
  strategicFit: 0.25,
  timeliness: 0.2,
  actionability: 0.2,
  expectedUpside: 0.15,
  effortCost: 0.1,
  risk: 0.1,
};

export type OpportunityScoreBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface OpportunityScoreDimensionInput {
  key: OpportunityScoreDimensionKey;
  /** Normalized 0..1 inclusive. Higher is better for all keys including effortCost/risk (already inverted by caller). */
  rawInput: number;
  reasonCode: string;
}

export interface OpportunityScoreDimension {
  key: OpportunityScoreDimensionKey;
  rawInput: number;
  weight: number;
  contribution: number;
  reasonCode: string;
}

export interface OpportunityScore {
  id: string;
  organizationId: string;
  clientId: string;
  candidateId: string;
  scoringModelVersion: typeof OPPORTUNITY_SCORE_MODEL_VERSION;
  totalScore: number;
  band: OpportunityScoreBand;
  dimensions: OpportunityScoreDimension[];
  evidenceRefs: string[];
  riskFlags: string[];
  computedAt: string;
  schemaVersion: typeof OPPORTUNITY_SCORE_SCHEMA_VERSION;
}

export interface ComputeOpportunityScoreInput extends OpportunityTenantEnvelope {
  id: string;
  candidateId: string;
  scoringModelVersion: string;
  dimensions: OpportunityScoreDimensionInput[];
  evidenceRefs: string[];
  riskFlags: string[];
  computedAt: string;
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function opportunityScoreBand(totalScore: number): OpportunityScoreBand {
  if (totalScore < 40) return 'LOW';
  if (totalScore < 70) return 'MEDIUM';
  if (totalScore < 85) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Deterministic Opportunity Score. Same inputs + model version → same result.
 * Does NOT authorize materialization or thesis selection.
 */
export function computeOpportunityScore(
  input: ComputeOpportunityScoreInput
): OpportunityDomainResult<OpportunityScore> {
  const tenant = assertOpportunityTenantStructure(input);
  if (!tenant.ok) return tenant;

  const id = nonEmpty(input.id);
  const candidateId = nonEmpty(input.candidateId);
  const computedAt = nonEmpty(input.computedAt);
  if (!id || !candidateId || !computedAt) {
    return oppFail('SCORE_INPUT_INVALID', 'id, candidateId, and computedAt are required');
  }

  if (input.scoringModelVersion !== OPPORTUNITY_SCORE_MODEL_VERSION) {
    return oppFail(
      'UNKNOWN_SCORE_MODEL',
      `unknown scoringModelVersion=${String(input.scoringModelVersion)}`
    );
  }

  if (!Array.isArray(input.dimensions) || input.dimensions.length === 0) {
    return oppFail('SCORE_INPUT_INVALID', 'dimensions are required');
  }

  const seen = new Set<string>();
  const byKey = new Map<OpportunityScoreDimensionKey, OpportunityScoreDimensionInput>();

  for (const dim of input.dimensions) {
    if (!dim || typeof dim !== 'object') {
      return oppFail('SCORE_INPUT_INVALID', 'dimension entry malformed');
    }
    if (!(OPPORTUNITY_SCORE_DIMENSION_KEYS as readonly string[]).includes(dim.key)) {
      return oppFail('SCORE_INPUT_INVALID', `unknown dimension key=${String(dim.key)}`);
    }
    if (seen.has(dim.key)) {
      return oppFail('SCORE_INPUT_INVALID', `duplicate dimension key=${dim.key}`);
    }
    seen.add(dim.key);
    if (!isFiniteNumber(dim.rawInput)) {
      return oppFail('SCORE_INPUT_INVALID', `dimension ${dim.key} rawInput must be finite`);
    }
    if (dim.rawInput < 0 || dim.rawInput > 1) {
      return oppFail(
        'SCORE_INPUT_INVALID',
        `dimension ${dim.key} rawInput out of range 0..1`
      );
    }
    const reasonCode = nonEmpty(dim.reasonCode);
    if (!reasonCode) {
      return oppFail('SCORE_INPUT_INVALID', `dimension ${dim.key} reasonCode required`);
    }
    byKey.set(dim.key, { ...dim, reasonCode });
  }

  for (const key of OPPORTUNITY_SCORE_DIMENSION_KEYS) {
    if (!byKey.has(key)) {
      return oppFail('SCORE_INPUT_INVALID', `missing required dimension=${key}`);
    }
  }

  if (!Array.isArray(input.evidenceRefs) || !Array.isArray(input.riskFlags)) {
    return oppFail('SCORE_INPUT_INVALID', 'evidenceRefs and riskFlags must be arrays');
  }
  for (const ref of input.evidenceRefs) {
    if (!nonEmpty(ref)) {
      return oppFail('SCORE_INPUT_INVALID', 'evidenceRefs must be non-empty strings');
    }
  }
  for (const flag of input.riskFlags) {
    if (!nonEmpty(flag)) {
      return oppFail('SCORE_INPUT_INVALID', 'riskFlags must be non-empty strings');
    }
  }

  const dimensions: OpportunityScoreDimension[] = OPPORTUNITY_SCORE_DIMENSION_KEYS.map(
    (key) => {
      const dim = byKey.get(key)!;
      const weight = OPPORTUNITY_SCORE_WEIGHTS[key];
      const contribution = clamp01(dim.rawInput) * weight;
      return {
        key,
        rawInput: dim.rawInput,
        weight,
        contribution,
        reasonCode: dim.reasonCode,
      };
    }
  );

  const sum = dimensions.reduce((acc, d) => acc + d.contribution, 0);
  const totalScore = Math.round(100 * sum);
  const band = opportunityScoreBand(totalScore);

  return oppOk({
    id,
    organizationId: tenant.value.organizationId,
    clientId: tenant.value.clientId,
    candidateId,
    scoringModelVersion: OPPORTUNITY_SCORE_MODEL_VERSION,
    totalScore,
    band,
    dimensions,
    evidenceRefs: [...input.evidenceRefs],
    riskFlags: [...input.riskFlags],
    computedAt,
    schemaVersion: OPPORTUNITY_SCORE_SCHEMA_VERSION,
  });
}

/** Max possible total under approved weights (all rawInput = 1). */
export const OPPORTUNITY_SCORE_MAX_TOTAL = Math.round(
  100 *
    OPPORTUNITY_SCORE_DIMENSION_KEYS.reduce(
      (acc, key) => acc + OPPORTUNITY_SCORE_WEIGHTS[key],
      0
    )
);
