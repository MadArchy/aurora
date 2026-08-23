export {
  type AiGatewayRequest,
  type AiRequestMetadata,
  type ForbiddenGatewayRequestFields,
} from './contracts/request';
export {
  type AiExecutionMetadata,
  type ValidatedDomainOutput,
  type AiGatewaySuccess,
  type AiGatewayFailure,
  type AiGatewayResult,
  type UntrustedProviderOutput,
  aiGatewaySuccess,
  aiGatewayFailure,
  markValidatedDomainOutput,
  markUntrustedProviderOutput,
} from './contracts/result';
export {
  ContentDraftOutputSchema,
  CONTENT_DRAFT_SCHEMA_ID,
  CONTENT_DRAFT_SCHEMA_VERSION,
  type ContentDraftOutput,
} from './schemas/contentDraft';
export {
  ThesisProposalOutputSchema,
  THESIS_PROPOSAL_SCHEMA_ID,
  THESIS_PROPOSAL_SCHEMA_VERSION,
  type ThesisProposalOutput,
} from './schemas/thesisProposal';
export {
  SignalThesisEvalOutputSchema,
  SIGNAL_THESIS_EVAL_SCHEMA_ID,
  SIGNAL_THESIS_EVAL_SCHEMA_VERSION,
  type SignalThesisEvalOutput,
} from './schemas/signalThesisEval';
export {
  ThesisChallengeOutputSchema,
  THESIS_CHALLENGE_SCHEMA_ID,
  THESIS_CHALLENGE_SCHEMA_VERSION,
  type ThesisChallengeOutput,
} from './schemas/thesisChallenge';
export {
  AdvisorPositioningOutputSchema,
  ADVISOR_POSITIONING_SCHEMA_ID,
  ADVISOR_POSITIONING_SCHEMA_VERSION,
  type AdvisorPositioningOutput,
} from './schemas/advisorPositioning';
export {
  AdvisorCurationAngleOutputSchema,
  ADVISOR_CURATION_ANGLE_SCHEMA_ID,
  ADVISOR_CURATION_ANGLE_SCHEMA_VERSION,
  type AdvisorCurationAngleOutput,
} from './schemas/advisorCurationAngle';
export {
  ComparativeAnalysisOutputSchema,
  ANALYSIS_COMPARATIVE_SCHEMA_ID,
  ANALYSIS_COMPARATIVE_SCHEMA_VERSION,
  type ComparativeAnalysisOutput,
} from './schemas/comparativeAnalysis';
export {
  resolveOperationSchema,
  resolveSchemaIdentity,
  isOperationSupported,
  type AiOperationOutputMap,
  type OperationSchemaDefinition,
} from './schemas/outputRegistry';
export { extractJsonTextFromProviderRaw, parseProviderJson } from './validation/parseRawJson';
export {
  validateAiOutput,
  validationStatusFromResult,
  type ValidateAiOutputResult,
  type ValidationIssue,
} from './validation/validateOutput';
export {
  runValidationPipeline,
  canAttemptRepair,
  type ValidationPipelineState,
} from './validation/validationPipeline';
export {
  AiTenantContextSchema,
  validateTenantContextForOperation,
} from './validation/tenantContextValidation';
export { PromptIdentitySchema, assertPromptIdentity } from './validation/promptIdentitySchema';
export {
  type AiGatewayPort,
  type ExecuteAiOperationUseCase,
  assertGatewayRequestOperation,
} from './ports/inbound/AiGatewayPort';
export type {
  AiProviderPort,
  AiProviderCompletionRequest,
  AiProviderCompletionResponse,
  AiProviderMessage,
} from './ports/outbound/AiProviderPort';
export type { ModelRegistryPort, ModelConfiguration } from './ports/outbound/ModelRegistryPort';
export type { PromptRegistryPort, ResolvedPrompt } from './ports/outbound/PromptRegistryPort';
export type { AiRunRepositoryPort, AiRunPersistenceRecord } from './ports/outbound/AiRunRepositoryPort';
export { UnimplementedAiGateway } from './use-cases/UnimplementedAiGateway';
export { ExecuteAiOperation } from './use-cases/ExecuteAiOperation';
export { ProviderPortError, PromptResolutionError } from './errors/providerPortErrors';
export {
  MAX_PROVIDER_RETRIES,
  MAX_PROVIDER_CALLS_PER_EXECUTION,
  PROVIDER_RETRY_BACKOFF_MS,
  REPAIR_MODEL_ROLE,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  MAX_GATEWAY_EXECUTION_MS,
  AI_COMPLETE_FUNCTION_TIMEOUT_SECONDS,
  GATEWAY_EXECUTION_SAFETY_MARGIN_MS,
} from '../../domain/ai/constants';
export { executeProviderWithRetry, isRetryableProviderError, maxBackoffPerProviderSequence } from './resilience/providerRetryPolicy';
export { isValidationRepairEligible } from './resilience/repairEligibility';
export { ProviderCallBudget } from './resilience/providerCallBudget';
export { GatewayExecutionDeadline, GatewayDeadlineExceededError, createGatewayExecutionDeadline } from './resilience/gatewayExecutionDeadline';
