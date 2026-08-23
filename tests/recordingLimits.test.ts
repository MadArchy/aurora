import { describe, expect, it } from 'vitest';
import {
  RECORDING_MAX_BYTES,
  MAX_RECORDING_DURATION_MS,
  assertRecordingUploadAllowed,
  isAllowedRecordingContentType,
  resolveRecordingContentType,
} from '../src/domain/recordingLimits';

describe('recordingLimits (SPEC-009 Phase 3)', () => {
  it('documents numeric max bytes and duration', () => {
    expect(RECORDING_MAX_BYTES).toBe(90_000_000);
    expect(MAX_RECORDING_DURATION_MS).toBe(10 * 60 * 1000);
  });

  it('allows video/webm and codec variants', () => {
    expect(isAllowedRecordingContentType('video/webm')).toBe(true);
    expect(isAllowedRecordingContentType('video/webm;codecs=vp9,opus')).toBe(true);
    expect(isAllowedRecordingContentType('video/mp4')).toBe(false);
    expect(isAllowedRecordingContentType('application/octet-stream')).toBe(false);
  });

  it('resolves trustworthy contentType for Storage metadata', () => {
    expect(resolveRecordingContentType('video/webm;codecs=vp8')).toBe('video/webm;codecs=vp8');
    expect(resolveRecordingContentType('')).toBe('video/webm');
    expect(resolveRecordingContentType('image/png')).toBe('video/webm');
  });

  it('assertRecordingUploadAllowed rejects oversized blobs', () => {
    const big = { size: RECORDING_MAX_BYTES + 1, type: 'video/webm' } as Blob;
    expect(() => assertRecordingUploadAllowed(big)).toThrow(/límite/);
  });
});
