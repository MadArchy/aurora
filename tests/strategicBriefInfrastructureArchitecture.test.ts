import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const INFRA_BRIEF = join(ROOT, 'src/infrastructure/strategicBrief');
const APP_BRIEF = join(ROOT, 'src/application/strategicBrief');
const DOMAIN = join(ROOT, 'src/domain');
const COMPOSITION = join(ROOT, 'src/composition/strategicBrief');

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

const HISTORY_OVERWRITE_TOKENS = [
  'updateHistory',
  'replaceHistory',
  'deleteHistoryEntry',
];

function stripComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('SPEC-003 Phase 3 — strategic brief infrastructure architecture', () => {
  it('Domain imports Infrastructure = 0', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(DOMAIN)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const specifier of extractImportSpecifiers(content)) {
        if (specifier.includes('/infrastructure/') || specifier.includes('\\infrastructure\\')) {
          hits.push(`${rel} → ${specifier}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('Application imports Infrastructure = 0', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(APP_BRIEF)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const specifier of extractImportSpecifiers(content)) {
        if (specifier.includes('/infrastructure/') || specifier.includes('/services/db')) {
          hits.push(`${rel} → ${specifier}`);
        }
      }
      if (content.includes('dbService')) hits.push(`${rel}: dbService`);
    }
    expect(hits).toEqual([]);
  });

  it('strategic infrastructure has 0 first/primary thesis authority paths', () => {
    const hits: string[] = [];
    for (const dir of [INFRA_BRIEF, COMPOSITION]) {
      for (const file of collectTsFiles(dir)) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        const content = readFileSync(file, 'utf8');
        for (const token of FIRST_PRIMARY_TOKENS) {
          if (content.includes(token)) hits.push(`${rel}: ${token}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('does not mutate SPEC-001 routing or SPEC-002 score fields', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(INFRA_BRIEF)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const withoutComments = stripComments(readFileSync(file, 'utf8'));
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

  it('production history adapter has no overwrite/delete API', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(INFRA_BRIEF)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const withoutComments = stripComments(readFileSync(file, 'utf8'));
      for (const token of HISTORY_OVERWRITE_TOKENS) {
        if (withoutComments.includes(token)) hits.push(`${rel}: ${token}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('does not call Date.now or new Date in material governance', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(INFRA_BRIEF)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const withoutComments = stripComments(readFileSync(file, 'utf8'));
      if (/\bDate\.now\s*\(/.test(withoutComments) || /\bnew Date\s*\(/.test(withoutComments)) {
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });

  it('does not rescore, reroute, auto-discard, or verify claims', () => {
    const hits: string[] = [];
    const banned = [
      'computeStrategicScoreMaterial',
      'applyGovernedScoreToSignal',
      'applyStrategicRoutingToSignal',
      'applyScoreToSignal',
      'routeSignalAcrossTheses',
      'claimSafetyCore',
      'claimSafetyGateCore',
      'ExecuteAiOperation',
      'AiGateway',
    ];
    for (const file of collectTsFiles(INFRA_BRIEF)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const token of banned) {
        if (content.includes(token)) hits.push(`${rel}: ${token}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('does not embed unbounded history arrays on the current Brief document', () => {
    const keys = readFileSync(join(INFRA_BRIEF, 'storeKeys.ts'), 'utf8');
    const store = readFileSync(join(INFRA_BRIEF, 'LocalStrategicBriefStore.ts'), 'utf8');
    expect(keys).toContain('postura_strategic_brief_v1');
    expect(keys).toContain('postura_strategic_brief_history_v1');
    expect(keys).toContain('postura_strategic_brief_override_v1');
    expect(store).toContain('STRATEGIC_BRIEF_CURRENT_STORE_KEY');
    expect(store).toContain('STRATEGIC_BRIEF_HISTORY_STORE_KEY');
    expect(store).toContain('STRATEGIC_BRIEF_OVERRIDE_STORE_KEY');
    expect(store).not.toMatch(/brief\.history\s*=/);
  });
});
