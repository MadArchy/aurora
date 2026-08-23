import type {
  AiProviderCompletionRequest,
  AiProviderCompletionResponse,
} from '../../src/application/ai/ports/outbound/AiProviderPort';
import { ProviderPortError } from '../../src/application/ai/errors/providerPortErrors';
import { jsonProviderResponse } from './fakeAiProvider';

export class SequenceFakeProvider {
  private index = 0;

  constructor(private readonly responses: Array<() => Promise<AiProviderCompletionResponse> | AiProviderCompletionResponse | Error>) {}

  handler = async (_request: AiProviderCompletionRequest): Promise<AiProviderCompletionResponse> => {
    const current = this.responses[this.index];
    this.index += 1;
    if (!current) {
      throw new ProviderPortError({
        code: 'PROVIDER_ERROR',
        message: 'SequenceFakeProvider exhausted',
        retryable: false,
        providerName: 'fake',
      });
    }
    const result = typeof current === 'function' ? await current() : current;
    if (result instanceof Error) throw result;
    return result;
  };

  get callCount(): number {
    return this.index;
  }
}

export function throwProviderError(params: {
  code: 'RATE_LIMITED' | 'PROVIDER_ERROR' | 'TIMEOUT' | 'PROVIDER_UNAVAILABLE';
  retryable: boolean;
  httpStatus?: number;
}): Error {
  return new ProviderPortError({
    code: params.code,
    message: `${params.code} simulated`,
    retryable: params.retryable,
    providerName: 'fake',
    httpStatus: params.httpStatus,
  });
}

export function validContentDraftResponse() {
  return jsonProviderResponse({ title: 'Hello', body: 'World content' });
}

export function invalidContentDraftSchemaResponse() {
  return jsonProviderResponse({ title: 'only title' });
}

export function validThesisProposalResponse() {
  return jsonProviderResponse({
    title: 'Governance thesis',
    expertIdentity: 'Dr. Analyst',
    identityCurrent: 'Advisor',
    perceptionTarget: 'Trusted AI advisor',
    targetAudience: 'CIOs',
    domain: 'AI governance',
    objective: 'Thought leadership',
    differentiator: 'Evidence-led',
    proofPoints: ['ISO audit'],
    audiences: [{ name: 'CIOs', tier: 'COMMERCIAL', weight: 80 }],
    territories: [{ name: 'Governance', weight: 70, pillar: 'Risk' }],
    objectives: [{ kind: 'THOUGHT_LEADERSHIP', weight: 70 }],
    voiceAndTone: 'preciso',
    voiceAvoid: ['hype'],
    hardBlocks: ['No medical claims'],
    softAvoid: [],
    complianceRules: 'No medical claims',
  });
}

export function invalidThesisProposalSchemaResponse() {
  return jsonProviderResponse({ title: 'only title' });
}

export function validSignalThesisEvalResponse() {
  return jsonProviderResponse({
    proposedAngle: 'Compliance lens for CIOs',
    strategicRationale: 'Aligns with governance thesis',
    recommendedAction: 'ARTICLE',
  });
}

export function invalidSignalThesisEvalSchemaResponse() {
  return jsonProviderResponse({ proposedAngle: 'x' });
}

export function validThesisChallengeResponse() {
  return jsonProviderResponse({
    outcome: 'REFINE',
    recommendations: ['Clarify audience'],
    riskScore: 42,
  });
}

export function invalidThesisChallengeSchemaResponse() {
  return jsonProviderResponse({ outcome: 'MAYBE', recommendations: ['x'], riskScore: 10 });
}

export function validAdvisorPositioningResponse() {
  return jsonProviderResponse({
    summary: 'Autoridad moderada con brechas de evidencia.',
    diagnosis: {
      strengths: ['Tesis definida'],
      gaps: ['Pocas evidencias verificadas'],
      risks: ['Tesis pendiente de aprobación'],
    },
    actions: [
      {
        category: 'EVIDENCE',
        horizon: 'DAYS_30',
        title: 'Verificar evidencias',
        description: 'Contrasta cada ítem con su fuente original.',
        priority: 80,
      },
    ],
  });
}

export function invalidAdvisorPositioningSchemaResponse() {
  return jsonProviderResponse({});
}

export function validAdvisorCurationAngleResponse() {
  return jsonProviderResponse({
    angle: 'Qué implica la norma para CIOs que ya operan sistemas de alto riesgo.',
  });
}

export function invalidAdvisorCurationAngleSchemaResponse() {
  return jsonProviderResponse({ angle: '' });
}

export function malformedJsonResponse() {
  return jsonProviderResponse('{not json');
}
