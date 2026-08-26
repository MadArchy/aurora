/**
 * SPEC-007 Phase 3 — Local-authoritative Opportunity Scout store.
 *
 * Guarantee: one coherent in-memory mutation + persist of versioned keys.
 * Not a distributed Firestore transaction / not cryptographically append-only.
 * On failure after mutation, in-memory state is restored (best-effort re-persist).
 */

import { OpportunityApplicationError } from '../../application/opportunityScout/errors';
import type { OpportunityWriteUnit } from '../../application/opportunityScout/ports/OpportunityCandidateRepository';
import type { OpportunityHistoryRecord } from '../../application/opportunityScout/ports/OpportunityHistoryPort';
import type { OpportunityCandidate } from '../../domain/opportunityCandidateCore';
import type { MaterializedOpportunity } from '../../domain/opportunityCore';
import { persistenceError, rethrowGoverned } from './persistenceErrors';
import {
  cloneJson,
  historyIdentity,
  idempotencyLookupKey,
  parseStoredCandidate,
  parseStoredHistory,
  parseStoredIdempotency,
  parseStoredOpportunity,
  peekId,
  peekTenant,
  tenantEntityKey,
} from './serialization';
import {
  CANDIDATE_STORE_SCHEMA,
  OPPORTUNITY_CANDIDATE_STORE_KEY,
  OPPORTUNITY_CURRENT_STORE_KEY,
  OPPORTUNITY_HISTORY_STORE_KEY,
  OPPORTUNITY_HISTORY_STORE_SCHEMA,
  OPPORTUNITY_IDEMPOTENCY_STORE_KEY,
  OPPORTUNITY_IDEMPOTENCY_STORE_SCHEMA,
  OPPORTUNITY_STORE_SCHEMA,
} from './storeKeys';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoreSnapshot {
  candidates: Map<string, unknown>;
  opportunities: Map<string, unknown>;
  history: unknown[];
  idempotency: Map<string, unknown>;
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

export class LocalOpportunityScoutStore {
  private loaded = false;
  private candidates = new Map<string, unknown>();
  private opportunities = new Map<string, unknown>();
  private history: unknown[] = [];
  private idempotency = new Map<string, unknown>();

  /** Test-only: throw after applying in-memory mutation, before persist. */
  failBeforePersistForTest = false;

  constructor(private readonly kv: StorageLike = resolveStorage()) {}

  resetForTest(): void {
    this.candidates = new Map();
    this.opportunities = new Map();
    this.history = [];
    this.idempotency = new Map();
    this.loaded = true;
    this.failBeforePersistForTest = false;
    try {
      this.kv.removeItem(OPPORTUNITY_CANDIDATE_STORE_KEY);
      this.kv.removeItem(OPPORTUNITY_CURRENT_STORE_KEY);
      this.kv.removeItem(OPPORTUNITY_HISTORY_STORE_KEY);
      this.kv.removeItem(OPPORTUNITY_IDEMPOTENCY_STORE_KEY);
    } catch (err) {
      rethrowGoverned(err);
    }
  }

  getCandidate(
    candidateId: string,
    tenant: { organizationId: string; clientId: string }
  ): OpportunityCandidate | undefined {
    this.ensureLoaded();
    const raw = this.candidates.get(
      tenantEntityKey(tenant.organizationId, tenant.clientId, candidateId)
    );
    if (!raw) return undefined;
    const peeked = peekTenant(raw);
    if (!peeked) throw persistenceError('Malformed persisted OpportunityCandidate.');
    if (
      peeked.organizationId !== tenant.organizationId ||
      peeked.clientId !== tenant.clientId
    ) {
      return undefined;
    }
    return parseStoredCandidate(raw);
  }

  listCandidates(tenant: {
    organizationId: string;
    clientId: string;
  }): OpportunityCandidate[] {
    this.ensureLoaded();
    const results: OpportunityCandidate[] = [];
    for (const raw of this.candidates.values()) {
      const peeked = peekTenant(raw);
      if (!peeked) {
        if (peekId(raw)) throw persistenceError('Malformed persisted OpportunityCandidate.');
        continue;
      }
      if (
        peeked.organizationId !== tenant.organizationId ||
        peeked.clientId !== tenant.clientId
      ) {
        continue;
      }
      results.push(parseStoredCandidate(raw));
    }
    return results;
  }

  getOpportunity(
    opportunityId: string,
    tenant: { organizationId: string; clientId: string }
  ): MaterializedOpportunity | undefined {
    this.ensureLoaded();
    const raw = this.opportunities.get(
      tenantEntityKey(tenant.organizationId, tenant.clientId, opportunityId)
    );
    if (!raw) return undefined;
    const peeked = peekTenant(raw);
    if (!peeked) throw persistenceError('Malformed persisted MaterializedOpportunity.');
    if (
      peeked.organizationId !== tenant.organizationId ||
      peeked.clientId !== tenant.clientId
    ) {
      return undefined;
    }
    return parseStoredOpportunity(raw);
  }

  listOpportunities(tenant: {
    organizationId: string;
    clientId: string;
  }): MaterializedOpportunity[] {
    this.ensureLoaded();
    const results: MaterializedOpportunity[] = [];
    for (const raw of this.opportunities.values()) {
      const peeked = peekTenant(raw);
      if (!peeked) {
        if (peekId(raw)) throw persistenceError('Malformed persisted MaterializedOpportunity.');
        continue;
      }
      if (
        peeked.organizationId !== tenant.organizationId ||
        peeked.clientId !== tenant.clientId
      ) {
        continue;
      }
      results.push(parseStoredOpportunity(raw));
    }
    return results;
  }

  findByIdempotencyKey(
    tenant: { organizationId: string; clientId: string },
    key: string
  ):
    | { aggregateKind: 'CANDIDATE'; candidateId: string }
    | { aggregateKind: 'OPPORTUNITY'; opportunityId: string }
    | undefined {
    this.ensureLoaded();
    const lookup = idempotencyLookupKey(tenant.organizationId, tenant.clientId, key);
    const raw = this.idempotency.get(lookup);
    if (!raw) return undefined;
    const record = parseStoredIdempotency(raw);
    if (
      record.organizationId !== tenant.organizationId ||
      record.clientId !== tenant.clientId
    ) {
      return undefined;
    }
    if (record.aggregateKind === 'CANDIDATE') {
      return { aggregateKind: 'CANDIDATE', candidateId: record.aggregateId };
    }
    return { aggregateKind: 'OPPORTUNITY', opportunityId: record.aggregateId };
  }

  commitWriteUnit(unit: OpportunityWriteUnit): void {
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

  appendHistory(entry: OpportunityHistoryRecord): void {
    this.commitWriteUnit({ history: [entry] });
  }

  /** Test/inspection — not current authority. */
  listHistory(): OpportunityHistoryRecord[] {
    this.ensureLoaded();
    return this.history.map((entry) => parseStoredHistory(entry));
  }

  storedCandidateCount(): number {
    this.ensureLoaded();
    return this.candidates.size;
  }

  storedOpportunityCount(): number {
    this.ensureLoaded();
    return this.opportunities.size;
  }

  private snapshot(): StoreSnapshot {
    return {
      candidates: new Map(this.candidates),
      opportunities: new Map(this.opportunities),
      history: [...this.history],
      idempotency: new Map(this.idempotency),
    };
  }

  private restore(snapshot: StoreSnapshot): void {
    this.candidates = snapshot.candidates;
    this.opportunities = snapshot.opportunities;
    this.history = snapshot.history;
    this.idempotency = snapshot.idempotency;
  }

  private applyWriteUnit(unit: OpportunityWriteUnit): void {
    for (const candidate of unit.candidates ?? []) {
      const key = tenantEntityKey(
        candidate.organizationId,
        candidate.clientId,
        candidate.id
      );
      this.candidates.set(key, cloneJson(candidate));
    }
    for (const opportunity of unit.opportunities ?? []) {
      const key = tenantEntityKey(
        opportunity.organizationId,
        opportunity.clientId,
        opportunity.id
      );
      this.opportunities.set(key, cloneJson(opportunity));
    }
    for (const entry of unit.history) {
      this.appendHistoryRecord(entry);
    }
    for (const record of unit.idempotencyKeys ?? []) {
      const lookup = idempotencyLookupKey(
        record.organizationId,
        record.clientId,
        record.key
      );
      const existing = this.idempotency.get(lookup);
      if (existing) {
        const parsed = parseStoredIdempotency(existing);
        if (
          parsed.aggregateKind !== record.aggregateKind ||
          parsed.aggregateId !== record.aggregateId
        ) {
          throw new OpportunityApplicationError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key already bound to a different aggregate.'
          );
        }
        continue;
      }
      this.idempotency.set(lookup, cloneJson(record));
    }
  }

  private appendHistoryRecord(entry: OpportunityHistoryRecord): void {
    const identity = historyIdentity(entry);
    const exists = this.history.some(
      (raw) => historyIdentity(parseStoredHistory(raw)) === identity
    );
    if (exists) return;
    this.history.push(cloneJson(entry));
  }

  private assertWriteUnitEnvelope(unit: OpportunityWriteUnit): void {
    const entities: Array<{ organizationId: string; clientId: string }> = [];
    for (const c of unit.candidates ?? []) {
      entities.push({ organizationId: c.organizationId, clientId: c.clientId });
    }
    for (const o of unit.opportunities ?? []) {
      entities.push({ organizationId: o.organizationId, clientId: o.clientId });
    }
    for (const h of unit.history) {
      entities.push({ organizationId: h.organizationId, clientId: h.clientId });
    }
    for (const k of unit.idempotencyKeys ?? []) {
      entities.push({ organizationId: k.organizationId, clientId: k.clientId });
    }
    if (entities.length === 0) return;

    const org = entities[0].organizationId;
    const client = entities[0].clientId;
    if (!org || !client) {
      throw new OpportunityApplicationError(
        'TENANT_MISMATCH',
        'Write unit tenant envelope is required.'
      );
    }
    for (const entity of entities) {
      if (entity.organizationId !== org || entity.clientId !== client) {
        throw new OpportunityApplicationError(
          'TENANT_MISMATCH',
          'Write unit entities disagree on tenant identity.'
        );
      }
    }

    for (const candidate of unit.candidates ?? []) {
      parseStoredCandidate(cloneJson(candidate));
      const key = tenantEntityKey(
        candidate.organizationId,
        candidate.clientId,
        candidate.id
      );
      const existingRaw = this.candidates.get(key);
      if (!existingRaw) continue;
      const existing = parseStoredCandidate(existingRaw);
      if (
        existing.organizationId !== candidate.organizationId ||
        existing.clientId !== candidate.clientId
      ) {
        throw new OpportunityApplicationError(
          'TENANT_ACCESS_DENIED',
          'Write unit tenant does not match stored Candidate ownership.'
        );
      }
      if (candidate.version < existing.version) {
        throw new OpportunityApplicationError(
          'STALE_STATE',
          `Stale write denied: stored candidate version ${existing.version} > attempted ${candidate.version}.`
        );
      }
    }

    for (const opportunity of unit.opportunities ?? []) {
      parseStoredOpportunity(cloneJson(opportunity));
      const key = tenantEntityKey(
        opportunity.organizationId,
        opportunity.clientId,
        opportunity.id
      );
      const existingRaw = this.opportunities.get(key);
      if (!existingRaw) continue;
      const existing = parseStoredOpportunity(existingRaw);
      if (
        existing.organizationId !== opportunity.organizationId ||
        existing.clientId !== opportunity.clientId
      ) {
        throw new OpportunityApplicationError(
          'TENANT_ACCESS_DENIED',
          'Write unit tenant does not match stored Opportunity ownership.'
        );
      }
      if (opportunity.version < existing.version) {
        throw new OpportunityApplicationError(
          'STALE_STATE',
          `Stale write denied: stored opportunity version ${existing.version} > attempted ${opportunity.version}.`
        );
      }
    }

    this.assertNoDuplicateCurrentAfterUnit(unit);
  }

  /**
   * Fail closed if projected maps contain duplicate keys for the same tenant entity
   * (should be impossible via Map, but detect malformed multi-current projections).
   */
  private assertNoDuplicateCurrentAfterUnit(unit: OpportunityWriteUnit): void {
    const projectedCandidates = new Map(this.candidates);
    for (const c of unit.candidates ?? []) {
      projectedCandidates.set(
        tenantEntityKey(c.organizationId, c.clientId, c.id),
        cloneJson(c)
      );
    }
    const candBuckets = new Map<string, number>();
    for (const raw of projectedCandidates.values()) {
      const c = parseStoredCandidate(raw);
      if (c.status === 'SUPERSEDED' || c.status === 'DISCARDED') continue;
      const bucket = `${c.organizationId}|${c.clientId}|${c.id}`;
      candBuckets.set(bucket, (candBuckets.get(bucket) ?? 0) + 1);
    }
    for (const count of candBuckets.values()) {
      if (count > 1) {
        throw persistenceError('Duplicate current OpportunityCandidate authority.');
      }
    }

    const projectedOpps = new Map(this.opportunities);
    for (const o of unit.opportunities ?? []) {
      projectedOpps.set(
        tenantEntityKey(o.organizationId, o.clientId, o.id),
        cloneJson(o)
      );
    }
    const oppBuckets = new Map<string, number>();
    for (const raw of projectedOpps.values()) {
      const o = parseStoredOpportunity(raw);
      const bucket = `${o.organizationId}|${o.clientId}|${o.id}`;
      oppBuckets.set(bucket, (oppBuckets.get(bucket) ?? 0) + 1);
    }
    for (const count of oppBuckets.values()) {
      if (count > 1) {
        throw persistenceError('Duplicate current Opportunity authority.');
      }
    }
  }

  private persistAll(): void {
    const candidates = {
      schemaVersion: CANDIDATE_STORE_SCHEMA,
      candidates: [...this.candidates.values()],
    };
    const opportunities = {
      schemaVersion: OPPORTUNITY_STORE_SCHEMA,
      opportunities: [...this.opportunities.values()],
    };
    const history = {
      schemaVersion: OPPORTUNITY_HISTORY_STORE_SCHEMA,
      entries: this.history,
    };
    const idempotency = {
      schemaVersion: OPPORTUNITY_IDEMPOTENCY_STORE_SCHEMA,
      records: [...this.idempotency.values()],
    };
    try {
      this.kv.setItem(OPPORTUNITY_CANDIDATE_STORE_KEY, JSON.stringify(candidates));
      this.kv.setItem(OPPORTUNITY_CURRENT_STORE_KEY, JSON.stringify(opportunities));
      this.kv.setItem(OPPORTUNITY_HISTORY_STORE_KEY, JSON.stringify(history));
      this.kv.setItem(OPPORTUNITY_IDEMPOTENCY_STORE_KEY, JSON.stringify(idempotency));
    } catch (err) {
      rethrowGoverned(err);
    }
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.candidates = new Map();
    this.opportunities = new Map();
    this.idempotency = new Map();
    this.history = this.readEnvelope(
      OPPORTUNITY_HISTORY_STORE_KEY,
      OPPORTUNITY_HISTORY_STORE_SCHEMA,
      'entries'
    );
    for (const raw of this.readEnvelope(
      OPPORTUNITY_CANDIDATE_STORE_KEY,
      CANDIDATE_STORE_SCHEMA,
      'candidates'
    )) {
      const candidate = parseStoredCandidate(raw);
      this.candidates.set(
        tenantEntityKey(candidate.organizationId, candidate.clientId, candidate.id),
        raw
      );
    }
    for (const raw of this.readEnvelope(
      OPPORTUNITY_CURRENT_STORE_KEY,
      OPPORTUNITY_STORE_SCHEMA,
      'opportunities'
    )) {
      const opportunity = parseStoredOpportunity(raw);
      this.opportunities.set(
        tenantEntityKey(
          opportunity.organizationId,
          opportunity.clientId,
          opportunity.id
        ),
        raw
      );
    }
    for (const raw of this.readEnvelope(
      OPPORTUNITY_IDEMPOTENCY_STORE_KEY,
      OPPORTUNITY_IDEMPOTENCY_STORE_SCHEMA,
      'records'
    )) {
      const record = parseStoredIdempotency(raw);
      this.idempotency.set(
        idempotencyLookupKey(record.organizationId, record.clientId, record.key),
        raw
      );
    }
    this.loaded = true;
  }

  private readEnvelope(
    key: string,
    expectedSchema: string,
    collectionField: string
  ): unknown[] {
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
      throw persistenceError('Malformed persisted Opportunity Scout store.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw persistenceError('Malformed persisted Opportunity Scout store.');
    }
    const envelope = parsed as Record<string, unknown>;
    if (envelope.schemaVersion !== expectedSchema) {
      throw persistenceError(
        'Malformed persisted Opportunity Scout store: unsupported schemaVersion.'
      );
    }
    const collection = envelope[collectionField];
    if (!Array.isArray(collection)) {
      throw persistenceError('Malformed persisted Opportunity Scout store.');
    }
    return collection;
  }
}

export function createLocalOpportunityScoutStore(
  kv?: StorageLike
): LocalOpportunityScoutStore {
  return new LocalOpportunityScoutStore(kv);
}
