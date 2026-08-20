import { createId } from '../lib/id';
import type { ProfileFact, ProfileFactSection } from '../types';

const DEGREE_PATTERN = /\b(J\.?D\.?|LL\.?M\.?|B\.?S\.?|M\.?S\.?|Ph\.?D\.?|MBA|Doctorado|Maestría|Licenciatura)\b/i;
const LINKEDIN_PATTERN = /linkedin\.com\/[^\s]+/i;
const URL_PATTERN = /https?:\/\/[^\s]+/i;

function guessSection(line: string): ProfileFactSection {
  if (DEGREE_PATTERN.test(line) || /universidad|university|school of law|college/i.test(line)) {
    return 'education';
  }
  if (/patent|ip |intellectual property|gobernanza|governance|adoption|readiness/i.test(line)) {
    return 'services';
  }
  if (/chair|committee|president|board|bar|3ital|institute/i.test(line)) {
    return 'institutions';
  }
  if (/published|book|libro|article|artículo|coautor|author/i.test(line)) {
    return 'publications';
  }
  if (LINKEDIN_PATTERN.test(line) || URL_PATTERN.test(line)) {
    return 'digital';
  }
  if (/member|attorney|engineer|cyber|officer|partner|socio/i.test(line)) {
    return 'career';
  }
  return 'identity';
}

/** Extrae facts candidatos desde texto plano de CV (txt/md pegado o leído). */
export function extractCandidateFactsFromCv(text: string): ProfileFact[] {
  const now = new Date().toISOString();
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^[\s•\-*]+/, '').trim())
    .filter((line) => line.length >= 12);

  const facts: ProfileFact[] = [];
  const seen = new Set<string>();

  for (const line of lines.slice(0, 80)) {
    const normalized = line.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const section = guessSection(line);
    let label = 'Dato del CV';
    if (section === 'education') label = 'Formación detectada';
    else if (section === 'career') label = 'Experiencia detectada';
    else if (section === 'institutions') label = 'Institución detectada';
    else if (section === 'publications') label = 'Publicación detectada';
    else if (section === 'digital') label = 'Enlace detectado';
    else if (section === 'services') label = 'Servicio detectado';

    facts.push({
      id: createId('fact'),
      section,
      label,
      value: line,
      status: 'candidate',
      source: 'cv',
      createdAt: now,
      updatedAt: now,
    });
  }

  const linkedin = text.match(LINKEDIN_PATTERN)?.[0];
  if (linkedin && !seen.has(linkedin.toLowerCase())) {
    facts.unshift({
      id: createId('fact'),
      section: 'digital',
      label: 'LinkedIn detectado',
      value: linkedin.startsWith('http') ? linkedin : `https://${linkedin}`,
      status: 'candidate',
      source: 'cv',
      createdAt: now,
      updatedAt: now,
    });
  }

  return facts.slice(0, 24);
}
