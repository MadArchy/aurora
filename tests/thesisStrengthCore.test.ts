import { describe, expect, it } from 'vitest';
import {
  computePositioningGap,
  computeThesisStrength,
  evidenceAuthority,
} from '../src/domain/thesisStrengthCore';
import type { EvidenceVaultItem, PositioningThesis } from '../src/types';

function makeThesis(overrides: Partial<PositioningThesis> = {}): PositioningThesis {
  return {
    id: 'thesis_ip_ai',
    organizationId: 'org_aurora_01',
    clientId: 'client_juan_001',
    title: 'IP y adopción de IA',
    expertIdentity: 'IP and AI adoption attorney',
    targetAudience: 'General Counsel, CTOs',
    domain: 'Patentes, adopción de IA',
    objective: 'Consolidar práctica IP + AI',
    proofPoints: ['Registered Patent Attorney'],
    voiceAndTone: 'Preciso y riguroso',
    complianceRules: 'No prometer resultados',
    status: 'ACTIVE',
    clientApprovalStatus: 'APPROVED',
    createdAt: '2026-08-01T00:00:00Z',
    createdBy: 'system',
    updatedAt: '2026-08-01T00:00:00Z',
    updatedBy: 'system',
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<EvidenceVaultItem> = {}): EvidenceVaultItem {
  return {
    id: 'ev_1',
    organizationId: 'org_aurora_01',
    clientId: 'client_juan_001',
    title: 'Patente concedida en clasificación automática',
    type: 'PATENT',
    snippet: 'Patente US sobre patentes y clasificación',
    confidenceScore: 90,
    verified: true,
    associatedThesesIds: ['thesis_ip_ai'],
    createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

describe('evidenceAuthority', () => {
  it('prefers the declared weight over the type default', () => {
    expect(evidenceAuthority(makeEvidence({ authorityWeight: 42 }))).toBe(42);
  });

  it('falls back to the type default when nothing is declared', () => {
    expect(evidenceAuthority(makeEvidence())).toBe(95);
    expect(evidenceAuthority(makeEvidence({ type: 'MEDIA' }))).toBe(50);
  });

  it('clamps declared weights into 0-100', () => {
    expect(evidenceAuthority(makeEvidence({ authorityWeight: 400 }))).toBe(100);
    expect(evidenceAuthority(makeEvidence({ authorityWeight: -20 }))).toBe(0);
  });
});

describe('computeThesisStrength', () => {
  it('returns a weak score and counts unassigned evidence when nothing is linked', () => {
    const strength = computeThesisStrength(makeThesis(), [
      makeEvidence({ id: 'ev_loose', associatedThesesIds: [] }),
      makeEvidence({ id: 'ev_other', associatedThesesIds: ['thesis_other'] }),
    ]);

    expect(strength.authorityScore).toBe(0);
    expect(strength.band).toBe('WEAK');
    expect(strength.evidenceCount).toBe(0);
    expect(strength.unassignedCount).toBe(1);
    expect(strength.summary).toContain('1 pieza');
  });

  it('rewards volume, verification, diversity and territory coverage', () => {
    const strength = computeThesisStrength(makeThesis(), [
      makeEvidence({ id: 'ev_1', type: 'PATENT', title: 'Patentes concedidas' }),
      makeEvidence({ id: 'ev_2', type: 'ACADEMIC_PAPER', title: 'Paper sobre adopción de IA' }),
      makeEvidence({ id: 'ev_3', type: 'CONFERENCE', title: 'Keynote sobre patentes' }),
      makeEvidence({ id: 'ev_4', type: 'AWARD', title: 'Premio en adopción de IA' }),
      makeEvidence({ id: 'ev_5', type: 'CASE_STUDY', title: 'Caso de patentes' }),
      makeEvidence({ id: 'ev_6', type: 'PUBLICATION', title: 'Artículo de adopción de IA' }),
    ]);

    expect(strength.evidenceCount).toBe(6);
    expect(strength.authorityScore).toBeGreaterThan(80);
    expect(strength.band).toBe('DOMINANT');
    expect(strength.components.find((c) => c.key === 'volume')?.score).toBe(100);
    expect(strength.components.find((c) => c.key === 'coverage')?.score).toBe(100);
  });

  it('penalizes unverified evidence', () => {
    const base = [
      makeEvidence({ id: 'ev_1' }),
      makeEvidence({ id: 'ev_2', title: 'Adopción de IA en empresa' }),
    ];
    const verified = computeThesisStrength(makeThesis(), base);
    const unverified = computeThesisStrength(
      makeThesis(),
      base.map((item) => ({ ...item, verified: false }))
    );

    expect(unverified.authorityScore).toBeLessThan(verified.authorityScore);
    expect(unverified.components.find((c) => c.key === 'verification')?.score).toBe(0);
  });

  it('uses supports text to match territories', () => {
    const strength = computeThesisStrength(makeThesis(), [
      makeEvidence({
        id: 'ev_supports',
        title: 'Reconocimiento profesional',
        snippet: 'Sin palabras clave en el snippet',
        supports: ['Autoridad en adopción de IA empresarial'],
      }),
    ]);

    expect(strength.components.find((c) => c.key === 'coverage')?.score).toBeGreaterThan(0);
  });

  it('orders top evidence by authority', () => {
    const strength = computeThesisStrength(makeThesis(), [
      makeEvidence({ id: 'ev_media', type: 'MEDIA' }),
      makeEvidence({ id: 'ev_patent', type: 'PATENT' }),
    ]);

    expect(strength.topEvidence.map((e) => e.id)).toEqual(['ev_patent', 'ev_media']);
  });
});

describe('computePositioningGap', () => {
  const thesis = makeThesis({
    territories: [
      { id: 'terr_patent', name: 'Patent Strategy', weight: 95, keywords: ['patent', 'patentes'] },
      { id: 'terr_ai', name: 'AI Adoption', weight: 90, keywords: ['adopcion', 'adoption'] },
    ],
    audiences: [
      { id: 'aud_gc', name: 'General Counsel', tier: 'COMMERCIAL', weight: 95, keywords: ['counsel'] },
    ],
    perceptionTarget: 'El abogado que traduce patentes en decisiones empresariales',
  });

  it('flags published content with no supporting evidence as critical', () => {
    const gap = computePositioningGap(
      thesis,
      [],
      [{ title: 'Cómo la estrategia de patentes cambia el board', body: 'patentes y general counsel' }]
    );

    const patentGap = gap.gaps.find((g) => g.key === 'territory:terr_patent');
    expect(patentGap?.severity).toBe('HIGH');
    expect(patentGap?.detail).toContain('sin evidencia');
  });

  it('flags evidence with no published content as a visibility gap', () => {
    const gap = computePositioningGap(
      thesis,
      [makeEvidence({ id: 'ev_patent', title: 'Patente concedida', supports: ['patentes'] })],
      []
    );

    const patentGap = gap.gaps.find((g) => g.key === 'territory:terr_patent');
    expect(patentGap?.severity).toBe('MEDIUM');
    expect(patentGap?.action).toContain('Producir contenido');
  });

  it('calls out territories with neither evidence nor content', () => {
    const gap = computePositioningGap(thesis, [], []);

    const aiGap = gap.gaps.find((g) => g.key === 'territory:terr_ai');
    expect(aiGap?.severity).toBe('HIGH');
    expect(aiGap?.detail).toContain('declaración vacía');
  });

  it('does not report a territory backed by both evidence and content', () => {
    const gap = computePositioningGap(
      thesis,
      [makeEvidence({ id: 'ev_ai', title: 'Programa de adopcion de IA', supports: ['adopcion'] })],
      [{ title: 'Guía de adopcion de IA para general counsel' }]
    );

    expect(gap.gaps.find((g) => g.key === 'territory:terr_ai')).toBeUndefined();
    expect(gap.gaps.find((g) => g.key === 'audience:aud_gc')).toBeUndefined();
  });

  it('reports the perception gap when nothing points at it', () => {
    const gap = computePositioningGap(thesis, [], []);
    expect(gap.gaps.find((g) => g.kind === 'PERCEPTION')?.severity).toBe('HIGH');
  });

  it('sorts gaps by severity and summarizes coverage', () => {
    const gap = computePositioningGap(
      thesis,
      [makeEvidence({ id: 'ev_patent', title: 'Patente', supports: ['patentes'] })],
      []
    );

    expect(gap.gaps[0].severity).toBe('HIGH');
    expect(gap.score).toBeLessThan(100);
    expect(gap.summary).toContain('%');
  });

  it('returns nothing to measure for an empty thesis', () => {
    const empty = makeThesis({
      targetAudience: '',
      domain: '',
      territories: [],
      audiences: [],
    });

    // Sin territorios ni audiencias declarados y sin texto libre del que derivar.
    const gap = computePositioningGap(empty, [], []);
    expect(gap.score).toBe(0);
    expect(gap.summary).toContain('nada que medir');
  });
});
