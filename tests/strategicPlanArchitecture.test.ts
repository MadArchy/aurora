/**
 * SPEC-004 Phase 1 — Domain architecture purity.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

function extractImportSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /import\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g,
    /export\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
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
  /^@google-cloud\//,
  /^openai(\/|$)/,
  /^@anthropic-ai\//,
  /^express(\/|$)/,
  /^axios(\/|$)/,
  /^react(\/|$)/,
  /^vite(\/|$)/,
];

const FORBIDDEN_PATH_FRAGMENTS = [
  '/infrastructure/',
  '/composition/',
  '/application/',
  '/components/',
  '/services/db',
  '/services/ai',
  'AiGateway',
  'localStorage',
  'main.ts',
];

describe('SPEC-004 Phase 1 — strategic plan domain architecture', () => {
  it('Domain plan modules exist', () => {
    for (const rel of DOMAIN_PLAN_FILES) {
      const content = readFileSync(join(process.cwd(), 'src', rel), 'utf8');
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it('Domain imports zero forbidden packages / layers', () => {
    const hits: string[] = [];
    for (const rel of DOMAIN_PLAN_FILES) {
      const content = readFileSync(join(process.cwd(), 'src', rel), 'utf8');
      for (const spec of extractImportSpecifiers(content)) {
        if (FORBIDDEN_PACKAGE.some((re) => re.test(spec))) {
          hits.push(`${rel}: package ${spec}`);
        }
        if (FORBIDDEN_PATH_FRAGMENTS.some((frag) => spec.includes(frag))) {
          hits.push(`${rel}: path ${spec}`);
        }
        if (spec.includes('localStorage') || spec.includes('firestore')) {
          hits.push(`${rel}: storage ${spec}`);
        }
      }
      if (/localStorage|indexedDB|fetch\s*\(/.test(content)) {
        hits.push(`${rel}: runtime I/O`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('Domain may import strategicBriefCore types only (no Brief mutation APIs used as writers)', () => {
    for (const rel of DOMAIN_PLAN_FILES) {
      const content = readFileSync(join(process.cwd(), 'src', rel), 'utf8');
      expect(content).not.toMatch(/approveStrategicBrief|reviseStrategicBrief|createStrategicBrief/);
      expect(content).not.toMatch(/AuthorizePublication|VerifyClaim|claimSafety/);
    }
  });

  it('no primaryThesis / theses[0] authority patterns in Domain plan modules', () => {
    for (const rel of DOMAIN_PLAN_FILES) {
      const content = readFileSync(join(process.cwd(), 'src', rel), 'utf8');
      expect(content).not.toMatch(/primaryThesisId|getPrimaryThesis|theses\s*\[\s*0\s*\]/);
    }
  });
});
