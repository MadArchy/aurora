/**
 * CR-1 Workstream 3 — Thesis Lifecycle Application tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.hoisted(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new (class {
    private store = new Map<string, string>();
    clear() {
      this.store.clear();
    }
    getItem(key: string) {
      return this.store.get(key) ?? null;
    }
    setItem(key: string, value: string) {
      this.store.set(key, value);
    }
    removeItem(key: string) {
      this.store.delete(key);
    }
  })() as Storage;
});

import {
  ThesisLifecycleError,
  createActivateThesis,
  createDecideThesisClientReview,
  createSaveThesis,
  type ThesisRepository,
  type TrustedThesisLifecycleContext,
} from '../src/application/thesisLifecycle';
import type { PositioningThesis, ThesisEditableFields, User } from '../src/types';
import {
  resetThesisLifecycleConsumerForTest,
  saveThesis,
} from '../src/services/thesisLifecycleConsumer';
import { composeThesisLifecycle } from '../src/composition/thesisLifecycle/composeThesisLifecycle';
import { authService } from '../src/services/auth';
import { dbService } from '../src/services/db';

function adminTrusted(
  overrides: Partial<TrustedThesisLifecycleContext> = {}
): TrustedThesisLifecycleContext {
  return {
    actorId: 'admin_01',
    actorRole: 'ADMIN',
    organizationId: 'org_trust',
    clientId: 'client_trust',
    now: '2026-08-28T16:00:00.000Z',
    ...overrides,
  };
}

function clientTrusted(
  overrides: Partial<TrustedThesisLifecycleContext> = {}
): TrustedThesisLifecycleContext {
  return adminTrusted({ actorId: 'client_01', actorRole: 'CLIENT', ...overrides });
}

function baseFields(overrides: Partial<ThesisEditableFields> = {}): ThesisEditableFields {
  return {
    title: 'Patent Strategy',
    expertIdentity: 'IP counsel for AI adoption',
    targetAudience: 'General counsel',
    domain: 'Intellectual Property',
    objective: 'Be the go-to advisor',
    proofPoints: ['Case study A', 'Publication B'],
    voiceAndTone: 'Authoritative',
    complianceRules: 'No hype',
    ...overrides,
  };
}

/** Fields that satisfy assertThesisReadyForReview (≥70 + hard blocks + audiences). */
function readyFields(overrides: Partial<ThesisEditableFields> = {}): ThesisEditableFields {
  return baseFields({
    identityCurrent: 'Known as litigator',
    perceptionTarget: 'AI governance expert',
    audiences: [
      { id: 'a1', name: 'GC', tier: 'COMMERCIAL', weight: 100, keywords: ['gc'] },
    ],
    territories: [
      { id: 't1', name: 'LatAm IP', weight: 100, keywords: ['latam'] },
    ],
    objectives: [{ id: 'o1', kind: 'BUSINESS', weight: 100 }],
    voiceProfile: {
      authority: 80,
      technicalDepth: 70,
      academic: 40,
      executive: 70,
      accessible: 50,
      provocative: 20,
      commercial: 60,
      legalPrecision: 90,
      humor: 10,
    },
    limits: { hardBlocks: ['no hype promises'], softAvoid: ['consumer AI'] },
    ...overrides,
  });
}

function memoryTheses() {
  const store = new Map<string, PositioningThesis>();
  const repo: ThesisRepository = {
    getById(clientId, thesisId) {
      const t = store.get(thesisId);
      return t && t.clientId === clientId ? t : undefined;
    },
    listByClient(clientId) {
      return [...store.values()].filter((t) => t.clientId === clientId);
    },
    save(thesis) {
      store.set(thesis.id, { ...thesis });
    },
  };
  return { repo, store };
}

describe('CR-1 Thesis Lifecycle — SaveThesis', () => {
  it('saves draft with Domain planThesisSave', () => {
    const { repo, store } = memoryTheses();
    const save = createSaveThesis({ theses: repo });
    const result = save({
      trusted: adminTrusted(),
      thesisId: 'thesis_a',
      intent: 'draft',
      fields: baseFields(),
    });
    expect(result.thesis.status).toBe('DRAFT');
    expect(store.get('thesis_a')?.title).toBe('Patent Strategy');
    expect(result.notifyClient).toBe(false);
  });

  it('submits for review → UNDER_REVIEW', () => {
    const { repo } = memoryTheses();
    const save = createSaveThesis({ theses: repo });
    const result = save({
      trusted: adminTrusted(),
      thesisId: 'thesis_b',
      intent: 'submit_review',
      fields: readyFields(),
    });
    expect(result.thesis.status).toBe('UNDER_REVIEW');
    expect(result.thesis.clientApprovalStatus).toBe('PENDING');
    expect(result.notifyClient).toBe(true);
  });

  it('incomplete submit_review denied by Domain readiness', () => {
    const save = createSaveThesis({ theses: memoryTheses().repo });
    expect(() =>
      save({
        trusted: adminTrusted(),
        thesisId: 'thesis_incomplete',
        intent: 'submit_review',
        fields: baseFields(),
      })
    ).toThrow(/Estructura|Completa/i);
  });

  it('ATTACK: missing thesisId denied (no positional)', () => {
    const save = createSaveThesis({ theses: memoryTheses().repo });
    expect(() =>
      save({
        trusted: adminTrusted(),
        thesisId: '  ',
        intent: 'draft',
        fields: baseFields(),
      })
    ).toThrow(/thesisId/);
  });

  it('ATTACK: CLIENT cannot save', () => {
    const save = createSaveThesis({ theses: memoryTheses().repo });
    expect(() =>
      save({
        trusted: clientTrusted(),
        thesisId: 'thesis_x',
        intent: 'draft',
        fields: baseFields(),
      })
    ).toThrow(/ADMIN/);
  });

  it('ATTACK: org spoof denied', () => {
    const save = createSaveThesis({ theses: memoryTheses().repo });
    expect(() =>
      save({
        trusted: adminTrusted(),
        thesisId: 'thesis_x',
        intent: 'draft',
        fields: baseFields(),
        claimedOrganizationId: 'org_evil',
      })
    ).toThrow(/organization/i);
  });

  it('ATTACK: approval spoof denied', () => {
    const save = createSaveThesis({ theses: memoryTheses().repo });
    expect(() =>
      save({
        trusted: adminTrusted(),
        thesisId: 'thesis_x',
        intent: 'draft',
        fields: baseFields(),
        claimedClientApprovalStatus: 'APPROVED',
      })
    ).toThrow(/lifecycle|approval/i);
  });

  it('repeated draft save preserves id and revises fields', () => {
    const { repo, store } = memoryTheses();
    const save = createSaveThesis({ theses: repo });
    save({
      trusted: adminTrusted(),
      thesisId: 'thesis_r',
      intent: 'draft',
      fields: baseFields({ title: 'V1' }),
    });
    save({
      trusted: adminTrusted({ now: '2026-08-28T17:00:00.000Z' }),
      thesisId: 'thesis_r',
      intent: 'draft',
      fields: baseFields({ title: 'V2' }),
    });
    expect(store.size).toBe(1);
    expect(store.get('thesis_r')?.title).toBe('V2');
    expect(store.get('thesis_r')?.status).toBe('DRAFT');
  });
});

describe('CR-1 Thesis Lifecycle — client review + activate', () => {
  function seedUnderReview(repo: ThesisRepository) {
    const save = createSaveThesis({ theses: repo });
    return save({
      trusted: adminTrusted(),
      thesisId: 'thesis_flow',
      intent: 'submit_review',
      fields: readyFields(),
    }).thesis;
  }

  it('client approve then manager activate', () => {
    const { repo, store } = memoryTheses();
    seedUnderReview(repo);
    const decide = createDecideThesisClientReview({ theses: repo });
    const approved = decide({
      trusted: clientTrusted(),
      thesisId: 'thesis_flow',
      decision: 'approve',
    });
    expect(approved.awaitsManagerActivation).toBe(true);
    expect(approved.thesis.clientApprovalStatus).toBe('APPROVED');
    expect(approved.thesis.status).toBe('UNDER_REVIEW');

    const activate = createActivateThesis({ theses: repo });
    const activated = activate({
      trusted: adminTrusted(),
      thesisId: 'thesis_flow',
    });
    expect(activated.thesis.status).toBe('ACTIVE');
    expect(store.get('thesis_flow')?.status).toBe('ACTIVE');
  });

  it('client request_changes returns DRAFT', () => {
    const { repo } = memoryTheses();
    seedUnderReview(repo);
    const decide = createDecideThesisClientReview({ theses: repo });
    const result = decide({
      trusted: clientTrusted(),
      thesisId: 'thesis_flow',
      decision: 'request_changes',
      feedback: 'Narrow the audience',
    });
    expect(result.thesis.status).toBe('DRAFT');
    expect(result.thesis.clientApprovalStatus).toBe('CHANGES_REQUESTED');
  });

  it('ATTACK: activate without client approval denied', () => {
    const { repo } = memoryTheses();
    seedUnderReview(repo);
    const activate = createActivateThesis({ theses: repo });
    expect(() =>
      activate({
        trusted: adminTrusted(),
        thesisId: 'thesis_flow',
      })
    ).toThrow(/aprobado|aproba/i);
  });

  it('ATTACK: ADMIN cannot client-approve', () => {
    const { repo } = memoryTheses();
    seedUnderReview(repo);
    const decide = createDecideThesisClientReview({ theses: repo });
    expect(() =>
      decide({
        trusted: adminTrusted(),
        thesisId: 'thesis_flow',
        decision: 'approve',
      })
    ).toThrow(/CLIENT/);
  });

  it('ATTACK: cross-client thesis denied', () => {
    const { repo } = memoryTheses();
    seedUnderReview(repo);
    const decide = createDecideThesisClientReview({ theses: repo });
    expect(() =>
      decide({
        trusted: clientTrusted({ clientId: 'client_other' }),
        thesisId: 'thesis_flow',
        decision: 'approve',
      })
    ).toThrow(ThesisLifecycleError);
  });

  it('repeated activation denied', () => {
    const { repo } = memoryTheses();
    seedUnderReview(repo);
    createDecideThesisClientReview({ theses: repo })({
      trusted: clientTrusted(),
      thesisId: 'thesis_flow',
      decision: 'approve',
    });
    const activate = createActivateThesis({ theses: repo });
    activate({ trusted: adminTrusted(), thesisId: 'thesis_flow' });
    expect(() => activate({ trusted: adminTrusted(), thesisId: 'thesis_flow' })).toThrow(
      /activa/i
    );
  });
});

describe('CR-1 Thesis Lifecycle multi-thesis', () => {
  it('two theses coexist; commands require explicit ids', () => {
    const { repo, store } = memoryTheses();
    const save = createSaveThesis({ theses: repo });
    save({
      trusted: adminTrusted(),
      thesisId: 'thesis_one',
      intent: 'draft',
      fields: baseFields({ title: 'One' }),
    });
    save({
      trusted: adminTrusted(),
      thesisId: 'thesis_two',
      intent: 'draft',
      fields: baseFields({ title: 'Two' }),
    });
    expect(store.size).toBe(2);
    expect(repo.getById('client_trust', 'thesis_two')?.title).toBe('Two');
  });

  it('activate targets explicit thesisId among many', () => {
    const { repo, store } = memoryTheses();
    const save = createSaveThesis({ theses: repo });
    const decide = createDecideThesisClientReview({ theses: repo });
    const activate = createActivateThesis({ theses: repo });
    save({
      trusted: adminTrusted(),
      thesisId: 'keep_draft',
      intent: 'draft',
      fields: baseFields({ title: 'Keep' }),
    });
    save({
      trusted: adminTrusted(),
      thesisId: 'activate_me',
      intent: 'submit_review',
      fields: readyFields({ title: 'Activate' }),
    });
    decide({
      trusted: clientTrusted(),
      thesisId: 'activate_me',
      decision: 'approve',
    });
    activate({ trusted: adminTrusted(), thesisId: 'activate_me' });
    expect(store.get('activate_me')?.status).toBe('ACTIVE');
    expect(store.get('keep_draft')?.status).toBe('DRAFT');
  });
});

describe('CR-1 Thesis Lifecycle consumer gate', () => {
  beforeEach(() => {
    resetThesisLifecycleConsumerForTest();
    vi.restoreAllMocks();
  });

  it('denies missing session', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(null);
    expect(() =>
      saveThesis({
        requestedClientId: 'c1',
        thesisId: 't1',
        intent: 'draft',
        fields: baseFields(),
      })
    ).toThrow(ThesisLifecycleError);
  });

  it('legitimate ADMIN save via consumer', () => {
    const admin: User = {
      uid: 'u_admin',
      email: 'a@x.com',
      displayName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org_sess',
      clientId: null,
      mustCompleteOnboarding: false,
      aiKeyManagementAllowed: false,
      locale: 'es',
      timezone: 'UTC',
    };
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(admin);
    const client = dbService.createClient({
      organizationId: 'org_sess',
      primaryManagerId: 'u_admin',
      firstName: 'A',
      lastName: 'B',
      displayName: 'A B',
      primaryEmail: `t_${Date.now()}@ex.com`,
      onboardingStatus: 'IN_PROGRESS',
      profileCompleteness: 20,
      status: 'ACTIVE',
      avatarUrl: '',
      createdBy: 'u_admin',
      updatedBy: 'u_admin',
    });
    const result = saveThesis({
      requestedClientId: client.id,
      thesisId: `thesis_${Date.now()}`,
      intent: 'draft',
      fields: baseFields(),
    });
    expect(result.thesis.organizationId).toBe('org_sess');
    expect(result.thesis.clientId).toBe(client.id);
  });
});

describe('CR-1 Thesis Lifecycle architecture', () => {
  it('compose exposes three commands', () => {
    const c = composeThesisLifecycle();
    expect(typeof c.saveThesis).toBe('function');
    expect(typeof c.decideThesisClientReview).toBe('function');
    expect(typeof c.activateThesis).toBe('function');
  });

  it('main.ts adopts thesisLifecycleConsumer for #11/#12/#13', () => {
    const source = readLegacyControllerSurface();
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).toMatch(/saveThesis\s*\(/);
    expect(code).toMatch(/activateThesis\s*\(/);
    expect(code).toMatch(/decideThesisClientReview\s*\(/);
    expect(code).not.toMatch(/planThesisSave\s*\(/);
    expect(code).not.toMatch(/activateThesisByManager\s*\(/);
    expect(code).not.toMatch(/approveThesisByClient\s*\(/);
    expect(code).not.toMatch(/rejectThesisByClient\s*\(/);
  });

  it('command seam exposes thesisLifecycleCommands', () => {
    const source = readFileSync(resolve('src/ui/commands/commandSeam.ts'), 'utf8');
    expect(source).toMatch(/thesisLifecycleCommands/);
  });

  it('no SPEC-001 routing mutation in thesis lifecycle Application', () => {
    const files = [
      'src/application/thesisLifecycle/SaveThesis.ts',
      'src/application/thesisLifecycle/ActivateThesis.ts',
      'src/application/thesisLifecycle/DecideThesisClientReview.ts',
    ];
    for (const file of files) {
      const source = readFileSync(resolve(file), 'utf8');
      expect(source).not.toMatch(/ScoreAndRoute|OverrideSignal|routeSignal/);
    }
  });
});
