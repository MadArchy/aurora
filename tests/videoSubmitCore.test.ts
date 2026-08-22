import { describe, expect, it } from 'vitest';
import {
  resolveVideoSubmitPipelineSteps,
  VIDEO_SUBMIT_PIPELINE_TARGET,
} from '../src/domain/videoSubmitCore';

describe('videoSubmitCore', () => {
  it('walks sent_to_client through client_submitted to manager_finalizing', () => {
    const steps = resolveVideoSubmitPipelineSteps({
      status: 'CLIENT_REVIEW',
      pipelineStatus: 'sent_to_client',
    });
    expect(steps).toEqual(['client_in_progress', 'client_submitted', VIDEO_SUBMIT_PIPELINE_TARGET]);
  });
});
