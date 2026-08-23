import type { ModelConfiguration } from '../ports/outbound/ModelRegistryPort';

export function isModelConfigurationResolved(config: ModelConfiguration): boolean {
  return config.enabled && Boolean(config.providerModelId) && config.providerName !== 'unknown';
}
