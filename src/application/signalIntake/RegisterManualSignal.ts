import type { Signal } from '../../types';
import { SignalIntakeError } from './errors';
import type { SignalIntakePort } from './ports/SignalIntakePort';
import {
  assertNoSignalIntakeSpoof,
  assertTrustedSignalIntakeContext,
  requireAdminRole,
  type TrustedSignalIntakeContext,
} from './trustedContext';

export interface RegisterManualSignalInput {
  trusted: TrustedSignalIntakeContext;
  title: string;
  contentSnippet?: string;
  sourceUrl?: string;
  sourceName?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedMatchedThesisId?: string;
  claimedScore?: number;
  claimedRoutingDecision?: string;
  claimedStrategicDecision?: string;
}

export interface RegisterManualSignalResult {
  signal: Signal;
  isDuplicate: boolean;
}

export interface RegisterManualSignalDeps {
  signals: SignalIntakePort;
}

/**
 * CR-1 #26 — RegisterManualSignal.
 * Ends at authoritative persistence. No routing / scoring / thesis matching.
 */
export function createRegisterManualSignal(deps: RegisterManualSignalDeps) {
  return function registerManualSignal(
    input: RegisterManualSignalInput
  ): RegisterManualSignalResult {
    assertTrustedSignalIntakeContext(input.trusted);
    requireAdminRole(input.trusted);
    assertNoSignalIntakeSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
      claimedMatchedThesisId: input.claimedMatchedThesisId,
      claimedScore: input.claimedScore,
      claimedRoutingDecision: input.claimedRoutingDecision,
      claimedStrategicDecision: input.claimedStrategicDecision,
    });

    const title = input.title?.trim();
    if (!title) {
      throw new SignalIntakeError('INVALID_INPUT', 'Signal title is required.');
    }

    try {
      const result = deps.signals.add({
        organizationId: input.trusted.organizationId,
        clientId: input.trusted.clientId,
        title,
        sourceType: 'MANUAL',
        sourceName: input.sourceName?.trim() || 'Ingesta manual del manager',
        sourceUrl: input.sourceUrl?.trim() || undefined,
        contentSnippet:
          input.contentSnippet?.trim() ||
          'Acontecimiento ingresado manualmente para evaluación estratégica.',
        status: 'NEW',
      });

      if (result.isDuplicate) {
        return { signal: result.signal, isDuplicate: true };
      }
      return { signal: result.signal, isDuplicate: false };
    } catch (err) {
      if (err instanceof SignalIntakeError) throw err;
      throw new SignalIntakeError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to register manual signal.'
      );
    }
  };
}
