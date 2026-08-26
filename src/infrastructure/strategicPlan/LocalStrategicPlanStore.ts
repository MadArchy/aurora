import { StrategicPlanError } from '../../application/strategicPlan/errors';
import type { PlanWriteUnit } from '../../application/strategicPlan/ports/StrategicPlanRepository';
import type { StrategicPlanHistoryRecord } from '../../application/strategicPlan/ports/StrategicPlanHistoryPort';
import type { PlanItem } from '../../domain/planItemCore';
import type { StrategicPlan } from '../../domain/strategicPlanCore';
import { persistenceError, rethrowGoverned } from './persistenceErrors';
import {
  cloneJson,
  historyIdentity,
  idempotencyLookupKey,
  parseStoredHistory,
  parseStoredIdempotency,
  parseStoredPlan,
  peekId,
  peekTenant,
  tenantEntityKey,
} from './serialization';
import {
  PLAN_CURRENT_STORE_SCHEMA,
  PLAN_HISTORY_STORE_SCHEMA,
  PLAN_IDEMPOTENCY_STORE_SCHEMA,
  STRATEGIC_PLAN_CURRENT_STORE_KEY,
  STRATEGIC_PLAN_HISTORY_STORE_KEY,
  STRATEGIC_PLAN_IDEMPOTENCY_STORE_KEY,
} from './storeKeys';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoreSnapshot {
  plans: Map<string, unknown>;
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

/**
 * Local-authoritative StrategicPlan store.
 * Plans include owned PlanItems (aggregate). History + idempotency are separate keys.
 * One coherent in-memory mutation + one persist of versioned keys.
 * This is not a distributed Firestore transaction / not cryptographically append-only.
 */
export class LocalStrategicPlanStore {
  private loaded = false;
  private plans = new Map<string, unknown>();
  private history: unknown[] = [];
  private idempotency = new Map<string, unknown>();

  /** Test-only: throw after applying in-memory mutation, before persist. */
  failBeforePersistForTest = false;

  constructor(private readonly kv: StorageLike = resolveStorage()) {}

  /** Test-only reset. Not part of production ports. */
  resetForTest(): void {
    this.plans = new Map();
    this.history = [];
    this.idempotency = new Map();
    this.loaded = true;
    this.failBeforePersistForTest = false;
    try {
      this.kv.removeItem(STRATEGIC_PLAN_CURRENT_STORE_KEY);
      this.kv.removeItem(STRATEGIC_PLAN_HISTORY_STORE_KEY);
      this.kv.removeItem(STRATEGIC_PLAN_IDEMPOTENCY_STORE_KEY);
    } catch (err) {
      rethrowGoverned(err);
    }
  }

  getById(
    planId: string,
    tenant: { organizationId: string; clientId: string }
  ): StrategicPlan | undefined {
    this.ensureLoaded();
    const raw = this.plans.get(
      tenantEntityKey(tenant.organizationId, tenant.clientId, planId)
    );
    if (!raw) return undefined;
    const peeked = peekTenant(raw);
    if (!peeked) {
      throw persistenceError('Malformed persisted StrategicPlan.');
    }
    if (
      peeked.organizationId !== tenant.organizationId ||
      peeked.clientId !== tenant.clientId
    ) {
      return undefined;
    }
    return parseStoredPlan(raw);
  }

  /**
   * Deterministic current plan for Brief revision:
   * non-SUPERSEDED plans matching tenant + brief id/version.
   * Multiple matches = fail closed (no first/last/timestamp winner).
   */
  findCurrentByBriefRevision(
    tenant: { organizationId: string; clientId: string },
    strategicBriefId: string,
    strategicBriefVersion: number
  ): StrategicPlan | undefined {
    this.ensureLoaded();
    const matches: StrategicPlan[] = [];
    for (const raw of this.plans.values()) {
      const peeked = peekTenant(raw);
      if (!peeked) {
        const id = peekId(raw);
        if (id) throw persistenceError('Malformed persisted StrategicPlan.');
        continue;
      }
      if (
        peeked.organizationId !== tenant.organizationId ||
        peeked.clientId !== tenant.clientId
      ) {
        continue;
      }
      const plan = parseStoredPlan(raw);
      if (plan.status === 'SUPERSEDED') continue;
      if (plan.strategicBriefId !== strategicBriefId) continue;
      if (plan.strategicBriefVersion !== strategicBriefVersion) continue;
      matches.push(plan);
    }
    if (matches.length > 1) {
      throw persistenceError(
        'Duplicate current StrategicPlan authority for Brief revision.'
      );
    }
    return matches[0];
  }

  findByIdempotencyKey(
    tenant: { organizationId: string; clientId: string },
    key: string
  ): { planId: string } | undefined {
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
    return { planId: record.planId };
  }

  listItemsByPlan(
    planId: string,
    tenant: { organizationId: string; clientId: string }
  ): PlanItem[] {
    const plan = this.getById(planId, tenant);
    if (!plan) return [];
    return plan.items.map((item) => cloneJson(item));
  }

  commitWriteUnit(unit: PlanWriteUnit): void {
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

  appendHistory(entry: StrategicPlanHistoryRecord): void {
    this.commitWriteUnit({ plans: [], history: [entry] });
  }

  /** Test/inspection — not current authority. */
  listHistory(): StrategicPlanHistoryRecord[] {
    this.ensureLoaded();
    return this.history.map((entry) => parseStoredHistory(entry));
  }

  /** Test helper — count of physically stored current projections. */
  storedPlanCount(): number {
    this.ensureLoaded();
    return this.plans.size;
  }

  private snapshot(): StoreSnapshot {
    return {
      plans: new Map(this.plans),
      history: [...this.history],
      idempotency: new Map(this.idempotency),
    };
  }

  private restore(snapshot: StoreSnapshot): void {
    this.plans = snapshot.plans;
    this.history = snapshot.history;
    this.idempotency = snapshot.idempotency;
  }

  private applyWriteUnit(unit: PlanWriteUnit): void {
    for (const plan of unit.plans) {
      const key = tenantEntityKey(plan.organizationId, plan.clientId, plan.id);
      this.plans.set(key, cloneJson(plan));
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
        if (parsed.planId !== record.planId) {
          throw new StrategicPlanError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key already bound to a different planId.'
          );
        }
        continue;
      }
      this.idempotency.set(lookup, cloneJson(record));
    }
  }

  private appendHistoryRecord(entry: StrategicPlanHistoryRecord): void {
    const identity = historyIdentity(entry);
    const exists = this.history.some(
      (raw) => historyIdentity(parseStoredHistory(raw)) === identity
    );
    if (exists) return;
    this.history.push(cloneJson(entry));
  }

  private assertWriteUnitEnvelope(unit: PlanWriteUnit): void {
    const entities: Array<{
      organizationId: string;
      clientId: string;
      planId?: string;
    }> = [];
    for (const plan of unit.plans) {
      entities.push({
        organizationId: plan.organizationId,
        clientId: plan.clientId,
        planId: plan.id,
      });
    }
    for (const entry of unit.history) {
      entities.push({
        organizationId: entry.organizationId,
        clientId: entry.clientId,
        planId: entry.planId,
      });
    }
    for (const record of unit.idempotencyKeys ?? []) {
      entities.push({
        organizationId: record.organizationId,
        clientId: record.clientId,
        planId: record.planId,
      });
    }
    if (entities.length === 0) return;

    const org = entities[0].organizationId;
    const client = entities[0].clientId;
    if (!org || !client) {
      throw new StrategicPlanError(
        'TENANT_CONTEXT_INVALID',
        'Write unit tenant envelope is required.'
      );
    }
    for (const entity of entities) {
      if (entity.organizationId !== org || entity.clientId !== client) {
        throw new StrategicPlanError(
          'TENANT_CONTEXT_INVALID',
          'Write unit entities disagree on tenant identity.'
        );
      }
    }

    for (const plan of unit.plans) {
      // Validate reconstruction path before commit.
      parseStoredPlan(cloneJson(plan));

      const key = tenantEntityKey(plan.organizationId, plan.clientId, plan.id);
      const existingRaw = this.plans.get(key);
      if (!existingRaw) continue;
      const existing = parseStoredPlan(existingRaw);
      if (
        existing.organizationId !== plan.organizationId ||
        existing.clientId !== plan.clientId
      ) {
        throw new StrategicPlanError(
          'TENANT_ACCESS_DENIED',
          'Write unit tenant does not match stored Plan ownership.'
        );
      }
      // Version-aware protection: reject stale overwrite of a newer stored version.
      if (plan.version < existing.version) {
        throw new StrategicPlanError(
          'IDEMPOTENCY_CONFLICT',
          `Stale write denied: stored version ${existing.version} > attempted ${plan.version}.`
        );
      }
    }

    const unitPlans = new Map(unit.plans.map((plan) => [plan.id, plan]));
    for (const entry of unit.history) {
      const inUnit = unitPlans.get(entry.planId);
      if (inUnit) {
        if (
          inUnit.organizationId !== entry.organizationId ||
          inUnit.clientId !== entry.clientId
        ) {
          throw new StrategicPlanError(
            'TENANT_CONTEXT_INVALID',
            'Write unit history does not match Plan ownership.'
          );
        }
        continue;
      }
      const existing = this.getById(entry.planId, {
        organizationId: entry.organizationId,
        clientId: entry.clientId,
      });
      if (!existing) {
        throw new StrategicPlanError(
          'TENANT_CONTEXT_INVALID',
          'Write unit history does not match Plan ownership.'
        );
      }
    }

    // Duplicate current authority check after applying unit plans into a dry-run set.
    this.assertNoDuplicateCurrentAfterUnit(unit);
  }

  private assertNoDuplicateCurrentAfterUnit(unit: PlanWriteUnit): void {
    const projected = new Map(this.plans);
    for (const plan of unit.plans) {
      projected.set(
        tenantEntityKey(plan.organizationId, plan.clientId, plan.id),
        cloneJson(plan)
      );
    }
    const buckets = new Map<string, string[]>();
    for (const raw of projected.values()) {
      const plan = parseStoredPlan(raw);
      if (plan.status === 'SUPERSEDED') continue;
      const bucket = [
        plan.organizationId,
        plan.clientId,
        plan.strategicBriefId,
        String(plan.strategicBriefVersion),
      ].join('|');
      const list = buckets.get(bucket) ?? [];
      list.push(plan.id);
      buckets.set(bucket, list);
    }
    for (const ids of buckets.values()) {
      if (ids.length > 1) {
        throw persistenceError(
          'Duplicate current StrategicPlan authority for Brief revision.'
        );
      }
    }
  }

  private persistAll(): void {
    const current = {
      schemaVersion: PLAN_CURRENT_STORE_SCHEMA,
      plans: [...this.plans.values()],
    };
    const history = {
      schemaVersion: PLAN_HISTORY_STORE_SCHEMA,
      entries: this.history,
    };
    const idempotency = {
      schemaVersion: PLAN_IDEMPOTENCY_STORE_SCHEMA,
      records: [...this.idempotency.values()],
    };
    try {
      this.kv.setItem(STRATEGIC_PLAN_CURRENT_STORE_KEY, JSON.stringify(current));
      this.kv.setItem(STRATEGIC_PLAN_HISTORY_STORE_KEY, JSON.stringify(history));
      this.kv.setItem(STRATEGIC_PLAN_IDEMPOTENCY_STORE_KEY, JSON.stringify(idempotency));
    } catch (err) {
      rethrowGoverned(err);
    }
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.plans = new Map();
    this.idempotency = new Map();
    this.history = this.readEnvelope(
      STRATEGIC_PLAN_HISTORY_STORE_KEY,
      PLAN_HISTORY_STORE_SCHEMA,
      'entries'
    );
    const planItems = this.readEnvelope(
      STRATEGIC_PLAN_CURRENT_STORE_KEY,
      PLAN_CURRENT_STORE_SCHEMA,
      'plans'
    );
    for (const raw of planItems) {
      const plan = parseStoredPlan(raw);
      this.plans.set(
        tenantEntityKey(plan.organizationId, plan.clientId, plan.id),
        raw
      );
    }
    const idemRecords = this.readEnvelope(
      STRATEGIC_PLAN_IDEMPOTENCY_STORE_KEY,
      PLAN_IDEMPOTENCY_STORE_SCHEMA,
      'records'
    );
    for (const raw of idemRecords) {
      const record = parseStoredIdempotency(raw);
      this.idempotency.set(
        idempotencyLookupKey(record.organizationId, record.clientId, record.key),
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
      throw persistenceError('Malformed persisted StrategicPlan store.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw persistenceError('Malformed persisted StrategicPlan store.');
    }
    const envelope = parsed as Record<string, unknown>;
    if (envelope.schemaVersion !== expectedSchema) {
      throw persistenceError('Malformed persisted StrategicPlan store: unsupported schemaVersion.');
    }
    const collection = envelope[collectionField];
    if (!Array.isArray(collection)) {
      throw persistenceError('Malformed persisted StrategicPlan store.');
    }
    return collection;
  }
}

export function createLocalStrategicPlanStore(kv?: StorageLike): LocalStrategicPlanStore {
  return new LocalStrategicPlanStore(kv);
}
