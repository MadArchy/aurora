import type { Opportunity } from '../types';
import { isCleOpportunity, mapOpportunityLifecycle } from './opportunityLifecycle';

export { isCleOpportunity } from './opportunityLifecycle';

export function daysUntilDeadline(deadline: string, now = Date.now()): number {
  const ms = new Date(deadline).getTime() - now;
  return Math.ceil(ms / 86400000);
}

/** Oportunidad más relevante para el home del cliente (CLE / checklist pendiente). */
export function pickSpotlightOpportunity(
  opportunities: Opportunity[],
  now = Date.now()
): Opportunity | null {
  const open = opportunities.filter((opp) => {
    if (opp.status === 'ARCHIVED') return false;
    const stage = mapOpportunityLifecycle(opp);
    return stage === 'proposed' || stage === 'checklist' || stage === 'accepted';
  });
  if (!open.length) return null;

  const score = (opp: Opportunity) => {
    const stage = mapOpportunityLifecycle(opp);
    let s = 0;
    if (stage === 'checklist' || stage === 'accepted') s += 120;
    if (stage === 'proposed') s += 80;
    if (isCleOpportunity(opp)) s += 40;
    const days = daysUntilDeadline(opp.deadline, now);
    if (days >= 0 && days <= 7) s += 30 - days;
    return s;
  };

  return [...open].sort((a, b) => score(b) - score(a))[0];
}

export function opportunityNeedsReminder(opp: Opportunity, now = Date.now(), windowDays = 3): boolean {
  const stage = mapOpportunityLifecycle(opp);
  if (stage === 'submitted' || stage === 'declined') return false;
  const days = daysUntilDeadline(opp.deadline, now);
  return days >= 0 && days <= windowDays;
}
