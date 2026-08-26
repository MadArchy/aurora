/**
 * SPEC-008 Phase 3 — Local-authoritative Learning Loop store.
 *
 * Guarantee: one coherent in-memory mutation + persist of versioned tenant keys.
 * Not a distributed Firestore transaction / not cryptographically append-only.
 * On failure after mutation, in-memory state is restored (best-effort re-persist).
 */

import { LearningApplicationError } from '../../application/learningLoop/errors';
import type { LearningWriteUnit } from '../../application/learningLoop/ports/LearningTenantScope';
import type { LearningHistoryRecord } from '../../domain/learningMaterialityCore';
import type { LearningEvidence } from '../../domain/learningEvidenceCore';
import type { LearningObservation } from '../../domain/learningObservationCore';
import type { RecommendationDecision } from '../../domain/recommendationDecisionCore';
import type { StrategicRecommendation } from '../../domain/strategicRecommendationCore';
import { persistenceError, rethrowGoverned } from './persistenceErrors';
import {
  cloneJson,
  decisionIdentity,
  evidenceMaterialFingerprint,
  historyIdentity,
  idempotencyLookupKey,
  observationMaterialFingerprint,
  parseStoredDecision,
  parseStoredEvidence,
  parseStoredHistory,
  parseStoredIdempotency,
  parseStoredObservation,
  parseStoredRecommendation,
  peekEntityId,
  peekTenant,
  tenantEntityKey,
} from './serialization';
import {
  LEARNING_DECISION_STORE_KEY,
  LEARNING_DECISION_STORE_SCHEMA,
  LEARNING_EVIDENCE_STORE_KEY,
  LEARNING_EVIDENCE_STORE_SCHEMA,
  LEARNING_HISTORY_STORE_KEY,
  LEARNING_HISTORY_STORE_SCHEMA,
  LEARNING_IDEMPOTENCY_STORE_KEY,
  LEARNING_IDEMPOTENCY_STORE_SCHEMA,
  LEARNING_OBSERVATION_STORE_KEY,
  LEARNING_OBSERVATION_STORE_SCHEMA,
  LEARNING_RECOMMENDATION_STORE_KEY,
  LEARNING_RECOMMENDATION_STORE_SCHEMA,
} from './storeKeys';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoreSnapshot {
  observations: Map<string, unknown>;
  evidence: Map<string, unknown>;
  recommendations: Map<string, unknown>;
  history: unknown[];
  decisions: unknown[];
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

export class LocalLearningLoopStore {
  private loaded = false;
  private observations = new Map<string, unknown>();
  private evidence = new Map<string, unknown>();
  private recommendations = new Map<string, unknown>();
  private history: unknown[] = [];
  private decisions: unknown[] = [];
  private idempotency = new Map<string, unknown>();

  /** Test-only: throw after applying in-memory mutation, before persist. */
  failBeforePersistForTest = false;

  constructor(private readonly kv: StorageLike = resolveStorage()) {}

  resetForTest(): void {
    this.observations = new Map();
    this.evidence = new Map();
    this.recommendations = new Map();
    this.history = [];
    this.decisions = [];
    this.idempotency = new Map();
    this.loaded = true;
    this.failBeforePersistForTest = false;
    try {
      this.kv.removeItem(LEARNING_OBSERVATION_STORE_KEY);
      this.kv.removeItem(LEARNING_EVIDENCE_STORE_KEY);
      this.kv.removeItem(LEARNING_RECOMMENDATION_STORE_KEY);
      this.kv.removeItem(LEARNING_HISTORY_STORE_KEY);
      this.kv.removeItem(LEARNING_DECISION_STORE_KEY);
      this.kv.removeItem(LEARNING_IDEMPOTENCY_STORE_KEY);
    } catch (err) {
      rethrowGoverned(err);
    }
  }

  getObservation(
    observationId: string,
    tenant: { organizationId: string; clientId: string }
  ): LearningObservation | undefined {
    this.ensureLoaded();
    const raw = this.observations.get(
      tenantEntityKey(tenant.organizationId, tenant.clientId, observationId)
    );
    if (!raw) return undefined;
    const peeked = peekTenant(raw);
    if (!peeked) throw persistenceError('Malformed persisted LearningObservation.');
    if (
      peeked.organizationId !== tenant.organizationId ||
      peeked.clientId !== tenant.clientId
    ) {
      return undefined;
    }
    return parseStoredObservation(raw);
  }

  listObservations(tenant: {
    organizationId: string;
    clientId: string;
  }): LearningObservation[] {
    this.ensureLoaded();
    const results: LearningObservation[] = [];
    for (const raw of this.observations.values()) {
      const peeked = peekTenant(raw);
      if (!peeked) {
        if (peekEntityId(raw, ['observationId'])) {
          throw persistenceError('Malformed persisted LearningObservation.');
        }
        continue;
      }
      if (
        peeked.organizationId !== tenant.organizationId ||
        peeked.clientId !== tenant.clientId
      ) {
        continue;
      }
      results.push(parseStoredObservation(raw));
    }
    return results;
  }

  getEvidence(
    evidenceId: string,
    tenant: { organizationId: string; clientId: string }
  ): LearningEvidence | undefined {
    this.ensureLoaded();
    const raw = this.evidence.get(
      tenantEntityKey(tenant.organizationId, tenant.clientId, evidenceId)
    );
    if (!raw) return undefined;
    const peeked = peekTenant(raw);
    if (!peeked) throw persistenceError('Malformed persisted LearningEvidence.');
    if (
      peeked.organizationId !== tenant.organizationId ||
      peeked.clientId !== tenant.clientId
    ) {
      return undefined;
    }
    return parseStoredEvidence(raw);
  }

  listEvidence(tenant: {
    organizationId: string;
    clientId: string;
  }): LearningEvidence[] {
    this.ensureLoaded();
    const results: LearningEvidence[] = [];
    for (const raw of this.evidence.values()) {
      const peeked = peekTenant(raw);
      if (!peeked) {
        if (peekEntityId(raw, ['evidenceId'])) {
          throw persistenceError('Malformed persisted LearningEvidence.');
        }
        continue;
      }
      if (
        peeked.organizationId !== tenant.organizationId ||
        peeked.clientId !== tenant.clientId
      ) {
        continue;
      }
      results.push(parseStoredEvidence(raw));
    }
    return results;
  }

  getRecommendation(
    recommendationId: string,
    tenant: { organizationId: string; clientId: string }
  ): StrategicRecommendation | undefined {
    this.ensureLoaded();
    const raw = this.recommendations.get(
      tenantEntityKey(tenant.organizationId, tenant.clientId, recommendationId)
    );
    if (!raw) return undefined;
    const peeked = peekTenant(raw);
    if (!peeked) throw persistenceError('Malformed persisted StrategicRecommendation.');
    if (
      peeked.organizationId !== tenant.organizationId ||
      peeked.clientId !== tenant.clientId
    ) {
      return undefined;
    }
    return parseStoredRecommendation(raw);
  }

  listRecommendations(tenant: {
    organizationId: string;
    clientId: string;
  }): StrategicRecommendation[] {
    this.ensureLoaded();
    const results: StrategicRecommendation[] = [];
    for (const raw of this.recommendations.values()) {
      const peeked = peekTenant(raw);
      if (!peeked) {
        if (peekEntityId(raw, ['recommendationId'])) {
          throw persistenceError('Malformed persisted StrategicRecommendation.');
        }
        continue;
      }
      if (
        peeked.organizationId !== tenant.organizationId ||
        peeked.clientId !== tenant.clientId
      ) {
        continue;
      }
      results.push(parseStoredRecommendation(raw));
    }
    return results;
  }

  findByIdempotencyKey(
    tenant: { organizationId: string; clientId: string },
    key: string
  ):
    | {
        aggregateKind: 'OBSERVATION';
        observationId: string;
        materialFingerprint: string;
      }
    | {
        aggregateKind: 'EVIDENCE';
        evidenceId: string;
        materialFingerprint: string;
      }
    | {
        aggregateKind: 'RECOMMENDATION';
        recommendationId: string;
        materialFingerprint: string;
      }
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
    if (record.aggregateKind === 'OBSERVATION') {
      return {
        aggregateKind: 'OBSERVATION',
        observationId: record.aggregateId,
        materialFingerprint: record.materialFingerprint,
      };
    }
    if (record.aggregateKind === 'EVIDENCE') {
      return {
        aggregateKind: 'EVIDENCE',
        evidenceId: record.aggregateId,
        materialFingerprint: record.materialFingerprint,
      };
    }
    return {
      aggregateKind: 'RECOMMENDATION',
      recommendationId: record.aggregateId,
      materialFingerprint: record.materialFingerprint,
    };
  }

  commitWriteUnit(unit: LearningWriteUnit): void {
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

  appendHistory(entry: LearningHistoryRecord): void {
    this.commitWriteUnit({ history: [entry] });
  }

  appendDecision(decision: RecommendationDecision): void {
    this.commitWriteUnit({ history: [], decisions: [decision] });
  }

  /** Test/inspection — not current authority. */
  listHistory(): LearningHistoryRecord[] {
    this.ensureLoaded();
    return this.history.map((entry) => parseStoredHistory(entry));
  }

  /** Test/inspection — not current authority. */
  listDecisions(): RecommendationDecision[] {
    this.ensureLoaded();
    return this.decisions.map((entry) => parseStoredDecision(entry));
  }

  private snapshot(): StoreSnapshot {
    return {
      observations: new Map(this.observations),
      evidence: new Map(this.evidence),
      recommendations: new Map(this.recommendations),
      history: [...this.history],
      decisions: [...this.decisions],
      idempotency: new Map(this.idempotency),
    };
  }

  private restore(snapshot: StoreSnapshot): void {
    this.observations = snapshot.observations;
    this.evidence = snapshot.evidence;
    this.recommendations = snapshot.recommendations;
    this.history = snapshot.history;
    this.decisions = snapshot.decisions;
    this.idempotency = snapshot.idempotency;
  }

  private applyWriteUnit(unit: LearningWriteUnit): void {
    for (const observation of unit.observations ?? []) {
      const key = tenantEntityKey(
        observation.organizationId,
        observation.clientId,
        observation.observationId
      );
      this.observations.set(key, cloneJson(observation));
    }
    for (const item of unit.evidence ?? []) {
      const key = tenantEntityKey(item.organizationId, item.clientId, item.evidenceId);
      this.evidence.set(key, cloneJson(item));
    }
    for (const recommendation of unit.recommendations ?? []) {
      const key = tenantEntityKey(
        recommendation.organizationId,
        recommendation.clientId,
        recommendation.recommendationId
      );
      this.recommendations.set(key, cloneJson(recommendation));
    }
    for (const entry of unit.history) {
      this.appendHistoryRecord(entry);
    }
    for (const decision of unit.decisions ?? []) {
      this.appendDecisionRecord(decision);
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
        if (parsed.materialFingerprint !== record.materialFingerprint) {
          throw new LearningApplicationError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key already bound to a different material fingerprint.'
          );
        }
        if (
          parsed.aggregateKind !== record.aggregateKind ||
          parsed.aggregateId !== record.aggregateId
        ) {
          throw new LearningApplicationError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key already bound to a different aggregate.'
          );
        }
        continue;
      }
      this.idempotency.set(lookup, cloneJson(record));
    }
  }

  private appendHistoryRecord(entry: LearningHistoryRecord): void {
    const identity = historyIdentity(entry);
    const exists = this.history.some(
      (raw) => historyIdentity(parseStoredHistory(raw)) === identity
    );
    if (exists) return;
    this.history.push(cloneJson(entry));
  }

  private appendDecisionRecord(decision: RecommendationDecision): void {
    const identity = decisionIdentity(decision);
    const exists = this.decisions.some(
      (raw) => decisionIdentity(parseStoredDecision(raw)) === identity
    );
    if (exists) return;
    this.decisions.push(cloneJson(decision));
  }

  private assertWriteUnitEnvelope(unit: LearningWriteUnit): void {
    const entities: Array<{ organizationId: string; clientId: string }> = [];
    for (const o of unit.observations ?? []) {
      entities.push({ organizationId: o.organizationId, clientId: o.clientId });
    }
    for (const e of unit.evidence ?? []) {
      entities.push({ organizationId: e.organizationId, clientId: e.clientId });
    }
    for (const r of unit.recommendations ?? []) {
      entities.push({ organizationId: r.organizationId, clientId: r.clientId });
    }
    for (const h of unit.history) {
      entities.push({ organizationId: h.organizationId, clientId: h.clientId });
    }
    for (const d of unit.decisions ?? []) {
      entities.push({ organizationId: d.organizationId, clientId: d.clientId });
    }
    for (const k of unit.idempotencyKeys ?? []) {
      entities.push({ organizationId: k.organizationId, clientId: k.clientId });
    }
    if (entities.length === 0) return;

    const org = entities[0].organizationId;
    const client = entities[0].clientId;
    if (!org || !client) {
      throw new LearningApplicationError(
        'TENANT_MISMATCH',
        'Write unit tenant envelope is required.'
      );
    }
    for (const entity of entities) {
      if (entity.organizationId !== org || entity.clientId !== client) {
        throw new LearningApplicationError(
          'TENANT_MISMATCH',
          'Write unit entities disagree on tenant identity.'
        );
      }
    }

    for (const observation of unit.observations ?? []) {
      parseStoredObservation(cloneJson(observation));
      const key = tenantEntityKey(
        observation.organizationId,
        observation.clientId,
        observation.observationId
      );
      const existingRaw = this.observations.get(key);
      if (!existingRaw) continue;
      const existing = parseStoredObservation(existingRaw);
      if (
        existing.organizationId !== observation.organizationId ||
        existing.clientId !== observation.clientId
      ) {
        throw new LearningApplicationError(
          'TENANT_ACCESS_DENIED',
          'Write unit tenant does not match stored Observation ownership.'
        );
      }
      const beforeFp = observationMaterialFingerprint(existing);
      const afterFp = observationMaterialFingerprint(observation);
      if (beforeFp !== afterFp && existing.status === 'ACTIVE' && observation.status === 'ACTIVE') {
        throw persistenceError(
          'Duplicate current LearningObservation authority: material change requires supersession.'
        );
      }
    }

    for (const item of unit.evidence ?? []) {
      parseStoredEvidence(cloneJson(item));
      const key = tenantEntityKey(item.organizationId, item.clientId, item.evidenceId);
      const existingRaw = this.evidence.get(key);
      if (!existingRaw) continue;
      const existing = parseStoredEvidence(existingRaw);
      if (
        existing.organizationId !== item.organizationId ||
        existing.clientId !== item.clientId
      ) {
        throw new LearningApplicationError(
          'TENANT_ACCESS_DENIED',
          'Write unit tenant does not match stored Evidence ownership.'
        );
      }
      if (evidenceMaterialFingerprint(existing) !== evidenceMaterialFingerprint(item)) {
        throw persistenceError(
          'Duplicate current LearningEvidence authority: evidence is immutable per evidenceId.'
        );
      }
    }

    for (const recommendation of unit.recommendations ?? []) {
      parseStoredRecommendation(cloneJson(recommendation));
      const key = tenantEntityKey(
        recommendation.organizationId,
        recommendation.clientId,
        recommendation.recommendationId
      );
      const existingRaw = this.recommendations.get(key);
      if (!existingRaw) continue;
      const existing = parseStoredRecommendation(existingRaw);
      if (
        existing.organizationId !== recommendation.organizationId ||
        existing.clientId !== recommendation.clientId
      ) {
        throw new LearningApplicationError(
          'TENANT_ACCESS_DENIED',
          'Write unit tenant does not match stored Recommendation ownership.'
        );
      }
      if (recommendation.version < existing.version) {
        throw new LearningApplicationError(
          'STALE_STATE',
          `Stale write denied: stored recommendation version ${existing.version} > attempted ${recommendation.version}.`
        );
      }
      if (
        existing.status === 'SUPERSEDED' &&
        recommendation.status !== 'SUPERSEDED' &&
        recommendation.version <= existing.version
      ) {
        throw new LearningApplicationError(
          'INVALID_TRANSITION',
          'Superseded recommendation cannot be revived without version increment.'
        );
      }
    }

    this.assertNoDuplicateCurrentAfterUnit(unit);
  }

  private assertNoDuplicateCurrentAfterUnit(unit: LearningWriteUnit): void {
    const projectedRecs = new Map(this.recommendations);
    for (const r of unit.recommendations ?? []) {
      projectedRecs.set(
        tenantEntityKey(r.organizationId, r.clientId, r.recommendationId),
        cloneJson(r)
      );
    }
    const recBuckets = new Map<string, number>();
    for (const raw of projectedRecs.values()) {
      const r = parseStoredRecommendation(raw);
      const bucket = `${r.organizationId}|${r.clientId}|${r.recommendationId}`;
      recBuckets.set(bucket, (recBuckets.get(bucket) ?? 0) + 1);
    }
    for (const count of recBuckets.values()) {
      if (count > 1) {
        throw persistenceError('Duplicate current StrategicRecommendation authority.');
      }
    }
  }

  private persistAll(): void {
    const observations = {
      schemaVersion: LEARNING_OBSERVATION_STORE_SCHEMA,
      observations: [...this.observations.values()],
    };
    const evidence = {
      schemaVersion: LEARNING_EVIDENCE_STORE_SCHEMA,
      evidence: [...this.evidence.values()],
    };
    const recommendations = {
      schemaVersion: LEARNING_RECOMMENDATION_STORE_SCHEMA,
      recommendations: [...this.recommendations.values()],
    };
    const history = {
      schemaVersion: LEARNING_HISTORY_STORE_SCHEMA,
      entries: this.history,
    };
    const decisions = {
      schemaVersion: LEARNING_DECISION_STORE_SCHEMA,
      entries: this.decisions,
    };
    const idempotency = {
      schemaVersion: LEARNING_IDEMPOTENCY_STORE_SCHEMA,
      records: [...this.idempotency.values()],
    };
    try {
      this.kv.setItem(LEARNING_OBSERVATION_STORE_KEY, JSON.stringify(observations));
      this.kv.setItem(LEARNING_EVIDENCE_STORE_KEY, JSON.stringify(evidence));
      this.kv.setItem(LEARNING_RECOMMENDATION_STORE_KEY, JSON.stringify(recommendations));
      this.kv.setItem(LEARNING_HISTORY_STORE_KEY, JSON.stringify(history));
      this.kv.setItem(LEARNING_DECISION_STORE_KEY, JSON.stringify(decisions));
      this.kv.setItem(LEARNING_IDEMPOTENCY_STORE_KEY, JSON.stringify(idempotency));
    } catch (err) {
      rethrowGoverned(err);
    }
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.observations = new Map();
    this.evidence = new Map();
    this.recommendations = new Map();
    this.idempotency = new Map();
    this.history = this.readEnvelope(
      LEARNING_HISTORY_STORE_KEY,
      LEARNING_HISTORY_STORE_SCHEMA,
      'entries'
    );
    this.decisions = this.readEnvelope(
      LEARNING_DECISION_STORE_KEY,
      LEARNING_DECISION_STORE_SCHEMA,
      'entries'
    );
    for (const raw of this.readEnvelope(
      LEARNING_OBSERVATION_STORE_KEY,
      LEARNING_OBSERVATION_STORE_SCHEMA,
      'observations'
    )) {
      const observation = parseStoredObservation(raw);
      this.observations.set(
        tenantEntityKey(
          observation.organizationId,
          observation.clientId,
          observation.observationId
        ),
        raw
      );
    }
    for (const raw of this.readEnvelope(
      LEARNING_EVIDENCE_STORE_KEY,
      LEARNING_EVIDENCE_STORE_SCHEMA,
      'evidence'
    )) {
      const item = parseStoredEvidence(raw);
      this.evidence.set(
        tenantEntityKey(item.organizationId, item.clientId, item.evidenceId),
        raw
      );
    }
    for (const raw of this.readEnvelope(
      LEARNING_RECOMMENDATION_STORE_KEY,
      LEARNING_RECOMMENDATION_STORE_SCHEMA,
      'recommendations'
    )) {
      const recommendation = parseStoredRecommendation(raw);
      this.recommendations.set(
        tenantEntityKey(
          recommendation.organizationId,
          recommendation.clientId,
          recommendation.recommendationId
        ),
        raw
      );
    }
    for (const raw of this.readEnvelope(
      LEARNING_IDEMPOTENCY_STORE_KEY,
      LEARNING_IDEMPOTENCY_STORE_SCHEMA,
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
      throw persistenceError('Malformed persisted Learning Loop store.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw persistenceError('Malformed persisted Learning Loop store.');
    }
    const envelope = parsed as Record<string, unknown>;
    if (envelope.schemaVersion !== expectedSchema) {
      throw persistenceError(
        'Malformed persisted Learning Loop store: unsupported schemaVersion.'
      );
    }
    const collection = envelope[collectionField];
    if (!Array.isArray(collection)) {
      throw persistenceError('Malformed persisted Learning Loop store.');
    }
    return collection;
  }
}

export function createLocalLearningLoopStore(kv?: StorageLike): LocalLearningLoopStore {
  return new LocalLearningLoopStore(kv);
}
