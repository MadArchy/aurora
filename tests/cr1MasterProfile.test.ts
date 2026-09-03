/**
 * CR-1 Workstream 2 — Master Profile / ApplyOnboardingStep tests.
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
  MasterProfileError,
  createApplyOnboardingStep,
  applyOnboardingStepToProfile,
  type MasterProfileRepository,
  type TrustedMasterProfileContext,
} from '../src/application/masterProfile';
import type { Client, ClientProfile, User } from '../src/types';
import {
  applyOnboardingStep,
  resetMasterProfileConsumerForTest,
} from '../src/services/masterProfileConsumer';
import { composeMasterProfile } from '../src/composition/masterProfile/composeMasterProfile';
import { authService } from '../src/services/auth';
import { dbService } from '../src/services/db';
import { computeProfileCoverage } from '../src/domain/profileCoverage';

function trusted(
  overrides: Partial<TrustedMasterProfileContext> = {}
): TrustedMasterProfileContext {
  return {
    actorId: 'admin_01',
    actorRole: 'ADMIN',
    organizationId: 'org_trust',
    clientId: 'client_trust',
    now: '2026-08-28T15:00:00.000Z',
    ...overrides,
  };
}

function memoryRepo() {
  const clients = new Map<string, Client>();
  const profiles = new Map<string, ClientProfile>();

  clients.set('client_trust', {
    id: 'client_trust',
    organizationId: 'org_trust',
    primaryManagerId: 'admin_01',
    firstName: 'Ana',
    lastName: 'Pérez',
    displayName: 'Ana Pérez',
    primaryEmail: 'ana@example.com',
    onboardingStatus: 'NOT_STARTED',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin_01',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'admin_01',
    activeThesesCount: 0,
    completedTasksCount: 0,
  });

  const repo: MasterProfileRepository = {
    getProfile(clientId) {
      return profiles.get(clientId) ?? null;
    },
    saveProfile(profile) {
      profiles.set(profile.clientId, { ...profile });
    },
    getClient(clientId) {
      return clients.get(clientId);
    },
    updateClient(clientId, updates) {
      const c = clients.get(clientId);
      if (!c) return null;
      const next = { ...c, ...updates, updatedAt: '2026-08-28T15:01:00.000Z' };
      clients.set(clientId, next);
      return next;
    },
  };

  return { repo, clients, profiles };
}

describe('CR-1 Master Profile — applyOnboardingStepToProfile Domain reuse', () => {
  it('applies step 1 fields and materializes Domain facts', () => {
    const result = applyOnboardingStepToProfile({
      existing: null,
      organizationId: 'org_trust',
      clientId: 'client_trust',
      step: 1,
      fields: {
        displayName: 'Ana Pérez',
        profession: 'Abogada',
        role: 'Socia',
        company: 'Firma',
        selfDescription: 'IP counsel',
      },
      now: '2026-08-28T15:00:00.000Z',
      actorId: 'admin_01',
    });
    expect(result.profile.identity.professionalHeadline).toBe('Abogada');
    expect(result.profile.career.profession).toBe('Abogada');
    expect(result.profile.facts?.some((f) => f.label === 'Headline profesional')).toBe(true);
    expect(result.completed).toBe(false);
    expect(result.clientPatches[0]?.onboardingStatus).toBe('IN_PROGRESS');
  });

  it('rejects invalid step without inventing new Domain step graph', () => {
    expect(() =>
      applyOnboardingStepToProfile({
        existing: null,
        organizationId: 'org_trust',
        clientId: 'client_trust',
        step: 99,
        fields: {},
        now: '2026-08-28T15:00:00.000Z',
        actorId: 'admin_01',
      })
    ).toThrow(MasterProfileError);
  });

  it('step 6 completes onboarding without inventing completeness Domain rule', () => {
    const result = applyOnboardingStepToProfile({
      existing: null,
      organizationId: 'org_trust',
      clientId: 'client_trust',
      step: 6,
      fields: { tone: 'authoritative', avoid: 'hype', compliance: 'no claims' },
      now: '2026-08-28T15:00:00.000Z',
      actorId: 'admin_01',
    });
    expect(result.completed).toBe(true);
    expect(result.profile.onboardingCompleted).toBe(true);
    expect(result.clientPatches.some((p) => p.onboardingStatus === 'COMPLETED')).toBe(true);
    expect(result.clientPatches.some((p) => p.profileCompleteness !== undefined)).toBe(false);
    expect(computeProfileCoverage(result.profile).totalConfirmed).toBeGreaterThan(0);
  });
});

describe('CR-1 Master Profile — ApplyOnboardingStep use case', () => {
  it('persists authorized step', () => {
    const { repo, profiles, clients } = memoryRepo();
    const apply = createApplyOnboardingStep({ profiles: repo });
    const result = apply({
      trusted: trusted(),
      step: 1,
      fields: {
        displayName: 'Ana Pérez',
        profession: 'Abogada',
        selfDescription: 'IP',
        role: 'Socia',
        company: 'Firma',
      },
    });
    expect(result.profile.career.profession).toBe('Abogada');
    expect(profiles.get('client_trust')?.onboardingCurrentStep).toBe(1);
    expect(clients.get('client_trust')?.onboardingStatus).toBe('IN_PROGRESS');
  });

  it('ATTACK: caller completeness spoof denied', () => {
    const { repo } = memoryRepo();
    const apply = createApplyOnboardingStep({ profiles: repo });
    expect(() =>
      apply({
        trusted: trusted(),
        step: 1,
        fields: { profession: 'X' },
        claimedProfileCompleteness: 100,
      })
    ).toThrow(/profileCompleteness/);
  });

  it('ATTACK: caller lifecycle-state spoof denied', () => {
    const { repo } = memoryRepo();
    const apply = createApplyOnboardingStep({ profiles: repo });
    expect(() =>
      apply({
        trusted: trusted(),
        step: 1,
        fields: { profession: 'X' },
        claimedOnboardingStatus: 'COMPLETED',
      })
    ).toThrow(/lifecycle/);
  });

  it('ATTACK: org spoof denied', () => {
    const { repo } = memoryRepo();
    const apply = createApplyOnboardingStep({ profiles: repo });
    expect(() =>
      apply({
        trusted: trusted(),
        step: 1,
        fields: { profession: 'X' },
        claimedOrganizationId: 'org_evil',
      })
    ).toThrow(/organizationId/);
  });

  it('ATTACK: client spoof denied', () => {
    const { repo } = memoryRepo();
    const apply = createApplyOnboardingStep({ profiles: repo });
    expect(() =>
      apply({
        trusted: trusted(),
        step: 1,
        fields: { profession: 'X' },
        claimedClientId: 'client_other',
      })
    ).toThrow(/clientId/);
  });

  it('repeated step overwrites same step fields (legacy parity)', () => {
    const { repo, profiles } = memoryRepo();
    const apply = createApplyOnboardingStep({ profiles: repo });
    apply({
      trusted: trusted(),
      step: 2,
      fields: { primaryGoal: 'Goal A', secondaryGoals: '' },
    });
    apply({
      trusted: trusted(),
      step: 2,
      fields: { primaryGoal: 'Goal B', secondaryGoals: 'x' },
    });
    expect(profiles.get('client_trust')?.goals.primaryGoal).toBe('Goal B');
  });

  it('out-of-order step allowed under existing product semantics', () => {
    const { repo, profiles } = memoryRepo();
    const apply = createApplyOnboardingStep({ profiles: repo });
    apply({
      trusted: trusted(),
      step: 5,
      fields: { linkedin: 'https://linkedin.com/in/a', website: '' },
    });
    expect(profiles.get('client_trust')?.socialLinks.linkedin).toContain('linkedin');
    expect(profiles.get('client_trust')?.onboardingCurrentStep).toBe(5);
  });
});

describe('CR-1 Master Profile consumer — tenant gate', () => {
  beforeEach(() => {
    resetMasterProfileConsumerForTest();
    vi.restoreAllMocks();
  });

  function admin(): User {
    return {
      uid: 'u_admin',
      email: 'admin@x.com',
      displayName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org_from_session',
      clientId: null,
      mustCompleteOnboarding: false,
      aiKeyManagementAllowed: false,
      locale: 'es',
      timezone: 'UTC',
    };
  }

  it('denies missing session', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(null);
    expect(() =>
      applyOnboardingStep({
        requestedClientId: 'any',
        step: 1,
        fields: { profession: 'X' },
      })
    ).toThrow(MasterProfileError);
  });

  it('denies CLIENT accessing another client', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
      ...admin(),
      uid: 'u_client',
      role: 'CLIENT',
      clientId: 'client_own',
      organizationId: 'org_from_session',
    });
    expect(() =>
      applyOnboardingStep({
        requestedClientId: 'client_other',
        step: 1,
        fields: { profession: 'X' },
      })
    ).toThrow(MasterProfileError);
  });

  it('legitimate ADMIN apply uses trusted client entitlement', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(admin());
    const created = dbService.createClient({
      organizationId: 'org_from_session',
      primaryManagerId: 'u_admin',
      firstName: 'Luis',
      lastName: 'Gómez',
      displayName: 'Luis Gómez',
      primaryEmail: `luis_${Date.now()}@example.com`,
      onboardingStatus: 'NOT_STARTED',
      profileCompleteness: 15,
      status: 'INVITED',
      avatarUrl: '',
      createdBy: 'u_admin',
      updatedBy: 'u_admin',
    });
    const result = applyOnboardingStep({
      requestedClientId: created.id,
      step: 1,
      fields: {
        displayName: 'Luis Gómez',
        profession: 'Consultor',
        role: 'Lead',
        company: 'Acme',
        selfDescription: 'Strategy',
      },
    });
    expect(result.profile.clientId).toBe(created.id);
    expect(result.profile.organizationId).toBe('org_from_session');
    expect(dbService.getMasterProfile(created.id)?.career.profession).toBe('Consultor');
  });
});

describe('CR-1 Master Profile architecture / adoption', () => {
  it('compose exposes applyOnboardingStep', () => {
    expect(typeof composeMasterProfile().applyOnboardingStep).toBe('function');
  });

  it('main.ts adopts masterProfileConsumer for #10', () => {
    const source = readLegacyControllerSurface();
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).toMatch(/applyOnboardingStep\s*\(/);
    expect(code).not.toMatch(/dbService\.applyOnboardingStep\s*\(/);
  });

  it('dbService.applyOnboardingStep is fail-closed deprecated', () => {
    expect(() => dbService.applyOnboardingStep('x', 1, {})).toThrow(/DEPRECATED/);
  });

  it('command seam exposes masterProfileCommands', () => {
    const source = readFileSync(resolve('src/ui/commands/commandSeam.ts'), 'utf8');
    expect(source).toMatch(/masterProfileCommands/);
    expect(source).toMatch(/applyOnboardingStep/);
  });

  it('no thesis mutation symbols in Master Profile Application', () => {
    const files = [
      'src/application/masterProfile/ApplyOnboardingStep.ts',
      'src/application/masterProfile/applyOnboardingStepLogic.ts',
      'src/services/masterProfileConsumer.ts',
    ];
    for (const file of files) {
      const source = readFileSync(resolve(file), 'utf8');
      expect(source).not.toMatch(/saveThesis|activateThesis|approveThesis/);
    }
  });

  it('Client Lifecycle Application files unchanged by this workstream markers', () => {
    const source = readFileSync(
      resolve('src/application/clientLifecycle/CreateClientWithInvite.ts'),
      'utf8'
    );
    expect(source).toMatch(/CreateClientWithInvite/);
  });
});
