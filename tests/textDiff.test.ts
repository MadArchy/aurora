import { describe, expect, it } from 'vitest';
import { diffLines, hasDiffChanges, renderDiffHtml, summarizeDiff } from '../src/domain/textDiff';

describe('textDiff', () => {
  it('detecta líneas añadidas y eliminadas', () => {
    const before = 'Intro\nPárrafo original\nCierre';
    const after = 'Intro\nPárrafo editado por el cliente\nCierre';

    const lines = diffLines(before, after);
    expect(hasDiffChanges(lines)).toBe(true);
    expect(summarizeDiff(lines)).toMatchObject({ added: 1, removed: 1 });

    const html = renderDiffHtml(lines);
    expect(html).toContain('diff-add');
    expect(html).toContain('diff-remove');
    expect(html).toContain('Párrafo editado por el cliente');
  });

  it('no genera cambios cuando el texto es igual', () => {
    const text = 'Misma línea\nOtra línea';
    const lines = diffLines(text, text);
    expect(hasDiffChanges(lines)).toBe(false);
  });
});
