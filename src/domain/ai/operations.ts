/**
 * Product/domain AI operations — not provider API names.
 * Derived from Phase-0 LLM call-site inventory.
 */
export const AI_OPERATIONS = [
  'CONTENT_DRAFT',
  'THESIS_PROPOSAL',
  'SIGNAL_THESIS_EVAL',
  'THESIS_CHALLENGE',
  'ADVISOR_POSITIONING',
  'ADVISOR_CURATION_ANGLE',
  'ANALYSIS_COMPARATIVE',
] as const;

export type AiOperation = (typeof AI_OPERATIONS)[number];

export const CLIENT_SCOPED_OPERATIONS: ReadonlySet<AiOperation> = new Set(AI_OPERATIONS);

export function isAiOperation(value: string): value is AiOperation {
  return (AI_OPERATIONS as readonly string[]).includes(value);
}

export function isClientScopedOperation(operation: AiOperation): boolean {
  return CLIENT_SCOPED_OPERATIONS.has(operation);
}
