import type { Signal, StrategicScoreResult } from '../../types';
import { SCORING_VERSION } from '../../domain/scoringCore';
import {
  SCORE_SYSTEM_ACTOR_ID,
  createScoreHistoryEntry,
  isMaterialScoreChange,
  toScoreHistorySnapshotFromResult,
  toScoreHistorySnapshotFromSignal,
} from '../../domain/scoreHistoryCore';
import { StrategicScoringError } from './errors';
import { toGovernedScoreResult, type GovernedScoreResult } from './governedScoreResult';
import { resolveGovernedThesisForScoring } from './routingGovernance';
import type { SignalReadPort, StrategicScoringPort, ThesisQueryPort } from './ports/GovernedScoringPorts';
import type { StrategicScoreWritePort } from './ports/StrategicScoreWritePort';

export interface ScoreSignalAgainstRoutedContextInput {
  signalId: string;
  clientId: string;
  /** Trusted organizationId from app/auth boundary — never invented. */
  organizationId: string;
  /** When true and writer is configured, persist via governed write port. */
  persist?: boolean;
  /** Optional clock for deterministic tests / trusted changedAt. */
  now?: string;
}

export interface ScoreSignalAgainstRoutedContextDeps {
  signals: SignalReadPort;
  theses: ThesisQueryPort;
  scoring: StrategicScoringPort;
  writer?: StrategicScoreWritePort;
}

export interface GovernedScorePersistOutcome {
  persisted: boolean;
  historyWritten: boolean;
}

function assertTrustedInput(input: ScoreSignalAgainstRoutedContextInput): void {
  if (!input.signalId?.trim() || !input.clientId?.trim() || !input.organizationId?.trim()) {
    throw new StrategicScoringError(
      'SCORING_INPUT_INVALID',
      'signalId, clientId, and organizationId are required.'
    );
  }
}

function assertSignalTenant(signal: Signal, input: ScoreSignalAgainstRoutedContextInput): void {
  if (signal.clientId !== input.clientId) {
    throw new StrategicScoringError(
      'TENANT_CONTEXT_INVALID',
      'Signal clientId does not match scoring context.'
    );
  }
  if (
    signal.organizationId &&
    input.organizationId &&
    signal.organizationId !== input.organizationId
  ) {
    throw new StrategicScoringError(
      'TENANT_CONTEXT_INVALID',
      'Signal organizationId does not match scoring context.'
    );
  }
}

export function persistGovernedScoreIfRequested(
  deps: ScoreSignalAgainstRoutedContextDeps,
  input: ScoreSignalAgainstRoutedContextInput,
  signal: Signal,
  governedThesisId: string,
  scoreResult: StrategicScoreResult
): GovernedScorePersistOutcome {
  if (!input.persist || !deps.writer) {
    return { persisted: false, historyWritten: false };
  }

  const changedAt = input.now ?? new Date().toISOString();
  const routingContext = {
    routingState: 'CLEAR' as const,
    routedThesisId: governedThesisId,
    routingAlgorithmVersion: signal.routingDecision?.algorithmVersion,
  };

  const previous = toScoreHistorySnapshotFromSignal(signal, governedThesisId);
  const next = toScoreHistorySnapshotFromResult(scoreResult, routingContext);

  let historyEntry = undefined;
  if (previous && isMaterialScoreChange(previous, next)) {
    historyEntry = createScoreHistoryEntry({
      organizationId: input.organizationId,
      clientId: input.clientId,
      signalId: signal.id,
      previous,
      next,
      actorId: SCORE_SYSTEM_ACTOR_ID,
      changedAt,
      rationale: scoreResult.strategicRationale,
    });
  }

  try {
    deps.writer.persistGovernedScore({
      signalId: signal.id,
      clientId: input.clientId,
      organizationId: input.organizationId,
      scoreResult,
      routingContext,
      changedAt,
      historyEntry,
    });
    return { persisted: true, historyWritten: Boolean(historyEntry) };
  } catch (err) {
    if (err instanceof StrategicScoringError) throw err;
    throw new StrategicScoringError(
      'PERSISTENCE_ERROR',
      err instanceof Error ? err.message : 'Failed to persist governed score.'
    );
  }
}

export function createScoreSignalAgainstRoutedContext(
  deps: ScoreSignalAgainstRoutedContextDeps
) {
  return function scoreSignalAgainstRoutedContext(
    input: ScoreSignalAgainstRoutedContextInput
  ): GovernedScoreResult & { historyWritten?: boolean } {
    assertTrustedInput(input);

    const signal = deps.signals.getSignalById(input.signalId);
    if (!signal) {
      throw new StrategicScoringError('SIGNAL_NOT_FOUND', `Signal not found: ${input.signalId}`);
    }
    assertSignalTenant(signal, input);

    const theses = deps.theses.getThesesForClient(input.clientId);
    const governed = resolveGovernedThesisForScoring(signal, theses);

    const scoreResult = deps.scoring.scoreThesis(signal, governed.thesis, input.clientId);
    if (!scoreResult.scoringVersion) {
      scoreResult.scoringVersion = SCORING_VERSION;
    }

    const persistOutcome = persistGovernedScoreIfRequested(
      deps,
      input,
      signal,
      governed.thesisId,
      scoreResult
    );

    const result = toGovernedScoreResult({
      signalId: signal.id,
      clientId: input.clientId,
      organizationId: input.organizationId,
      thesisId: governed.thesisId,
      scoreResult,
      persisted: persistOutcome.persisted,
    });

    return { ...result, historyWritten: persistOutcome.historyWritten };
  };
}
