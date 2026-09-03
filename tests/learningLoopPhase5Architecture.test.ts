/**
 * SPEC-008 Phase 5 — Security architecture purity + regression attacks (T-008-510).
 *
 * Covers the static half of the formal threat matrix:
 *   T-008-04 (actor fallback), T-008-05 (UI direct write), T-008-09 (hints),
 *   T-008-10 (auto rescore), T-008-11/12/13 (cross-SPEC theft),
 *   T-008-24 (direct provider), T-008-25 (first-thesis), T-008-26 (003/004/006).
 *
 * Static evidence complements — never replaces — the runtime suite in
 * tests/learningLoopPhase5Security.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

const LEARNING_TREES = [
  'src/domain',
  'src/application/learningLoop',
  'src/infrastructure/learningLoop',
  'src/composition/learningLoop',
];

const CANONICAL_RUNTIME = [
  'src/application/learningLoop',
  'src/infrastructure/learningLoop',
  'src/composition/learningLoop',
  'src/services/learningLoopConsumer.ts',
];

function collectTsFiles(dir: string): string[] {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return [];
  if (statSync(full).isFile()) return [full];
  const results: string[] = [];
  for (const entry of readdirSync(full)) {
    const child = join(dir, entry);
    if (statSync(join(ROOT, child)).isDirectory()) {
      results.push(...collectTsFiles(child));
    } else if (entry.endsWith('.ts')) {
      results.push(join(ROOT, child));
    }
  }
  return results;
}

function learningDomainFiles(): string[] {
  return collectTsFiles('src/domain').filter((f) => {
    const base = relative(ROOT, f).replace(/\\/g, '/');
    return (
      base.includes('/learning') ||
      base.includes('/strategicRecommendation') ||
      base.includes('/recommendationLifecycle') ||
      base.includes('/recommendationDecision')
    );
  });
}

function canonicalRuntimeFiles(): string[] {
  return CANONICAL_RUNTIME.flatMap(collectTsFiles);
}

function read(file: string): string {
  return readFileSync(file, 'utf8');
}

function stripComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
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

function rel(file: string): string {
  return relative(ROOT, file).replace(/\\/g, '/');
}

// ============================================================
// Layer purity (section 47)
// ============================================================

describe('T-008-510 — layer purity', () => {
  it('Learning Domain imports neither Application, Infrastructure, UI nor persistence', () => {
    const offenders: string[] = [];
    for (const file of learningDomainFiles()) {
      for (const specifier of extractImportSpecifiers(read(file))) {
        if (
          specifier.includes('/application/') ||
          specifier.includes('/infrastructure/') ||
          specifier.includes('/composition/') ||
          specifier.includes('/components/') ||
          specifier.includes('/services/') ||
          specifier.includes('firebase')
        ) {
          offenders.push(`${rel(file)} → ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('Learning Application imports no Infrastructure, dbService, UI or composition', () => {
    const offenders: string[] = [];
    for (const file of collectTsFiles('src/application/learningLoop')) {
      for (const specifier of extractImportSpecifiers(read(file))) {
        if (
          specifier.includes('/infrastructure/') ||
          specifier.includes('/composition/') ||
          specifier.includes('/components/') ||
          specifier.includes('/services/') ||
          specifier.includes('main.ts')
        ) {
          offenders.push(`${rel(file)} → ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('Learning Application never touches localStorage or a concrete store', () => {
    for (const file of collectTsFiles('src/application/learningLoop')) {
      const body = stripComments(read(file));
      expect(body, rel(file)).not.toMatch(/localStorage/);
      expect(body, rel(file)).not.toMatch(/dbService/);
      expect(body, rel(file)).not.toMatch(/LocalLearningLoopStore/);
    }
  });

  it('UI components never import canonical Learning repositories or the store', () => {
    const offenders: string[] = [];
    for (const file of collectTsFiles('src/components')) {
      for (const specifier of extractImportSpecifiers(read(file))) {
        if (
          specifier.includes('infrastructure/learningLoop') ||
          specifier.includes('application/learningLoop') ||
          specifier.includes('composition/learningLoop')
        ) {
          offenders.push(`${rel(file)} → ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('main.ts reaches the Learning Loop only through the consumer facade', () => {
    const main = readLegacyControllerSurface();
    for (const specifier of extractImportSpecifiers(main)) {
      expect(specifier).not.toMatch(/infrastructure\/learningLoop/);
      expect(specifier).not.toMatch(/application\/learningLoop/);
      expect(specifier).not.toMatch(/composition\/learningLoop/);
    }
    expect(main).toMatch(/learningLoopConsumer/);
  });
});

// ============================================================
// T-008-24 · Direct provider bypass
// ============================================================

describe('T-008-24 — zero direct AI provider calls in the Learning Loop', () => {
  it('no provider SDK imports and no raw fetch in the canonical learning runtime', () => {
    const offenders: string[] = [];
    for (const file of [...learningDomainFiles(), ...canonicalRuntimeFiles()]) {
      const body = stripComments(read(file));
      for (const specifier of extractImportSpecifiers(read(file))) {
        if (
          /^openai(\/|$)/.test(specifier) ||
          /^@anthropic-ai\//.test(specifier) ||
          /^@google\//.test(specifier) ||
          /^firebase(-admin)?(\/|$)/.test(specifier)
        ) {
          offenders.push(`${rel(file)} → ${specifier}`);
        }
      }
      if (/\bfetch\s*\(/.test(body)) offenders.push(`${rel(file)} → fetch(`);
      if (/api\.openai\.com|api\.anthropic\.com/.test(body)) {
        offenders.push(`${rel(file)} → provider endpoint`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ============================================================
// T-008-09 · feedbackScoringHints regression
// ============================================================

describe('T-008-09 — feedbackScoringHints has zero strategic authority', () => {
  const HINTS = 'feedbackScoringHints';

  it('the only src occurrence is its own dead definition — zero call sites', () => {
    const callers: string[] = [];
    for (const file of collectTsFiles('src')) {
      const body = stripComments(read(file));
      if (!body.includes(HINTS)) continue;
      const path = rel(file);
      // The declaring module is DEAD (definition only, no src consumer).
      if (path === 'src/domain/radarFeedbackCore.ts') {
        expect(body).toMatch(new RegExp(`export function ${HINTS}`));
        continue;
      }
      callers.push(path);
    }
    expect(callers).toEqual([]);
  });

  it('scoring/routing context builders contain no hints and no learning imports', () => {
    const paths = [
      'src/infrastructure/strategicSignalRouting/DbStrategicSignalRoutingAdapter.ts',
      'src/ui/legacy/LegacyApp.ts',
    ];
    for (const path of paths) {
      const body = stripComments(read(join(ROOT, path)));
      expect(body, path).not.toMatch(new RegExp(HINTS));
    }
  });

  it('no canonical learning runtime file imports the radar feedback module', () => {
    for (const file of canonicalRuntimeFiles()) {
      for (const specifier of extractImportSpecifiers(read(file))) {
        expect(specifier, rel(file)).not.toMatch(/radarFeedbackCore/);
      }
    }
  });
});

// ============================================================
// T-008-10 / T-008-23 · Auto-rescore regression
// ============================================================

describe('T-008-10 / T-008-23 — learning never triggers scoring or routing', () => {
  it('canonical learning runtime has zero rescore / scoreSignal call sites', () => {
    const offenders: string[] = [];
    for (const file of [...learningDomainFiles(), ...canonicalRuntimeFiles()]) {
      const body = stripComments(read(file));
      for (const pattern of [
        /\brescoreAll\b/,
        /\bscoreSignals\s*\(/,
        /\bscoreSignal\s*\(/,
        /\brecomputeRouting\s*\(/,
        /\bscoreAndRouteSignal\s*\(/,
      ]) {
        if (pattern.test(body)) offenders.push(`${rel(file)} → ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the outcome handler in main.ts contains no rescore loop or hard-coded actor', () => {
    const main = readLegacyControllerSurface();
    const start = main.indexOf("document.querySelectorAll('.btn-signal-outcome')");
    expect(start).toBeGreaterThan(-1);
    const end = main.indexOf("document.querySelectorAll('.btn-send-to-curation')", start);
    const block = main.slice(start, end > start ? end : start + 4000);
    expect(block).not.toMatch(/rescore/i);
    expect(block).not.toMatch(/scoreSignal/);
    expect(block).not.toMatch(/user_admin_01/);
    expect(block).toMatch(/registerSignalOutcomeIntent/);
  });

  it('the consumer facade never imports scoring or routing composition', () => {
    const consumer = read(join(ROOT, 'src/services/learningLoopConsumer.ts'));
    for (const specifier of extractImportSpecifiers(consumer)) {
      expect(specifier).not.toMatch(/strategicScoring/);
      expect(specifier).not.toMatch(/strategicSignalRouting/);
    }
  });
});

// ============================================================
// T-008-11 / T-008-12 / T-008-13 / T-008-26 · Cross-SPEC theft
// ============================================================

describe('T-008-11…13 / T-008-26 — zero direct target-SPEC mutation', () => {
  it('canonical learning runtime never imports another SPEC write/composition path', () => {
    const FORBIDDEN = [
      'application/strategicScoring',
      'application/strategicSignalRouting',
      'application/opportunityScout',
      'application/strategicBrief',
      'application/contentPlan',
      'application/claimEvidence',
      'composition/strategicScoring',
      'composition/strategicSignalRouting',
      'composition/opportunityScout',
      'composition/strategicBrief',
      'composition/claimEvidence',
      'infrastructure/strategicScoring',
      'infrastructure/strategicSignalRouting',
      'infrastructure/strategicBrief',
      'infrastructure/claimEvidence',
    ];
    const offenders: string[] = [];
    for (const file of [
      ...collectTsFiles('src/application/learningLoop'),
      ...collectTsFiles('src/infrastructure/learningLoop'),
      ...collectTsFiles('src/composition/learningLoop'),
    ]) {
      for (const specifier of extractImportSpecifiers(read(file))) {
        if (FORBIDDEN.some((f) => specifier.includes(f))) {
          offenders.push(`${rel(file)} → ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('learning runtime never invokes foreign strategic mutators', () => {
    const FORBIDDEN_CALLS = [
      /\bsetRoutingDecision\s*\(/,
      /\bselectedThesisId\s*=/,
      /\bwriteStrategicScore\s*\(/,
      /\bmaterializeOpportunity\s*\(/,
      /\bacceptOpportunity\s*\(/,
      /\bapproveStrategicBrief\s*\(/,
      /\bauthorizePublication\s*\(/,
      /\bverifyClaim\s*\(/,
    ];
    const offenders: string[] = [];
    for (const file of [...learningDomainFiles(), ...canonicalRuntimeFiles()]) {
      const body = stripComments(read(file));
      for (const pattern of FORBIDDEN_CALLS) {
        if (pattern.test(body)) offenders.push(`${rel(file)} → ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the SPEC-007 Opportunity reader exposes read-only projection methods only', () => {
    const reader = read(
      join(ROOT, 'src/infrastructure/learningLoop/LocalOpportunityOutcomeReader.ts')
    );
    const body = stripComments(reader);
    expect(body).toMatch(/getOutcome/);
    expect(body).toMatch(/listOutcomes/);
    // No Opportunity lifecycle mutation of any kind.
    for (const pattern of [
      /\.setStatus\s*\(/,
      /\bcommitWriteUnit\s*\(/,
      /\bsaveOpportunity\s*\(/,
      /\bupdateOpportunity\s*\(/,
      /status\s*=\s*['"]/,
    ]) {
      expect(body, 'opportunity reader must not mutate').not.toMatch(pattern);
    }
  });

  it('target-SPEC apply is reachable only through TargetSpecApplyPort', () => {
    const apply = read(
      join(ROOT, 'src/application/learningLoop/ApplyApprovedRecommendation.ts')
    );
    const body = stripComments(apply);
    expect(body).toMatch(/targetApplyRegistry\.resolve/);
    expect(body).toMatch(/port\.apply\(/);
    // Exactly one dispatch site.
    expect(body.match(/port\.apply\(/g) ?? []).toHaveLength(1);
  });
});

// ============================================================
// T-008-04 · Hard-coded actor fallback
// ============================================================

describe('T-008-04 — zero authoritative actor fallbacks', () => {
  it('no hard-coded actor identity in the canonical learning runtime', () => {
    const offenders: string[] = [];
    for (const file of [...learningDomainFiles(), ...canonicalRuntimeFiles()]) {
      const body = stripComments(read(file));
      for (const pattern of [
        /user_admin_01/,
        /actorId\s*[:=]\s*['"](?:admin|client|manager|anonymous|system)['"]/,
        /createdBy\s*[:=]\s*['"](?:admin|client|manager|anonymous)['"]/,
        /approvedBy\s*[:=]\s*['"][^'"]+['"]/,
      ]) {
        if (pattern.test(body)) offenders.push(`${rel(file)} → ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the consumer derives its actor from the trusted session, not from a literal', () => {
    const consumer = read(join(ROOT, 'src/services/learningLoopConsumer.ts'));
    const body = stripComments(consumer);
    expect(body).toMatch(/buildTrustedLearningContext/);
    expect(body).not.toMatch(/user_admin_01/);
    expect(body).toMatch(/authService|currentUser|session/i);
  });
});

// ============================================================
// T-008-25 · First / primary thesis fallback
// ============================================================

describe('T-008-25 — zero first/primary thesis authority', () => {
  it('no theses[0] / primaryThesisId / sort-winner patterns in learning runtime', () => {
    const offenders: string[] = [];
    for (const file of [...learningDomainFiles(), ...canonicalRuntimeFiles()]) {
      const body = stripComments(read(file));
      for (const pattern of [
        /theses\s*\[\s*0\s*\]/,
        /thesisIds\s*\[\s*0\s*\]/,
        /primaryThesisId/,
        /\.sort\([^)]*\)\s*\[\s*0\s*\]/,
      ]) {
        if (pattern.test(body)) offenders.push(`${rel(file)} → ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('thesis scope is an explicit discriminated union with no default branch', () => {
    const scope = read(join(ROOT, 'src/domain/learningThesisScopeCore.ts'));
    expect(scope).toMatch(/SINGLE/);
    expect(scope).toMatch(/MULTI/);
    expect(scope).toMatch(/CLIENT_WIDE/);
  });
});

// ============================================================
// T-008-05 / consumer bypass (section 35)
// ============================================================

describe('T-008-05 / consumer bypass — facade orchestrates, never decides', () => {
  it('the consumer delegates to the composition root and holds no lifecycle logic', () => {
    const consumer = read(join(ROOT, 'src/services/learningLoopConsumer.ts'));
    const body = stripComments(consumer);
    expect(body).toMatch(/composeLearningLoop|buildUseCases/);
    // No lifecycle status decisions inside the facade.
    for (const pattern of [
      /status\s*=\s*['"]APPROVED['"]/,
      /status\s*=\s*['"]APPLIED['"]/,
      /status\s*=\s*['"]REJECTED['"]/,
      // assignment only — `=== 'ACTIVE'` read filters are display projections
      /\.status\s*=[^=]/,
    ]) {
      expect(body, 'consumer must not assign lifecycle status').not.toMatch(pattern);
    }
    // The only status usages are equality reads for display projection.
    expect(body).toMatch(/status === 'ACTIVE'/);
  });

  it('the consumer never writes canonical stores directly', () => {
    const body = stripComments(read(join(ROOT, 'src/services/learningLoopConsumer.ts')));
    expect(body).not.toMatch(/localStorage\.setItem/);
    expect(body).not.toMatch(/commitWriteUnit\s*\(/);
    expect(body).not.toMatch(/appendHistory\s*\(/);
    expect(body).not.toMatch(/appendDecision\s*\(/);
  });

  it('legacy dbService learning mutators are demoted at the source', () => {
    const db = read(join(ROOT, 'src/services/db.ts'));
    expect(db).toMatch(/LEGACY_AUTHORITY_REMOVED/);
    expect(db).toMatch(/mirrorSignalOutcomeCompatibility/);
    expect(db).toMatch(/mirrorResultRecordCompatibility/);
  });
});
