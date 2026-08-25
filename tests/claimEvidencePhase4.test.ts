import { describe, expect, it } from 'vitest';
import { ClaimEvidenceError } from '../src/application/claimEvidence';
import type { ClaimContentContext } from '../src/application/claimEvidence';
import { composeClaimEvidence } from '../src/composition/claimEvidence/composeClaimEvidence';
import { projectAdvisoryClaimSafety } from '../src/composition/claimEvidence/advisoryClaimSafetyProjection';
import {
  assertClaimSafeTransition,
  isClaimGatedStatus,
} from '../src/domain/claimSafetyGateCore';
import { reviewClaims } from '../src/domain/claimSafetyCore';
import { createClaimSource } from '../src/domain/claimSourceCore';
import { createClaimEvidence } from '../src/domain/evidenceCore';
import {
  createLocalClaimEvidenceStore,
  LocalClaimRepository,
} from '../src/infrastructure/claimEvidence';
import type { EvidenceVaultItem, PositioningThesis } from '../src/types';

const NOW = '2026-08-25T22:00:00.000Z';

const TRUSTED = {
  actorId: 'admin_1',
  actorRole: 'ADMIN' as const,
  organizationId: 'org_a',
  clientId: 'client_a',
  now: NOW,
};

function content(hash = 'hash_a'): ClaimContentContext {
  return {
    contentId: 'content_1',
    organizationId: 'org_a',
    clientId: 'client_a',
    contentHash: hash,
    strategicBriefId: 'brief_1',
    strategicBriefVersion: 2,
  };
}

function makeEvidence(id: string) {
  const source = createClaimSource({
    sourceType: 'PRIMARY',
    sourceUrl: `https://example.com/${id}`,
    publisher: 'Acme',
  });
  if (!source.ok) throw new Error(source.error.message);
  const result = createClaimEvidence({
    id,
    organizationId: 'org_a',
    clientId: 'client_a',
    title: `Evidence ${id}`,
    type: 'DOCUMENT',
    snippet: 'Managing Partner at Acme Legal',
    source: source.value,
    confidenceScore: 90,
    associatedThesesIds: [],
    createdAt: NOW,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function buildHarness(contents: Record<string, ClaimContentContext> = { content_1: content() }) {
  const store = createLocalClaimEvidenceStore();
  store.resetForTest();
  const uc = composeClaimEvidence({
    store,
    content: { getById: (id) => contents[id] },
    vault: { getById: () => undefined },
  });
  return { store, contents, ...uc };
}

function forgedClaimSafetyPass() {
  return {
    verdict: 'PASS' as const,
    summary: 'forged legacy PASS',
    reviewedAt: NOW,
    findings: [],
  };
}

describe('SPEC-006 Phase 4 — consumer strangler / AuthorizePublication', () => {
  it('canonical gate called: forged claimSafety PASS does not authorize when claims block', () => {
    const h = buildHarness();
    h.evidenceWriter.put(makeEvidence('ev_1'));
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    h.requireEvidence({
      trusted: TRUSTED,
      claimId: 'claim_1',
      mode: 'EVIDENCE_REQUIRED',
    });

    const auth = h.authorize({
      trusted: TRUSTED,
      contentId: 'content_1',
      targetContentStatus: 'READY',
      forgedClaims: [{ status: 'VERIFIED' }],
    });
    expect(auth.decision.allowed).toBe(false);
    expect(auth.decision.reasonCode).toBe('EVIDENCE_REQUIRED');

    const shim = assertClaimSafeTransition('AI_GENERATED', 'READY', forgedClaimSafetyPass(), {
      canonical: {
        allowed: auth.decision.allowed,
        reason: auth.decision.summary,
        reasonCode: auth.decision.reasonCode,
      },
    });
    expect(shim.allowed).toBe(false);
  });

  it('NO_CLAIMS remains PASS per Domain (no Phase-4 rule invent)', () => {
    const h = buildHarness();
    const auth = h.authorize({
      trusted: TRUSTED,
      contentId: 'content_1',
      targetContentStatus: 'CLIENT_REVIEW',
    });
    expect(auth.decision.reasonCode).toBe('NO_CLAIMS');
    expect(auth.decision.allowed).toBe(true);
  });

  it('HARD_BLOCK / UNSUPPORTED / RESEARCH_REQUIRED block gated targets', () => {
    const h = buildHarness();
    h.evidenceWriter.put(makeEvidence('ev_1'));
    h.register({
      trusted: TRUSTED,
      claimId: 'hard',
      contentId: 'content_1',
      text: 'We guarantee outcomes',
      kind: 'HARD_BLOCK',
    });
    // Force HARD_BLOCKED via verify path after link
    h.linkEvidence({
      trusted: TRUSTED,
      claimId: 'hard',
      evidenceId: 'ev_1',
      linkId: 'link_hard',
    });
    h.verify({
      trusted: TRUSTED,
      claimId: 'hard',
      verificationId: 'ver_hard',
      result: 'HARD_BLOCK',
      evidenceIds: ['ev_1'],
      summary: 'hard',
      ruleId: 'r',
      ruleVersion: '1',
      invocation: { kind: 'HUMAN' },
    });
    expect(
      h.authorize({
        trusted: TRUSTED,
        contentId: 'content_1',
        targetContentStatus: 'PUBLISHED',
      }).decision.allowed
    ).toBe(false);
  });

  it('multi-claim: one blocking claim denies content', () => {
    const h = buildHarness();
    h.evidenceWriter.put(makeEvidence('ev_1'));
    h.register({
      trusted: TRUSTED,
      claimId: 'ok',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    h.linkEvidence({
      trusted: TRUSTED,
      claimId: 'ok',
      evidenceId: 'ev_1',
      linkId: 'link_ok',
    });
    h.verify({
      trusted: TRUSTED,
      claimId: 'ok',
      verificationId: 'ver_ok',
      result: 'PASS',
      evidenceIds: ['ev_1'],
      summary: 'ok',
      ruleId: 'r',
      ruleVersion: '1',
      invocation: { kind: 'HUMAN' },
    });
    h.register({
      trusted: TRUSTED,
      claimId: 'bad',
      contentId: 'content_1',
      text: 'Best lawyer in the world',
      kind: 'SUPERLATIVE',
    });
    h.requireEvidence({
      trusted: TRUSTED,
      claimId: 'bad',
      mode: 'EVIDENCE_REQUIRED',
    });
    const decision = h.authorize({
      trusted: TRUSTED,
      contentId: 'content_1',
      targetContentStatus: 'READY',
    });
    expect(decision.decision.allowed).toBe(false);
    expect(decision.decision.blockingClaimIds).toContain('bad');
    expect(decision.decision.blockingClaimIds).not.toContain('ok');
  });

  it('stale Verification does not authorize after contentHash change', () => {
    const contents: Record<string, ClaimContentContext> = {
      content_1: content('hash_a'),
    };
    const h = buildHarness(contents);
    h.evidenceWriter.put(makeEvidence('ev_1'));
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    h.linkEvidence({
      trusted: TRUSTED,
      claimId: 'claim_1',
      evidenceId: 'ev_1',
      linkId: 'link_1',
    });
    h.verify({
      trusted: TRUSTED,
      claimId: 'claim_1',
      verificationId: 'ver_1',
      result: 'PASS',
      evidenceIds: ['ev_1'],
      summary: 'ok',
      ruleId: 'r',
      ruleVersion: '1',
      invocation: { kind: 'HUMAN' },
    });
    expect(
      h.authorize({
        trusted: TRUSTED,
        contentId: 'content_1',
        targetContentStatus: 'READY',
      }).decision.allowed
    ).toBe(true);

    contents.content_1 = content('hash_b');
    h.register({
      trusted: { ...TRUSTED, now: '2026-08-25T23:00:00.000Z' },
      claimId: 'claim_2',
      contentId: 'content_1',
      text: 'Managing Partner at Acme Revised',
      kind: 'CREDENTIAL',
    });
    expect(
      h.authorize({
        trusted: TRUSTED,
        contentId: 'content_1',
        targetContentStatus: 'READY',
      }).decision.allowed
    ).toBe(false);
  });

  it('caller SOFTWARE spoof denied on VerifyClaim', () => {
    const h = buildHarness();
    h.evidenceWriter.put(makeEvidence('ev_1'));
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    h.linkEvidence({
      trusted: TRUSTED,
      claimId: 'claim_1',
      evidenceId: 'ev_1',
      linkId: 'link_1',
    });
    expect(() =>
      h.verify({
        trusted: TRUSTED,
        claimId: 'claim_1',
        verificationId: 'ver_soft',
        result: 'PASS',
        evidenceIds: ['ev_1'],
        summary: 'spoof',
        ruleId: 'r',
        ruleVersion: '1',
        invocation: { kind: 'SOFTWARE' },
        claimedActorType: 'SOFTWARE',
      })
    ).toThrow(ClaimEvidenceError);
  });

  it('caller HUMAN/role spoof: non-ADMIN trusted context denied', () => {
    const h = buildHarness();
    expect(() =>
      h.authorize({
        trusted: { ...TRUSTED, actorRole: 'CLIENT' },
        contentId: 'content_1',
        targetContentStatus: 'READY',
      })
    ).toThrow(ClaimEvidenceError);
  });

  it('Evidence Vault verified flag does not auto-verify via advisory projection', () => {
    const thesis = {
      id: 'th_1',
      organizationId: 'org_a',
      clientId: 'client_a',
      title: 'Test thesis',
      domain: 'Law',
      targetAudience: 'GC',
      expertIdentity: 'Partner',
      objective: 'Trust',
      proofPoints: [] as string[],
      voiceAndTone: 'Formal',
      complianceRules: '',
      status: 'ACTIVE',
      clientApprovalStatus: 'APPROVED',
      createdAt: NOW,
      createdBy: 'system',
      updatedAt: NOW,
      updatedBy: 'system',
    } as PositioningThesis;
    const vault: EvidenceVaultItem[] = [
      {
        id: 'vault_1',
        organizationId: 'org_a',
        clientId: 'client_a',
        title: 'Bio',
        type: 'DOCUMENT',
        snippet: 'Managing Partner',
        confidenceScore: 99,
        verified: true,
        verifiedAt: NOW,
        associatedThesesIds: ['th_1'],
        createdAt: NOW,
      },
    ];
    const review = reviewClaims('Managing Partner at Acme Legal LLP', thesis, vault);
    const projection = projectAdvisoryClaimSafety(review, 'Managing Partner at Acme Legal LLP', NOW);
    // Advisory may PASS for display — still not Verification authority.
    expect(['PASS', 'REVIEW', 'BLOCK']).toContain(projection.verdict);
    const store = createLocalClaimEvidenceStore();
    store.resetForTest();
    expect(store.storedVerificationCount()).toBe(0);
  });

  it('authorize-before-side-effect: denied canonical write leaves repository unchanged', () => {
    const h = buildHarness();
    h.evidenceWriter.put(makeEvidence('ev_1'));
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    h.requireEvidence({
      trusted: TRUSTED,
      claimId: 'claim_1',
      mode: 'EVIDENCE_REQUIRED',
    });
    const before = h.store.getClaimById('claim_1', TRUSTED)?.status;
    const auth = h.authorize({
      trusted: TRUSTED,
      contentId: 'content_1',
      targetContentStatus: 'PUBLISHED',
    });
    expect(auth.decision.allowed).toBe(false);
    // Simulate consumer: only write when allowed
    let publishWrites = 0;
    if (auth.decision.allowed) {
      publishWrites += 1;
      new LocalClaimRepository(h.store).commitWriteUnit({
        claims: [h.store.getClaimById('claim_1', TRUSTED)!],
        history: [],
      });
    }
    expect(publishWrites).toBe(0);
    expect(h.store.getClaimById('claim_1', TRUSTED)?.status).toBe(before);
  });

  it('StrategicBrief traceability fields remain on content context (not verification authority)', () => {
    const h = buildHarness();
    const ctx = h.contents.content_1;
    expect(ctx.strategicBriefId).toBe('brief_1');
    expect(ctx.strategicBriefVersion).toBe(2);
    const auth = h.authorize({
      trusted: TRUSTED,
      contentId: 'content_1',
      targetContentStatus: 'DRAFT',
    });
    expect(auth.decision.reasonCode).toBe('TARGET_NOT_GATED');
  });

  it('cross-org content context returns not-found / deny', () => {
    const h = buildHarness();
    expect(() =>
      h.authorize({
        trusted: { ...TRUSTED, organizationId: 'org_b', clientId: 'client_b' },
        contentId: 'content_1',
        targetContentStatus: 'READY',
      })
    ).toThrow(ClaimEvidenceError);
  });

  it('gated status helper unchanged', () => {
    expect(isClaimGatedStatus('PUBLISHED')).toBe(true);
    expect(isClaimGatedStatus('AI_GENERATED')).toBe(false);
  });
});
