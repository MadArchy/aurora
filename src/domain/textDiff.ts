import { esc } from '../lib/escape';

export type DiffLine =
  | { type: 'equal'; text: string }
  | { type: 'add'; text: string }
  | { type: 'remove'; text: string };

export interface DiffSummary {
  added: number;
  removed: number;
  unchanged: number;
}

function buildLcsTable(before: string[], after: string[]): number[][] {
  const rows = before.length + 1;
  const cols = after.length + 1;
  const table = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      if (before[i - 1] === after[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  return table;
}

/** Diff línea a línea entre dos textos (ideal para artículos ~900 palabras). */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.replace(/\r\n/g, '\n').split('\n');
  const b = after.replace(/\r\n/g, '\n').split('\n');
  const table = buildLcsTable(a, b);
  const result: DiffLine[] = [];

  let i = a.length;
  let j = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: 'equal', text: a[i - 1] });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      result.unshift({ type: 'add', text: b[j - 1] });
      j -= 1;
    } else if (i > 0) {
      result.unshift({ type: 'remove', text: a[i - 1] });
      i -= 1;
    }
  }

  return result;
}

export function summarizeDiff(lines: DiffLine[]): DiffSummary {
  return {
    added: lines.filter((line) => line.type === 'add').length,
    removed: lines.filter((line) => line.type === 'remove').length,
    unchanged: lines.filter((line) => line.type === 'equal').length,
  };
}

export function renderDiffHtml(lines: DiffLine[]): string {
  if (!lines.length) {
    return '<p class="muted small">Sin cambios respecto al borrador original.</p>';
  }

  return lines
    .map((line) => {
      if (line.type === 'equal') {
        return `<div class="diff-line diff-equal">${esc(line.text || ' ')}</div>`;
      }
      if (line.type === 'add') {
        return `<div class="diff-line diff-add"><span class="diff-marker">+</span>${esc(line.text || ' ')}</div>`;
      }
      return `<div class="diff-line diff-remove"><span class="diff-marker">−</span>${esc(line.text || ' ')}</div>`;
    })
    .join('');
}

export function hasDiffChanges(lines: DiffLine[]): boolean {
  return lines.some((line) => line.type !== 'equal');
}
