import type { PositioningThesis } from '../types';
import { normalizeThesis } from '../domain/thesisModelCore';
import {
  ThesisChallengeGatewayInputSchema,
  type ThesisChallengeGatewayInput,
} from '../application/ai/schemas/thesisChallengeInput';

export function mapThesisToChallengeGatewayInput(thesis: PositioningThesis): ThesisChallengeGatewayInput {
  const structured = normalizeThesis(thesis);
  return ThesisChallengeGatewayInputSchema.parse({
    thesisId: thesis.id,
    title: thesis.title,
    expertIdentity: thesis.expertIdentity,
    audience: thesis.targetAudience,
    domain: thesis.domain,
    proofPoints: thesis.proofPoints || [],
    territories: structured.territories.map((t) => t.name),
  });
}
