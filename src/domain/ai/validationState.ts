/** Gateway structured-output lifecycle (frozen SPEC-005). */
export const VALIDATION_STATUSES = [
  'RAW',
  'VALID',
  'REPAIR_REQUIRED',
  'REJECTED',
] as const;

export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export function isTerminalValidationStatus(status: ValidationStatus): boolean {
  return status === 'VALID' || status === 'REJECTED';
}
