/**
 * Deterministic JSON extraction from provider text.
 * Parser success != schema validation success.
 */

const FENCE_PATTERN = /^```(?:json)?\s*([\s\S]*?)\s*```$/im;

export type JsonExtractResult =
  | { ok: true; jsonText: string }
  | { ok: false; reason: 'EMPTY' | 'NO_JSON' };

export function extractJsonTextFromProviderRaw(raw: string): JsonExtractResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'EMPTY' };

  const fenced = FENCE_PATTERN.exec(trimmed);
  if (fenced?.[1]) {
    return { ok: true, jsonText: fenced[1].trim() };
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) {
    return { ok: false, reason: 'NO_JSON' };
  }

  return { ok: true, jsonText: trimmed.slice(firstBrace, lastBrace + 1) };
}

export function parseProviderJson(
  raw: string
): { ok: true; value: unknown } | { ok: false; reason: 'EMPTY' | 'NO_JSON' | 'INVALID_JSON' } {
  const extracted = extractJsonTextFromProviderRaw(raw);
  if (!extracted.ok) return extracted;

  try {
    return { ok: true, value: JSON.parse(extracted.jsonText) as unknown };
  } catch {
    return { ok: false, reason: 'INVALID_JSON' };
  }
}
