import { describe, expect, it, vi } from 'vitest';
import { ExecuteAiOperation } from '../src/application/ai/use-cases/ExecuteAiOperation';
import { ModelRegistryAdapter } from '../src/infrastructure/ai/registry/ModelRegistryAdapter';
import { PromptRegistryAdapter } from '../src/infrastructure/ai/registry/PromptRegistryAdapter';
import { computePromptHash } from '../src/infrastructure/ai/registry/promptHash';
import { computeRenderedPromptHash } from '../src/application/ai/audit/renderedPromptHash';
import { buildAiRunPersistenceRecord } from '../src/application/ai/audit/buildAiRunPersistenceRecord';
import { sanitizeAiRunRecord, aiRunRecordContainsSecrets } from '../src/application/ai/audit/sanitizeAiRunRecord';
import { validateAiRunEnvelope, AiRunEnvelopeValidationError } from '../src/application/ai/audit/validateAiRunEnvelope';
import { mapAiRunToFirestore } from '../src/infrastructure/ai/persistence/mapAiRunToFirestore';
import { FirestoreAiRunRepository } from '../src/infrastructure/ai/persistence/FirestoreAiRunRepository';
import { FakeAiRunRepository } from './helpers/fakeAiRunRepository';
import {
  SequenceFakeProvider,
  throwProviderError,
  validContentDraftResponse,
  invalidContentDraftSchemaResponse,
} from './helpers/resilienceFakeProvider';
import { FakeAiProviderPort, jsonProviderResponse } from './helpers/fakeAiProvider';
import { minimalContentDraftGatewayInput } from './helpers/contentDraftGatewayInput';
import { markTenantValidated } from '../src/domain/ai/tenantContext';

const noSleep = async () => undefined;

function createGateway(
  handler: SequenceFakeProvider['handler'],
  repository?: FakeAiRunRepository
) {
  let call = 0;
  return new ExecuteAiOperation({
    providerPort: new FakeAiProviderPort(handler),
    modelRegistry: new ModelRegistryAdapter(),
    promptRegistry: new PromptRegistryAdapter(),
    aiRunRepository: repository,
    retryBackoffMs: 0,
    sleepFn: noSleep,
    nowFn: () => {
      call += 1;
      return call * 1000;
    },
  });
}

const tenant = markTenantValidated({
  organizationId: 'org_aurora_01',
  clientId: 'client_juan_001',
  userId: 'admin_uid',
  role: 'ADMIN',
});

const baseRequest = {
  operation: 'CONTENT_DRAFT' as const,
  tenant,
  input: minimalContentDraftGatewayInput(),
  prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
  metadata: { correlationId: 'corr-123' },
};

function sensitiveFixture(): ReturnType<typeof buildAiRunPersistenceRecord> {
  return buildAiRunPersistenceRecord({
    id: 'run-secret-test',
    tenant,
    operation: 'CONTENT_DRAFT',
    executionStatus: 'FAILED',
    latencyMs: 10,
    error: {
      code: 'PROVIDER_ERROR',
      message: 'Bearer sk-1234567890abcdef OPENAI_API_KEY leak',
      retryable: false,
    },
    metadata: { repairCount: 0 },
  });
}

describe('SPEC-005 Phase 4 — repository mapping (A–O)', () => {
  it('A: successful run persisted', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([validContentDraftResponse]);
    const gateway = createGateway(seq.handler, repo);
    const result = await gateway.execute(baseRequest);
    expect(result.ok).toBe(true);
    expect(repo.saved).toHaveLength(1);
    expect(repo.last()?.executionStatus).toBe('SUCCESS');
  });

  it('B: failed run persisted', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([
      () => {
        throw throwProviderError({ code: 'PROVIDER_ERROR', retryable: false });
      },
    ]);
    const gateway = createGateway(seq.handler, repo);
    const result = await gateway.execute(baseRequest);
    expect(result.ok).toBe(false);
    expect(repo.last()?.executionStatus).toBe('FAILED');
  });

  it('C: tenant envelope correct', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([validContentDraftResponse]);
    const gateway = createGateway(seq.handler, repo);
    await gateway.execute(baseRequest);
    const saved = repo.last()!;
    expect(saved.organizationId).toBe('org_aurora_01');
    expect(saved.clientId).toBe('client_juan_001');
    expect(saved.userId).toBe('admin_uid');
    expect(saved.correlationId).toBe('corr-123');
  });

  it('D: wrong/missing tenant rejected by repository adapter', () => {
    expect(() =>
      validateAiRunEnvelope({
        id: 'x',
        organizationId: '',
        clientId: 'client_a',
        operation: 'CONTENT_DRAFT',
        executionStatus: 'FAILED',
        repairCount: 0,
        source: 'AI_GATEWAY',
        costStatus: 'NOT_CALCULATED',
      })
    ).toThrow(AiRunEnvelopeValidationError);

    expect(() =>
      validateAiRunEnvelope({
        id: 'x',
        organizationId: 'org_a',
        clientId: 'client_a',
        operation: 'CONTENT_DRAFT',
        executionStatus: 'FAILED',
        repairCount: 0,
        source: 'AI_GATEWAY',
        costStatus: 'NOT_CALCULATED',
      })
    ).not.toThrow();

    expect(() =>
      validateAiRunEnvelope({
        id: '',
        organizationId: 'org_a',
        clientId: 'client_a',
        operation: 'CONTENT_DRAFT',
        executionStatus: 'FAILED',
        repairCount: 0,
        source: 'AI_GATEWAY',
        costStatus: 'NOT_CALCULATED',
      })
    ).toThrow(/id is required/);
  });

  it('E: retryCount preserved', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([
      () => {
        throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
      },
      validContentDraftResponse,
    ]);
    const gateway = createGateway(seq.handler, repo);
    await gateway.execute(baseRequest);
    expect(repo.last()?.retryCount).toBe(1);
  });

  it('F: repairCount preserved', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([invalidContentDraftSchemaResponse, validContentDraftResponse]);
    const gateway = createGateway(seq.handler, repo);
    await gateway.execute(baseRequest);
    expect(repo.last()?.repairCount).toBe(1);
  });

  it('G: providerCallCount preserved', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([invalidContentDraftSchemaResponse, validContentDraftResponse]);
    const gateway = createGateway(seq.handler, repo);
    await gateway.execute(baseRequest);
    expect(repo.last()?.providerCallCount).toBe(2);
  });

  it('H: prompt identity preserved', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([validContentDraftResponse]);
    const gateway = createGateway(seq.handler, repo);
    await gateway.execute(baseRequest);
    expect(repo.last()?.prompt?.promptId).toBe('tmpl_content_v1');
    expect(repo.last()?.prompt?.promptVersion).toBe('1');
    expect(repo.last()?.prompt?.promptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('I: schema identity preserved', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([validContentDraftResponse]);
    const gateway = createGateway(seq.handler, repo);
    await gateway.execute(baseRequest);
    expect(repo.last()?.schema?.schemaId).toBeTruthy();
    expect(repo.last()?.schema?.schemaVersion).toBeTruthy();
  });

  it('J: token values preserved', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([
      () =>
        jsonProviderResponse(
          { title: 'Hello', body: 'World content' },
          { promptTokens: 11, completionTokens: 22, totalTokens: 33 }
        ),
    ]);
    const gateway = createGateway(seq.handler, repo);
    await gateway.execute(baseRequest);
    expect(repo.last()?.promptTokens).toBe(11);
    expect(repo.last()?.completionTokens).toBe(22);
    expect(repo.last()?.totalTokens).toBe(33);
  });

  it('K: missing token values remain missing/null, not fake zero', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([
      () =>
        jsonProviderResponse(
          { title: 'Hello', body: 'World content' },
          { promptTokens: undefined, completionTokens: undefined, totalTokens: undefined }
        ),
    ]);
    const gateway = createGateway(seq.handler, repo);
    await gateway.execute(baseRequest);
    expect(repo.last()?.promptTokens).toBeUndefined();
    expect(repo.last()?.completionTokens).toBeUndefined();
    expect(repo.last()?.totalTokens).toBeUndefined();
  });

  it('L: sanitized error stored', () => {
    const sanitized = sanitizeAiRunRecord(sensitiveFixture());
    expect(sanitized.errorMessageSanitized).not.toMatch(/sk-[a-zA-Z0-9]{10,}/);
    expect(sanitized.errorMessageSanitized).toContain('[REDACTED]');
  });

  it('M: no API key stored', () => {
    const sanitized = sanitizeAiRunRecord(sensitiveFixture());
    expect(aiRunRecordContainsSecrets(sanitized)).toBe(false);
    const mapped = mapAiRunToFirestore(sanitized);
    expect(JSON.stringify(mapped)).not.toMatch(/OPENAI_API_KEY|sk-[a-zA-Z0-9]{10,}/);
  });

  it('N: one Gateway execution => one aiRun', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([
      () => {
        throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
      },
      invalidContentDraftSchemaResponse,
      validContentDraftResponse,
    ]);
    const gateway = createGateway(seq.handler, repo);
    await gateway.execute(baseRequest);
    expect(repo.saved).toHaveLength(1);
    expect(repo.last()?.providerCallCount).toBeGreaterThan(1);
  });

  it('O: stable run ID on persistence retry', async () => {
    const repo = new FakeAiRunRepository();
    const record = buildAiRunPersistenceRecord({
      id: 'stable-run-id',
      tenant,
      operation: 'CONTENT_DRAFT',
      executionStatus: 'SUCCESS',
      latencyMs: 10,
      metadata: {
        operation: 'CONTENT_DRAFT',
        prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
        schema: { schemaId: 'content_draft', schemaVersion: '1' },
        validationStatus: 'VALID',
        repairCount: 0,
        attemptCount: 1,
        retryCount: 0,
        providerCallCount: 1,
      },
    });
    await repo.save(record);
    await repo.save(record);
    expect(repo.saved).toHaveLength(2);
    expect(repo.saved.every((entry) => entry.id === 'stable-run-id')).toBe(true);
  });
});

describe('SPEC-005 Phase 4 — gateway audit (P–V)', () => {
  it('P: success on first attempt → persisted SUCCESS run', async () => {
    const repo = new FakeAiRunRepository();
    const gateway = createGateway(new SequenceFakeProvider([validContentDraftResponse]).handler, repo);
    const result = await gateway.execute(baseRequest);
    expect(result.ok).toBe(true);
    expect(repo.last()?.executionStatus).toBe('SUCCESS');
    expect(repo.last()?.validationStatus).toBe('VALID');
  });

  it('Q: success after retry → retryCount = 1', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([
      () => {
        throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
      },
      validContentDraftResponse,
    ]);
    await createGateway(seq.handler, repo).execute(baseRequest);
    expect(repo.last()?.retryCount).toBe(1);
  });

  it('R: success after repair → repairCount = 1', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([invalidContentDraftSchemaResponse, validContentDraftResponse]);
    await createGateway(seq.handler, repo).execute(baseRequest);
    expect(repo.last()?.repairCount).toBe(1);
    expect(repo.last()?.executionStatus).toBe('SUCCESS');
    expect(repo.last()?.validationStatus).toBe('VALID');
  });

  it('S: failure after repair → REPAIR_FAILED persisted', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([
      invalidContentDraftSchemaResponse,
      invalidContentDraftSchemaResponse,
    ]);
    const result = await createGateway(seq.handler, repo).execute(baseRequest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REPAIR_FAILED');
    expect(repo.last()?.errorClass).toBe('REPAIR_FAILED');
    expect(repo.last()?.validationStatus).toBe('REJECTED');
  });

  it('T: timeout exhaustion → TIMEOUT persisted', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([
      () => {
        throw throwProviderError({ code: 'TIMEOUT', retryable: true });
      },
      () => {
        throw throwProviderError({ code: 'TIMEOUT', retryable: true });
      },
    ]);
    const result = await createGateway(seq.handler, repo).execute(baseRequest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TIMEOUT');
    expect(repo.last()?.errorClass).toBe('TIMEOUT');
  });

  it('U: rate-limit exhaustion → RATE_LIMITED persisted', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([
      () => {
        throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
      },
      () => {
        throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
      },
    ]);
    const result = await createGateway(seq.handler, repo).execute(baseRequest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('RATE_LIMITED');
    expect(repo.last()?.errorClass).toBe('RATE_LIMITED');
  });

  it('V: audit persistence failure follows fail-closed policy', async () => {
    const repo = new FakeAiRunRepository();
    repo.failNextSave = true;
    const result = await createGateway(
      new SequenceFakeProvider([validContentDraftResponse]).handler,
      repo
    ).execute(baseRequest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PERSISTENCE_ERROR');
    expect(repo.saved).toHaveLength(0);
  });
});

describe('SPEC-005 Phase 4 — renderedPromptHash', () => {
  it('same rendered prompt => same 64-hex hash', () => {
    const a = computeRenderedPromptHash('system', 'user');
    const b = computeRenderedPromptHash('system', 'user');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('different runtime content => different hash; canonical promptHash unchanged', async () => {
    const repo = new FakeAiRunRepository();
    const gateway = createGateway(new SequenceFakeProvider([validContentDraftResponse]).handler, repo);
    await gateway.execute(baseRequest);
    await gateway.execute({
      ...baseRequest,
      input: minimalContentDraftGatewayInput({ topicTitle: 'Different topic' }),
    });
    const [first, second] = repo.saved;
    expect(first.renderedPromptHash).not.toBe(second.renderedPromptHash);
    expect(first.prompt?.promptHash).toBe(second.prompt?.promptHash);
    expect(JSON.stringify(first)).not.toMatch(/Different topic/);
    expect(JSON.stringify(first)).not.toMatch(/AI governance/);
  });
});

describe('SPEC-005 Phase 4 — Firestore adapter envelope', () => {
  it('writes tenant-scoped path with matching envelope', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    const doc = vi.fn().mockReturnValue({ set });
    const firestore = { doc } as unknown as ConstructorParameters<typeof FirestoreAiRunRepository>[0]['firestore'];
    const repo = new FirestoreAiRunRepository({ firestore: firestore! });

    const record = buildAiRunPersistenceRecord({
      id: 'run_fs_1',
      tenant,
      operation: 'CONTENT_DRAFT',
      executionStatus: 'SUCCESS',
      latencyMs: 50,
      metadata: {
        operation: 'CONTENT_DRAFT',
        prompt: { promptId: 'tmpl_content_v1', promptVersion: '1', promptHash: computePromptHash('system', 'user') },
        schema: { schemaId: 'content_draft', schemaVersion: '1' },
        validationStatus: 'VALID',
        repairCount: 0,
        attemptCount: 1,
        retryCount: 0,
        providerCallCount: 1,
      },
    });

    await repo.save(record);
    expect(doc).toHaveBeenCalledWith('clients/client_juan_001/aiRuns/run_fs_1');
    expect(set).toHaveBeenCalledTimes(1);
    const payload = set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.organizationId).toBe('org_aurora_01');
    expect(payload.clientId).toBe('client_juan_001');
    expect(payload.outputPayload).toBeUndefined();
    expect(payload.rawResponse).toBeUndefined();
    expect(payload.costStatus).toBe('NOT_CALCULATED');
  });

  it('rejects missing tenant before Admin SDK write', async () => {
    const set = vi.fn();
    const repo = new FirestoreAiRunRepository({
      firestore: { doc: vi.fn().mockReturnValue({ set }) } as never,
    });
    await expect(
      repo.save({
        id: 'run_bad',
        organizationId: '',
        clientId: 'client_b',
        operation: 'CONTENT_DRAFT',
        executionStatus: 'FAILED',
        repairCount: 0,
        source: 'AI_GATEWAY',
        costStatus: 'NOT_CALCULATED',
      })
    ).rejects.toThrow();
    await expect(
      repo.save({
        id: 'run_bad',
        organizationId: 'org_a',
        clientId: '',
        operation: 'CONTENT_DRAFT',
        executionStatus: 'FAILED',
        repairCount: 0,
        source: 'AI_GATEWAY',
        costStatus: 'NOT_CALCULATED',
      })
    ).rejects.toThrow();
    expect(set).not.toHaveBeenCalled();
  });
});

describe('SPEC-005 Phase 4 — cost deferral', () => {
  it('does not persist fake zero cost', async () => {
    const repo = new FakeAiRunRepository();
    await createGateway(new SequenceFakeProvider([validContentDraftResponse]).handler, repo).execute(
      baseRequest
    );
    expect(repo.last()?.costStatus).toBe('NOT_CALCULATED');
    expect(mapAiRunToFirestore(repo.last()!)).not.toHaveProperty('totalCostUsd');
  });
});
