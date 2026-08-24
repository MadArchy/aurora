import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = join(process.cwd(), 'src');
const DOMAIN_BRIEF_FILES = [
  'domain/strategicBriefCore.ts',
  'domain/strategicBriefErrors.ts',
  'domain/briefMaterialityCore.ts',
  'domain/briefRoutingGateCore.ts',
  'domain/briefTenantCore.ts',
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
  /^zod(\/|$)/,
];

const FORBIDDEN_PATH_FRAGMENTS = [
  '/infrastructure/',
  '/composition/',
  '/interfaces/ai/',
  '/services/db',
  '/services/ai',
  'AiGateway',
  'PromptRegistry',
  'ModelRegistry',
  'OpenAiAdapter',
  'AnthropicAdapter',
  'dbService',
  'main.ts',
  'claimSafetyCore',
  'claimSafetyGateCore',
];

describe('SPEC-003 Phase 1 — strategic brief domain architecture', () => {
  it('brief domain files avoid Firebase/React/Vite/Express/AI/db/Zod imports', () => {
    const violations: string[] = [];

    for (const rel of DOMAIN_BRIEF_FILES) {
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

  it('brief domain source has no AI gateway / provider identifiers', () => {
    const hits: string[] = [];
    for (const rel of DOMAIN_BRIEF_FILES) {
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

  it('brief domain does not select thesis via primary/first fallback', () => {
    const hits: string[] = [];
    const banned = [
      'getPrimaryThesis',
      'primaryThesisId',
      'theses[0]',
      'activeTheses[0]',
      'candidates[0]',
      'docs[0]',
      'docs.at(0)',
      'routeSignalAcrossTheses',
      'signal.thesisId',
    ];
    for (const rel of DOMAIN_BRIEF_FILES) {
      const content = readFileSync(join(SRC_ROOT, rel), 'utf8');
      for (const token of banned) {
        if (content.includes(token)) {
          hits.push(`${rel} → ${token}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('brief domain has no Date.now or new Date in pure cores', () => {
    const hits: string[] = [];
    for (const rel of DOMAIN_BRIEF_FILES) {
      const content = readFileSync(join(SRC_ROOT, rel), 'utf8');
      const withoutComments = content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      if (/\bDate\.now\s*\(/.test(withoutComments) || /\bnew Date\s*\(/.test(withoutComments)) {
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });

  it('brief domain has no localStorage / Firestore / HTTP client usage', () => {
    const hits: string[] = [];
    for (const rel of DOMAIN_BRIEF_FILES) {
      const content = readFileSync(join(SRC_ROOT, rel), 'utf8');
      if (
        /localStorage|indexedDB|getFirestore|collection\(|fetch\(|XMLHttpRequest/.test(content)
      ) {
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });
});
