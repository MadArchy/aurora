/**
 * SPEC-007 Phase 3 — Infrastructure architecture purity (T-007-308).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const INFRA_OPP = join(ROOT, 'src/infrastructure/opportunityScout');
const APP_OPP = join(ROOT, 'src/application/opportunityScout');
const DOMAIN_OPP_FILES = [
  'domain/opportunityScoutErrors.ts',
  'domain/opportunityTenantCore.ts',
  'domain/opportunityScoreCore.ts',
  'domain/opportunityCandidateCore.ts',
  'domain/opportunityLifecycleCore.ts',
  'domain/opportunityMultiThesisCore.ts',
  'domain/opportunityMaterializeGateCore.ts',
  'domain/opportunityCore.ts',
  'domain/opportunityMaterialityCore.ts',
  'domain/opportunityExplainabilityCore.ts',
  'domain/opportunityLegacyMappingCore.ts',
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

describe('SPEC-007 Phase 3 — opportunity scout infrastructure architecture (T-007-308)', () => {
  it('Domain does not import Infrastructure', () => {
    for (const rel of DOMAIN_OPP_FILES) {
      const content = readFileSync(join(ROOT, 'src', rel), 'utf8');
      expect(content).not.toMatch(/infrastructure\/opportunityScout|\/infrastructure\//);
    }
  });

  it('Application does not import Infrastructure', () => {
    for (const file of collectTsFiles(APP_OPP)) {
      const content = readFileSync(file, 'utf8');
      for (const spec of extractImportSpecifiers(content)) {
        expect(spec).not.toMatch(/infrastructure/);
      }
    }
  });

  it('Infrastructure avoids provider / Firebase / UI / db.ts mutation / publication', () => {
    const violations: string[] = [];
    for (const file of collectTsFiles(INFRA_OPP)) {
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
          specifier.includes('AuthorizePublication') ||
          specifier.includes('VerifyClaim') ||
          specifier.includes('OpportunityPanel') ||
          specifier.includes('ClientPortal')
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

  it('Infrastructure has zero primaryThesis / theses[0] / id-only getOpportunityById', () => {
    for (const file of collectTsFiles(INFRA_OPP)) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/primaryThesisId|getPrimaryThesis/);
      expect(content).not.toMatch(/theses\s*\[\s*0\s*\]/);
      expect(content).not.toMatch(/getOpportunityById\s*\(\s*id\s*[:)]/);
    }
  });

  it('Legacy reader is COMPATIBILITY_ONLY and does not claim authority', () => {
    const content = readFileSync(
      join(INFRA_OPP, 'LegacyOpportunityV5CompatibilityReader.ts'),
      'utf8'
    );
    expect(content).toMatch(/COMPATIBILITY_ONLY|COMPATIBILITY/);
    expect(content).toMatch(/MIGRATION_REVIEW_REQUIRED/);
    expect(content).not.toMatch(/commitWriteUnit/);
  });

  it('canonical store keys are distinct from legacy postura_opportunities_v5 authority', () => {
    const keys = readFileSync(join(INFRA_OPP, 'storeKeys.ts'), 'utf8');
    expect(keys).toMatch(/postura_opportunity_v1/);
    expect(keys).toMatch(/postura_opportunity_candidate_v1/);
    expect(keys).toMatch(/LEGACY_OPPORTUNITIES_V5_KEY/);
  });
});
