/**
 * SPEC-010 Phase 2 — wave-2 behaviour and parity tests (T-010-206).
 *
 * The companion architecture suite proves the wave-2 layer cannot reach a
 * forbidden dependency. This suite proves the parts that only a running command
 * can show: that a migrated command reaches the same canonical consumer the
 * legacy handler reaches, that it carries trusted identity and nothing else,
 * that it fails closed, and that the cache cannot mix two tenants.
 *
 * Mapping:
 *   T-010-202 → opportunity command forwarding, decline-notes parity, fail-closed
 *   T-010-203 → consultation intent forwarding
 *   T-010-201…204 → tenant-safe cache identity
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTrustedTenantScope, tenantScopeKey } from '../src/ui/query/tenantScope';
import { tenantInvalidationKey, tenantQueryKey } from '../src/ui/query/queryKeys';
import type { User } from '../src/types';

const calls: { fn: string; params: Record<string, unknown> }[] = [];

/** Lets one test make the canonical consumer refuse, without resetting modules. */
const consumerBehaviour = { acceptRejects: false };

vi.mock('../src/services/opportunityScoutConsumer', () => ({
  listOpportunitiesForClient: () => [],
  opportunityStatusDisplayLabel: (status: string) => `label:${status}`,
  acceptClientOpportunity: (params: Record<string, unknown>) => {
    if (consumerBehaviour.acceptRejects) throw new Error('LIFECYCLE_TRANSITION_FORBIDDEN');
    calls.push({ fn: 'accept', params });
    return {};
  },
  declineClientOpportunity: (params: Record<string, unknown>) => {
    calls.push({ fn: 'decline', params });
    return {};
  },
  toggleClientOpportunityChecklistItem: (params: Record<string, unknown>) => {
    calls.push({ fn: 'toggle', params });
    return {};
  },
  submitClientOpportunity: (params: Record<string, unknown>) => {
    calls.push({ fn: 'submit', params });
    return {};
  },
}));

vi.mock('../src/services/learningLoopConsumer', () => ({
  registerResultRecordIntent: (params: Record<string, unknown>) => {
    calls.push({ fn: 'registerResult', params });
    return { observationId: 'obs-1', created: true, mirrored: false };
  },
}));

vi.mock('../src/services/db', () => ({
  dbService: {
    /* Not used by these tests; present so the facade module can load. */
  },
}));

const CLIENT_USER: User = {
  uid: 'user_client',
  email: 'client@test',
  displayName: 'Client',
  role: 'CLIENT',
  organizationId: 'org_a',
  clientId: 'client_a',
} as User;

async function loadSeam() {
  const mod = await import('../src/ui/commands/commandSeam');
  calls.length = 0;
  return mod;
}

describe('T-010-202 — migrated opportunity commands reach the canonical consumer', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('accept forwards the opportunity id and the trusted tenant scope', async () => {
    const { opportunityCommands } = await loadSeam();
    const scope = buildTrustedTenantScope(CLIENT_USER);

    const result = opportunityCommands.accept(scope, 'opp-1', 'ok');

    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe('accept');
    expect(calls[0].params.opportunityId).toBe('opp-1');
    expect(calls[0].params.clientId).toBe('client_a');
    expect(calls[0].params.claimedOrganizationId).toBe('org_a');
    expect(calls[0].params.claimedClientId).toBe('client_a');
  });

  it('no command sends an actor, a role or a forged snapshot', async () => {
    const { opportunityCommands, resultCommands } = await loadSeam();
    const scope = buildTrustedTenantScope(CLIENT_USER);

    opportunityCommands.accept(scope, 'opp-1');
    opportunityCommands.decline(scope, 'opp-1', 'no encaja');
    opportunityCommands.toggleChecklistItem(scope, 'opp-1', 'item-1', true);
    opportunityCommands.submit(scope, 'opp-1');
    resultCommands.registerConsultation(scope, 'nota');

    expect(calls).toHaveLength(5);
    for (const call of calls) {
      expect(call.params.actorType).toBeUndefined();
      expect(call.params.role).toBeUndefined();
      expect(call.params.actorUid).toBeUndefined();
      expect(call.params.createdBy).toBeUndefined();
      expect(call.params.forgedOpportunity).toBeUndefined();
      expect(call.params.forgedStatus).toBeUndefined();
      expect(call.params.forgedObservation).toBeUndefined();
    }
  });

  it('declining without notes is refused before the consumer is called (legacy parity)', async () => {
    const { opportunityCommands } = await loadSeam();
    const scope = buildTrustedTenantScope(CLIENT_USER);

    const result = opportunityCommands.decline(scope, 'opp-1', '   ');

    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('declining with notes trims and forwards them', async () => {
    const { opportunityCommands } = await loadSeam();
    const scope = buildTrustedTenantScope(CLIENT_USER);

    expect(opportunityCommands.decline(scope, 'opp-1', '  no encaja  ')).toEqual({ ok: true });
    expect(calls[0].params.notes).toBe('no encaja');
  });

  it('a consumer rejection is returned as a message, never swallowed as success', async () => {
    const { opportunityCommands } = await loadSeam();
    const scope = buildTrustedTenantScope(CLIENT_USER);

    consumerBehaviour.acceptRejects = true;
    try {
      expect(opportunityCommands.accept(scope, 'opp-1')).toEqual({
        ok: false,
        message: 'LIFECYCLE_TRANSITION_FORBIDDEN',
      });
    } finally {
      consumerBehaviour.acceptRejects = false;
    }
  });

  it('a portfolio scope with no client fails closed instead of guessing a client', async () => {
    const { opportunityCommands } = await loadSeam();
    const adminScope = buildTrustedTenantScope({
      ...CLIENT_USER,
      role: 'ADMIN',
      clientId: undefined,
    } as User);

    expect(adminScope.clientId).toBeNull();
    expect(opportunityCommands.accept(adminScope, 'opp-1').ok).toBe(false);
    expect(opportunityCommands.submit(adminScope, 'opp-1').ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('T-010-203 — the consultation intent reaches the canonical learning consumer', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('forwards a canonical KPI intent with the trusted scope', async () => {
    const { resultCommands } = await loadSeam();
    const scope = buildTrustedTenantScope(CLIENT_USER);

    expect(resultCommands.registerConsultation(scope, 'evaluación IA')).toEqual({ ok: true });
    expect(calls[0].fn).toBe('registerResult');
    expect(calls[0].params.kpiType).toBe('consultation_requests');
    expect(calls[0].params.metricValue).toBe(1);
    expect(calls[0].params.title).toBe('Consulta: evaluación IA');
    expect(calls[0].params.claimedOrganizationId).toBe('org_a');
  });

  it('an empty note still registers, matching the legacy quick form', async () => {
    const { resultCommands } = await loadSeam();
    const scope = buildTrustedTenantScope(CLIENT_USER);

    expect(resultCommands.registerConsultation(scope, '  ')).toEqual({ ok: true });
    expect(calls[0].params.title).toBe('Consulta recibida');
    expect(calls[0].params.notes).toBeUndefined();
  });
});

describe('T-010-08 — wave-2 cache identity cannot mix tenants', () => {
  it('the same resource in two organizations produces different keys', () => {
    const orgA = buildTrustedTenantScope(CLIENT_USER);
    const orgB = buildTrustedTenantScope({ ...CLIENT_USER, organizationId: 'org_b' } as User);

    for (const resource of [
      'opportunities',
      'master-dossier',
      'kpi-weekly',
      'profile-overview',
      'proof-wall',
      'sources',
    ]) {
      const keyA = tenantQueryKey(orgA, 'compatibility', resource);
      const keyB = tenantQueryKey(orgB, 'compatibility', resource);
      expect(keyA).not.toEqual(keyB);
      expect(keyA).toContain('org_a');
      expect(keyB).toContain('org_b');
    }
  });

  it('the same resource for two clients in one organization produces different keys', () => {
    const clientA = buildTrustedTenantScope(CLIENT_USER);
    const clientB = buildTrustedTenantScope({ ...CLIENT_USER, clientId: 'client_b' } as User);

    expect(tenantQueryKey(clientA, 'canonical', 'opportunities')).not.toEqual(
      tenantQueryKey(clientB, 'canonical', 'opportunities')
    );
  });

  it('a canonical read and a compatibility read never share a cache entry', () => {
    const scope = buildTrustedTenantScope(CLIENT_USER);
    expect(tenantQueryKey(scope, 'canonical', 'opportunities')).not.toEqual(
      tenantQueryKey(scope, 'compatibility', 'opportunities')
    );
  });

  it('invalidation is scoped to one tenant and one read source', () => {
    const scope = buildTrustedTenantScope(CLIENT_USER);
    const other = buildTrustedTenantScope({ ...CLIENT_USER, organizationId: 'org_b' } as User);

    const key = tenantInvalidationKey(scope, 'canonical');
    expect(key).toEqual(['postura', 'canonical', 'org_a', 'client_a']);
    expect(key).not.toEqual(tenantInvalidationKey(other, 'canonical'));
    expect(key).not.toEqual(tenantInvalidationKey(scope, 'compatibility'));
  });

  it('a tenant scope cannot be produced from UI-supplied values alone', () => {
    // There is no constructor that accepts a bare organization/client pair, and a
    // session without a trusted organization is rejected rather than defaulted.
    expect(() =>
      buildTrustedTenantScope({ ...CLIENT_USER, organizationId: '' } as User)
    ).toThrow(/organizationId/);
    expect(tenantScopeKey(buildTrustedTenantScope(CLIENT_USER))).toEqual(['org_a', 'client_a']);
  });
});
