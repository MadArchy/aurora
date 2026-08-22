import { describe, expect, it } from 'vitest';
import {
  audiencesByTier,
  formatAudienceLines,
  formatTerritoryLines,
  normalizeThesis,
  parseAudienceLines,
  parseTerritoryLines,
  thesisCompleteness,
  validateWeights,
  assertThesisReadyForReview,
  THESIS_READINESS_MIN_SCORE,
} from '../src/domain/thesisModelCore';
import type { PositioningThesis } from '../src/types';

function makeThesis(overrides: Partial<PositioningThesis> = {}): PositioningThesis {
  return {
    id: 'thesis_juan_ip_ai',
    organizationId: 'org_aurora_01',
    clientId: 'client_juan_001',
    title: 'Propiedad Intelectual y Adopción Responsable de IA',
    expertIdentity: 'Intellectual Property and AI Adoption Attorney',
    targetAudience: 'General Counsel, IP Counsel, CTOs, líderes de innovación',
    secondaryAudience: 'State Bar committees, equipos de compliance',
    domain: 'Patentes e IP, adopción de IA, gobernanza, ciberseguridad aplicada',
    objective: 'Consolidar práctica IP + AI Adoption; liderazgo institucional; conferencias US/México',
    proofPoints: ['Registered Patent Attorney', 'Chair Emerging Technology Committee'],
    differentiator: 'Intersección LAW × ENGINEERING × IP × AI',
    voiceAndTone: 'Preciso, sobrio, sin hype de "experto en IA". Rigor jurídico y visión técnica.',
    complianceRules: 'Confidencialidad; no prometer resultados de patentes; no afirmar cargos no verificados',
    status: 'ACTIVE',
    clientApprovalStatus: 'APPROVED',
    createdAt: '2026-08-02T10:00:00Z',
    createdBy: 'user_admin_01',
    updatedAt: '2026-08-18T10:00:00Z',
    updatedBy: 'user_admin_01',
    ...overrides,
  };
}

describe('normalizeThesis', () => {
  it('derives audiences from legacy free text and tiers the secondary ones', () => {
    const normalized = normalizeThesis(makeThesis());

    const commercial = normalized.audiences.filter((a) => a.tier === 'COMMERCIAL');
    const influence = normalized.audiences.filter((a) => a.tier === 'INFLUENCE');

    expect(commercial.map((a) => a.name)).toContain('General Counsel');
    expect(commercial.map((a) => a.name)).toContain('IP Counsel');
    expect(influence.map((a) => a.name)).toContain('State Bar committees');
    // El primer nombre de la audiencia primaria pesa más que el resto.
    expect(commercial[0].weight).toBeGreaterThan(commercial[commercial.length - 1].weight);
  });

  it('derives weighted territories from the domain string', () => {
    const normalized = normalizeThesis(makeThesis());

    expect(normalized.territories.length).toBeGreaterThan(1);
    expect(normalized.territories[0].name).toBe('Patentes e IP');
    expect(normalized.territories[0].weight).toBe(100);
    expect(normalized.territories[0].keywords).toContain('patentes');
  });

  it('detects several objective kinds and distributes 100 points', () => {
    const normalized = normalizeThesis(makeThesis());
    const kinds = normalized.objectives.map((o) => o.kind);

    expect(kinds).toContain('BUSINESS');
    expect(kinds).toContain('THOUGHT_LEADERSHIP');
    expect(kinds).toContain('SPEAKING');
    expect(normalized.objectives.reduce((acc, o) => acc + o.weight, 0)).toBe(100);
  });

  it('falls back to a single business objective when nothing matches', () => {
    const normalized = normalizeThesis(makeThesis({ objective: 'xxxx', title: 'yyyy' }));

    expect(normalized.objectives).toHaveLength(1);
    expect(normalized.objectives[0].kind).toBe('BUSINESS');
    expect(normalized.objectives[0].weight).toBe(100);
  });

  it('builds a voice profile from the tone text and flags anti-patterns', () => {
    const normalized = normalizeThesis(makeThesis());

    expect(normalized.voiceProfile.legalPrecision).toBe(90);
    expect(normalized.voiceProfile.technicalDepth).toBe(80);
    expect(normalized.voiceProfile.avoid).toContain('hype');
  });

  it('splits compliance rules into hard blocks and strips the prohibition wording', () => {
    const normalized = normalizeThesis(makeThesis());

    expect(normalized.limits.hardBlocks).toContain('Confidencialidad');
    // "no prometer resultados de patentes" queda como el objeto buscable.
    expect(normalized.limits.hardBlocks).toContain('resultados de patentes');
    expect(normalized.limits.hardBlocks).toContain('cargos no verificados');
    expect(normalized.limits.softAvoid).toEqual([]);
  });

  it('reduces a prohibition to the searchable object', () => {
    const normalized = normalizeThesis(makeThesis({ complianceRules: 'sin hype; evitar clickbait' }));
    expect(normalized.limits.hardBlocks).toEqual(['hype', 'clickbait']);
  });

  it('keeps a rule intact when stripping would leave nothing useful', () => {
    const normalized = normalizeThesis(makeThesis({ complianceRules: 'no revelar' }));
    expect(normalized.limits.hardBlocks).toEqual(['no revelar']);
  });

  it('marks legacy theses as derived and structured ones as declared', () => {
    expect(normalizeThesis(makeThesis()).derived).toBe(true);

    const structured = makeThesis({
      audiences: [{ id: 'aud_gc', name: 'General Counsel', tier: 'COMMERCIAL', weight: 100, keywords: ['counsel'] }],
      territories: [{ id: 'terr_ip', name: 'Intellectual Property', weight: 100, keywords: ['patent'] }],
      objectives: [{ id: 'obj_business', kind: 'BUSINESS', weight: 100 }],
      voiceProfile: {
        authority: 90,
        technicalDepth: 75,
        academic: 55,
        executive: 90,
        accessible: 75,
        provocative: 45,
        commercial: 55,
        legalPrecision: 95,
        humor: 5,
      },
      limits: { hardBlocks: ['no prometer resultados'], softAvoid: ['consumer AI'] },
    });

    expect(normalizeThesis(structured).derived).toBe(false);
  });

  it('never overwrites explicitly declared blocks', () => {
    const structured = makeThesis({
      audiences: [{ id: 'aud_only', name: 'Solo esta', tier: 'AMPLIFICATION', weight: 42, keywords: [] }],
    });

    const normalized = normalizeThesis(structured);
    expect(normalized.audiences).toHaveLength(1);
    expect(normalized.audiences[0].name).toBe('Solo esta');
  });
});

describe('thesisCompleteness', () => {
  it('scores a legacy thesis only for the blocks it really has', () => {
    const result = thesisCompleteness(makeThesis());

    // Solo proof points están declarados; el resto es texto libre.
    expect(result.score).toBe(10);
    expect(result.missing.map((b) => b.key)).toContain('perceptionTarget');
    expect(result.missing.map((b) => b.key)).toContain('territories');
  });

  it('reaches 100 when every block is declared', () => {
    const full = makeThesis({
      identityCurrent: 'Member at Whitaker Chalk, Registered Patent Attorney',
      perceptionTarget: 'El abogado que entiende IA, patentes y riesgo empresarial',
      audiences: [{ id: 'aud_gc', name: 'General Counsel', tier: 'COMMERCIAL', weight: 100, keywords: [] }],
      territories: [{ id: 'terr_ip', name: 'Intellectual Property', weight: 100, keywords: [] }],
      objectives: [{ id: 'obj_business', kind: 'BUSINESS', weight: 100 }],
      voiceProfile: {
        authority: 90,
        technicalDepth: 75,
        academic: 55,
        executive: 90,
        accessible: 75,
        provocative: 45,
        commercial: 55,
        legalPrecision: 95,
        humor: 5,
      },
      limits: { hardBlocks: ['no prometer resultados'], softAvoid: [] },
    });

    const result = thesisCompleteness(full);
    expect(result.score).toBe(100);
    expect(result.missing).toHaveLength(0);
  });

  it('does not credit a single proof point', () => {
    const result = thesisCompleteness(makeThesis({ proofPoints: ['Solo uno'] }));
    expect(result.missing.map((b) => b.key)).toContain('proofPoints');
  });
});

describe('validateWeights', () => {
  it('accepts weights that add up to 100', () => {
    expect(validateWeights([{ weight: 40 }, { weight: 35 }, { weight: 25 }])).toEqual({ ok: true, total: 100 });
  });

  it('reports the actual total when it does not match', () => {
    const result = validateWeights([{ weight: 40 }, { weight: 40 }]);
    expect(result.ok).toBe(false);
    expect(result.total).toBe(80);
    expect(result.message).toContain('80');
  });

  it('treats an empty list as valid', () => {
    expect(validateWeights([])).toEqual({ ok: true, total: 0 });
  });
});

describe('assertThesisReadyForReview', () => {
  it('accepts a fully structured thesis', () => {
    const thesis = makeThesis({
      identityCurrent: 'Patent attorney known for IP litigation',
      perceptionTarget: 'Authority in AI governance for GCs',
      audiences: [{ id: 'aud_gc', name: 'General Counsel', tier: 'COMMERCIAL', weight: 100, keywords: ['gc'] }],
      territories: [{ id: 'ter_ip', name: 'Patentes e IP', weight: 100, pillar: 'IP', keywords: ['patentes'] }],
      objectives: [{ id: 'obj_biz', kind: 'BUSINESS', weight: 100 }],
      voiceProfile: {
        formal: 70,
        technical: 80,
        provocative: 20,
        narrative: 40,
        concise: 75,
        authoritative: 85,
        empathetic: 50,
        practical: 80,
        visionary: 45,
        style: 'Preciso',
        avoid: ['hype'],
      },
      limits: { hardBlocks: ['no prometer resultados de patentes'], softAvoid: ['consumer AI'] },
    });

    const result = assertThesisReadyForReview(thesis);
    expect(result.ready).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(THESIS_READINESS_MIN_SCORE);
  });

  it('blocks incomplete legacy theses', () => {
    const result = assertThesisReadyForReview(makeThesis());
    expect(result.ready).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });
});

describe('parseAudienceLines', () => {
  it('reads name, tier and weight from each line', () => {
    const audiences = parseAudienceLines(
      'General Counsel | comercial | 95\nState Bar | influencia | 70\nPeriodistas | amplificación | 40'
    );

    expect(audiences).toHaveLength(3);
    expect(audiences[0]).toMatchObject({ name: 'General Counsel', tier: 'COMMERCIAL', weight: 95 });
    expect(audiences[1].tier).toBe('INFLUENCE');
    expect(audiences[2].tier).toBe('AMPLIFICATION');
  });

  it('defaults tier and weight when the line only has a name', () => {
    const [audience] = parseAudienceLines('CTO');
    expect(audience).toMatchObject({ name: 'CTO', tier: 'COMMERCIAL', weight: 70 });
  });

  it('clamps out-of-range weights and skips blank lines', () => {
    const audiences = parseAudienceLines('IP Counsel | comercial | 250\n\n   \nCIO | comercial | -10');
    expect(audiences.map((a) => a.weight)).toEqual([100, 0]);
  });

  it('survives a format round trip', () => {
    const original = parseAudienceLines('General Counsel | comercial | 95\nState Bar | influencia | 70');
    const reparsed = parseAudienceLines(formatAudienceLines(original));
    expect(reparsed).toEqual(original);
  });
});

describe('parseTerritoryLines', () => {
  it('reads name, weight and optional pillar', () => {
    const territories = parseTerritoryLines('AI Adoption | 100 | Adopción\nPatent Strategy | 95\nConsumer AI | 10');

    expect(territories[0]).toMatchObject({ name: 'AI Adoption', weight: 100, pillar: 'Adopción' });
    expect(territories[1].pillar).toBeUndefined();
    expect(territories[2].weight).toBe(10);
  });

  it('survives a format round trip', () => {
    const original = parseTerritoryLines('AI Adoption | 100 | Adopción\nPatent Strategy | 95');
    expect(parseTerritoryLines(formatTerritoryLines(original))).toEqual(original);
  });
});

describe('audiencesByTier', () => {
  it('orders groups commercial, influence, amplification and drops empty tiers', () => {
    const groups = audiencesByTier([
      { id: 'a', name: 'Periodistas', tier: 'AMPLIFICATION', weight: 40, keywords: [] },
      { id: 'b', name: 'General Counsel', tier: 'COMMERCIAL', weight: 90, keywords: [] },
      { id: 'c', name: 'CTO', tier: 'COMMERCIAL', weight: 95, keywords: [] },
    ]);

    expect(groups.map((g) => g.tier)).toEqual(['COMMERCIAL', 'AMPLIFICATION']);
    expect(groups[0].items.map((i) => i.name)).toEqual(['CTO', 'General Counsel']);
  });
});
