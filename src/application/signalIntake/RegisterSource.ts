import type { Source, SourceType } from '../../types';
import { SignalIntakeError } from './errors';
import type { SourceRegistryPort } from './ports/SourceRegistryPort';
import {
  assertNoSignalIntakeSpoof,
  assertTrustedSignalIntakeContext,
  requireAdminRole,
  type TrustedSignalIntakeContext,
} from './trustedContext';

export interface RegisterSourceInput {
  trusted: TrustedSignalIntakeContext;
  name: string;
  type: SourceType;
  url?: string;
  fetchIntervalMinutes?: number;
  /** Explicit thesis binding only when UI already chose an id — never positional. */
  thesisId?: string | null;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedMatchedThesisId?: string;
  claimedScore?: number;
  claimedRoutingDecision?: string;
  claimedStrategicDecision?: string;
}

export interface RegisterSourceResult {
  source: Source;
}

export interface RegisterSourceDeps {
  sources: SourceRegistryPort;
}

/**
 * CR-1 #8 + #24 — RegisterSource (single command for both UI surfaces).
 * APPLICATION_PLUS_PORT — no new Domain rule.
 */
export function createRegisterSource(deps: RegisterSourceDeps) {
  return function registerSource(input: RegisterSourceInput): RegisterSourceResult {
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

    const name = input.name?.trim();
    if (!name) {
      throw new SignalIntakeError('INVALID_INPUT', 'Source name is required.');
    }
    if (!input.type?.trim()) {
      throw new SignalIntakeError('INVALID_INPUT', 'Source type is required.');
    }

    const fetchIntervalMinutes =
      typeof input.fetchIntervalMinutes === 'number' && Number.isFinite(input.fetchIntervalMinutes)
        ? Math.max(1, Math.floor(input.fetchIntervalMinutes))
        : 360;

    const record: Omit<Source, 'id' | 'createdAt' | 'itemCount'> = {
      organizationId: input.trusted.organizationId,
      clientId: input.trusted.clientId,
      thesisId: input.thesisId ?? undefined,
      name,
      type: input.type,
      url: input.url?.trim() || undefined,
      fetchIntervalMinutes,
      status: 'ACTIVE',
      createdBy: input.trusted.actorId,
    };

    try {
      const source = deps.sources.add(record);
      return { source };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to register source.';
      if (/quota|límite|limit/i.test(message)) {
        throw new SignalIntakeError('QUOTA_EXCEEDED', message);
      }
      throw new SignalIntakeError('PERSISTENCE_ERROR', message);
    }
  };
}
