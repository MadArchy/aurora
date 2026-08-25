import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const APP_CLAIM = join(ROOT, 'src/application/claimEvidence');

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
  'localStorage',
  'main.ts',
  'claimSafetyCore',
  'claimSafetyGateCore',
  'ClaimSafetyPanel',
  'posturaClaimsCore',
  'firebase/claims',
  '/infrastructure/',
  'CreateStrategicBrief',
  'ApproveStrategicBrief',
];

describe('SPEC-006 Phase 2 — application architecture (T-006-211)', () => {
  it('application claimEvidence paths avoid Firebase/React/AI/db/infrastructure', () => {
    const violations: string[] = [];
    for (const file of collectTsFiles(APP_CLAIM)) {
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

  it('application has no Date.now / new Date / fetch / localStorage', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(APP_CLAIM)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      const withoutComments = content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      if (
        /\bDate\.now\s*\(/.test(withoutComments) ||
        /\bnew Date\s*\(/.test(withoutComments) ||
        /localStorage|indexedDB|fetch\(|XMLHttpRequest/.test(withoutComments)
      ) {
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });

  it('application does not mutate SPEC-003 Brief / routing / scoring', () => {
    const hits: string[] = [];
    const banned = [
      'ApproveStrategicBrief',
      'CreateStrategicBrief',
      'routingDecision',
      'selectedThesisId',
      'relevanceScore',
      'scoringVersion =',
    ];
    for (const file of collectTsFiles(APP_CLAIM)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const token of banned) {
        if (content.includes(token)) {
          hits.push(`${rel} → ${token}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('application does not call OpenAI/Anthropic providers', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(APP_CLAIM)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      if (/api\.openai\.com|api\.anthropic\.com|OpenAiAdapter|AnthropicAdapter/i.test(content)) {
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });
});
