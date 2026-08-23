import type { AiOperation } from './operations';

export const AI_MODEL_ROLES = [
  'FAST_STRUCTURED',
  'DEEP_REASONING',
  'CREATIVE_WRITING',
] as const;

export type AiModelRole = (typeof AI_MODEL_ROLES)[number];

export const DEFAULT_MODEL_ROLE_BY_OPERATION = {
  CONTENT_DRAFT: 'CREATIVE_WRITING',
  THESIS_PROPOSAL: 'DEEP_REASONING',
  SIGNAL_THESIS_EVAL: 'DEEP_REASONING',
  THESIS_CHALLENGE: 'DEEP_REASONING',
  ADVISOR_POSITIONING: 'DEEP_REASONING',
  ADVISOR_CURATION_ANGLE: 'FAST_STRUCTURED',
  ANALYSIS_COMPARATIVE: 'DEEP_REASONING',
} as const satisfies Record<AiOperation, AiModelRole>;

export function isAiModelRole(value: string): value is AiModelRole {
  return (AI_MODEL_ROLES as readonly string[]).includes(value);
}
