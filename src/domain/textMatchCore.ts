/**
 * Utilidades de comparación de texto compartidas por el motor de tesis.
 * Todo el matching estratégico pasa por aquí para que scoring, autoridad y
 * claim safety cuenten los mismos aciertos.
 */

export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Tokens significativos: descarta palabras de menos de 4 letras. */
export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 3);
}

/**
 * Solapamiento 0-1 de `needle` dentro de `haystack`. Devuelve 0.4 cuando no hay
 * nada que comparar, para no castigar a una tesis por tener el campo vacío.
 */
export function tokenOverlap(haystack: string, needle: string): number {
  const available = new Set(tokenize(haystack));
  const wanted = tokenize(needle);
  if (!wanted.length) return 0.4;
  const hits = wanted.filter((token) => available.has(token)).length;
  return Math.min(1, hits / Math.max(4, Math.min(wanted.length, 12)));
}

/** true si alguno de los términos aparece como token o como frase en el texto. */
export function hasAnyTerm(text: string, terms: string[]): boolean {
  return matchedTerms(text, terms).length > 0;
}

/** Términos de la lista que realmente aparecen en el texto. */
export function matchedTerms(text: string, terms: string[]): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const tokens = new Set(tokenize(text));

  return terms.filter((term) => {
    const normalizedTerm = normalizeText(term).trim();
    if (!normalizedTerm) return false;
    if (normalizedTerm.includes(' ')) return normalized.includes(normalizedTerm);
    return tokens.has(normalizedTerm) || normalized.includes(normalizedTerm);
  });
}
