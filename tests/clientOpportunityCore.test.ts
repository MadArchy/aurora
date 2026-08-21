import { describe, expect, it } from 'vitest';
import {
  daysUntilDeadline,
  isCleOpportunity,
  opportunityNeedsReminder,
  pickSpotlightOpportunity,
} from '../src/domain/clientOpportunityCore';
import type { Opportunity } from '../src/types';

function opp(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp_1',
    organizationId: 'org_1',
    clientId: 'client_1',
    thesisId: 'thesis_1',
    title: 'CLE: AI Governance',
    organization: 'State Bar',
    type: 'PANEL',
    deadline: '2026-08-22T23:59:00Z',
    description: 'Sesión CLE',
    fitRationale: 'Encaja',
    status: 'SENT_TO_CLIENT',
    lifecycleStage: 'proposed',
    createdAt: '2026-08-18T12:00:00Z',
    ...overrides,
  };
}

describe('clientOpportunityCore', () => {
  it('detecta oportunidades CLE', () => {
    expect(isCleOpportunity(opp())).toBe(true);
    expect(isCleOpportunity(opp({ title: 'Panel general', type: 'CONFERENCE_KEYNOTE' }))).toBe(false);
  });

  it('prioriza CLE próximo en spotlight', () => {
    const now = new Date('2026-08-20T12:00:00Z').getTime();
    const pick = pickSpotlightOpportunity(
      [
        opp({ id: 'cle', deadline: '2026-08-22T23:59:00Z' }),
        opp({
          id: 'later',
          title: 'Panel remoto',
          type: 'CONFERENCE_KEYNOTE',
          deadline: '2026-09-30T23:59:00Z',
        }),
      ],
      now
    );
    expect(pick?.id).toBe('cle');
  });

  it('prioriza checklist incompleto sobre propuesta', () => {
    const pick = pickSpotlightOpportunity([
      opp({ id: 'prop', lifecycleStage: 'proposed' }),
      opp({
        id: 'check',
        lifecycleStage: 'checklist',
        status: 'IN_PROGRESS',
        submissionChecklist: [{ id: 'c1', label: 'Bio', done: false }],
      }),
    ]);
    expect(pick?.id).toBe('check');
  });

  it('calcula reminder dentro de ventana de 3 días', () => {
    const now = new Date('2026-08-20T12:00:00Z').getTime();
    expect(opportunityNeedsReminder(opp(), now)).toBe(true);
    expect(daysUntilDeadline('2026-08-22T23:59:00Z', now)).toBe(3);
  });
});
