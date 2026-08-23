import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const APP_ROOT = join(ROOT, 'src', 'application', 'strategicSignalRouting');

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...collectTsFiles(full));
    else if (entry.endsWith('.ts')) results.push(full);
  }
  return results;
}

function extractImports(content: string): string[] {
  const out: string[] = [];
  const re =
    /import\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) out.push(m[1]);
  return out;
}

describe('SPEC-001 Phase 2 — application hexagonal + central fallback ban', () => {
  it('Application strategicSignalRouting does not import infra/Firebase/UI/dbService', () => {
    const violations: string[] = [];
    for (const file of collectTsFiles(APP_ROOT)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const spec of extractImports(content)) {
        if (
          /^firebase(\/|$)/.test(spec) ||
          /^firebase-admin(\/|$)/.test(spec) ||
          /^react(\/|$)/.test(spec) ||
          /^vite(\/|$)/.test(spec) ||
          spec.includes('/services/db') ||
          spec.includes('/infrastructure/') ||
          spec.includes('/composition/') ||
          spec.includes('OpenAiAdapter') ||
          spec.includes('AnthropicAdapter')
        ) {
          violations.push(`${rel} → ${spec}`);
        }
      }
      if (/\.getPrimaryThesis\(|activeTheses\[0\]|candidates\[0\]/.test(content)) {
        violations.push(`${rel} contains primary/index fallback`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('central scoreSignal path does not use getPrimaryThesis or candidates[0]', () => {
    const main = readFileSync(join(ROOT, 'src/main.ts'), 'utf8');
    const scoreFn = main.match(
      /private scoreSignal\([\s\S]*?\n {2}private bindRadar/
    )?.[0];
    expect(scoreFn).toBeTruthy();
    expect(scoreFn!).toMatch(/scoreAndRouteSignal/);
    expect(scoreFn!).not.toMatch(/getPrimaryThesis/);
    expect(scoreFn!).not.toMatch(/candidates\[0\]/);
    expect(scoreFn!).not.toMatch(/activeTheses\[0\]/);
    expect(scoreFn!).not.toMatch(/routeSignalAcrossTheses/);
  });

  it('DbStrategicSignalRoutingAdapter write path uses applyStrategicRoutingToSignal', () => {
    const adapter = readFileSync(
      join(ROOT, 'src/infrastructure/strategicSignalRouting/DbStrategicSignalRoutingAdapter.ts'),
      'utf8'
    );
    expect(adapter).toMatch(/applyStrategicRoutingToSignal/);
    expect(adapter).not.toMatch(/applyScoreToSignal\(/);
    expect(adapter).not.toMatch(/\.getPrimaryThesis\(/);
  });
});
