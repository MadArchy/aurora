/**
 * SPEC-010 T-010-504 — adversarial approval suite (A29, A30 · T-010-14, T-010-22).
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import {
  code,
  read,
  REACT_UI_FILES,
  rel,
  ROOT,
  UI_FILES,
} from './lib/reactMigrationPhase5Surface';

describe('T-010-504 — approval authority in React = 0', () => {
  it('APPROVAL AUTHORITY IN REACT = 0 — no approval mutators in React UI', () => {
    const forbidden = [
      /\bapproveRecommendation\s*\(/,
      /\bapplyRecommendation\s*\(/,
      /\bmarkRecommendationApproved\s*\(/,
      /\bsetApprovalStatus\s*\(/,
      /\bapproveBrief\s*\(/,
      /\bapprovePlan\s*\(/,
      /\bapproveExecution\s*\(/,
      /\bapproveDelivery\s*\(/,
      /\bapproveResult\s*\(/,
      /\bapproveThesis\s*\(/,
      /\bapproveSignal\s*\(/,
      /\bapproveTask\s*\(/,
      /\bapproveOutcome\s*\(/,
      /\bapproveLearning\s*\(/,
      /\bauthorizePublication\s*\(/,
      /\bmanufactureApproval\s*\(/,
      /\bforgeApproval\s*\(/,
      /\bspoofApproval\s*\(/,
    ];
    const offenders = REACT_UI_FILES.filter((file) =>
      forbidden.some((pattern) => pattern.test(code(file)))
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it('SILENT LEARNING = 0 — no learning advancement without Application boundary', () => {
    const forbidden = [
      /\badvanceLearning\s*\(/,
      /\bcompleteLearning\s*\(/,
      /\bmarkLearningComplete\s*\(/,
      /\bsetLearningStatus\s*\(/,
      /\badoptRecommendation\s*\(/,
      /\bapplyLearningOutcome\s*\(/,
      /\brecordLearningOutcome\s*\(/,
      /\bupdateLearningState\s*\(/,
      /\btransitionLearning\s*\(/,
      /\bcloseLearningLoop\s*\(/,
      /\bfinalizeLearning\s*\(/,
      /\bcommitLearning\s*\(/,
      /\bsubmitLearning\s*\(/,
      /\brejectLearning\s*\(/,
      /\bmarkRecommendationAdopted\s*\(/,
      /\bsetRecommendationStatus\s*\(/,
    ];
    const offenders = REACT_UI_FILES.filter((file) =>
      forbidden.some((pattern) => pattern.test(code(file)))
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it('SPEC-008 BYPASS = 0 — pages/hooks do not import learning approval modules', () => {
    const offenders = REACT_UI_FILES.filter((file) => {
      const r = rel(file);
      if (r === 'src/ui/commands/commandSeam.ts') return false;
      if (r.startsWith('src/ui/data/')) return false;
      if (!r.includes('/pages/') && !r.includes('/hooks/') && !r.includes('/modules/')) return false;
      return /from\s+['"][^'"]*(learningLoop|LearningApproval|approveRecommendation|approvalGate)/.test(
        code(file)
      );
    }).map(rel);
    expect(offenders).toEqual([]);
  });

  it('no client-side role spoof for approval surfaces', () => {
    const forbidden = [
      /\brole\s*[:=]\s*['"]MANAGER['"]/,
      /\brole\s*[:=]\s*['"]ADMIN['"]/,
      /\bcanApprove\s*[:=]\s*true/,
      /\bhasApprovalAuthority\s*[:=]\s*true/,
      /\bapprovalGranted\s*[:=]\s*true/,
    ];
    const offenders = UI_FILES.filter((file) =>
      forbidden.some((pattern) => pattern.test(code(file)))
    ).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('T-010-504 — command seam approval boundary', () => {
  it('command seam delegates approval to canonical consumers only', () => {
    const source = code(join(ROOT, 'src/ui/commands/commandSeam.ts'));
    expect(source).toMatch(/approveStrategicBrief/);
    expect(source).not.toMatch(/\bstatus\s*[:=]\s*['"]APPROVED['"]/);
    expect(source).not.toMatch(/\badvanceLearning\s*\(/);
    expect(source).toMatch(/from\s+['"][^'"]*strategicBriefConsumer['"]/);
  });
});
