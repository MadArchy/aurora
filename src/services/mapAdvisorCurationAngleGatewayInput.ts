import type { PositioningThesis } from '../types';
import {
  AdvisorCurationAngleGatewayInputSchema,
  type AdvisorCurationAngleGatewayInput,
} from '../application/ai/schemas/advisorCurationAngleInput';

export function mapCurationAngleToGatewayInput(params: {
  thesis: PositioningThesis;
  title: string;
  snippet: string;
}): AdvisorCurationAngleGatewayInput {
  return AdvisorCurationAngleGatewayInputSchema.parse({
    thesisTitle: params.thesis.title,
    expertIdentity: params.thesis.expertIdentity,
    targetAudience: params.thesis.targetAudience,
    complianceRules: params.thesis.complianceRules || '',
    signalTitle: params.title,
    signalSnippet: params.snippet,
  });
}
