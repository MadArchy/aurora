import { describe, expect, it } from 'vitest';
import {
  assertContentPipelineTransition,
  CONTENT_PIPELINE_TRANSITIONS,
  mapLegacyContentStatus,
  resolvePipelineStepsToTarget,
} from '../src/domain/contentPipeline';

describe('contentPipeline', () => {
  it('maps legacy CLIENT_REVIEW to sent_to_client', () => {
    expect(mapLegacyContentStatus('CLIENT_REVIEW')).toBe('sent_to_client');
  });

  it('allows client to submit from in_progress', () => {
    expect(CONTENT_PIPELINE_TRANSITIONS.client_in_progress).toContain('client_submitted');
  });

  it('blocks publish without admin', () => {
    expect(() =>
      assertContentPipelineTransition('ready_to_publish', 'published', 'CLIENT')
    ).toThrow('CONTENT_PUBLISH_REQUIRES_ADMIN');
  });

  it('allows admin to publish', () => {
    expect(() =>
      assertContentPipelineTransition('ready_to_publish', 'published', 'ADMIN')
    ).not.toThrow();
  });

  it('blocks invalid transition', () => {
    expect(() =>
      assertContentPipelineTransition('published', 'draft_ready', 'ADMIN')
    ).toThrow('CONTENT_INVALID_TRANSITION');
  });

  it('blocks system from sent_to_client', () => {
    expect(() =>
      assertContentPipelineTransition('manager_review', 'sent_to_client', 'SYSTEM')
    ).toThrow('CONTENT_HUMAN_GATE_REQUIRED');
  });

  it('resolves path from sent_to_client to client_submitted', () => {
    expect(resolvePipelineStepsToTarget('sent_to_client', 'client_submitted')).toEqual([
      'client_in_progress',
      'client_submitted',
    ]);
  });
});
