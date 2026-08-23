import { authService } from './auth';
import { FIREBASE_ENABLED } from '../firebase/config';
import { getFirebaseIdToken } from '../firebase/authBridge';
import type { PositioningThesis, Signal, AIComparativeResult } from '../types';
import {
  AiCompleteHttpClient,
  AiCompleteTransportError,
  mapGatewayErrorToUserMessage,
} from '../interfaces/ai/aiCompleteHttpClient';
import { mapSignalThesisToComparativeGatewayInput } from './mapAnalysisComparativeGatewayInput';
import { mapComparativeAggregateToResult } from './mapAnalysisComparativeOutput';
import {
  ANALYSIS_COMPARATIVE_PROMPT_ID,
  ANALYSIS_COMPARATIVE_PROMPT_VERSION,
} from '../application/ai/schemas/analysisComparativeInput';
import {
  ComparativeAnalysisAggregateSchema,
  type ComparativeAnalysisAggregate,
} from '../application/ai/schemas/comparativeAnalysisAggregate';
import type { AiExecutionMetadata } from '../application/ai/contracts/result';

function resolveAiCompleteHttpUrl(): string {
  const base = import.meta.env.VITE_POSTURA_FUNCTIONS_BASE?.trim();
  if (base) return `${base.replace(/\/$/, '')}/aiComplete`;
  return '/api/ai/gateway-complete';
}

const defaultClient = new AiCompleteHttpClient({
  getIdToken: getFirebaseIdToken,
  resolveUrl: resolveAiCompleteHttpUrl,
});

/** Same ADMIN+Firebase gate — aiComplete remains ADMIN_ONLY. */
export function isComparativeGatewayAvailable(): boolean {
  if (!FIREBASE_ENABLED) return false;
  const user = authService.getCurrentUser();
  return Boolean(user && user.role === 'ADMIN');
}

function assertAdminGateway(): void {
  const user = authService.getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    throw new AiCompleteTransportError(
      'Solo administradores pueden usar el Gateway de IA para análisis comparativo.',
      'AUTH_REQUIRED'
    );
  }
}

export async function executeComparativeAnalysisViaGateway(params: {
  signal: Signal;
  thesis: PositioningThesis;
  client?: AiCompleteHttpClient;
}): Promise<{
  aggregate: ComparativeAnalysisAggregate;
  result: AIComparativeResult;
  metadata: AiExecutionMetadata;
}> {
  assertAdminGateway();
  const input = mapSignalThesisToComparativeGatewayInput(params.signal, params.thesis);
  const httpClient = params.client ?? defaultClient;
  const response = await httpClient.execute({
    operation: 'ANALYSIS_COMPARATIVE',
    clientId: params.thesis.clientId,
    input,
    prompt: {
      promptId: ANALYSIS_COMPARATIVE_PROMPT_ID,
      promptVersion: ANALYSIS_COMPARATIVE_PROMPT_VERSION,
    },
  });

  if (!response.ok) {
    throw new AiCompleteTransportError(response.error.message, response.error.code as never, response.error.retryable);
  }

  const aggregate = ComparativeAnalysisAggregateSchema.parse(response.data);
  return {
    aggregate,
    result: mapComparativeAggregateToResult(aggregate, params.signal.id, params.thesis.id),
    metadata: response.metadata,
  };
}

export { mapGatewayErrorToUserMessage };
