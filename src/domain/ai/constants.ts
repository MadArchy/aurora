/** Bounded repair attempts for structured output (frozen SPEC-005). */
export const MAX_REPAIR_ATTEMPTS = 1 as const;

/** Secret-like substrings must not appear in safe error messages. */
export const SECRET_ERROR_PATTERNS = [
  /sk-[a-zA-Z0-9]{10,}/,
  /Bearer\s+[a-zA-Z0-9._-]+/i,
  /api[_-]?key\s*[:=]/i,
] as const;
