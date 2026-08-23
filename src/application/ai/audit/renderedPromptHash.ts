import { createHash } from 'node:crypto';

/** Execution-specific rendered prompt fingerprint (SHA-256, 64 hex). */
export function computeRenderedPromptHash(systemMessage: string, userMessage: string): string {
  return createHash('sha256')
    .update(systemMessage)
    .update('\n---\n')
    .update(userMessage)
    .digest('hex');
}
