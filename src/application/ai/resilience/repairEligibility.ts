import type { ValidateAiOutputResult } from '../validation/validateOutput';

/** Validation failures eligible for one structured-output repair attempt. */
export function isValidationRepairEligible<T>(result: ValidateAiOutputResult<T>): boolean {
  return result.status === 'REJECTED' && (result.reason === 'INVALID_JSON' || result.reason === 'SCHEMA_MISMATCH');
}

export function validationFailureReason<T>(
  result: ValidateAiOutputResult<T>
): 'INVALID_JSON' | 'SCHEMA_MISMATCH' | undefined {
  if (result.status !== 'REJECTED') return undefined;
  return result.reason;
}
