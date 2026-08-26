/**
 * SPEC-007 Phase 1 — Domain architecture purity (T-007-110).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DOMAIN_OPPORTUNITY_FILES = [
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
  'OpportunityPanel',
  'ClientPortal',
];

describe('SPEC-007 Phase 1 — opportunity scout domain architecture', () => {
  it('Domain opportunity modules exist', () => {
    for (const rel of DOMAIN_OPPORTUNITY_FILES) {
      const content = readFileSync(join(process.cwd(), 'src', rel), 'utf8');
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it('Domain imports zero forbidden packages / layers', () => {
    const hits: string[] = [];
    for (const rel of DOMAIN_OPPORTUNITY_FILES) {
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

  it('Domain does not import Application / Infrastructure / UI / providers', () => {
    for (const rel of DOMAIN_OPPORTUNITY_FILES) {
      const content = readFileSync(join(process.cwd(), 'src', rel), 'utf8');
      expect(content).not.toMatch(/from ['"].*application/);
      expect(content).not.toMatch(/from ['"].*infrastructure/);
      expect(content).not.toMatch(/from ['"].*components/);
      expect(content).not.toMatch(/openai|anthropic|AiOperation/i);
    }
  });

  it('no primaryThesis / theses[0] / getPrimaryThesis authority in Domain', () => {
    for (const rel of DOMAIN_OPPORTUNITY_FILES) {
      const content = readFileSync(join(process.cwd(), 'src', rel), 'utf8');
      expect(content).not.toMatch(/primaryThesisId|getPrimaryThesis/);
      expect(content).not.toMatch(/theses\s*\[\s*0\s*\]/);
      expect(content).not.toMatch(/highestScoreWinner|selectWinningThesis/);
    }
  });

  it('Domain does not call SPEC-004 Application or mutate Brief/Plan', () => {
    for (const rel of DOMAIN_OPPORTUNITY_FILES) {
      const content = readFileSync(join(process.cwd(), 'src', rel), 'utf8');
      expect(content).not.toMatch(/authorizePlannedAction\s*\(/);
      expect(content).not.toMatch(/approveStrategicBrief|reviseStrategicBrief/);
      expect(content).not.toMatch(/approveStrategicPlan|createStrategicPlan/);
      expect(content).not.toMatch(/AuthorizePublication|VerifyClaim/);
    }
  });

  it('Domain does not depend on legacy opportunityLifecycle side-effect helpers', () => {
    for (const rel of DOMAIN_OPPORTUNITY_FILES) {
      const content = readFileSync(join(process.cwd(), 'src', rel), 'utf8');
      expect(content).not.toMatch(/from ['"].*opportunityLifecycle['"]/);
      expect(content).not.toMatch(/from ['"].*\/types['"]/);
      expect(content).not.toMatch(/from ['"].*lib\/id['"]/);
    }
  });
});
