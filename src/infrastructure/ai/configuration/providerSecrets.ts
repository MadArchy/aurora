/** Server-only provider secret resolution. Never import from browser code. */
export interface ProviderSecretConfig {
  openAiApiKey: string | null;
  anthropicApiKey: string | null;
}

export function resolveProviderSecretsFromEnv(env: NodeJS.ProcessEnv = process.env): ProviderSecretConfig {
  const openAi = (env.OPENAI_API_KEY || '').trim();
  const anthropic = (env.ANTHROPIC_API_KEY || '').trim();
  return {
    openAiApiKey: openAi.length > 0 ? openAi : null,
    anthropicApiKey: anthropic.length > 0 ? anthropic : null,
  };
}

export function requireProviderSecret(
  secrets: ProviderSecretConfig,
  providerName: string
): string {
  const normalized = providerName.toLowerCase();
  if (normalized === 'openai') {
    if (!secrets.openAiApiKey) throw new ProviderSecretMissingError('openai', 'OPENAI_API_KEY');
    return secrets.openAiApiKey;
  }
  if (normalized === 'anthropic') {
    if (!secrets.anthropicApiKey) throw new ProviderSecretMissingError('anthropic', 'ANTHROPIC_API_KEY');
    return secrets.anthropicApiKey;
  }
  throw new ProviderSecretMissingError(normalized, 'UNKNOWN_PROVIDER');
}

export class ProviderSecretMissingError extends Error {
  readonly providerName: string;
  readonly envVar: string;

  constructor(providerName: string, envVar: string) {
    super(`Provider secret missing for ${providerName}`);
    this.name = 'ProviderSecretMissingError';
    this.providerName = providerName;
    this.envVar = envVar;
  }
}
