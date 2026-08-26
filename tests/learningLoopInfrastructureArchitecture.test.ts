/**
 * SPEC-008 Phase 3 — Infrastructure architecture purity (T-008-308).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const INFRA_LRN = join(ROOT, 'src/infrastructure/learningLoop');
const APP_LRN = join(ROOT, 'src/application/learningLoop');
const DOMAIN_LRN_FILES = [
  'domain/learningLoopErrors.ts',
  'domain/learningTenantCore.ts',
  'domain/learningThesisScopeCore.ts',
  'domain/learningObservationCore.ts',
  'domain/learningEvidenceCore.ts',
  'domain/strategicRecommendationCore.ts',
  'domain/recommendationLifecycleCore.ts',
  'domain/recommendationDecisionCore.ts',
  'domain/learningMaterialityCore.ts',
  'domain/learningExplainabilityCore.ts',
  'domain/learningAuthorityCore.ts',
];

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (entry.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

function extractImportSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /import\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g,
    /export\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

const FORBIDDEN_PACKAGE = [
  /^firebase(\/|$)/,
  /^firebase-admin(\/|$)/,
  /^openai(\/|$)/,
  /^@anthropic-ai\//,
  /^react(\/|$)/,
  /^vite(\/|$)/,
  /^express(\/|$)/,
  /^axios(\/|$)/,
];

describe('SPEC-008 Phase 3 — learning loop infrastructure architecture (T-008-308)', () => {
  it('Domain does not import Infrastructure', () => {
    for (const rel of DOMAIN_LRN_FILES) {
      const content = readFileSync(join(ROOT, 'src', rel), 'utf8');
      expect(content).not.toMatch(/infrastructure\/learningLoop|\/infrastructure\//);
    }
  });

  it('Application does not import Infrastructure', () => {
    for (const file of collectTsFiles(APP_LRN)) {
      const content = readFileSync(file, 'utf8');
      for (const spec of extractImportSpecifiers(content)) {
        expect(spec).not.toMatch(/infrastructure/);
      }
    }
  });

  it('Infrastructure avoids provider / Firebase / UI / dbService / feedbackScoringHints', () => {
    const violations: string[] = [];
    for (const file of collectTsFiles(INFRA_LRN)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const specifier of extractImportSpecifiers(content)) {
        if (FORBIDDEN_PACKAGE.some((p) => p.test(specifier))) {
          violations.push(`${rel} → ${specifier}`);
        }
        if (
          specifier.includes('/components/') ||
          specifier.includes('main.ts') ||
          specifier.includes('/services/db') ||
          specifier.includes('ClientWorkspace') ||
          specifier.includes('ManagerCockpit') ||
          specifier.includes('feedbackScoringHints')
        ) {
          violations.push(`${rel} → ${specifier}`);
        }
      }
      const withoutComments = content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      if (/OpenAI|Anthropic|fetch\s*\(|feedbackScoringHints/.test(withoutComments)) {
        violations.push(`${rel} → forbidden runtime`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('Infrastructure has zero primaryThesis / theses[0] / id-only getById', () => {
    for (const file of collectTsFiles(INFRA_LRN)) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/primaryThesisId|getPrimaryThesis/);
      expect(content).not.toMatch(/theses\s*\[\s*0\s*\]/);
      expect(content).not.toMatch(/getRecommendationById\s*\(\s*id\s*[:)]/);
      expect(content).not.toMatch(/getObservationById\s*\(\s*id\s*[:)]/);
    }
  });

  it('legacy keys are compatibility-only; canonical keys are dedicated', () => {
    const keys = readFileSync(join(INFRA_LRN, 'storeKeys.ts'), 'utf8');
    expect(keys).toMatch(/LEARNING_OBSERVATION_STORE_KEY = 'postura_learning_observations_v1'/);
    expect(keys).toMatch(/COMPATIBILITY/);
    expect(keys).toMatch(/LEGACY_SIGNAL_OUTCOMES_KEY = 'postura_signal_outcomes_v1'/);
    expect(keys).not.toMatch(
      /LEARNING_OBSERVATION_STORE_KEY = 'postura_signal_outcomes_v1'/
    );
  });

  it('history and decision adapters declare AUDIT_ONLY non-authority', () => {
    const history = readFileSync(join(INFRA_LRN, 'LocalLearningHistoryAdapter.ts'), 'utf8');
    const decisions = readFileSync(
      join(INFRA_LRN, 'LocalRecommendationDecisionAdapter.ts'),
      'utf8'
    );
    expect(history).toMatch(/not current authority/i);
    expect(decisions).toMatch(/not current authority/i);
  });
});
