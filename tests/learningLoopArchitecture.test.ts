/**
 * SPEC-008 Phase 1 — Domain architecture purity (T-008-110).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DOMAIN_LEARNING_FILES = [
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
  'ClientWorkspace',
  'feedbackScoringHints',
  'opportunityScout',
  'opportunityCore',
];

describe('SPEC-008 Phase 1 — learning loop domain architecture', () => {
  it('Domain learning modules exist', () => {
    for (const rel of DOMAIN_LEARNING_FILES) {
      const content = readFileSync(join(process.cwd(), 'src', rel), 'utf8');
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it('Domain imports zero forbidden packages / layers', () => {
    const hits: string[] = [];
    for (const rel of DOMAIN_LEARNING_FILES) {
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
    for (const rel of DOMAIN_LEARNING_FILES) {
      const content = readFileSync(join(process.cwd(), 'src', rel), 'utf8');
      expect(content).not.toMatch(/from ['"].*application/);
      expect(content).not.toMatch(/from ['"].*infrastructure/);
      expect(content).not.toMatch(/from ['"].*components/);
      expect(content).not.toMatch(/openai|anthropic|AiOperation/i);
    }
  });

  it('no primaryThesis / theses[0] / getPrimaryThesis authority in Domain', () => {
    for (const rel of DOMAIN_LEARNING_FILES) {
      const content = readFileSync(join(process.cwd(), 'src', rel), 'utf8');
      expect(content).not.toMatch(/primaryThesisId|getPrimaryThesis/);
      expect(content).not.toMatch(/theses\s*\[\s*0\s*\]/);
      expect(content).not.toMatch(/highestScoreWinner|selectWinningThesis/);
    }
  });

  it('Domain does not mutate Brief/Plan/Opportunity/scoring/routing', () => {
    for (const rel of DOMAIN_LEARNING_FILES) {
      const content = readFileSync(join(process.cwd(), 'src', rel), 'utf8');
      expect(content).not.toMatch(/authorizePlannedAction\s*\(/);
      expect(content).not.toMatch(/approveStrategicBrief|reviseStrategicBrief/);
      expect(content).not.toMatch(/materializeOpportunity|OpportunityCandidate/);
      expect(content).not.toMatch(/feedbackScoringHints|scoreSignal/);
      expect(content).not.toMatch(/from ['"].*\/types['"]/);
      expect(content).not.toMatch(/from ['"].*lib\/id['"]/);
    }
  });
});
