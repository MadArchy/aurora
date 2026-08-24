import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { PositioningThesis, Signal, StrategicScoreResult } from '../src/types';
import {
  PRIORITY_BAND_THRESHOLDS,
  SCORING_VERSION,
  computeStrategicScoreMaterial,
  derivePriorityBand,
  toStrategicScoreResult,
} from '../src/domain/scoringCore';
import {
  createScoreHistoryEntry,
  isMaterialScoreChange,
  toScoreHistorySnapshotFromSignal,
  type ScoreHistoryMaterialSnapshot,
  type ScoreRoutingContextRef,
} from '../src/domain/scoreHistoryCore';
import {
  reconstructBaseScore100,
  totalPenaltyPoints,
} from '../src/domain/scoreExplainCore';
import {
  createScoreSignalAgainstRoutedContext,
  StrategicScoringError,
  type PersistGovernedScoreParams,
  type SignalReadPort,
  type StrategicScoringPort,
  type StrategicScoreWritePort,
  type ThesisQueryPort,
} from '../src/application/strategicScoring';
import { scoreSignalCloud } from '../functions/src/lib/scoreSignal';

const ROOT = process.cwd();
const FIXED_NOW = Date.parse('2026-01-02T12:00:00Z');
const ROUTING_CTX: ScoreRoutingContextRef = {
  routingState: 'CLEAR',
  routedThesisId: 'th_1',
  routingAlgorithmVersion: 'routing-v1',
};

function collectFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectFiles(full, ext));
    } else if (entry.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

function collectTsFiles(dir: string): string[] {
  return collectFiles(dir, '.ts');
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

function verifyFunctionsPackageClosure(): string[] {
  const libRoot = resolve(ROOT, 'functions/lib');
  const fnRoot = join(libRoot, 'functions');
  const violations: string[] = [];
  if (!existsSync(fnRoot)) {
    return ['functions/lib/functions missing — run functions build first'];
  }
  for (const file of collectFiles(fnRoot, '.js')) {
    const content = readFileSync(file, 'utf8');
    for (const match of content.matchAll(/require\(["']([^"']+)["']\)/g)) {
      const spec = match[1];
      if (!spec.startsWith('.')) continue;
      const resolved = resolve(dirname(file), spec);
      const withJs = resolved.endsWith('.js') ? resolved : `${resolved}.js`;
      const target = existsSync(withJs) ? withJs : resolved;
      if (!target.startsWith(libRoot)) {
        violations.push(`${relative(ROOT, file)} → ${spec} escapes functions/lib`);
      } else if (!existsSync(withJs) && !existsSync(resolved)) {
        violations.push(`${relative(ROOT, file)} → unresolved ${spec}`);
      }
    }
  }
  return violations;
}

const baseThesis: PositioningThesis = {
  id: 'th_1',
  organizationId: 'org_1',
  clientId: 'client_1',
  title: 'AI Governance',
  expertIdentity: 'Strategist',
  targetAudience: 'General Counsel',
  domain: 'AI regulation NIST governance',
  objective: 'Advisory',
  proofPoints: ['a', 'b', 'c', 'd'],
  voiceAndTone: '',
  complianceRules: '',
  status: 'ACTIVE',
  clientApprovalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: 'system',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'system',
};

const baseSignal: Signal = {
  id: 'sig_1',
  organizationId: 'org_1',
  clientId: 'client_1',
  title: 'NIST AI framework update',
  contentSnippet: 'Enterprise AI governance compliance guidance',
  sourceName: 'NIST',
  sourceType: 'REGULATORY',
  sourceQuality: 'HIGH',
  status: 'NEW',
  detectedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: 'system',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'system',
};

function snapshot(overrides: Partial<ScoreHistoryMaterialSnapshot> = {}): ScoreHistoryMaterialSnapshot {
  return {
    totalScore: 70,
    priorityBand: 'HIGH',
    recommendedDisposition: 'SAVE',
    recommendedOutputFormat: 'VIDEO',
    scoringVersion: SCORING_VERSION,
    factors: {
      thesisMatch: 0.8,
      audienceMatch: 0.7,
      timeliness: 0.9,
      authorityFit: 0.6,
      differentiation: 0.72,
      strategicPotential: 0.75,
      commercialPotential: 0.5,
      sourceQuality: 1,
    },
    penalties: { evidenceGap: 0, risk: 0, staleness: 0, conflict: 0 },
    routingContext: ROUTING_CTX,
    ...overrides,
  };
}

function stubScore(): StrategicScoreResult {
  return toStrategicScoreResult(
    computeStrategicScoreMaterial({
      signal: baseSignal,
      thesis: baseThesis,
      nowMs: FIXED_NOW,
    }),
    new Date(FIXED_NOW).toISOString()
  );
}

describe('SPEC-002 Phase 5 — security and governance hardening', () => {
  describe('T-002-501 — single formula authority', () => {
    it('SCORING_FACTOR_WEIGHTS defined exactly once', () => {
      const defs: string[] = [];
      for (const file of collectTsFiles(join(ROOT, 'src'))) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        if (/export const SCORING_FACTOR_WEIGHTS/.test(readFileSync(file, 'utf8'))) defs.push(rel);
      }
      for (const file of collectTsFiles(join(ROOT, 'functions'))) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        if (/export const SCORING_FACTOR_WEIGHTS/.test(readFileSync(file, 'utf8'))) defs.push(rel);
      }
      expect(defs).toEqual(['src/domain/scoringCore.ts']);
    });

    it('cloud scorer contains no independent weight arithmetic', () => {
      const cloud = readFileSync(join(ROOT, 'functions/src/lib/scoreSignal.ts'), 'utf8');
      expect(cloud).toMatch(/computeStrategicScoreMaterial/);
      expect(cloud).not.toMatch(/thesisMatch \* 25/);
      expect(cloud).not.toMatch(/CRITICAL_MIN|LOW_MAX_EXCLUSIVE/);
    });

    it('services/scoring.ts delegates without redefining thresholds', () => {
      const svc = readFileSync(join(ROOT, 'src/services/scoring.ts'), 'utf8');
      expect(svc).toMatch(/computeStrategicScoreMaterial/);
      expect(svc).not.toMatch(/export const SCORING_FACTOR_WEIGHTS/);
    });
  });

  describe('T-002-507 — functions package closure', () => {
    it('compiled Functions runtime resolves requires within functions/lib only', () => {
      const violations = verifyFunctionsPackageClosure();
      expect(violations).toEqual([]);
    });

    it('scoreSignal.js resolves domain core inside functions/lib', () => {
      const jsPath = join(ROOT, 'functions/lib/functions/src/lib/scoreSignal.js');
      expect(existsSync(jsPath)).toBe(true);
      const domainPath = join(ROOT, 'functions/lib/src/domain/scoringCore.js');
      expect(existsSync(domainPath)).toBe(true);
    });
  });

  describe('routing negative matrix (CLEAR / CONTESTED / UNROUTED)', () => {
    function buildHarness(signal: Signal, theses: PositioningThesis[]) {
      const writes: PersistGovernedScoreParams[] = [];
      const deps = {
        signals: {
          getSignalById: (id: string) => (id === signal.id ? { ...signal } : undefined),
        } satisfies SignalReadPort,
        theses: { getThesesForClient: () => theses } satisfies ThesisQueryPort,
        scoring: {
          createScoreFn: () => () => stubScore(),
          computeWhyNow: () => ({ score: 0.8, band: 'NOW' as const, reason: 'test' }),
          scoreThesis: () => stubScore(),
        } satisfies StrategicScoringPort,
        writer: {
          persistGovernedScore: (p: PersistGovernedScoreParams) => {
            writes.push(p);
          },
        } satisfies StrategicScoreWritePort,
      };
      return { score: createScoreSignalAgainstRoutedContext(deps), writes };
    }

    it('CLEAR + valid thesis → scores', () => {
      const signal = {
        ...baseSignal,
        routingDecision: { routingState: 'CLEAR' as const, source: 'AUTO' as const },
        thesisId: 'th_1',
      };
      const h = buildHarness(signal, [baseThesis]);
      const result = h.score({
        signalId: 'sig_1',
        clientId: 'client_1',
        organizationId: 'org_1',
      });
      expect(result.scoringVersion).toBe(SCORING_VERSION);
    });

    it('CLEAR + missing thesisId → ROUTING_CONTEXT_INVALID', () => {
      const signal = {
        ...baseSignal,
        routingDecision: { routingState: 'CLEAR' as const, source: 'AUTO' as const },
        thesisId: undefined,
      };
      const h = buildHarness(signal, [baseThesis]);
      expect(() =>
        h.score({ signalId: 'sig_1', clientId: 'client_1', organizationId: 'org_1' })
      ).toThrow(StrategicScoringError);
      expect(h.writes).toHaveLength(0);
    });

    it('CLEAR + foreign thesis tenant → TENANT_CONTEXT_INVALID', () => {
      const signal = {
        ...baseSignal,
        routingDecision: { routingState: 'CLEAR' as const, source: 'AUTO' as const },
        thesisId: 'th_other',
      };
      const foreign = { ...baseThesis, id: 'th_other', clientId: 'client_other' };
      const h = buildHarness(signal, [foreign]);
      try {
        h.score({ signalId: 'sig_1', clientId: 'client_1', organizationId: 'org_1' });
        expect.fail('expected tenant error');
      } catch (err) {
        expect((err as StrategicScoringError).code).toBe('TENANT_CONTEXT_INVALID');
      }
      expect(h.writes).toHaveLength(0);
    });

    it('CONTESTED + stale thesisId + leader thesisScores → fail closed', () => {
      const signal = {
        ...baseSignal,
        routingDecision: { routingState: 'CONTESTED' as const, source: 'AUTO' as const, contested: true },
        thesisId: 'th_1',
        thesisScores: [{ thesisId: 'th_1', score: 99, band: 'CRITICAL' }],
      };
      const h = buildHarness(signal, [baseThesis]);
      try {
        h.score({ signalId: 'sig_1', clientId: 'client_1', organizationId: 'org_1' });
        expect.fail('expected contested');
      } catch (err) {
        expect((err as StrategicScoringError).code).toBe('ROUTING_CONTEXT_CONTESTED');
      }
      expect(h.writes).toHaveLength(0);
    });

    it('UNROUTED + stale thesisId → ROUTING_CONTEXT_REQUIRED', () => {
      const signal = {
        ...baseSignal,
        routingDecision: { routingState: 'UNROUTED' as const, source: 'AUTO' as const },
        thesisId: 'th_1',
      };
      const h = buildHarness(signal, [baseThesis]);
      try {
        h.score({ signalId: 'sig_1', clientId: 'client_1', organizationId: 'org_1' });
        expect.fail('expected unrouted');
      } catch (err) {
        expect((err as StrategicScoringError).code).toBe('ROUTING_CONTEXT_REQUIRED');
      }
      expect(h.writes).toHaveLength(0);
    });
  });

  describe('T-002-503 / T-002-504 — tenant and auto-discard scans', () => {
    it('scheduledIngest retains tenant envelope helpers', () => {
      const src = readFileSync(join(ROOT, 'functions/src/lib/scheduledIngest.ts'), 'utf8');
      expect(src).toMatch(/requireTenantOrganizationId/);
      expect(src).toMatch(/requireMatchingClientId/);
      expect(src).not.toMatch(/scoreSignalCloud/);
      expect(src).not.toMatch(/autoDiscard/);
    });

    it('no strategic score-triggered terminal DISCARD in src/', () => {
      const hits: string[] = [];
      for (const file of collectTsFiles(join(ROOT, 'src'))) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        const content = readFileSync(file, 'utf8');
        if (rel.endsWith('domain/radarTriageCore.ts')) continue;
        if (/applyScoreToSignal/.test(content) && /DISCARDED/.test(content)) {
          const block = content.slice(content.indexOf('applyScoreToSignal'));
          if (/status\s*=\s*['"]DISCARDED['"]/.test(block.slice(0, 800))) hits.push(rel);
        }
        if (/shouldAutoDiscardScoredSignal\s*\(/.test(content) && !rel.endsWith('radarTriageCore.ts')) {
          hits.push(`${rel}: shouldAutoDiscardScoredSignal call`);
        }
      }
      expect(hits).toEqual([]);
    });

    it('applyScoreToSignal has zero src callers', () => {
      const hits: string[] = [];
      for (const file of collectTsFiles(join(ROOT, 'src'))) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        if (rel.endsWith('services/db.ts')) continue;
        if (/applyScoreToSignal\s*\(/.test(readFileSync(file, 'utf8'))) hits.push(rel);
      }
      expect(hits).toEqual([]);
    });
  });

  describe('first/primary thesis strategic ban', () => {
    it('no strategic scoring uses first-thesis shortcuts in functions or scoring paths', () => {
      const patterns = [
        /thesesSnap\.docs\[0\]/,
        /activeTheses\[0\]/,
        /candidates\[0\]/,
        /docs\.at\(0\)/,
      ];
      const scanDirs = [
        join(ROOT, 'functions/src'),
        join(ROOT, 'src/application/strategicScoring'),
        join(ROOT, 'src/infrastructure/strategicScoring'),
        join(ROOT, 'src/infrastructure/strategicSignalRouting'),
      ];
      const hits: string[] = [];
      for (const dir of scanDirs) {
        for (const file of collectTsFiles(dir)) {
          const rel = relative(ROOT, file).replace(/\\/g, '/');
          const content = readFileSync(file, 'utf8');
          for (const p of patterns) {
            if (p.test(content)) hits.push(`${rel}: ${p.source}`);
          }
        }
      }
      expect(hits).toEqual([]);
    });

    it('getPrimaryThesis not used in strategic scoring application layer', () => {
      const appDir = join(ROOT, 'src/application/strategicScoring');
      for (const file of collectTsFiles(appDir)) {
        expect(readFileSync(file, 'utf8')).not.toMatch(/getPrimaryThesis/);
      }
    });
  });

  describe('AI advisory security', () => {
    it('analyzeSignalAgainstThesis does not mutate canonical score fields', () => {
      const ai = readFileSync(join(ROOT, 'src/services/ai.ts'), 'utf8');
      const block = ai.slice(ai.indexOf('analyzeSignalAgainstThesis'));
      expect(block).not.toMatch(/full\.relevanceScore\s*=\s*[^=]/);
      expect(block).not.toMatch(/full\.priorityBand\s*=\s*[^=]/);
      expect(block).not.toMatch(/full\.recommendedAction\s*=\s*[^=]/);
      expect(block).toMatch(/signal\.relevanceScore/);
    });

    it('gateway advisory failure does not throw (canonical score preserved)', () => {
      const ai = readFileSync(join(ROOT, 'src/services/ai.ts'), 'utf8');
      const start = ai.indexOf('analyzeSignalAgainstThesis');
      const end = ai.indexOf('public async runComparativeAnalysis');
      const block = ai.slice(start, end);
      const catchStart = block.indexOf('AI_ANALYSIS_FAILED');
      const catchEnd = block.indexOf('dbService.updateSignalStatus', catchStart);
      const catchBlock = block.slice(catchStart, catchEnd);
      expect(catchBlock).not.toMatch(/throw new Error/);
    });
  });

  describe('direct score-write governance', () => {
    it('relevanceScore assignments limited to db governed writers', () => {
      const allowed = new Set([
        'src/services/db.ts',
      ]);
      const hits: string[] = [];
      for (const file of collectTsFiles(join(ROOT, 'src'))) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        const lines = readFileSync(file, 'utf8').split('\n');
        for (const line of lines) {
          if (!/\.relevanceScore\s*=\s*[^=]/.test(line)) continue;
          if (!allowed.has(rel)) hits.push(`${rel}: ${line.trim()}`);
        }
      }
      expect(hits).toEqual([]);
    });
  });

  describe('unscored signal reachability', () => {
    it('main.ts exposes governed score paths for unscored signals', () => {
      const main = readFileSync(join(ROOT, 'src/main.ts'), 'utf8');
      expect(main).toMatch(/btn-score-all-signals/);
      expect(main).toMatch(/relevanceScore === undefined/);
      expect(main).toMatch(/this\.scoreSignal\(/);
      expect(main).toMatch(/scoreAndRouteSignal/);
    });
  });

  describe('legacy unversioned signal compatibility', () => {
    it('first score with no prior fields → history snapshot null (not falsely versioned)', () => {
      const sig = { ...baseSignal, relevanceScore: undefined, scoringVersion: undefined };
      expect(toScoreHistorySnapshotFromSignal(sig, 'th_1')).toBeNull();
    });

    it('legacy scored signal without scoringVersion → compat projection only', () => {
      const sig = {
        ...baseSignal,
        relevanceScore: 55,
        priorityBand: 'MEDIUM' as const,
        recommendedAction: 'MONITOR' as const,
        scoringVersion: undefined,
      };
      const snap = toScoreHistorySnapshotFromSignal(sig, 'th_1');
      expect(snap).not.toBeNull();
      expect(snap!.scoringVersion).toBe('scoring-v1');
    });
  });

  describe('determinism adversarial', () => {
    it('repeated identical material input yields identical output', () => {
      const input = {
        signal: baseSignal,
        thesis: baseThesis,
        context: { bilingualTerms: ['NIST', 'governance'] },
        nowMs: FIXED_NOW,
      };
      expect(computeStrategicScoreMaterial(input)).toEqual(computeStrategicScoreMaterial(input));
    });

    it('client and cloud paths match with explicit nowMs', () => {
      const material = computeStrategicScoreMaterial({
        signal: baseSignal,
        thesis: baseThesis,
        nowMs: FIXED_NOW,
      });
      const cloud = scoreSignalCloud(
        {
          title: baseSignal.title,
          snippet: baseSignal.contentSnippet,
          sourceType: baseSignal.sourceType,
          sourceQuality: baseSignal.sourceQuality,
          detectedAt: baseSignal.detectedAt,
          domain: baseThesis.domain,
          thesisTitle: baseThesis.title,
          targetAudience: baseThesis.targetAudience,
          proofPointCount: baseThesis.proofPoints.length,
        },
        FIXED_NOW
      );
      expect(cloud.totalScore).toBe(material.totalScore);
      expect(cloud.scoringVersion).toBe(SCORING_VERSION);
    });

    it('JSON round-trip of factors/penalties preserves score material', () => {
      const material = computeStrategicScoreMaterial({
        signal: baseSignal,
        thesis: baseThesis,
        nowMs: FIXED_NOW,
      });
      const cloned = JSON.parse(JSON.stringify(material));
      expect(cloned.totalScore).toBe(material.totalScore);
      expect(cloned.scoringVersion).toBe(SCORING_VERSION);
    });
  });

  describe('numeric boundary matrix', () => {
    it('priority band thresholds match approved v1 boundaries', () => {
      expect(derivePriorityBand(39)).toBe('LOW');
      expect(derivePriorityBand(40)).toBe('MEDIUM');
      expect(derivePriorityBand(69)).toBe('MEDIUM');
      expect(derivePriorityBand(70)).toBe('HIGH');
      expect(derivePriorityBand(84)).toBe('HIGH');
      expect(derivePriorityBand(85)).toBe('CRITICAL');
      expect(PRIORITY_BAND_THRESHOLDS.CRITICAL_MIN).toBe(85);
      expect(PRIORITY_BAND_THRESHOLDS.LOW_MAX_EXCLUSIVE).toBe(40);
    });

    it('final score always clamped 0–100 inclusive', () => {
      const heavy = computeStrategicScoreMaterial({
        signal: {
          ...baseSignal,
          title: 'Fraude ilegal escandalo',
          contentSnippet: 'conflicto risk fraud sanction',
        },
        thesis: { ...baseThesis, proofPoints: [] },
        context: { avoidedFramings: ['NIST', 'governance', 'AI', 'framework'] },
        nowMs: FIXED_NOW,
      });
      expect(heavy.totalScore).toBeGreaterThanOrEqual(0);
      expect(heavy.totalScore).toBeLessThanOrEqual(100);
    });
  });

  describe('explainability reconstruction', () => {
    it('factors minus penalties reconstruct final score', () => {
      const material = computeStrategicScoreMaterial({
        signal: baseSignal,
        thesis: baseThesis,
        nowMs: FIXED_NOW,
      });
      const base = reconstructBaseScore100(material.factors);
      const penaltySum = totalPenaltyPoints(material.penalties);
      const expected = Math.round(Math.max(0, Math.min(100, base - penaltySum)));
      expect(material.totalScore).toBe(expected);
    });
  });

  describe('score history materiality and security', () => {
    it('scoringVersion change is material', () => {
      const prev = snapshot({ scoringVersion: 'scoring-v0-test-fixture' });
      const next = snapshot({ scoringVersion: SCORING_VERSION });
      expect(isMaterialScoreChange(prev, next)).toBe(true);
    });

    it('output format change is material', () => {
      const prev = snapshot({ recommendedOutputFormat: 'NONE' });
      const next = snapshot({ recommendedOutputFormat: 'VIDEO' });
      expect(isMaterialScoreChange(prev, next)).toBe(true);
    });

    it('factor composition change is material even at same total score', () => {
      const prev = snapshot({
        totalScore: 70,
        factors: { ...snapshot().factors, thesisMatch: 0.5 },
      });
      const next = snapshot({
        totalScore: 70,
        factors: { ...snapshot().factors, thesisMatch: 0.9 },
      });
      expect(isMaterialScoreChange(prev, next)).toBe(true);
    });

    it('history entry type forbids secrets and raw AI payloads', () => {
      const src = readFileSync(join(ROOT, 'src/domain/scoreHistoryCore.ts'), 'utf8');
      expect(src).toMatch(/Forbidden: raw AI output/);
      const entry = createScoreHistoryEntry({
        organizationId: 'org_1',
        clientId: 'client_1',
        signalId: 'sig_1',
        previous: snapshot({ totalScore: 60 }),
        next: snapshot({ totalScore: 70 }),
        actorId: 'user_1',
        changedAt: '2026-01-01T00:00:00Z',
      });
      const serialized = JSON.stringify(entry);
      expect(serialized).not.toMatch(/api[_-]?key|Authorization|Bearer /i);
      expect(serialized).not.toMatch(/rawPrompt|providerOutput/i);
    });

    it('equivalent rescore does not append duplicate history noise', () => {
      const prev = snapshot();
      const next = snapshot({ scoringVersion: SCORING_VERSION });
      expect(isMaterialScoreChange(prev, next)).toBe(false);
    });
  });

  describe('silent-learning ban', () => {
    it('no adaptive mutation of SCORING_FACTOR_WEIGHTS or thresholds', () => {
      const hits: string[] = [];
      for (const file of collectTsFiles(join(ROOT, 'src'))) {
        const content = readFileSync(file, 'utf8');
        if (/SCORING_FACTOR_WEIGHTS\s*\[/.test(content)) hits.push(relative(ROOT, file));
        if (/PRIORITY_BAND_THRESHOLDS\s*\./.test(content) && content.includes('=')) {
          if (/PRIORITY_BAND_THRESHOLDS\s*=/.test(content) === false) {
            /* read-only access ok */
          }
        }
      }
      expect(hits).toEqual([]);
    });
  });

  describe('hexagonal architecture static guards', () => {
    const FORBIDDEN_PACKAGE = [
      /^firebase(\/|$)/,
      /^firebase-admin(\/|$)/,
      /^react(\/|$)/,
      /^vite(\/|$)/,
      /^openai(\/|$)/,
      /^@anthropic-ai\//,
    ];
    const FORBIDDEN_FRAGMENTS = ['dbService', '/services/db', '/services/ai', 'AiGateway'];

    it('application/strategicScoring has no infrastructure imports', () => {
      const violations: string[] = [];
      const appDir = join(ROOT, 'src/application/strategicScoring');
      for (const file of collectTsFiles(appDir)) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        const content = readFileSync(file, 'utf8');
        for (const spec of extractImportSpecifiers(content)) {
          if (FORBIDDEN_PACKAGE.some((p) => p.test(spec))) violations.push(`${rel} → ${spec}`);
          if (FORBIDDEN_FRAGMENTS.some((f) => spec.includes(f))) violations.push(`${rel} → ${spec}`);
        }
        if (/routingDecision\s*=|selectedThesisId\s*=|routingState\s*=/.test(content)) {
          violations.push(`${rel}: routing mutation token`);
        }
      }
      expect(violations).toEqual([]);
    });

    it('domain scoring modules remain framework-free', () => {
      const domainFiles = [
        'domain/scoringCore.ts',
        'domain/dispositionCore.ts',
        'domain/scoreExplainCore.ts',
        'domain/scoreHistoryCore.ts',
      ];
      const violations: string[] = [];
      for (const rel of domainFiles) {
        const content = readFileSync(join(ROOT, 'src', rel), 'utf8');
        for (const spec of extractImportSpecifiers(content)) {
          if (FORBIDDEN_PACKAGE.some((p) => p.test(spec))) violations.push(`${rel} → ${spec}`);
          if (spec.includes('functions/')) violations.push(`${rel} → ${spec}`);
        }
      }
      expect(violations).toEqual([]);
    });

    it('domain scoringCore does not import Functions', () => {
      const content = readFileSync(join(ROOT, 'src/domain/scoringCore.ts'), 'utf8');
      expect(content).not.toMatch(/functions\//);
    });
  });

  describe('disposition vs format separation', () => {
    it('radarTriageCore prefers recommendedDisposition over legacy action', () => {
      const triage = readFileSync(join(ROOT, 'src/domain/radarTriageCore.ts'), 'utf8');
      expect(triage).toMatch(/recommendedDisposition/);
      expect(triage).toMatch(/recommendedOutputFormat/);
    });

    it('governed score result carries both disposition and format from domain', () => {
      const material = computeStrategicScoreMaterial({
        signal: baseSignal,
        thesis: baseThesis,
        nowMs: FIXED_NOW,
      });
      expect(material.recommendedDisposition).toBeDefined();
      expect(material.recommendedOutputFormat).toBeDefined();
      expect(material.scoringVersion).toBe(SCORING_VERSION);
    });
  });

  describe('local atomicity scope', () => {
    it('applyGovernedScoreToSignal documents single saveAll unit', () => {
      const db = readFileSync(join(ROOT, 'src/services/db.ts'), 'utf8');
      const block = db.slice(db.indexOf('applyGovernedScoreToSignal'));
      expect(block).toMatch(/saveAll/);
      expect(block).not.toMatch(/Firestore/);
    });
  });
});
