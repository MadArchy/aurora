/**
 * SPEC-004 Phase 5 — Security architecture bans (T-004-501).
 * Proves layer purity, zero legacy/UI/AI/snapshot/provider authority, cross-SPEC boundaries.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

const DOMAIN_PLAN = [
  'domain/strategicPlanCore.ts',
  'domain/strategicPlanErrors.ts',
  'domain/planItemCore.ts',
  'domain/planTenantCore.ts',
  'domain/planBriefContextCore.ts',
  'domain/planGateCore.ts',
  'domain/planMaterialityCore.ts',
  'domain/planExplainabilityCore.ts',
];

const APP_PLAN = join(SRC, 'application/strategicPlan');
const INFRA_PLAN = join(SRC, 'infrastructure/strategicPlan');
const COMPOSE = join(SRC, 'composition/strategicPlan');
const CONSUMER = join(SRC, 'services/strategicPlanConsumer.ts');
const MAIN = join(SRC, 'main.ts');
const DELIVERY_SEND = join(SRC, 'infrastructure/executionDelivery/DbDeliverySendAdapter.ts');
const COMPONENTS = join(SRC, 'components');

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...collectTsFiles(full));
    else if (entry.endsWith('.ts')) results.push(full);
  }
  return results;
}

function stripComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function extractImports(content: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /import\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g,
    /export\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) specifiers.push(match[1]);
  }
  return specifiers;
}

const FORBIDDEN_PACKAGE = [
  /^firebase(\/|$)/,
  /^firebase-admin(\/|$)/,
  /^openai(\/|$)/,
  /^@anthropic-ai\//,
  /^react(\/|$)/,
  /^vite(\/|$)/,
  /^express(\/|$)/,
  /^axios(\/|$)/,
];

const FIRST_PRIMARY = [
  'getPrimaryThesis',
  'primaryThesisId',
  'theses[0]',
  'theses[ 0 ]',
  'activeTheses[0]',
  'plans[0]',
  'briefs[0]',
  'approved[0]',
];

describe('SPEC-004 Phase 5 — security architecture bans (T-004-501)', () => {
  it('Domain → Application / Infrastructure / UI / provider imports = 0', () => {
    const hits: string[] = [];
    for (const rel of DOMAIN_PLAN) {
      const content = readFileSync(join(SRC, rel), 'utf8');
      for (const spec of extractImports(content)) {
        if (
          /\/(application|infrastructure|composition|services|components)\//.test(spec) ||
          FORBIDDEN_PACKAGE.some((p) => p.test(spec)) ||
          spec.includes('dbService') ||
          spec.includes('main.ts')
        ) {
          hits.push(`${rel} → ${spec}`);
        }
      }
      const body = stripComments(content);
      if (/\bDate\.now\s*\(|\bnew Date\s*\(|localStorage|fetch\s*\(/.test(body)) {
        hits.push(`${rel}: impure runtime`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('Application → Infrastructure / Firebase / provider / UI imports = 0', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(APP_PLAN)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const spec of extractImports(content)) {
        if (
          FORBIDDEN_PACKAGE.some((p) => p.test(spec)) ||
          spec.includes('/infrastructure/') ||
          spec.includes('/components/') ||
          spec.includes('/services/db') ||
          spec.includes('dbService')
        ) {
          hits.push(`${rel} → ${spec}`);
        }
      }
      const body = stripComments(content);
      if (/localStorage|indexedDB|OpenAI|Anthropic|fetch\s*\(/.test(body)) {
        hits.push(`${rel}: framework/provider leak`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('UI components have zero LocalStrategicPlanStore / Repository / posture plan keys', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(COMPONENTS)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      if (
        /LocalStrategicPlanStore|LocalStrategicPlanRepository|postura_strategic_plan_/.test(
          content
        )
      ) {
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });

  it('main.ts has zero UI/status-alone Plan authority and zero [0] planner picks', () => {
    const main = stripComments(readFileSync(MAIN, 'utf8'));
    const deliverySend = stripComments(readFileSync(DELIVERY_SEND, 'utf8'));
    expect(main).toMatch(/requirePlannedAuthorization/);
    expect(deliverySend).toMatch(/assertCurationNotPlanAuthority/);
    for (const pattern of FIRST_PRIMARY) {
      expect(main).not.toContain(pattern);
    }
    expect(main).not.toMatch(/LocalStrategicPlanStore|postura_strategic_plan_/);
  });

  it('consumer strategic authority outside SPEC-004 Application/composition = 0', () => {
    const content = readFileSync(CONSUMER, 'utf8');
    expect(content).toMatch(/composeStrategicPlan/);
    expect(content).toMatch(/void params\.forgedPlan/);
    expect(content).toMatch(/void params\.forgedBrief/);
    expect(content).toMatch(/assertCurationNotPlanAuthority/);
    expect(content).not.toMatch(/AuthorizePublication|VerifyClaim|claimSafety/);
    expect(content).not.toMatch(/approveStrategicBrief|reviseStrategicBrief|createStrategicBrief/);
  });

  it('direct consumer persistence authority = 0 (consumers use composition)', () => {
    const main = stripComments(readFileSync(MAIN, 'utf8'));
    expect(main).not.toMatch(/LocalStrategicPlanRepository|createLocalStrategicPlanStore/);
    const consumer = readFileSync(CONSUMER, 'utf8');
    // Consumer may own the store privately for composition — must still route through useCases.
    expect(consumer).toMatch(/useCases\.(authorize|create|approve)/);
  });

  it('AI execution / provider authority = 0 across SPEC-004 runtime paths', () => {
    const files = [
      CONSUMER,
      ...collectTsFiles(COMPOSE),
      ...collectTsFiles(APP_PLAN),
      ...collectTsFiles(INFRA_PLAN),
      ...DOMAIN_PLAN.map((r) => join(SRC, r)),
    ];
    for (const file of files) {
      const body = stripComments(readFileSync(file, 'utf8'));
      expect(body).not.toMatch(/openai|@anthropic-ai|OpenAI|Anthropic/);
      expect(body).not.toMatch(/process\.env\.(OPENAI|ANTHROPIC|API_KEY)/i);
    }
  });

  it('legacy strategic fallback inventory = 0 in main gate', () => {
    const main = stripComments(readFileSync(MAIN, 'utf8'));
    expect(main).toMatch(/gateStrategicDownstream/);
    // No CurationEntry.status === APPROVED as strategic allow.
    expect(main).not.toMatch(
      /curation(?:Entry)?\.status\s*===\s*['"]APPROVED['"][\s\S]{0,120}gateStrategicDownstream/
    );
    expect(main).not.toMatch(
      /deliveryPackage\.status\s*===\s*['"]READY['"][\s\S]{0,120}requirePlannedAuthorization/
    );
  });

  it('SPEC-003 Brief mutation from SPEC-004 paths = 0', () => {
    const files = [
      ...DOMAIN_PLAN.map((r) => join(SRC, r)),
      ...collectTsFiles(APP_PLAN),
      ...collectTsFiles(INFRA_PLAN),
      CONSUMER,
    ];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(
        /createApproveStrategicBrief|createCreateStrategicBrief|createReviseStrategicBrief|approveStrategicBrief\(/
      );
    }
    const reader = readFileSync(join(INFRA_PLAN, 'LocalStrategicBriefReader.ts'), 'utf8');
    expect(reader).toMatch(/READ ONLY|read-only|Does not mutate/i);
  });

  it('SPEC-006 publication replacement from SPEC-004 = 0; gate preserved', () => {
    for (const file of [...collectTsFiles(APP_PLAN), ...DOMAIN_PLAN.map((r) => join(SRC, r))]) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/AuthorizePublication|VerifyClaim|markClaimVerified/);
    }
    const main = readFileSync(MAIN, 'utf8');
    expect(main).toMatch(/saveContentWithClaimGate|authorizeContentPublicationGate/);
    const gate = readFileSync(
      join(SRC, 'composition/claimEvidence/contentClaimPublicationGate.ts'),
      'utf8'
    );
    expect(gate).toMatch(/authorizeContentPublicationGate|AuthorizePublication/);
  });

  it('primary / first thesis authority = 0 across Domain/App/Infra/consumer/main', () => {
    const files = [
      ...DOMAIN_PLAN.map((r) => join(SRC, r)),
      ...collectTsFiles(APP_PLAN),
      ...collectTsFiles(INFRA_PLAN),
      CONSUMER,
      MAIN,
    ];
    for (const file of files) {
      const body = stripComments(readFileSync(file, 'utf8'));
      for (const pattern of FIRST_PRIMARY) {
        expect(body).not.toContain(pattern);
      }
    }
  });

  it('SPEC-009 production auth-claim migration absent from SPEC-004 planner paths', () => {
    const files = [
      ...collectTsFiles(APP_PLAN),
      ...collectTsFiles(INFRA_PLAN),
      ...collectTsFiles(COMPOSE),
      CONSUMER,
    ];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/setCustomUserClaims|auth\.setClaims|firebase-admin/);
      expect(content).not.toMatch(/firestore\.rules|storage\.rules/);
    }
  });
});
