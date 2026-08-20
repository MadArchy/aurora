import { describe, expect, it } from 'vitest';
import { isRecordingRef, parseRecordingTaskId, RECORDING_REF_PREFIX } from '../src/services/recordings';

describe('recordings refs', () => {
  it('parsea taskId desde evidenceUrl indexeddb', () => {
    expect(parseRecordingTaskId(`${RECORDING_REF_PREFIX}task_abc`)).toBe('task_abc');
    expect(parseRecordingTaskId('https://example.com/v.mp4')).toBeNull();
    expect(isRecordingRef(`${RECORDING_REF_PREFIX}task_abc`)).toBe(true);
  });
});
