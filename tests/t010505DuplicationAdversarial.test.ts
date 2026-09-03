/**
 * SPEC-010 T-010-505 — duplication suite (A23, A28, A34 · T-010-17, 19…22).
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import {
  code,
  CONTROLLER_FILES,
  read,
  REACT_UI_FILES,
  rel,
  ROOT,
  PHASE4_EXTRACTED_CONTROLLERS,
} from './lib/reactMigrationPhase5Surface';

const PAGE_FILES = REACT_UI_FILES.filter((file) => rel(file).includes('/pages/'));

describe('T-010-505 — SCORING FORMULAS IN REACT = 0', () => {
  it('no React UI file recreates scoring logic', () => {
    const forbidden = [
      /computeStrategicScore/,
      /calculateStrategicScore/,
      /SCORING_FACTOR_WEIGHTS/,
      /scoreSignal\s*\(/,
      /computeOpportunityScore/,
      /function\s+\w*(score|Score)\w*\s*\(/,
      /weight\s*\*\s*/,
    ];
    const offenders = REACT_UI_FILES.filter((file) =>
      forbidden.some((pattern) => pattern.test(code(file)))
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it('WEIGHT ARITHMETIC IN REACT = 0 — no factor-weight arithmetic in controllers', () => {
    const offenders = CONTROLLER_FILES.filter((file) =>
      /SCORING_FACTOR_WEIGHTS|weight\s*\*\s*/.test(code(file))
    ).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('T-010-505 — ROUTING AUTHORITY IN REACT = 0', () => {
  it('no React UI file decides routing', () => {
    const forbidden = [/routeSignal\s*\(/, /overrideSignalThesis/, /\broutingState\s*:\s*['"]/];
    const offenders = REACT_UI_FILES.filter((file) =>
      forbidden.some((pattern) => pattern.test(code(file)))
    ).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('T-010-505 — LIFECYCLE AUTHORITY IN REACT = 0', () => {
  it('no React UI file assigns a canonical lifecycle status', () => {
    const assignment =
      /\bstatus\s*[:=]\s*['"](APPROVED|APPLIED|PUBLISHED|COMPLETED|VERIFIED|REJECTED|ACTIVE)['"]/;
    const offenders = REACT_UI_FILES.filter((file) => assignment.test(code(file))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('no extracted controller decides a lifecycle', () => {
    const banned = [
      /[^!=<>]=\s*['"](APPROVED|PUBLISHED|COMPLETED|APPLIED|VERIFIED)['"]/,
      /status\s*:\s*['"](APPROVED|PUBLISHED|COMPLETED|APPLIED|VERIFIED)['"]/,
    ];
    const offenders = PHASE4_EXTRACTED_CONTROLLERS.filter((file) =>
      banned.some((pattern) => pattern.test(code(file)))
    ).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('T-010-505 — OPPORTUNITY / LEARNING duplication = 0', () => {
  it('OPPORTUNITY ALGORITHM DUPLICATION = 0', () => {
    const forbidden = [
      /computeOpportunityScore/,
      /opportunityLifecycleCore/,
      /lifecycleStage\s*=/,
    ];
    const offenders = REACT_UI_FILES.filter((file) =>
      forbidden.some((pattern) => pattern.test(code(file)))
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it('LEARNING LOGIC DUPLICATION = 0', () => {
    const forbidden = [
      /feedbackScoringHints/,
      /recommendationLifecycleCore/,
      /approveRecommendation\s*\(/,
      /applyRecommendation\s*\(/,
    ];
    const offenders = REACT_UI_FILES.filter((file) =>
      forbidden.some((pattern) => pattern.test(code(file)))
    ).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('T-010-505 — T-010-20 display-only scoring may remain PARTIAL', () => {
  it('React pages may render score labels without owning scoring authority', () => {
    const displayOnly = PAGE_FILES.filter((file) =>
      /relevanceScore|priorityBand|scoreBreakdown/.test(code(file))
    ).map(rel);
    for (const page of displayOnly) {
      const source = code(join(ROOT, page));
      expect(source, page).not.toMatch(/calculateStrategicScore|computeStrategicScore|scoreSignal\s*\(/);
    }
  });
});

describe('T-010-505 — no business symbol duplication in hooks', () => {
  it('hooks do not import Application or domain scoring modules', () => {
    const hookFiles = REACT_UI_FILES.filter((file) => rel(file).includes('/hooks/'));
    const forbidden = [
      /from\s+['"][^'"]*application\//,
      /from\s+['"][^'"]*domain\/scoring/,
      /from\s+['"][^'"]*domain\/routing/,
      /from\s+['"][^'"]*services\/scoring/,
    ];
    const offenders = hookFiles.filter((file) =>
      forbidden.some((pattern) => pattern.test(code(file)))
    ).map(rel);
    expect(offenders).toEqual([]);
  });
});
