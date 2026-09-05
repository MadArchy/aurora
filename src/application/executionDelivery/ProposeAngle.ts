import type { CurationEntry } from '../../types';
import { ExecutionDeliveryError } from './errors';
import type { AdvisorCurationAnglePort } from './ports/AdvisorCurationAnglePort';
import type { CurationAnglePersistencePort } from './ports/CurationAnglePersistencePort';
import type { CurationRepositoryPort } from './ports/CurationRepositoryPort';
import type { CurationStrategicBriefReadPort } from './ports/CurationStrategicBriefReadPort';
import type { CurationThesisReadPort } from './ports/CurationThesisReadPort';
import type { SignalReadPort } from './ports/SignalReadPort';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireAdminRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export interface ProposeAngleInput {
  trusted: TrustedExecutionDeliveryContext;
  curationEntryId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export type ProposeAngleCompat =
  | 'CURATION_NOT_FOUND'
  | 'THESIS_NOT_RESOLVED';

export type ProposeAngleResult =
  | { ok: true; angle: string; usedLiveModel: boolean }
  | { ok: false; compat: ProposeAngleCompat };

export interface ProposeAngleDeps {
  curation: CurationRepositoryPort;
  strategicBriefs: CurationStrategicBriefReadPort;
  signals: SignalReadPort;
  theses: CurationThesisReadPort;
  advisor: AdvisorCurationAnglePort;
  angles: CurationAnglePersistencePort;
}

function resolveThesisId(entry: CurationEntry, deps: ProposeAngleDeps): string | undefined {
  if (entry.strategicBriefId) {
    const brief = deps.strategicBriefs.getById(entry.strategicBriefId, entry.clientId);
    if (brief?.thesisId) return brief.thesisId;
  }
  if (entry.signalId) {
    const signal = deps.signals.getById(entry.signalId);
    return signal?.routingDecision?.selectedThesisId;
  }
  return undefined;
}

/**
 * CR-1 #15 — ProposeAngle.
 * Authoritative gate-time reload; ADMIN-only; SPEC-005 live gateway or local heuristic; aiAngle only.
 */
export function createProposeAngle(deps: ProposeAngleDeps) {
  return async function proposeAngle(input: ProposeAngleInput): Promise<ProposeAngleResult> {
    const curationEntryId = input.curationEntryId?.trim();
    if (!curationEntryId) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'Curation entry id is required.');
    }

    assertTrustedExecutionContext(input.trusted);
    requireAdminRole(input.trusted);
    assertNoExecutionSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
    });

    const entry = deps.curation.getById(curationEntryId);
    if (!entry) {
      return { ok: false, compat: 'CURATION_NOT_FOUND' };
    }
    if (entry.clientId !== input.trusted.clientId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Curation entry does not belong to the trusted client entitlement.'
      );
    }
    if (entry.organizationId !== input.trusted.organizationId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Curation entry does not belong to the trusted organization.'
      );
    }

    const thesisId = resolveThesisId(entry, deps);
    if (!thesisId) {
      return { ok: false, compat: 'THESIS_NOT_RESOLVED' };
    }

    const thesis = deps.theses.getById(entry.clientId, thesisId);
    if (!thesis) {
      throw new ExecutionDeliveryError(
        'INVALID_INPUT',
        'Explicit governed thesis context is required for proposeAngle.'
      );
    }

    const gateTitle = entry.title;
    const gateSnippet = entry.snippet;

    const generated = await deps.advisor.generateAngle({
      thesis,
      title: gateTitle,
      snippet: gateSnippet,
    });

    try {
      deps.angles.setAngle(curationEntryId, generated.angle);
    } catch (err) {
      throw new ExecutionDeliveryError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to persist curation angle.'
      );
    }

    return {
      ok: true,
      angle: generated.angle,
      usedLiveModel: generated.usedLiveModel,
    };
  };
}
