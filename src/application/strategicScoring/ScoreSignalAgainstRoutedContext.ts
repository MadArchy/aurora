import type { Signal } from '../../types';
import { SCORING_VERSION } from '../../domain/scoringCore';
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
  /** When true and writer is configured, persist via governed write port (Phase 2 contract). */
  persist?: boolean;
}

export interface ScoreSignalAgainstRoutedContextDeps {
  signals: SignalReadPort;
  theses: ThesisQueryPort;
  scoring: StrategicScoringPort;
  /** Optional — physical persistence deferred to Phase 3; fakes in tests. */
  writer?: StrategicScoreWritePort;
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

export function createScoreSignalAgainstRoutedContext(
  deps: ScoreSignalAgainstRoutedContextDeps
) {
  return function scoreSignalAgainstRoutedContext(
    input: ScoreSignalAgainstRoutedContextInput
  ): GovernedScoreResult {
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

    let persisted = false;
    if (input.persist && deps.writer) {
      try {
        deps.writer.persistGovernedScore({
          signalId: signal.id,
          clientId: input.clientId,
          organizationId: input.organizationId,
          scoreResult,
        });
        persisted = true;
      } catch (err) {
        if (err instanceof StrategicScoringError) throw err;
        throw new StrategicScoringError(
          'PERSISTENCE_ERROR',
          err instanceof Error ? err.message : 'Failed to persist governed score.'
        );
      }
    }

    return toGovernedScoreResult({
      signalId: signal.id,
      clientId: input.clientId,
      organizationId: input.organizationId,
      thesisId: governed.thesisId,
      scoreResult,
      persisted,
    });
  };
}
