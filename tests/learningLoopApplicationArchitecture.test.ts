/**
 * SPEC-008 Phase 2 — Application architecture purity (T-008-210).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
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

const FORBIDDEN_FRAGMENTS = [
  '/infrastructure/',
  '/composition/',
  '/components/',
  '/services/db',
  '/services/ai',
  'AiGateway',
  'localStorage',
  'main.ts',
  'ClientWorkspace',
  'ManagerCockpit',
  'feedbackScoringHints',
  'DbStrategicSignalRoutingAdapter',
  'dbService',
  'materializeOpportunity',
  'ApproveStrategicBrief',
];

describe('SPEC-008 Phase 2 — learning loop application architecture (T-008-210)', () => {
  it('application learningLoop paths avoid Infrastructure/UI/Firebase/provider', () => {
    const violations: string[] = [];
    for (const file of collectTsFiles(APP_LRN)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const specifier of extractImportSpecifiers(content)) {
        if (FORBIDDEN_PACKAGE.some((p) => p.test(specifier))) {
          violations.push(`${rel} → package ${specifier}`);
        }
        if (FORBIDDEN_FRAGMENTS.some((f) => specifier.includes(f))) {
          violations.push(`${rel} → ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('application has no Date.now / new Date / fetch / localStorage / provider SDKs', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(APP_LRN)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      const withoutComments = content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      if (
        /\bDate\.now\s*\(/.test(withoutComments) ||
        /\bnew Date\s*\(/.test(withoutComments) ||
        /localStorage|indexedDB|fetch\(|XMLHttpRequest|OpenAI|Anthropic/.test(
          withoutComments
        )
      ) {
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });

  it('Domain does not import Application; primary/[0] authority absent', () => {
    for (const rel of DOMAIN_LRN_FILES) {
      const content = readFileSync(join(ROOT, 'src', rel), 'utf8');
      expect(content).not.toMatch(/application\/learningLoop/);
      expect(content).not.toMatch(/primaryThesisId|getPrimaryThesis/);
      expect(content).not.toMatch(/theses\s*\[\s*0\s*\]/);
    }
  });

  it('application has zero primaryThesis / theses[0] / feedbackScoringHints authority patterns', () => {
    for (const file of collectTsFiles(APP_LRN)) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/primaryThesisId|getPrimaryThesis/);
      expect(content).not.toMatch(/theses\s*\[\s*0\s*\]/);
      expect(content).not.toMatch(/feedbackScoringHints/);
    }
  });

  it('TargetSpecApplyPort is boundary-only — no direct target storage mutation', () => {
    const port = readFileSync(
      join(APP_LRN, 'ports/TargetSpecApplyPort.ts'),
      'utf8'
    );
    expect(port).toMatch(/apply/);
    expect(port).not.toMatch(/localStorage|dbService|feedbackScoringHints/);
  });

  it('repository ports require tenant scope (no id-only getById signature)', () => {
    const obs = readFileSync(
      join(APP_LRN, 'ports/LearningObservationRepository.ts'),
      'utf8'
    );
    const rec = readFileSync(
      join(APP_LRN, 'ports/StrategicRecommendationRepository.ts'),
      'utf8'
    );
    expect(obs).toMatch(/getById\(\s*\n?\s*observationId.*tenant/s);
    expect(rec).toMatch(/getById\(\s*\n?\s*recommendationId.*tenant/s);
    expect(obs).not.toMatch(/getById\(id:\s*string\)/);
    expect(rec).not.toMatch(/getById\(id:\s*string\)/);
  });

  it('OpportunityOutcomeReader is read-only (SPEC-007 frozen)', () => {
    const reader = readFileSync(
      join(APP_LRN, 'ports/OpportunityOutcomeReader.ts'),
      'utf8'
    );
    expect(reader).toMatch(/Read-only|read-only/i);
    expect(reader).not.toMatch(/materializeOpportunity|transitionMaterialized/);
  });
});
