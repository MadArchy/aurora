import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SPEC-008 Phase 6 — T-008-601 acceptance matrix evidence.
 *
 * Evidence-only suite: it asserts repository facts that the A1-A38 matrix claims,
 * so acceptance rows rest on executable checks instead of prose. No product code
 * is exercised for mutation here.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const CANONICAL_RUNTIME = [
  'src/application/learningLoop',
  'src/infrastructure/learningLoop',
  'src/composition/learningLoop',
  'src/services/learningLoopConsumer.ts',
];

const ACCEPTANCE = 'specs/008-learning-loop/acceptance.md';
const MAIN = 'src/main.ts';

/** Non-learning operations that legitimately own the residual `main.ts` fallbacks. */
const NON_LEARNING_FALLBACK_OWNERS = [
  'createClient',
  'createInvitation',
  'getThesesByClient',
  'addSource',
  'getCurationById',
  'ensureDraftDelivery',
  'decideCuration',
  'addToCuration',
];

/** Widest observed distance between a `dbService` call and its `createdBy` field. */
const LOOKBACK = 16;

const LEARNING_INTENTS = [
  'registerSignalOutcomeIntent',
  'registerResultRecordIntent',
  'approveRecommendationIntent',
];

function collectTsFiles(target: string): string[] {
  const full = join(ROOT, target);
  if (!existsSync(full)) return [];
  if (statSync(full).isFile()) return [full];
  const out: string[] = [];
  for (const entry of readdirSync(full)) {
    const child = join(target, entry);
    if (statSync(join(ROOT, child)).isDirectory()) out.push(...collectTsFiles(child));
    else if (entry.endsWith('.ts')) out.push(join(ROOT, child));
  }
  return out;
}

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function canonicalRuntimeFiles(): string[] {
  return CANONICAL_RUNTIME.flatMap(collectTsFiles);
}

// ============================================================
// A12 — no hard-coded actor fallbacks
// ============================================================

describe('A12 — canonical SPEC-008 runtime has zero hard-coded actor fallbacks', () => {
  it('no canonical learning runtime file contains a user_admin_01 fallback', () => {
    const offenders = canonicalRuntimeFiles().filter((file) => read(file).includes('user_admin_01'));
    expect(offenders).toEqual([]);
  });

  it('no canonical learning runtime file falls back to a literal "client" actor or role', () => {
    const offenders = canonicalRuntimeFiles().filter((file) =>
      /\|\|\s*['"]client['"]/.test(read(file))
    );
    expect(offenders).toEqual([]);
  });

  it('learning intent call sites in main.ts pass no actor identity from the UI', () => {
    const source = read(join(ROOT, MAIN));
    for (const intent of LEARNING_INTENTS) {
      const callIndex = source.indexOf(`${intent}({`);
      if (callIndex === -1) continue;
      const closing = source.indexOf('});', callIndex);
      const payload = source.slice(callIndex, closing);
      expect(payload).not.toMatch(/actorUid|createdBy|approvedBy|actorType|user_admin_01/);
    }
  });

  it('every residual main.ts fallback belongs to a non-learning, other-SPEC path', () => {
    const lines = read(join(ROOT, MAIN)).split(/\r?\n/);
    const unattributed: string[] = [];

    lines.forEach((line, index) => {
      if (!line.includes('user_admin_01')) return;
      const context = lines.slice(Math.max(0, index - LOOKBACK), index + 2).join('\n');
      const owned = NON_LEARNING_FALLBACK_OWNERS.some((owner) => context.includes(owner));
      const learning = LEARNING_INTENTS.some((intent) => context.includes(intent));
      if (!owned || learning) unattributed.push(`${MAIN}:${index + 1}`);
    });

    expect(unattributed).toEqual([]);
  });

  it('residual fallbacks never coexist with a learning repository or store write', () => {
    const lines = read(join(ROOT, MAIN)).split(/\r?\n/);
    const leaks: string[] = [];

    lines.forEach((line, index) => {
      if (!line.includes('user_admin_01')) return;
      const context = lines.slice(Math.max(0, index - LOOKBACK), index + 2).join('\n');
      if (/learning|Learning|StrategicRecommendation|SignalOutcome|ResultRecord/.test(context)) {
        leaks.push(`${MAIN}:${index + 1}`);
      }
    });

    expect(leaks).toEqual([]);
  });
});

// ============================================================
// A38 / matrix integrity — acceptance table is internally consistent
// ============================================================

describe('Acceptance matrix integrity — A1…A38', () => {
  const doc = read(join(ROOT, ACCEPTANCE));
  const rows = doc
    .split(/\r?\n/)
    .filter((line) => /^\|\s*A\d+\s*\|/.test(line))
    .map((line) => line.split('|').map((cell) => cell.trim()));

  it('declares exactly 38 required criteria, A1 through A38, with no gaps', () => {
    const ids = rows.map((cells) => cells[1]);
    expect(ids).toHaveLength(38);
    expect(ids).toEqual(Array.from({ length: 38 }, (_, i) => `A${i + 1}`));
  });

  it('no criterion is marked FAIL', () => {
    const failed = rows.filter((cells) => cells[4].includes('FAIL'));
    expect(failed.map((cells) => cells[1])).toEqual([]);
  });

  it('every criterion carries a non-empty evidence cell', () => {
    const missing = rows.filter((cells) => !cells[5]);
    expect(missing.map((cells) => cells[1])).toEqual([]);
  });

  it('the declared header counts match the table contents exactly', () => {
    const count = (needle: string) =>
      rows.filter((cells) => cells[4].includes(needle)).length;

    const pass = count('PASS');
    const partial = count('PARTIAL');
    const fail = count('FAIL');
    const pending = count('PENDING');

    expect(pass + partial + fail + pending).toBe(38);

    const header = doc.match(
      /\*\*A1-A38:\*\*\s*\*\*(\d+) PASS\*\*\s*·\s*\*\*(\d+) PARTIAL\*\*\s*·\s*\*\*(\d+) FAIL\*\*\s*·\s*\*\*(\d+) PENDING\*\*/
    );
    expect(header, 'acceptance.md must declare a machine-checkable A1-A38 header').not.toBeNull();
    expect([Number(header![1]), Number(header![2]), Number(header![3]), Number(header![4])]).toEqual([
      pass,
      partial,
      fail,
      pending,
    ]);
  });
});

// ============================================================
// Human gate — T-008-604
//
// Anti-forgery invariant: CODE_COMPLETE may only be declared while the exact
// human authorization statement is recorded verbatim. The statement is the sole
// formal artifact, so the declaration and the evidence must never diverge.
// ============================================================

const APPROVAL_STATEMENT =
  'Apruebo formalmente el CODE_COMPLETE de SPEC-008 — Learning Loop y autorizo el cierre de T-008-604.';

describe('T-008-604 human CODE_COMPLETE gate', () => {
  const tasks = read(join(ROOT, 'specs/008-learning-loop/tasks.md'));
  const acceptance = read(join(ROOT, ACCEPTANCE));

  it('the exact required human approval statement is recorded verbatim', () => {
    expect(tasks).toContain(APPROVAL_STATEMENT);
    expect(acceptance).toContain(APPROVAL_STATEMENT);
  });

  it('CODE_COMPLETE is declared only when the human statement is on record', () => {
    const declared = /\*\*CODE_COMPLETE:\*\*\s*\*\*YES\*\*/.test(acceptance);
    if (declared) {
      expect(acceptance).toContain(APPROVAL_STATEMENT);
      expect(acceptance).toMatch(/\*\*HUMAN SIGNOFF:\*\*\s*\*\*APPROVED\*\*/);
    } else {
      expect(acceptance).toMatch(/\*\*CODE_COMPLETE:\*\*\s*\*\*NO\*\*/);
    }
  });

  it('T-008-604 is closed only when signoff is APPROVED and the date is recorded', () => {
    const row = tasks.split(/\r?\n/).find((line) => line.includes('T-008-604'));
    expect(row).toBeDefined();
    if (/^- \[x\]/.test(row!)) {
      expect(acceptance).toMatch(/\*\*HUMAN SIGNOFF:\*\*\s*\*\*APPROVED\*\*/);
      expect(acceptance).toContain('America/Bogota');
      expect(acceptance).toContain(APPROVAL_STATEMENT);
    } else {
      expect(acceptance).toMatch(/\*\*CODE_COMPLETE:\*\*\s*\*\*NO\*\*/);
    }
  });

  it('CODE_COMPLETE never implies DONE or deployment', () => {
    expect(acceptance).toMatch(/\*\*DONE:\*\*\s*\*\*NO\*\*/);
    expect(acceptance).toMatch(/\*\*DEPLOYMENT:\*\*\s*\*\*NOT_STARTED\*\*/);
    expect(acceptance).toMatch(/\*\*DEPLOYED:\*\*\s*\*\*NO\*\*/);
  });
});

// ============================================================
// Deployment separation — D1/D2/D3 remain unstarted
// ============================================================

describe('Deployment separation', () => {
  const tasks = read(join(ROOT, 'specs/008-learning-loop/tasks.md'));

  it('D1, D2 and D3 remain NOT_STARTED', () => {
    for (const id of ['**D1**', '**D2**', '**D3**']) {
      const row = tasks.split(/\r?\n/).find((line) => line.includes(id));
      expect(row, `${id} must be present`).toBeDefined();
      expect(row).toContain('NOT_STARTED');
    }
  });

  it('SPEC-009 production remains deferred and unchanged', () => {
    expect(tasks).toContain('DEFERRED_UNCHANGED');
  });
});
