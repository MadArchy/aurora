import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MAIN = join(ROOT, 'src/main.ts');

function stripComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('SPEC-003 Phase 4 — strategic consumer architecture', () => {
  it('main.ts strategic paths call gateStrategicDownstream with Plan+Brief mediation', () => {
    const content = readFileSync(MAIN, 'utf8');
    expect(content).toContain('gateStrategicDownstream');
    expect(content).toContain('requirePlannedAuthorization');
    // Brief AuthorizeStrategicDownstream still invoked inside SPEC-004 Plan consumer.
    const planConsumer = readFileSync(
      join(ROOT, 'src/services/strategicPlanConsumer.ts'),
      'utf8'
    );
    expect(planConsumer).toContain('requireStrategicAuthorization');
    expect(planConsumer).toContain('formatAuthorizationDenial');
  });

  it('main.ts does not authorize strategic content via direct brief.status checks', () => {
    const withoutComments = stripComments(readFileSync(MAIN, 'utf8'));
    expect(withoutComments).not.toMatch(/brief\.status\s*===\s*['"]APPROVED['"]\s*&&\s*.*generateContentDraft/s);
  });

  it('proposeAngle requires explicit thesisId parameter', () => {
    const advisor = readFileSync(join(ROOT, 'src/services/advisor.ts'), 'utf8');
    const proposeBlock = advisor.slice(advisor.indexOf('export async function proposeAngle'));
    expect(proposeBlock).toMatch(/thesisId:\s*string/);
    expect(proposeBlock).not.toMatch(/thesisId\?:\s*string/);
  });
});
