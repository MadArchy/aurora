import { describe, expect, it } from 'vitest';
import type { Claim } from '../src/domain/claimCore';
import type { ClaimEvidenceLink } from '../src/domain/claimLinkCore';
import type { ClaimOverrideRecord } from '../src/domain/claimOverrideCore';
import type { ClaimVerification } from '../src/domain/claimVerificationCore';
import { createClaimSource } from '../src/domain/claimSourceCore';
import { createClaimEvidence, type ClaimEvidence } from '../src/domain/evidenceCore';
import { createAuthorizePublication } from '../src/application/claimEvidence/AuthorizePublication';
import { createExtractClaims } from '../src/application/claimEvidence/ExtractClaims';
import { createLinkEvidenceToClaim } from '../src/application/claimEvidence/LinkEvidenceToClaim';
import { createOverrideClaimGate } from '../src/application/claimEvidence/OverrideClaimGate';
import { createRegisterClaim } from '../src/application/claimEvidence/RegisterClaim';
import { createRejectClaimVerification } from '../src/application/claimEvidence/RejectClaimVerification';
import { createRequireEvidence } from '../src/application/claimEvidence/RequireEvidence';
import { createReviewClaim } from '../src/application/claimEvidence/ReviewClaim';
import { createVerifyClaim } from '../src/application/claimEvidence/VerifyClaim';
import { ClaimEvidenceError } from '../src/application/claimEvidence/errors';
import type { ClaimContentContext } from '../src/application/claimEvidence/ports/ClaimContentReader';
import type { ClaimHistoryRecord } from '../src/application/claimEvidence/ports/ClaimHistoryPort';
import type {
  ClaimRepository,
  ClaimTenantScope,
  ClaimWriteUnit,
} from '../src/application/claimEvidence/ports/ClaimRepository';
import type { EvidenceReader } from '../src/application/claimEvidence/ports/EvidenceReader';
import type { VerificationStore } from '../src/application/claimEvidence/ports/VerificationStore';
import type { TrustedClaimActorContext } from '../src/application/claimEvidence/trustedContext';

const NOW = '2026-08-25T18:00:00.000Z';

function adminTrusted(
  overrides: Partial<TrustedClaimActorContext> = {}
): TrustedClaimActorContext {
  return {
    actorId: 'admin_1',
    actorRole: 'ADMIN',
    organizationId: 'org_a',
    clientId: 'client_a',
    now: NOW,
    ...overrides,
  };
}

function makeEvidence(id: string, tenant?: Partial<ClaimTenantScope>): ClaimEvidence {
  const source = createClaimSource({
    sourceType: 'PRIMARY',
    sourceUrl: `https://example.com/${id}`,
    publisher: 'Acme',
  });
  if (!source.ok) throw new Error(source.error.message);
  const result = createClaimEvidence({
    id,
    organizationId: tenant?.organizationId ?? 'org_a',
    clientId: tenant?.clientId ?? 'client_a',
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

function createMemoryHarness() {
  const claims = new Map<string, Claim>();
  const links = new Map<string, ClaimEvidenceLink>();
  const evidence = new Map<string, ClaimEvidence>();
  const verifications = new Map<string, ClaimVerification>();
  const history: ClaimHistoryRecord[] = [];
  const overrides: ClaimOverrideRecord[] = [];
  const contents = new Map<string, ClaimContentContext>();
  let writeCount = 0;
  let extractCount = 0;

  const tenantKey = (t: ClaimTenantScope, id: string) =>
    `${t.organizationId}|${t.clientId}|${id}`;

  const claimRepo: ClaimRepository = {
    getById(claimId, tenant) {
      const c = claims.get(tenantKey(tenant, claimId));
      if (!c) return undefined;
      if (c.organizationId !== tenant.organizationId || c.clientId !== tenant.clientId) {
        return undefined;
      }
      return c;
    },
    findByContent(tenant, contentId) {
      return [...claims.values()].filter(
        (c) =>
          c.organizationId === tenant.organizationId &&
          c.clientId === tenant.clientId &&
          c.contentId === contentId
      );
    },
    findByContentHash(tenant, contentId, contentHash, text, kind) {
      return (
        [...claims.values()].find(
          (c) =>
            c.organizationId === tenant.organizationId &&
            c.clientId === tenant.clientId &&
            c.contentId === contentId &&
            c.contentHash === contentHash &&
            c.text === text &&
            c.kind === kind
        ) ?? undefined
      );
    },
    commitWriteUnit(unit: ClaimWriteUnit) {
      writeCount += 1;
      for (const c of unit.claims) {
        claims.set(tenantKey(c, c.id), c);
      }
      for (const l of unit.links ?? []) {
        links.set(`${l.claimId}|${l.evidenceId}`, l);
      }
      for (const v of unit.verifications ?? []) {
        verifications.set(tenantKey(v, v.id), v);
      }
      if (unit.overrideAudit) overrides.push(unit.overrideAudit);
    },
  };

  const evidenceReader: EvidenceReader = {
    getById(evidenceId, tenant) {
      const e = evidence.get(tenantKey(tenant, evidenceId));
      if (!e) return undefined;
      if (e.organizationId !== tenant.organizationId || e.clientId !== tenant.clientId) {
        return undefined;
      }
      return e;
    },
    findLink(tenant, claimId, evidenceId) {
      const link = links.get(`${claimId}|${evidenceId}`);
      if (!link) return undefined;
      if (
        link.organizationId !== tenant.organizationId ||
        link.clientId !== tenant.clientId
      ) {
        return undefined;
      }
      return link;
    },
    listLinksForClaim(tenant, claimId) {
      return [...links.values()].filter(
        (l) =>
          l.claimId === claimId &&
          l.organizationId === tenant.organizationId &&
          l.clientId === tenant.clientId
      );
    },
  };

  const verificationStore: VerificationStore = {
    getById(verificationId, tenant) {
      const v = verifications.get(tenantKey(tenant, verificationId));
      if (!v) return undefined;
      if (v.organizationId !== tenant.organizationId || v.clientId !== tenant.clientId) {
        return undefined;
      }
      return v;
    },
    getLatestForClaim(claimId, tenant) {
      const list = [...verifications.values()]
        .filter(
          (v) =>
            v.claimId === claimId &&
            v.organizationId === tenant.organizationId &&
            v.clientId === tenant.clientId
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return list[list.length - 1];
    },
    findByClaimAndHash(claimId, tenant, contentHash) {
      return (
        [...verifications.values()].find(
          (v) =>
            v.claimId === claimId &&
            v.contentHash === contentHash &&
            v.organizationId === tenant.organizationId &&
            v.clientId === tenant.clientId
        ) ?? undefined
      );
    },
  };

  const historyPort = {
    append(record: ClaimHistoryRecord) {
      history.push(record);
    },
    appendOverride(record: ClaimOverrideRecord) {
      overrides.push(record);
    },
  };

  const contentReader = {
    getById(contentId: string, tenant: ClaimTenantScope) {
      const c = contents.get(tenantKey(tenant, contentId));
      if (!c) return undefined;
      if (c.organizationId !== tenant.organizationId || c.clientId !== tenant.clientId) {
        return undefined;
      }
      return c;
    },
  };

  const extractor = {
    extract() {
      extractCount += 1;
      return [
        {
          text: 'Managing Partner at Acme Legal',
          kind: 'CREDENTIAL' as const,
          confidence: 0.8,
          rationaleSummary: 'pattern match (advisory)',
        },
      ];
    },
  };

  function seedContent(overrides: Partial<ClaimContentContext> = {}) {
    const ctx: ClaimContentContext = {
      contentId: 'content_1',
      organizationId: 'org_a',
      clientId: 'client_a',
      contentHash: 'hash_v1',
      strategicBriefId: 'brief_1',
      strategicBriefVersion: 2,
      ...overrides,
    };
    contents.set(tenantKey(ctx, ctx.contentId), ctx);
    return ctx;
  }

  function seedEvidence(item: ClaimEvidence) {
    evidence.set(tenantKey(item, item.id), item);
  }

  const deps = {
    claims: claimRepo,
    history: historyPort,
    content: contentReader,
    evidence: evidenceReader,
    verifications: verificationStore,
    extractor,
  };

  return {
    deps,
    seedContent,
    seedEvidence,
    get writeCount() {
      return writeCount;
    },
    get extractCount() {
      return extractCount;
    },
    get history() {
      return history;
    },
    claims,
    resetWrites() {
      writeCount = 0;
      extractCount = 0;
    },
  };
}

describe('SPEC-006 Phase 2 — Application governance', () => {
  it('T-006-202 RegisterClaim uses trusted tenant and ignores supportingEvidence as verify', () => {
    const h = createMemoryHarness();
    h.seedContent();
    const register = createRegisterClaim(h.deps);
    const result = register({
      trusted: adminTrusted(),
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme Legal',
      kind: 'CREDENTIAL',
      claimedOrganizationId: 'org_a',
    });
    expect(result.created).toBe(true);
    expect(result.claim.status).toBe('DETECTED');
    expect(result.claim.strategicBriefId).toBe('brief_1');
    expect(result.claim.organizationId).toBe('org_a');
  });

  it('denies caller tenant spoof before write', () => {
    const h = createMemoryHarness();
    h.seedContent();
    const register = createRegisterClaim(h.deps);
    h.resetWrites();
    expect(() =>
      register({
        trusted: adminTrusted(),
        claimId: 'claim_x',
        contentId: 'content_1',
        text: 'x',
        kind: 'METRIC',
        claimedOrganizationId: 'org_evil',
      })
    ).toThrow(ClaimEvidenceError);
    expect(h.writeCount).toBe(0);
  });

  it('RegisterClaim is idempotent for same material identity', () => {
    const h = createMemoryHarness();
    h.seedContent();
    const register = createRegisterClaim(h.deps);
    const first = register({
      trusted: adminTrusted(),
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Award: Chambers Band 1',
      kind: 'AWARD',
    });
    const second = register({
      trusted: adminTrusted(),
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Award: Chambers Band 1',
      kind: 'AWARD',
    });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.claim.id).toBe('claim_1');
  });

  it('T-006-201 ExtractClaims uses port only; runtime extractor deferred', () => {
    const h = createMemoryHarness();
    h.seedContent();
    const extract = createExtractClaims(h.deps);
    const result = extract({
      trusted: adminTrusted(),
      contentId: 'content_1',
      body: 'Managing Partner at Acme Legal won Chambers.',
      persist: true,
    });
    expect(result.runtimeExtractor).toBe('PORT_ONLY');
    expect(result.proposals).toHaveLength(1);
    expect(result.registered[0].claim.status).toBe('DETECTED');
    expect(h.extractCount).toBe(1);
  });

  it('denies extract on foreign content without calling extractor', () => {
    const h = createMemoryHarness();
    h.seedContent({ organizationId: 'org_b', clientId: 'client_b' });
    const extract = createExtractClaims(h.deps);
    h.resetWrites();
    expect(() =>
      extract({
        trusted: adminTrusted(),
        contentId: 'content_1',
        body: 'text',
      })
    ).toThrow(/Content not found/);
    expect(h.extractCount).toBe(0);
    expect(h.writeCount).toBe(0);
  });

  it('T-006-203 LinkEvidence same-tenant; denies foreign evidence', () => {
    const h = createMemoryHarness();
    h.seedContent();
    h.seedEvidence(makeEvidence('ev_1'));
    h.seedEvidence(makeEvidence('ev_foreign', { organizationId: 'org_b', clientId: 'client_b' }));
    const register = createRegisterClaim(h.deps);
    register({
      trusted: adminTrusted(),
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme Legal',
      kind: 'CREDENTIAL',
    });
    const link = createLinkEvidenceToClaim(h.deps);
    const ok = link({
      trusted: adminTrusted(),
      claimId: 'claim_1',
      evidenceId: 'ev_1',
      linkId: 'link_1',
    });
    expect(ok.claim.status).toBe('LINKED');
    expect(ok.created).toBe(true);

    const before = h.writeCount;
    expect(() =>
      link({
        trusted: adminTrusted(),
        claimId: 'claim_1',
        evidenceId: 'ev_foreign',
        linkId: 'link_x',
      })
    ).toThrow(ClaimEvidenceError);
    expect(h.writeCount).toBe(before);
  });

  it('duplicate LinkEvidence is idempotent', () => {
    const h = createMemoryHarness();
    h.seedContent();
    h.seedEvidence(makeEvidence('ev_1'));
    createRegisterClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme Legal',
      kind: 'CREDENTIAL',
    });
    const link = createLinkEvidenceToClaim(h.deps);
    link({
      trusted: adminTrusted(),
      claimId: 'claim_1',
      evidenceId: 'ev_1',
      linkId: 'link_1',
    });
    const again = link({
      trusted: adminTrusted(),
      claimId: 'claim_1',
      evidenceId: 'ev_1',
      linkId: 'link_2',
    });
    expect(again.created).toBe(false);
  });

  it('T-006-204 RequireEvidence and RESEARCH_REQUIRED remain distinct', () => {
    const h = createMemoryHarness();
    h.seedContent();
    createRegisterClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'metric 40%',
      kind: 'METRIC',
    });
    const requireEvidence = createRequireEvidence(h.deps);
    const a = requireEvidence({
      trusted: adminTrusted(),
      claimId: 'claim_1',
      mode: 'EVIDENCE_REQUIRED',
    });
    expect(a.claim.status).toBe('EVIDENCE_REQUIRED');
    const b = requireEvidence({
      trusted: adminTrusted(),
      claimId: 'claim_1',
      mode: 'RESEARCH_REQUIRED',
    });
    expect(b.claim.status).toBe('RESEARCH_REQUIRED');
  });

  it('T-006-205 VerifyClaim HUMAN and SOFTWARE; AI and SOFTWARE spoof denied', () => {
    const h = createMemoryHarness();
    h.seedContent();
    h.seedEvidence(makeEvidence('ev_1'));
    createRegisterClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme Legal',
      kind: 'CREDENTIAL',
    });
    createLinkEvidenceToClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_1',
      evidenceId: 'ev_1',
      linkId: 'link_1',
    });

    const verify = createVerifyClaim(h.deps);
    expect(() =>
      verify({
        trusted: adminTrusted(),
        claimId: 'claim_1',
        verificationId: 'ver_ai',
        result: 'PASS',
        evidenceIds: ['ev_1'],
        summary: 'ai',
        ruleId: 'R1',
        ruleVersion: '1',
        invocation: { kind: 'HUMAN' },
        claimedActorType: 'AI',
      })
    ).toThrow(/AI/);

    expect(() =>
      verify({
        trusted: adminTrusted(), // no softwareAuthority
        claimId: 'claim_1',
        verificationId: 'ver_spoof',
        result: 'PASS',
        evidenceIds: ['ev_1'],
        summary: 'spoof',
        ruleId: 'R1',
        ruleVersion: '1',
        invocation: { kind: 'SOFTWARE' },
        claimedActorType: 'SOFTWARE',
      })
    ).toThrow(/softwareAuthority/);

    const human = verify({
      trusted: adminTrusted(),
      claimId: 'claim_1',
      verificationId: 'ver_h',
      result: 'PASS',
      evidenceIds: ['ev_1'],
      summary: 'human verified',
      ruleId: 'CLAIM-006-VERIFY',
      ruleVersion: '1',
      invocation: { kind: 'HUMAN' },
    });
    expect(human.claim.status).toBe('VERIFIED');
    expect(human.verification.actorType).toBe('HUMAN');
  });

  it('SOFTWARE verification requires trusted softwareAuthority', () => {
    const h = createMemoryHarness();
    h.seedContent();
    h.seedEvidence(makeEvidence('ev_1'));
    createRegisterClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_2',
      contentId: 'content_1',
      text: 'Award: Chambers',
      kind: 'AWARD',
    });
    createLinkEvidenceToClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_2',
      evidenceId: 'ev_1',
      linkId: 'link_2',
    });
    const verify = createVerifyClaim(h.deps);
    const result = verify({
      trusted: adminTrusted({ softwareAuthority: true, actorId: 'system:rule-engine' }),
      claimId: 'claim_2',
      verificationId: 'ver_s',
      result: 'PASS',
      evidenceIds: ['ev_1'],
      summary: 'software rule pass',
      ruleId: 'CLAIM-006-VERIFY',
      ruleVersion: '1',
      invocation: { kind: 'SOFTWARE' },
    });
    expect(result.verification.actorType).toBe('SOFTWARE');
  });

  it('RejectClaimVerification yields UNSUPPORTED distinct from HARD_BLOCK', () => {
    const h = createMemoryHarness();
    h.seedContent();
    h.seedEvidence(makeEvidence('ev_1'));
    createRegisterClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_r',
      contentId: 'content_1',
      text: 'metric 99%',
      kind: 'METRIC',
    });
    createLinkEvidenceToClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_r',
      evidenceId: 'ev_1',
      linkId: 'link_r',
    });
    const reject = createRejectClaimVerification(h.deps);
    const result = reject({
      trusted: adminTrusted(),
      claimId: 'claim_r',
      verificationId: 'ver_fail',
      evidenceIds: ['ev_1'],
      summary: 'unsupported',
      ruleId: 'R',
      ruleVersion: '1',
      invocation: { kind: 'HUMAN' },
    });
    expect(result.claim.status).toBe('UNSUPPORTED');
    expect(result.verification.result).toBe('FAIL');
  });

  it('T-006-206 ReviewClaim does not verify', () => {
    const h = createMemoryHarness();
    h.seedContent();
    createRegisterClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_rev',
      contentId: 'content_1',
      text: 'x',
      kind: 'OTHER',
    });
    const review = createReviewClaim(h.deps);
    const result = review({ trusted: adminTrusted(), claimId: 'claim_rev' });
    expect(result.claim.status).toBe('UNDER_REVIEW');
  });

  it('T-006-207 OverrideClaimGate requires reason; denies HARD_BLOCK and AI', () => {
    const h = createMemoryHarness();
    h.seedContent();
    h.seedEvidence(makeEvidence('ev_1'));
    createRegisterClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_o',
      contentId: 'content_1',
      text: 'metric',
      kind: 'METRIC',
    });
    createLinkEvidenceToClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_o',
      evidenceId: 'ev_1',
      linkId: 'link_o',
    });
    createRejectClaimVerification(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_o',
      verificationId: 'ver_o',
      evidenceIds: ['ev_1'],
      summary: 'fail',
      ruleId: 'R',
      ruleVersion: '1',
      invocation: { kind: 'HUMAN' },
    });

    const override = createOverrideClaimGate(h.deps);
    expect(() =>
      override({
        trusted: adminTrusted(),
        claimId: 'claim_o',
        reason: '',
      })
    ).toThrow(/reason/);

    const ok = override({
      trusted: adminTrusted(),
      claimId: 'claim_o',
      reason: 'Client confirmed offline',
    });
    expect(ok.claim.status).toBe('OVERRIDDEN');

    createRegisterClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_hard',
      contentId: 'content_1',
      text: 'we guarantee results',
      kind: 'GUARANTEE',
      // create as HARD_BLOCKED
    });
    // Force hard block via verify HARD_BLOCK from DETECTED
    createVerifyClaim(h.deps)({
      trusted: adminTrusted({ softwareAuthority: true }),
      claimId: 'claim_hard',
      verificationId: 'ver_hard',
      result: 'HARD_BLOCK',
      evidenceIds: [],
      summary: 'guarantee',
      ruleId: 'R',
      ruleVersion: '1',
      invocation: { kind: 'SOFTWARE' },
    });
    expect(() =>
      override({
        trusted: adminTrusted(),
        claimId: 'claim_hard',
        reason: 'please',
      })
    ).toThrow(/HARD_BLOCK|overrid/i);
  });

  it('T-006-208 AuthorizePublication loads current state; ignores forged VERIFIED', () => {
    const h = createMemoryHarness();
    h.seedContent();
    createRegisterClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_p',
      contentId: 'content_1',
      text: 'Managing Partner',
      kind: 'CREDENTIAL',
    });
    createRequireEvidence(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_p',
      mode: 'EVIDENCE_REQUIRED',
    });

    const authorize = createAuthorizePublication(h.deps);
    const blocked = authorize({
      trusted: adminTrusted(),
      contentId: 'content_1',
      targetContentStatus: 'CLIENT_REVIEW',
      forgedClaims: [{ id: 'claim_p', status: 'VERIFIED' }],
    });
    expect(blocked.decision.allowed).toBe(false);
    expect(blocked.decision.reasonCode).toBe('EVIDENCE_REQUIRED');
    expect(blocked.explainability[0].gateReasonCode).toBe('EVIDENCE_REQUIRED');
  });

  it('AuthorizePublication multi-claim aggregation and empty-claim PASS', () => {
    const h = createMemoryHarness();
    h.seedContent({ contentId: 'content_empty', contentHash: 'hash_empty' });
    const authorize = createAuthorizePublication(h.deps);
    const empty = authorize({
      trusted: adminTrusted(),
      contentId: 'content_empty',
      targetContentStatus: 'READY',
    });
    expect(empty.decision.reasonCode).toBe('NO_CLAIMS');
    expect(empty.decision.allowed).toBe(true);

    h.seedContent();
    h.seedEvidence(makeEvidence('ev_1'));
    createRegisterClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'ok',
      contentId: 'content_1',
      text: 'ok claim',
      kind: 'OTHER',
    });
    createLinkEvidenceToClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'ok',
      evidenceId: 'ev_1',
      linkId: 'link_ok',
    });
    createVerifyClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'ok',
      verificationId: 'ver_ok',
      result: 'PASS',
      evidenceIds: ['ev_1'],
      summary: 'ok',
      ruleId: 'R',
      ruleVersion: '1',
      invocation: { kind: 'HUMAN' },
    });
    createRegisterClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'bad',
      contentId: 'content_1',
      text: 'bad claim',
      kind: 'METRIC',
    });
    createRequireEvidence(h.deps)({
      trusted: adminTrusted(),
      claimId: 'bad',
      mode: 'EVIDENCE_REQUIRED',
    });

    const multi = authorize({
      trusted: adminTrusted(),
      contentId: 'content_1',
      targetContentStatus: 'PUBLISHED',
    });
    expect(multi.decision.allowed).toBe(false);
    expect(multi.decision.blockingClaimIds).toContain('bad');
    expect(multi.decision.blockingClaimIds).not.toContain('ok');
  });

  it('stale verification does not authorize after contentHash change', () => {
    const h = createMemoryHarness();
    h.seedContent({ contentHash: 'hash_v1' });
    h.seedEvidence(makeEvidence('ev_1'));
    createRegisterClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_stale',
      contentId: 'content_1',
      text: 'Managing Partner at Acme Legal',
      kind: 'CREDENTIAL',
    });
    createLinkEvidenceToClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_stale',
      evidenceId: 'ev_1',
      linkId: 'link_stale',
    });
    createVerifyClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_stale',
      verificationId: 'ver_old',
      result: 'PASS',
      evidenceIds: ['ev_1'],
      summary: 'old',
      ruleId: 'R',
      ruleVersion: '1',
      invocation: { kind: 'HUMAN' },
    });

    // Material content change: new hash, re-register new claim material for same content
    h.seedContent({ contentHash: 'hash_v2' });
    createRegisterClaim(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_stale_v2',
      contentId: 'content_1',
      text: 'Managing Partner at Acme Legal — revised',
      kind: 'CREDENTIAL',
    });
    createRequireEvidence(h.deps)({
      trusted: adminTrusted(),
      claimId: 'claim_stale_v2',
      mode: 'EVIDENCE_REQUIRED',
    });

    const authorize = createAuthorizePublication(h.deps);
    const decision = authorize({
      trusted: adminTrusted(),
      contentId: 'content_1',
      targetContentStatus: 'CLIENT_REVIEW',
    });
    // Only current-hash claims considered; old VERIFIED claim dropped as stale hash
    expect(decision.claims.every((c) => c.contentHash === 'hash_v2')).toBe(true);
    expect(decision.decision.allowed).toBe(false);
    expect(decision.explainability.every((e) => e.verificationId !== 'ver_old' || e.contentHash === 'hash_v1')).toBe(
      true
    );
  });

  it('CLIENT role cannot perform claim governance', () => {
    const h = createMemoryHarness();
    h.seedContent();
    const register = createRegisterClaim(h.deps);
    expect(() =>
      register({
        trusted: adminTrusted({ actorRole: 'CLIENT' }),
        claimId: 'claim_c',
        contentId: 'content_1',
        text: 'x',
        kind: 'OTHER',
      })
    ).toThrow(/ADMIN/);
  });
});
