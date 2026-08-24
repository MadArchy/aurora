import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = join(process.cwd(), 'src');
const DOMAIN_SCORING_FILES = [
  'domain/scoringCore.ts',
  'domain/dispositionCore.ts',
  'domain/scoreExplainCore.ts',
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
  '/interfaces/ai/',
  '/services/db',
  '/services/ai',
  '/services/scoring',
  'AiGateway',
  'PromptRegistry',
  'ModelRegistry',
  'OpenAiAdapter',
  'AnthropicAdapter',
  'dbService',
];

const ROUTING_AUTHORITY_TOKENS = [
  'getPrimaryThesis',
  'routeSignalAcrossTheses',
  'selectedThesisId',
  'activeTheses[0]',
  'theses[0]',
  'routingState',
  'routingDecision',
];

describe('SPEC-002 Phase 1 — scoring domain architecture', () => {
  it('scoring domain files avoid Firebase/React/Express/AI/db imports', () => {
    const violations: string[] = [];

    for (const rel of DOMAIN_SCORING_FILES) {
      const content = readFileSync(join(SRC_ROOT, rel), 'utf8');
      for (const specifier of extractImportSpecifiers(content)) {
        if (FORBIDDEN_PACKAGE.some((p) => p.test(specifier))) {
          violations.push(`${rel} → package ${specifier}`);
        }
        if (FORBIDDEN_PATH_FRAGMENTS.some((f) => specifier.includes(f))) {
          violations.push(`${rel} → ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('scoring domain source has no AI gateway / provider identifiers', () => {
    const hits: string[] = [];
    for (const rel of DOMAIN_SCORING_FILES) {
      const content = readFileSync(join(SRC_ROOT, rel), 'utf8');
      if (
        /SIGNAL_THESIS_EVAL|AiGateway|ExecuteAiOperation|PromptRegistry|ModelRegistry|api\.openai\.com|api\.anthropic\.com/i.test(
          content
        )
      ) {
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });

  it('scoring domain does not claim routing authority', () => {
    const hits: string[] = [];
    for (const rel of DOMAIN_SCORING_FILES) {
      const content = readFileSync(join(SRC_ROOT, rel), 'utf8');
      for (const token of ROUTING_AUTHORITY_TOKENS) {
        if (content.includes(token)) {
          hits.push(`${rel} → ${token}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('domain/scoringCore has no Date.now inside pure core', () => {
    const content = readFileSync(join(SRC_ROOT, 'domain/scoringCore.ts'), 'utf8');
    const withoutComments = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(withoutComments).not.toMatch(/\bDate\.now\s*\(/);
  });

  it('scoreExplainCore imports weights from scoringCore only', () => {
    const content = readFileSync(join(SRC_ROOT, 'domain/scoreExplainCore.ts'), 'utf8');
    expect(content).toContain('SCORING_FACTOR_WEIGHTS');
    expect(content).not.toMatch(/maxPoints:\s*25/);
  });
});
