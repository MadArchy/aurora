import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const MAIN = join(ROOT, 'src/main.ts');
const AI = join(ROOT, 'src/services/ai.ts');
const GATE = join(ROOT, 'src/domain/claimSafetyGateCore.ts');
const COMPOSITION = join(ROOT, 'src/composition/claimEvidence');
const UI_DIRS = [join(ROOT, 'src/components')];

function stripComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function collectTsFiles(dir: string): string[] {
  try {
    if (!statSync(dir).isDirectory()) return [];
  } catch {
    return [];
  }
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...collectTsFiles(full));
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) results.push(full);
  }
  return results;
}

function extractImports(content: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /import\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g,
    /export\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) specifiers.push(match[1]);
  }
  return specifiers;
}

describe('SPEC-006 Phase 4 — consumer architecture (T-006-407)', () => {
  it('main.ts publication paths call authorizeContentPublicationGate', () => {
    const content = readFileSync(MAIN, 'utf8');
    expect(content).toContain('authorizeContentPublicationGate');
    expect(content).toContain('saveContentWithClaimGate');
    expect(content).toContain('canonical:');
  });

  it('main.ts does not treat claimSafety.verdict === PASS as publication authority', () => {
    const withoutComments = stripComments(readFileSync(MAIN, 'utf8'));
    expect(withoutComments).not.toMatch(/claimSafety\.verdict\s*===\s*['"]PASS['"]/);
    expect(withoutComments).not.toMatch(/claimSafety\.verdict\s*===\s*['"]BLOCK['"]/);
  });

  it('main.ts does not read canonical postura_claim_* store keys', () => {
    const content = readFileSync(MAIN, 'utf8');
    expect(content).not.toContain('postura_claim_v1');
    expect(content).not.toContain('postura_claim_verification_v1');
    expect(content).not.toContain('postura_claim_history_v1');
    expect(content).not.toContain('postura_claim_link_v1');
    expect(content).not.toContain('postura_claim_evidence_v1');
  });

  it('UI components do not import LocalClaimRepository / LocalVerificationStore', () => {
    const hits: string[] = [];
    for (const dir of UI_DIRS) {
      for (const file of collectTsFiles(dir)) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        for (const specifier of extractImports(readFileSync(file, 'utf8'))) {
          if (
            specifier.includes('LocalClaimRepository') ||
            specifier.includes('LocalVerificationStore') ||
            specifier.includes('LocalClaimEvidenceStore') ||
            specifier.includes('infrastructure/claimEvidence')
          ) {
            hits.push(`${rel} → ${specifier}`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('claimSafetyGateCore requires canonical for gated targets (legacy PASS alone fails)', () => {
    const gate = readFileSync(GATE, 'utf8');
    expect(gate).toContain('canonical');
    expect(gate).toContain('AuthorizePublication');
    expect(gate).toMatch(/void claimSafety/);
  });

  it('ai.reviewDraftClaims remains advisory / non-Verification', () => {
    const ai = readFileSync(AI, 'utf8');
    expect(ai).toContain('reviewDraftClaims');
    expect(ai).toContain('COMPATIBILITY_ONLY');
    expect(ai).toContain('projectAdvisoryClaimSafety');
    expect(ai).not.toMatch(/createClaimVerification|VerifyClaim|softwareAuthority\s*=\s*true/);
  });

  it('composition exports publication gate seam without provider calls', () => {
    const gate = readFileSync(join(COMPOSITION, 'contentClaimPublicationGate.ts'), 'utf8');
    expect(gate).toContain('authorizeContentPublicationGate');
    expect(gate).toContain('composeClaimEvidence');
    expect(gate).toContain('runtime.authorize');
    expect(gate).not.toMatch(/openai|anthropic|ExecuteAiOperation/i);
  });

  it('first/index Claim authority absent from main gate path', () => {
    const withoutComments = stripComments(readFileSync(MAIN, 'utf8'));
    const gateRegion = withoutComments.slice(
      withoutComments.indexOf('authorizeContentPublicationGate'),
      withoutComments.indexOf('authorizeContentPublicationGate') + 2500
    );
    expect(gateRegion).not.toMatch(/claims\[0\]|verifications\[0\]|evidence\[0\]/);
  });
});
