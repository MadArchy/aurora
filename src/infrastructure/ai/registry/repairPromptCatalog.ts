import type { AiOperation } from '../../../domain/ai/operations';
import type { PromptIdentity } from '../../../domain/ai/promptIdentity';
import type { SchemaIdentity } from '../../../domain/ai/schemaIdentity';
import type { ValidationIssue } from '../../../application/ai/validation/validateOutput';
import { buildRepairSchemaGuidance } from '../../../application/ai/resilience/repairSchemaGuidance';
import { sanitizeInvalidOutputForRepair } from '../../../application/ai/resilience/sanitizeRepairOutput';
import { computePromptHash } from './promptHash';

/** Frozen repair prompt identity (Phase 3). */
export const REPAIR_PROMPT_IDENTITY: PromptIdentity = {
  promptId: 'ai_output_repair',
  promptVersion: '1',
};

export const REPAIR_PROMPT_SYSTEM_MESSAGE =
  'Eres un corrector de salidas JSON estructuradas. Devuelve únicamente JSON válido que cumpla el contrato indicado. Sin markdown ni texto adicional.';

/**
 * Canonical versioned user template — placeholders only.
 * promptHash identifies this template, NOT rendered execution values.
 */
export const REPAIR_USER_TEMPLATE_CANONICAL = [
  'Operation: {{operation}}',
  'Required output contract: {{schemaGuidance}}',
  'Validation issues:',
  '{{validationIssues}}',
  'Invalid model output (bounded):',
  '{{invalidOutput}}',
  'Return corrected structured JSON only.',
].join('\n');

/** SHA-256 of frozen repair prompt version 1 (system + canonical user template). */
export function computeRepairPromptTemplateHash(): string {
  return computePromptHash(REPAIR_PROMPT_SYSTEM_MESSAGE, REPAIR_USER_TEMPLATE_CANONICAL);
}

/** Stable hash for ai_output_repair@1 — constant while template unchanged. */
export const REPAIR_PROMPT_TEMPLATE_HASH = computeRepairPromptTemplateHash();

export interface RepairPromptRenderInput {
  operation: AiOperation;
  schemaIdentity: SchemaIdentity;
  validationIssues: ValidationIssue[];
  invalidOutput: string;
}

export function renderRepairUserMessage(input: RepairPromptRenderInput): string {
  const schemaGuidance = buildRepairSchemaGuidance(input.operation, input.schemaIdentity);
  const issues = input.validationIssues
    .slice(0, 20)
    .map((issue) => `- ${issue.path}: ${issue.message}`)
    .join('\n');
  const boundedOutput = sanitizeInvalidOutputForRepair(input.invalidOutput);

  return [
    `Operation: ${input.operation}`,
    `Required output contract: ${schemaGuidance}`,
    'Validation issues:',
    issues || '- (none listed)',
    'Invalid model output (bounded):',
    boundedOutput,
    'Return corrected structured JSON only.',
  ].join('\n');
}
