/**
 * RR-01 durable outbox — identity-partitioned pending ADMIN mutations.
 *
 * Complements in-RAM `pendingAdminMutations` in sync.ts: F5 / logout can restore
 * the actor's own pending bundle without contaminating another identity.
 *
 * Storage key is partitioned by uid+role+org(+clientId). Never re-inject into a
 * different actor's active queue (RR-02 isolation preserved).
 */

export type OutboxActorKey = {
  readonly uid: string;
  readonly role: string;
  readonly organizationId: string;
  readonly clientId?: string | null;
};

export type OutboxEntry = {
  readonly path: string;
  readonly payload: unknown;
  readonly updatedAt: string;
};

export type OutboxBundle = {
  readonly actorKey: string;
  readonly entries: readonly OutboxEntry[];
  readonly savedAt: string;
};

const STORAGE_PREFIX = 'postura_outbox_rr01_v1:';

export function actorOutboxKey(actor: OutboxActorKey): string {
  const client = actor.clientId?.trim() || '-';
  return `${actor.uid}|${actor.role}|${actor.organizationId}|${client}`;
}

function storageKey(actorKey: string): string {
  return `${STORAGE_PREFIX}${actorKey}`;
}

export function saveOutboxBundle(
  actor: OutboxActorKey,
  entries: readonly OutboxEntry[],
  deps: { setItem: (key: string, value: string) => void; now?: string } = {
    setItem: (k, v) => {
      if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
    },
  }
): OutboxBundle {
  const actorKey = actorOutboxKey(actor);
  const bundle: OutboxBundle = {
    actorKey,
    entries: [...entries],
    savedAt: deps.now ?? new Date().toISOString(),
  };
  deps.setItem(storageKey(actorKey), JSON.stringify(bundle));
  return bundle;
}

export function loadOutboxBundle(
  actor: OutboxActorKey,
  deps: { getItem: (key: string) => string | null } = {
    getItem: (k) => (typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null),
  }
): OutboxBundle | null {
  const actorKey = actorOutboxKey(actor);
  const raw = deps.getItem(storageKey(actorKey));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OutboxBundle;
    if (parsed.actorKey !== actorKey) return null;
    if (!Array.isArray(parsed.entries)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearOutboxBundle(
  actor: OutboxActorKey,
  deps: { removeItem: (key: string) => void } = {
    removeItem: (k) => {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
    },
  }
): void {
  deps.removeItem(storageKey(actorOutboxKey(actor)));
}

/**
 * Restore only if the bundle belongs to the requested actor.
 * Returns [] (not foreign data) when keys diverge — anti-contamination.
 */
export function restoreOutboxForActor(
  actor: OutboxActorKey,
  deps?: {
    getItem: (key: string) => string | null;
  }
): readonly OutboxEntry[] {
  const bundle = loadOutboxBundle(actor, deps);
  if (!bundle) return [];
  if (bundle.actorKey !== actorOutboxKey(actor)) return [];
  return bundle.entries;
}
