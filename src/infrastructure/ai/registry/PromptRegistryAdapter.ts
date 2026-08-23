import type { AiOperation } from '../../../domain/ai/operations';
import type {
  PromptRegistryPort,
  RepairPromptRequest,
  ResolvedPrompt,
} from '../../../application/ai/ports/outbound/PromptRegistryPort';
import type { PromptIdentity } from '../../../domain/ai/promptIdentity';
import { PromptResolutionError } from '../../../application/ai/errors/providerPortErrors';
import { findPromptCatalogEntry } from './promptRegistryCatalog';
import { computePromptHash } from './promptHash';
import {
  REPAIR_PROMPT_IDENTITY,
  REPAIR_PROMPT_SYSTEM_MESSAGE,
  REPAIR_PROMPT_TEMPLATE_HASH,
  renderRepairUserMessage,
} from './repairPromptCatalog';

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

  resolveRepair(params: RepairPromptRequest): ResolvedPrompt {
    const userMessage = renderRepairUserMessage(params);
    return {
      identity: { ...REPAIR_PROMPT_IDENTITY, promptHash: REPAIR_PROMPT_TEMPLATE_HASH },
      systemMessage: REPAIR_PROMPT_SYSTEM_MESSAGE,
      userMessage,
    };
  }
}

