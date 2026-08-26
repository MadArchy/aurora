/**
 * SPEC-004 Phase 2 — Application architecture purity (T-004-211).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
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

const FORBIDDEN_FRAGMENTS = [
  '/infrastructure/',
  '/composition/',
  '/components/',
  '/services/db',
  '/services/ai',
  'AiGateway',
  'localStorage',
  'main.ts',
  'AuthorizePublication',
  'VerifyClaim',
  'CreateStrategicBrief',
  'ApproveStrategicBrief',
];

describe('SPEC-004 Phase 2 — strategic plan application architecture (T-004-211)', () => {
  it('application strategicPlan paths avoid Infrastructure/UI/Firebase/provider', () => {
    const violations: string[] = [];
    for (const file of collectTsFiles(APP_PLAN)) {
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
    for (const file of collectTsFiles(APP_PLAN)) {
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

  it('application does not import Domain→Application reverse; Domain purity preserved', () => {
    for (const rel of DOMAIN_PLAN_FILES) {
      const content = readFileSync(join(ROOT, 'src', rel), 'utf8');
      expect(content).not.toMatch(/application\/strategicPlan/);
      expect(content).not.toMatch(/primaryThesisId|getPrimaryThesis|theses\s*\[\s*0\s*\]/);
    }
  });

  it('application has zero primaryThesis / theses[0] authority patterns', () => {
    for (const file of collectTsFiles(APP_PLAN)) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/primaryThesisId|getPrimaryThesis|theses\s*\[\s*0\s*\]/);
    }
  });

  it('PlannerAdvisorPort is advisory-only (no approve/activate authority language as implementation)', () => {
    const advisor = readFileSync(
      join(APP_PLAN, 'ports/PlannerAdvisorPort.ts'),
      'utf8'
    );
    expect(advisor).toMatch(/suggest/);
    expect(advisor).toMatch(/Never approval|never approval|suggestions only/i);
  });
});
