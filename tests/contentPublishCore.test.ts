import { describe, expect, it } from 'vitest';
import {
  availablePipelineActions,
  pipelineActionTarget,
  resolvePipelineActionSteps,
} from '../src/domain/contentPublishCore';

describe('contentPublishCore', () => {
  it('offers finalize after client approval', () => {
    expect(
      availablePipelineActions({ status: 'CLIENT_APPROVED', pipelineStatus: 'client_submitted' })
    ).toEqual(['finalize']);
  });

  it('walks manager_finalizing through QA to publish', () => {
    const content = { status: 'CLIENT_APPROVED' as const, pipelineStatus: 'manager_finalizing' as const };
    expect(availablePipelineActions(content)).toEqual(['qa_pass']);

    const qaSteps = resolvePipelineActionSteps(content, 'qa_pass');
    expect(qaSteps).toEqual(['qa_check']);

    const afterQa = { ...content, pipelineStatus: 'qa_check' as const };
    expect(availablePipelineActions(afterQa)).toEqual(['mark_ready']);
    expect(resolvePipelineActionSteps(afterQa, 'mark_ready')).toEqual(['ready_to_publish']);

    const ready = { ...content, pipelineStatus: 'ready_to_publish' as const };
    expect(availablePipelineActions(ready)).toEqual(['publish']);
    expect(pipelineActionTarget('publish')).toBe('published');
  });
});
