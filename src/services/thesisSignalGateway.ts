import { authService } from './auth';
import { FIREBASE_ENABLED } from '../firebase/config';
import { getFirebaseIdToken } from '../firebase/authBridge';
import type { PositioningThesis, Signal, ThesisEditableFields } from '../types';
import {
  AiCompleteHttpClient,
  AiCompleteTransportError,
  mapGatewayErrorToUserMessage,
} from '../interfaces/ai/aiCompleteHttpClient';
import {
  mapClientToThesisProposalGatewayInput,
  mapThesisProposalOutputToEditableFields,
} from './mapThesisProposalGatewayInput';
import { mapSignalThesisToGatewayInput } from './mapSignalThesisEvalGatewayInput';
import { mapThesisToChallengeGatewayInput } from './mapThesisChallengeGatewayInput';
import {
  THESIS_PROPOSAL_PROMPT_ID,
  THESIS_PROPOSAL_PROMPT_VERSION,
} from '../application/ai/schemas/thesisProposalInput';
import {
  SIGNAL_THESIS_EVAL_PROMPT_ID,
  SIGNAL_THESIS_EVAL_PROMPT_VERSION,
} from '../application/ai/schemas/signalThesisEvalInput';
import {
  THESIS_CHALLENGE_PROMPT_ID,
  THESIS_CHALLENGE_PROMPT_VERSION,
} from '../application/ai/schemas/thesisChallengeInput';
import {
  ThesisProposalOutputSchema,
  type ThesisProposalOutput,
} from '../application/ai/schemas/thesisProposal';
import {
  SignalThesisEvalOutputSchema,
  type SignalThesisEvalOutput,
} from '../application/ai/schemas/signalThesisEval';
import {
  ThesisChallengeOutputSchema,
  type ThesisChallengeOutput,
} from '../application/ai/schemas/thesisChallenge';
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

/** Same ADMIN+Firebase gate as CONTENT_DRAFT — aiComplete remains ADMIN_ONLY. */
export function isThesisSignalGatewayAvailable(): boolean {
  if (!FIREBASE_ENABLED) return false;
  const user = authService.getCurrentUser();
  return Boolean(user && user.role === 'ADMIN');
}

function assertAdminGateway(): void {
  const user = authService.getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    throw new AiCompleteTransportError(
      'Solo administradores pueden usar el Gateway de IA para tesis y señales.',
      'AUTH_REQUIRED'
    );
  }
}

export async function executeThesisProposalViaGateway(params: {
  clientId: string;
  client?: AiCompleteHttpClient;
}): Promise<{
  output: ThesisProposalOutput;
  editable: ThesisEditableFields;
  metadata: AiExecutionMetadata;
}> {
  assertAdminGateway();
  const mapped = mapClientToThesisProposalGatewayInput(params.clientId);
  if (!mapped) {
    throw new AiCompleteTransportError('Cliente no encontrado para propuesta de tesis.', 'TRANSPORT_ERROR');
  }

  const httpClient = params.client ?? defaultClient;
  const response = await httpClient.execute({
    operation: 'THESIS_PROPOSAL',
    clientId: params.clientId,
    input: mapped.input,
    prompt: {
      promptId: THESIS_PROPOSAL_PROMPT_ID,
      promptVersion: THESIS_PROPOSAL_PROMPT_VERSION,
    },
  });

  if (!response.ok) {
    throw new AiCompleteTransportError(response.error.message, response.error.code as never, response.error.retryable);
  }

  const output = ThesisProposalOutputSchema.parse(response.data);
  return {
    output,
    editable: mapThesisProposalOutputToEditableFields(output, mapped.fallback),
    metadata: response.metadata,
  };
}

export async function executeSignalThesisEvalViaGateway(params: {
  signal: Signal;
  thesis: PositioningThesis;
  client?: AiCompleteHttpClient;
}): Promise<{ output: SignalThesisEvalOutput; metadata: AiExecutionMetadata }> {
  assertAdminGateway();
  const input = mapSignalThesisToGatewayInput(params.signal, params.thesis);
  const httpClient = params.client ?? defaultClient;
  const response = await httpClient.execute({
    operation: 'SIGNAL_THESIS_EVAL',
    clientId: params.thesis.clientId,
    input,
    prompt: {
      promptId: SIGNAL_THESIS_EVAL_PROMPT_ID,
      promptVersion: SIGNAL_THESIS_EVAL_PROMPT_VERSION,
    },
  });

  if (!response.ok) {
    throw new AiCompleteTransportError(response.error.message, response.error.code as never, response.error.retryable);
  }

  const output = SignalThesisEvalOutputSchema.parse(response.data);
  return { output, metadata: response.metadata };
}

export async function executeThesisChallengeViaGateway(params: {
  thesis: PositioningThesis;
  client?: AiCompleteHttpClient;
}): Promise<{ output: ThesisChallengeOutput; metadata: AiExecutionMetadata }> {
  assertAdminGateway();
  const input = mapThesisToChallengeGatewayInput(params.thesis);
  const httpClient = params.client ?? defaultClient;
  const response = await httpClient.execute({
    operation: 'THESIS_CHALLENGE',
    clientId: params.thesis.clientId,
    input,
    prompt: {
      promptId: THESIS_CHALLENGE_PROMPT_ID,
      promptVersion: THESIS_CHALLENGE_PROMPT_VERSION,
    },
  });

  if (!response.ok) {
    throw new AiCompleteTransportError(response.error.message, response.error.code as never, response.error.retryable);
  }

  const output = ThesisChallengeOutputSchema.parse(response.data);
  return { output, metadata: response.metadata };
}

export { mapGatewayErrorToUserMessage };
