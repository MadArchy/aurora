/**
 * SPEC-004 Phase 3 — Infrastructure architecture purity (T-004-308).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const INFRA_PLAN = join(ROOT, 'src/infrastructure/strategicPlan');
const APP_PLAN = join(ROOT, 'src/application/strategicPlan');
const DOMAIN_PLAN_FILES = [
  'domain/strategicPlanCore.ts',
  'domain/strategicPlanErrors.ts',
  'domain/planItemCore.ts',
  'domain/planTenantCore.ts',
  'domain/planBriefContextCore.ts',
  'domain/planGateCore.ts',
  'domain/planMaterialityCore.ts',
  'domain/planExplainabilityCore.ts',
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

describe('SPEC-004 Phase 3 — strategic plan infrastructure architecture (T-004-308)', () => {
  it('Domain does not import Infrastructure', () => {
    for (const rel of DOMAIN_PLAN_FILES) {
      const content = readFileSync(join(ROOT, 'src', rel), 'utf8');
      expect(content).not.toMatch(/infrastructure\/strategicPlan|\/infrastructure\//);
    }
  });

  it('Application does not import Infrastructure', () => {
    for (const file of collectTsFiles(APP_PLAN)) {
      const content = readFileSync(file, 'utf8');
      for (const spec of extractImportSpecifiers(content)) {
        expect(spec).not.toMatch(/infrastructure/);
      }
    }
  });

  it('Infrastructure avoids provider / Firebase / UI / SPEC-006 publication', () => {
    const violations: string[] = [];
    for (const file of collectTsFiles(INFRA_PLAN)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const specifier of extractImportSpecifiers(content)) {
        if (FORBIDDEN_PACKAGE.some((p) => p.test(specifier))) {
          violations.push(`${rel} → ${specifier}`);
        }
        if (
          specifier.includes('/components/') ||
          specifier.includes('main.ts') ||
          specifier.includes('AuthorizePublication') ||
          specifier.includes('VerifyClaim') ||
          specifier.includes('ApproveStrategicBrief') ||
          specifier.includes('CreateStrategicBrief')
        ) {
          violations.push(`${rel} → ${specifier}`);
        }
      }
      const withoutComments = content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      if (/OpenAI|Anthropic|fetch\s*\(/.test(withoutComments)) {
        violations.push(`${rel} → provider/runtime I/O`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('Infrastructure has zero primaryThesis / theses[0] / plans[0] authority patterns', () => {
    for (const file of collectTsFiles(INFRA_PLAN)) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/primaryThesisId|getPrimaryThesis|theses\s*\[\s*0\s*\]/);
      expect(content).not.toMatch(/plans\s*\[\s*0\s*\]|briefs\s*\[\s*0\s*\]/);
    }
  });

  it('Brief reader adapter is read-only (no Brief mutation APIs)', () => {
    const content = readFileSync(
      join(INFRA_PLAN, 'LocalStrategicBriefReader.ts'),
      'utf8'
    );
    expect(content).toMatch(/READ ONLY|read-only|Does not mutate/i);
    expect(content).not.toMatch(/commitWriteUnit|approveStrategicBrief|reviseStrategicBrief/);
  });
});
