import type { AiOperation } from '../../../domain/ai/operations';
import type { SchemaIdentity } from '../../../domain/ai/schemaIdentity';

/** Controlled schema contract hints — not raw Zod internals. */
const OPERATION_SCHEMA_GUIDANCE: Record<AiOperation, string> = {
  CONTENT_DRAFT: 'Object with title (string, 1-500 chars) and body (string, min 1). Strict — no extra keys.',
  THESIS_PROPOSAL:
    'Object with title, expertIdentity, identityCurrent, perceptionTarget, targetAudience, domain, objective, differentiator, proofPoints (string[]), audiences, territories, objectives, voiceAndTone, voiceAvoid, hardBlocks, softAvoid, complianceRules. Strict — no extra keys.',
  SIGNAL_THESIS_EVAL:
    'Object with relevanceScore (number), alignmentSummary (string), recommendedAction (enum), rationale (string). Strict — no extra keys.',
  THESIS_CHALLENGE:
    'Object with outcome (enum), recommendations (string[]), riskScore (number). Strict — no extra keys.',
  ADVISOR_POSITIONING:
    'Object with headline (string), positioningStatement (string), keyMessages (string[]). Strict — no extra keys.',
  ADVISOR_CURATION_ANGLE: 'Object with angle (string). Strict — no extra keys.',
  ANALYSIS_COMPARATIVE:
    'Object with summary (string), strengths (string[]), weaknesses (string[]), opportunities (string[]). Strict — no extra keys.',
};

export function buildRepairSchemaGuidance(operation: AiOperation, schemaIdentity: SchemaIdentity): string {
  const guidance = OPERATION_SCHEMA_GUIDANCE[operation];
  return `${schemaIdentity.schemaId}@${schemaIdentity.schemaVersion}: ${guidance}`;
}
