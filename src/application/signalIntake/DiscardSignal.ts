import type { Signal } from '../../types';
import { SignalIntakeError } from './errors';
import type { SignalIntakePort } from './ports/SignalIntakePort';
import {
  assertNoSignalIntakeSpoof,
  assertTrustedSignalIntakeContext,
  requireAdminRole,
  type TrustedSignalIntakeContext,
} from './trustedContext';

export interface DiscardSignalInput {
  trusted: TrustedSignalIntakeContext;
  /** Caller identifies intent only — Application reloads authoritative Signal. */
  signalId: string;
  reason?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export interface DiscardSignalResult {
  signal: Signal;
}

export interface DiscardSignalDeps {
  signals: SignalIntakePort;
}

const DEFAULT_DISCARD_REASON = 'Descartado por el manager en el radar.';

/**
 * CR-1 #20 — DiscardSignal.
 * Manager/admin DISCARDED outcome only. No routing / scoring / thesis authority.
 */
export function createDiscardSignal(deps: DiscardSignalDeps) {
  return function discardSignal(input: DiscardSignalInput): DiscardSignalResult {
    assertTrustedSignalIntakeContext(input.trusted);
    requireAdminRole(input.trusted);
    assertNoSignalIntakeSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
    });

    const signalId = input.signalId?.trim();
    if (!signalId) {
      throw new SignalIntakeError('INVALID_INPUT', 'Signal id is required.');
    }

    const signal = deps.signals.getById(signalId);
    if (!signal) {
      throw new SignalIntakeError('SIGNAL_NOT_FOUND', `Signal not found: ${signalId}`);
    }
    if (signal.clientId !== input.trusted.clientId) {
      throw new SignalIntakeError(
        'TENANT_CONTEXT_INVALID',
        'Signal does not belong to the trusted client entitlement.'
      );
    }
    if (signal.organizationId !== input.trusted.organizationId) {
      throw new SignalIntakeError(
        'TENANT_CONTEXT_INVALID',
        'Signal does not belong to the trusted organization.'
      );
    }

    const reason = input.reason?.trim() || DEFAULT_DISCARD_REASON;

    try {
      const updated = deps.signals.decideManagerOutcome({
        signalId,
        decision: 'DISCARDED',
        reason,
      });
      return { signal: updated };
    } catch (err) {
      if (err instanceof SignalIntakeError) throw err;
      throw new SignalIntakeError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to discard signal.'
      );
    }
  };
}
