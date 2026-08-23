import type { z } from 'zod';
import { parseProviderJson } from './parseRawJson';
import type { ValidationStatus } from '../../../domain/ai/validationState';

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidateAiOutputResult<T> =
  | { status: 'VALID'; data: T }
  | { status: 'REJECTED'; reason: 'INVALID_JSON' | 'SCHEMA_MISMATCH'; issues: ValidationIssue[] };

function zodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/** RAW provider text → parse → Zod validate. Trust boundary enforcement. */
export function validateAiOutput<T>(params: {
  raw: string;
  schema: z.ZodType<T>;
}): ValidateAiOutputResult<T> {
  const parsed = parseProviderJson(params.raw);
  if (!parsed.ok) {
    return {
      status: 'REJECTED',
      reason: 'INVALID_JSON',
      issues: [{ path: '(parse)', message: parsed.reason }],
    };
  }

  const validated = params.schema.safeParse(parsed.value);
  if (!validated.success) {
    return {
      status: 'REJECTED',
      reason: 'SCHEMA_MISMATCH',
      issues: zodIssues(validated.error),
    };
  }

  return { status: 'VALID', data: validated.data };
}

export function validationStatusFromResult<T>(result: ValidateAiOutputResult<T>): ValidationStatus {
  return result.status === 'VALID' ? 'VALID' : 'REJECTED';
}
