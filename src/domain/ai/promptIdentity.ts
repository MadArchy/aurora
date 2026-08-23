/** Identifies prompt template + version for audit (not full prompt text). */
export interface PromptIdentity {
  promptId: string;
  promptVersion: string;
  promptHash?: string;
}
