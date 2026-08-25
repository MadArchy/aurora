import { describe, expect, it } from 'vitest';
import { ClaimEvidenceError } from '../src/application/claimEvidence';
import type { ClaimContentContext } from '../src/application/claimEvidence';
import { composeClaimEvidence } from '../src/composition/claimEvidence/composeClaimEvidence';
import { createClaimSource } from '../src/domain/claimSourceCore';
import { createClaimEvidence } from '../src/domain/evidenceCore';
import {
  CLAIM_CURRENT_STORE_KEY,
  CLAIM_CURRENT_STORE_SCHEMA,
  CLAIM_HISTORY_STORE_KEY,
  CLAIM_HISTORY_STORE_SCHEMA,
  CLAIM_VERIFICATION_STORE_KEY,
  createLocalClaimEvidenceStore,
  LocalClaimHistoryAdapter,
  LocalClaimRepository,
  LocalEvidenceVaultAdapter,
  LocalVerificationStore,
  mapVaultItemToClaimEvidence,
  type StorageLike,
} from '../src/infrastructure/claimEvidence';
import type { EvidenceVaultItem } from '../src/types';

const NOW = '2026-08-25T20:00:00.000Z';
const LATER = '2026-08-25T21:00:00.000Z';

const TRUSTED = {
  actorId: 'admin_1',
  actorRole: 'ADMIN' as const,
  organizationId: 'org_a',
  clientId: 'client_a',
  now: NOW,
};

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

function content(
  overrides: Partial<ClaimContentContext> = {}
): ClaimContentContext {
  return {
    contentId: 'content_1',
    organizationId: 'org_a',
    clientId: 'client_a',
    contentHash: 'hash_a',
    ...overrides,
  };
}

function makeCanonicalEvidence(
  id: string,
  tenant: { organizationId: string; clientId: string } = TRUSTED
) {
  const source = createClaimSource({
    sourceType: 'PRIMARY',
    sourceUrl: `https://example.com/${id}`,
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

function vaultItem(
  overrides: Partial<EvidenceVaultItem> = {}
): EvidenceVaultItem {
  return {
    id: 'vault_ev_1',
    organizationId: 'org_a',
    clientId: 'client_a',
    title: 'Vault evidence',
    type: 'DOCUMENT',
    snippet: 'Partner bio',
    sourceUrl: 'https://vault.example.com/bio',
    confidenceScore: 80,
    verified: true,
    verifiedAt: NOW,
    associatedThesesIds: [],
    createdAt: NOW,
    ...overrides,
  };
}

function buildPhase3(opts?: {
  contents?: Record<string, ClaimContentContext>;
  vault?: Record<string, EvidenceVaultItem>;
  kv?: StorageLike;
}) {
  const kv = opts?.kv ?? memoryKv();
  const store = createLocalClaimEvidenceStore(kv);
  store.resetForTest();
  const contents = opts?.contents ?? { content_1: content() };
  const vault = opts?.vault ?? {};
  const composed = composeClaimEvidence({
    store,
    content: { getById: (id) => contents[id] },
    vault: { getById: (id) => vault[id] },
  });
  return { kv, store, contents, vault, ...composed };
}

function expectPersistenceError(fn: () => unknown): void {
  try {
    fn();
    expect.fail('expected persistence failure');
  } catch (err) {
    expect(err).toBeInstanceOf(ClaimEvidenceError);
    expect((err as ClaimEvidenceError).code).toBe('PERSISTENCE_ERROR');
    expect((err as Error).message).not.toMatch(/localStorage|QuotaExceeded|Firestore|indexedDB/i);
  }
}

describe('SPEC-006 Phase 3 — local Claim / Verification persistence', () => {
  it('persists Claim current state with tenant round-trip', () => {
    const h = buildPhase3();
    const result = h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    expect(result.created).toBe(true);
    const loaded = h.store.getClaimById('claim_1', TRUSTED);
    expect(loaded?.status).toBe('DETECTED');
    expect(loaded?.organizationId).toBe('org_a');
    expect(loaded?.clientId).toBe('client_a');
    expect(loaded?.contentHash).toBe('hash_a');
    expect(loaded?.schemaVersion).toBe('claim-v1');
    expect(h.store.listHistory()).toHaveLength(1);
    expect(h.store.listHistory()[0].event).toBe('CLAIM_REGISTERED');
  });

  it('idempotent register does not duplicate Claim or history', () => {
    const h = buildPhase3();
    const input = {
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL' as const,
    };
    expect(h.register(input).created).toBe(true);
    expect(h.register(input).created).toBe(false);
    expect(h.store.storedClaimCount()).toBe(1);
    expect(h.store.listHistory()).toHaveLength(1);
  });

  it('idempotent verify does not duplicate Verification authority or history', () => {
    const h = buildPhase3();
    h.evidenceWriter.put(makeCanonicalEvidence('ev_1'));
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
    const verifyInput = {
      trusted: TRUSTED,
      claimId: 'claim_1',
      verificationId: 'ver_1',
      result: 'PASS' as const,
      evidenceIds: ['ev_1'],
      summary: 'Supported by bio',
      ruleId: 'rule_credential',
      ruleVersion: '1',
      invocation: { kind: 'HUMAN' as const },
    };
    expect(h.verify(verifyInput).created).toBe(true);
    expect(h.verify(verifyInput).created).toBe(false);
    expect(h.store.storedVerificationCount()).toBe(1);
    expect(h.store.listHistory().filter((e) => e.event === 'CLAIM_VERIFIED')).toHaveLength(1);
  });

  it('process-reload idempotency: recreate adapters, no duplicate entities', () => {
    const kv = memoryKv();
    const first = buildPhase3({ kv });
    first.evidenceWriter.put(makeCanonicalEvidence('ev_1'));
    first.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    first.linkEvidence({
      trusted: TRUSTED,
      claimId: 'claim_1',
      evidenceId: 'ev_1',
      linkId: 'link_1',
    });
    first.verify({
      trusted: TRUSTED,
      claimId: 'claim_1',
      verificationId: 'ver_1',
      result: 'PASS',
      evidenceIds: ['ev_1'],
      summary: 'ok',
      ruleId: 'rule_credential',
      ruleVersion: '1',
      invocation: { kind: 'HUMAN' },
    });

    const reloaded = composeClaimEvidence({
      store: createLocalClaimEvidenceStore(kv),
      content: { getById: (id) => (id === 'content_1' ? content() : undefined) },
      vault: { getById: () => undefined },
    });
    const again = reloaded.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    expect(again.created).toBe(false);
    expect(reloaded.store.storedClaimCount()).toBe(1);
    expect(reloaded.store.storedVerificationCount()).toBe(1);
    expect(reloaded.store.listHistory().filter((e) => e.event === 'CLAIM_REGISTERED')).toHaveLength(
      1
    );
  });

  it('same claimId across tenants remains isolated', () => {
    const h = buildPhase3({
      contents: {
        content_a: content({ contentId: 'content_a' }),
        content_b: content({
          contentId: 'content_b',
          organizationId: 'org_b',
          clientId: 'client_b',
          contentHash: 'hash_b',
        }),
      },
    });
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_x',
      contentId: 'content_a',
      text: 'Org A claim',
      kind: 'CREDENTIAL',
    });
    h.register({
      trusted: {
        ...TRUSTED,
        organizationId: 'org_b',
        clientId: 'client_b',
        actorId: 'admin_b',
      },
      claimId: 'claim_x',
      contentId: 'content_b',
      text: 'Org B claim',
      kind: 'CREDENTIAL',
    });
    expect(h.store.getClaimById('claim_x', TRUSTED)?.text).toBe('Org A claim');
    expect(
      h.store.getClaimById('claim_x', { organizationId: 'org_b', clientId: 'client_b' })?.text
    ).toBe('Org B claim');
    expect(h.store.getClaimById('claim_x', TRUSTED)?.organizationId).toBe('org_a');
  });

  it('cross-org Claim / Evidence / Verification reads return not-found', () => {
    const h = buildPhase3();
    h.evidenceWriter.put(makeCanonicalEvidence('ev_1'));
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
      ruleId: 'rule_credential',
      ruleVersion: '1',
      invocation: { kind: 'HUMAN' },
    });
    const foreign = { organizationId: 'org_b', clientId: 'client_b' };
    expect(h.store.getClaimById('claim_1', foreign)).toBeUndefined();
    expect(h.store.getEvidenceById('ev_1', foreign)).toBeUndefined();
    expect(h.store.getVerificationById('ver_1', foreign)).toBeUndefined();
    expect(h.store.getLink(foreign, 'claim_1', 'ev_1')).toBeUndefined();
  });

  it('cross-client isolation within same organization', () => {
    const h = buildPhase3({
      contents: {
        content_1: content(),
        content_2: content({
          contentId: 'content_2',
          clientId: 'client_b',
          contentHash: 'hash_b',
        }),
      },
    });
    h.evidenceWriter.put(makeCanonicalEvidence('ev_1'));
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Client A claim',
      kind: 'CREDENTIAL',
    });
    expect(
      h.store.getClaimById('claim_1', { organizationId: 'org_a', clientId: 'client_b' })
    ).toBeUndefined();
    expect(
      h.store.getEvidenceById('ev_1', { organizationId: 'org_a', clientId: 'client_b' })
    ).toBeUndefined();
  });

  it('Evidence link write is idempotent', () => {
    const h = buildPhase3();
    h.evidenceWriter.put(makeCanonicalEvidence('ev_1'));
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    const input = {
      trusted: TRUSTED,
      claimId: 'claim_1',
      evidenceId: 'ev_1',
      linkId: 'link_1',
    };
    expect(h.linkEvidence(input).created).toBe(true);
    expect(h.linkEvidence(input).created).toBe(false);
    expect(h.store.storedLinkCount()).toBe(1);
    expect(h.store.listHistory().filter((e) => e.event === 'EVIDENCE_LINKED')).toHaveLength(1);
  });

  it('history is append-only and retries do not duplicate material entries', () => {
    const h = buildPhase3();
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    const history = new LocalClaimHistoryAdapter(h.store);
    const entry = h.store.listHistory()[0];
    history.append(entry);
    history.append(entry);
    expect(h.store.listHistory()).toHaveLength(1);
  });

  it('override audit persists once and HARD_BLOCK remains non-overridable via Application', () => {
    const h = buildPhase3();
    h.evidenceWriter.put(makeCanonicalEvidence('ev_1'));
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
      summary: 'unsupported',
      ruleId: 'rule_credential',
      ruleVersion: '1',
      invocation: { kind: 'HUMAN' },
    });
    const first = h.override({
      trusted: { ...TRUSTED, now: LATER },
      claimId: 'claim_1',
      reason: 'Counsel approved wording',
    });
    expect(first.writeUnitCommitted).toBe(true);
    expect(h.store.listOverrides()).toHaveLength(1);
    expect(() =>
      h.override({
        trusted: { ...TRUSTED, now: LATER },
        claimId: 'claim_1',
        reason: 'Counsel approved wording',
      })
    ).toThrow(ClaimEvidenceError);
    expect(h.store.listOverrides()).toHaveLength(1);

    h.register({
      trusted: TRUSTED,
      claimId: 'claim_hard',
      contentId: 'content_1',
      text: 'We guarantee results',
      kind: 'HARD_BLOCK',
    });
    expect(() =>
      h.override({
        trusted: TRUSTED,
        claimId: 'claim_hard',
        reason: 'please',
      })
    ).toThrow(ClaimEvidenceError);
  });

  it('write-unit failure rolls back in-memory and persisted authority', () => {
    const h = buildPhase3();
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    const beforeClaims = h.store.storedClaimCount();
    const beforeHistory = h.store.listHistory().length;
    h.store.failBeforePersistForTest = true;
    expectPersistenceError(() =>
      h.requireEvidence({
        trusted: { ...TRUSTED, now: LATER },
        claimId: 'claim_1',
        mode: 'EVIDENCE_REQUIRED',
      })
    );
    h.store.failBeforePersistForTest = false;
    expect(h.store.getClaimById('claim_1', TRUSTED)?.status).toBe('DETECTED');
    expect(h.store.storedClaimCount()).toBe(beforeClaims);
    expect(h.store.listHistory()).toHaveLength(beforeHistory);
  });

  it('malformed Claim / Verification / Evidence / history fail closed', () => {
    const kv = memoryKv();
    kv.setItem(
      CLAIM_CURRENT_STORE_KEY,
      JSON.stringify({
        schemaVersion: CLAIM_CURRENT_STORE_SCHEMA,
        claims: [{ id: 'bad', organizationId: 'org_a' }],
      })
    );
    expectPersistenceError(() =>
      createLocalClaimEvidenceStore(kv).getClaimById('bad', TRUSTED)
    );

    const kv2 = memoryKv();
    const store2 = createLocalClaimEvidenceStore(kv2);
    store2.resetForTest();
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
    expectPersistenceError(() =>
      createLocalClaimEvidenceStore(kv2).getVerificationById('v1', TRUSTED)
    );

    const kv3 = memoryKv();
    kv3.setItem(
      CLAIM_HISTORY_STORE_KEY,
      JSON.stringify({
        schemaVersion: CLAIM_HISTORY_STORE_SCHEMA,
        entries: [{ id: 'h1', event: 'NOPE' }],
      })
    );
    expectPersistenceError(() => createLocalClaimEvidenceStore(kv3).listHistory());
  });

  it('legacy vault verified=true does not auto-verify; EvidenceReader maps provenance only', () => {
    const item = vaultItem({ verified: true, verifiedAt: NOW });
    const mapped = mapVaultItemToClaimEvidence(item);
    expect(mapped.source.sourceUrl).toBe(item.sourceUrl);
    expect(mapped).not.toHaveProperty('verified');

    const h = buildPhase3({ vault: { vault_ev_1: item } });
    const reader = new LocalEvidenceVaultAdapter(h.store, {
      getById: (id) => (id === 'vault_ev_1' ? item : undefined),
    });
    const evidence = reader.getById('vault_ev_1', TRUSTED);
    expect(evidence?.id).toBe('vault_ev_1');
    expect(h.store.storedVerificationCount()).toBe(0);
    expect(h.store.getClaimById('anything', TRUSTED)).toBeUndefined();
  });

  it('foreign vault evidence returns undefined without metadata leak', () => {
    const item = vaultItem({ organizationId: 'org_b', clientId: 'client_b' });
    const h = buildPhase3({ vault: { vault_ev_1: item } });
    const reader = new LocalEvidenceVaultAdapter(h.store, {
      getById: (id) => (id === 'vault_ev_1' ? item : undefined),
    });
    expect(reader.getById('vault_ev_1', TRUSTED)).toBeUndefined();
  });

  it('stale Verification cannot authorize materially changed Claim', () => {
    const contents: Record<string, ClaimContentContext> = {
      content_1: content({ contentHash: 'hash_a' }),
    };
    const h = buildPhase3({ contents });
    h.evidenceWriter.put(makeCanonicalEvidence('ev_1'));
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
      ruleId: 'rule_credential',
      ruleVersion: '1',
      invocation: { kind: 'HUMAN' },
    });
    expect(
      h.authorize({
        trusted: TRUSTED,
        contentId: 'content_1',
        targetContentStatus: 'READY',
      }).decision.result
    ).toBe('PASS');

    // Material content change: new hash on content context; Claim still hash_a until re-registered.
    // Replace claim material by registering a new claim identity on new hash content.
    contents.content_1 = content({ contentHash: 'hash_b' });
    h.register({
      trusted: { ...TRUSTED, now: LATER },
      claimId: 'claim_2',
      contentId: 'content_1',
      text: 'Managing Partner at Acme Revised',
      kind: 'CREDENTIAL',
    });
    // Old verification for claim_1 still stored but claim_2 has no PASS verification.
    const decision = h.authorize({
      trusted: TRUSTED,
      contentId: 'content_1',
      targetContentStatus: 'READY',
    });
    expect(decision.decision.result).not.toBe('PASS');
    expect(h.store.getVerificationById('ver_1', TRUSTED)?.contentHash).toBe('hash_a');
    expect(
      new LocalVerificationStore(h.store).findByClaimAndHash('claim_2', TRUSTED, 'hash_b')
    ).toBeUndefined();
  });

  it('material Claim revision does not re-bind old Verification to new hash', () => {
    const h = buildPhase3();
    h.evidenceWriter.put(makeCanonicalEvidence('ev_1'));
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
      ruleId: 'rule_credential',
      ruleVersion: '1',
      invocation: { kind: 'HUMAN' },
    });
    const verifications = new LocalVerificationStore(h.store);
    expect(verifications.findByClaimAndHash('claim_1', TRUSTED, 'hash_a')?.id).toBe('ver_1');
    expect(verifications.findByClaimAndHash('claim_1', TRUSTED, 'hash_b')).toBeUndefined();
    // Latest exists but Application AuthorizePublication filters by current content hash.
    expect(verifications.getLatestForClaim('claim_1', TRUSTED)?.contentHash).toBe('hash_a');
  });

  it('current/history separation: history does not authorize publication', () => {
    const h = buildPhase3();
    h.evidenceWriter.put(makeCanonicalEvidence('ev_1'));
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    // Inject a history PASS-looking event without current VERIFIED claim.
    h.store.appendHistory({
      id: 'hist_fake_pass',
      organizationId: 'org_a',
      clientId: 'client_a',
      claimId: 'claim_1',
      event: 'PUBLICATION_AUTHORIZED',
      actorId: 'admin_1',
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
      }).decision.result
    ).not.toBe('PASS');
  });

  it('SOFTWARE actorType string in storage is not an Application bypass path', () => {
    const h = buildPhase3();
    h.evidenceWriter.put(makeCanonicalEvidence('ev_1'));
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
        summary: 'software',
        ruleId: 'rule_credential',
        ruleVersion: '1',
        invocation: { kind: 'SOFTWARE' },
        claimedActorType: 'SOFTWARE',
      })
    ).toThrow(ClaimEvidenceError);
    expect(h.store.storedVerificationCount()).toBe(0);
  });

  it('tenant-invalid write unit creates no current / verification / history writes', () => {
    const h = buildPhase3();
    h.register({
      trusted: TRUSTED,
      claimId: 'claim_1',
      contentId: 'content_1',
      text: 'Managing Partner at Acme',
      kind: 'CREDENTIAL',
    });
    const repo = new LocalClaimRepository(h.store);
    const beforeH = h.store.listHistory().length;
    const beforeC = h.store.storedClaimCount();
    expect(() =>
      repo.commitWriteUnit({
        claims: [
          {
            ...h.store.getClaimById('claim_1', TRUSTED)!,
            organizationId: 'org_b',
          },
        ],
        history: [
          {
            id: 'bad_hist',
            organizationId: 'org_a',
            clientId: 'client_a',
            claimId: 'claim_1',
            event: 'CLAIM_REGISTERED',
            actorId: 'x',
            at: NOW,
          },
        ],
      })
    ).toThrow(ClaimEvidenceError);
    expect(h.store.storedClaimCount()).toBe(beforeC);
    expect(h.store.listHistory()).toHaveLength(beforeH);
    expect(h.store.getClaimById('claim_1', TRUSTED)?.organizationId).toBe('org_a');
  });

  it('legacy claimSafety PASS is not synthesized into Verification', () => {
    const h = buildPhase3();
    // No path from claimSafety → Verification in Phase 3 adapters.
    expect(h.store.storedVerificationCount()).toBe(0);
    expect(mapVaultItemToClaimEvidence(vaultItem({ verified: true })).schemaVersion).toBe(
      'evidence-v1'
    );
  });
});
