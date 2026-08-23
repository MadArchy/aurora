import type { PositioningThesis, Signal } from '../types';
import {
  AnalysisComparativeGatewayInputSchema,
  type AnalysisComparativeGatewayInput,
} from '../application/ai/schemas/analysisComparativeInput';

export function mapSignalThesisToComparativeGatewayInput(
  signal: Signal,
  thesis: PositioningThesis
): AnalysisComparativeGatewayInput {
  return AnalysisComparativeGatewayInputSchema.parse({
    signalId: signal.id,
    thesisId: thesis.id,
    thesisTitle: thesis.title,
    targetAudience: thesis.targetAudience,
    signalTitle: signal.title,
    signalSnippet: signal.contentSnippet,
  });
}
