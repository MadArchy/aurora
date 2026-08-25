import { describe, expect, it } from 'vitest';
import {
  canTransitionClaimStatus,
  createClaim,
  markClaimLinked,
  markEvidenceRequired,
  markHardBlocked,
  markResearchRequired,
  transitionClaimStatus,
  type Claim,
} from '../src/domain/claimCore';
import { evaluateClaimPublicationEligibility } from '../src/domain/claimGateCore';
import {
  assertEvidenceReusableForClaim,
  createClaimEvidenceLink,
} from '../src/domain/claimLinkCore';
import {
  buildClaimExplainabilityProjection,
  claimMaterialFingerprint,
  isMaterialClaimChange,
} from '../src/domain/claimMaterialityCore';
import { createClaimOverride } from '../src/domain/claimOverrideCore';
import { createClaimSource } from '../src/domain/claimSourceCore';
import { assertTenantsMatch } from '../src/domain/claimTenantCore';
import {
  claimStatusAfterVerificationResult,
  createClaimVerification,
} from '../src/domain/claimVerificationCore';
import { createClaimEvidence } from '../src/domain/evidenceCore';

const NOW = '2026-08-24T12:00:00.000Z';
const LATER = '2026-08-24T13:00:00.000Z';

function baseClaimInput(overrides: Partial<Parameters<typeof createClaim>[0]> = {}) {
  return {
    id: 'claim_1',
    organizationId: 'org_a',
    clientId: 'client_a',
    contentId: 'content_1',
    contentHash: 'hash_abc',
    text: 'Managing Partner at Acme Legal',
    kind: 'CREDENTIAL' as const,
    createdAt: NOW,
    createdBy: 'system:extractor',
    ...overrides,
  };
}

function makeClaim(overrides: Partial<Parameters<typeof createClaim>[0]> = {}): Claim {
  const result = createClaim(baseClaimInput(overrides));
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function makeEvidence(overrides: Partial<Parameters<typeof createClaimEvidence>[0]> = {}) {
  const source = createClaimSource({
    sourceType: 'PRIMARY',
    sourceUrl: 'https://example.com/bio',
    publisher: 'Acme',
  });
  if (!source.ok) throw new Error(source.error.message);
  const result = createClaimEvidence({
    id: 'ev_1',
    organizationId: 'org_a',
    clientId: 'client_a',
    title: 'Bio page',
    type: 'DOCUMENT',
    snippet: 'Managing Partner at Acme Legal',
    source: source.value,
    confidenceScore: 90,
    associatedThesesIds: ['thesis_1'],
    createdAt: NOW,
    ...overrides,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('SPEC-006 Phase 1 — Claim domain (T-006-101 / T-006-106)', () => {
  it('creates Claim with required canonical fields and DETECTED status', () => {
    const claim = makeClaim({ strategicBriefId: 'brief_1', strategicBriefVersion: 2 });
    expect(claim.status).toBe('DETECTED');
    expect(claim.schemaVersion).toBe('claim-v1');
    expect(claim.version).toBe(1);
    expect(claim.strategicBriefId).toBe('brief_1');
    expect(claim.organizationId).toBe('org_a');
  });

  it('rejects Claim missing tenant or contentHash', () => {
    expect(createClaim(baseClaimInput({ organizationId: '' })).ok).toBe(false);
    expect(createClaim(baseClaimInput({ contentHash: '  ' })).ok).toBe(false);
  });

  it('allows EVIDENCE_REQUIRED and RESEARCH_REQUIRED as distinct transitions', () => {
    const claim = makeClaim();
    const evidenceRequired = markEvidenceRequired(claim, LATER);
    expect(evidenceRequired.ok).toBe(true);
    if (!evidenceRequired.ok) return;
    expect(evidenceRequired.value.status).toBe('EVIDENCE_REQUIRED');

    const research = markResearchRequired(evidenceRequired.value, LATER);
    expect(research.ok).toBe(true);
    if (!research.ok) return;
    expect(research.value.status).toBe('RESEARCH_REQUIRED');
  });

  it('marks LINKED after evidence path and rejects invalid transitions', () => {
    const claim = makeClaim();
    const needed = markEvidenceRequired(claim, LATER);
    expect(needed.ok).toBe(true);
    if (!needed.ok) return;
    const linked = markClaimLinked(needed.value, LATER);
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.value.status).toBe('LINKED');

    const invalid = transitionClaimStatus(claim, 'VERIFIED', LATER);
    expect(invalid.ok).toBe(false);
    if (invalid.ok) return;
    expect(invalid.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('HARD_BLOCKED has no outbound transitions', () => {
    expect(canTransitionClaimStatus('HARD_BLOCKED', 'OVERRIDDEN')).toBe(false);
    expect(canTransitionClaimStatus('HARD_BLOCKED', 'VERIFIED')).toBe(false);
    const blocked = markHardBlocked(makeClaim(), LATER);
    expect(blocked.ok).toBe(true);
    if (!blocked.ok) return;
    const escape = transitionClaimStatus(blocked.value, 'OVERRIDDEN', LATER);
    expect(escape.ok).toBe(false);
  });
});

describe('SPEC-006 Phase 1 — Evidence + Source (T-006-102 / T-006-103)', () => {
  it('creates Evidence with embedded Source provenance', () => {
    const evidence = makeEvidence();
    expect(evidence.source.sourceType).toBe('PRIMARY');
    expect(evidence.schemaVersion).toBe('evidence-v1');
  });

  it('requires unknownReason for UNKNOWN sourceType', () => {
    const bad = createClaimSource({ sourceType: 'UNKNOWN' });
    expect(bad.ok).toBe(false);
    const ok = createClaimSource({
      sourceType: 'UNKNOWN',
      unknownReason: 'legacy vault row without URL',
    });
    expect(ok.ok).toBe(true);
  });

  it('rejects Evidence without tenant or invalid confidence', () => {
    expect(
      createClaimEvidence({
        id: 'ev_x',
        organizationId: '',
        clientId: 'client_a',
        title: 't',
        type: 'DOCUMENT',
        snippet: 's',
        source: { sourceType: 'INTERNAL', publisher: 'vault' },
        confidenceScore: 50,
        createdAt: NOW,
      }).ok
    ).toBe(false);
    expect(
      createClaimEvidence({
        id: 'ev_x',
        organizationId: 'org_a',
        clientId: 'client_a',
        title: 't',
        type: 'DOCUMENT',
        snippet: 's',
        source: { sourceType: 'INTERNAL', publisher: 'vault' },
        confidenceScore: 150,
        createdAt: NOW,
      }).ok
    ).toBe(false);
  });
});

describe('SPEC-006 Phase 1 — ClaimEvidenceLink + reuse (T-006-105 / T-006-107)', () => {
  it('creates same-tenant link and allows evidence reuse across claims', () => {
    const claim1 = makeClaim({ id: 'claim_1' });
    const claim2 = makeClaim({ id: 'claim_2', text: 'Award: Chambers Band 1' });
    const evidence = makeEvidence();

    const link1 = createClaimEvidenceLink({
      id: 'link_1',
      claim: claim1,
      evidence,
      createdAt: NOW,
      createdBy: 'manager_1',
    });
    expect(link1.ok).toBe(true);

    const reuse = assertEvidenceReusableForClaim(evidence, claim2);
    expect(reuse.ok).toBe(true);

    const link2 = createClaimEvidenceLink({
      id: 'link_2',
      claim: claim2,
      evidence,
      createdAt: NOW,
      createdBy: 'manager_1',
    });
    expect(link2.ok).toBe(true);
  });

  it('denies cross-tenant evidence link and reuse', () => {
    const claim = makeClaim();
    const foreign = makeEvidence({
      id: 'ev_foreign',
      organizationId: 'org_b',
      clientId: 'client_b',
    });

    const link = createClaimEvidenceLink({
      id: 'link_x',
      claim,
      evidence: foreign,
      createdAt: NOW,
      createdBy: 'manager_1',
    });
    expect(link.ok).toBe(false);
    if (link.ok) return;
    expect(link.error.code).toBe('EVIDENCE_TENANT_MISMATCH');

    const reuse = assertEvidenceReusableForClaim(foreign, claim);
    expect(reuse.ok).toBe(false);
  });

  it('assertTenantsMatch fails closed on mismatch', () => {
    const result = assertTenantsMatch(
      { organizationId: 'org_a', clientId: 'client_a' },
      { organizationId: 'org_a', clientId: 'client_b' }
    );
    expect(result.ok).toBe(false);
  });
});

describe('SPEC-006 Phase 1 — Verification authority (T-006-104)', () => {
  it('allows SOFTWARE and HUMAN verification', () => {
    const claim = makeClaim();
    const needed = markEvidenceRequired(claim, LATER);
    expect(needed.ok).toBe(true);
    if (!needed.ok) return;
    const linked = markClaimLinked(needed.value, LATER);
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    const base = linked.value;

    for (const actorType of ['SOFTWARE', 'HUMAN'] as const) {
      const verification = createClaimVerification({
        id: `ver_${actorType}`,
        claimId: base.id,
        organizationId: base.organizationId,
        clientId: base.clientId,
        claimTenant: base,
        result: 'PASS',
        claimStatusAfter: claimStatusAfterVerificationResult('PASS'),
        actorType,
        actorId: actorType === 'SOFTWARE' ? 'rule:claim-v1' : 'manager_1',
        ruleId: 'CLAIM-006-VERIFY',
        ruleVersion: '1',
        evidenceIds: ['ev_1'],
        summary: 'Supported by vault evidence',
        createdAt: LATER,
        contentHash: base.contentHash,
        claimContentHash: base.contentHash,
      });
      expect(verification.ok).toBe(true);
    }
  });

  it('rejects AI authoritative verification', () => {
    const claim = makeClaim();
    const verification = createClaimVerification({
      id: 'ver_ai',
      claimId: claim.id,
      organizationId: claim.organizationId,
      clientId: claim.clientId,
      claimTenant: claim,
      result: 'PASS',
      claimStatusAfter: 'VERIFIED',
      actorType: 'AI',
      actorId: 'model:gpt',
      ruleId: 'CLAIM-006-VERIFY',
      ruleVersion: '1',
      evidenceIds: [],
      summary: 'AI says ok',
      createdAt: LATER,
      contentHash: claim.contentHash,
      claimContentHash: claim.contentHash,
    });
    expect(verification.ok).toBe(false);
    if (verification.ok) return;
    expect(verification.error.code).toBe('AI_VERIFICATION_FORBIDDEN');
  });

  it('rejects verification with foreign tenant or stale contentHash', () => {
    const claim = makeClaim();
    const foreignTenant = createClaimVerification({
      id: 'ver_x',
      claimId: claim.id,
      organizationId: 'org_b',
      clientId: 'client_b',
      claimTenant: claim,
      result: 'PASS',
      claimStatusAfter: 'VERIFIED',
      actorType: 'SOFTWARE',
      actorId: 'rule:1',
      ruleId: 'R',
      ruleVersion: '1',
      evidenceIds: [],
      summary: 'x',
      createdAt: LATER,
      contentHash: claim.contentHash,
      claimContentHash: claim.contentHash,
    });
    expect(foreignTenant.ok).toBe(false);

    const stale = createClaimVerification({
      id: 'ver_y',
      claimId: claim.id,
      organizationId: claim.organizationId,
      clientId: claim.clientId,
      claimTenant: claim,
      result: 'PASS',
      claimStatusAfter: 'VERIFIED',
      actorType: 'SOFTWARE',
      actorId: 'rule:1',
      ruleId: 'R',
      ruleVersion: '1',
      evidenceIds: [],
      summary: 'x',
      createdAt: LATER,
      contentHash: 'stale',
      claimContentHash: claim.contentHash,
    });
    expect(stale.ok).toBe(false);
  });
});

describe('SPEC-006 Phase 1 — Override (T-006-109)', () => {
  it('allows HUMAN override from UNSUPPORTED with audit metadata', () => {
    const claim = makeClaim();
    const needed = markEvidenceRequired(claim, LATER);
    expect(needed.ok).toBe(true);
    if (!needed.ok) return;
    const linked = markClaimLinked(needed.value, LATER);
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    const unsupported = transitionClaimStatus(linked.value, 'UNSUPPORTED', LATER);
    expect(unsupported.ok).toBe(true);
    if (!unsupported.ok) return;

    const overridden = createClaimOverride({
      claim: unsupported.value,
      actorId: 'manager_1',
      reason: 'Client confirmed credential offline',
      createdAt: LATER,
      contentVersion: 'content_v3',
    });
    expect(overridden.ok).toBe(true);
    if (!overridden.ok) return;
    expect(overridden.value.claim.status).toBe('OVERRIDDEN');
    expect(overridden.value.override.previousStatus).toBe('UNSUPPORTED');
    expect(overridden.value.override.reason).toContain('confirmed');
  });

  it('denies override of HARD_BLOCKED and GUARANTEE', () => {
    const hard = markHardBlocked(makeClaim({ kind: 'HARD_BLOCK' }), LATER);
    expect(hard.ok).toBe(true);
    if (!hard.ok) return;
    expect(
      createClaimOverride({
        claim: hard.value,
        actorId: 'admin_1',
        reason: 'please',
        createdAt: LATER,
      }).ok
    ).toBe(false);

    const guarantee = makeClaim({ kind: 'GUARANTEE', status: 'HARD_BLOCKED' });
    const fromUnsupportedPath = createClaimOverride({
      claim: { ...guarantee, status: 'UNSUPPORTED' },
      actorId: 'admin_1',
      reason: 'please',
      createdAt: LATER,
    });
    expect(fromUnsupportedPath.ok).toBe(false);
    if (fromUnsupportedPath.ok) return;
    expect(fromUnsupportedPath.error.code).toBe('HARD_BLOCK_NON_OVERRIDABLE');
  });
});

describe('SPEC-006 Phase 1 — Publication gate (T-006-108)', () => {
  it('allows non-gated targets even with EVIDENCE_REQUIRED', () => {
    const claim = markEvidenceRequired(makeClaim(), LATER);
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    const decision = evaluateClaimPublicationEligibility({
      claims: [claim.value],
      targetContentStatus: 'DRAFT',
    });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.value.result).toBe('PASS');
    expect(decision.value.reasonCode).toBe('TARGET_NOT_GATED');
  });

  it('blocks CLIENT_REVIEW on EVIDENCE_REQUIRED / HARD_BLOCKED / UNSUPPORTED', () => {
    const evidenceRequired = markEvidenceRequired(makeClaim({ id: 'c1' }), LATER);
    expect(evidenceRequired.ok).toBe(true);
    if (!evidenceRequired.ok) return;
    const blocked = evaluateClaimPublicationEligibility({
      claims: [evidenceRequired.value],
      targetContentStatus: 'CLIENT_REVIEW',
    });
    expect(blocked.ok && blocked.value.result).toBe('BLOCK');
    expect(blocked.ok && blocked.value.reasonCode).toBe('EVIDENCE_REQUIRED');

    const hard = markHardBlocked(makeClaim({ id: 'c2' }), LATER);
    expect(hard.ok).toBe(true);
    if (!hard.ok) return;
    const hardGate = evaluateClaimPublicationEligibility({
      claims: [hard.value],
      targetContentStatus: 'PUBLISHED',
    });
    expect(hardGate.ok && hardGate.value.reasonCode).toBe('HARD_BLOCKED');
  });

  it('PASSes gated target only when all claims VERIFIED or OVERRIDDEN', () => {
    const verified = makeClaim({ id: 'c_ok' });
    const asVerified = {
      ...verified,
      status: 'VERIFIED' as const,
      version: 2,
      updatedAt: LATER,
    };
    const decision = evaluateClaimPublicationEligibility({
      claims: [asVerified],
      targetContentStatus: 'READY',
    });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.value.result).toBe('PASS');
    expect(decision.value.allowed).toBe(true);
  });

  it('multi-claim aggregation fails closed on one unsafe claim', () => {
    const ok = {
      ...makeClaim({ id: 'ok' }),
      status: 'VERIFIED' as const,
    };
    const bad = markEvidenceRequired(makeClaim({ id: 'bad' }), LATER);
    expect(bad.ok).toBe(true);
    if (!bad.ok) return;
    const decision = evaluateClaimPublicationEligibility({
      claims: [ok, bad.value],
      targetContentStatus: 'CLIENT_REVIEW',
    });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.value.allowed).toBe(false);
    expect(decision.value.blockingClaimIds).toContain('bad');
    expect(decision.value.blockingClaimIds).not.toContain('ok');
  });
});

describe('SPEC-006 Phase 1 — Materiality + explainability', () => {
  it('distinguishes material claim changes without using timestamps alone', () => {
    const a = makeClaim();
    const b = markEvidenceRequired(a, LATER);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(isMaterialClaimChange(a, b.value)).toBe(true);
    expect(claimMaterialFingerprint(a)).not.toBe(claimMaterialFingerprint(b.value));
  });

  it('builds structured explainability projection without chain-of-thought', () => {
    const claim = makeClaim();
    const projection = buildClaimExplainabilityProjection({
      claim,
      evidenceIds: ['ev_1'],
      gateResult: 'BLOCK',
      gateReasonCode: 'EVIDENCE_REQUIRED',
    });
    expect(projection.claimId).toBe(claim.id);
    expect(projection.evidenceIds).toEqual(['ev_1']);
    expect(projection.gateReasonCode).toBe('EVIDENCE_REQUIRED');
    expect(projection).not.toHaveProperty('chainOfThought');
  });
});
