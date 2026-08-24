import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const APP_SCORING = join(ROOT, 'src/application/strategicScoring');

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
];

const FORBIDDEN_FRAGMENTS = [
  'dbService',
  '/services/db',
  '/services/ai',
  'AiGateway',
  'applyScoreToSignal',
  'getPrimaryThesis',
  'routeSignalAcrossTheses',
];

const ROUTING_MUTATION_TOKENS = [
  'routingState =',
  'selectedThesisId =',
  'routingDecision =',
  'theses[0]',
  'activeTheses[0]',
];

describe('SPEC-002 Phase 2 — strategicScoring application architecture', () => {
  it('application package avoids Firebase/db/React/AI/provider imports', () => {
    const violations: string[] = [];
    for (const file of collectTsFiles(APP_SCORING)) {
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

  it('does not call applyScoreToSignal or mutate routing authority', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(APP_SCORING)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      if (/applyScoreToSignal/.test(content)) hits.push(`${rel}: applyScoreToSignal`);
      for (const token of ROUTING_MUTATION_TOKENS) {
        if (token === 'routingState =' && /routingState\s*=(?!=)/.test(content)) {
          hits.push(`${rel}: ${token}`);
        } else if (token !== 'routingState =' && content.includes(token)) {
          hits.push(`${rel}: ${token}`);
        }
      }
      if (/getPrimaryThesis|routeSignalAcrossTheses/.test(content)) {
        hits.push(`${rel}: routing orchestration`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('does not import SPEC-002 Application from SPEC-001 routing use cases (no circular orchestration)', () => {
    const routingApp = join(ROOT, 'src/application/strategicSignalRouting');
    const routingContent = collectTsFiles(routingApp)
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    expect(routingContent).not.toMatch(/strategicScoring/);
  });

  it('Db adapter scores via domain scoringCore not legacy applyScoreToSignal', () => {
    const adapter = readFileSync(
      join(ROOT, 'src/infrastructure/strategicSignalRouting/DbStrategicSignalRoutingAdapter.ts'),
      'utf8'
    );
    expect(adapter).toMatch(/computeStrategicScoreMaterial/);
    expect(adapter).not.toMatch(/applyScoreToSignal/);
  });
});
