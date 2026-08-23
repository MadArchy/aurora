import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_ROOT = join(process.cwd(), 'src');

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

function resolveRelativeImport(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const fromDir = fromFile.slice(0, fromFile.lastIndexOf('/'));
  const segments = specifier.split('/');
  const parts = fromDir.split('/');
  for (const segment of segments) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  return parts.join('/');
}

function isForbiddenPackageImport(specifier: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(specifier));
}

function importsLayer(fromFile: string, content: string, layerSegment: string): string[] {
  const hits: string[] = [];
  for (const specifier of extractImportSpecifiers(content)) {
    if (specifier.includes(`/${layerSegment}/`) || specifier.includes(`\\${layerSegment}\\`)) {
      hits.push(specifier);
      continue;
    }
    const resolved = resolveRelativeImport(fromFile, specifier);
    if (resolved?.includes(`/${layerSegment}`)) {
      hits.push(specifier);
    }
  }
  return hits;
}

const FIREBASE_PATTERNS = [/^firebase(\/|$)/, /^firebase-admin(\/|$)/, /^@google-cloud\//];
const PROVIDER_SDK_PATTERNS = [/^openai(\/|$)/, /^@anthropic-ai\//];

describe('SPEC-005 Phase 1H — hexagonal architecture boundaries', () => {
  const domainFiles = collectTsFiles(join(SRC_ROOT, 'domain', 'ai')).map((file) =>
    relative(SRC_ROOT, file).replace(/\\/g, '/')
  );
  const applicationFiles = collectTsFiles(join(SRC_ROOT, 'application', 'ai')).map((file) =>
    relative(SRC_ROOT, file).replace(/\\/g, '/')
  );

  it('A: domain does not import Firebase', () => {
    const violations: string[] = [];
    for (const file of domainFiles) {
      const content = readFileSync(join(SRC_ROOT, file), 'utf8');
      for (const specifier of extractImportSpecifiers(content)) {
        if (isForbiddenPackageImport(specifier, FIREBASE_PATTERNS)) {
          violations.push(`${file} → ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('B: domain does not import Firebase Admin', () => {
    const violations: string[] = [];
    for (const file of domainFiles) {
      const content = readFileSync(join(SRC_ROOT, file), 'utf8');
      if (/firebase-admin/.test(content) && /from\s+['"]firebase-admin/.test(content)) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });

  it('C: domain does not import provider SDKs', () => {
    const violations: string[] = [];
    for (const file of domainFiles) {
      const content = readFileSync(join(SRC_ROOT, file), 'utf8');
      for (const specifier of extractImportSpecifiers(content)) {
        if (isForbiddenPackageImport(specifier, PROVIDER_SDK_PATTERNS)) {
          violations.push(`${file} → ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('D: domain does not import infrastructure', () => {
    const violations: string[] = [];
    for (const file of domainFiles) {
      const content = readFileSync(join(SRC_ROOT, file), 'utf8');
      const hits = importsLayer(file, content, 'infrastructure');
      if (hits.length > 0) violations.push(`${file}: ${hits.join(', ')}`);
    }
    expect(violations).toEqual([]);
  });

  it('E: application does not import Firebase / Firebase Admin', () => {
    const violations: string[] = [];
    for (const file of applicationFiles) {
      const content = readFileSync(join(SRC_ROOT, file), 'utf8');
      for (const specifier of extractImportSpecifiers(content)) {
        if (isForbiddenPackageImport(specifier, FIREBASE_PATTERNS)) {
          violations.push(`${file} → ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('F: application does not import concrete provider SDKs', () => {
    const violations: string[] = [];
    for (const file of applicationFiles) {
      const content = readFileSync(join(SRC_ROOT, file), 'utf8');
      for (const specifier of extractImportSpecifiers(content)) {
        if (isForbiddenPackageImport(specifier, PROVIDER_SDK_PATTERNS)) {
          violations.push(`${file} → ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('G: application does not import infrastructure adapters', () => {
    const violations: string[] = [];
    for (const file of applicationFiles) {
      const content = readFileSync(join(SRC_ROOT, file), 'utf8');
      const hits = importsLayer(file, content, 'infrastructure');
      if (hits.length > 0) violations.push(`${file}: ${hits.join(', ')}`);
    }
    expect(violations).toEqual([]);
  });

  it('H: infrastructure may depend on application ports and domain', () => {
    expect(true).toBe(true);
  });

  it('I: interfaces may depend on application inbound boundary', () => {
    expect(true).toBe(true);
  });

  it('J: composition may depend on application + infrastructure', () => {
    const testComposition = readFileSync(join(SRC_ROOT, 'composition', 'ai', 'testGatewayComposition.ts'), 'utf8');
    expect(testComposition).toMatch(/application\/ai/);
    expect(importsLayer('composition/ai/testGatewayComposition.ts', testComposition, 'infrastructure')).toEqual([]);

    const serverComposition = readFileSync(join(SRC_ROOT, 'composition', 'ai', 'serverGatewayComposition.ts'), 'utf8');
    expect(serverComposition).toMatch(/infrastructure\/ai/);
  });

  it('K: browser UI/services do not import server AI infrastructure', () => {
    const browserRoots = [
      'main.ts',
      'services/ai.ts',
      'services/advisor.ts',
      'services/contentDraftGateway.ts',
      'services/thesisSignalGateway.ts',
      'services/advisorGateway.ts',
      'interfaces/ai/aiCompleteHttpClient.ts',
      'services/mapContentDraftGatewayInput.ts',
      'services/mapThesisProposalGatewayInput.ts',
      'services/mapSignalThesisEvalGatewayInput.ts',
      'services/mapThesisChallengeGatewayInput.ts',
      'services/mapAdvisorPositioningGatewayInput.ts',
      'services/mapAdvisorCurationAngleGatewayInput.ts',
      'services/mapAdvisorPositioningOutput.ts',
      'services/comparativeGateway.ts',
      'services/mapAnalysisComparativeGatewayInput.ts',
      'services/mapAnalysisComparativeOutput.ts',
    ];
    const violations: string[] = [];
    for (const rel of browserRoots) {
      const content = readFileSync(join(SRC_ROOT, rel), 'utf8');
      const hits = importsLayer(rel, content, 'infrastructure');
      if (hits.length) violations.push(`${rel}: ${hits.join(', ')}`);
      if (content.includes('serverGatewayComposition')) violations.push(`${rel}: serverGatewayComposition`);
      if (content.includes('OPENAI_API_KEY') || content.includes('ANTHROPIC_API_KEY')) {
        violations.push(`${rel}: server secret env reference`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('domain purity: domain/ai does not import zod', () => {
    const violations: string[] = [];
    for (const file of domainFiles) {
      const content = readFileSync(join(SRC_ROOT, file), 'utf8');
      for (const specifier of extractImportSpecifiers(content)) {
        if (/^zod(\/|$)/.test(specifier)) {
          violations.push(`${file} → ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
