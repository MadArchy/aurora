/**
 * SPEC-004 Phase 4 — Consumer architecture bans (T-004-407).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const MAIN = join(ROOT, 'src/main.ts');
const DELIVERY_SEND = join(ROOT, 'src/infrastructure/executionDelivery/DbDeliverySendAdapter.ts');
const COMPONENTS = join(ROOT, 'src/components');
const CONSUMER = join(ROOT, 'src/services/strategicPlanConsumer.ts');
const COMPOSE = join(ROOT, 'src/composition/strategicPlan');

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

describe('SPEC-004 Phase 4 — consumer architecture (T-004-407)', () => {
  it('main.ts uses requirePlannedAuthorization and demotes CurationEntry via delivery adapter', () => {
    const main = readFileSync(MAIN, 'utf8');
    const deliverySend = readFileSync(DELIVERY_SEND, 'utf8');
    expect(main).toMatch(/requirePlannedAuthorization/);
    expect(deliverySend).toMatch(/assertCurationNotPlanAuthority/);
    expect(main).toMatch(/formatPlannedAuthorizationDenial/);
    // No dual-authority Brief-only gate for strategic downstream.
    expect(main).not.toMatch(
      /private gateStrategicDownstream[\s\S]*requireStrategicAuthorization\(/
    );
  });

  it('main.ts has zero approved[0] / briefs[0] / plans[0] planner authority', () => {
    const main = readFileSync(MAIN, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(main).not.toMatch(/approved\s*\[\s*0\s*\]/);
    expect(main).not.toMatch(/briefs\s*\[\s*0\s*\]/);
    expect(main).not.toMatch(/plans\s*\[\s*0\s*\]/);
    expect(main).not.toMatch(/primaryThesisId|getPrimaryThesis/);
  });

  it('UI components do not import LocalStrategicPlanStore / Repository directly', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(COMPONENTS)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      if (
        content.includes('LocalStrategicPlanStore') ||
        content.includes('LocalStrategicPlanRepository') ||
        content.includes('postura_strategic_plan_')
      ) {
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });

  it('main.ts does not import LocalStrategicPlanStore for authority', () => {
    const main = readFileSync(MAIN, 'utf8');
    expect(main).not.toMatch(/LocalStrategicPlanStore|postura_strategic_plan_/);
  });

  it('consumer facade documents CurationEntry non-authority', () => {
    const content = readFileSync(CONSUMER, 'utf8');
    expect(content).toMatch(/COMPATIBILITY|not Plan authority|never StrategicPlan authority/i);
    expect(content).toMatch(/assertCurationNotPlanAuthority/);
    expect(content).toMatch(/forgedPlan/);
    expect(content).not.toMatch(/OpenAI|Anthropic|fetch\s*\(/);
  });

  it('composition wires Application to ports only via infrastructure adapters', () => {
    const compose = readFileSync(join(COMPOSE, 'composeStrategicPlan.ts'), 'utf8');
    expect(compose).toMatch(/createAuthorizePlannedAction/);
    expect(compose).toMatch(/LocalStrategicPlanRepository/);
    expect(compose).toMatch(/LocalStrategicBriefReader/);
  });

  it('SPEC-006 AuthorizePublication composition remains present for content publish', () => {
    const gate = readFileSync(
      join(ROOT, 'src/composition/claimEvidence/contentClaimPublicationGate.ts'),
      'utf8'
    );
    expect(gate).toMatch(/authorizeContentPublicationGate|AuthorizePublication/);
    const main = readFileSync(MAIN, 'utf8');
    expect(main).toMatch(/saveContentWithClaimGate|authorizeContentPublicationGate/);
  });

  it('no direct provider SDK in Phase-4 planner composition/consumer', () => {
    const files = [CONSUMER, ...collectTsFiles(COMPOSE)];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/openai|@anthropic-ai|OpenAI|Anthropic/);
    }
  });
});
