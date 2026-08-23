import { authService } from './auth';
import { FIREBASE_ENABLED } from '../firebase/config';
import { getFirebaseIdToken } from '../firebase/authBridge';
import type { PositioningThesis } from '../types';
import {
  AiCompleteHttpClient,
  AiCompleteTransportError,
  mapGatewayErrorToUserMessage,
} from '../interfaces/ai/aiCompleteHttpClient';
import { mapThesisToContentDraftGatewayInput } from './mapContentDraftGatewayInput';
import {
  CONTENT_DRAFT_PROMPT_ID,
  CONTENT_DRAFT_PROMPT_VERSION,
  type ContentDraftGatewayInput,
} from '../application/ai/schemas/contentDraftInput';
import { ContentDraftOutputSchema, type ContentDraftOutput } from '../application/ai/schemas/contentDraft';
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

export function isContentDraftGatewayAvailable(): boolean {
  if (!FIREBASE_ENABLED) return false;
  const user = authService.getCurrentUser();
  return Boolean(user && user.role === 'ADMIN');
}

export async function executeContentDraftViaGateway(params: {
  thesis: PositioningThesis;
  topicTitle: string;
  format: ContentDraftGatewayInput['format'];
  extras?: {
    roleAngle?: string;
    venueLabel?: string;
    why?: string;
    angle?: string;
  };
  client?: AiCompleteHttpClient;
}): Promise<{ output: ContentDraftOutput; metadata: AiExecutionMetadata }> {
  const user = authService.getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    throw new AiCompleteTransportError(
      'Solo administradores pueden usar el Gateway de IA para borradores.',
      'AUTH_REQUIRED'
    );
  }

  const input = mapThesisToContentDraftGatewayInput(params);
  const httpClient = params.client ?? defaultClient;
  const response = await httpClient.execute({
    operation: 'CONTENT_DRAFT',
    clientId: params.thesis.clientId,
    input,
    prompt: {
      promptId: CONTENT_DRAFT_PROMPT_ID,
      promptVersion: CONTENT_DRAFT_PROMPT_VERSION,
    },
  });

  if (!response.ok) {
    throw new AiCompleteTransportError(response.error.message, response.error.code as never, response.error.retryable);
  }

  const output = ContentDraftOutputSchema.parse(response.data);
  return { output, metadata: response.metadata };
}

export { mapGatewayErrorToUserMessage };
