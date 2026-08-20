import { describe, expect, it } from 'vitest';
import type { PositioningThesis, Signal } from '../src/types';

function signal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'sig_1',
    organizationId: 'org_1',
    clientId: 'client_1',
    title: 'Nueva guía de gobernanza de inteligencia artificial',
    sourceType: 'RSS',
    sourceName: 'Legal Tech Review',
    contentSnippet: 'Resumen de gobernanza',
    fingerprint: 'fp1',
    detectedAt: new Date().toISOString(),
    status: 'NEW',
    targetDomain: 'Gobernanza IA legal',
    relevanceScore: 82,
    aiStatus: 'SCORED',
    managerDecision: 'UNREVIEWED',
    priorityBand: 'HIGH',
    ...overrides,
  };
}

describe('topicAgent', () => {
  it('returns ranked topics with rationale', async () => {
    const { rankDailyTopics } = await import('../src/domain/topicAgent');

    const thesis: PositioningThesis = {
      id: 'th_1',
      organizationId: 'org_1',
      clientId: 'client_1',
      title: 'Adopción IA en legal',
      expertIdentity: 'Líder en gobernanza de IA',
      targetAudience: 'GC y CIO',
      domain: 'Legal tech',
      objective: 'Autoridad en adopción responsable',
      proofPoints: ['Chair comité tecnología', 'Gobernanza inteligencia artificial'],
      voiceAndTone: 'Preciso',
      complianceRules: 'Sin asesoría',
      status: 'ACTIVE',
      clientApprovalStatus: 'APPROVED',
      createdAt: '2026-01-01',
      createdBy: 'admin',
      updatedAt: '2026-01-01',
      updatedBy: 'admin',
    };

    const items = rankDailyTopics('client_1', [
      signal({ id: 'a', title: 'Gobernanza de inteligencia artificial en firmas', relevanceScore: 88 }),
      signal({ id: 'b', title: 'Patentes de software', relevanceScore: 55, targetDomain: 'PI software' }),
    ], thesis, 3);

    expect(items.length).toBeGreaterThan(0);
    expect(items[0].rationale.length).toBeGreaterThan(10);
    expect(items[0].rank).toBe(1);
  });
});
