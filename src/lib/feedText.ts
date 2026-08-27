/**
 * Extracción de texto plano de contenido de feed.
 *
 * IMPLEMENTACIÓN DUPLICADA A PROPÓSITO: `server/sourceFeedCore.ts` y
 * `functions/src/lib/sourceFeedCore.ts` tienen la misma lógica porque corren en
 * otro target de build y `src/` no puede importar de ellos (tsconfig incluye
 * solo `src`). `tests/sourceFeedParser.test.ts` compara las dos copias sobre las
 * mismas entradas para que no se separen. Si cambias una, cambia las dos.
 *
 * Aquí se usa para sanear señales ya guardadas: el parser antiguo no quitaba el
 * marcado que venía escapado como entidades, así que el href completo quedó como
 * texto visible en los snippets ya persistidos.
 */

/** Entidades con nombre que aparecen en feeds reales; el resto se resuelve numéricamente. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, rawCode: string) => {
    const code = rawCode.toLowerCase();
    const named = NAMED_ENTITIES[code];
    if (named !== undefined) return named;
    const point = code.startsWith('#x')
      ? parseInt(code.slice(2), 16)
      : code.startsWith('#')
        ? Number(code.slice(1))
        : NaN;
    if (!Number.isInteger(point) || point < 1 || point > 0x10ffff) return match;
    return String.fromCodePoint(point);
  });
}

/**
 * Quita etiquetas exigiendo nombre de etiqueta tras `<`, para no destruir una
 * comparación en texto legítimo (`5 < 10 y 20 > 3`). El `>|$` final cubre la
 * etiqueta que queda a medias cuando el feed viene truncado.
 */
function stripTags(value: string): string {
  return value.replace(/<\/?[a-z!][^>]*(?:>|$)/gi, ' ');
}

/**
 * Texto plano de un nodo de feed.
 *
 * El marcado puede llegar crudo (`<a href=…>`) o escapado (`&lt;a href=…&gt;`,
 * como hace Google News). Quitar etiquetas sin decodificar primero deja el
 * marcado escapado como texto visible.
 */
export function toPlainText(raw: string): string {
  const decoded = decodeEntities(stripTags(raw));
  // Al decodificar afloran las etiquetas que venían escapadas.
  const clean = decoded.includes('<') ? stripTags(decoded) : decoded;
  return clean.replace(/\s+/g, ' ').trim();
}

/**
 * ¿Este texto guardado arrastra marcado del feed?
 *
 * Se usa para no reescribir señales que ya están limpias: la migración solo debe
 * tocar lo que el parser antiguo dejó sucio.
 */
export function hasFeedMarkup(value: string): boolean {
  return value !== toPlainText(value);
}
