import { createHash } from 'node:crypto';
import type { AiOperation } from '../../../domain/ai/operations';
import type { PromptRegistryPort, ResolvedPrompt } from '../../../application/ai/ports/outbound/PromptRegistryPort';
import type { PromptIdentity } from '../../../domain/ai/promptIdentity';
import { PromptResolutionError } from '../../../application/ai/errors/providerPortErrors';
import { findPromptCatalogEntry } from './promptRegistryCatalog';

export class PromptRegistryAdapter implements PromptRegistryPort {
  resolve(params: {
    operation: AiOperation;
    identity: PromptIdentity;
    input: unknown;
  }): ResolvedPrompt {
    const entry = findPromptCatalogEntry(params.operation, params.identity);
    if (!entry) {
      throw new PromptResolutionError(
        `Unknown prompt ${params.identity.promptId}@${params.identity.promptVersion} for ${params.operation}`
      );
    }
    const userMessage = entry.renderUserMessage(params.input);
    const promptHash = computePromptHash(entry.systemMessage, userMessage);
    return {
      identity: { ...entry.identity, promptHash },
      systemMessage: entry.systemMessage,
      userMessage,
    };
  }
}

export function computePromptHash(systemMessage: string, userMessage: string): string {
  return createHash('sha256').update(systemMessage).update('\n---\n').update(userMessage).digest('hex');
}
