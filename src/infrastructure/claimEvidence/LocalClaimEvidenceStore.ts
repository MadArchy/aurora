import { ClaimEvidenceError } from '../../application/claimEvidence/errors';
import type { ClaimWriteUnit } from '../../application/claimEvidence';
import type { ClaimHistoryRecord } from '../../application/claimEvidence/ports/ClaimHistoryPort';
import type { Claim } from '../../domain/claimCore';
import type { ClaimEvidenceLink } from '../../domain/claimLinkCore';
import type { ClaimOverrideRecord } from '../../domain/claimOverrideCore';
import type { ClaimVerification } from '../../domain/claimVerificationCore';
import type { ClaimEvidence } from '../../domain/evidenceCore';
import { persistenceError, rethrowGoverned } from './persistenceErrors';
import {
  cloneJson,
  historyIdentity,
  linkIdentity,
  linkLookupKey,
  overrideIdentity,
  parseStoredClaim,
  parseStoredEvidence,
  parseStoredHistory,
  parseStoredLink,
  parseStoredOverride,
  parseStoredVerification,
  peekId,
  peekTenant,
  tenantEntityKey,
} from './serialization';
import {
  CLAIM_CURRENT_STORE_KEY,
  CLAIM_CURRENT_STORE_SCHEMA,
  CLAIM_EVIDENCE_STORE_KEY,
  CLAIM_EVIDENCE_STORE_SCHEMA,
  CLAIM_HISTORY_STORE_KEY,
  CLAIM_HISTORY_STORE_SCHEMA,
  CLAIM_LINK_STORE_KEY,
  CLAIM_LINK_STORE_SCHEMA,
  CLAIM_OVERRIDE_STORE_KEY,
  CLAIM_OVERRIDE_STORE_SCHEMA,
  CLAIM_VERIFICATION_STORE_KEY,
  CLAIM_VERIFICATION_STORE_SCHEMA,
} from './storeKeys';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoreSnapshot {
  claims: Map<string, unknown>;
  links: Map<string, unknown>;
  verifications: Map<string, unknown>;
  evidence: Map<string, unknown>;
  history: unknown[];
  overrides: unknown[];
}

function memoryStorage(): StorageLike {
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

function resolveStorage(explicit?: StorageLike): StorageLike {
  if (explicit) return explicit;
  const globalStore = (globalThis as { localStorage?: StorageLike }).localStorage;
  return globalStore ?? memoryStorage();
}

/**
 * Local-authoritative Claim / link / verification / evidence / history store.
 * One coherent in-memory mutation + one persist of versioned keys.
 * This is not a distributed Firestore transaction.
 *
 * Storage keys are tenant-scoped: organizationId|clientId|entityId.
 */
export class LocalClaimEvidenceStore {
  private loaded = false;
  private claims = new Map<string, unknown>();
  private links = new Map<string, unknown>();
  private verifications = new Map<string, unknown>();
  private evidence = new Map<string, unknown>();
  private history: unknown[] = [];
  private overrides: unknown[] = [];

  /** Test-only: throw after applying in-memory mutation, before persist. */
  failBeforePersistForTest = false;

  constructor(private readonly kv: StorageLike = resolveStorage()) {}

  /** Test-only reset. Not part of production ports. */
  resetForTest(): void {
    this.claims = new Map();
    this.links = new Map();
    this.verifications = new Map();
    this.evidence = new Map();
    this.history = [];
    this.overrides = [];
    this.loaded = true;
    this.failBeforePersistForTest = false;
    try {
      this.kv.removeItem(CLAIM_CURRENT_STORE_KEY);
      this.kv.removeItem(CLAIM_LINK_STORE_KEY);
      this.kv.removeItem(CLAIM_VERIFICATION_STORE_KEY);
      this.kv.removeItem(CLAIM_EVIDENCE_STORE_KEY);
      this.kv.removeItem(CLAIM_HISTORY_STORE_KEY);
      this.kv.removeItem(CLAIM_OVERRIDE_STORE_KEY);
    } catch (err) {
      rethrowGoverned(err);
    }
  }

  getClaimById(claimId: string, tenant: { organizationId: string; clientId: string }): Claim | undefined {
    this.ensureLoaded();
    const raw = this.claims.get(tenantEntityKey(tenant.organizationId, tenant.clientId, claimId));
    if (!raw) return undefined;
    const peeked = peekTenant(raw);
    if (!peeked) {
      throw persistenceError('Malformed persisted Claim.');
    }
    if (peeked.organizationId !== tenant.organizationId || peeked.clientId !== tenant.clientId) {
      return undefined;
    }
    return parseStoredClaim(raw);
  }

  findClaimsByContent(
    tenant: { organizationId: string; clientId: string },
    contentId: string
  ): Claim[] {
    this.ensureLoaded();
    const results: Claim[] = [];
    for (const raw of this.claims.values()) {
      const peeked = peekTenant(raw);
      if (!peeked) {
        const id = peekId(raw);
        if (id) throw persistenceError('Malformed persisted Claim.');
        continue;
      }
      if (peeked.organizationId !== tenant.organizationId || peeked.clientId !== tenant.clientId) {
        continue;
      }
      const claim = parseStoredClaim(raw);
      if (claim.contentId === contentId) results.push(claim);
    }
    return results;
  }

  findClaimByContentHash(
    tenant: { organizationId: string; clientId: string },
    contentId: string,
    contentHash: string,
    text: string,
    kind: string
  ): Claim | undefined {
    this.ensureLoaded();
    for (const raw of this.claims.values()) {
      const peeked = peekTenant(raw);
      if (!peeked) continue;
      if (peeked.organizationId !== tenant.organizationId || peeked.clientId !== tenant.clientId) {
        continue;
      }
      const claim = parseStoredClaim(raw);
      if (
        claim.contentId === contentId &&
        claim.contentHash === contentHash &&
        claim.text === text &&
        claim.kind === kind
      ) {
        return claim;
      }
    }
    return undefined;
  }

  getLink(
    tenant: { organizationId: string; clientId: string },
    claimId: string,
    evidenceId: string
  ): ClaimEvidenceLink | undefined {
    this.ensureLoaded();
    const raw = this.links.get(
      linkLookupKey(tenant.organizationId, tenant.clientId, claimId, evidenceId)
    );
    if (!raw) return undefined;
    const link = parseStoredLink(raw);
    if (link.organizationId !== tenant.organizationId || link.clientId !== tenant.clientId) {
      return undefined;
    }
    return link;
  }

  listLinksForClaim(
    tenant: { organizationId: string; clientId: string },
    claimId: string
  ): ClaimEvidenceLink[] {
    this.ensureLoaded();
    const results: ClaimEvidenceLink[] = [];
    for (const raw of this.links.values()) {
      const link = parseStoredLink(raw);
      if (
        link.claimId === claimId &&
        link.organizationId === tenant.organizationId &&
        link.clientId === tenant.clientId
      ) {
        results.push(link);
      }
    }
    return results;
  }

  getVerificationById(
    verificationId: string,
    tenant: { organizationId: string; clientId: string }
  ): ClaimVerification | undefined {
    this.ensureLoaded();
    const raw = this.verifications.get(
      tenantEntityKey(tenant.organizationId, tenant.clientId, verificationId)
    );
    if (!raw) return undefined;
    const peeked = peekTenant(raw);
    if (!peeked) {
      throw persistenceError('Malformed persisted ClaimVerification.');
    }
    if (peeked.organizationId !== tenant.organizationId || peeked.clientId !== tenant.clientId) {
      return undefined;
    }
    return parseStoredVerification(raw);
  }

  getLatestVerificationForClaim(
    claimId: string,
    tenant: { organizationId: string; clientId: string }
  ): ClaimVerification | undefined {
    this.ensureLoaded();
    const list: ClaimVerification[] = [];
    for (const raw of this.verifications.values()) {
      const peeked = peekTenant(raw);
      if (!peeked) continue;
      if (peeked.organizationId !== tenant.organizationId || peeked.clientId !== tenant.clientId) {
        continue;
      }
      const verification = parseStoredVerification(raw);
      if (verification.claimId === claimId) list.push(verification);
    }
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return list[list.length - 1];
  }

  findVerificationByClaimAndHash(
    claimId: string,
    tenant: { organizationId: string; clientId: string },
    contentHash: string
  ): ClaimVerification | undefined {
    this.ensureLoaded();
    for (const raw of this.verifications.values()) {
      const peeked = peekTenant(raw);
      if (!peeked) continue;
      if (peeked.organizationId !== tenant.organizationId || peeked.clientId !== tenant.clientId) {
        continue;
      }
      const verification = parseStoredVerification(raw);
      if (verification.claimId === claimId && verification.contentHash === contentHash) {
        return verification;
      }
    }
    return undefined;
  }

  getEvidenceById(
    evidenceId: string,
    tenant: { organizationId: string; clientId: string }
  ): ClaimEvidence | undefined {
    this.ensureLoaded();
    const raw = this.evidence.get(
      tenantEntityKey(tenant.organizationId, tenant.clientId, evidenceId)
    );
    if (!raw) return undefined;
    const peeked = peekTenant(raw);
    if (!peeked) {
      throw persistenceError('Malformed persisted ClaimEvidence.');
    }
    if (peeked.organizationId !== tenant.organizationId || peeked.clientId !== tenant.clientId) {
      return undefined;
    }
    return parseStoredEvidence(raw);
  }

  /**
   * Tenant-safe local evidence upsert (EvidenceWriter infrastructure path).
   * Does not synthesize Verification authority from vault `verified`.
   */
  putEvidence(evidence: ClaimEvidence): void {
    this.commitWriteUnit({
      claims: [],
      history: [],
      evidenceWrites: [evidence],
    });
  }

  commitWriteUnit(
    unit: ClaimWriteUnit & { evidenceWrites?: ClaimEvidence[] }
  ): void {
    this.ensureLoaded();
    const snapshot = this.snapshot();
    try {
      this.assertWriteUnitEnvelope(unit);
      this.applyWriteUnit(unit);
      if (this.failBeforePersistForTest) {
        throw persistenceError('Injected persist failure.');
      }
      this.persistAll();
    } catch (err) {
      this.restore(snapshot);
      try {
        this.persistAll();
      } catch {
        // Rollback persist is best-effort; in-memory already restored.
      }
      rethrowGoverned(err);
    }
  }

  appendHistory(entry: ClaimHistoryRecord): void {
    this.commitWriteUnit({ claims: [], history: [entry] });
  }

  appendOverride(record: ClaimOverrideRecord): void {
    this.commitWriteUnit({ claims: [], history: [], overrideAudit: record });
  }

  /** Test/inspection helper — not a production port. */
  listHistory(): ClaimHistoryRecord[] {
    this.ensureLoaded();
    return this.history.map((entry) => parseStoredHistory(entry));
  }

  /** Test/inspection helper — not a production port. */
  listOverrides(): ClaimOverrideRecord[] {
    this.ensureLoaded();
    return this.overrides.map((entry) => parseStoredOverride(entry));
  }

  storedClaimCount(): number {
    this.ensureLoaded();
    return this.claims.size;
  }

  storedVerificationCount(): number {
    this.ensureLoaded();
    return this.verifications.size;
  }

  storedLinkCount(): number {
    this.ensureLoaded();
    return this.links.size;
  }

  storedEvidenceCount(): number {
    this.ensureLoaded();
    return this.evidence.size;
  }

  private snapshot(): StoreSnapshot {
    return {
      claims: new Map(this.claims),
      links: new Map(this.links),
      verifications: new Map(this.verifications),
      evidence: new Map(this.evidence),
      history: [...this.history],
      overrides: [...this.overrides],
    };
  }

  private restore(snapshot: StoreSnapshot): void {
    this.claims = snapshot.claims;
    this.links = snapshot.links;
    this.verifications = snapshot.verifications;
    this.evidence = snapshot.evidence;
    this.history = snapshot.history;
    this.overrides = snapshot.overrides;
  }

  private applyWriteUnit(unit: ClaimWriteUnit & { evidenceWrites?: ClaimEvidence[] }): void {
    for (const claim of unit.claims) {
      this.claims.set(
        tenantEntityKey(claim.organizationId, claim.clientId, claim.id),
        cloneJson(claim)
      );
    }
    for (const link of unit.links ?? []) {
      this.putLink(link);
    }
    for (const verification of unit.verifications ?? []) {
      this.verifications.set(
        tenantEntityKey(verification.organizationId, verification.clientId, verification.id),
        cloneJson(verification)
      );
    }
    for (const evidence of unit.evidenceWrites ?? []) {
      this.evidence.set(
        tenantEntityKey(evidence.organizationId, evidence.clientId, evidence.id),
        cloneJson(evidence)
      );
    }
    for (const entry of unit.history) {
      this.appendHistoryRecord(entry);
    }
    if (unit.overrideAudit) {
      this.appendOverrideRecord(unit.overrideAudit);
    }
  }

  private putLink(link: ClaimEvidenceLink): void {
    const existing = this.getLink(
      { organizationId: link.organizationId, clientId: link.clientId },
      link.claimId,
      link.evidenceId
    );
    if (existing && linkIdentity(existing) === linkIdentity(link)) {
      return;
    }
    if (existing && linkIdentity(existing) !== linkIdentity(link)) {
      throw new ClaimEvidenceError(
        'CLAIM_CONFLICT',
        'ClaimEvidenceLink identity conflict for claim/evidence pair.'
      );
    }
    this.links.set(
      linkLookupKey(link.organizationId, link.clientId, link.claimId, link.evidenceId),
      cloneJson(link)
    );
  }

  private appendHistoryRecord(entry: ClaimHistoryRecord): void {
    const identity = historyIdentity(entry);
    const exists = this.history.some((raw) => historyIdentity(parseStoredHistory(raw)) === identity);
    if (exists) return;
    this.history.push(cloneJson(entry));
  }

  private appendOverrideRecord(record: ClaimOverrideRecord): void {
    const identity = overrideIdentity(record);
    const exists = this.overrides.some(
      (raw) => overrideIdentity(parseStoredOverride(raw)) === identity
    );
    if (exists) return;
    this.overrides.push(cloneJson(record));
  }

  private assertWriteUnitEnvelope(
    unit: ClaimWriteUnit & { evidenceWrites?: ClaimEvidence[] }
  ): void {
    const entities: Array<{ organizationId: string; clientId: string; claimId?: string }> = [];
    for (const claim of unit.claims) {
      entities.push({
        organizationId: claim.organizationId,
        clientId: claim.clientId,
        claimId: claim.id,
      });
    }
    for (const link of unit.links ?? []) {
      entities.push({
        organizationId: link.organizationId,
        clientId: link.clientId,
        claimId: link.claimId,
      });
    }
    for (const verification of unit.verifications ?? []) {
      entities.push({
        organizationId: verification.organizationId,
        clientId: verification.clientId,
        claimId: verification.claimId,
      });
    }
    for (const evidence of unit.evidenceWrites ?? []) {
      entities.push({
        organizationId: evidence.organizationId,
        clientId: evidence.clientId,
      });
    }
    for (const entry of unit.history) {
      entities.push({
        organizationId: entry.organizationId,
        clientId: entry.clientId,
        claimId: entry.claimId,
      });
    }
    if (unit.overrideAudit) {
      entities.push({
        organizationId: unit.overrideAudit.organizationId,
        clientId: unit.overrideAudit.clientId,
        claimId: unit.overrideAudit.claimId,
      });
    }
    if (entities.length === 0) return;

    const org = entities[0].organizationId;
    const client = entities[0].clientId;
    if (!org || !client) {
      throw new ClaimEvidenceError('TENANT_CONTEXT_INVALID', 'Write unit tenant envelope is required.');
    }
    for (const entity of entities) {
      if (entity.organizationId !== org || entity.clientId !== client) {
        throw new ClaimEvidenceError(
          'TENANT_CONTEXT_INVALID',
          'Write unit entities disagree on tenant identity.'
        );
      }
    }

    const unitClaims = new Map(unit.claims.map((claim) => [claim.id, claim]));
    for (const claim of unit.claims) {
      const key = tenantEntityKey(claim.organizationId, claim.clientId, claim.id);
      const existingRaw = this.claims.get(key);
      if (!existingRaw) continue;
      const existing = peekTenant(existingRaw);
      if (!existing) {
        throw persistenceError('Malformed persisted Claim.');
      }
      if (existing.organizationId !== claim.organizationId || existing.clientId !== claim.clientId) {
        throw new ClaimEvidenceError(
          'TENANT_CONTEXT_INVALID',
          'Write unit tenant does not match stored Claim ownership.'
        );
      }
    }

    for (const verification of unit.verifications ?? []) {
      const claim =
        unitClaims.get(verification.claimId) ??
        this.getClaimById(verification.claimId, {
          organizationId: verification.organizationId,
          clientId: verification.clientId,
        });
      if (!claim) {
        throw new ClaimEvidenceError(
          'TENANT_CONTEXT_INVALID',
          'Write unit verification does not match Claim ownership.'
        );
      }
      if (
        claim.organizationId !== verification.organizationId ||
        claim.clientId !== verification.clientId
      ) {
        throw new ClaimEvidenceError(
          'TENANT_CONTEXT_INVALID',
          'Write unit verification tenant does not match Claim.'
        );
      }
    }

    const historyAndAudit = [
      ...unit.history.map((entry) => ({
        claimId: entry.claimId,
        organizationId: entry.organizationId,
        clientId: entry.clientId,
      })),
      ...(unit.overrideAudit
        ? [
            {
              claimId: unit.overrideAudit.claimId,
              organizationId: unit.overrideAudit.organizationId,
              clientId: unit.overrideAudit.clientId,
            },
          ]
        : []),
    ];
    for (const ref of historyAndAudit) {
      const inUnit = unitClaims.get(ref.claimId);
      if (inUnit) {
        if (inUnit.organizationId !== ref.organizationId || inUnit.clientId !== ref.clientId) {
          throw new ClaimEvidenceError(
            'TENANT_CONTEXT_INVALID',
            'Write unit history does not match Claim ownership.'
          );
        }
        continue;
      }
      const existing = this.getClaimById(ref.claimId, {
        organizationId: ref.organizationId,
        clientId: ref.clientId,
      });
      if (!existing) {
        throw new ClaimEvidenceError(
          'TENANT_CONTEXT_INVALID',
          'Write unit history does not match Claim ownership.'
        );
      }
    }
  }

  private persistAll(): void {
    const current = {
      schemaVersion: CLAIM_CURRENT_STORE_SCHEMA,
      claims: [...this.claims.values()],
    };
    const links = {
      schemaVersion: CLAIM_LINK_STORE_SCHEMA,
      links: [...this.links.values()],
    };
    const verifications = {
      schemaVersion: CLAIM_VERIFICATION_STORE_SCHEMA,
      verifications: [...this.verifications.values()],
    };
    const evidence = {
      schemaVersion: CLAIM_EVIDENCE_STORE_SCHEMA,
      evidence: [...this.evidence.values()],
    };
    const history = {
      schemaVersion: CLAIM_HISTORY_STORE_SCHEMA,
      entries: this.history,
    };
    const overrides = {
      schemaVersion: CLAIM_OVERRIDE_STORE_SCHEMA,
      records: this.overrides,
    };
    try {
      this.kv.setItem(CLAIM_CURRENT_STORE_KEY, JSON.stringify(current));
      this.kv.setItem(CLAIM_LINK_STORE_KEY, JSON.stringify(links));
      this.kv.setItem(CLAIM_VERIFICATION_STORE_KEY, JSON.stringify(verifications));
      this.kv.setItem(CLAIM_EVIDENCE_STORE_KEY, JSON.stringify(evidence));
      this.kv.setItem(CLAIM_HISTORY_STORE_KEY, JSON.stringify(history));
      this.kv.setItem(CLAIM_OVERRIDE_STORE_KEY, JSON.stringify(overrides));
    } catch (err) {
      rethrowGoverned(err);
    }
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.claims = new Map();
    this.links = new Map();
    this.verifications = new Map();
    this.evidence = new Map();
    this.history = this.readEnvelope(
      CLAIM_HISTORY_STORE_KEY,
      CLAIM_HISTORY_STORE_SCHEMA,
      'entries'
    );
    this.overrides = this.readEnvelope(
      CLAIM_OVERRIDE_STORE_KEY,
      CLAIM_OVERRIDE_STORE_SCHEMA,
      'records'
    );
    for (const raw of this.readEnvelope(
      CLAIM_CURRENT_STORE_KEY,
      CLAIM_CURRENT_STORE_SCHEMA,
      'claims'
    )) {
      const claim = parseStoredClaim(raw);
      this.claims.set(
        tenantEntityKey(claim.organizationId, claim.clientId, claim.id),
        raw
      );
    }
    for (const raw of this.readEnvelope(CLAIM_LINK_STORE_KEY, CLAIM_LINK_STORE_SCHEMA, 'links')) {
      const link = parseStoredLink(raw);
      this.links.set(
        linkLookupKey(link.organizationId, link.clientId, link.claimId, link.evidenceId),
        raw
      );
    }
    for (const raw of this.readEnvelope(
      CLAIM_VERIFICATION_STORE_KEY,
      CLAIM_VERIFICATION_STORE_SCHEMA,
      'verifications'
    )) {
      const verification = parseStoredVerification(raw);
      this.verifications.set(
        tenantEntityKey(verification.organizationId, verification.clientId, verification.id),
        raw
      );
    }
    for (const raw of this.readEnvelope(
      CLAIM_EVIDENCE_STORE_KEY,
      CLAIM_EVIDENCE_STORE_SCHEMA,
      'evidence'
    )) {
      const evidence = parseStoredEvidence(raw);
      this.evidence.set(
        tenantEntityKey(evidence.organizationId, evidence.clientId, evidence.id),
        raw
      );
    }
    this.loaded = true;
  }

  private readEnvelope(key: string, expectedSchema: string, collectionField: string): unknown[] {
    let raw: string | null;
    try {
      raw = this.kv.getItem(key);
    } catch (err) {
      rethrowGoverned(err);
    }
    if (!raw) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw persistenceError('Malformed persisted Claim Evidence store.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw persistenceError('Malformed persisted Claim Evidence store.');
    }
    const envelope = parsed as Record<string, unknown>;
    if (envelope.schemaVersion !== expectedSchema) {
      throw persistenceError('Malformed persisted Claim Evidence store.');
    }
    const collection = envelope[collectionField];
    if (!Array.isArray(collection)) {
      throw persistenceError('Malformed persisted Claim Evidence store.');
    }
    return collection;
  }
}

export function createLocalClaimEvidenceStore(kv?: StorageLike): LocalClaimEvidenceStore {
  return new LocalClaimEvidenceStore(kv);
}
