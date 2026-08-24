import type { StrategicBrief, StrategicDecisionSnapshot } from './strategicBriefCore';

function uniqueSorted(ids: readonly string[]): string[] {
  return [...new Set(ids)].slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function idSetsEqual(a: readonly string[], b: readonly string[]): boolean {
  const left = uniqueSorted(a);
  const right = uniqueSorted(b);
  if (left.length !== right.length) return false;
  return left.every((id, i) => id === right[i]);
}

function whyNowKey(whyNow: StrategicBrief['whyNow']): string {
  if (typeof whyNow === 'string') return whyNow;
  return JSON.stringify({ reason: whyNow.reason, score: whyNow.score ?? null });
}

function decisionMaterial(decision: StrategicDecisionSnapshot): Record<string, unknown> {
  return {
    decisionRationale: decision.decisionRationale,
    authorizedAction: decision.authorizedAction,
    dispositionDecision: decision.dispositionDecision,
    formatDecision: decision.formatDecision,
    dispositionOverrideReason: decision.dispositionOverrideReason ?? null,
    formatOverrideReason: decision.formatOverrideReason ?? null,
    upstreamRoutingRef: {
      routingState: decision.upstreamRoutingRef.routingState,
      algorithmVersion: decision.upstreamRoutingRef.algorithmVersion ?? null,
      source: decision.upstreamRoutingRef.source ?? null,
    },
    upstreamScoreRef: {
      scoringVersion: decision.upstreamScoreRef.scoringVersion,
      totalScore: decision.upstreamScoreRef.totalScore ?? null,
      priorityBand: decision.upstreamScoreRef.priorityBand ?? null,
      recommendedDisposition: decision.upstreamScoreRef.recommendedDisposition ?? null,
      recommendedOutputFormat: decision.upstreamScoreRef.recommendedOutputFormat ?? null,
    },
    signalContextRefs: decision.signalContextRefs
      .map((row) => ({
        signalId: row.signalId,
        scoreSnapshotId: row.scoreSnapshotId ?? null,
        routingSnapshotId: row.routingSnapshotId ?? null,
      }))
      .sort((a, b) => (a.signalId < b.signalId ? -1 : a.signalId > b.signalId ? 1 : 0)),
  };
}

export interface BriefMaterialSnapshot {
  organizationId: string;
  clientId: string;
  thesisId: string;
  signalIds: string[];
  primaryAudience: string;
  geography: string;
  territory: string;
  framework: string;
  whyNow: string;
  strategicAngle: string;
  supportingEvidenceIds: string[];
  riskFlags: string[];
  recommendedChannel: string;
  recommendedFormat: string;
  CTA: string;
  status: StrategicBrief['status'];
  approvedBy: string | null;
  version: number;
  decision: Record<string, unknown>;
}

/**
 * Material fields (brief-model.md). Timestamps, schemaVersion, createdBy,
 * aiAdvisoryRefs, and supersede pointers are non-material on their own.
 * signalIds / supportingEvidenceIds / riskFlags are sets — order is not material.
 */
export function toBriefMaterialSnapshot(brief: StrategicBrief): BriefMaterialSnapshot {
  return {
    organizationId: brief.organizationId,
    clientId: brief.clientId,
    thesisId: brief.thesisId,
    signalIds: uniqueSorted(brief.signalIds),
    primaryAudience: brief.primaryAudience,
    geography: brief.geography,
    territory: brief.territory,
    framework: brief.framework,
    whyNow: whyNowKey(brief.whyNow),
    strategicAngle: brief.strategicAngle,
    supportingEvidenceIds: uniqueSorted(brief.supportingEvidenceIds),
    riskFlags: uniqueSorted(brief.riskFlags),
    recommendedChannel: brief.recommendedChannel,
    recommendedFormat: brief.recommendedFormat,
    CTA: brief.CTA,
    status: brief.status,
    approvedBy: brief.approvedBy,
    version: brief.version,
    decision: decisionMaterial(brief.decision),
  };
}

export const MATERIAL_BRIEF_FIELD_KEYS: readonly (keyof BriefMaterialSnapshot)[] = [
  'organizationId',
  'clientId',
  'thesisId',
  'signalIds',
  'primaryAudience',
  'geography',
  'territory',
  'framework',
  'whyNow',
  'strategicAngle',
  'supportingEvidenceIds',
  'riskFlags',
  'recommendedChannel',
  'recommendedFormat',
  'CTA',
  'status',
  'approvedBy',
  'version',
  'decision',
] as const;

export function listMaterialBriefFieldChanges(
  previous: StrategicBrief,
  next: StrategicBrief
): string[] {
  const a = toBriefMaterialSnapshot(previous);
  const b = toBriefMaterialSnapshot(next);
  const changed: string[] = [];
  for (const key of MATERIAL_BRIEF_FIELD_KEYS) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      changed.push(key);
    }
  }
  return changed;
}

export function isMaterialBriefChange(previous: StrategicBrief, next: StrategicBrief): boolean {
  return listMaterialBriefFieldChanges(previous, next).length > 0;
}

const REVISION_MECHANICAL_FIELDS = new Set(['status', 'version', 'approvedBy']);

/** Content/decision materiality excluding mechanical revision fields (status/version/approver). */
export function isMaterialStrategicContentChange(
  previous: StrategicBrief,
  next: StrategicBrief
): boolean {
  return listMaterialBriefFieldChanges(previous, next).some(
    (key) => !REVISION_MECHANICAL_FIELDS.has(key)
  );
}

/** Canonical material identity string — not a cryptographic hash. */
export function briefMaterialFingerprint(brief: StrategicBrief): string {
  return JSON.stringify(toBriefMaterialSnapshot(brief));
}

export function isSameMaterialIdentity(left: StrategicBrief, right: StrategicBrief): boolean {
  return briefMaterialFingerprint(left) === briefMaterialFingerprint(right);
}

export function idSetsAreEqual(a: readonly string[], b: readonly string[]): boolean {
  return idSetsEqual(a, b);
}
