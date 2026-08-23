import type { PositioningThesis } from '../types';
import { dbService } from './db';
import { normalizeThesis } from '../domain/thesisModelCore';
import {
  type ContentDraftGatewayInput,
  ContentDraftGatewayInputSchema,
  ContentDraftFormatSchema,
} from '../application/ai/schemas/contentDraftInput';

export function mapThesisToContentDraftGatewayInput(params: {
  thesis: PositioningThesis;
  topicTitle: string;
  format: ContentDraftGatewayInput['format'];
  extras?: {
    roleAngle?: string;
    venueLabel?: string;
    why?: string;
    angle?: string;
  };
}): ContentDraftGatewayInput {
  const structured = normalizeThesis(params.thesis);
  const evidence = dbService
    .getEvidenceVaultByClient(params.thesis.clientId)
    .filter((item) => item.verified)
    .slice(0, 6);
  const voiceHint = structured.voiceProfile.style || params.thesis.voiceAndTone;
  const hardBlocks =
    structured.limits.hardBlocks.join(' | ') || params.thesis.complianceRules || 'sin límites duros';
  const evidenceHint = evidence.length
    ? evidence.map((item) => `${item.title}: ${item.snippet.slice(0, 80)}`).join(' · ')
    : params.thesis.proofPoints.join(' | ');

  const mapped = {
    format: params.format,
    topicTitle: params.topicTitle,
    voiceHint,
    perceptionTarget: structured.perceptionTarget || params.thesis.expertIdentity,
    evidenceHint,
    hardBlocks,
    voiceAvoid: (structured.voiceProfile.avoid || []).join(', ') || 'hype',
    expertIdentity: params.thesis.expertIdentity,
    angle: params.extras?.angle,
    academic:
      params.format === 'ACADEMIC_PAPER'
        ? {
            roleAngle: params.extras?.roleAngle || params.thesis.expertIdentity,
            venueLabel: params.extras?.venueLabel || 'working paper',
            why: params.extras?.why || 'inteligencia del radar + tesis',
          }
        : undefined,
  };

  return ContentDraftGatewayInputSchema.parse(mapped);
}

export function parseContentDraftFormat(value: string): ContentDraftGatewayInput['format'] {
  return ContentDraftFormatSchema.parse(value);
}
