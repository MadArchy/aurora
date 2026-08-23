import type { ComparativeAnalysisAggregate } from '../application/ai/schemas/comparativeAnalysisAggregate';
import type { AIComparativeResult } from '../types';

/** Maps validated Gateway aggregate to legacy UI/domain consumer contract. */
export function mapComparativeAggregateToResult(
  aggregate: ComparativeAnalysisAggregate,
  signalId: string,
  thesisId: string
): AIComparativeResult {
  return {
    signalId,
    thesisId,
    openaiOutput: `${aggregate.openai.angle} — ${aggregate.openai.rationale}`,
    claudeOutput: `${aggregate.anthropic.angle} — ${aggregate.anthropic.rationale}`,
    consensusScore: 70,
    divergenceSummary: 'Revisa ambas salidas; no se fuerza consenso.',
    synthesizedRecommendation:
      'Combinar el ángulo operativo de OpenAI con el marco doctrinal de Claude. Humano decide.',
    winnerProvider: 'SYNTHESIS',
  };
}
