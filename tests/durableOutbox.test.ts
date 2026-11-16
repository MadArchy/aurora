import { describe, expect, it } from 'vitest';
import {
  actorOutboxKey,
  clearOutboxBundle,
  loadOutboxBundle,
  restoreOutboxForActor,
  saveOutboxBundle,
} from '../src/services/firestore/durableOutbox';

describe('durableOutbox RR-01', () => {
  it('partitions bundles by actor identity and restores only matching actor', () => {
    const store = new Map<string, string>();
    const actorA = {
      uid: 'admin_a',
      role: 'ADMIN',
      organizationId: 'org_1',
      clientId: null as string | null,
    };
    const actorB = { ...actorA, uid: 'admin_b' };

    saveOutboxBundle(
      actorA,
      [{ path: 'clients/c1/data', payload: { x: 1 }, updatedAt: '2026-11-15T00:00:00.000Z' }],
      {
        setItem: (k, v) => {
          store.set(k, v);
        },
        now: '2026-11-15T00:00:00.000Z',
      }
    );

    expect(actorOutboxKey(actorA)).not.toBe(actorOutboxKey(actorB));

    const loaded = loadOutboxBundle(actorA, { getItem: (k) => store.get(k) ?? null });
    expect(loaded?.entries).toHaveLength(1);

    const foreign = restoreOutboxForActor(actorB, { getItem: (k) => store.get(k) ?? null });
    expect(foreign).toEqual([]);

    const own = restoreOutboxForActor(actorA, { getItem: (k) => store.get(k) ?? null });
    expect(own).toHaveLength(1);

    clearOutboxBundle(actorA, {
      removeItem: (k) => {
        store.delete(k);
      },
    });
    expect(loadOutboxBundle(actorA, { getItem: (k) => store.get(k) ?? null })).toBeNull();
  });
});
