const MAX_REPAIR_OUTPUT_CHARS = 2000;

/** Bounded representation of invalid provider output for repair prompts. */
export function sanitizeInvalidOutputForRepair(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= MAX_REPAIR_OUTPUT_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_REPAIR_OUTPUT_CHARS)}…[truncated]`;
}
