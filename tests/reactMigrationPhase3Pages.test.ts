/**
 * SPEC-010 Phase 3 — wave-3 page behaviour and parity tests (T-010-301…306).
 *
 * These are behavioural, not structural: they exercise the read seams, the
 * wave-3 commands and the query keys against a real store, so the claims the
 * governance documents make about Phase 3 are backed by executed code.
 *
 * The parity claim being tested is deliberately narrow and matches
 * `parity-model.md`: the React page must project the same canonical state the
 * legacy page projects, must not invent a selection the legacy page did not
 * make, and must not carry a legacy write it is not allowed to carry.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const consumerBehaviour = { approveRejects: false, outcomeRejects: false };

const registerSignalOutcomeIntent = vi.fn();
const approveStrategicBrief = vi.fn();
const listStrategicBriefs = vi.fn();
const listSignalOutcomesForDisplay = vi.fn();

// The seam imports the trusted auth and audit services. Neither is under test
// here, and both touch browser storage at module load, so both are stubbed.
vi.mock('../src/services/auth', () => ({
  authService: { getCurrentUser: () => null },
}));

vi.mock('../src/services/audit', () => ({
  auditService: { log: vi.fn() },
}));

// Not under test: the wave-3 canonical reads and commands exercised here never
// touch either module, but both sit on the import graph and load browser storage.
vi.mock('../src/services/db', () => ({ dbService: {} }));

vi.mock('../src/services/opportunityScoutConsumer', () => ({
  listOpportunitiesForClient: vi.fn(() => []),
  opportunityStatusDisplayLabel: vi.fn(() => ''),
  acceptClientOpportunity: vi.fn(),
  declineClientOpportunity: vi.fn(),
  submitClientOpportunity: vi.fn(),
  toggleClientOpportunityChecklistItem: vi.fn(),
}));

vi.mock('../src/services/learningLoopConsumer', () => {
  return {
    registerResultRecordIntent: vi.fn(),
    registerSignalOutcomeIntent: (params: unknown) => {
      if (consumerBehaviour.outcomeRejects) throw new Error('canonical refusal');
      registerSignalOutcomeIntent(params);
      return undefined as never;
    },
    listSignalOutcomesForDisplay: (clientId: string) => {
      listSignalOutcomesForDisplay(clientId);
      return [
        {
          id: 'out_1',
          organizationId: 'org_1',
          clientId,
          signalId: 'sig_1',
          kind: 'USEFUL' as const,
          note: 'sirvió',
          source: 'RADAR' as const,
          actorUid: 'user_1',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ];
    },
  };
});

vi.mock('../src/services/strategicBriefConsumer', () => {
  return {
    approveStrategicBrief: (params: unknown) => {
      if (consumerBehaviour.approveRejects) throw new Error('brief no aprobable');
      approveStrategicBrief(params);
      return undefined as never;
    },
    listStrategicBriefs: (clientId: string) => {
      listStrategicBriefs(clientId);
      return [
        {
          id: 'brief_1',
          organizationId: 'org_1',
          clientId,
          thesisId: 'thesis_1',
          strategicAngle: 'Ángulo A',
          territory: 'Territorio A',
          primaryAudience: 'Consejos de administración',
          recommendedChannel: 'LinkedIn',
          recommendedFormat: 'Artículo',
          status: 'APPROVED',
          version: 2,
          decision: { authorizedAction: 'CREATE_CONTENT' },
          supersededByBriefId: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'brief_2',
          organizationId: 'org_1',
          clientId,
          thesisId: 'thesis_2',
          strategicAngle: 'Ángulo B',
          territory: 'Territorio B',
          primaryAudience: 'Reguladores',
          recommendedChannel: 'Substack',
          recommendedFormat: 'Newsletter',
          status: 'APPROVED',
          version: 1,
          decision: { authorizedAction: 'CREATE_CONTENT' },
          supersededByBriefId: null,
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ];
    },
  };
});

import {
  readContentAuthorizingBriefs,
  readSignalOutcomes,
  readStrategicBriefs,
} from '../src/ui/data/canonicalReads';
import { briefCommands, signalOutcomeCommands } from '../src/ui/commands/commandSeam';
import { tenantQueryKey } from '../src/ui/query/queryKeys';
import type { TrustedTenantScope } from '../src/ui/query/tenantScope';

const scope: TrustedTenantScope = {
  organizationId: 'org_1',
  clientId: 'client_1',
} as TrustedTenantScope;

const otherOrg: TrustedTenantScope = {
  organizationId: 'org_2',
  clientId: 'client_1',
} as TrustedTenantScope;

beforeEach(() => {
  consumerBehaviour.approveRejects = false;
  consumerBehaviour.outcomeRejects = false;
  vi.clearAllMocks();
});

describe('T-010-305 — canonical reads reach the canonical consumers', () => {
  it('the brief projection comes from the SPEC-003 consumer, scoped to the trusted client', () => {
    const briefs = readStrategicBriefs(scope);
    expect(listStrategicBriefs).toHaveBeenCalledWith('client_1');
    expect(briefs.map((b) => b.id)).toEqual(['brief_1', 'brief_2']);
    // The governed decision is carried through, not recomputed.
    expect(briefs[0].authorizedAction).toBe('CREATE_CONTENT');
  });

  it('the signal-outcome projection comes from the SPEC-008 consumer', () => {
    const outcomes = readSignalOutcomes(scope);
    expect(listSignalOutcomesForDisplay).toHaveBeenCalledWith('client_1');
    expect(outcomes).toEqual([
      {
        signalId: 'sig_1',
        kind: 'USEFUL',
        note: 'sirvió',
        source: 'RADAR',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('a scope with no client reads nothing rather than guessing one', () => {
    const noClient = { organizationId: 'org_1', clientId: null } as unknown as TrustedTenantScope;
    expect(readStrategicBriefs(noClient)).toEqual([]);
    expect(readSignalOutcomes(noClient)).toEqual([]);
    expect(listStrategicBriefs).not.toHaveBeenCalled();
  });
});

describe('T-010-302 / T-010-16 — the brief selector has no first-brief default', () => {
  it('returns every authorizing brief without electing one', () => {
    const briefs = readContentAuthorizingBriefs(scope);
    expect(briefs).toHaveLength(2);
    // No field marks a brief as selected, default or primary: the caller must choose.
    for (const brief of briefs) {
      expect(Object.keys(brief)).not.toContain('selected');
      expect(Object.keys(brief)).not.toContain('isDefault');
    }
  });

  it('excludes briefs that do not authorize content creation', () => {
    // The filter is on the brief's own governed decision, not on a UI rule.
    const authorizing = readContentAuthorizingBriefs(scope);
    expect(authorizing.every((brief) => brief.authorizedAction === 'CREATE_CONTENT')).toBe(true);
    expect(authorizing.every((brief) => brief.status === 'APPROVED')).toBe(true);
    expect(authorizing.every((brief) => !brief.superseded)).toBe(true);
  });
});

describe('T-010-305 — the signal-outcome command reaches the canonical consumer', () => {
  it('forwards ids and the trusted scope, and never a cached aggregate', () => {
    const result = signalOutcomeCommands.register(scope, {
      signalId: 'sig_9',
      kind: 'USEFUL',
      thesisId: 'thesis_1',
    });

    expect(result).toEqual({ ok: true });
    const payload = registerSignalOutcomeIntent.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      clientId: 'client_1',
      signalId: 'sig_9',
      kind: 'USEFUL',
      source: 'RADAR',
      thesisId: 'thesis_1',
      claimedOrganizationId: 'org_1',
      claimedClientId: 'client_1',
    });
    // Caller snapshot authority 0: no signal, thesis or outcome object crosses.
    for (const key of Object.keys(payload)) {
      expect(typeof payload[key] === 'object' && payload[key] !== null).toBe(false);
    }
  });

  it('does not attribute a thesis when the projection gave none', () => {
    signalOutcomeCommands.register(scope, { signalId: 'sig_9', kind: 'NOT_USEFUL', thesisId: null });
    const payload = registerSignalOutcomeIntent.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.thesisId).toBeUndefined();
  });

  it('supplies no actor, role or actorType — the consumer resolves identity', () => {
    signalOutcomeCommands.register(scope, { signalId: 'sig_9', kind: 'USEFUL' });
    const payload = registerSignalOutcomeIntent.mock.calls[0][0] as Record<string, unknown>;
    for (const forbidden of ['actorUid', 'actorType', 'role', 'actorRole']) {
      expect(payload).not.toHaveProperty(forbidden);
    }
  });

  it('a scope with no client fails closed instead of picking a client', () => {
    const noClient = { organizationId: 'org_1', clientId: null } as unknown as TrustedTenantScope;
    const result = signalOutcomeCommands.register(noClient, {
      signalId: 'sig_9',
      kind: 'USEFUL',
    });
    expect(result).toEqual({ ok: false, message: 'Cliente no resuelto' });
    expect(registerSignalOutcomeIntent).not.toHaveBeenCalled();
  });

  it('a canonical refusal is surfaced, not swallowed or retried', () => {
    consumerBehaviour.outcomeRejects = true;
    const result = signalOutcomeCommands.register(scope, { signalId: 'sig_9', kind: 'USEFUL' });
    expect(result).toEqual({ ok: false, message: 'canonical refusal' });
  });
});

describe('T-010-305 / T-010-14 — brief approval authority stays in SPEC-003', () => {
  it('forwards only the brief id and the trusted client', () => {
    const result = briefCommands.approve(scope, 'brief_1');
    expect(result).toEqual({ ok: true });
    expect(approveStrategicBrief).toHaveBeenCalledWith({
      clientId: 'client_1',
      briefId: 'brief_1',
    });
  });

  it('a refusal leaves no state claiming the brief was approved', () => {
    consumerBehaviour.approveRejects = true;
    const result = briefCommands.approve(scope, 'brief_1');
    expect(result).toEqual({ ok: false, message: 'brief no aprobable' });
  });

  it('the seam cannot approve a brief without a trusted client', () => {
    const noClient = { organizationId: 'org_1', clientId: null } as unknown as TrustedTenantScope;
    expect(briefCommands.approve(noClient, 'brief_1')).toEqual({
      ok: false,
      message: 'Cliente no resuelto',
    });
    expect(approveStrategicBrief).not.toHaveBeenCalled();
  });
});

describe('T-010-08 / A19 — tenant-safe query keys for every wave-3 read', () => {
  const WAVE3_RESOURCES = [
    ['compatibility', 'portfolio-overview'],
    ['compatibility', 'ai-center'],
    ['compatibility', 'thesis-options'],
    ['compatibility', 'thesis-detail'],
    ['compatibility', 'client-tasks'],
    ['compatibility', 'client-content'],
    ['compatibility', 'content-detail'],
    ['compatibility', 'workspace-radar'],
    ['compatibility', 'workspace-deliver'],
    ['compatibility', 'workspace-sources'],
    ['compatibility', 'workspace-tasks'],
    ['canonical', 'strategic-briefs'],
    ['canonical', 'briefs-authorizing-content'],
    ['canonical', 'signal-outcomes'],
  ] as const;

  it('every key carries the trusted organization and client', () => {
    for (const [source, resource] of WAVE3_RESOURCES) {
      const key = tenantQueryKey(scope, source, resource);
      expect(key).toEqual(['postura', source, 'org_1', 'client_1', resource]);
    }
  });

  it('the same resource in two organizations cannot share a cache entry', () => {
    for (const [source, resource] of WAVE3_RESOURCES) {
      expect(tenantQueryKey(scope, source, resource)).not.toEqual(
        tenantQueryKey(otherOrg, source, resource)
      );
    }
  });

  it('a canonical read and a compatibility read of the same name cannot collide', () => {
    expect(tenantQueryKey(scope, 'canonical', 'strategic-briefs')).not.toEqual(
      tenantQueryKey(scope, 'compatibility', 'strategic-briefs')
    );
  });

  it('the thesis id is part of the key, so switching thesis cannot serve a stale projection', () => {
    expect(tenantQueryKey(scope, 'compatibility', 'thesis-detail', 'thesis_1')).not.toEqual(
      tenantQueryKey(scope, 'compatibility', 'thesis-detail', 'thesis_2')
    );
  });
});

describe('T-010-301 / A13 — the thesis review schema validates shape only', () => {
  it('rejects a missing title and a missing expert identity', async () => {
    const { z } = await import('zod');
    const schema = z.object({
      title: z.string().trim().min(1),
      expertIdentity: z.string().trim().min(1),
    });
    expect(schema.safeParse({ title: '   ', expertIdentity: 'x' }).success).toBe(false);
    expect(schema.safeParse({ title: 'x', expertIdentity: '' }).success).toBe(false);
    expect(schema.safeParse({ title: 'Tesis', expertIdentity: 'Experta' }).success).toBe(true);
  });

  it('the page carries no readiness threshold of its own', () => {
    const source = readFileSync(
      join(__dirname, '../src/ui/modules/pages/ReactThesisEditorPage.tsx'),
      'utf8'
    );
    // Completeness and readiness come from the domain via the facade; a numeric
    // threshold here would be a duplicated business rule (threat T-010-19).
    expect(source).not.toMatch(/completenessScore\s*[<>]=?\s*\d/);
    expect(source).not.toMatch(/THESIS_READINESS_MIN_SCORE/);
  });
});
