import { z } from 'zod';
import type { PromptIdentity } from '../../../domain/ai/promptIdentity';

export const PromptIdentitySchema = z
  .object({
    promptId: z.string().min(1).max(128),
    promptVersion: z.string().min(1).max(32),
    promptHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  })
  .strict();

export function assertPromptIdentity(identity: PromptIdentity): PromptIdentity {
  return PromptIdentitySchema.parse(identity);
}
