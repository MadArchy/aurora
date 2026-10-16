import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import type { PositioningThesis, Signal } from '../src/types';
import {
  SCORING_FACTOR_WEIGHTS,
  SCORING_VERSION,
  computeStrategicScoreMaterial,
  toStrategicScoreResult,
} from '../src/domain/scoringCore';
import { calculateStrategicScore } from '../src/services/scoring';
import { scoreSignalCloud } from '../functions/src/lib/scoreSignal';

const ROOT = process.cwd();
const FIXED_NOW = Date.parse('2026-01-02T12:00:00Z');

const parityThesis: PositioningThesis = {
  id: 'th_parity',
  organizationId: 'org_1',
  clientId: 'client_1',
  title: 'AI Governance Authority',
  expertIdentity: 'AI Governance Authority',
  targetAudience: 'General Counsel and CIOs',
  domain: 'AI regulation NIST EU AI Act',
  objective: '',
  proofPoints: ['p1', 'p2', 'p3', 'p4'],
  voiceAndTone: '',
  complianceRules: '',
  status: 'ACTIVE',
  clientApprovalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: 'system',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'system',
};

const paritySignal: Signal = {
  id: 'sig_parity',
  organizationId: 'org_1',
  clientId: 'client_1',
  title: 'NIST releases updated AI risk management framework',
  contentSnippet: 'Compliance guidance for enterprise AI governance programs',
  sourceName: 'NIST',
  sourceUrl: 'https://nist.gov/example',
  sourceType: 'REGULATORY',
  sourceQuality: 'HIGH',
  status: 'NEW',
  detectedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: 'system',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'system',
};

const SCORING_WEIGHTS_DEFINITION = /export const SCORING_FACTOR_WEIGHTS/;
const SKIPPED_SOURCE_DIR_NAMES = new Set(['node_modules', 'dist', 'build', 'coverage']);

function isSkippedSourceDirectory(parentDir: string, entry: string): boolean {
  if (SKIPPED_SOURCE_DIR_NAMES.has(entry)) return true;
  // Compiled Functions output only. src/lib and functions/src/lib stay in the scan.
  if (entry !== 'lib') return false;
  return parentDir.replace(/\\/g, '/').endsWith('/functions');
}

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (isSkippedSourceDirectory(dir, entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

function duplicateScoringWeightPaths(scanRoot: string): string[] {
  const hits: string[] = [];
  for (const file of collectTsFiles(join(scanRoot, 'src'))) {
    const rel = relative(scanRoot, file).replace(/\\/g, '/');
    if (SCORING_WEIGHTS_DEFINITION.test(readFileSync(file, 'utf8')) && !rel.endsWith('domain/scoringCore.ts')) {
      hits.push(rel);
    }
  }
  for (const file of collectTsFiles(join(scanRoot, 'functions'))) {
    const rel = relative(scanRoot, file).replace(/\\/g, '/');
    if (SCORING_WEIGHTS_DEFINITION.test(readFileSync(file, 'utf8'))) hits.push(rel);
  }
  return hits;
}

function writeSourceFixture(root: string, relPath: string, content: string): void {
  const full = join(root, ...relPath.split('/'));
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
}

describe('SPEC-002 Phase 4 — consumer migration', () => {
  it('cloud and client paths produce identical canonical score material (explicit nowMs)', () => {
    const context = { bilingualTerms: ['NIST', 'gobernanza de IA'] };

    const clientMaterial = computeStrategicScoreMaterial({
      signal: paritySignal,
      thesis: parityThesis,
      context,
      nowMs: FIXED_NOW,
    });
    const clientResult = toStrategicScoreResult(clientMaterial, new Date(FIXED_NOW).toISOString());

    const cloudResult = scoreSignalCloud(
      {
        title: paritySignal.title,
        snippet: paritySignal.contentSnippet,
        sourceType: paritySignal.sourceType,
        sourceQuality: paritySignal.sourceQuality,
        detectedAt: paritySignal.detectedAt,
        domain: parityThesis.domain,
        thesisTitle: parityThesis.title,
        targetAudience: parityThesis.targetAudience,
        proofPointCount: parityThesis.proofPoints.length,
        bilingualTerms: context.bilingualTerms,
      },
      FIXED_NOW
    );

    expect(cloudResult.totalScore).toBe(clientResult.totalScore);
    expect(cloudResult.priorityBand).toBe(clientResult.priorityBand);
    expect(cloudResult.factors).toEqual(clientResult.factors);
    expect(cloudResult.penalties).toEqual(clientResult.penalties);
    expect(cloudResult.scoringVersion).toBe(SCORING_VERSION);
    expect(cloudResult.recommendedDisposition).toBe(clientResult.recommendedDisposition);
    expect(cloudResult.recommendedOutputFormat).toBe(clientResult.recommendedOutputFormat);
  });

  it('services/scoring wrapper matches domain core (parity baseline)', () => {
    const wrapped = calculateStrategicScore(paritySignal, parityThesis, {
      bilingualTerms: ['NIST', 'gobernanza de IA'],
    });
    const material = computeStrategicScoreMaterial({
      signal: paritySignal,
      thesis: parityThesis,
      context: { bilingualTerms: ['NIST', 'gobernanza de IA'] },
      nowMs: Date.now(),
    });
    expect(wrapped.totalScore).toBe(material.totalScore);
    expect(wrapped.priorityBand).toBe(material.priorityBand);
    expect(wrapped.scoringVersion).toBe(SCORING_VERSION);
  });

  it('scheduledIngest has no first-thesis strategic shortcut or ingest-time scoring', () => {
    const src = readFileSync(join(ROOT, 'functions/src/lib/scheduledIngest.ts'), 'utf8');
    expect(src).not.toMatch(/thesesSnap/);
    expect(src).not.toMatch(/docs\[0\]/);
    expect(src).not.toMatch(/scoreSignalCloud/);
    expect(src).not.toMatch(/autoDiscard/);
    expect(src).not.toMatch(/status:\s*autoDiscard\s*\?\s*['"]DISCARDED['"]/);
    expect(src).not.toMatch(/relevanceScore:/);
    expect(src).not.toMatch(/recommendedAction:/);
  });

  it('cloud scoreSignal.ts delegates to domain core — no duplicate factor weights', () => {
    const cloudScorer = readFileSync(join(ROOT, 'functions/src/lib/scoreSignal.ts'), 'utf8');
    expect(cloudScorer).toMatch(/computeStrategicScoreMaterial/);
    expect(cloudScorer).not.toMatch(/SCORING_FACTOR_WEIGHTS/);
    expect(cloudScorer).not.toMatch(/thesisMatch \* 25/);
  });

  it('SCORING_FACTOR_WEIGHTS authoritative definition count is 1', () => {
    expect(duplicateScoringWeightPaths(ROOT)).toEqual([]);
    expect(SCORING_FACTOR_WEIGHTS.length).toBeGreaterThan(0);
  });

  describe('SCORING_FACTOR_WEIGHTS source discovery', () => {
    const AUTHORITY = 'export const SCORING_FACTOR_WEIGHTS = [] as const;\n';
    const OTHER = 'export const UNRELATED = 1;\n';

    function withFixture(run: (root: string) => void): void {
      const root = mkdtempSync(join(tmpdir(), 'scoring-weights-'));
      try {
        writeSourceFixture(root, 'src/domain/scoringCore.ts', AUTHORITY);
        writeSourceFixture(root, 'src/lib/id.ts', OTHER);
        writeSourceFixture(root, 'src/services/unrelated.ts', OTHER);
        writeSourceFixture(root, 'functions/src/lib/scoreSignal.ts', OTHER);
        writeSourceFixture(root, 'functions/node_modules/pkg/index.ts', AUTHORITY);
        writeSourceFixture(root, 'src/node_modules/nested/index.tsx', AUTHORITY);
        writeSourceFixture(root, 'dist/generated.ts', AUTHORITY);
        writeSourceFixture(root, 'functions/dist/out.ts', AUTHORITY);
        writeSourceFixture(root, 'src/build/out.tsx', AUTHORITY);
        writeSourceFixture(root, 'coverage/lcov.ts', AUTHORITY);
        writeSourceFixture(root, 'functions/lib/src/domain/scoringCore.ts', AUTHORITY);
        run(root);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }

    function examined(root: string): string[] {
      return [...collectTsFiles(join(root, 'src')), ...collectTsFiles(join(root, 'functions'))].map((file) =>
        relative(root, file).replace(/\\/g, '/')
      );
    }

    it('accepts the single authoritative definition and ignores dependency and generated trees', () => {
      withFixture((root) => {
        const files = examined(root);
        expect(duplicateScoringWeightPaths(root)).toEqual([]);
        expect(files).toContain('src/domain/scoringCore.ts');
        expect(files).toContain('src/lib/id.ts');
        expect(files).toContain('functions/src/lib/scoreSignal.ts');
        expect(files.some((rel) => rel.split('/').includes('node_modules'))).toBe(false);
        expect(files.some((rel) => rel.split('/').includes('dist'))).toBe(false);
        expect(files.some((rel) => rel.split('/').includes('build'))).toBe(false);
        expect(files.some((rel) => rel.split('/').includes('coverage'))).toBe(false);
        expect(files.some((rel) => rel.startsWith('functions/lib/'))).toBe(false);
        expect(files.length).toBeGreaterThan(1);
      });
    });

    it('detects a second definition in own source and one nested in a scoring subdirectory', () => {
      withFixture((root) => {
        writeSourceFixture(root, 'src/services/secondWeights.ts', AUTHORITY);
        writeSourceFixture(root, 'src/application/strategicScoring/nestedWeights.ts', AUTHORITY);
        writeSourceFixture(root, 'functions/src/lib/nestedWeights.ts', AUTHORITY);
        const hits = duplicateScoringWeightPaths(root);
        expect([...hits].sort()).toEqual([
          'functions/src/lib/nestedWeights.ts',
          'src/application/strategicScoring/nestedWeights.ts',
          'src/services/secondWeights.ts',
        ]);
        const files = examined(root);
        expect(hits.length).not.toBe(files.length);
        expect(files.length).toBeGreaterThan(hits.length);
      });
    });

    it('keeps own source trees in the repository scan', () => {
      const files = [...collectTsFiles(join(ROOT, 'src')), ...collectTsFiles(join(ROOT, 'functions'))].map((file) =>
        relative(ROOT, file).replace(/\\/g, '/')
      );
      expect(files).toContain('src/domain/scoringCore.ts');
      expect(files).toContain('src/lib/id.ts');
      expect(files).toContain('functions/src/lib/scoreSignal.ts');
      expect(files.some((rel) => rel.split('/').includes('node_modules'))).toBe(false);
      expect(files.some((rel) => rel.startsWith('functions/lib/'))).toBe(false);
    });
  });

  it('zero strategic callers of applyScoreToSignal remain in src/', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(join(ROOT, 'src'))) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (rel.endsWith('services/db.ts')) continue;
      const content = readFileSync(file, 'utf8');
      if (/applyScoreToSignal\s*\(/.test(content)) {
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });

  it('AI analyze does not mutate canonical score fields on signal', () => {
    const ai = readFileSync(join(ROOT, 'src/services/ai.ts'), 'utf8');
    const analyzeBlock = ai.slice(ai.indexOf('analyzeSignalAgainstThesis'));
    expect(analyzeBlock).not.toMatch(/full\.relevanceScore\s*=/);
    expect(analyzeBlock).not.toMatch(/full\.priorityBand\s*=/);
    expect(analyzeBlock).not.toMatch(/full\.recommendedAction\s*=/);
    expect(analyzeBlock).toMatch(/signal\.relevanceScore/);
  });

  it('applyScoreToSignal no longer performs auto-DISCARD', () => {
    const db = readFileSync(join(ROOT, 'src/services/db.ts'), 'utf8');
    expect(db).toMatch(/@deprecated[\s\S]*applyScoreToSignal/);
    const methodStart = db.indexOf('applyScoreToSignal(');
    const methodEnd = db.indexOf('applyStrategicRoutingToSignal', methodStart);
    const block = db.slice(methodStart, methodEnd);
    expect(block).not.toMatch(/status\s*=\s*['"]DISCARDED['"]/);
  });

  it('UI/main does not persist strategic score fields directly', () => {
    const fields =
      'relevanceScore|priorityBand|scoringVersion|recommendedDisposition|recommendedOutputFormat|scoreBreakdown';
    const subjects = 'signal|sig|full|entry|payload';
    const assignLine = new RegExp(`\\b(?:${subjects})\\.(${fields})\\s*=\\s*[^=]`);
    const hits: string[] = [];
    for (const file of collectTsFiles(join(ROOT, 'src/components'))) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      if (content.split('\n').some((line) => assignLine.test(line))) hits.push(rel);
    }
    const main = readLegacyControllerSurface();
    if (main.split('\n').some((line) => assignLine.test(line) && !line.includes('filterState'))) {
      hits.push('main.ts');
    }
    expect(hits).toEqual([]);
  });
});
