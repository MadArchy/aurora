/**
 * CR-1 Wave B9 — #33 CreateContentDraft canonicalization + role reachability guards.
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
  createCreateContentDraft,
  type ContentBriefListPort,
  type ContentCreationPersistencePort,
  type ContentDraftGenerationPort,
  type ContentPublicationGatePort,
  type ContentRepository,
  type ContentStrategicDownstreamGatePort,
  type CurationThesisReadPort,
  type RecommendationReadPort,
  type TrustedExecutionDeliveryContext,
} from '../src/application/executionDelivery';
import type { ContentItem, PositioningThesis, Recommendation } from '../src/types';
import type { StrategicBrief } from '../src/domain/strategicBriefCore';
import { composeExecutionDelivery } from '../src/composition/executionDelivery/composeExecutionDelivery';
import { authService } from '../src/services/auth';
import { dbService } from '../src/services/db';
import {
  createContentDraft as createContentDraftConsumer,
  resetExecutionDeliveryConsumerForTest,
} from '../src/services/executionDeliveryConsumer';

function adminTrusted(
  overrides: Partial<TrustedExecutionDeliveryContext> = {}
): TrustedExecutionDeliveryContext {
  return {
    actorId: 'admin_01',
    actorRole: 'ADMIN',
    organizationId: 'org_ed',
    clientId: 'client_ed',
    now: '2026-09-05T16:00:00.000Z',
    ...overrides,
  };
}

function baseThesis(overrides: Partial<PositioningThesis> = {}): PositioningThesis {
  return {
    id: 'thesis_b9_1',
    organizationId: 'org_ed',
    clientId: 'client_ed',
    title: 'Thesis',
    expertIdentity: 'Expert',
    targetAudience: 'Leaders',
    domain: 'Governance',
    complianceRules: 'Precise',
    status: 'ACTIVE',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  } as PositioningThesis;
}

function baseBrief(overrides: Partial<StrategicBrief> = {}): StrategicBrief {
  return {
    id: 'brief_b9_1',
    organizationId: 'org_ed',
    clientId: 'client_ed',
    thesisId: 'thesis_b9_1',
    status: 'APPROVED',
    version: 2,
    signalIds: ['sig_b9_1'],
    supportingEvidenceIds: ['ev_b9_1'],
    decision: { authorizedAction: 'CREATE_CONTENT', rationale: 'ok' },
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  } as StrategicBrief;
}

function gateOk(
  overrides: Partial<{
    briefId: string;
    version: number;
    thesisId: string;
    signalIds: string[];
    evidenceIds: string[];
  }> = {}
) {
  return {
    ok: true as const,
    briefId: overrides.briefId ?? 'brief_b9_1',
    version: overrides.version ?? 2,
    thesisId: overrides.thesisId ?? 'thesis_b9_1',
    signalIds: overrides.signalIds ?? ['sig_b9_1'],
    evidenceIds: overrides.evidenceIds ?? ['ev_b9_1'],
    planId: 'plan_b9_1',
    planItemId: 'pi_b9_1',
  };
}

function memoryB9Ports(options: {
  gate?: ContentStrategicDownstreamGatePort['gate'];
  briefs?: ContentBriefListPort;
  thesis?: PositioningThesis;
  generate?: ContentDraftGenerationPort['generate'];
  publicationAllowed?: boolean;
  claimGateAllowed?: boolean;
  recommendation?: Recommendation;
} = {}) {
  const created: ContentItem[] = [];
  let generateCalls = 0;
  let createCalls = 0;

  const store = new Map<string, ContentItem>();

  const contents: ContentRepository = {
    getById(id) {
      return store.get(id);
    },
    saveDraft() {
      throw new Error('saveDraft not used in #33 create');
    },
    transitionPipeline(input) {
      const c = store.get(input.contentId)!;
      const next = { ...c, pipelineStatus: input.next, updatedAt: '2026-09-05T16:01:00.000Z' };
      store.set(input.contentId, next);
      return next;
    },
    saveClientRevision() {
      return null;
    },
    addFeedback(input) {
      return { id: 'fbk_1', ...input, createdAt: '2026-09-05T16:00:00.000Z' };
    },
  };

  const creation: ContentCreationPersistencePort = {
    createContent(content) {
      createCalls += 1;
      store.set(content.id, { ...content });
      created.push({ ...content });
    },
  };

  const generation: ContentDraftGenerationPort = {
    generate: options.generate ?? (async () => {
      generateCalls += 1;
      return {
        organizationId: 'org_ed',
        clientId: 'client_ed',
        thesisId: 'thesis_b9_1',
        type: 'LINKEDIN_ARTICLE' as const,
        title: 'Generated title',
        body: 'Generated body',
        targetPlatform: 'LinkedIn' as const,
        status: 'AI_GENERATED' as const,
        managerNotes: 'notes',
        claimSafety: {
          verdict: 'PASS' as const,
          summary: 'ok',
          reviewedAt: '2026-09-05T16:00:00.000Z',
          findings: [],
        },
      };
    }),
    reviewDraftClaims(body) {
      return {
        verdict: options.claimGateAllowed === false ? ('BLOCK' as const) : ('PASS' as const),
        summary: body.slice(0, 20),
        reviewedAt: '2026-09-05T16:00:00.000Z',
        findings: [],
      };
    },
  };

  const downstreamGate: ContentStrategicDownstreamGatePort = {
    gate: options.gate ?? ((_clientId, briefId, _action) => {
      if (!briefId) return { ok: false, message: 'strategicBriefId is required for planned downstream actions.' };
      return gateOk({ briefId });
    }),
  };

  const briefs: ContentBriefListPort =
    options.briefs ??
    ({
      listApprovedBriefs: () => [baseBrief()],
      findApprovedBriefForSignal: () => baseBrief({ decision: { authorizedAction: 'CREATE_TASK', rationale: 'task' } }),
    } as ContentBriefListPort);

  const theses: CurationThesisReadPort = {
    getById: () => options.thesis ?? baseThesis(),
  };

  const recommendations: RecommendationReadPort = {
    getById: (id) =>
      options.recommendation && options.recommendation.id === id ? options.recommendation : undefined,
  };

  const publicationGate: ContentPublicationGatePort = {
    authorize: () => ({
      allowed: options.publicationAllowed !== false && options.claimGateAllowed !== false,
      reason: options.claimGateAllowed === false ? 'Claim gate blocks' : undefined,
    }),
  };

  const create = createCreateContentDraft({
    generation,
    creation,
    downstreamGate,
    briefs,
    theses,
    recommendations,
    contents,
    publicationGate,
  });

  return {
    create,
    getCreated: () => created,
    getStore: () => store,
    getGenerateCalls: () => generateCalls,
    getCreateCalls: () => createCalls,
  };
}

function setupAdminGate(clientId = 'client_ed', organizationId = 'org_ed') {
  vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
    uid: 'admin_01',
    email: 'a@x.com',
    displayName: 'Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    organizationId,
  });
  vi.spyOn(dbService, 'getClientById').mockImplementation((id) =>
    id === clientId
      ? ({
          id: clientId,
          organizationId,
          displayName: 'Client',
          status: 'ACTIVE',
        } as never)
      : undefined
  );
}

describe('CR-1 Wave B9 #33 — core authority', () => {
  beforeEach(() => {
    resetExecutionDeliveryConsumerForTest();
    vi.restoreAllMocks();
  });

  it('ADMIN valid FORM_GENERATE — gate before generation before persist', async () => {
    const ports = memoryB9Ports();
    const result = await ports.create({
      trusted: adminTrusted(),
      intent: {
        kind: 'FORM_GENERATE',
        strategicBriefId: 'brief_b9_1',
        topic: 'Topic',
        format: 'LINKEDIN_ARTICLE',
      },
    });
    expect(ports.getGenerateCalls()).toBe(1);
    expect(ports.getCreateCalls()).toBe(1);
    expect(result.content.strategicBriefId).toBe('brief_b9_1');
    expect(result.content.id).toMatch(/^cnt_/);
  });

  it('CLIENT, missing session, and cross-tenant denied before generation', async () => {
    setupAdminGate();
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
      uid: 'client_01',
      email: 'c@x.com',
      displayName: 'Client',
      role: 'CLIENT',
      status: 'ACTIVE',
      organizationId: 'org_ed',
      clientId: 'client_ed',
    });
    await expect(
      createContentDraftConsumer({
        requestedClientId: 'client_ed',
        intent: {
          kind: 'FORM_GENERATE',
          strategicBriefId: 'brief_b9_1',
          topic: 'Topic',
          format: 'LINKEDIN_ARTICLE',
        },
      })
    ).rejects.toThrow(/ADMIN role/);

    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(null);
    await expect(
      createContentDraftConsumer({
        requestedClientId: 'client_ed',
        intent: {
          kind: 'FORM_GENERATE',
          strategicBriefId: 'brief_b9_1',
          topic: 'Topic',
          format: 'LINKEDIN_ARTICLE',
        },
      })
    ).rejects.toThrow(/Sesión no disponible/);

    setupAdminGate('client_ed', 'org_ed');
    vi.spyOn(dbService, 'getClientById').mockReturnValue({
      id: 'other_client',
      organizationId: 'org_other',
      displayName: 'Other',
      status: 'ACTIVE',
    } as never);
    await expect(
      createContentDraftConsumer({
        requestedClientId: 'other_client',
        intent: {
          kind: 'FORM_GENERATE',
          strategicBriefId: 'brief_b9_1',
          topic: 'Topic',
          format: 'LINKEDIN_ARTICLE',
        },
      })
    ).rejects.toThrow(/organización/);
  });

  it('caller Brief/thesis/status/contentId spoof denied', async () => {
    const ports = memoryB9Ports();
    await expect(
      ports.create({
        trusted: adminTrusted(),
        intent: {
          kind: 'FORM_GENERATE',
          strategicBriefId: 'brief_b9_1',
          topic: 'Topic',
          format: 'LINKEDIN_ARTICLE',
        },
        claimedStrategicBriefId: 'brief_attacker',
      })
    ).rejects.toThrow(/not accepted as authority/);
    expect(ports.getGenerateCalls()).toBe(0);
  });

  it('missing Brief and ambiguous scientific Brief fail closed', async () => {
    const portsMissing = memoryB9Ports({
      gate: () => ({ ok: false, message: 'strategicBriefId is required for planned downstream actions.' }),
    });
    await expect(
      portsMissing.create({
        trusted: adminTrusted(),
        intent: {
          kind: 'FORM_GENERATE',
          strategicBriefId: '',
          topic: 'Topic',
          format: 'LINKEDIN_ARTICLE',
        },
      })
    ).rejects.toThrow(/Strategic Brief id is required/);

    const portsAmbiguous = memoryB9Ports({
      briefs: {
        listApprovedBriefs: () => [baseBrief(), baseBrief({ id: 'brief_b9_2' })],
        findApprovedBriefForSignal: () => undefined,
      },
    });
    await expect(
      portsAmbiguous.create({
        trusted: adminTrusted(),
        intent: {
          kind: 'SCIENTIFIC_ARTICLE',
          title: 'Paper title',
          why: 'why',
          venue: 'Journal',
          roleAngle: 'Role',
        },
      })
    ).rejects.toThrow(/Multiple approved Briefs match/);
  });
});

describe('CR-1 Wave B9 #33 — intent paths', () => {
  it('FORM_GENERATE maps CREATE_CONTENT gate and provenance', async () => {
    const ports = memoryB9Ports({
      gate: (_c, _b, action) => {
        expect(action).toBe('CREATE_CONTENT');
        return gateOk();
      },
      generate: async (_t, topic, format, extras) => {
        expect(topic).toBe('My topic');
        expect(format).toBe('VIDEO_SCRIPT');
        expect(extras?.angle).toBe('sharp');
        return {
          organizationId: 'org_ed',
          clientId: 'client_ed',
          thesisId: 'thesis_b9_1',
          type: 'VIDEO_SCRIPT',
          title: 'T',
          body: 'B',
          teleprompterScript: 'B',
          targetPlatform: 'LinkedIn',
          status: 'AI_GENERATED',
          managerNotes: 'n',
        };
      },
    });
    const result = await ports.create({
      trusted: adminTrusted(),
      intent: {
        kind: 'FORM_GENERATE',
        strategicBriefId: 'brief_b9_1',
        topic: 'My topic',
        format: 'VIDEO_SCRIPT',
        angle: 'sharp',
      },
    });
    expect(result.content.signalIds).toEqual(['sig_b9_1']);
    expect(result.content.supportingEvidenceIds).toEqual(['ev_b9_1']);
    expect(result.content.strategicBriefVersion).toBe(2);
    expect(result.pipelineSynced).toBe(true);
  });

  it('SCIENTIFIC_ARTICLE uses ACADEMIC_PAPER extras and unique Brief', async () => {
    const ports = memoryB9Ports({
      generate: async (_t, topic, format, extras) => {
        expect(format).toBe('ACADEMIC_PAPER');
        expect(topic).toBe('Sci title');
        expect(extras?.roleAngle).toBe('Role');
        expect(extras?.venueLabel).toBe('Venue');
        expect(extras?.why).toBe('Why');
        return {
          organizationId: 'org_ed',
          clientId: 'client_ed',
          thesisId: 'thesis_b9_1',
          type: 'ACADEMIC_PAPER',
          title: topic,
          body: 'Paper body',
          targetPlatform: 'LegalJournal',
          status: 'DRAFT',
          managerNotes: 'sci',
        };
      },
    });
    const result = await ports.create({
      trusted: adminTrusted(),
      intent: {
        kind: 'SCIENTIFIC_ARTICLE',
        title: 'Sci title',
        why: 'Why',
        venue: 'Venue',
        roleAngle: 'Role',
      },
    });
    expect(result.content.type).toBe('ACADEMIC_PAPER');
    expect(result.content.status).toBe('DRAFT');
  });

  it('RECOMMENDATION_TASK_SCRIPT uses CREATE_TASK gate and proposedAngle', async () => {
    const rec: Recommendation = {
      id: 'rec_b9_1',
      clientId: 'client_ed',
      thesisId: 'thesis_b9_1',
      type: 'VIDEO_SHORT',
      proposedAngle: 'Angle from recommendation',
      strategicRationale: 'r',
      urgency: 'HIGH',
      impactScore: 90,
      status: 'GENERATED',
      createdAt: '2026-09-01T00:00:00.000Z',
      signalId: 'sig_b9_1',
    };
    const ports = memoryB9Ports({
      gate: (_c, _b, action) => {
        expect(action).toBe('CREATE_TASK');
        return gateOk();
      },
      recommendation: rec,
      generate: async (_t, topic) => {
        expect(topic).toBe('Angle from recommendation');
        return {
          organizationId: 'org_ed',
          clientId: 'client_ed',
          thesisId: 'thesis_b9_1',
          type: 'VIDEO_SCRIPT',
          title: 'Script',
          body: 'Script body',
          teleprompterScript: 'Script body',
          targetPlatform: 'LinkedIn',
          status: 'AI_GENERATED',
          managerNotes: 'n',
        };
      },
    });
    const result = await ports.create({
      trusted: adminTrusted(),
      intent: { kind: 'RECOMMENDATION_TASK_SCRIPT', recommendationId: 'rec_b9_1' },
    });
    expect(result.content.status).toBe('AI_GENERATED');
    expect(result.advanced).toBe(true);
    expect(result.recommendation?.proposedAngle).toBe('Angle from recommendation');
  });

  it('RECOMMENDATION advanced=false still persists ContentItem', async () => {
    const rec: Recommendation = {
      id: 'rec_b9_2',
      clientId: 'client_ed',
      thesisId: 'thesis_b9_1',
      type: 'VIDEO_SHORT',
      proposedAngle: 'Blocked angle',
      strategicRationale: 'r',
      urgency: 'MEDIUM',
      impactScore: 50,
      status: 'GENERATED',
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    const ports = memoryB9Ports({
      recommendation: rec,
      claimGateAllowed: false,
    });
    const result = await ports.create({
      trusted: adminTrusted(),
      intent: { kind: 'RECOMMENDATION_TASK_SCRIPT', recommendationId: 'rec_b9_2' },
    });
    expect(result.advanced).toBe(false);
    expect(ports.getCreateCalls()).toBe(1);
    expect(ports.getCreated()[0]?.id).toBe(result.content.id);
  });

  it('repeat create produces new cnt id', async () => {
    const ports = memoryB9Ports();
    const a = await ports.create({
      trusted: adminTrusted(),
      intent: {
        kind: 'FORM_GENERATE',
        strategicBriefId: 'brief_b9_1',
        topic: 'One',
        format: 'LINKEDIN_ARTICLE',
      },
    });
    const b = await ports.create({
      trusted: adminTrusted({ now: '2026-09-05T16:05:00.000Z' }),
      intent: {
        kind: 'FORM_GENERATE',
        strategicBriefId: 'brief_b9_1',
        topic: 'Two',
        format: 'LINKEDIN_ARTICLE',
      },
    });
    expect(a.content.id).not.toBe(b.content.id);
  });

  it('AI failure before persist — no ContentItem', async () => {
    const ports = memoryB9Ports({
      generate: async () => {
        throw new Error('AI quota exceeded');
      },
    });
    await expect(
      ports.create({
        trusted: adminTrusted(),
        intent: {
          kind: 'FORM_GENERATE',
          strategicBriefId: 'brief_b9_1',
          topic: 'Topic',
          format: 'LINKEDIN_ARTICLE',
        },
      })
    ).rejects.toThrow(/AI quota exceeded/);
    expect(ports.getCreateCalls()).toBe(0);
  });
});

describe('CR-1 Wave B9 #33 — Application boundary guards', () => {
  it('CreateContentDraft does not mutate tasks or recommendations', () => {
    const source = readFileSync(resolve('src/application/executionDelivery/CreateContentDraft.ts'), 'utf8');
    expect(source).toMatch(/requireAdminRole/);
    expect(source).not.toMatch(/\baddTask\b|\bupdateTaskStatus\b|\bupdateRecommendationStatus\b/);
    expect(source).not.toMatch(/\bcreateSaveContentDraft\b|\breviewClientArticle\b|\bsendDeliveryPackage\b/);
    expect(source).not.toMatch(/executeContentDraftViaGateway|AiCompleteHttpClient/);
  });

  it('no audits on consumer #33 path', () => {
    const source = readFileSync(resolve('src/services/executionDeliveryConsumer.ts'), 'utf8');
    const start = source.indexOf('/** Registry #33');
    const end = source.indexOf('/** Registry #28', start);
    const block = source.slice(start, end);
    expect(block).toMatch(/createContentDraft/);
    expect(block).not.toMatch(/auditService\.log/);
  });
});

describe('CR-1 Wave B9 #33 — handler and presentation guards', () => {
  it('contentHandlers delegates create — no direct generateContentDraft or saveContent', () => {
    const source = readFileSync(resolve('src/ui/legacy/handlers/contentHandlers.ts'), 'utf8');
    const createBlock = source.slice(0, source.indexOf('btn-open-content-editor'));
    expect(createBlock).toMatch(/createContentDraft\s*\(/);
    expect(createBlock).not.toMatch(/aiService\.generateContentDraft/);
    expect(createBlock).not.toMatch(/dbService\.saveContent/);
    expect(createBlock).not.toMatch(/createId\s*\(\s*['"]cnt['"]\s*\)/);
    expect(createBlock).not.toMatch(/saveContentWithClaimGate/);
  });

  it('path C preserves legacy #27 sequencing after canonical #33', () => {
    const source = readFileSync(resolve('src/ui/legacy/handlers/contentHandlers.ts'), 'utf8');
    const block = source.slice(source.indexOf('.btn-create-task-from-rec'));
    expect(block).toMatch(/createContentDraft\s*\(/);
    expect(block).toMatch(/dbService\.addTask\s*\(/);
    expect(block).toMatch(/updateRecommendationStatus/);
    expect(block.indexOf('createContentDraft')).toBeLessThan(block.indexOf('dbService.addTask'));
  });

  it('path C AI failure does not call addTask', () => {
    const source = readFileSync(resolve('src/ui/legacy/handlers/contentHandlers.ts'), 'utf8');
    const block = source.slice(source.indexOf('.btn-create-task-from-rec'));
    expect(block).toMatch(/catch\s*\(\s*error\s*\)/);
    expect(block.slice(block.indexOf('catch')).indexOf('addTask')).toBe(-1);
  });
});

describe('CR-1 Wave B9 #33 — architecture guards', () => {
  it('compose exposes seventeen commands including CreateContentDraft', () => {
    const c = composeExecutionDelivery();
    expect(typeof c.createContentDraft).toBe('function');
    expect(Object.keys(c)).toHaveLength(17);
  });

  it('single create persistence authority via ContentCreationPersistencePort adapter', () => {
    const adapter = readFileSync(
      resolve('src/infrastructure/executionDelivery/DbCreateContentDraftAdapters.ts'),
      'utf8'
    );
    expect(adapter).toMatch(/dbService\.saveContent/);
    expect(adapter).toMatch(/aiService\.generateContentDraft/);
    const handler = readFileSync(resolve('src/ui/legacy/handlers/contentHandlers.ts'), 'utf8');
    expect(handler).not.toMatch(/dbService\.saveContent/);
  });
});

describe('CR-1 Wave B9 #33 — role reachability architecture guards', () => {
  it('ADMIN workspace can reach generate-content modal surface', () => {
    const workspace = readFileSync(resolve('src/components/ClientWorkspace.ts'), 'utf8');
    expect(workspace).toMatch(/btn-open-generate-content/);
    expect(workspace).toMatch(/showCreate:\s*true/);
  });
});
