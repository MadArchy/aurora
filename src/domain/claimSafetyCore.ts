import type { EvidenceVaultItem, PositioningThesis } from '../types';
import { matchedTerms, normalizeText, tokenize } from './textMatchCore';
import { normalizeThesis } from './thesisModelCore';

/**
 * Claim Safety Engine: última puerta antes de publicar. Detecta afirmaciones
 * verificables en el texto y las cruza contra el Evidence Vault y los límites
 * duros de la tesis. Un cargo inventado o un premio sin respaldo no debería
 * llegar a LinkedIn.
 */

export type ClaimVerdict = 'PASS' | 'REVIEW' | 'BLOCK';

export type ClaimKind =
  | 'CREDENTIAL'
  | 'AWARD'
  | 'METRIC'
  | 'SUPERLATIVE'
  | 'GUARANTEE'
  | 'HARD_BLOCK';

export interface ClaimFinding {
  kind: ClaimKind;
  severity: Exclude<ClaimVerdict, 'PASS'>;
  /** Fragmento exacto detectado en el texto. */
  claim: string;
  detail: string;
  action: string;
  supportingEvidenceIds: string[];
}

export interface ClaimSafetyReview {
  verdict: ClaimVerdict;
  findings: ClaimFinding[];
  /** Afirmaciones detectadas, respaldadas o no. */
  detectedClaims: number;
  /** Afirmaciones que sí encontraron respaldo en el vault. */
  supportedClaims: number;
  summary: string;
}

interface ClaimPattern {
  kind: ClaimKind;
  pattern: RegExp;
  /** Gravedad cuando la afirmación no encuentra respaldo. */
  unsupportedSeverity: Exclude<ClaimVerdict, 'PASS'>;
  detail: string;
  action: string;
  /** true si la afirmación es problemática incluso con evidencia. */
  alwaysFlag?: boolean;
  /** Filtro extra sobre la coincidencia, para subir la precisión. */
  validate?: (match: RegExpMatchArray) => boolean;
}

/** Solo cuenta como cargo si va acompañado de una entidad propia, no de "la firma". */
function namesAnEntity(match: RegExpMatchArray): boolean {
  const entity = match[1] || '';
  return entity.split(/\s+/).some((word) => /^[A-Z0-9]/.test(word));
}

const CLAIM_PATTERNS: ClaimPattern[] = [
  {
    kind: 'CREDENTIAL',
    pattern:
      /\b(?:fundador(?:a)?|cofundador(?:a)?|socio|socia|presidente|director(?:a)?|chair|founder|co-?founder|managing partner|partner|ceo|cto|cio|general counsel|of counsel)\b(?:\s+(?:de|del|en|of|at|for))?\s+([\w&.'-]+(?:\s+[\w&.'-]+){0,3})/gi,
    unsupportedSeverity: 'BLOCK',
    detail: 'Cargo o afiliación sin respaldo en el Evidence Vault.',
    action: 'Verifica el cargo y añádelo al vault, o elimínalo del texto.',
    validate: namesAnEntity,
  },
  {
    kind: 'AWARD',
    pattern:
      /\b(?:best lawyers|super lawyers|chambers|legal 500|top\s?\d+|rising star|premio|galardon|galardón|award|ranked|reconocido por|recognized by)\b[^.,;\n]{0,40}/gi,
    unsupportedSeverity: 'BLOCK',
    detail: 'Premio o ranking sin respaldo verificable.',
    action: 'Adjunta la evidencia del reconocimiento o quítalo.',
  },
  {
    kind: 'METRIC',
    pattern:
      /\b(?:\d+(?:[.,]\d+)?\s?%|\$\s?\d+(?:[.,]\d+)?\s?(?:k|m|mm|bn|millones|mil)?|(?:más de|mas de|over|more than)\s+\d+[^.,;\n]{0,25})/gi,
    unsupportedSeverity: 'REVIEW',
    detail: 'Cifra concreta que el lector va a tomar como dato verificado.',
    action: 'Cita la fuente de la cifra o sustitúyela por una formulación cualitativa.',
  },
  {
    kind: 'SUPERLATIVE',
    pattern:
      /\b(?:el (?:mejor|único|primero)|la (?:mejor|única|primera)|líder mundial|lider mundial|the (?:leading|best|only|first)|world[- ]leading|number one|#1)\b[^.,;\n]{0,30}/gi,
    unsupportedSeverity: 'REVIEW',
    detail: 'Superlativo que exige prueba comparativa.',
    action: 'Sustituye por una afirmación acotada y demostrable.',
  },
  {
    kind: 'GUARANTEE',
    pattern:
      /\b(?:garantizamos|garantizo|garantizado|te garantizo|aseguramos el resultado|resultado garantizado|we guarantee|guaranteed (?:results?|outcome))\b[^.,;\n]{0,30}/gi,
    unsupportedSeverity: 'BLOCK',
    detail: 'Promesa de resultado: riesgo deontológico independientemente de la evidencia.',
    action: 'Elimina la promesa de resultado.',
    alwaysFlag: true,
  },
];

/** Texto en el que buscar respaldo para una afirmación. */
function evidenceHaystack(item: EvidenceVaultItem): string {
  return [item.title, item.snippet, ...(item.supports || [])].filter(Boolean).join(' ');
}

/**
 * Evidencia que respalda la afirmación: comparte al menos dos tokens
 * significativos, o uno si es un nombre propio largo.
 */
function findSupport(claim: string, evidence: EvidenceVaultItem[], proofPoints: string[]): string[] {
  const claimTokens = tokenize(claim);
  if (!claimTokens.length) return [];
  const required = claimTokens.length === 1 ? 1 : 2;

  const supporting = evidence
    .filter((item) => {
      const haystack = evidenceHaystack(item);
      return matchedTerms(haystack, claimTokens).length >= Math.min(required, claimTokens.length);
    })
    .map((item) => item.id);

  if (supporting.length) return supporting;

  // Los proof points de la tesis también son respaldo declarado.
  const proofText = proofPoints.join(' ');
  return matchedTerms(proofText, claimTokens).length >= Math.min(required, claimTokens.length)
    ? ['thesis:proofPoints']
    : [];
}

function dedupeClaims(claims: string[]): string[] {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    const key = normalizeText(claim).trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Revisa un texto contra la tesis y su evidencia.
 * BLOCK impide publicar; REVIEW exige una decisión humana explícita.
 */
export function reviewClaims(
  text: string,
  thesis: PositioningThesis,
  evidence: EvidenceVaultItem[]
): ClaimSafetyReview {
  const findings: ClaimFinding[] = [];
  const relevantEvidence = evidence.filter(
    (item) => !item.associatedThesesIds?.length || item.associatedThesesIds.includes(thesis.id)
  );
  const verifiedEvidence = relevantEvidence.filter((item) => item.verified);
  const proofPoints = thesis.proofPoints || [];

  let detectedClaims = 0;
  let supportedClaims = 0;

  for (const config of CLAIM_PATTERNS) {
    const matches = dedupeClaims(
      Array.from(text.matchAll(config.pattern))
        .filter((match) => !config.validate || config.validate(match))
        .map((match) => match[0].trim())
    );

    for (const claim of matches) {
      detectedClaims += 1;
      const support = config.alwaysFlag ? [] : findSupport(claim, verifiedEvidence, proofPoints);

      if (support.length && !config.alwaysFlag) {
        supportedClaims += 1;
        continue;
      }

      findings.push({
        kind: config.kind,
        severity: config.unsupportedSeverity,
        claim,
        detail: config.detail,
        action: config.action,
        supportingEvidenceIds: support,
      });
    }
  }

  // Los límites duros de la tesis bloquean con independencia de la evidencia.
  const { limits } = normalizeThesis(thesis);
  for (const rule of matchedTerms(text, limits.hardBlocks)) {
    findings.push({
      kind: 'HARD_BLOCK',
      severity: 'BLOCK',
      claim: rule,
      detail: 'El texto entra en un límite duro declarado en la tesis.',
      action: 'Reescribe el pasaje: este límite no admite excepciones.',
      supportingEvidenceIds: [],
    });
  }

  const blocks = findings.filter((f) => f.severity === 'BLOCK').length;
  const reviews = findings.length - blocks;
  const verdict: ClaimVerdict = blocks ? 'BLOCK' : reviews ? 'REVIEW' : 'PASS';

  const summary =
    verdict === 'BLOCK'
      ? `${blocks} afirmación${blocks === 1 ? '' : 'es'} bloquea${blocks === 1 ? '' : 'n'} la publicación${reviews ? ` y ${reviews} necesita${reviews === 1 ? '' : 'n'} revisión` : ''}.`
      : verdict === 'REVIEW'
        ? `${reviews} afirmación${reviews === 1 ? '' : 'es'} necesita${reviews === 1 ? '' : 'n'} respaldo antes de publicar.`
        : detectedClaims
          ? `${supportedClaims} de ${detectedClaims} afirmaciones respaldadas por el vault.`
          : 'Sin afirmaciones verificables que revisar.';

  return { verdict, findings, detectedClaims, supportedClaims, summary };
}
