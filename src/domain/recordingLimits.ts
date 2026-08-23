/**
 * SPEC-009 Phase 3 — recording upload limits (teleprompter WebM).
 *
 * Duration: max 10 minutes — product UX bound (video tasks commonly
 * estimatedMinutes 10–15; cap at 10m for Storage safety).
 *
 * Bitrate: MediaRecorder `videoBitsPerSecond` set explicitly in main.ts
 * (avoids unbounded Chrome defaults that made a safe numeric Storage cap
 * untestable against the emulator’s 130mb HTTP body limit).
 *
 * Size calculation (plan.md / inventory.md):
 *   1_000_000 bit/s × 600 s / 8 = 75_000_000 bytes
 *   + 20% safety margin → 90_000_000 bytes
 *   MAX+1 stays well under emulator body-parser 130mb (~136_314_880)
 *   even with multipart upload framing overhead.
 */
export const MAX_RECORDING_DURATION_MS = 10 * 60 * 1000;
export const RECORDING_VIDEO_BITS_PER_SECOND = 1_000_000;
export const RECORDING_MAX_BYTES = 90_000_000;
export const RECORDING_PREFERRED_MIME = 'video/webm';

/** True if contentType is video/webm or video/webm;codecs=… */
export function isAllowedRecordingContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  const normalized = contentType.trim().toLowerCase();
  return normalized === 'video/webm' || normalized.startsWith('video/webm;');
}

/** Prefer explicit WebM MIME for Storage metadata (never octet-stream). */
export function resolveRecordingContentType(blobType: string | null | undefined): string {
  if (isAllowedRecordingContentType(blobType)) return blobType!.trim();
  return RECORDING_PREFERRED_MIME;
}

export function assertRecordingUploadAllowed(blob: Blob): void {
  if (blob.size <= 0) {
    throw new Error('La grabación está vacía.');
  }
  if (blob.size > RECORDING_MAX_BYTES) {
    throw new Error(
      `La grabación supera el límite de ${Math.floor(RECORDING_MAX_BYTES / (1024 * 1024))} MB.`
    );
  }
  const type = resolveRecordingContentType(blob.type);
  if (!isAllowedRecordingContentType(type)) {
    throw new Error('Solo se permiten grabaciones video/webm.');
  }
}
