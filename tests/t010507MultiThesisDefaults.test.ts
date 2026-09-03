/**
 * SPEC-010 T-010-507 — multi-thesis and presentation-default suite (A20, A21 · T-010-15, 16).
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import {
  code,
  COMPATIBILITY_FACADE,
  read,
  REACT_UI_FILES,
  rel,
  ROOT,
} from './lib/reactMigrationPhase5Surface';

const PAGE_FILES = REACT_UI_FILES.filter((file) => rel(file).includes('/pages/'));

describe('T-010-507 — FIRST-THESIS AUTHORITY = 0', () => {
  it('no React UI file treats a first/primary thesis as authority', () => {
    const forbidden = [
      /getPrimaryThesis/,
      /primaryThesisId/,
      /\btheses\s*\[\s*0\s*\]/,
      /approvedBriefs\s*\[\s*0\s*\]/,
      /\.sort\([^)]*\)\s*\[\s*0\s*\]/,
    ];
    const offenders = REACT_UI_FILES.filter((file) =>
      forbidden.some((pattern) => pattern.test(code(file)))
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it('no page selects thesis/campaign/brief by position', () => {
    const banned = [
      /theses\s*\[\s*0\s*\]/,
      /campaigns\s*\[\s*0\s*\]/,
      /approvedBriefs\s*\[\s*0\s*\]/,
      /awaiting\s*\[\s*0\s*\]/,
      /primaryThesisId/,
      /getPrimaryThesis/,
    ];
    const offenders = PAGE_FILES.filter((file) =>
      banned.some((pattern) => pattern.test(code(file)))
    ).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('T-010-507 — FIRST-BRIEF AUTHORITY = 0', () => {
  it('brief selector starts unselected', () => {
    const modals = code(join(ROOT, 'src/ui/modules/pages/modals/ReactModals.tsx'));
    expect(modals).toMatch(/useState<string>\(''\)/);
  });

  it('compatibility facade never falls back to first brief', () => {
    const source = code(join(ROOT, COMPATIBILITY_FACADE));
    expect(source).not.toMatch(/approvedBriefs\s*\[\s*0\s*\]/);
  });
});

describe('T-010-507 — SILENT STRATEGIC WINNER = 0', () => {
  it('thesis editor requires explicit selection', () => {
    const editor = code(join(ROOT, 'src/ui/modules/pages/ReactThesisEditorPage.tsx'));
    expect(editor).toMatch(/useState<string \| null>\(null\)/);
  });

  it('wave-3 read facade takes explicit thesis id and never falls back', () => {
    const source = code(join(ROOT, COMPATIBILITY_FACADE));
    expect(source).toMatch(/readThesisDetail/);
    expect(source).toMatch(/UNRESOLVED_THESIS/);
    expect(source).not.toMatch(/theses\s*\[\s*0\s*\]/);
  });
});

describe('T-010-507 — presentation defaults are non-authoritative', () => {
  it('selectors default to empty/all, not a strategic winner', () => {
    const radar = code(join(ROOT, 'src/ui/modules/pages/ReactClientWorkspacePage.tsx'));
    expect(radar).not.toMatch(/primaryThesisId/);
    expect(radar).not.toMatch(/getPrimaryThesis/);
    expect(radar).not.toMatch(/\btheses\s*\[\s*0\s*\]/);
  });

  it('explicit selectedThesis is honored in compatibility reads', () => {
    const source = read(join(ROOT, COMPATIBILITY_FACADE));
    expect(source).toMatch(/selectedThesisId|thesisId/);
  });
});
