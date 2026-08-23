import type { AiOperation } from '../../domain/ai/operations';
import type { PromptIdentity } from '../../domain/ai/promptIdentity';
import type { AiCompleteHttpResponse } from './aiCompleteTypes';
import type { AiGatewayErrorCode } from '../../domain/ai/errors';

export class AiCompleteTransportError extends Error {
  constructor(
    message: string,
    readonly code: AiGatewayErrorCode | 'TRANSPORT_ERROR' | 'AUTH_REQUIRED' = 'TRANSPORT_ERROR',
    readonly retryable = false
  ) {
    super(message);
    this.name = 'AiCompleteTransportError';
  }
}

export interface AiCompleteHttpClientDeps {
  getIdToken: () => Promise<string | null>;
  /** Required — browser callers supply env-aware URL (see contentDraftGateway.ts). */
  resolveUrl: () => string;
  fetchFn?: typeof fetch;
}

/** Browser-safe transport to server aiComplete — no provider secrets or model selection. */
export class AiCompleteHttpClient {
  constructor(private readonly deps: AiCompleteHttpClientDeps) {}

  async execute(params: {
    operation: AiOperation;
    clientId: string;
    input: unknown;
    prompt: PromptIdentity;
  }): Promise<AiCompleteHttpResponse> {
    const token = await this.deps.getIdToken();
    if (!token) {
      throw new AiCompleteTransportError(
        'Autenticación Firebase requerida para el Gateway de IA.',
        'AUTH_REQUIRED',
        false
      );
    }

    const url = this.deps.resolveUrl();
    const fetchFn = this.deps.fetchFn ?? fetch;
    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        operation: params.operation,
        clientId: params.clientId,
        input: params.input,
        prompt: {
          promptId: params.prompt.promptId,
          promptVersion: params.prompt.promptVersion,
        },
      }),
    });

    let payload: AiCompleteHttpResponse;
    try {
      payload = (await response.json()) as AiCompleteHttpResponse;
    } catch {
      throw new AiCompleteTransportError('Respuesta inválida del Gateway de IA.', 'TRANSPORT_ERROR', true);
    }

    if (!payload || typeof payload !== 'object' || !('ok' in payload)) {
      throw new AiCompleteTransportError('Respuesta inválida del Gateway de IA.', 'TRANSPORT_ERROR', true);
    }

    if (!payload.ok) {
      const code = (payload.error?.code || 'PROVIDER_ERROR') as AiGatewayErrorCode;
      throw new AiCompleteTransportError(
        payload.error?.message || 'Gateway de IA falló.',
        code,
        payload.error?.retryable ?? false
      );
    }

    return payload;
  }
}

export function mapGatewayErrorToUserMessage(error: unknown): string {
  if (error instanceof AiCompleteTransportError) {
    switch (error.code) {
      case 'AUTH_REQUIRED':
        return 'Inicia sesión como administrador para generar borradores con IA.';
      case 'TIMEOUT':
        return 'La generación tardó demasiado. Inténtalo de nuevo en unos momentos.';
      case 'RATE_LIMITED':
        return 'Límite de solicitudes alcanzado. Espera un momento antes de reintentar.';
      case 'INVALID_OUTPUT':
      case 'REPAIR_FAILED':
        return 'No se pudo validar el borrador generado. Revisa la tesis e inténtalo de nuevo.';
      case 'PERSISTENCE_ERROR':
        return 'El borrador se generó pero no se pudo registrar la auditoría. Contacta al administrador.';
      case 'PROVIDER_ERROR':
      case 'PROVIDER_UNAVAILABLE':
      case 'MODEL_NOT_RESOLVED':
        return 'El servicio de IA no está disponible temporalmente.';
      default:
        return error.message || 'No se pudo generar el borrador.';
    }
  }
  if (error instanceof Error) return error.message;
  return 'No se pudo generar el borrador.';
}
