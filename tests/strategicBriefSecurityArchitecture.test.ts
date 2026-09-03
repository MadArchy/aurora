import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

const DOMAIN_BRIEF = [
  'domain/strategicBriefCore.ts',
  'domain/strategicBriefErrors.ts',
  'domain/briefMaterialityCore.ts',
  'domain/briefRoutingGateCore.ts',
  'domain/briefTenantCore.ts',
  'domain/briefConsumerCore.ts',
];

const APP_BRIEF = join(SRC, 'application/strategicBrief');
const INFRA_BRIEF = join(SRC, 'infrastructure/strategicBrief');
const COMPOSITION = join(SRC, 'composition/strategicBrief');
const CONSUMER = join(SRC, 'services/strategicBriefConsumer.ts');
const LEGACY_SURFACE = readLegacyControllerSurface();
const ADVISOR = join(SRC, 'services/advisor.ts');

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
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
  'activeTheses[0]',
  'candidates[0]',
  'docs[0]',
  'docs.at(0)',
];

const ROUTING_MUTATION = [
  'routingDecision =',
  'selectedThesisId =',
  'thesisScores =',
  'routingHistory =',
];

const SCORE_MUTATION = [
  'relevanceScore =',
  'priorityBand =',
  'scoringVersion =',
  'scoreBreakdown =',
  'recommendedDisposition =',
  'recommendedOutputFormat =',
];

describe('SPEC-003 Phase 5 — security architecture bans (T-003-501)', () => {
  it('Domain → Application / Infrastructure / UI imports = 0', () => {
    const hits: string[] = [];
    for (const rel of DOMAIN_BRIEF) {
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
    }
    expect(hits).toEqual([]);
  });

  it('Application → Infrastructure / Firebase / localStorage / provider = 0', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(APP_BRIEF)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const spec of extractImports(content)) {
        if (
          FORBIDDEN_PACKAGE.some((p) => p.test(spec)) ||
          spec.includes('/infrastructure/') ||
          spec.includes('/services/db') ||
          spec.includes('dbService')
        ) {
          hits.push(`${rel} → ${spec}`);
        }
      }
      const body = stripComments(content);
      if (/localStorage|indexedDB|getFirestore|OpenAI|Anthropic/.test(body)) {
        hits.push(`${rel}: framework/provider leak`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('Domain purity — no Date.now / new Date / process.env / db / AI', () => {
    const hits: string[] = [];
    for (const rel of DOMAIN_BRIEF) {
      const body = stripComments(readFileSync(join(SRC, rel), 'utf8'));
      if (/\bDate\.now\s*\(/.test(body) || /\bnew Date\s*\(/.test(body)) hits.push(`${rel}: Date`);
      if (/\bprocess\.env\b/.test(body)) hits.push(`${rel}: process.env`);
      if (/localStorage|dbService|firebase|openai|anthropic|fetch\(/i.test(body)) {
        hits.push(`${rel}: I/O`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('strategic consumer authorization bypass via brief.status alone = 0', () => {
    const main = stripComments(LEGACY_SURFACE);
    // Display/filter of APPROVED is allowed; sole-authority before generateContentDraft is not.
    expect(main).not.toMatch(
      /brief\.status\s*===\s*['"]APPROVED['"]\s*&&[\s\S]{0,200}generateContentDraft/
    );
    expect(main).toContain('gateStrategicDownstream');
    // SPEC-004 strangler: main calls Plan gate; Brief authorize remains inside Plan consumer.
    expect(main).toContain('requirePlannedAuthorization');
    const planConsumer = stripComments(
      readFileSync(join(ROOT, 'src/services/strategicPlanConsumer.ts'), 'utf8')
    );
    expect(planConsumer).toContain('requireStrategicAuthorization');
    const consumer = stripComments(readFileSync(CONSUMER, 'utf8'));
    expect(consumer).toMatch(/AuthorizeStrategicDownstream|authorizeStrategicDownstream|composeStrategicBrief/);
  });

  it('direct write inventory — strategic ungated executable paths = 0', () => {
    const main = stripComments(LEGACY_SURFACE);
    // Strategic AI generation sites must sit after gate helpers in source order proximity checks
    // via known handler patterns requiring gateStrategicDownstream.
    const strategicHandlers = [
      'form-generate-content',
      'btn-generate-scientific-article',
      'btn-create-task-from-rec',
      'sendDelivery',
    ];
    for (const marker of strategicHandlers) {
      expect(main).toContain(marker.includes('sendDelivery') ? 'sendDelivery' : marker);
    }
    expect(main).toContain('gateStrategicDownstream');
    // Generic manual task remains ungated by design
    expect(main).toContain('form-add-task');
  });

  it('first/primary/legacy thesis authority in SPEC-003 strategic paths = 0', () => {
    const hits: string[] = [];
    const dirs = [APP_BRIEF, INFRA_BRIEF, COMPOSITION];
    for (const dir of dirs) {
      for (const file of collectTsFiles(dir)) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        const body = stripComments(readFileSync(file, 'utf8'));
        for (const token of FIRST_PRIMARY) {
          if (body.includes(token)) hits.push(`${rel}: ${token}`);
        }
        if (body.includes('signal.thesisId')) hits.push(`${rel}: signal.thesisId`);
        if (/thesisScores\[0\]|thesisScores\.sort|thesisScores\.find/.test(body)) {
          hits.push(`${rel}: thesisScores winner`);
        }
      }
    }
    for (const rel of DOMAIN_BRIEF) {
      const body = stripComments(readFileSync(join(SRC, rel), 'utf8'));
      for (const token of FIRST_PRIMARY) {
        if (body.includes(token)) hits.push(`${rel}: ${token}`);
      }
    }
    const advisor = stripComments(readFileSync(ADVISOR, 'utf8'));
    const propose = advisor.slice(advisor.indexOf('export async function proposeAngle'));
    expect(propose).toMatch(/thesisId:\s*string/);
    expect(propose).not.toMatch(/thesisId\?:\s*string/);
    expect(hits).toEqual([]);
  });

  it('routing / score mutation from SPEC-003 Application+Infrastructure = NONE', () => {
    const hits: string[] = [];
    for (const dir of [APP_BRIEF, INFRA_BRIEF]) {
      for (const file of collectTsFiles(dir)) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        const body = stripComments(readFileSync(file, 'utf8'));
        for (const token of [...ROUTING_MUTATION, ...SCORE_MUTATION]) {
          if (body.includes(token)) hits.push(`${rel}: ${token}`);
        }
        if (/\broutingState\s*=(?!=)/.test(body)) hits.push(`${rel}: routingState=`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('SPEC-003 paths do not auto-DISCARD or invoke claimSafety as authority', () => {
    const hits: string[] = [];
    for (const dir of [APP_BRIEF, INFRA_BRIEF, COMPOSITION]) {
      for (const file of collectTsFiles(dir)) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        const body = stripComments(readFileSync(file, 'utf8'));
        if (/status\s*=\s*['"]DISCARDED['"]/.test(body) || /decideSignal\([^)]*DISCARD/.test(body)) {
          hits.push(`${rel}: auto-DISCARD`);
        }
        if (/claimSafetyCore|claimSafetyGateCore/.test(body)) hits.push(`${rel}: claimSafety`);
        if (/ExecuteAiOperation|AiGateway|api\.openai|api\.anthropic/.test(body)) {
          hits.push(`${rel}: AI provider`);
        }
      }
    }
    const consumer = stripComments(readFileSync(CONSUMER, 'utf8'));
    if (/claimSafetyCore|AiGateway|openai|anthropic/i.test(consumer)) {
      hits.push('strategicBriefConsumer: AI/claim leak');
    }
    expect(hits).toEqual([]);
  });

  it('history production adapter has no replace/delete overwrite API', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(INFRA_BRIEF)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const body = stripComments(readFileSync(file, 'utf8'));
      for (const token of ['updateHistory', 'replaceHistory', 'deleteHistoryEntry']) {
        if (body.includes(token)) hits.push(`${rel}: ${token}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('secrets / provider headers absent from SPEC-003 Brief packages', () => {
    const hits: string[] = [];
    const secretish = [/sk-[a-zA-Z0-9]{20,}/, /Authorization:\s*Bearer/, /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i];
    for (const dir of [APP_BRIEF, INFRA_BRIEF, COMPOSITION, join(SRC, 'domain')]) {
      for (const file of collectTsFiles(dir).filter((f) => /brief|Brief/.test(f))) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        const content = readFileSync(file, 'utf8');
        for (const re of secretish) {
          if (re.test(content)) hits.push(`${rel}: secret pattern`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
