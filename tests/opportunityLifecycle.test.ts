import { describe, expect, it } from 'vitest';
import {
  checklistProgress,
  defaultOpportunityChecklist,
  isChecklistComplete,
  mapOpportunityLifecycle,
  OPPORTUNITY_LIFECYCLE_LABELS,
} from '../src/domain/opportunityLifecycle';
import type { Opportunity } from '../src/types';

function opp(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp_1',
    organizationId: 'org_1',
    clientId: 'client_1',
    thesisId: 'thesis_1',
    title: 'Panel IA legal',
    organization: 'State Bar',
    type: 'CONFERENCE_KEYNOTE',
    deadline: '2026-09-15T23:59:00Z',
    description: 'Panel sobre IA',
    fitRationale: 'Encaja con la tesis',
    status: 'SENT_TO_CLIENT',
    createdAt: '2026-08-18T12:00:00Z',
    ...overrides,
  };
}

describe('opportunityLifecycle', () => {
  it('maps legacy status to lifecycle stages', () => {
    expect(mapOpportunityLifecycle(opp({ status: 'SENT_TO_CLIENT' }))).toBe('proposed');
    expect(mapOpportunityLifecycle(opp({ status: 'REJECTED' }))).toBe('declined');
    expect(mapOpportunityLifecycle(opp({ status: 'COMPLETED' }))).toBe('submitted');
    expect(mapOpportunityLifecycle(opp({ status: 'IN_PROGRESS' }))).toBe('checklist');
  });

  it('maps ACCEPTED with checklist to checklist stage', () => {
    const items = defaultOpportunityChecklist('PANEL', { title: 'CLE test', type: 'PANEL' });
    expect(
      mapOpportunityLifecycle(
        opp({
          status: 'ACCEPTED',
          submissionChecklist: items,
        })
      )
    ).toBe('checklist');
  });

  it('prefers explicit lifecycleStage over status mapping', () => {
    expect(mapOpportunityLifecycle(opp({ lifecycleStage: 'submitted', status: 'SENT_TO_CLIENT' }))).toBe('submitted');
  });

  it('builds checklist by opportunity type', () => {
    const podcast = defaultOpportunityChecklist('PODCAST_GUEST');
    const journal = defaultOpportunityChecklist('JOURNAL_CALL');
    const cle = defaultOpportunityChecklist('PANEL', { title: 'CLE: AI Governance', type: 'PANEL' });
    expect(podcast.length).toBeGreaterThan(0);
    expect(journal.some((item) => item.label.toLowerCase().includes('convocatoria'))).toBe(true);
    expect(cle.some((item) => item.label.toLowerCase().includes('mcle'))).toBe(true);
  });

  it('tracks checklist progress and completion', () => {
    const items = defaultOpportunityChecklist('CONFERENCE_KEYNOTE').map((item, index) => ({
      ...item,
      done: index === 0,
    }));
    expect(checklistProgress(items)).toEqual({ done: 1, total: items.length });
    expect(isChecklistComplete(items)).toBe(false);
    expect(isChecklistComplete(items.map((item) => ({ ...item, done: true })))).toBe(true);
  });

  it('exposes Spanish labels for every stage', () => {
    for (const stage of ['proposed', 'accepted', 'declined', 'checklist', 'submitted'] as const) {
      expect(OPPORTUNITY_LIFECYCLE_LABELS[stage]).toBeTruthy();
    }
  });
});
