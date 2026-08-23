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

export function malformedJsonResponse() {
  return jsonProviderResponse('{not json');
}
