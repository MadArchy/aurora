import type { Client, EvidenceVaultItem, PositioningThesis, Signal } from '../types';

export type ScientificVenue =
  | 'SSRN'
  | 'LAW_REVIEW'
  | 'BAR_JOURNAL'
  | 'ARXIV'
  | 'IEEE'
  | 'WHITEPAPER'
  | 'WORKING_PAPER';

export interface ScientificFocusSuggestion {
  id: string;
  title: string;
  why: string;
  roleAngle: string;
  venue: ScientificVenue;
  venueLabel: string;
  score: number;
  sourceSignalIds: string[];
  evidenceIds: string[];
}

export function venueLabel(venue: ScientificVenue): string {
  switch (venue) {
    case 'SSRN':
      return 'SSRN / working paper';
    case 'LAW_REVIEW':
      return 'Law review / nota jurídica';
    case 'BAR_JOURNAL':
      return 'Revista del colegio de abogados';
    case 'ARXIV':
      return 'arXiv / preprint';
    case 'IEEE':
      return 'IEEE / paper técnico';
    case 'WHITEPAPER':
      return 'White paper ejecutivo';
    default:
      return 'Working paper';
  }
}

/** Elige venue según profesión y dominio (no inventa afiliaciones). */
export function suggestVenueForRole(profession: string, domain: string): ScientificVenue {
  const blob = `${profession} ${domain}`.toLowerCase();
  if (/\b(attorney|abogad|counsel|legal|patent|ip |propiedad intelectual|bar)\b/.test(blob)) {
    if (/\b(patent|pi|ip|fto)\b/.test(blob)) return 'SSRN';
    return 'BAR_JOURNAL';
  }
  if (/\b(engineer|ingenier|ieee|cyber|ciber|electrical)\b/.test(blob)) return 'IEEE';
  if (/\b(professor|académ|research|investigad|phd|arxiv)\b/.test(blob)) return 'ARXIV';
  if (/\b(cto|cio|governance|gobernanza|nist|iso)\b/.test(blob)) return 'WHITEPAPER';
  return 'WORKING_PAPER';
}

function isValuableSignal(signal: Signal): boolean {
  if (signal.status === 'DISCARDED') return false;
  const score = signal.relevanceScore || 0;
  if (score >= 70) return true;
  if (signal.sourceType === 'ACADEMIC' || signal.sourceType === 'REGULATORY') return score >= 50;
  if (signal.priorityBand === 'CRITICAL' || signal.priorityBand === 'HIGH') return true;
  return false;
}

/**
 * Sugiere en qué centrar un artículo científico: señales de alto valor + evidencia + tesis.
 */
export function suggestScientificFoci(input: {
  client: Client;
  thesis?: PositioningThesis;
  signals: Signal[];
  evidence: EvidenceVaultItem[];
  limit?: number;
}): ScientificFocusSuggestion[] {
  const { client, thesis, signals, evidence } = input;
  const limit = input.limit ?? 5;
  const venue = suggestVenueForRole(client.profession || '', thesis?.domain || client.profession || '');
  const roleAngle = thesis?.expertIdentity || client.profession || 'profesional';

  const valuable = signals.filter(isValuableSignal).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  const scholarlyEvidence = evidence.filter((e) =>
    ['ACADEMIC_PAPER', 'CITATION', 'PATENT', 'PUBLICATION', 'CERTIFICATION'].includes(e.type)
  );

  const suggestions: ScientificFocusSuggestion[] = [];

  for (const signal of valuable.slice(0, 8)) {
    suggestions.push({
      id: `sci_${signal.id}`,
      title: signal.title.slice(0, 140),
      why: `Señal ${signal.sourceType.toLowerCase()} (score ${signal.relevanceScore ?? 'n/d'}) alineada al radar. Úsala como ancla empírica, no como opinión suelta.`,
      roleAngle,
      venue,
      venueLabel: venueLabel(venue),
      score: signal.relevanceScore || 55,
      sourceSignalIds: [signal.id],
      evidenceIds: [],
    });
  }

  if (thesis?.proofPoints.length) {
    suggestions.push({
      id: 'sci_proof_framework',
      title: `${thesis.proofPoints[0].slice(0, 90)} — marco aplicable`,
      why: 'Proof point de la tesis: conviene convertirlo en paper con método, límites y evidencia verificada.',
      roleAngle,
      venue,
      venueLabel: venueLabel(venue),
      score: 88,
      sourceSignalIds: [],
      evidenceIds: scholarlyEvidence.slice(0, 3).map((e) => e.id),
    });
  }

  for (const item of scholarlyEvidence.slice(0, 3)) {
    suggestions.push({
      id: `sci_ev_${item.id}`,
      title: `Extender: ${item.title.slice(0, 100)}`,
      why: `Evidencia ${item.verified ? 'verificada' : 'pendiente de verificar'} en el vault. El artículo debe citar solo lo confirmado.`,
      roleAngle,
      venue,
      venueLabel: venueLabel(venue),
      score: item.verified ? 82 : 60,
      sourceSignalIds: [],
      evidenceIds: [item.id],
    });
  }

  const ranked = [...suggestions].sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const unique: ScientificFocusSuggestion[] = [];
  for (const row of ranked) {
    const key = row.title.toLowerCase().slice(0, 48);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
    if (unique.length >= limit) break;
  }
  return unique;
}

export function academicDraftSkeleton(input: {
  title: string;
  roleAngle: string;
  venueLabel: string;
  why: string;
  proofPoints: string[];
  voice: string;
}): string {
  const proofs = input.proofPoints.slice(0, 4).map((p, i) => `${i + 1}. ${p}`).join('\n') || '1. (completar con evidencia verificada)';
  return `# ${input.title}

**Autoría (rol):** ${input.roleAngle}
**Formato sugerido:** ${input.venueLabel}
**Tono:** ${input.voice}

## Abstract
Borrador. Argumento central: ${input.why}

## 1. Problema y audiencia
Qué falla hoy en la práctica de ${input.roleAngle} y por qué importa ahora.

## 2. Marco
People + Tools + Rules / tesis del cliente. No ampliar claims más allá de evidencia.

## 3. Evidencia utilizable
${proofs}

## 4. Implicaciones prácticas
Qué debería hacer un GC, CTO o equipo legal esta semana.

## 5. Límites
Qué no afirma este artículo (evitar credenciales no documentadas).

## Referencias
Completar con fuentes del radar y del vault (URLs verificadas).
`;
}
