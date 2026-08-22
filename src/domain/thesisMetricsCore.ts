import type {
  ContentItem,
  PositioningThesis,
  Signal,
  SignalOutcome,
} from '../types';
import { computeThesisStrength } from './thesisStrengthCore';
import type { EvidenceVaultItem } from '../types';

export interface ThesisLearningMetrics {
  thesisId: string;
  signalsScored: number;
  signalsUseful: number;
  signalsNotUseful: number;
  routingOverrides: number;
  contentPublished: number;
  claimFindings: number;
  claimBlocks: number;
  authorityScore: number;
  summary: string;
}

/**
 * Métricas de aprendizaje por tesis. Puras: no mutan pesos automáticamente.
 */
export function computeThesisLearningMetrics(input: {
  thesis: PositioningThesis;
  signals: Signal[];
  outcomes: SignalOutcome[];
  content: ContentItem[];
  evidence: EvidenceVaultItem[];
}): ThesisLearningMetrics {
  const { thesis, signals, outcomes, content, evidence } = input;
  const thesisSignals = signals.filter((s) => s.thesisId === thesis.id);
  const outcomeBySignal = new Map(outcomes.map((o) => [o.signalId, o]));

  let useful = 0;
  let notUseful = 0;
  for (const signal of thesisSignals) {
    const outcome = outcomeBySignal.get(signal.id);
    if (outcome?.kind === 'USEFUL') useful += 1;
    if (outcome?.kind === 'NOT_USEFUL') notUseful += 1;
  }

  const routingOverrides = thesisSignals.filter((s) => s.routingDecision?.source === 'MANUAL').length;
  const thesisContent = content.filter((c) => c.thesisId === thesis.id);
  const contentPublished = thesisContent.filter((c) => c.status === 'PUBLISHED' || c.status === 'READY').length;
  const claimFindings = thesisContent.reduce((acc, c) => acc + (c.claimSafety?.findings.length || 0), 0);
  const claimBlocks = thesisContent.filter((c) => c.claimSafety?.verdict === 'BLOCK').length;
  const authorityScore = computeThesisStrength(thesis, evidence).authorityScore;

  const parts = [
    `${thesisSignals.length} señales`,
    useful + notUseful ? `${useful} útiles / ${notUseful} no útiles` : null,
    routingOverrides ? `${routingOverrides} overrides` : null,
    `${contentPublished} publicados`,
    claimBlocks ? `${claimBlocks} bloqueados por claims` : null,
    `autoridad ${authorityScore}`,
  ].filter(Boolean);

  return {
    thesisId: thesis.id,
    signalsScored: thesisSignals.length,
    signalsUseful: useful,
    signalsNotUseful: notUseful,
    routingOverrides,
    contentPublished,
    claimFindings,
    claimBlocks,
    authorityScore,
    summary: parts.join(' · '),
  };
}
