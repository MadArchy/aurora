import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_ROOT = join(process.cwd(), 'src');
const DOMAIN_ROUTING_FILES = [
  'domain/thesisRoutingCore.ts',
  'domain/thesisRoutingEligibility.ts',
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
  'AiGateway',
  'PromptRegistry',
  'ModelRegistry',
  'OpenAiAdapter',
  'AnthropicAdapter',
];

describe('SPEC-001 Phase 1 — routing domain purity / AI independence', () => {
  it('routing domain files import only types and sibling domain modules', () => {
    const violations: string[] = [];

    for (const rel of DOMAIN_ROUTING_FILES) {
      const content = readFileSync(join(SRC_ROOT, rel), 'utf8');
      for (const specifier of extractImportSpecifiers(content)) {
        if (FORBIDDEN_PACKAGE.some((p) => p.test(specifier))) {
          violations.push(`${rel} → package ${specifier}`);
        }
        if (FORBIDDEN_PATH_FRAGMENTS.some((f) => specifier.includes(f))) {
          violations.push(`${rel} → ${specifier}`);
        }
        if (specifier.startsWith('.') && !specifier.includes('types') && !specifier.includes('thesisRouting')) {
          // Allow only ../types and ./thesisRoutingEligibility
          if (!specifier.endsWith('/types') && !specifier.includes('thesisRoutingEligibility')) {
            violations.push(`${rel} → unexpected relative ${specifier}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('routing domain source has no AI gateway / provider identifiers', () => {
    const hits: string[] = [];
    for (const rel of DOMAIN_ROUTING_FILES) {
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

  it('domain/ai is unrelated — SPEC-001 routing lives under domain/thesisRouting*', () => {
    const routingFiles = collectTsFiles(join(SRC_ROOT, 'domain')).filter((f) =>
      /thesisRouting/i.test(relative(SRC_ROOT, f))
    );
    expect(routingFiles.length).toBeGreaterThanOrEqual(2);
  });
});
