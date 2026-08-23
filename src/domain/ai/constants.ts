/** Bounded repair attempts for structured output (frozen SPEC-005). */
export const MAX_REPAIR_ATTEMPTS = 1 as const;

/** Max provider retries after the initial attempt (Phase 3 — one optional retry). */
export const MAX_PROVIDER_RETRIES = 1 as const;

/**
 * Hard ceiling on provider HTTP calls per gateway execute request (single-provider ops).
 * (1 + MAX_PROVIDER_RETRIES) primary + (1 + MAX_PROVIDER_RETRIES) repair = 4.
 */
export const MAX_PROVIDER_CALLS_PER_EXECUTION = 4 as const;

/** Per-slice ceiling for ANALYSIS_COMPARATIVE — same math as single-provider. */
export const MAX_PROVIDER_CALLS_PER_PROVIDER_SLICE = MAX_PROVIDER_CALLS_PER_EXECUTION;

/** Explicit multi-provider comparative: OpenAI + Anthropic. */
export const MAX_COMPARATIVE_PROVIDER_SLICES = 2 as const;

/**
 * Comparative total provider-call ceiling.
 * Does NOT redefine MAX_PROVIDER_CALLS_PER_EXECUTION globally.
 */
export const MAX_COMPARATIVE_PROVIDER_CALLS =
  MAX_PROVIDER_CALLS_PER_PROVIDER_SLICE * MAX_COMPARATIVE_PROVIDER_SLICES;

/** Bounded deterministic backoff between provider retries (ms). */
export const PROVIDER_RETRY_BACKOFF_MS = 250 as const;

/** Default per-attempt provider HTTP timeout (ms) — frozen policy constant. */
export const DEFAULT_PROVIDER_TIMEOUT_MS = 60_000 as const;

/** Deterministic model role for structured-output repair (Phase 3). */
export const REPAIR_MODEL_ROLE = 'FAST_STRUCTURED' as const;

/**
 * aiComplete Cloud Function timeout (seconds) — code configuration, not yet deployed.
 * Must exceed MAX_GATEWAY_EXECUTION_MS + safety margin.
 */
export const AI_COMPLETE_FUNCTION_TIMEOUT_SECONDS = 300 as const;

/** Safety margin below function timeout (ms). */
export const GATEWAY_EXECUTION_SAFETY_MARGIN_MS = 30_000 as const;

/**
 * Wall-clock ceiling for one gateway execute (Application policy).
 * 270s = 300s function timeout − 30s safety margin.
 * Worst case: 4 × 60s provider + 500ms backoff ≈ 240.5s < 270s.
 */
export const MAX_GATEWAY_EXECUTION_MS =
  AI_COMPLETE_FUNCTION_TIMEOUT_SECONDS * 1000 - GATEWAY_EXECUTION_SAFETY_MARGIN_MS;

/** Secret-like substrings must not appear in safe error messages. */
export const SECRET_ERROR_PATTERNS = [
  /sk-[a-zA-Z0-9]{10,}/,
  /Bearer\s+[a-zA-Z0-9._-]+/i,
  /api[_-]?key\s*[:=]/i,
] as const;
