import { createHash } from 'node:crypto';

export function computePromptHash(systemMessage: string, userMessage: string): string {
  return createHash('sha256').update(systemMessage).update('\n---\n').update(userMessage).digest('hex');
}
