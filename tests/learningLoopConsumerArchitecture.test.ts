/**
 * SPEC-008 Phase 4 — Consumer architecture bans (T-008-401/404).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const MAIN = join(ROOT, 'src/main.ts');
const COMPONENTS = join(ROOT, 'src/components');
const CONSUMER = join(ROOT, 'src/services/learningLoopConsumer.ts');
const COMPOSE = join(ROOT, 'src/composition/learningLoop');
const APP = join(ROOT, 'src/application/learningLoop');

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return results;
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

describe('SPEC-008 Phase 4 — consumer architecture', () => {
  it('Application does not import Infrastructure or composition', () => {
    for (const file of collectTsFiles(APP)) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/from ['"].*\/infrastructure\//);
      expect(content).not.toMatch(/from ['"].*\/composition\//);
      expect(content).not.toMatch(/from ['"].*\/services\/db/);
      expect(content).not.toMatch(/localStorage/);
    }
  });

  it('UI components do not import LocalLearningLoopStore / learning keys directly', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(COMPONENTS)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      if (
        content.includes('LocalLearningLoopStore') ||
        content.includes('LocalLearningObservationRepository') ||
        content.includes('postura_learning_')
      ) {
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });

  it('ClientWorkspace uses consumer display helpers — not authoritative dbService writes', () => {
    const ws = readFileSync(join(COMPONENTS, 'ClientWorkspace.ts'), 'utf8');
    expect(ws).toMatch(/getSignalOutcomeForDisplay|listSignalOutcomesForDisplay/);
    expect(ws).not.toMatch(/recordSignalOutcome/);
    expect(ws).not.toMatch(/dbService\.getSignalOutcome/);
  });

  it('main.ts does not open canonical learning store keys or legacy authority writes', () => {
    const main = readFileSync(MAIN, 'utf8');
    expect(main).not.toMatch(/postura_learning_|LocalLearningLoopStore/);
    expect(main).not.toMatch(/recordSignalOutcome\s*\(/);
    expect(main).not.toMatch(/dbService\.addResult\s*\(/);
    expect(main).toMatch(/registerSignalOutcomeIntent/);
    expect(main).not.toMatch(/feedbackScoringHints/);
  });

  it('consumer facade documents trusted context and compatibility mirror ordering', () => {
    const content = readFileSync(CONSUMER, 'utf8');
    expect(content).toMatch(/never from UI|Trusted context/i);
    expect(content).toMatch(/COMPATIBILITY_WRITE_MIRROR|mirrorSignalOutcomeAfterCanonical/);
    expect(content).toMatch(/forgedObservation|actorUid|createdBy/);
    expect(content).not.toMatch(/OpenAI|Anthropic|fetch\s*\(/);
  });

  it('composition wires Application use cases to infrastructure adapters', () => {
    const compose = readFileSync(join(COMPOSE, 'composeLearningLoop.ts'), 'utf8');
    expect(compose).toMatch(/createRegisterLearningObservation/);
    expect(compose).toMatch(/LocalLearningObservationRepository/);
    expect(compose).toMatch(/LocalStrategicRecommendationRepository/);
    expect(compose).toMatch(/createApplyApprovedRecommendation/);
  });

  it('dbService legacy learning writes demoted — mirror-only paths documented', () => {
    const db = readFileSync(join(ROOT, 'src/services/db.ts'), 'utf8');
    expect(db).toMatch(/mirrorSignalOutcomeCompatibility/);
    expect(db).toMatch(/mirrorResultRecordCompatibility/);
    expect(db).toMatch(/LEGACY_AUTHORITY_REMOVED/);
  });

  it('no direct provider SDK in Phase-4 learning composition/consumer', () => {
    const files = [CONSUMER, ...collectTsFiles(COMPOSE)];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/from ['"]openai['"]|from ['"]@anthropic-ai\//);
      expect(content).not.toMatch(/fetch\s*\(\s*['"]https?:\/\//);
    }
  });
});
