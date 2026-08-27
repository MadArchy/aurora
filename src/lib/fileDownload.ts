/**
 * SPEC-010 T-010-405 — the single owner of the "save a file" browser effect.
 *
 * Domain-adjacent services used to build a document *and* drive an anchor click.
 * That mixed two concerns: what the document contains (which the service and the
 * domain own) and how a browser is made to save it (presentation). Extracting the
 * second means those services no longer touch the DOM, so they can be exercised
 * without one, and there is exactly one place where this effect exists.
 *
 * Authority is unchanged: this triggers no command, reads no persistence and
 * decides nothing. It receives bytes and a name.
 */

export interface DownloadableFile {
  filename: string;
  blob: Blob;
}

/** Builds a text file without touching the DOM, so callers stay testable. */
export function textFile(filename: string, contents: string, mimeType = 'text/plain;charset=utf-8'): DownloadableFile {
  return { filename, blob: new Blob([contents], { type: mimeType }) };
}

/** The only DOM-driven download in the codebase. */
export function downloadFile(file: DownloadableFile): void {
  const url = URL.createObjectURL(file.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
