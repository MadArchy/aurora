import type { AiOperation } from '../../../domain/ai/operations';
import type { SchemaIdentity } from '../../../domain/ai/schemaIdentity';

/** Controlled schema contract hints — not raw Zod internals. */
const OPERATION_SCHEMA_GUIDANCE: Record<AiOperation, string> = {
  CONTENT_DRAFT: 'Object with title (string, 1-500 chars) and body (string, min 1). Strict — no extra keys.',
  THESIS_PROPOSAL:
    'Object with title, expertIdentity, identityCurrent, perceptionTarget, targetAudience, domain, objective, differentiator, proofPoints (string[]), audiences, territories, objectives, voiceAndTone, voiceAvoid, hardBlocks, softAvoid, complianceRules. Strict — no extra keys.',
  SIGNAL_THESIS_EVAL:
    'Object with proposedAngle (string), strategicRationale (string), recommendedAction (string). Strict — no extra keys.',
  THESIS_CHALLENGE:
    'Object with outcome (enum), recommendations (string[]), riskScore (number). Strict — no extra keys.',
  ADVISOR_POSITIONING:
    'Object with optional summary (string), diagnosis { strengths?, gaps?, risks? }, actions [{ title?, description?, category?, horizon?, priority? }]. At least one of summary, diagnosis, or actions required. Strict — no extra keys.',
  ADVISOR_CURATION_ANGLE: 'Object with angle (string). Strict — no extra keys.',
  ANALYSIS_COMPARATIVE:
    'Object with angle (string), rationale (string). Strict — no extra keys. (Per-provider comparative slice.)',
};

export function buildRepairSchemaGuidance(operation: AiOperation, schemaIdentity: SchemaIdentity): string {
  const guidance = OPERATION_SCHEMA_GUIDANCE[operation];
  return `${schemaIdentity.schemaId}@${schemaIdentity.schemaVersion}: ${guidance}`;
}
