import type { Signal } from '../../types';
import { SignalIntakeError } from './errors';
import type { SignalIntakePort } from './ports/SignalIntakePort';
import {
  assertNoSignalIntakeSpoof,
  assertTrustedSignalIntakeContext,
  requireAdminRole,
  type TrustedSignalIntakeContext,
} from './trustedContext';

export interface MarkSignalSavedInput {
  trusted: TrustedSignalIntakeContext;
  /** Caller identifies intent only — Application reloads authoritative Signal. */
  signalId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export interface MarkSignalSavedResult {
  signal: Signal;
}

export interface MarkSignalSavedDeps {
  signals: SignalIntakePort;
}

/**
 * CR-1 #21b — MarkSignalSaved.
 * Manager/admin SAVED outcome only. No routing / scoring / thesis authority.
 */
export function createMarkSignalSaved(deps: MarkSignalSavedDeps) {
  return function markSignalSaved(input: MarkSignalSavedInput): MarkSignalSavedResult {
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

    try {
      const updated = deps.signals.decideManagerOutcome({
        signalId,
        decision: 'SAVED',
      });
      return { signal: updated };
    } catch (err) {
      if (err instanceof SignalIntakeError) throw err;
      throw new SignalIntakeError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to mark signal saved.'
      );
    }
  };
}
