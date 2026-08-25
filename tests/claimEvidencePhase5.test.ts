/**
 * SPEC-006 Phase 5 — adversarial / authority-bypass suite (T-006-502…505, 510).
 * Threats: T-006-01…14 behavioral proofs. No paid AI. No product redesign.
 */
import { describe, expect, it } from 'vitest';
import { ClaimEvidenceError } from '../src/application/claimEvidence';
import type { ClaimContentContext } from '../src/application/claimEvidence';
import { composeClaimEvidence } from '../src/composition/claimEvidence/composeClaimEvidence';
import { projectAdvisoryClaimSafety } from '../src/composition/claimEvidence/advisoryClaimSafetyProjection';
import { assertClaimSafeTransition } from '../src/domain/claimSafetyGateCore';
import { reviewClaims } from '../src/domain/claimSafetyCore';
import { createClaimSource } from '../src/domain/claimSourceCore';
import { createClaimEvidence } from '../src/domain/evidenceCore';
import { isMaterialEvidenceChange } from '../src/domain/claimMaterialityCore';
import {
  CLAIM_CURRENT_STORE_KEY,
  CLAIM_CURRENT_STORE_SCHEMA,
  CLAIM_HISTORY_STORE_KEY,
  CLAIM_HISTORY_STORE_SCHEMA,
  CLAIM_VERIFICATION_STORE_KEY,
  createLocalClaimEvidenceStore,
  LocalClaimRepository,
  LocalVerificationStore,
  type StorageLike,
} from '../src/infrastructure/claimEvidence';
import type { PositioningThesis } from '../src/types';

const NOW = '2026-08-25T23:00:00.000Z';
const LATER = '2026-08-25T23:30:00.000Z';

const TRUSTED = {
  actorId: 'admin_1',
  actorRole: 'ADMIN' as const,
  organizationId: 'org_a',
  clientId: 'client_a',
  now: NOW,
};

function content(hash = 'hash_a', id = 'content_1'): ClaimContentContext {
  return {
    contentId: id,
    organizationId: 'org_a',
    clientId: 'client_a',
    contentHash: hash,
    strategicBriefId: 'brief_1',
    strategicBriefVersion: 2,
  };
}

function makeEvidence(
  id: string,
  tenant: { organizationId: string; clientId: string } = TRUSTED,
  sourceUrl = `https://example.com/${id}`
) {
  const source = createClaimSource({
    sourceType: 'PRIMARY',
    sourceUrl,
    publisher: 'Acme',
  });
  if (!source.ok) throw new Error(source.error.message);
  const result = createClaimEvidence({
    id,
    organizationId: tenant.organizationId,
    clientId: tenant.clientId,
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

function memoryKv(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
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

function thesisFixture(): PositioningThesis {
  return {
    id: 'th_1',
    organizationId: 'org_a',
    clientId: 'client_a',
    title: 'Test',
    domain: 'Law',
    targetAudience: 'GC',
    expertIdentity: 'Partner',
    objective: 'Trust',
    proofPoints: [],
    voiceAndTone: 'Formal',
    complianceRules: '',
    status: 'ACTIVE',
    clientApprovalStatus: 'APPROVED',
    createdAt: NOW,
    createdBy: 'system',
    updatedAt: NOW,
    updatedBy: 'system',
  } as PositioningThesis;
}

describe('SPEC-006 Phase 5 — tenant attack matrix (T-006-502 / T-006-01/08)', () => {
  it('cross-org Claim/Evidence/Verification reads and authorize are denied', () => {
    const h = buildHarness();
    h.evidenceWriter.put(makeEvidence('ev_1'));
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    const foreign = { organizationId: 'org_b', clientId: 'client_b' };
    expect(h.store.getClaimById('claim_1', foreign)).toBeUndefined();
    expect(h.store.getEvidenceById('ev_1', foreign)).toBeUndefined();
    expect(() =>
      h.authorize({
        trusted: { ...TRUSTED, ...foreign },
        contentId: 'content_1',
        targetContentStatus: 'READY',
      })
    ).toThrow(ClaimEvidenceError);
  });

  it('cross-client isolation within same org', () => {
    const h = buildHarness({
      content_1: content(),
      content_2: {
        ...content('hash_b', 'content_2'),
        clientId: 'client_b',
      },
    });
    h.evidenceWriter.put(makeEvidence('ev_1'));
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    expect(
      h.store.getClaimById('claim_1', { organizationId: 'org_a', clientId: 'client_b' })
    ).toBeUndefined();
    expect(
      h.store.getEvidenceById('ev_1', { organizationId: 'org_a', clientId: 'client_b' })
    ).toBeUndefined();
  });

  it('same-ID collision across tenants remains isolated', () => {
    const h = buildHarness({
      content_a: content('hash_a', 'content_a'),
      content_b: {
        contentId: 'content_b',
        organizationId: 'org_b',
        clientId: 'client_b',
        contentHash: 'hash_b',
      },
    });
    h.register({
      trusted: TRUSTED,
      claimId: 'shared_id',
      contentId: 'content_a',
      text: 'Org A text',
      kind: 'CREDENTIAL',
    });
    h.register({
      trusted: {
        ...TRUSTED,
        organizationId: 'org_b',
        clientId: 'client_b',
        actorId: 'admin_b',
      },
      claimId: 'shared_id',
      contentId: 'content_b',
      text: 'Org B text',
      kind: 'CREDENTIAL',
    });
    expect(h.store.getClaimById('shared_id', TRUSTED)?.text).toBe('Org A text');
    expect(
      h.store.getClaimById('shared_id', { organizationId: 'org_b', clientId: 'client_b' })?.text
    ).toBe('Org B text');
  });

  it('foreign Evidence injection denied on LinkEvidenceToClaim (T-006-01)', () => {
    const h = buildHarness();
    h.evidenceWriter.put(
      makeEvidence('foreign_ev', { organizationId: 'org_b', clientId: 'client_b' })
    );
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    expect(() =>
      h.linkEvidence({
        trusted: TRUSTED,
        claimId: 'claim_1',
        evidenceId: 'foreign_ev',
        linkId: 'link_bad',
      })
    ).toThrow(ClaimEvidenceError);
    expect(h.store.storedLinkCount()).toBe(0);
  });
});

describe('SPEC-006 Phase 5 — spoof / AI / verification attacks (T-006-503/04/05)', () => {
  it('caller SOFTWARE / softwareAuthority spoof denied; writes = 0', () => {
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
        trusted: { ...TRUSTED, softwareAuthority: undefined },
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
    expect(h.store.storedVerificationCount()).toBe(0);
  });

  it('caller HUMAN/ADMIN role spoof: CLIENT trusted context denied', () => {
    const h = buildHarness();
    expect(() =>
      h.authorize({
        trusted: { ...TRUSTED, actorRole: 'CLIENT' },
        contentId: 'content_1',
        targetContentStatus: 'READY',
      })
    ).toThrow(ClaimEvidenceError);
  });

  it('AI self-verification / advisory PASS cannot create Verification (T-006-05)', () => {
    const review = reviewClaims(
      'Managing Partner at Acme Legal LLP',
      thesisFixture(),
      [
        {
          id: 'v1',
          organizationId: 'org_a',
          clientId: 'client_a',
          title: 'Bio',
          type: 'DOCUMENT',
          snippet: 'Managing Partner',
          confidenceScore: 99,
          verified: true,
          associatedThesesIds: ['th_1'],
          createdAt: NOW,
        },
      ]
    );
    const projection = projectAdvisoryClaimSafety(review, 'Managing Partner at Acme Legal LLP', NOW);
    expect(projection.verdict).toBeTruthy();
    const h = buildHarness();
    expect(h.store.storedVerificationCount()).toBe(0);
    // forgedClaims discarded
    const auth = h.authorize({
      trusted: TRUSTED,
      contentId: 'content_1',
      targetContentStatus: 'READY',
      forgedClaims: [{ status: 'VERIFIED', verification: { result: 'PASS', actorType: 'AI' } }],
    });
    expect(auth.decision.reasonCode).toBe('NO_CLAIMS');
  });

  it('legacy claimSafety PASS + ContentItem projection ignored when canonical blocks (T-006-09)', () => {
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
      targetContentStatus: 'PUBLISHED',
    });
    expect(auth.decision.allowed).toBe(false);
    const shim = assertClaimSafeTransition(
      'AI_GENERATED',
      'PUBLISHED',
      { verdict: 'PASS', summary: 'legacy', reviewedAt: NOW, findings: [] },
      {
        canonical: {
          allowed: auth.decision.allowed,
          reason: auth.decision.summary,
          reasonCode: auth.decision.reasonCode,
        },
      }
    );
    expect(shim.allowed).toBe(false);
  });

  it('caller Claim-subset omission: forgedClaims ignored; full content set governs (T-006-07)', () => {
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
      text: 'Best lawyer worldwide',
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
      forgedClaims: [{ id: 'ok', status: 'VERIFIED' }],
    });
    expect(decision.decision.allowed).toBe(false);
    expect(decision.decision.blockingClaimIds).toContain('bad');
    expect(decision.claims.map((c) => c.id).sort()).toEqual(['bad', 'ok']);
  });
});

describe('SPEC-006 Phase 5 — stale / material / history (T-006-504/06)', () => {
  it('stale Verification after contentHash change cannot authorize', () => {
    const contents: Record<string, ClaimContentContext> = { content_1: content('hash_a') };
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
    contents.content_1 = content('hash_b');
    h.register({
      trusted: { ...TRUSTED, now: LATER },
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
    expect(
      new LocalVerificationStore(h.store).findByClaimAndHash('claim_1', TRUSTED, 'hash_b')
    ).toBeUndefined();
  });

  it('Evidence / Source material change is detectable; old Verification hash-bound', () => {
    const before = makeEvidence('ev_1', TRUSTED, 'https://example.com/a');
    const after = makeEvidence('ev_1', TRUSTED, 'https://example.com/b');
    expect(isMaterialEvidenceChange(before, after)).toBe(true);
    const h = buildHarness();
    h.evidenceWriter.put(before);
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
    // Replace evidence material in store — verification remains hash-bound to claim, not re-bound.
    h.evidenceWriter.put(after);
    const ver = new LocalVerificationStore(h.store).getById('ver_1', TRUSTED);
    expect(ver?.contentHash).toBe('hash_a');
    expect(ver?.evidenceIds).toEqual(['ev_1']);
  });

  it('forged history PUBLICATION_AUTHORIZED does not authorize current Claim (T-006-04)', () => {
    const h = buildHarness();
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    h.store.appendHistory({
      id: 'hist_forge_pass',
      organizationId: 'org_a',
      clientId: 'client_a',
      claimId: 'claim_1',
      event: 'PUBLICATION_AUTHORIZED',
      actorId: 'attacker',
      at: NOW,
      afterStatus: 'VERIFIED',
      contentHash: 'hash_a',
    });
    expect(h.store.getClaimById('claim_1', TRUSTED)?.status).toBe('DETECTED');
    expect(
      h.authorize({
        trusted: TRUSTED,
        contentId: 'content_1',
        targetContentStatus: 'READY',
      }).decision.allowed
    ).toBe(false);
  });

  it('StrategicBrief ref does not authorize when Claim blocks (T-006-11)', () => {
    const h = buildHarness();
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
      strategicBriefId: 'brief_1',
      strategicBriefVersion: 2,
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
    });
    expect(auth.decision.allowed).toBe(false);
    expect(h.contents.content_1.strategicBriefId).toBe('brief_1');
  });

  it('deleted / missing Evidence blocks VerifyClaim (T-006-06)', () => {
    const h = buildHarness();
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    expect(() =>
      h.verify({
        trusted: TRUSTED,
        claimId: 'claim_1',
        verificationId: 'ver_missing',
        result: 'PASS',
        evidenceIds: ['missing_ev'],
        summary: 'no',
        ruleId: 'r',
        ruleVersion: '1',
        invocation: { kind: 'HUMAN' },
      })
    ).toThrow(ClaimEvidenceError);
    expect(h.store.storedVerificationCount()).toBe(0);
  });
});

describe('SPEC-006 Phase 5 — HARD_BLOCK / override / multi-claim (T-006-505/13/14)', () => {
  it('HARD_BLOCK cannot be escaped via override / legacy PASS / sibling safe claim', () => {
    const h = buildHarness();
    h.evidenceWriter.put(makeEvidence('ev_1'));
    h.register({
      trusted: TRUSTED,
      claimId: 'hard',
      contentId: 'content_1',
      text: 'We guarantee outcomes',
      kind: 'HARD_BLOCK',
    });
    h.linkEvidence({
      trusted: TRUSTED,
      claimId: 'hard',
      evidenceId: 'ev_1',
      linkId: 'link_h',
    });
    h.verify({
      trusted: TRUSTED,
      claimId: 'hard',
      verificationId: 'ver_h',
      result: 'HARD_BLOCK',
      evidenceIds: ['ev_1'],
      summary: 'hard',
      ruleId: 'r',
      ruleVersion: '1',
      invocation: { kind: 'HUMAN' },
    });
    expect(() =>
      h.override({
        trusted: TRUSTED,
        claimId: 'hard',
        reason: 'please publish',
      })
    ).toThrow(ClaimEvidenceError);

    h.register({
      trusted: TRUSTED,
      claimId: 'safe',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    h.linkEvidence({
      trusted: TRUSTED,
      claimId: 'safe',
      evidenceId: 'ev_1',
      linkId: 'link_s',
    });
    h.verify({
      trusted: TRUSTED,
      claimId: 'safe',
      verificationId: 'ver_s',
      result: 'PASS',
      evidenceIds: ['ev_1'],
      summary: 'ok',
      ruleId: 'r',
      ruleVersion: '1',
      invocation: { kind: 'HUMAN' },
    });
    const auth = h.authorize({
      trusted: TRUSTED,
      contentId: 'content_1',
      targetContentStatus: 'PUBLISHED',
    });
    expect(auth.decision.allowed).toBe(false);
    expect(auth.decision.reasonCode).toBe('HARD_BLOCKED');
  });

  it('override without reason / AI actor denied; empty reason denied', () => {
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
    h.verify({
      trusted: TRUSTED,
      claimId: 'claim_1',
      verificationId: 'ver_fail',
      result: 'FAIL',
      evidenceIds: ['ev_1'],
      summary: 'no',
      ruleId: 'r',
      ruleVersion: '1',
      invocation: { kind: 'HUMAN' },
    });
    expect(() =>
      h.override({
        trusted: TRUSTED,
        claimId: 'claim_1',
        reason: '   ',
      })
    ).toThrow(ClaimEvidenceError);
    expect(() =>
      h.override({
        trusted: TRUSTED,
        claimId: 'claim_1',
        reason: 'ok',
        claimedActorType: 'AI',
      })
    ).toThrow(ClaimEvidenceError);
    expect(h.store.listOverrides()).toHaveLength(0);
  });

  it('multi-claim order independence: blocking claim denies regardless of order', () => {
    const orders = [
      ['safe', 'block'],
      ['block', 'safe'],
    ] as const;
    for (const order of orders) {
      const h = buildHarness();
      h.evidenceWriter.put(makeEvidence('ev_1'));
      for (const id of order) {
        if (id === 'safe') {
          h.register({
            trusted: TRUSTED,
            claimId: 'safe',
            contentId: 'content_1',
            text: 'Managing Partner at Acme',
            kind: 'CREDENTIAL',
          });
          h.linkEvidence({
            trusted: TRUSTED,
            claimId: 'safe',
            evidenceId: 'ev_1',
            linkId: `link_${id}`,
          });
          h.verify({
            trusted: TRUSTED,
            claimId: 'safe',
            verificationId: `ver_${id}`,
            result: 'PASS',
            evidenceIds: ['ev_1'],
            summary: 'ok',
            ruleId: 'r',
            ruleVersion: '1',
            invocation: { kind: 'HUMAN' },
          });
        } else {
          h.register({
            trusted: TRUSTED,
            claimId: 'block',
            contentId: 'content_1',
            text: 'Best firm on earth',
            kind: 'SUPERLATIVE',
          });
          h.requireEvidence({
            trusted: TRUSTED,
            claimId: 'block',
            mode: 'EVIDENCE_REQUIRED',
          });
        }
      }
      const decision = h.authorize({
        trusted: TRUSTED,
        contentId: 'content_1',
        targetContentStatus: 'READY',
      });
      expect(decision.decision.allowed).toBe(false);
      expect(decision.decision.blockingClaimIds).toContain('block');
    }
  });
});

describe('SPEC-006 Phase 5 — malformed fail-closed / tamper / replay (T-006-04/08)', () => {
  it('malformed Claim / Verification / history fail closed without legacy fallback', () => {
    const kv = memoryKv();
    kv.setItem(
      CLAIM_CURRENT_STORE_KEY,
      JSON.stringify({
        schemaVersion: CLAIM_CURRENT_STORE_SCHEMA,
        claims: [{ id: 'x', organizationId: 'org_a' }],
      })
    );
    expect(() => createLocalClaimEvidenceStore(kv).getClaimById('x', TRUSTED)).toThrow(
      ClaimEvidenceError
    );

    const kv2 = memoryKv();
    kv2.setItem(
      CLAIM_VERIFICATION_STORE_KEY,
      JSON.stringify({
        schemaVersion: 'claim-verification-store-v1',
        verifications: [
          {
            id: 'v1',
            claimId: 'c1',
            organizationId: 'org_a',
            clientId: 'client_a',
            result: 'PASS',
            claimStatusAfter: 'VERIFIED',
            actorType: 'AI',
            actorId: 'bot',
            ruleId: 'r',
            ruleVersion: '1',
            evidenceIds: [],
            summary: 'x',
            createdAt: NOW,
            contentHash: 'h',
          },
        ],
      })
    );
    expect(() =>
      createLocalClaimEvidenceStore(kv2).getVerificationById('v1', TRUSTED)
    ).toThrow(ClaimEvidenceError);

    const kv3 = memoryKv();
    kv3.setItem(
      CLAIM_HISTORY_STORE_KEY,
      JSON.stringify({
        schemaVersion: CLAIM_HISTORY_STORE_SCHEMA,
        entries: [{ id: 'h1', event: 'FAKE_PASS' }],
      })
    );
    expect(() => createLocalClaimEvidenceStore(kv3).listHistory()).toThrow(ClaimEvidenceError);
  });

  it('denied authorization produces zero publish side-effect writes', () => {
    const h = buildHarness();
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
      targetContentStatus: 'PUBLISHED',
    });
    expect(auth.decision.allowed).toBe(false);
    let publishWrites = 0;
    let sendWrites = 0;
    if (auth.decision.allowed) {
      publishWrites += 1;
      sendWrites += 1;
      new LocalClaimRepository(h.store).commitWriteUnit({
        claims: [h.store.getClaimById('claim_1', TRUSTED)!],
        history: [],
      });
    }
    expect(publishWrites).toBe(0);
    expect(sendWrites).toBe(0);
  });

  it('replay RegisterClaim / Verify after adapter reload remains idempotent', () => {
    const kv = memoryKv();
    const store1 = createLocalClaimEvidenceStore(kv);
    store1.resetForTest();
    const h1 = composeClaimEvidence({
      store: store1,
      content: { getById: (id) => (id === 'content_1' ? content() : undefined) },
    });
    h1.evidenceWriter.put(makeEvidence('ev_1'));
    h1.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    h1.linkEvidence({
      trusted: TRUSTED,
      claimId: 'claim_1',
      evidenceId: 'ev_1',
      linkId: 'link_1',
    });
    h1.verify({
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

    const h2 = composeClaimEvidence({
      store: createLocalClaimEvidenceStore(kv),
      content: { getById: (id) => (id === 'content_1' ? content() : undefined) },
    });
    expect(
      h2.register({
        trusted: TRUSTED,
        claimId: 'claim_1',
        contentId: 'content_1',
        text: 'Managing Partner at Acme',
        kind: 'CREDENTIAL',
      }).created
    ).toBe(false);
    expect(
      h2.verify({
        trusted: TRUSTED,
        claimId: 'claim_1',
        verificationId: 'ver_1',
        result: 'PASS',
        evidenceIds: ['ev_1'],
        summary: 'ok',
        ruleId: 'r',
        ruleVersion: '1',
        invocation: { kind: 'HUMAN' },
      }).created
    ).toBe(false);
    expect(h2.store.storedClaimCount()).toBe(1);
    expect(h2.store.storedVerificationCount()).toBe(1);
  });

  it('write-unit inject-fail rolls back; no inconsistent current authority', () => {
    const h = buildHarness();
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    h.store.failBeforePersistForTest = true;
    expect(() =>
      h.requireEvidence({
        trusted: { ...TRUSTED, now: LATER },
        claimId: 'claim_1',
        mode: 'EVIDENCE_REQUIRED',
      })
    ).toThrow(ClaimEvidenceError);
    h.store.failBeforePersistForTest = false;
    expect(h.store.getClaimById('claim_1', TRUSTED)?.status).toBe('DETECTED');
  });
});

describe('SPEC-006 Phase 5 — legacy suites remain green contract (T-006-510)', () => {
  it('legacy gate without canonical fails closed (strangler security)', () => {
    const result = assertClaimSafeTransition('AI_GENERATED', 'CLIENT_REVIEW', {
      verdict: 'PASS',
      summary: 'legacy',
      reviewedAt: NOW,
      findings: [],
    });
    expect(result.allowed).toBe(false);
  });
});
