import { describe, expect, it } from 'vitest';
import {
  suggestScientificFoci,
  suggestVenueForRole,
  venueLabel,
} from '../src/domain/scientificFocusCore';
import type { Client, Signal } from '../src/types';

const client = {
  id: 'c1',
  profession: 'Registered Patent Attorney',
  displayName: 'Juan',
} as Client;

function sig(partial: Partial<Signal>): Signal {
  return {
    id: 's1',
    organizationId: 'o',
    clientId: 'c1',
    title: 'NIST AI RMF updates for legal teams',
    sourceType: 'REGULATORY',
    sourceName: 'NIST',
    contentSnippet: 'framework',
    status: 'NEW',
    aiStatus: 'SCORED',
    managerDecision: 'UNREVIEWED',
    detectedAt: '2026-08-01T00:00:00Z',
    fingerprint: 'fp',
    relevanceScore: 90,
    ...partial,
  };
}

describe('scientificFocusCore', () => {
  it('maps attorney+IP role to SSRN-style venue', () => {
    expect(suggestVenueForRole('Patent Attorney', 'AI and IP')).toBe('SSRN');
    expect(venueLabel('BAR_JOURNAL')).toMatch(/colegio/i);
  });

  it('ranks high-score regulatory signals as scientific foci', () => {
    const foci = suggestScientificFoci({
      client,
      thesis: {
        id: 't1',
        organizationId: 'o',
        clientId: 'c1',
        title: 'AI Adoption',
        expertIdentity: 'IP + AI adoption attorney',
        domain: 'AI IP',
        targetAudience: 'GCs',
        objective: 'Autoridad',
        differentiator: 'People + Tools + Rules',
        voiceAndTone: 'authoritative',
        complianceRules: 'No inventar credenciales',
        proofPoints: ['People + Tools + Rules'],
        status: 'ACTIVE',
        clientApprovalStatus: 'APPROVED',
        createdAt: '2026-08-01',
        updatedAt: '2026-08-01',
        createdBy: 'a',
        updatedBy: 'a',
      },
      signals: [sig({ id: 's1' }), sig({ id: 's2', relevanceScore: 20, title: 'noise', status: 'DISCARDED' })],
      evidence: [],
      limit: 5,
    });
    expect(foci.length).toBeGreaterThan(0);
    expect(foci.some((f) => f.sourceSignalIds.includes('s1') || f.id === 'sci_proof_framework')).toBe(true);
    expect(foci[0].score).toBeGreaterThanOrEqual(foci[foci.length - 1].score);
  });
});
