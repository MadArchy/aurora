/**
 * CR-1 Workstream 4 — Signal Intake consumer facade.
 *
 * Security: requireTenantScope. Commands: RegisterSource (#8/#24), RegisterManualSignal (#26),
 * PollRegisteredSource (#9).
 * Does not own thesis routing or scoring (SPEC-001) — invokes canonical consumer after ingest.
 */

import type { SourceType } from '../types';
import {
  SignalIntakeError,
  type DiscardSignalResult,
  type MarkSignalSavedResult,
  type PollAllActiveSourcesResult,
  type PollRegisteredSourceResult,
  type RegisterManualSignalResult,
  type RegisterSourceResult,
} from '../application/signalIntake';
import { composeSignalIntake } from '../composition/signalIntake/composeSignalIntake';
import { requireTenantScope } from '../controllers/trustedTenant';
import { authService } from './auth';
import { auditService } from './audit';
import { dbService } from './db';
import { metricsService } from './metrics';

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

function trustedFrom(g: ReturnType<typeof gate>) {
  return {
    actorId: g.actorId,
    actorRole: g.actorRole,
    organizationId: g.organizationId,
    clientId: g.clientId,
    now: new Date().toISOString(),
  };
}

/** Registry #9 — poll one registered source by id (authoritative reload). */
export async function pollRegisteredSource(intent: {
  requestedClientId: string | null | undefined;
  sourceId: string;
}): Promise<PollRegisteredSourceResult> {
  const g = gate(intent.requestedClientId);
  try {
    const result = await useCases.pollRegisteredSource({
      trusted: trustedFrom(g),
      sourceId: intent.sourceId,
    });
    metricsService.track(
      'ingest_source_poll',
      {
        accepted: result.accepted,
        rejected: result.rejected,
        duplicates: result.duplicates,
        fetched: result.fetched,
      },
      g.clientId
    );
    auditService.log(authService.getCurrentUser(), 'SOURCE_RUN_COMPLETED', 'Source', result.sourceId, {
      fetched: result.fetched,
      accepted: result.accepted,
      rejected: result.rejected,
      duplicates: result.duplicates,
    });
    return result;
  } catch (err) {
    mapError(err, 'No se pudo ingerir la fuente');
  }
}

/** Registry #9 — poll all active sources for trusted client. */
export async function pollAllActiveSources(intent: {
  requestedClientId: string | null | undefined;
}): Promise<PollAllActiveSourcesResult> {
  const g = gate(intent.requestedClientId);
  try {
    return await useCases.pollAllActiveSources({ trusted: trustedFrom(g) });
  } catch (err) {
    mapError(err, 'No se pudo ingerir las fuentes');
  }
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

export interface DiscardSignalIntent {
  requestedClientId: string | null | undefined;
  signalId: string;
  reason?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

/** Registry #20 — manager discard on radar. */
export function discardSignal(intent: DiscardSignalIntent): DiscardSignalResult {
  const g = gate(intent.requestedClientId);
  try {
    const result = useCases.discardSignal({
      trusted: trustedFrom(g),
      signalId: intent.signalId,
      reason: intent.reason,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
    });
    auditService.log(
      authService.getCurrentUser(),
      'SIGNAL_DISCARDED',
      'Signal',
      result.signal.id
    );
    return result;
  } catch (err) {
    mapError(err, 'No se pudo descartar la señal');
  }
}

export interface MarkSignalSavedIntent {
  requestedClientId: string | null | undefined;
  signalId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

/** Registry #21b — manager SAVED on send-to-curation composite. No consumer audit (#21 composite owns SIGNAL_TO_CURATION). */
export function markSignalSaved(intent: MarkSignalSavedIntent): MarkSignalSavedResult {
  const g = gate(intent.requestedClientId);
  try {
    return useCases.markSignalSaved({
      trusted: trustedFrom(g),
      signalId: intent.signalId,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
    });
  } catch (err) {
    mapError(err, 'No se pudo marcar la señal como guardada');
  }
}
