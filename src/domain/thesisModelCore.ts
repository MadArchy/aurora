import type {
  AudienceTier,
  PositioningThesis,
  ThesisAudience,
  ThesisLimits,
  ThesisObjective,
  ThesisObjectiveKind,
  ThesisTerritory,
  VoiceProfile,
} from '../types';

/**
 * Tesis con los bloques estratégicos siempre presentes. Las tesis antiguas solo
 * tienen texto libre, así que aquí se derivan para que el resto del sistema
 * pueda puntuar sin preguntarse si el manager ya migró los datos.
 */
export interface NormalizedThesis {
  audiences: ThesisAudience[];
  territories: ThesisTerritory[];
  objectives: ThesisObjective[];
  voiceProfile: VoiceProfile;
  limits: ThesisLimits;
  identityCurrent: string;
  identityTarget: string;
  perceptionTarget: string;
  /** true cuando algún bloque se dedujo del texto libre en lugar de estar declarado. */
  derived: boolean;
}

export const AUDIENCE_TIER_LABELS: Record<AudienceTier, string> = {
  COMMERCIAL: 'Comercial',
  INFLUENCE: 'Influencia',
  AMPLIFICATION: 'Amplificación',
};

export const OBJECTIVE_KIND_LABELS: Record<ThesisObjectiveKind, string> = {
  BUSINESS: 'Desarrollo de negocio',
  THOUGHT_LEADERSHIP: 'Autoridad intelectual',
  SPEAKING: 'Conferencias',
  INSTITUTIONAL: 'Influencia institucional',
  NETWORK: 'Red estratégica',
};

export const VOICE_DIMENSION_LABELS: Record<keyof Omit<VoiceProfile, 'style' | 'avoid'>, string> = {
  authority: 'Autoridad',
  technicalDepth: 'Profundidad técnica',
  academic: 'Académico',
  executive: 'Ejecutivo',
  accessible: 'Accesible',
  provocative: 'Provocador',
  commercial: 'Comercial',
  legalPrecision: 'Precisión legal',
  humor: 'Humor',
};

const OBJECTIVE_PATTERNS: Array<{ kind: ThesisObjectiveKind; match: RegExp }> = [
  { kind: 'BUSINESS', match: /negocio|cliente|practica|práctica|desarrollo|advisory|consultor|assessment|mandato|revenue/i },
  { kind: 'THOUGHT_LEADERSHIP', match: /liderazgo|autoridad|pensamiento|thought|publicaci|paper|articulo|artículo|libro/i },
  { kind: 'SPEAKING', match: /conferencia|ponencia|keynote|charla|speaking|congreso|panel|webinar/i },
  { kind: 'INSTITUTIONAL', match: /institucional|comite|comité|asociaci|colegio|bar\b|board|junta|gobernanza/i },
  { kind: 'NETWORK', match: /\bred\b|network|contacto|relacion|alianza|comunidad/i },
];

const VOICE_PATTERNS: Array<{ key: keyof Omit<VoiceProfile, 'style' | 'avoid'>; match: RegExp; value: number }> = [
  { key: 'authority', match: /autoritativ|authoritative|autoridad|referente/i, value: 90 },
  { key: 'technicalDepth', match: /tecnic|técnic|technical|ingenier|engineering/i, value: 80 },
  { key: 'academic', match: /academic|académic|investigaci|research|cientific|científic/i, value: 75 },
  { key: 'executive', match: /ejecutiv|executive|directiv|board|junta|c-level/i, value: 85 },
  { key: 'accessible', match: /accesible|accessible|claro|sencill|didactic|didáctic|divulgativ/i, value: 80 },
  { key: 'provocative', match: /provocativ|provocative|contrarian|disruptiv|incomod/i, value: 65 },
  { key: 'commercial', match: /comercial|commercial|venta|pitch|captacion|captación/i, value: 65 },
  { key: 'legalPrecision', match: /juridic|jurídic|legal|precis|deontolog|compliance|riguros/i, value: 90 },
  { key: 'humor', match: /humor|divertid|ligero|informal/i, value: 40 },
];

const ANTI_PATTERNS: Array<{ label: string; match: RegExp }> = [
  { label: 'hype', match: /\bhype\b|sensacionalismo|sensationalism/i },
  { label: 'clickbait', match: /clickbait|titular facil|titular fácil/i },
  { label: 'generalidades', match: /generic|generalidad|comentario generico|comentario genérico/i },
  { label: 'política', match: /politic|polític/i },
];

const VOICE_BASELINE: Omit<VoiceProfile, 'style' | 'avoid'> = {
  authority: 70,
  technicalDepth: 50,
  academic: 40,
  executive: 60,
  accessible: 55,
  provocative: 30,
  commercial: 40,
  legalPrecision: 50,
  humor: 10,
};

/** Separa listas escritas a mano: comas, puntos y coma, saltos de línea, viñetas y " y ". */
function splitList(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/[\n;,·•]| \+ | y (?=[a-záéíóúñ])/i)
    .map((part) => part.replace(/^[-–\s]+|[.\s]+$/g, '').trim())
    .filter((part) => part.length > 2);
}

function slug(value: string, index: number, prefix: string): string {
  const base = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return `${prefix}_${base || index + 1}`;
}

/** Reparte 100 puntos con la primera posición absorbiendo el resto de la división. */
function distributeWeights(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const weights = new Array(count).fill(base);
  weights[0] += 100 - base * count;
  return weights;
}

/** Pesos decrecientes: el primer elemento es el núcleo, los siguientes acompañan. */
function decayWeights(count: number): number[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => Math.max(30, 100 - i * 15));
}

function keywordsFrom(label: string): string[] {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3)
    .slice(0, 6);
}

function deriveAudiences(thesis: PositioningThesis): ThesisAudience[] {
  const primary = splitList(thesis.targetAudience);
  const secondary = splitList(thesis.secondaryAudience);
  const primaryWeights = decayWeights(primary.length);
  const secondaryWeights = decayWeights(secondary.length);

  const audiences: ThesisAudience[] = primary.map((name, index) => ({
    id: slug(name, index, 'aud'),
    name,
    tier: 'COMMERCIAL' as AudienceTier,
    weight: primaryWeights[index],
    keywords: keywordsFrom(name),
  }));

  secondary.forEach((name, index) => {
    const id = slug(name, primary.length + index, 'aud');
    if (audiences.some((a) => a.id === id)) return;
    audiences.push({
      id,
      name,
      tier: 'INFLUENCE',
      weight: Math.round(secondaryWeights[index] * 0.7),
      keywords: keywordsFrom(name),
    });
  });

  return audiences;
}

function deriveTerritories(thesis: PositioningThesis): ThesisTerritory[] {
  const names = splitList(thesis.domain);
  const weights = decayWeights(names.length);
  return names.map((name, index) => ({
    id: slug(name, index, 'terr'),
    name,
    weight: weights[index],
    keywords: keywordsFrom(name),
  }));
}

function deriveObjectives(thesis: PositioningThesis): ThesisObjective[] {
  const text = `${thesis.objective || ''} ${thesis.title || ''}`;
  const detected = OBJECTIVE_PATTERNS.filter(({ match }) => match.test(text)).map(({ kind }) => kind);
  const kinds: ThesisObjectiveKind[] = detected.length ? detected : ['BUSINESS'];
  const weights = distributeWeights(kinds.length);
  return kinds.map((kind, index) => ({
    id: `obj_${kind.toLowerCase()}`,
    kind,
    weight: weights[index],
  }));
}

function deriveVoiceProfile(thesis: PositioningThesis): VoiceProfile {
  const text = thesis.voiceAndTone || '';
  const dimensions = { ...VOICE_BASELINE };
  for (const { key, match, value } of VOICE_PATTERNS) {
    if (match.test(text)) dimensions[key] = value;
  }
  const avoid = ANTI_PATTERNS.filter(({ match }) => match.test(text)).map(({ label }) => label);
  return {
    ...dimensions,
    style: text.trim() || undefined,
    avoid: avoid.length ? avoid : undefined,
  };
}

/**
 * Los límites se escriben como prohibiciones ("no prometer resultados"), pero para
 * buscarlos en un texto hace falta el objeto prohibido ("resultados").
 */
const PROHIBITION_PREFIX =
  /^(?:no|nunca|jamas|jamás|evitar|evita|sin)\b\s*(?:se\s+)?(?:debe\s+)?(?:prometer|afirmar|garantizar|mencionar|revelar|divulgar|comentar|citar|usar|hablar\s+de)?\s*/i;

function stripProhibition(rule: string): string {
  const stripped = rule.replace(PROHIBITION_PREFIX, '').trim();
  return stripped.length > 3 ? stripped : rule.trim();
}

function deriveLimits(thesis: PositioningThesis): ThesisLimits {
  return {
    hardBlocks: splitList(thesis.complianceRules).map(stripProhibition),
    softAvoid: [],
  };
}

/**
 * Devuelve los bloques estratégicos de la tesis, derivándolos del texto libre
 * cuando el manager todavía no los ha estructurado.
 */
export function normalizeThesis(thesis: PositioningThesis): NormalizedThesis {
  const hasAudiences = Boolean(thesis.audiences?.length);
  const hasTerritories = Boolean(thesis.territories?.length);
  const hasObjectives = Boolean(thesis.objectives?.length);
  const hasVoice = Boolean(thesis.voiceProfile);
  const hasLimits = Boolean(thesis.limits?.hardBlocks.length || thesis.limits?.softAvoid.length);

  return {
    audiences: hasAudiences ? thesis.audiences! : deriveAudiences(thesis),
    territories: hasTerritories ? thesis.territories! : deriveTerritories(thesis),
    objectives: hasObjectives ? thesis.objectives! : deriveObjectives(thesis),
    voiceProfile: hasVoice ? thesis.voiceProfile! : deriveVoiceProfile(thesis),
    limits: hasLimits ? thesis.limits! : deriveLimits(thesis),
    identityCurrent: thesis.identityCurrent?.trim() || '',
    identityTarget: thesis.expertIdentity?.trim() || '',
    perceptionTarget: thesis.perceptionTarget?.trim() || '',
    derived: !hasAudiences || !hasTerritories || !hasObjectives || !hasVoice || !hasLimits,
  };
}

export interface CompletenessBlock {
  key: string;
  label: string;
  weight: number;
  done: boolean;
  hint: string;
}

export interface ThesisCompleteness {
  score: number;
  blocks: CompletenessBlock[];
  missing: CompletenessBlock[];
}

/**
 * Mide cuánto de la tesis está declarado explícitamente, no derivado.
 * Es la barra de progreso que empuja al manager a estructurar el posicionamiento.
 */
export function thesisCompleteness(thesis: PositioningThesis): ThesisCompleteness {
  const blocks: CompletenessBlock[] = [
    {
      key: 'identityCurrent',
      label: 'Identidad actual',
      weight: 10,
      done: Boolean(thesis.identityCurrent?.trim()),
      hint: 'Qué reconoce el mercado hoy, para poder medir la brecha.',
    },
    {
      key: 'perceptionTarget',
      label: 'Percepción objetivo',
      weight: 15,
      done: Boolean(thesis.perceptionTarget?.trim()),
      hint: 'Qué debe pensar la audiencia al oír su nombre.',
    },
    {
      key: 'audiences',
      label: 'Audiencias por nivel',
      weight: 15,
      done: Boolean(thesis.audiences?.length),
      hint: 'Separar quién compra, quién abre puertas y quién amplifica.',
    },
    {
      key: 'territories',
      label: 'Territorios ponderados',
      weight: 15,
      done: Boolean(thesis.territories?.length),
      hint: 'Mapa de temas con peso, no una lista plana.',
    },
    {
      key: 'objectives',
      label: 'Objetivos con peso',
      weight: 15,
      done: Boolean(thesis.objectives?.length),
      hint: 'Separar negocio, autoridad, conferencias e influencia.',
    },
    {
      key: 'voiceProfile',
      label: 'Perfil de voz',
      weight: 10,
      done: Boolean(thesis.voiceProfile),
      hint: 'Nueve ejes en lugar de un adjetivo.',
    },
    {
      key: 'limits',
      label: 'Límites duros y blandos',
      weight: 10,
      done: Boolean(thesis.limits?.hardBlocks.length),
      hint: 'Lo que bloquea publicación frente a lo que solo resta puntos.',
    },
    {
      key: 'proofPoints',
      label: 'Proof points',
      weight: 10,
      done: (thesis.proofPoints?.length || 0) >= 2,
      hint: 'Al menos dos respaldos verificables.',
    },
  ];

  const score = blocks.reduce((acc, block) => acc + (block.done ? block.weight : 0), 0);
  return { score, blocks, missing: blocks.filter((block) => !block.done) };
}

export interface WeightValidation {
  ok: boolean;
  total: number;
  message?: string;
}

/** Los objetivos reparten prioridad, así que deben sumar 100. */
export function validateWeights(items: Array<{ weight: number }>, expected = 100): WeightValidation {
  if (!items.length) return { ok: true, total: 0 };
  const total = items.reduce((acc, item) => acc + (Number.isFinite(item.weight) ? item.weight : 0), 0);
  if (total === expected) return { ok: true, total };
  return {
    ok: false,
    total,
    message: `Los pesos suman ${total} y deberían sumar ${expected}.`,
  };
}

/** Umbral mínimo de completitud para enviar la tesis al cliente (decisión piloto: 70, no 80). */
export const THESIS_READINESS_MIN_SCORE = 70;

export interface ThesisReadinessResult {
  ready: boolean;
  score: number;
  blockers: string[];
}

/**
 * Valida si una tesis está lista para solicitar revisión del cliente.
 * Puras reglas de negocio: no muta la tesis.
 */
export function assertThesisReadyForReview(thesis: PositioningThesis): ThesisReadinessResult {
  const completeness = thesisCompleteness(thesis);
  const normalized = normalizeThesis(thesis);
  const blockers: string[] = [];

  if (completeness.score < THESIS_READINESS_MIN_SCORE) {
    blockers.push(...completeness.missing.map((block) => block.label));
  }

  if (normalized.objectives.length) {
    const weights = validateWeights(normalized.objectives);
    if (!weights.ok) blockers.push('Objetivos deben sumar 100');
  }

  if ((thesis.proofPoints?.length || 0) < 2) {
    blockers.push('Al menos 2 proof points');
  }

  if (!normalized.limits.hardBlocks.length) {
    blockers.push('Al menos 1 límite duro');
  }

  if (!normalized.audiences.length) {
    blockers.push('Al menos 1 audiencia estructurada');
  }

  return {
    ready: blockers.length === 0,
    score: completeness.score,
    blockers: [...new Set(blockers)],
  };
}

const TIER_ALIASES: Array<{ tier: AudienceTier; match: RegExp }> = [
  { tier: 'AMPLIFICATION', match: /amplif/i },
  { tier: 'INFLUENCE', match: /influen/i },
  { tier: 'COMMERCIAL', match: /comerc|commerc/i },
];

function parseTier(raw: string | undefined): AudienceTier {
  if (!raw) return 'COMMERCIAL';
  return TIER_ALIASES.find(({ match }) => match.test(raw))?.tier || 'COMMERCIAL';
}

function parseWeight(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt((raw || '').replace(/[^0-9-]/g, ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, parsed));
}

/**
 * Lee el editor de audiencias, una por línea: `Nombre | nivel | peso`.
 * El nivel y el peso son opcionales.
 */
export function parseAudienceLines(text: string): ThesisAudience[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 1)
    .map((line, index): ThesisAudience | null => {
      const [name = '', tier, weight] = line.split('|').map((part) => part.trim());
      if (!name) return null;
      return {
        id: slug(name, index, 'aud'),
        name,
        tier: parseTier(tier),
        weight: parseWeight(weight, 70),
        keywords: keywordsFrom(name),
      };
    })
    .filter((item): item is ThesisAudience => item !== null);
}

/** Lee el editor de territorios, uno por línea: `Nombre | peso | pilar`. */
export function parseTerritoryLines(text: string): ThesisTerritory[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 1)
    .map((line, index): ThesisTerritory | null => {
      const [name = '', weight, pillar] = line.split('|').map((part) => part.trim());
      if (!name) return null;
      return {
        id: slug(name, index, 'terr'),
        name,
        weight: parseWeight(weight, 70),
        pillar: pillar || undefined,
        keywords: keywordsFrom(name),
      };
    })
    .filter((item): item is ThesisTerritory => item !== null);
}

export function formatAudienceLines(audiences: ThesisAudience[]): string {
  return audiences
    .map((a) => `${a.name} | ${AUDIENCE_TIER_LABELS[a.tier]} | ${a.weight}`)
    .join('\n');
}

export function formatTerritoryLines(territories: ThesisTerritory[]): string {
  return territories
    .map((t) => `${t.name} | ${t.weight}${t.pillar ? ` | ${t.pillar}` : ''}`)
    .join('\n');
}

/** Audiencias agrupadas por nivel, respetando el orden Comercial → Influencia → Amplificación. */
export function audiencesByTier(audiences: ThesisAudience[]): Array<{ tier: AudienceTier; items: ThesisAudience[] }> {
  const order: AudienceTier[] = ['COMMERCIAL', 'INFLUENCE', 'AMPLIFICATION'];
  return order
    .map((tier) => ({
      tier,
      items: audiences.filter((a) => a.tier === tier).sort((a, b) => b.weight - a.weight),
    }))
    .filter((group) => group.items.length > 0);
}
