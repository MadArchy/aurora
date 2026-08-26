import type { StrategicPlan } from '../../domain/strategicPlanCore';
import { StrategicPlanError } from './errors';
import type {
  PlanTenantScope,
  StrategicPlanRepository,
} from './ports/StrategicPlanRepository';
import type { TrustedPlanActorContext } from './trustedContext';

export function loadAuthoritativePlan(
  plans: StrategicPlanRepository,
  trusted: TrustedPlanActorContext,
  planId: string
): StrategicPlan {
  const tenant: PlanTenantScope = {
    organizationId: trusted.organizationId,
    clientId: trusted.clientId,
  };
  const plan = plans.getById(planId, tenant);
  if (!plan) {
    throw new StrategicPlanError('PLAN_NOT_FOUND', `Plan not found: ${planId}`);
  }
  if (
    plan.organizationId !== trusted.organizationId ||
    plan.clientId !== trusted.clientId
  ) {
    throw new StrategicPlanError(
      'TENANT_ACCESS_DENIED',
      'Plan tenant does not match trusted context.'
    );
  }
  return plan;
}

export function clonePlan(plan: StrategicPlan): StrategicPlan {
  return {
    ...plan,
    signalIds: [...plan.signalIds],
    aiAdvisoryRefs: [...plan.aiAdvisoryRefs],
    items: plan.items.map((item) => ({
      ...item,
      riskNotes: [...item.riskNotes],
      downstreamRef: item.downstreamRef ? { ...item.downstreamRef } : null,
    })),
  };
}
