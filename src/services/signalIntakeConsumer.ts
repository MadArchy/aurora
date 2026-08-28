/**
 * CR-1 Workstream 4 — Signal Intake consumer facade.
 *
 * Security: requireTenantScope. Commands: RegisterSource (#8/#24), RegisterManualSignal (#26).
 * Does not own thesis routing or scoring (SPEC-001).
 */

import type { SourceType } from '../types';
import {
  SignalIntakeError,
  type RegisterManualSignalResult,
  type RegisterSourceResult,
} from '../application/signalIntake';
import { composeSignalIntake } from '../composition/signalIntake/composeSignalIntake';
import { requireTenantScope } from '../controllers/trustedTenant';
import { authService } from './auth';
import { auditService } from './audit';
import { dbService } from './db';

type SignalIntakeUseCases = ReturnType<typeof composeSignalIntake>;

let useCases: SignalIntakeUseCases = composeSignalIntake();

/** Test-only reset — not production API. */
export function resetSignalIntakeConsumerForTest(next?: SignalIntakeUseCases): void {
  useCases = next ?? composeSignalIntake();
}

function mapError(err: unknown, fallback: string): never {
  if (err instanceof SignalIntakeError) throw err;
  throw new SignalIntakeError(
    'PERSISTENCE_ERROR',
    err instanceof Error ? err.message : fallback
  );
}

function gate(requestedClientId: string | null | undefined) {
  const decision = requireTenantScope(requestedClientId, {
    getCurrentUser: () => authService.getCurrentUser(),
    getClientById: (id) => dbService.getClientById(id),
  });
  if (!decision.ok) {
    throw new SignalIntakeError('ACTOR_NOT_AUTHORIZED', decision.message);
  }
  return decision;
}

export interface RegisterSourceIntent {
  requestedClientId: string | null | undefined;
  name: string;
  type: SourceType;
  url?: string;
  fetchIntervalMinutes?: number;
  thesisId?: string | null;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedMatchedThesisId?: string;
  claimedScore?: number;
  claimedRoutingDecision?: string;
  claimedStrategicDecision?: string;
}

/** Registry #8 + #24 — single canonical command. */
export function registerSource(intent: RegisterSourceIntent): RegisterSourceResult {
  const g = gate(intent.requestedClientId);
  try {
    const result = useCases.registerSource({
      trusted: {
        actorId: g.actorId,
        actorRole: g.actorRole,
        organizationId: g.organizationId,
        clientId: g.clientId,
        now: new Date().toISOString(),
      },
      name: intent.name,
      type: intent.type,
      url: intent.url,
      fetchIntervalMinutes: intent.fetchIntervalMinutes,
      thesisId: intent.thesisId,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
      claimedMatchedThesisId: intent.claimedMatchedThesisId,
      claimedScore: intent.claimedScore,
      claimedRoutingDecision: intent.claimedRoutingDecision,
      claimedStrategicDecision: intent.claimedStrategicDecision,
    });
    auditService.log(authService.getCurrentUser(), 'ADD_SOURCE', 'Source', result.source.id, {
      type: result.source.type,
      clientId: g.clientId,
      name: result.source.name,
    });
    return result;
  } catch (err) {
    mapError(err, 'No se pudo registrar la fuente');
  }
}

export interface RegisterManualSignalIntent {
  requestedClientId: string | null | undefined;
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

/** Registry #26 */
export function registerManualSignal(
  intent: RegisterManualSignalIntent
): RegisterManualSignalResult {
  const g = gate(intent.requestedClientId);
  try {
    const result = useCases.registerManualSignal({
      trusted: {
        actorId: g.actorId,
        actorRole: g.actorRole,
        organizationId: g.organizationId,
        clientId: g.clientId,
        now: new Date().toISOString(),
      },
      title: intent.title,
      contentSnippet: intent.contentSnippet,
      sourceUrl: intent.sourceUrl,
      sourceName: intent.sourceName,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
      claimedMatchedThesisId: intent.claimedMatchedThesisId,
      claimedScore: intent.claimedScore,
      claimedRoutingDecision: intent.claimedRoutingDecision,
      claimedStrategicDecision: intent.claimedStrategicDecision,
    });
    if (!result.isDuplicate) {
      auditService.log(
        authService.getCurrentUser(),
        'INGEST_SIGNAL_MANUAL',
        'Signal',
        result.signal.id,
        { clientId: g.clientId }
      );
    }
    return result;
  } catch (err) {
    mapError(err, 'No se pudo registrar la señal manual');
  }
}
