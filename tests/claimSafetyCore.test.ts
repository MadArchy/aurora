import { describe, expect, it } from 'vitest';
import { reviewClaims } from '../src/domain/claimSafetyCore';
import type { EvidenceVaultItem, PositioningThesis } from '../src/types';

function makeThesis(overrides: Partial<PositioningThesis> = {}): PositioningThesis {
  return {
    id: 'thesis_ip_ai',
    organizationId: 'org_aurora_01',
    clientId: 'client_juan_001',
    title: 'IP y adopción de IA',
    expertIdentity: 'IP and AI adoption attorney',
    targetAudience: 'General Counsel',
    domain: 'Patentes, adopción de IA',
    objective: 'Consolidar práctica',
    proofPoints: ['Registered Patent Attorney'],
    voiceAndTone: 'Preciso',
    complianceRules: '',
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
    title: 'Evidencia',
    type: 'CERTIFICATION',
    snippet: '',
    confidenceScore: 90,
    verified: true,
    associatedThesesIds: ['thesis_ip_ai'],
    createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

describe('reviewClaims verdict', () => {
  it('passes a text with no verifiable claims', () => {
    const review = reviewClaims(
      'La adopción de IA obliga a repensar los procesos internos de revisión.',
      makeThesis(),
      []
    );

    expect(review.verdict).toBe('PASS');
    expect(review.findings).toEqual([]);
    expect(review.summary).toContain('Sin afirmaciones');
  });

  it('blocks an unverified role claim', () => {
    const review = reviewClaims('Como Fundador de 3ITAL, he visto este patrón.', makeThesis(), []);

    expect(review.verdict).toBe('BLOCK');
    const finding = review.findings.find((f) => f.kind === 'CREDENTIAL');
    expect(finding?.claim).toContain('3ITAL');
    expect(finding?.action).toContain('Verifica el cargo');
  });

  it('accepts a role claim backed by verified evidence', () => {
    const review = reviewClaims('Como Fundador de 3ITAL, he visto este patrón.', makeThesis(), [
      makeEvidence({
        id: 'ev_3ital',
        title: 'Acta de constitución de 3ITAL',
        snippet: 'Consta como fundador de 3ITAL',
      }),
    ]);

    expect(review.verdict).toBe('PASS');
    expect(review.supportedClaims).toBe(1);
  });

  it('ignores unverified evidence as support', () => {
    const review = reviewClaims('Como Fundador de 3ITAL, he visto este patrón.', makeThesis(), [
      makeEvidence({ id: 'ev_3ital', title: 'Nota sobre 3ITAL fundador', verified: false }),
    ]);

    expect(review.verdict).toBe('BLOCK');
  });

  it('blocks an award claim with no backing', () => {
    const review = reviewClaims('Reconocido en Best Lawyers 2026 en propiedad intelectual.', makeThesis(), []);

    expect(review.verdict).toBe('BLOCK');
    expect(review.findings.some((f) => f.kind === 'AWARD')).toBe(true);
  });

  it('flags a bare metric for review instead of blocking', () => {
    const review = reviewClaims('El tiempo de revisión cayó un 40% tras el cambio.', makeThesis(), []);

    expect(review.verdict).toBe('REVIEW');
    expect(review.findings[0].kind).toBe('METRIC');
    expect(review.findings[0].severity).toBe('REVIEW');
  });

  it('flags superlatives for review', () => {
    const review = reviewClaims('Somos el líder mundial en estrategia de patentes.', makeThesis(), []);

    expect(review.verdict).toBe('REVIEW');
    expect(review.findings.some((f) => f.kind === 'SUPERLATIVE')).toBe(true);
  });

  it('blocks a guaranteed outcome even with evidence in the vault', () => {
    const review = reviewClaims(
      'Garantizamos la concesión de la patente en doce meses.',
      makeThesis(),
      [makeEvidence({ id: 'ev_any', title: 'Garantizamos concesión patente', snippet: 'histórico' })]
    );

    expect(review.verdict).toBe('BLOCK');
    const finding = review.findings.find((f) => f.kind === 'GUARANTEE');
    expect(finding?.supportingEvidenceIds).toEqual([]);
  });
});

describe('reviewClaims and thesis limits', () => {
  it('blocks text that crosses a declared hard limit', () => {
    const review = reviewClaims(
      'Podemos comentar el caso confidencial del cliente sin problema.',
      makeThesis({ limits: { hardBlocks: ['caso confidencial'], softAvoid: [] } }),
      []
    );

    const finding = review.findings.find((f) => f.kind === 'HARD_BLOCK');
    expect(review.verdict).toBe('BLOCK');
    expect(finding?.claim).toBe('caso confidencial');
    expect(finding?.detail).toContain('límite duro');
  });

  it('derives hard limits from legacy compliance text', () => {
    const review = reviewClaims(
      'Prometemos resultados garantizados de patentes a cualquier cliente.',
      makeThesis({ complianceRules: 'no prometer resultados garantizados de patentes' }),
      []
    );

    expect(review.verdict).toBe('BLOCK');
    expect(review.findings.some((f) => f.kind === 'HARD_BLOCK')).toBe(true);
  });

  it('does not block when the limit does not appear', () => {
    const review = reviewClaims(
      'La adopción de IA cambia la gestión del riesgo.',
      makeThesis({ limits: { hardBlocks: ['caso confidencial'], softAvoid: [] } }),
      []
    );

    expect(review.verdict).toBe('PASS');
  });
});

describe('reviewClaims evidence scoping', () => {
  it('ignores evidence assigned only to another thesis', () => {
    const review = reviewClaims('Como Fundador de 3ITAL, he visto este patrón.', makeThesis(), [
      makeEvidence({
        id: 'ev_other',
        title: 'Fundador de 3ITAL',
        associatedThesesIds: ['thesis_other'],
      }),
    ]);

    expect(review.verdict).toBe('BLOCK');
  });

  it('accepts unassigned evidence as support for any thesis', () => {
    const review = reviewClaims('Como Fundador de 3ITAL, he visto este patrón.', makeThesis(), [
      makeEvidence({ id: 'ev_loose', title: 'Fundador de 3ITAL', associatedThesesIds: [] }),
    ]);

    expect(review.verdict).toBe('PASS');
  });

  it('accepts a claim supported by the thesis proof points', () => {
    const review = reviewClaims(
      'Como Chair del Emerging Technology Committee, la guía cambia el análisis.',
      makeThesis({ proofPoints: ['Chair, Emerging Technology Committee'] }),
      []
    );

    expect(review.findings.some((f) => f.kind === 'CREDENTIAL')).toBe(false);
    expect(review.supportedClaims).toBe(1);
  });

  it('ignores a role mention with no named entity behind it', () => {
    const review = reviewClaims('Como socio de la firma, veo el patrón a diario.', makeThesis(), []);
    expect(review.findings.some((f) => f.kind === 'CREDENTIAL')).toBe(false);
  });

  it('reports each distinct claim only once', () => {
    const review = reviewClaims(
      'El equipo creció un 40%. Insisto: un 40% en doce meses.',
      makeThesis(),
      []
    );

    expect(review.findings.filter((f) => f.kind === 'METRIC')).toHaveLength(1);
  });

  it('summarizes how many claims were backed', () => {
    const review = reviewClaims(
      'Como Fundador de 3ITAL, la adopción creció.',
      makeThesis(),
      [makeEvidence({ id: 'ev_3ital', title: 'Fundador de 3ITAL' })]
    );

    expect(review.summary).toContain('1 de 1');
  });
});
