import { describe, expect, it } from 'vitest';
import { resolveThesisContext } from '../src/domain/thesisContextCore';
import type { PositioningThesis } from '../src/types';

function thesis(id: string, title: string): PositioningThesis {
  return {
    id,
    organizationId: 'org',
    clientId: 'client',
    title,
    expertIdentity: 'x',
    targetAudience: 'y',
    domain: 'z',
    objective: 'o',
    proofPoints: [],
    voiceAndTone: 'v',
    complianceRules: '',
    status: 'ACTIVE',
    clientApprovalStatus: 'APPROVED',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'a',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'a',
  };
}

describe('resolveThesisContext', () => {
  const primary = thesis('t1', 'Primary');
  const secondary = thesis('t2', 'Secondary');
  const byId = new Map([
    [primary.id, primary],
    [secondary.id, secondary],
  ]);

  const helpers = {
    getPrimary: () => primary,
    getById: (_cid: string, id: string) => byId.get(id),
  };

  it('prefers the manager selection', () => {
    const result = resolveThesisContext({
      clientId: 'client',
      selectedThesisId: 't2',
      entityThesisId: 't1',
      ...helpers,
    });
    expect(result.source).toBe('selected');
    expect(result.thesis?.id).toBe('t2');
  });

  it('falls back to the entity thesis', () => {
    const result = resolveThesisContext({
      clientId: 'client',
      entityThesisId: 't2',
      ...helpers,
    });
    expect(result.source).toBe('entity');
    expect(result.thesis?.id).toBe('t2');
  });

  it('falls back to the primary thesis', () => {
    const result = resolveThesisContext({
      clientId: 'client',
      ...helpers,
    });
    expect(result.source).toBe('primary');
    expect(result.thesis?.id).toBe('t1');
  });
});
