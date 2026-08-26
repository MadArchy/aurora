/**
 * SPEC-007 Phase 2 — Application architecture purity (T-007-210).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
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

const FORBIDDEN_FRAGMENTS = [
  '/infrastructure/',
  '/composition/',
  '/components/',
  '/services/db',
  '/services/ai',
  'AiGateway',
  'localStorage',
  'main.ts',
  'OpportunityPanel',
  'ClientPortal',
  'AuthorizePublication',
  'VerifyClaim',
  'CreateStrategicBrief',
  'ApproveStrategicBrief',
  'createStrategicPlan',
  'approveStrategicPlan',
];

describe('SPEC-007 Phase 2 — opportunity scout application architecture (T-007-210)', () => {
  it('application opportunityScout paths avoid Infrastructure/UI/Firebase/provider', () => {
    const violations: string[] = [];
    for (const file of collectTsFiles(APP_OPP)) {
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
    for (const file of collectTsFiles(APP_OPP)) {
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
    for (const rel of DOMAIN_OPP_FILES) {
      const content = readFileSync(join(ROOT, 'src', rel), 'utf8');
      expect(content).not.toMatch(/application\/opportunityScout/);
      expect(content).not.toMatch(/primaryThesisId|getPrimaryThesis/);
      expect(content).not.toMatch(/theses\s*\[\s*0\s*\]/);
    }
  });

  it('application has zero primaryThesis / theses[0] authority patterns', () => {
    for (const file of collectTsFiles(APP_OPP)) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/primaryThesisId|getPrimaryThesis/);
      expect(content).not.toMatch(/theses\s*\[\s*0\s*\]/);
    }
  });

  it('OpportunityAdvisorPort is advisory-only', () => {
    const advisor = readFileSync(
      join(APP_OPP, 'ports/OpportunityAdvisorPort.ts'),
      'utf8'
    );
    expect(advisor).toMatch(/suggest/);
    expect(advisor).toMatch(/Never|never|suggestions only|Advisory/i);
  });

  it('StrategicPlanAuthorizationPort is a facade (no Planner duplication APIs)', () => {
    const auth = readFileSync(
      join(APP_OPP, 'ports/StrategicPlanAuthorizationPort.ts'),
      'utf8'
    );
    expect(auth).toMatch(/authorizeCreateOpportunity/);
    expect(auth).not.toMatch(/approveStrategicPlan|createStrategicPlan/);
  });

  it('repository ports require tenant scope (no id-only getById signature)', () => {
    const cand = readFileSync(
      join(APP_OPP, 'ports/OpportunityCandidateRepository.ts'),
      'utf8'
    );
    const opp = readFileSync(join(APP_OPP, 'ports/OpportunityRepository.ts'), 'utf8');
    expect(cand).toMatch(/getById\(\s*\n?\s*candidateId.*tenant/s);
    expect(opp).toMatch(/getById\(\s*\n?\s*opportunityId.*tenant/s);
    expect(cand).not.toMatch(/getById\(id:\s*string\)/);
    expect(opp).not.toMatch(/getById\(id:\s*string\)/);
  });
});
