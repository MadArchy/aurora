import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const APP_BRIEF = join(ROOT, 'src/application/strategicBrief');

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
  /^zod(\/|$)/,
];

const FORBIDDEN_FRAGMENTS = [
  'dbService',
  '/services/db',
  '/services/ai',
  'AiGateway',
  'getPrimaryThesis',
  'claimSafetyCore',
  'claimSafetyGateCore',
];

const FIRST_PRIMARY_TOKENS = [
  'getPrimaryThesis',
  'primaryThesisId',
  'theses[0]',
  'activeTheses[0]',
  'candidates[0]',
  'docs[0]',
  'docs.at(0)',
];

const ROUTING_MUTATION_TOKENS = [
  'routingDecision =',
  'selectedThesisId =',
  'thesisScores =',
  'routingHistory =',
];

const SCORE_MUTATION_TOKENS = [
  'relevanceScore =',
  'priorityBand =',
  'scoringVersion =',
  'scoreBreakdown =',
  'recommendedDisposition =',
  'recommendedOutputFormat =',
];

describe('SPEC-003 Phase 2 — strategicBrief application architecture', () => {
  it('application package avoids Firebase/db/React/AI/HTTP/provider imports', () => {
    const violations: string[] = [];
    for (const file of collectTsFiles(APP_BRIEF)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const specifier of extractImportSpecifiers(content)) {
        if (FORBIDDEN_PACKAGE.some((p) => p.test(specifier))) {
          violations.push(`${rel} → ${specifier}`);
        }
        if (FORBIDDEN_FRAGMENTS.some((f) => specifier.includes(f))) {
          violations.push(`${rel} → ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('has no first/primary thesis strategic consumers', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(APP_BRIEF)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const token of FIRST_PRIMARY_TOKENS) {
        if (content.includes(token)) hits.push(`${rel}: ${token}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('does not mutate SPEC-001 routing or SPEC-002 score authority', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(APP_BRIEF)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const withoutComments = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      for (const token of ROUTING_MUTATION_TOKENS) {
        if (withoutComments.includes(token)) hits.push(`${rel}: ${token}`);
      }
      for (const token of SCORE_MUTATION_TOKENS) {
        if (withoutComments.includes(token)) hits.push(`${rel}: ${token}`);
      }
      if (/\broutingState\s*=(?!=)/.test(withoutComments)) {
        hits.push(`${rel}: routingState assignment`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('does not call Date.now or new Date in Application orchestration', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(APP_BRIEF)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const withoutComments = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      if (/\bDate\.now\s*\(/.test(withoutComments) || /\bnew Date\s*\(/.test(withoutComments)) {
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });

  it('does not import claim safety or AI gateway modules', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(APP_BRIEF)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      if (/claimSafety|AiGateway|openai|anthropic/i.test(content)) hits.push(rel);
    }
    expect(hits).toEqual([]);
  });
});
