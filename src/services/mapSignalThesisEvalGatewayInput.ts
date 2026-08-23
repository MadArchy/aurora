import type { PositioningThesis, Signal } from '../types';
import {
  SignalThesisEvalGatewayInputSchema,
  type SignalThesisEvalGatewayInput,
} from '../application/ai/schemas/signalThesisEvalInput';

export function mapSignalThesisToGatewayInput(
  signal: Signal,
  thesis: PositioningThesis
): SignalThesisEvalGatewayInput {
  return SignalThesisEvalGatewayInputSchema.parse({
    thesisId: thesis.id,
    thesisTitle: thesis.title,
    expertIdentity: thesis.expertIdentity,
    targetAudience: thesis.targetAudience,
    domain: thesis.domain,
    complianceRules: thesis.complianceRules || 'sin límites duros',
    signalId: signal.id,
    signalTitle: signal.title,
    signalSourceName: signal.sourceName || 'unknown',
    signalSnippet: (signal.contentSnippet || signal.title).slice(0, 4000),
  });
}
