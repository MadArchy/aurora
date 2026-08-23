import { describe, expect, it } from 'vitest';
import {
  MAX_REPAIR_ATTEMPTS,
  AI_OPERATIONS,
  markTenantValidated,
  createGatewayError,
  errorExposesSecrets,
  DEFAULT_MODEL_ROLE_BY_OPERATION,
  isAiModelRole,
  type ValidatedAiTenantContext,
} from '../src/domain/ai';
import {
  isOperationSupported,
  validateTenantContextForOperation,
  ContentDraftOutputSchema,
  ThesisChallengeOutputSchema,
  AdvisorCurationAngleOutputSchema,
  resolveOperationSchema,
  resolveSchemaIdentity,
  validateAiOutput,
  runValidationPipeline,
  canAttemptRepair,
  PromptIdentitySchema,
  UnimplementedAiGateway,
  type AiGatewayRequest,
} from '../src/application/ai';

describe('SPEC-005 Phase 1 — AiOperation taxonomy', () => {
  it('A: supported operation accepted', () => {
    expect(isOperationSupported('CONTENT_DRAFT')).toBe(true);
    expect(AI_OPERATIONS).toHaveLength(7);
  });

  it('B: unsupported operation rejected', () => {
    expect(isOperationSupported('OPENAI_CHAT')).toBe(false);
    expect(isOperationSupported('')).toBe(false);
  });
});

describe('SPEC-005 Phase 1 — tenant context', () => {
  it('C: valid tenant context accepted', () => {
    const result = validateTenantContextForOperation(
      { organizationId: 'org_test', clientId: 'client_a', userId: 'u1', role: 'ADMIN' },
      'CONTENT_DRAFT'
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.organizationId).toBe('org_test');
    }
  });

  it('D: missing organizationId rejected', () => {
    const result = validateTenantContextForOperation({ organizationId: '', clientId: 'c1' }, 'CONTENT_DRAFT');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('AUTH_CONTEXT_INVALID');
  });

  it('E: client-scoped operation missing clientId rejected', () => {
    const result = validateTenantContextForOperation({ organizationId: 'org_test' }, 'THESIS_PROPOSAL');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/clientId is required/);
  });

  it('F: no implicit default tenant introduced', () => {
    const result = validateTenantContextForOperation({}, 'CONTENT_DRAFT');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/organizationId is required/);
  });
});

describe('SPEC-005 Phase 1 — validation primitive', () => {
  it('G: valid JSON + valid schema => VALID', () => {
    const result = validateAiOutput({
      raw: JSON.stringify({ title: 'T', body: 'Hello world' }),
      schema: ContentDraftOutputSchema,
    });
    expect(result.status).toBe('VALID');
    if (result.status === 'VALID') {
      expect(result.data.title).toBe('T');
    }
  });

  it('H: invalid JSON => REJECTED', () => {
    const result = validateAiOutput({ raw: '{not json', schema: ContentDraftOutputSchema });
    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED') expect(result.reason).toBe('INVALID_JSON');
  });

  it('I: valid JSON + schema mismatch => REJECTED', () => {
    const result = validateAiOutput({
      raw: JSON.stringify({ title: 'Only title' }),
      schema: ContentDraftOutputSchema,
    });
    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED') expect(result.reason).toBe('SCHEMA_MISMATCH');
  });

  it('J: extra fields rejected (strict schema policy)', () => {
    const result = validateAiOutput({
      raw: JSON.stringify({ title: 'T', body: 'B', injected: true }),
      schema: ContentDraftOutputSchema,
    });
    expect(result.status).toBe('REJECTED');
  });

  it('K: valid nested structured output accepted', () => {
    const result = validateAiOutput({
      raw: JSON.stringify({
        title: 'Thesis',
        expertIdentity: 'Expert',
        identityCurrent: 'Now',
        perceptionTarget: 'Target',
        targetAudience: 'Audience',
        domain: 'Law',
        objective: 'Obj',
        differentiator: 'Diff',
        proofPoints: ['p1'],
        audiences: [{ name: 'A', tier: 'COMMERCIAL', weight: 50 }],
        territories: [{ name: 'T', weight: 50, pillar: 'P' }],
        objectives: [{ kind: 'BUSINESS', weight: 50 }],
        voiceAndTone: 'Formal',
        voiceAvoid: [],
        hardBlocks: [],
        softAvoid: [],
        complianceRules: 'Rules',
      }),
      schema: resolveOperationSchema('THESIS_PROPOSAL').schema,
    });
    expect(result.status).toBe('VALID');
  });

  it('L: invalid enum rejected', () => {
    const result = validateAiOutput({
      raw: JSON.stringify({ outcome: 'MAYBE', recommendations: ['a'], riskScore: 50 }),
      schema: ThesisChallengeOutputSchema,
    });
    expect(result.status).toBe('REJECTED');
  });
});

describe('SPEC-005 Phase 1 — prompt + schema identity', () => {
  it('M: promptId/promptVersion required by contract schema', () => {
    expect(PromptIdentitySchema.safeParse({ promptId: 'tmpl_content_v1', promptVersion: '1' }).success).toBe(true);
    expect(PromptIdentitySchema.safeParse({ promptId: '' }).success).toBe(false);
  });

  it('N: schemaVersion recognized per operation', () => {
    const identity = resolveSchemaIdentity('CONTENT_DRAFT');
    expect(identity.schemaId).toBe('content.draft');
    expect(identity.schemaVersion).toBe('1');
  });
});

describe('SPEC-005 Phase 1 — repair bounded', () => {
  it('O: repair attempts bounded to MAX_REPAIR_ATTEMPTS (=1)', () => {
    expect(MAX_REPAIR_ATTEMPTS).toBe(1);
    expect(canAttemptRepair(0)).toBe(true);
    expect(canAttemptRepair(1)).toBe(false);

    let repairCalls = 0;
    const state = runValidationPipeline({
      raw: JSON.stringify({ title: 'x' }),
      schema: ContentDraftOutputSchema,
      attemptRepair: () => {
        repairCalls += 1;
        return JSON.stringify({ title: 'x' });
      },
    });
    expect(repairCalls).toBeLessThanOrEqual(1);
    expect(state.status).toBe('REJECTED');
    expect(state.repairCount).toBe(1);
  });
});

describe('SPEC-005 Phase 1 — safe errors', () => {
  it('P: gateway error does not expose secrets', () => {
    const err = createGatewayError({
      code: 'PROVIDER_ERROR',
      message: 'Bearer sk-1234567890abcdef leaked',
    });
    expect(err.message).not.toMatch(/sk-/);
    expect(errorExposesSecrets(err)).toBe(false);
  });
});

describe('SPEC-005 Phase 1 — model logical role contract', () => {
  it('Q: model role resolves through typed operation map', () => {
    expect(DEFAULT_MODEL_ROLE_BY_OPERATION.CONTENT_DRAFT).toBe('CREATIVE_WRITING');
    expect(isAiModelRole('CREATIVE_WRITING')).toBe(true);
    expect(isAiModelRole('gpt-4o-mini')).toBe(false);
  });
});

describe('SPEC-005 Phase 1 — gateway contract stub', () => {
  it('UnimplementedAiGateway returns PROVIDER_UNAVAILABLE', async () => {
    const gw = new UnimplementedAiGateway();
    const tenant = markTenantValidated({
      organizationId: 'org_test',
      clientId: 'client_a',
    }) as ValidatedAiTenantContext;
    const request: AiGatewayRequest = {
      operation: 'ADVISOR_CURATION_ANGLE',
      tenant,
      input: { title: 't', snippet: 's' },
      prompt: { promptId: 'tmpl_curation_angle_v1', promptVersion: '1' },
    };
    const result = await gw.execute(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PROVIDER_UNAVAILABLE');
  });
});

describe('SPEC-005 Phase 1 — JSON extraction compatibility', () => {
  it('markdown fence JSON extracted then validated', () => {
    const raw = '```json\n' + JSON.stringify({ angle: 'Focus on compliance' }) + '\n```';
    const result = validateAiOutput({ raw, schema: AdvisorCurationAngleOutputSchema });
    expect(result.status).toBe('VALID');
  });
});
