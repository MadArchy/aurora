/**
 * SPEC-010 T-010-604 — anti-forgery closure contract.
 *
 * `assessClosure` classifies the four governance documents as OPEN (A44 pending, no sign-off),
 * CLOSED (A44 PASS, CODE_COMPLETE YES, human sign-off RECORDED over the closure evidence
 * checkpoint) or INVALID. Any mixture of OPEN and CLOSED traits, and any broken invariant, is
 * INVALID. The guard proves the recorded state is coherent; it cannot prove that a human approved
 * it — authenticity rests on the human message that supplies the sign-off.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const SPEC_DIR = 'specs/010-react-migration';

type ClosureState = 'OPEN' | 'CLOSED' | 'INVALID';
type TraitState = 'OPEN' | 'CLOSED' | 'UNKNOWN';
type CriterionStatus = 'PASS' | 'PARTIAL' | 'FAIL' | 'PENDING' | 'UNKNOWN';
type ExistsFn = (relativePath: string) => boolean;

interface ClosureDocs {
  acceptance: string;
  tasks: string;
  spec: string;
  threatModel: string;
}

interface Assessment {
  state: ClosureState;
  reasons: string[];
}

interface Tally {
  PASS: number;
  PARTIAL: number;
  FAIL: number;
  PENDING: number;
}

const STATEMENT =
  '«Apruebo formalmente el CODE_COMPLETE de SPEC-010 — React migration y autorizo el cierre de T-010-604.»';
const AUTH_TOKEN = 'AUTHORIZE_PHASE6_T604_CODE_COMPLETE_REVIEW';
const LEDGER_LINE = 'Ledger unchanged by T-010-604: **23 PASS · 3 PARTIAL · 0 FAIL**.';
const AUTOMATION_SIGNER = /\b(cursor|agent|automation|automated|ai|bot|assistant|llm|claude|gpt)\b/i;

const POLICY_BLOCK = [
  '## T-010-604 closure policies (human-frozen)',
  '',
  '| Policy | Value |',
  '|--------|-------|',
  '| `T604_PREREQUISITE_POLICY` | `STRICT_FULL_PASS` |',
  '| `A44_T604_RELATIONSHIP` | `T604_SUCCESS_EVIDENCE_SATISFIES_A44` |',
  '| `SPEC010_T604_ANTI_FORGERY_GUARD_REQUIRED` | `YES` |',
  '',
  '1. A1–A43 must each hold an individual **PASS** row; no aggregate approval substitutes for any criterion.',
  '2. A44 remains **PENDING** until T-010-604 succeeds.',
  '3. A44 may become **PASS** only when the T-010-604 closure evidence is recorded and the human sign-off below is **APPROVED**.',
  '4. CODE_COMPLETE requires recorded evidence **and** an independent human statement; neither alone suffices.',
  '5. T-010-604 does **not** authorize deployment. CODE_COMPLETE ≠ DONE ≠ DEPLOYED.',
  '6. CUTOVER-E (D1–D3) is a separate gate requiring separate authorization.',
  '7. Accepted nonblocking debt cannot mask a failed or missing required criterion.',
].join('\n');

const REQUIRED_EVIDENCE = [
  't-010-603-global-closure.md',
  't-010-604-a31-security-preservation-evidence.md',
  't-010-phase6-pre-removal-gates.md',
  't-010-phase6-a1-a44-reconciliation.md',
  't-010-phase5-formal-closure.md',
  'tests/t010510ThreatCapstone.test.ts',
];

const EVIDENCE_TOKEN =
  /^(t-010-[\w.-]+\.md|audit010-[\w.-]+\.md|tests\/[\w./-]+\.test\.ts|e2e\/[\w./-]+\.spec\.ts)$/;
const T603_ROW =
  /^(?![^\n]*(?:NOT AUTHORIZED|TODO|PENDING|\[ \]))\| \*\*T-010-603\*\* \|[^\n]*\| \*\*\[x\] DONE — FORMALLY_CLOSED\*\*[^|\n]*\|$/m;
const SHA40 = /\b[0-9a-f]{40}\b/g;

function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

function section(text: string, heading: RegExp): string | null {
  const match = heading.exec(text);
  if (!match) return null;
  const start = match.index;
  const next = text.indexOf('\n## ', start + match[0].length);
  return next === -1 ? text.slice(start) : text.slice(start, next);
}

function field(text: string, name: string): string | null {
  const match = new RegExp(`^\\| \\*\\*${escapeRegExp(name)}\\*\\* \\| (.*?) \\|$`, 'm').exec(text);
  return match ? match[1].trim() : null;
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function criterionRows(acceptance: string): Map<string, string> {
  const rows = new Map<string, string>();
  for (const line of acceptance.split('\n')) {
    const id = /^\|\s*(A\d+)\s*\|/.exec(line)?.[1];
    if (id && !rows.has(id)) rows.set(id, line);
  }
  return rows;
}

function criterionStatus(row: string | undefined): CriterionStatus {
  if (!row) return 'UNKNOWN';
  if (/✅ PASS/.test(row)) return 'PASS';
  if (/⚠️ PARTIAL/.test(row)) return 'PARTIAL';
  if (/❌ FAIL/.test(row)) return 'FAIL';
  if (/⏳ PENDING/.test(row)) return 'PENDING';
  return 'UNKNOWN';
}

function headerTally(acceptance: string): Tally | null {
  const match =
    /^\*\*A1-A44:\*\*\s*\*\*(\d+) PASS\*\*\s*·\s*\*\*(\d+) PARTIAL\*\*\s*·\s*\*\*(\d+) FAIL\*\*\s*·\s*\*\*(\d+) PENDING\*\*/m.exec(
      acceptance
    );
  if (!match) return null;
  return { PASS: Number(match[1]), PARTIAL: Number(match[2]), FAIL: Number(match[3]), PENDING: Number(match[4]) };
}

function sameTally(a: Tally, b: Tally): boolean {
  return a.PASS === b.PASS && a.PARTIAL === b.PARTIAL && a.FAIL === b.FAIL && a.PENDING === b.PENDING;
}

/** Nearest preceding heading or bold label line that frames an occurrence of the statement. */
function statementContexts(text: string): string[] {
  const lines = text.split('\n');
  const contexts: string[] = [];
  lines.forEach((line, index) => {
    const hits = countOccurrences(line, STATEMENT);
    for (let hit = 0; hit < hits; hit += 1) {
      let context = '';
      for (let back = index; back >= 0; back -= 1) {
        const candidate = lines[back];
        if (/^#{1,6} /.test(candidate) || /^\*\*.*:\*\*$/.test(candidate)) {
          context = candidate;
          break;
        }
      }
      contexts.push(context);
    }
  });
  return contexts;
}

function contextKind(context: string): 'FUTURE' | 'RECORDED' | 'OTHER' {
  if (/FUTURE|future/.test(context)) return 'FUTURE';
  if (/RECORDED/.test(context)) return 'RECORDED';
  return 'OTHER';
}

function binaryTrait(text: string, open: RegExp, closed: RegExp): TraitState {
  const isOpen = open.test(text);
  const isClosed = closed.test(text);
  if (isOpen === isClosed) return 'UNKNOWN';
  return isOpen ? 'OPEN' : 'CLOSED';
}

function assessClosure(input: ClosureDocs, exists: ExistsFn): Assessment {
  const acceptance = normalize(input.acceptance);
  const tasks = normalize(input.tasks);
  const spec = normalize(input.spec);
  const threatModel = normalize(input.threatModel);
  const reasons: string[] = [];
  const traits = new Map<string, TraitState>();

  // Criteria rows: exactly A1–A44, A1–A43 individually PASS (policy 1).
  const rows = criterionRows(acceptance);
  for (let n = 1; n <= 44; n += 1) {
    if (!rows.has(`A${n}`)) reasons.push(`criterion-missing:A${n}`);
  }
  if (rows.size !== 44) reasons.push('criteria-count');
  const statuses = new Map<string, CriterionStatus>();
  for (let n = 1; n <= 44; n += 1) statuses.set(`A${n}`, criterionStatus(rows.get(`A${n}`)));
  for (let n = 1; n <= 43; n += 1) {
    if (statuses.get(`A${n}`) !== 'PASS') reasons.push(`criterion-not-pass:A${n}`);
  }

  // Tally recomputed from rows must equal the header.
  const recomputed: Tally = { PASS: 0, PARTIAL: 0, FAIL: 0, PENDING: 0 };
  for (const status of statuses.values()) {
    if (status !== 'UNKNOWN') recomputed[status] += 1;
  }
  const header = headerTally(acceptance);
  if (!header) reasons.push('tally-header-missing');
  else if (!sameTally(header, recomputed)) reasons.push('tally-mismatch');
  traits.set(
    'tally',
    header && sameTally(header, { PASS: 43, PARTIAL: 0, FAIL: 0, PENDING: 1 })
      ? 'OPEN'
      : header && sameTally(header, { PASS: 44, PARTIAL: 0, FAIL: 0, PENDING: 0 })
        ? 'CLOSED'
        : 'UNKNOWN'
  );

  const a44 = statuses.get('A44');
  traits.set('a44', a44 === 'PENDING' ? 'OPEN' : a44 === 'PASS' ? 'CLOSED' : 'UNKNOWN');

  // Frozen A25 / A31 verdicts.
  const a25 = rows.get('A25') ?? '';
  if (statuses.get('A25') !== 'PASS' || !a25.includes('PRESERVED_SPEC004_CANONICAL_AUTHORITY')) {
    reasons.push('a25-altered');
  }
  const a31 = rows.get('A31') ?? '';
  if (statuses.get('A31') !== 'PASS' || !a31.includes('SPEC009_SECURITY_BOUNDARY_PRESERVED_AND_REFROZEN')) {
    reasons.push('a31-altered');
  }

  traits.set('codeComplete', binaryTrait(acceptance, /^\*\*CODE_COMPLETE:\*\* \*\*NO\*\*/m, /^\*\*CODE_COMPLETE:\*\* \*\*YES\*\*/m));

  // CODE_COMPLETE is never deployment (policy 5) and never CUTOVER-E (policy 6).
  if (!/^\*\*DEPLOYED:\*\* \*\*NO\*\*/m.test(acceptance) || !/\*\*DEPLOYMENT:\*\* \*\*NOT_STARTED\*\*/.test(acceptance)) {
    reasons.push('deployment-flag');
  }
  if (!/^\*\*CUTOVER-E:\*\* \*\*NOT_AUTHORIZED\*\*$/m.test(acceptance)) reasons.push('cutover-flag');
  for (const id of ['D1', 'D2', 'D3']) {
    if (!new RegExp(`^\\| \\*\\*${id}\\*\\* \\|[^\\n]*\\| \\*\\*NOT_STARTED\\*\\* \\|$`, 'm').test(tasks)) {
      reasons.push('cutover-implicit');
    }
  }
  if (!tasks.includes('Deployment requires separate authorization.')) reasons.push('cutover-implicit');
  if (!tasks.includes('SPEC-009 production remains **DEFERRED_UNCHANGED**')) reasons.push('spec009-flag');

  // T-603 stays formally closed, in exactly one row.
  if (!T603_ROW.test(tasks) || (tasks.match(/^\| \*\*T-010-603\*\* \|/gm) ?? []).length !== 1) {
    reasons.push('t603-altered');
  }
  if (!/^\*\*Phase 6:\*\*[^\n]*T-603 \*\*FORMALLY_CLOSED\*\*/m.test(acceptance)) reasons.push('t603-altered');

  if (!acceptance.includes(POLICY_BLOCK)) reasons.push('policies-altered');

  // Threat ledger 23/3/0; PARTIAL risks are never promoted by T-604.
  const disposition = section(threatModel, /^## Phase-6 threat disposition \(T-010-604\)$/m) ?? '';
  if (!disposition.includes(LEDGER_LINE)) reasons.push('threat-ledger');
  for (const id of ['T-010-20', 'T-010-25', 'T-010-26']) {
    if (!new RegExp(`^\\| ${id} \\| PARTIAL \\|`, 'm').test(disposition)) reasons.push('threat-partial-promoted');
  }

  // T-010-010 coherence: nothing reads PENDING while the header records the approval.
  if (/Human SPEC approval \*\*APPROVED\*\*/.test(acceptance)) {
    const t010 = section(acceptance, /^## Human SPEC approval \(T-010-010\).*$/m) ?? '';
    const status = field(t010, 'Status') ?? '';
    const pendingLine = [...acceptance.split('\n'), ...tasks.split('\n')].some(
      (line) => line.includes('T-010-010') && line.includes('PENDING') && !line.includes('APPROVED')
    );
    if (!status.includes('APPROVED') || status.includes('PENDING') || pendingLine) {
      reasons.push('t010010-incoherent');
    }
  }

  // Evidence references must resolve.
  const tokens = new Set<string>(REQUIRED_EVIDENCE);
  for (const row of rows.values()) {
    for (const match of row.matchAll(/`([^`]+)`/g)) {
      if (EVIDENCE_TOKEN.test(match[1])) tokens.add(match[1]);
    }
  }
  for (const token of tokens) {
    if (!exists(`${SPEC_DIR}/${token}`) && !exists(token)) reasons.push(`evidence-missing:${token}`);
  }

  // T-010-604 task row.
  const t604Rows = tasks.match(/^\| \*\*T-010-604\*\* \|[^\n]*$/gm) ?? [];
  const t604Row = t604Rows.length === 1 ? t604Rows[0] : '';
  if (t604Rows.length !== 1) reasons.push('t604-row-count');
  traits.set('t604Row', binaryTrait(t604Row, /\*\*\[ \] TODO/, /\*\*\[x\] DONE/));

  // Execution record and its validation evidence.
  const record = section(acceptance, /^## T-010-604 execution record$/m) ?? '';
  if (!record) reasons.push('execution-record-missing');
  const closureCheckpoint = /`([0-9a-f]{40})`/.exec(field(record, 'Closure evidence checkpoint') ?? '')?.[1] ?? null;
  const superseded: string[] = Array.from((field(record, 'Superseded checkpoints') ?? '').match(SHA40) ?? []);
  const authorizationDate = /\d{4}-\d{2}-\d{2}/.exec(field(record, 'Execution authorization date') ?? '')?.[0] ?? null;
  const validations = new Map<number, string>();
  for (const match of record.matchAll(/^\| V(\d+) \| [^|\n]+ \| ([^|\n]+) \|$/gm)) {
    validations.set(Number(match[1]), match[2].trim());
  }
  const allValidationsPass = Array.from({ length: 11 }, (_, i) => validations.get(i + 1) ?? '').every((result) =>
    result.startsWith('PASS')
  );
  const claimsReady = (field(record, 'Execution status') ?? '').includes('TECHNICALLY_READY_FOR_HUMAN_SIGNOFF');
  if (claimsReady && !allValidationsPass) reasons.push('validation-incomplete');

  // Human sign-off section.
  const signoffHeading = /^## Human CODE_COMPLETE \(T-010-604\) — (FUTURE|RECORDED)$/m.exec(acceptance);
  const signoff = section(acceptance, /^## Human CODE_COMPLETE \(T-010-604\) — (?:FUTURE|RECORDED)$/m) ?? '';
  const signoffStatus = field(signoff, 'Status') ?? '';
  if (signoffHeading?.[1] === 'FUTURE' && signoffStatus === '**TODO**') {
    traits.set('signoff', 'OPEN');
  } else if (signoffHeading?.[1] === 'RECORDED' && signoffStatus === '**APPROVED**') {
    traits.set('signoff', 'CLOSED');
    const signer = field(signoff, 'Signer') ?? '';
    if (!signer || /[<[\]]/.test(signer)) reasons.push('signoff-signer-missing');
    else if (AUTOMATION_SIGNER.test(signer)) reasons.push('signoff-signer-automation');
    const date = field(signoff, 'Date');
    if (!date) reasons.push('signoff-date-missing');
    else if (!isCalendarDate(date)) reasons.push('signoff-date-invalid');
    else if (!authorizationDate || date < authorizationDate) reasons.push('signoff-date-before-authorization');
    if (field(signoff, 'Time zone') !== 'America/Bogota') reasons.push('signoff-timezone-missing');
    if (!(field(signoff, 'Authorization') ?? '').includes(AUTH_TOKEN)) reasons.push('signoff-token-missing');
    const statement = field(signoff, 'Statement');
    if (!statement) reasons.push('statement-missing');
    else if (statement !== STATEMENT) reasons.push('statement-paraphrased');
    const checkpoint = /`([0-9a-f]{40})`/.exec(field(signoff, 'Checkpoint') ?? '')?.[1] ?? null;
    if (!checkpoint || !closureCheckpoint || checkpoint !== closureCheckpoint) {
      reasons.push('signoff-checkpoint-mismatch');
    }
    if (checkpoint && superseded.includes(checkpoint)) reasons.push('signoff-checkpoint-superseded');
    if (!allValidationsPass) reasons.push('validation-incomplete');
  } else {
    traits.set('signoff', 'UNKNOWN');
    reasons.push('signoff-incoherent');
  }

  // The verbatim statement: template only while OPEN; recorded (and nowhere FUTURE) once CLOSED.
  const accContexts = statementContexts(acceptance).map(contextKind);
  const taskContexts = statementContexts(tasks).map(contextKind);
  if ([...accContexts, ...taskContexts].includes('OTHER')) reasons.push('statement-out-of-context');
  const recordedAcc = accContexts.filter((kind) => kind === 'RECORDED').length;
  const recordedTasks = taskContexts.filter((kind) => kind === 'RECORDED').length;
  const futureCount = [...accContexts, ...taskContexts].filter((kind) => kind === 'FUTURE').length;
  if (recordedAcc === 0 && recordedTasks === 0) traits.set('statement', 'OPEN');
  else if (recordedAcc > 0 && recordedTasks > 0 && futureCount === 0) traits.set('statement', 'CLOSED');
  else traits.set('statement', 'UNKNOWN');
  if (traits.get('signoff') === 'CLOSED' && recordedAcc === 0 && accContexts.includes('FUTURE')) {
    reasons.push('statement-only-in-future');
  }
  if (traits.get('signoff') === 'OPEN' && recordedAcc + recordedTasks > 0) reasons.push('statement-recorded-while-open');

  // Phase 6 status, identical in all three documents.
  traits.set(
    'accPhase6',
    binaryTrait(acceptance, /^\*\*Phase 6:\*\* \*\*PRE_REMOVAL_GATES_COMPLETE\*\*/m, /^\*\*Phase 6:\*\* \*\*COMPLETE\*\*/m)
  );
  const tasksHeading = /^## Phase 6 — .+ — (COMPLETE|PRE_REMOVAL_GATES_COMPLETE)$/m.exec(tasks)?.[1] ?? '';
  const tasksSummary = /^\| 6 \| [^|\n]+\| \d+ \| \*\*(COMPLETE|PRE_REMOVAL_GATES_COMPLETE)\*\*/m.exec(tasks)?.[1] ?? '';
  traits.set(
    'tasksPhase6',
    tasksHeading === 'COMPLETE' && tasksSummary === 'COMPLETE'
      ? 'CLOSED'
      : tasksHeading === 'PRE_REMOVAL_GATES_COMPLETE' && tasksSummary === 'PRE_REMOVAL_GATES_COMPLETE'
        ? 'OPEN'
        : 'UNKNOWN'
  );
  const specPhase = /^\| \*\*Phase\*\* \|[^\n]*$/m.exec(spec)?.[0] ?? '';
  traits.set('specPhase6', binaryTrait(specPhase, /Phase 6 \*\*PRE_REMOVAL_GATES_COMPLETE\*\*/, /Phase 6 \*\*COMPLETE\*\*/));
  traits.set(
    'specT604',
    binaryTrait(specPhase, /T-604 \*\*EXECUTION AUTHORIZED — HUMAN SIGN-OFF PENDING\*\*/, /T-604 \*\*DONE\*\*/)
  );
  traits.set('specCodeComplete', binaryTrait(specPhase, /CODE_COMPLETE \*\*NO\*\*/, /CODE_COMPLETE \*\*YES\*\*/));

  // Classification.
  for (const [name, state] of traits) {
    if (state === 'UNKNOWN') reasons.push(`trait-unknown:${name}`);
  }
  const values = [...traits.values()];
  const hasOpen = values.includes('OPEN');
  const hasClosed = values.includes('CLOSED');
  if (hasOpen && hasClosed) {
    reasons.push('mixed-state');
    if (traits.get('a44') === 'CLOSED' && traits.get('t604Row') === 'OPEN') reasons.push('a44-pass-without-closure');
    if (traits.get('t604Row') === 'CLOSED' && traits.get('signoff') === 'OPEN') reasons.push('t604-done-without-signoff');
    const phase6Closed = ['accPhase6', 'tasksPhase6', 'specPhase6'].some((name) => traits.get(name) === 'CLOSED');
    if (phase6Closed && traits.get('a44') === 'OPEN') reasons.push('phase6-complete-without-a44');
    const accSide = [traits.get('accPhase6'), traits.get('codeComplete'), traits.get('t604Row')];
    const specSide = [traits.get('specPhase6'), traits.get('specCodeComplete'), traits.get('specT604')];
    if (accSide.some((state, i) => state !== specSide[i])) reasons.push('cross-doc-mismatch');
  }
  const anyCriterionOpen = [...statuses.values()].some((status) => status !== 'PASS');
  if (traits.get('codeComplete') === 'CLOSED' && anyCriterionOpen) reasons.push('code-complete-with-open-criterion');

  if (reasons.length > 0) return { state: 'INVALID', reasons: [...new Set(reasons)] };
  return { state: hasClosed ? 'CLOSED' : 'OPEN', reasons: [] };
}

// ---------------------------------------------------------------------------------------------
// Fixtures (in memory only; nothing is written to disk).

const repoExists: ExistsFn = (relativePath) => existsSync(join(ROOT, relativePath));

/** Synthetic sign-off values for in-memory fixtures. Not a human signature of any checkpoint. */
const FIXTURE_CHECKPOINT = 'f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1';
const FIXTURE_SIGNER = 'Synthetic Fixture Approver — Fixture Role';
const FIXTURE_DATE = '2026-10-20';
const HISTORICAL_CHECKPOINT = '197ba61cf6643f79b8aa3d3fc840b03aa35a926f';

function replaceOnce(text: string, search: string, replacement: string): string {
  const hits = countOccurrences(text, search);
  if (hits !== 1) throw new Error(`fixture mutation expected exactly one match, got ${hits}: ${search}`);
  return text.replace(search, () => replacement);
}

function replaceField(text: string, name: string, value: string): string {
  const pattern = new RegExp(`^\\| \\*\\*${escapeRegExp(name)}\\*\\* \\| .*? \\|$`, 'gm');
  const hits = text.match(pattern) ?? [];
  if (hits.length !== 1) throw new Error(`fixture field ${name}: expected one row, got ${hits.length}`);
  return text.replace(pattern, () => `| **${name}** | ${value} |`);
}

function removeField(text: string, name: string): string {
  const pattern = new RegExp(`^\\| \\*\\*${escapeRegExp(name)}\\*\\* \\| .*? \\|\\n`, 'gm');
  const hits = text.match(pattern) ?? [];
  if (hits.length !== 1) throw new Error(`fixture field ${name}: expected one row, got ${hits.length}`);
  return text.replace(pattern, '');
}

function recordedSignoff(): string {
  return [
    '## Human CODE_COMPLETE (T-010-604) — RECORDED',
    '',
    '| Field | Value |',
    '|-------|--------|',
    '| **Task** | T-010-604 |',
    '| **Status** | **APPROVED** |',
    `| **Signer** | ${FIXTURE_SIGNER} |`,
    `| **Date** | ${FIXTURE_DATE} |`,
    '| **Time zone** | America/Bogota |',
    `| **Checkpoint** | \`${FIXTURE_CHECKPOINT}\` |`,
    `| **Authorization** | \`${AUTH_TOKEN}\` |`,
    `| **Statement** | ${STATEMENT} |`,
    '',
  ].join('\n');
}

function futureSignoff(): string {
  return [
    '## Human CODE_COMPLETE (T-010-604) — FUTURE',
    '',
    '| Field | Value |',
    '|-------|--------|',
    '| **Task** | T-010-604 |',
    '| **Status** | **TODO** |',
    `| **Authorization text** | ${STATEMENT} |`,
    '',
  ].join('\n');
}

function validationRows(result: string): string {
  return Array.from({ length: 11 }, (_, i) => `| V${i + 1} | Validation ${i + 1} | ${result} |`).join('\n');
}

function criterionLines(a44Closed: boolean): string {
  const lines: string[] = [];
  for (let n = 1; n <= 44; n += 1) {
    let evidence = 'fixture evidence';
    if (n === 25) evidence = 'A25-P1 frozen (`PRESERVED_SPEC004_CANONICAL_AUTHORITY`)';
    if (n === 31) evidence = '`SPEC009_SECURITY_BOUNDARY_PRESERVED_AND_REFROZEN`: `t-010-604-a31-security-preservation-evidence.md`';
    if (n === 43) evidence = '`t-010-603-global-closure.md`';
    const status = n < 44 || a44Closed ? '✅ PASS' : '⏳ PENDING';
    lines.push(`| A${n} | Criterion ${n} | 6 | ${status} | ${evidence} |`);
  }
  return lines.join('\n');
}

function minimalDocs(state: 'OPEN' | 'CLOSED'): ClosureDocs {
  const closed = state === 'CLOSED';
  const acceptance = [
    '# Acceptance 010 — fixture',
    '',
    '**Phase 0:** **COMPLETE** · Human SPEC approval **APPROVED** (T-010-010, 2026-08-26 America/Bogota)',
    closed
      ? '**Phase 6:** **COMPLETE** · T-603 **FORMALLY_CLOSED** · T-604 **DONE**'
      : '**Phase 6:** **PRE_REMOVAL_GATES_COMPLETE** · T-603 **FORMALLY_CLOSED** · T-604 **EXECUTION AUTHORIZED — HUMAN SIGN-OFF PENDING**',
    closed
      ? '**A1-A44:** **44 PASS** · **0 PARTIAL** · **0 FAIL** · **0 PENDING**'
      : '**A1-A44:** **43 PASS** · **0 PARTIAL** · **0 FAIL** · **1 PENDING**',
    closed ? '**CODE_COMPLETE:** **YES**' : '**CODE_COMPLETE:** **NO**',
    '**DEPLOYED:** **NO** · **DONE:** **NO** · **DEPLOYMENT:** **NOT_STARTED**',
    '**CUTOVER-E:** **NOT_AUTHORIZED**',
    '',
    POLICY_BLOCK,
    '',
    '## T-010-604 execution record',
    '',
    '| Field | Value |',
    '|-------|-------|',
    '| **Execution authorization date** | 2026-10-15 (America/Bogota) |',
    `| **Superseded checkpoints** | \`${HISTORICAL_CHECKPOINT}\` |`,
    closed
      ? `| **Closure evidence checkpoint** | \`${FIXTURE_CHECKPOINT}\` |`
      : '| **Closure evidence checkpoint** | **PENDING** |',
    closed ? '| **Execution status** | **TECHNICALLY_READY_FOR_HUMAN_SIGNOFF** |' : '| **Execution status** | **PENDING** |',
    '',
    '### Act-B validation',
    '',
    '| V# | Validation | Result |',
    '|----|------------|--------|',
    validationRows(closed ? 'PASS (fixture)' : 'PENDING'),
    '',
    '## Required',
    '',
    '| # | Criterion | Phase | Status | Evidence |',
    '|---|-----------|-------|--------|----------|',
    criterionLines(closed),
    '',
    '## Human SPEC approval (T-010-010) — RECORDED',
    '',
    '| Field | Value |',
    '|-------|--------|',
    '| **Status** | **[x] DONE · APPROVED** (2026-08-26 America/Bogota) |',
    '',
    closed ? recordedSignoff() : futureSignoff(),
  ].join('\n');

  const tasks = [
    '# Tasks 010 — fixture',
    '',
    `## Phase 6 — Final acceptance — ${closed ? 'COMPLETE' : 'PRE_REMOVAL_GATES_COMPLETE'}`,
    '',
    '| ID | Title | Class | Depends on | Acceptance | Status |',
    '|----|-------|-------|-----------|------------|--------|',
    '| **T-010-603** | Remove legacy | TECHNICAL | T-010-602 | A43 | **[x] DONE — FORMALLY_CLOSED** |',
    closed
      ? '| **T-010-604** | **Human CODE_COMPLETE approval** | **HUMAN** | T-010-603 | gate | **[x] DONE** |'
      : '| **T-010-604** | **Human CODE_COMPLETE approval** | **HUMAN** | T-010-603 | gate | **[ ] TODO · EXECUTION AUTHORIZED (acts A/B) · HUMAN SIGN-OFF PENDING** |',
    '',
    closed
      ? '**Human CODE_COMPLETE statement (T-010-604) — RECORDED:**'
      : '**Required human CODE_COMPLETE statement (T-010-604) — future:**',
    '',
    `> ${STATEMENT}`,
    '',
    '## Deployment (separate — NOT AUTHORIZED)',
    '',
    '| Task | Title | Status |',
    '|------|-------|--------|',
    '| **D1** | Frontend rollout strategy | **NOT_STARTED** |',
    '| **D2** | Frontend rollback procedure | **NOT_STARTED** |',
    '| **D3** | Production cutover verification | **NOT_STARTED** |',
    '',
    'Deployment requires separate authorization. SPEC-009 production remains **DEFERRED_UNCHANGED**.',
    '',
    '## Summary task counts',
    '',
    '| Phase | ID range | Count | Status |',
    '|-------|----------|-------|--------|',
    `| 6 | T-010-601…604 | 4 | **${closed ? 'COMPLETE' : 'PRE_REMOVAL_GATES_COMPLETE'}** |`,
    '',
  ].join('\n');

  const spec = [
    '# Spec 010 — fixture',
    '',
    '| Field | Value |',
    '|-------|--------|',
    closed
      ? '| **Phase** | Phase 6 **COMPLETE** (T-603 **DONE — FORMALLY_CLOSED**; T-604 **DONE**) · CODE_COMPLETE **YES** |'
      : '| **Phase** | Phase 6 **PRE_REMOVAL_GATES_COMPLETE** (T-603 **DONE — FORMALLY_CLOSED**; T-604 **EXECUTION AUTHORIZED — HUMAN SIGN-OFF PENDING**) · CODE_COMPLETE **NO** |',
    '',
  ].join('\n');

  const threatModel = [
    '# Threat model 010 — fixture',
    '',
    '## Phase-6 threat disposition (T-010-604)',
    '',
    LEDGER_LINE + ' No threat promoted.',
    '',
    '| ID | Status | Remaining condition | Owner | Gate | CODE_COMPLETE |',
    '|----|--------|---------------------|-------|------|---------------|',
    '| T-010-20 | PARTIAL | display-only labels | later | CUTOVER-E | Compatible |',
    '| T-010-25 | PARTIAL | legacy write audit | owner | CUTOVER-E / D3 | Compatible |',
    '| T-010-26 | PARTIAL | residual legacy runtime | owner | removal unit | Compatible |',
    '',
  ].join('\n');

  return { acceptance, tasks, spec, threatModel };
}

function readRealDocs(): ClosureDocs {
  const read = (name: string): string => normalize(readFileSync(join(ROOT, SPEC_DIR, name), 'utf8'));
  return {
    acceptance: read('acceptance.md'),
    tasks: read('tasks.md'),
    spec: read('spec.md'),
    threatModel: read('threat-model.md'),
  };
}

/** What act D would have to change, applied in memory to the real documents. */
function closeInMemory(docs: ClosureDocs): ClosureDocs {
  let acceptance = docs.acceptance;
  acceptance = replaceOnce(
    acceptance,
    '**A1-A44:** **43 PASS** · **0 PARTIAL** · **0 FAIL** · **1 PENDING**',
    '**A1-A44:** **44 PASS** · **0 PARTIAL** · **0 FAIL** · **0 PENDING**'
  );
  acceptance = replaceOnce(acceptance, '| 6 | ⏳ PENDING |', '| 6 | ✅ PASS |');
  acceptance = replaceOnce(acceptance, '**CODE_COMPLETE:** **NO**', '**CODE_COMPLETE:** **YES**');
  acceptance = replaceOnce(acceptance, '**Phase 6:** **PRE_REMOVAL_GATES_COMPLETE**', '**Phase 6:** **COMPLETE**');
  acceptance = replaceField(acceptance, 'Closure evidence checkpoint', `\`${FIXTURE_CHECKPOINT}\``);
  acceptance = acceptance.replace(/^(\| V\d+ \| [^|\n]+ \| )[^|\n]+( \|)$/gm, '$1PASS (fixture)$2');
  const futureStart = acceptance.indexOf('## Human CODE_COMPLETE (T-010-604) — FUTURE');
  if (futureStart === -1) throw new Error('real acceptance has no FUTURE sign-off section');
  acceptance = acceptance.slice(0, futureStart) + recordedSignoff();

  let tasks = docs.tasks;
  tasks = replaceOnce(
    tasks,
    '**[ ] TODO · EXECUTION AUTHORIZED (acts A/B) · HUMAN SIGN-OFF PENDING** |',
    '**[x] DONE** |'
  );
  tasks = replaceOnce(tasks, '(§24 step 7) — PRE_REMOVAL_GATES_COMPLETE', '(§24 step 7) — COMPLETE');
  tasks = replaceOnce(tasks, '| 4 | **PRE_REMOVAL_GATES_COMPLETE**', '| 4 | **COMPLETE**');
  tasks = replaceOnce(
    tasks,
    '**Required human CODE_COMPLETE statement (T-010-604) — future:**',
    '**Human CODE_COMPLETE statement (T-010-604) — RECORDED:**'
  );

  let spec = docs.spec;
  spec = replaceOnce(spec, 'Phase 6 **PRE_REMOVAL_GATES_COMPLETE**', 'Phase 6 **COMPLETE**');
  spec = replaceOnce(spec, 'T-604 **EXECUTION AUTHORIZED — HUMAN SIGN-OFF PENDING**', 'T-604 **DONE**');
  spec = replaceOnce(spec, '· CODE_COMPLETE **NO** ·', '· CODE_COMPLETE **YES** ·');

  return { acceptance, tasks, spec, threatModel: docs.threatModel };
}

type Mutation = (docs: ClosureDocs) => ClosureDocs;

function mutate(base: ClosureDocs, mutation: Mutation): ClosureDocs {
  const next = mutation({ ...base });
  expect(next, 'mutation must change the fixture').not.toEqual(base);
  return next;
}

// ---------------------------------------------------------------------------------------------

describe('T-010-604 anti-forgery — positive classification', () => {
  it('minimal OPEN fixture is OPEN', () => {
    expect(assessClosure(minimalDocs('OPEN'), repoExists)).toEqual({ state: 'OPEN', reasons: [] });
  });

  it('minimal CLOSED fixture is CLOSED', () => {
    expect(assessClosure(minimalDocs('CLOSED'), repoExists)).toEqual({ state: 'CLOSED', reasons: [] });
  });

  it('real governance documents are coherent (never INVALID)', () => {
    const result = assessClosure(readRealDocs(), repoExists);
    expect(result.reasons).toEqual([]);
    expect(['OPEN', 'CLOSED']).toContain(result.state);
  });

  it('real documents become CLOSED only through every act-D change at once', () => {
    expect(assessClosure(closeInMemory(readRealDocs()), repoExists)).toEqual({ state: 'CLOSED', reasons: [] });
  });

  it('real documents: promoting A44 or CODE_COMPLETE alone is INVALID', () => {
    const docs = readRealDocs();
    if (assessClosure(docs, repoExists).state !== 'OPEN') return;
    const a44Only = mutate(docs, (d) => ({
      ...d,
      acceptance: replaceOnce(
        replaceOnce(d.acceptance, '| 6 | ⏳ PENDING |', '| 6 | ✅ PASS |'),
        '**A1-A44:** **43 PASS** · **0 PARTIAL** · **0 FAIL** · **1 PENDING**',
        '**A1-A44:** **44 PASS** · **0 PARTIAL** · **0 FAIL** · **0 PENDING**'
      ),
    }));
    expect(assessClosure(a44Only, repoExists).reasons).toContain('a44-pass-without-closure');
    const codeCompleteOnly = mutate(docs, (d) => ({
      ...d,
      acceptance: replaceOnce(d.acceptance, '**CODE_COMPLETE:** **NO**', '**CODE_COMPLETE:** **YES**'),
    }));
    const result = assessClosure(codeCompleteOnly, repoExists);
    expect(result.state).toBe('INVALID');
    expect(result.reasons).toContain('code-complete-with-open-criterion');
  });

  it('every required evidence reference and every A1–A44 evidence token resolves', () => {
    const rows = criterionRows(readRealDocs().acceptance);
    const tokens = new Set<string>(REQUIRED_EVIDENCE);
    for (const row of rows.values()) {
      for (const match of row.matchAll(/`([^`]+)`/g)) {
        if (EVIDENCE_TOKEN.test(match[1])) tokens.add(match[1]);
      }
    }
    for (const token of tokens) {
      expect(repoExists(`${SPEC_DIR}/${token}`) || repoExists(token), token).toBe(true);
    }
  });

  it('while OPEN, the verbatim statement exists only as the FUTURE template', () => {
    const docs = readRealDocs();
    if (assessClosure(docs, repoExists).state !== 'OPEN') return;
    const kinds = [...statementContexts(docs.acceptance), ...statementContexts(docs.tasks)].map(contextKind);
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds.every((kind) => kind === 'FUTURE')).toBe(true);
    expect(docs.acceptance).toMatch(/^## Human CODE_COMPLETE \(T-010-604\) — FUTURE$/m);
  });
});

const NEGATIVE_CASES: ReadonlyArray<{ id: string; title: string; base: 'OPEN' | 'CLOSED'; reason: string; mutation: Mutation }> = [
  {
    id: 'N1',
    title: 'A44 PASS with T-604 TODO',
    base: 'CLOSED',
    reason: 'a44-pass-without-closure',
    mutation: (d) => ({
      ...d,
      tasks: replaceOnce(d.tasks, 'gate | **[x] DONE** |', 'gate | **[ ] TODO** |'),
    }),
  },
  {
    id: 'N2',
    title: 'CODE_COMPLETE YES with an A* row PARTIAL',
    base: 'CLOSED',
    reason: 'code-complete-with-open-criterion',
    mutation: (d) => {
      let acceptance = replaceOnce(d.acceptance, '| A12 | Criterion 12 | 6 | ✅ PASS |', '| A12 | Criterion 12 | 6 | ⚠️ PARTIAL |');
      acceptance = replaceOnce(acceptance, '**44 PASS** · **0 PARTIAL**', '**43 PASS** · **1 PARTIAL**');
      return { ...d, acceptance };
    },
  },
  {
    id: 'N3',
    title: 'T-604 DONE with the sign-off still TODO',
    base: 'CLOSED',
    reason: 't604-done-without-signoff',
    mutation: (d) => ({ ...d, acceptance: replaceOnce(d.acceptance, recordedSignoff(), futureSignoff()) }),
  },
  {
    id: 'N4',
    title: 'statement present only inside the FUTURE section',
    base: 'CLOSED',
    reason: 'statement-only-in-future',
    mutation: (d) => ({
      ...d,
      acceptance: `${removeField(d.acceptance, 'Statement')}\n${futureSignoff().replace('## Human CODE_COMPLETE (T-010-604) — FUTURE', '### Template — FUTURE')}`,
    }),
  },
  {
    id: 'N5',
    title: 'APPROVED without a date',
    base: 'CLOSED',
    reason: 'signoff-date-missing',
    mutation: (d) => ({ ...d, acceptance: removeField(d.acceptance, 'Date') }),
  },
  {
    id: 'N6',
    title: 'APPROVED without America/Bogota',
    base: 'CLOSED',
    reason: 'signoff-timezone-missing',
    mutation: (d) => ({ ...d, acceptance: removeField(d.acceptance, 'Time zone') }),
  },
  {
    id: 'N7',
    title: 'header 44/0/0/0 with a PENDING row',
    base: 'CLOSED',
    reason: 'tally-mismatch',
    mutation: (d) => ({ ...d, acceptance: replaceOnce(d.acceptance, '| A44 | Criterion 44 | 6 | ✅ PASS |', '| A44 | Criterion 44 | 6 | ⏳ PENDING |') }),
  },
  {
    id: 'N8',
    title: 'Phase 6 COMPLETE with A44 PENDING',
    base: 'OPEN',
    reason: 'phase6-complete-without-a44',
    mutation: (d) => ({
      acceptance: replaceOnce(d.acceptance, '**Phase 6:** **PRE_REMOVAL_GATES_COMPLETE**', '**Phase 6:** **COMPLETE**'),
      tasks: replaceOnce(
        replaceOnce(d.tasks, 'Final acceptance — PRE_REMOVAL_GATES_COMPLETE', 'Final acceptance — COMPLETE'),
        '| 4 | **PRE_REMOVAL_GATES_COMPLETE** |',
        '| 4 | **COMPLETE** |'
      ),
      spec: replaceOnce(d.spec, 'Phase 6 **PRE_REMOVAL_GATES_COMPLETE**', 'Phase 6 **COMPLETE**'),
      threatModel: d.threatModel,
    }),
  },
  {
    id: 'N9',
    title: 'evidence token that does not exist',
    base: 'CLOSED',
    reason: 'evidence-missing:t-010-999-forged-evidence.md',
    mutation: (d) => ({
      ...d,
      acceptance: replaceOnce(d.acceptance, '`t-010-603-global-closure.md` |', '`t-010-603-global-closure.md` · `t-010-999-forged-evidence.md` |'),
    }),
  },
  {
    id: 'N10',
    title: 'spec.md OPEN while acceptance.md CLOSED',
    base: 'CLOSED',
    reason: 'cross-doc-mismatch',
    mutation: (d) => ({ ...d, spec: minimalDocs('OPEN').spec }),
  },
  {
    id: 'N11',
    title: 'CODE_COMPLETE YES read as deployment (DEPLOYED YES)',
    base: 'CLOSED',
    reason: 'deployment-flag',
    mutation: (d) => ({ ...d, acceptance: replaceOnce(d.acceptance, '**DEPLOYED:** **NO**', '**DEPLOYED:** **YES**') }),
  },
  {
    id: 'N11b',
    title: 'DEPLOYMENT other than NOT_STARTED',
    base: 'CLOSED',
    reason: 'deployment-flag',
    mutation: (d) => ({
      ...d,
      acceptance: replaceOnce(d.acceptance, '**DEPLOYMENT:** **NOT_STARTED**', '**DEPLOYMENT:** **IN_PROGRESS**'),
    }),
  },
  {
    id: 'N12',
    title: 'D1 other than NOT_STARTED (implicit CUTOVER-E)',
    base: 'CLOSED',
    reason: 'cutover-implicit',
    mutation: (d) => ({
      ...d,
      tasks: replaceOnce(d.tasks, '| **D1** | Frontend rollout strategy | **NOT_STARTED** |', '| **D1** | Frontend rollout strategy | **IN_PROGRESS** |'),
    }),
  },
  {
    id: 'N12b',
    title: '"Deployment requires separate authorization" removed',
    base: 'CLOSED',
    reason: 'cutover-implicit',
    mutation: (d) => ({ ...d, tasks: replaceOnce(d.tasks, 'Deployment requires separate authorization. ', '') }),
  },
  {
    id: 'N13',
    title: 'threat ledger 24/2/0',
    base: 'CLOSED',
    reason: 'threat-ledger',
    mutation: (d) => ({ ...d, threatModel: replaceOnce(d.threatModel, '**23 PASS · 3 PARTIAL · 0 FAIL**', '**24 PASS · 2 PARTIAL · 0 FAIL**') }),
  },
  {
    id: 'N14',
    title: 'policy block altered',
    base: 'CLOSED',
    reason: 'policies-altered',
    mutation: (d) => ({ ...d, acceptance: replaceOnce(d.acceptance, '`STRICT_FULL_PASS`', '`BEST_EFFORT`') }),
  },
  {
    id: 'N14b',
    title: 'policy block absent',
    base: 'CLOSED',
    reason: 'policies-altered',
    mutation: (d) => ({ ...d, acceptance: replaceOnce(d.acceptance, POLICY_BLOCK, '') }),
  },
  {
    id: 'N15',
    title: 'statement paraphrased by one word',
    base: 'CLOSED',
    reason: 'statement-paraphrased',
    mutation: (d) => {
      const paraphrase = STATEMENT.replace('formalmente', 'oficialmente');
      return {
        ...d,
        acceptance: replaceOnce(d.acceptance, `| **Statement** | ${STATEMENT} |`, `| **Statement** | ${paraphrase} |`),
        tasks: replaceOnce(d.tasks, `> ${STATEMENT}`, `> ${paraphrase}`),
      };
    },
  },
];

const ADDITIONAL_CASES: ReadonlyArray<{ id: string; title: string; reason: string; mutation: Mutation }> = [
  {
    id: 'X1',
    title: 'signer absent',
    reason: 'signoff-signer-missing',
    mutation: (d) => ({ ...d, acceptance: removeField(d.acceptance, 'Signer') }),
  },
  {
    id: 'X2',
    title: 'signer is an automation (fabricated signature)',
    reason: 'signoff-signer-automation',
    mutation: (d) => ({ ...d, acceptance: replaceField(d.acceptance, 'Signer', 'Cursor Agent') }),
  },
  {
    id: 'X3',
    title: 'impossible calendar date',
    reason: 'signoff-date-invalid',
    mutation: (d) => ({ ...d, acceptance: replaceField(d.acceptance, 'Date', '2026-02-30') }),
  },
  {
    id: 'X4',
    title: 'historical 2026-10-12 signature on 197ba61 reused as the final sign-off',
    reason: 'signoff-checkpoint-superseded',
    mutation: (d) => ({
      ...d,
      acceptance: replaceField(replaceField(d.acceptance, 'Checkpoint', `\`${HISTORICAL_CHECKPOINT}\``), 'Date', '2026-10-12'),
    }),
  },
  {
    id: 'X5',
    title: 'sign-off checkpoint differs from the closure evidence checkpoint',
    reason: 'signoff-checkpoint-mismatch',
    mutation: (d) => ({ ...d, acceptance: replaceField(d.acceptance, 'Checkpoint', `\`${'e'.repeat(40)}\``) }),
  },
  {
    id: 'X6',
    title: 'sign-off dated before the execution authorization',
    reason: 'signoff-date-before-authorization',
    mutation: (d) => ({ ...d, acceptance: replaceField(d.acceptance, 'Date', '2026-10-14') }),
  },
  {
    id: 'X7',
    title: 'closure with an incomplete validation (V10 FAIL)',
    reason: 'validation-incomplete',
    mutation: (d) => ({ ...d, acceptance: replaceOnce(d.acceptance, '| V10 | Validation 10 | PASS (fixture) |', '| V10 | Validation 10 | FAIL |') }),
  },
  {
    id: 'X8',
    title: 'closure with a validation row missing (V6)',
    reason: 'validation-incomplete',
    mutation: (d) => ({ ...d, acceptance: replaceOnce(d.acceptance, '| V6 | Validation 6 | PASS (fixture) |\n', '') }),
  },
  {
    id: 'X9',
    title: 'A25 frozen verdict altered',
    reason: 'a25-altered',
    mutation: (d) => ({ ...d, acceptance: replaceOnce(d.acceptance, '`PRESERVED_SPEC004_CANONICAL_AUTHORITY`', '`PRESERVED`') }),
  },
  {
    id: 'X10',
    title: 'A31 frozen verdict altered',
    reason: 'a31-altered',
    mutation: (d) => ({
      ...d,
      acceptance: replaceOnce(d.acceptance, '`SPEC009_SECURITY_BOUNDARY_PRESERVED_AND_REFROZEN`', '`SPEC009_BOUNDARY`'),
    }),
  },
  {
    id: 'X11',
    title: 'T-603 row reopened',
    reason: 't603-altered',
    mutation: (d) => ({
      ...d,
      tasks: replaceOnce(d.tasks, '**[x] DONE — FORMALLY_CLOSED** |', '**[x] DONE — FORMALLY_CLOSED** · NOT AUTHORIZED |'),
    }),
  },
  {
    id: 'X12',
    title: 'PARTIAL threat T-010-25 promoted to PASS',
    reason: 'threat-partial-promoted',
    mutation: (d) => ({ ...d, threatModel: replaceOnce(d.threatModel, '| T-010-25 | PARTIAL |', '| T-010-25 | PASS |') }),
  },
  {
    id: 'X13',
    title: 'CUTOVER-E flag changed',
    reason: 'cutover-flag',
    mutation: (d) => ({ ...d, acceptance: replaceOnce(d.acceptance, '**CUTOVER-E:** **NOT_AUTHORIZED**', '**CUTOVER-E:** **AUTHORIZED**') }),
  },
  {
    id: 'X14',
    title: 'T-010-010 reads PENDING while the header says APPROVED',
    reason: 't010010-incoherent',
    mutation: (d) => ({
      ...d,
      acceptance: replaceOnce(d.acceptance, '| **Status** | **[x] DONE · APPROVED** (2026-08-26 America/Bogota) |', '| **Status** | **TODO · PENDING HUMAN** |'),
    }),
  },
];

describe('T-010-604 anti-forgery — negative cases N1–N15 (each INVALID with its reason)', () => {
  for (const testCase of NEGATIVE_CASES) {
    it(`${testCase.id}: ${testCase.title}`, () => {
      const result = assessClosure(mutate(minimalDocs(testCase.base), testCase.mutation), repoExists);
      expect(result.state).toBe('INVALID');
      expect(result.reasons).toContain(testCase.reason);
    });
  }

  it('covers N1 through N15', () => {
    const ids = new Set(NEGATIVE_CASES.map((testCase) => testCase.id.replace(/b$/, '')));
    for (let n = 1; n <= 15; n += 1) expect(ids.has(`N${n}`), `N${n}`).toBe(true);
  });
});

describe('T-010-604 anti-forgery — signature, checkpoint, evidence and frozen-state protections', () => {
  for (const testCase of ADDITIONAL_CASES) {
    it(`${testCase.id}: ${testCase.title}`, () => {
      const result = assessClosure(mutate(minimalDocs('CLOSED'), testCase.mutation), repoExists);
      expect(result.state).toBe('INVALID');
      expect(result.reasons).toContain(testCase.reason);
    });
  }

  it('an OPEN record that claims TECHNICALLY_READY_FOR_HUMAN_SIGNOFF must carry eleven PASS validations', () => {
    const claimsReady = mutate(minimalDocs('OPEN'), (d) => ({
      ...d,
      acceptance: replaceField(d.acceptance, 'Execution status', '**TECHNICALLY_READY_FOR_HUMAN_SIGNOFF**'),
    }));
    expect(assessClosure(claimsReady, repoExists).reasons).toContain('validation-incomplete');
  });

  it('an OPEN record cannot carry a recorded statement', () => {
    const forged = mutate(minimalDocs('OPEN'), (d) => ({
      ...d,
      tasks: replaceOnce(
        d.tasks,
        '**Required human CODE_COMPLETE statement (T-010-604) — future:**',
        '**Human CODE_COMPLETE statement (T-010-604) — RECORDED:**'
      ),
    }));
    const result = assessClosure(forged, repoExists);
    expect(result.state).toBe('INVALID');
    expect(result.reasons).toContain('statement-recorded-while-open');
  });
});
