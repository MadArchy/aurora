import { describe, expect, it } from 'vitest';
import {
  isPlayableRecordingRef,
  isRecordingRef,
  parseRecordingTaskId,
  RECORDING_REF_PREFIX,
} from '../src/services/recordings';
import { STORAGE_REF_PREFIX } from '../src/services/firestore/paths';

describe('recordings refs', () => {
  it('parsea taskId desde evidenceUrl indexeddb', () => {
    expect(parseRecordingTaskId(`${RECORDING_REF_PREFIX}task_abc`)).toBe('task_abc');
    expect(parseRecordingTaskId('https://example.com/v.mp4')).toBeNull();
    expect(isRecordingRef(`${RECORDING_REF_PREFIX}task_abc`)).toBe(true);
  });

  it('reconoce evidencias Storage y IndexedDB como reproducibles', () => {
    expect(isPlayableRecordingRef(`${RECORDING_REF_PREFIX}task_1`)).toBe(true);
    expect(
      isPlayableRecordingRef(`${STORAGE_REF_PREFIX}organizations/o/clients/c/recordings/task_1.webm`)
    ).toBe(true);
    expect(isPlayableRecordingRef('https://cdn.example/v.webm')).toBe(false);
  });
});
