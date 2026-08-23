import type { ContentDraftGatewayInput } from '../../src/application/ai/schemas/contentDraftInput';

/** Minimal valid CONTENT_DRAFT gateway input for deterministic gateway tests. */
export function minimalContentDraftGatewayInput(
  overrides: Partial<ContentDraftGatewayInput> = {}
): ContentDraftGatewayInput {
  return {
    format: 'VIDEO_SCRIPT',
    topicTitle: 'AI governance topic',
    voiceHint: 'preciso',
    perceptionTarget: 'Strategic advisor',
    evidenceHint: 'ISO audit · EU AI Act advisory',
    hardBlocks: 'No medical claims',
    voiceAvoid: 'hype',
    expertIdentity: 'Dr. Analyst',
    ...overrides,
  };
}
