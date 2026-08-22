import { describe, expect, it } from 'vitest';
import {
  nextThesisEditorStep,
  prevThesisEditorStep,
  snapshotToThesis,
  validateThesisEditorStep,
  type ThesisEditorFormSnapshot,
} from '../src/domain/thesisEditorCore';
import { assertThesisReadyForReview } from '../src/domain/thesisModelCore';

function baseForm(overrides: Partial<ThesisEditorFormSnapshot> = {}): ThesisEditorFormSnapshot {
  return {
    title: 'AI Governance',
    identityCurrent: 'Known patent counsel',
    expertIdentity: 'Authority in AI governance',
    perceptionTarget: 'Trusted advisor for GCs',
    differentiator: 'Law × engineering',
    audiencesText: 'General Counsel | comercial | 90',
    targetAudience: 'General Counsel',
    territoriesText: 'AI Adoption | 100 | Adoption',
    domain: 'AI governance · IP',
    objective: 'Thought leadership and mandates',
    objectives: [{ id: 'obj_biz', kind: 'BUSINESS', weight: 100 }],
    voiceProfile: {
      authority: 80,
      technicalDepth: 75,
      academic: 60,
      executive: 80,
      accessible: 55,
      provocative: 25,
      commercial: 50,
      legalPrecision: 85,
      humor: 15,
      style: 'Preciso',
    },
    voiceAvoidText: 'hype',
    proofPoints: ['Registered Patent Attorney', 'Committee Chair'],
    hardBlocks: ['no prometer resultados'],
    softAvoid: ['consumer AI'],
    compliance: 'Secreto profesional',
    priority: 50,
    ...overrides,
  };
}

describe('thesisEditorCore navigation', () => {
  it('walks forward and backward through steps', () => {
    expect(nextThesisEditorStep('identity')).toBe('audiences');
    expect(nextThesisEditorStep('limits')).toBe('review');
    expect(nextThesisEditorStep('review')).toBeNull();
    expect(prevThesisEditorStep('review')).toBe('limits');
    expect(prevThesisEditorStep('identity')).toBeNull();
  });
});

describe('validateThesisEditorStep', () => {
  it('requires title and expert identity on step 1', () => {
    expect(validateThesisEditorStep('identity', baseForm({ title: '' })).ok).toBe(false);
    expect(validateThesisEditorStep('identity', baseForm()).ok).toBe(true);
  });

  it('requires audience on step 2', () => {
    expect(
      validateThesisEditorStep(
        'audiences',
        baseForm({ audiencesText: '', targetAudience: '' })
      ).ok
    ).toBe(false);
  });
});

describe('snapshotToThesis + readiness', () => {
  it('builds a thesis ready for review from a full snapshot', () => {
    const thesis = snapshotToThesis(baseForm(), {
      id: 'thesis_test',
      organizationId: 'org',
      clientId: 'client',
    });
    const readiness = assertThesisReadyForReview(thesis);
    expect(readiness.ready).toBe(true);
  });
});
