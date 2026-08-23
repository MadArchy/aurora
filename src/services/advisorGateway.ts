import { authService } from './auth';
import { FIREBASE_ENABLED } from '../firebase/config';
import { getFirebaseIdToken } from '../firebase/authBridge';
import {
  AiCompleteHttpClient,
  AiCompleteTransportError,
  mapGatewayErrorToUserMessage,
} from '../interfaces/ai/aiCompleteHttpClient';
import {
  mapAdvisorPositioningToGatewayInput,
  type AdvisorPositioningSourceInput,
} from './mapAdvisorPositioningGatewayInput';
import { mapCurationAngleToGatewayInput } from './mapAdvisorCurationAngleGatewayInput';
import { mapAdvisorPositioningOutputToLiveAdvice } from './mapAdvisorPositioningOutput';
import {
  ADVISOR_POSITIONING_PROMPT_ID,
  ADVISOR_POSITIONING_PROMPT_VERSION,
} from '../application/ai/schemas/advisorPositioningInput';
import {
  ADVISOR_CURATION_ANGLE_PROMPT_ID,
  ADVISOR_CURATION_ANGLE_PROMPT_VERSION,
} from '../application/ai/schemas/advisorCurationAngleInput';
import {
  AdvisorPositioningOutputSchema,
  type AdvisorPositioningOutput,
} from '../application/ai/schemas/advisorPositioning';
import {
  AdvisorCurationAngleOutputSchema,
  type AdvisorCurationAngleOutput,
} from '../application/ai/schemas/advisorCurationAngle';
import type { PositioningThesis } from '../types';
import type { AiExecutionMetadata } from '../application/ai/contracts/result';
import type { AdvisorLiveAdvicePayload } from './mapAdvisorPositioningOutput';

function resolveAiCompleteHttpUrl(): string {
  const base = import.meta.env.VITE_POSTURA_FUNCTIONS_BASE?.trim();
  if (base) return `${base.replace(/\/$/, '')}/aiComplete`;
  return '/api/ai/gateway-complete';
}

const defaultClient = new AiCompleteHttpClient({
  getIdToken: getFirebaseIdToken,
  resolveUrl: resolveAiCompleteHttpUrl,
});

/** Same ADMIN+Firebase gate as prior migrations — aiComplete remains ADMIN_ONLY. */
export function isAdvisorGatewayAvailable(): boolean {
  if (!FIREBASE_ENABLED) return false;
  const user = authService.getCurrentUser();
  return Boolean(user && user.role === 'ADMIN');
}

function assertAdminGateway(): void {
  const user = authService.getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    throw new AiCompleteTransportError(
      'Solo administradores pueden usar el Gateway de IA para asesoría.',
      'AUTH_REQUIRED'
    );
  }
}

export async function executeAdvisorPositioningViaGateway(params: {
  clientId: string;
  source: AdvisorPositioningSourceInput;
  client?: AiCompleteHttpClient;
}): Promise<{
  output: AdvisorPositioningOutput;
  liveAdvice: AdvisorLiveAdvicePayload;
  metadata: AiExecutionMetadata;
}> {
  assertAdminGateway();
  const input = mapAdvisorPositioningToGatewayInput(params.source);
  const httpClient = params.client ?? defaultClient;
  const response = await httpClient.execute({
    operation: 'ADVISOR_POSITIONING',
    clientId: params.clientId,
    input,
    prompt: {
      promptId: ADVISOR_POSITIONING_PROMPT_ID,
      promptVersion: ADVISOR_POSITIONING_PROMPT_VERSION,
    },
  });

  if (!response.ok) {
    throw new AiCompleteTransportError(response.error.message, response.error.code as never, response.error.retryable);
  }

  const output = AdvisorPositioningOutputSchema.parse(response.data);
  return {
    output,
    liveAdvice: mapAdvisorPositioningOutputToLiveAdvice(output),
    metadata: response.metadata,
  };
}

export async function executeAdvisorCurationAngleViaGateway(params: {
  thesis: PositioningThesis;
  title: string;
  snippet: string;
  client?: AiCompleteHttpClient;
}): Promise<{ output: AdvisorCurationAngleOutput; metadata: AiExecutionMetadata }> {
  assertAdminGateway();
  const input = mapCurationAngleToGatewayInput(params);
  const httpClient = params.client ?? defaultClient;
  const response = await httpClient.execute({
    operation: 'ADVISOR_CURATION_ANGLE',
    clientId: params.thesis.clientId,
    input,
    prompt: {
      promptId: ADVISOR_CURATION_ANGLE_PROMPT_ID,
      promptVersion: ADVISOR_CURATION_ANGLE_PROMPT_VERSION,
    },
  });

  if (!response.ok) {
    throw new AiCompleteTransportError(response.error.message, response.error.code as never, response.error.retryable);
  }

  const output = AdvisorCurationAngleOutputSchema.parse(response.data);
  return { output, metadata: response.metadata };
}

export { mapGatewayErrorToUserMessage };
