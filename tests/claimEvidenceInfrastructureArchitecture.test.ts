import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const INFRA_CLAIM = join(ROOT, 'src/infrastructure/claimEvidence');
const APP_CLAIM = join(ROOT, 'src/application/claimEvidence');
const DOMAIN = join(ROOT, 'src/domain');
const COMPOSITION = join(ROOT, 'src/composition/claimEvidence');
const UI_HINTS = [
  join(ROOT, 'src/ui'),
  join(ROOT, 'src/components'),
];

function collectTsFiles(dir: string): string[] {
  try {
    if (!statSync(dir).isDirectory()) return [];
  } catch {
    return [];
  }
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
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

function stripComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const HISTORY_OVERWRITE_TOKENS = [
  'updateHistory',
  'replaceHistory',
  'deleteHistoryEntry',
  'setHistory',
];

describe('SPEC-006 Phase 3 — claim evidence infrastructure architecture (T-006-308)', () => {
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

  it('Application claimEvidence imports Infrastructure = 0', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(APP_CLAIM)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const specifier of extractImportSpecifiers(content)) {
        if (
          specifier.includes('/infrastructure/') ||
          specifier.includes('/services/db') ||
          specifier.includes('localStorage')
        ) {
          hits.push(`${rel} → ${specifier}`);
        }
      }
      if (content.includes('dbService')) hits.push(`${rel}: dbService`);
      if (content.includes('localStorage')) hits.push(`${rel}: localStorage`);
    }
    expect(hits).toEqual([]);
  });

  it('production history adapter has no overwrite/delete API', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(INFRA_CLAIM)) {
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
    for (const file of collectTsFiles(INFRA_CLAIM)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const withoutComments = stripComments(readFileSync(file, 'utf8'));
      if (/\bDate\.now\s*\(/.test(withoutComments) || /\bnew Date\s*\(/.test(withoutComments)) {
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });

  it('does not call claimSafety / providers / SPEC-003 Brief writers', () => {
    const hits: string[] = [];
    const banned = [
      'claimSafetyCore',
      'claimSafetyGateCore',
      'ClaimSafetyPanel',
      'ExecuteAiOperation',
      'AiGateway',
      'CreateStrategicBrief',
      'ApproveStrategicBrief',
      'api.openai.com',
      'api.anthropic.com',
      'posturaClaimsCore',
      'firebase/claims',
    ];
    // Infrastructure remains free of legacy claim-safety. Composition may adapt
    // advisoryClaimSafetyProjection (Phase 4) — exclude that file from this ban.
    for (const file of collectTsFiles(INFRA_CLAIM)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const token of banned) {
        if (content.includes(token)) hits.push(`${rel}: ${token}`);
      }
    }
    for (const file of collectTsFiles(COMPOSITION)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (rel.endsWith('advisoryClaimSafetyProjection.ts')) continue;
      const content = readFileSync(file, 'utf8');
      for (const token of banned) {
        if (content.includes(token)) hits.push(`${rel}: ${token}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('current and history use separate versioned store keys', () => {
    const keys = readFileSync(join(INFRA_CLAIM, 'storeKeys.ts'), 'utf8');
    const store = readFileSync(join(INFRA_CLAIM, 'LocalClaimEvidenceStore.ts'), 'utf8');
    expect(keys).toContain('postura_claim_v1');
    expect(keys).toContain('postura_claim_history_v1');
    expect(keys).toContain('postura_claim_verification_v1');
    expect(keys).toContain('postura_claim_link_v1');
    expect(keys).toContain('postura_claim_override_v1');
    expect(store).toContain('CLAIM_CURRENT_STORE_KEY');
    expect(store).toContain('CLAIM_HISTORY_STORE_KEY');
    expect(store).not.toMatch(/claim\.history\s*=/);
  });

  it('UI / main do not import SPEC-006 claimEvidence infrastructure', () => {
    const hits: string[] = [];
    const scanRoots = [
      join(ROOT, 'src/ui/legacy/LegacyApp.ts'),
      ...UI_HINTS.flatMap((d) => collectTsFiles(d)),
    ];
    for (const file of scanRoots) {
      try {
        if (!statSync(file).isFile()) continue;
      } catch {
        continue;
      }
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const specifier of extractImportSpecifiers(content)) {
        // Phase 4: main may import composition seam; never Infrastructure adapters.
        if (specifier.includes('infrastructure/claimEvidence')) {
          hits.push(`${rel} → ${specifier}`);
        }
      }
      if (content.includes('postura_claim_v1')) {
        hits.push(`${rel}: postura_claim_v1`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('Domain and Application have 0 localStorage hits for claim stores', () => {
    const hits: string[] = [];
    for (const dir of [DOMAIN, APP_CLAIM]) {
      for (const file of collectTsFiles(dir)) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        if (stripComments(readFileSync(file, 'utf8')).includes('localStorage')) {
          hits.push(rel);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
