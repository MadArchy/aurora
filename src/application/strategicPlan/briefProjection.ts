import type { StrategicBrief } from '../../domain/strategicBriefCore';
import type { PlanBriefContext } from '../../domain/planBriefContextCore';
import { StrategicPlanError } from './errors';
import type { StrategicBriefReader } from './ports/StrategicBriefReader';
import type { PlanTenantScope } from './ports/StrategicPlanRepository';
import type { TrustedPlanActorContext } from './trustedContext';

/** Map frozen SPEC-003 Brief → Domain PlanBriefContext projection. */
export function toPlanBriefContext(brief: StrategicBrief): PlanBriefContext {
  return {
    id: brief.id,
    version: brief.version,
    status: brief.status,
    organizationId: brief.organizationId,
    clientId: brief.clientId,
    thesisId: brief.thesisId,
    authorizedAction: brief.decision.authorizedAction,
    signalIds: [...brief.signalIds],
  };
}

export function loadAuthoritativeBrief(
  briefs: StrategicBriefReader,
  trusted: TrustedPlanActorContext,
  briefId: string
): StrategicBrief {
  const tenant: PlanTenantScope = {
    organizationId: trusted.organizationId,
    clientId: trusted.clientId,
  };
  const brief = briefs.getById(briefId, tenant);
  if (!brief) {
    throw new StrategicPlanError('BRIEF_NOT_FOUND', `Brief not found: ${briefId}`);
  }
  if (
    brief.organizationId !== trusted.organizationId ||
    brief.clientId !== trusted.clientId
  ) {
    throw new StrategicPlanError(
      'TENANT_ACCESS_DENIED',
      'Brief tenant does not match trusted context.'
    );
  }
  return brief;
}

export function requireApprovedCurrentBrief(brief: StrategicBrief): void {
  if (brief.status === 'SUPERSEDED') {
    throw new StrategicPlanError('BRIEF_NOT_CURRENT', 'Brief is SUPERSEDED.');
  }
  if (brief.status !== 'APPROVED') {
    throw new StrategicPlanError(
      'BRIEF_NOT_APPROVED',
      `Brief status=${brief.status} is not APPROVED.`
    );
  }
}
