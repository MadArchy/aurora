import type { AiOperation } from '../../../../domain/ai/operations';
import type { PromptIdentity } from '../../../../domain/ai/promptIdentity';
import type { SchemaIdentity } from '../../../../domain/ai/schemaIdentity';
import type { ValidationIssue } from '../../validation/validateOutput';

export interface ResolvedPrompt {
  identity: PromptIdentity;
  systemMessage: string;
  userMessage: string;
}

export interface RepairPromptRequest {
  operation: AiOperation;
  schemaIdentity: SchemaIdentity;
  validationIssues: ValidationIssue[];
  invalidOutput: string;
}

export interface PromptRegistryPort {
  resolve(params: {
    operation: AiOperation;
    identity: PromptIdentity;
    input: unknown;
  }): ResolvedPrompt;

  resolveRepair(params: RepairPromptRequest): ResolvedPrompt;
}
