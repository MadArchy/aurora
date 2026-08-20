import { OrganizationSubscription, SubscriptionPlanTier } from '../types';

const PLANS: Record<SubscriptionPlanTier, OrganizationSubscription['quotas']> = {
  FOUNDING_PILOT: {
    tier: 'FOUNDING_PILOT',
    maxClients: 3,
    maxThesesPerClient: 1,
    maxMonthlyAiRuns: 80,
    maxSources: 10,
    maxAnalyzedSignalsMonthly: 50,
    maxStrategicActionsMonthly: 4,
    supportLevel: 'STANDARD',
    allowComparativeAi: false,
    allowCustomRss: true,
  },
  PROFESSIONAL: {
    tier: 'PROFESSIONAL',
    maxClients: 10,
    maxThesesPerClient: 2,
    maxMonthlyAiRuns: 250,
    maxSources: 25,
    maxAnalyzedSignalsMonthly: 150,
    maxStrategicActionsMonthly: 8,
    supportLevel: 'PRIORITY',
    allowComparativeAi: false,
    allowCustomRss: true,
  },
  AUTHORITY: {
    tier: 'AUTHORITY',
    maxClients: 25,
    maxThesesPerClient: 3,
    maxMonthlyAiRuns: 600,
    maxSources: 50,
    maxAnalyzedSignalsMonthly: 400,
    maxStrategicActionsMonthly: 16,
    supportLevel: 'PRIORITY',
    allowComparativeAi: true,
    allowCustomRss: true,
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    maxClients: 200,
    maxThesesPerClient: 8,
    maxMonthlyAiRuns: 5000,
    maxSources: 200,
    maxAnalyzedSignalsMonthly: 2000,
    maxStrategicActionsMonthly: 80,
    supportLevel: 'DEDICATED',
    allowComparativeAi: true,
    allowCustomRss: true,
  },
};

export function quotasFor(tier: SubscriptionPlanTier) {
  return { ...PLANS[tier] };
}

export type EntitlementCheck =
  | { ok: true }
  | { ok: false; code: string; message: string };

export function assertClientQuota(sub: OrganizationSubscription, activeClients: number): EntitlementCheck {
  if (activeClients >= sub.quotas.maxClients) {
    return {
      ok: false,
      code: 'QUOTA_CLIENTS',
      message: `Límite de clientes del plan ${sub.tier} alcanzado (${sub.quotas.maxClients}). Actualiza el plan para añadir más.`,
    };
  }
  return { ok: true };
}

export function assertSourceQuota(sub: OrganizationSubscription, sources: number): EntitlementCheck {
  if (sources >= sub.quotas.maxSources) {
    return { ok: false, code: 'QUOTA_SOURCES', message: `Límite de fuentes (${sub.quotas.maxSources}) alcanzado.` };
  }
  return { ok: true };
}

export function assertThesisQuota(sub: OrganizationSubscription, thesesForClient: number): EntitlementCheck {
  if (thesesForClient >= sub.quotas.maxThesesPerClient) {
    return { ok: false, code: 'QUOTA_THESES', message: `Máximo ${sub.quotas.maxThesesPerClient} tesis activas por cliente en ${sub.tier}.` };
  }
  return { ok: true };
}

export function assertAiQuota(sub: OrganizationSubscription): EntitlementCheck {
  if (sub.monthlyUsage.aiRuns >= sub.quotas.maxMonthlyAiRuns) {
    return { ok: false, code: 'QUOTA_AI', message: 'Presupuesto mensual de IA agotado. La app sigue usable en modo manual.' };
  }
  return { ok: true };
}

export function assertComparativeAllowed(sub: OrganizationSubscription): EntitlementCheck {
  if (!sub.quotas.allowComparativeAi) {
    return { ok: false, code: 'PLAN_FEATURE', message: 'La síntesis comparativa está disponible desde el plan Authority.' };
  }
  return { ok: true };
}
