/** Default provider HTTP timeout — 60s (conservative for structured JSON operations). */
export const DEFAULT_PROVIDER_TIMEOUT_MS = 60_000;

export interface ProviderTimeoutPolicy {
  timeoutMs: number;
}

export function resolveProviderTimeoutPolicy(env: NodeJS.ProcessEnv = process.env): ProviderTimeoutPolicy {
  const raw = env.AI_PROVIDER_TIMEOUT_MS;
  if (raw === undefined || raw === '') {
    return { timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS };
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS };
  }
  return { timeoutMs: Math.min(parsed, 120_000) };
}
