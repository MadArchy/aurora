/**
 * SPEC-010 Phase 4 (T-010-401…405) — architecture guards for the controller
 * strangler.
 *
 * These assertions exist to stop the extraction from becoming a regression: a
 * smaller `main.ts` that leaked authority into React, or an extracted module that
 * quietly acquired the ability to write, would be worse than no extraction at
 * all. Where an assertion overlaps a Phase-1…3 guard it is repeated deliberately,
 * because the surface it guards changed in this phase.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(path, 'utf8');
const rel = (path: string) => path.slice(ROOT.length + 1).replace(/\\/g, '/');

/** Strips comments so a rule cannot be satisfied or broken by prose. */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
};

const MAIN = join(ROOT, 'src/main.ts');
const CONTROLLER_DIR = join(ROOT, 'src/controllers');
const CONTROLLER_FILES = walk(CONTROLLER_DIR);
const UI_FILES = walk(join(ROOT, 'src/ui'));

const EXTRACTED = {
  uiState: join(CONTROLLER_DIR, 'appUiState.ts'),
  toasts: join(CONTROLLER_DIR, 'toastController.ts'),
  modals: join(CONTROLLER_DIR, 'modalPresenter.ts'),
  navigation: join(CONTROLLER_DIR, 'navigationController.ts'),
};

describe('T-010-402 — the extracted UI orchestration exists and is genuinely extracted', () => {
  it('all four responsibilities have their own module', () => {
    for (const [name, file] of Object.entries(EXTRACTED)) {
      expect(readFileSync(file, 'utf8').length, name).toBeGreaterThan(0);
    }
  });

  it('main.ts no longer declares the presentation state it used to own', () => {
    const source = code(MAIN);
    // The fields moved to AppUiState. Accessors may remain; declarations may not.
    expect(source).not.toMatch(/private activeTab: string = 'dashboard'/);
    expect(source).not.toMatch(/private activeClientId: string = 'all'/);
    expect(source).not.toMatch(/private toasts: ToastItem\[\]/);
    expect(source).not.toMatch(/private filterState = \{/);
    expect(source).toMatch(/new AppUiState\(\)/);
    expect(source).toMatch(/new ToastController\(\)/);
  });

  it('main.ts no longer owns the modal dispatch table', () => {
    const source = code(MAIN);
    expect(source).toMatch(/presentActiveModal\(/);
    // The 17-branch if-chain and its component imports are gone.
    expect(source).not.toMatch(/renderComparativeModal|renderChallengeModal|renderAddTaskModal/);
    expect(source).not.toMatch(/renderOnboardingWizard|renderThesisEditorModal|renderSourceRegistryModal/);
  });

  it('main.ts no longer owns the tab transition rule', () => {
    const source = code(MAIN);
    expect(source).toMatch(/resolveTabTransition\(/);
    expect(source).not.toMatch(/normalizeTab\(tab\)/);
  });
});

describe('§15 / §11 — no business authority moved into the extracted modules', () => {
  it('no extracted controller writes through dbService, a store or Firestore', () => {
    const banned = [
      /dbService\.(save|add|create|update|delete|remove|set|apply|assign|push|record|register|upsert|mark|complete|approve|reject|link|move|archive|transition)/,
      /Local[A-Za-z]*Store/,
      /firebase\/(firestore|config)/,
      /from\s+['"]firebase/,
    ];
    const offenders: string[] = [];
    for (const file of CONTROLLER_FILES) {
      const source = code(file);
      if (banned.some((pattern) => pattern.test(source))) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });

  it('the presentation state store imports nothing that could give it authority', () => {
    const source = code(EXTRACTED.uiState);
    expect(source).not.toMatch(/^import /m);
    expect(source).not.toMatch(/dbService|authService|document|window|localStorage/);
  });

  it('no extracted controller decides a lifecycle', () => {
    // Assignment of a canonical status, not comparison against one.
    const banned = [
      /[^!=<>]=\s*['"](APPROVED|PUBLISHED|COMPLETED|APPLIED|VERIFIED)['"]/,
      /status\s*:\s*['"](APPROVED|PUBLISHED|COMPLETED|APPLIED|VERIFIED)['"]/,
    ];
    const offenders: string[] = [];
    for (const file of CONTROLLER_FILES) {
      const source = code(file);
      if (banned.some((pattern) => pattern.test(source))) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });

  it('no extracted controller recreates a score, a routing decision or a gate', () => {
    const banned = [
      /function\s+\w*(score|Score|rank|Rank)\w*\s*\(/,
      /routingState\s*=/,
      /weight\s*\*\s*/,
      /authorizeStrategicDownstream|assertClaimSafeTransition/,
    ];
    const offenders: string[] = [];
    for (const file of CONTROLLER_FILES) {
      const source = code(file);
      if (banned.some((pattern) => pattern.test(source))) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });
});

describe('§12 / §13 — trusted identity and caller authority', () => {
  it('the extracted modules never manufacture an actor, a role or a tenant', () => {
    const banned = [
      /actorRole\s*:\s*['"]/,
      /actorType\s*:\s*['"]/,
      /role\s*:\s*['"](ADMIN|MANAGER|CLIENT|SYSTEM)['"]/,
      /organizationId\s*:\s*['"][^'"]+['"]/,
    ];
    const offenders: string[] = [];
    for (const file of CONTROLLER_FILES) {
      const source = code(file);
      if (banned.some((pattern) => pattern.test(source))) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });

  it('the modal presenter receives the manager flag rather than deriving it', () => {
    const source = code(EXTRACTED.modals);
    expect(source).toMatch(/isAdmin: boolean/);
    // It must not consult the session itself — that is the caller's trusted job.
    expect(source).not.toMatch(/authService/);
  });

  it('the state store exposes no way to grant or assert tenant access', () => {
    const source = code(EXTRACTED.uiState);
    // It holds a selected client for display. It must not resolve an
    // organization, claim a tenant, or expose an authorization answer.
    expect(source).not.toMatch(/organizationId/);
    expect(source).not.toMatch(/claimed[A-Z]/);
    expect(source).not.toMatch(/can[A-Z]\w*\(|isAuthorized|hasAccess|permitted/);
  });
});

describe('§9 — no material effect runs during a render or at bind time', () => {
  const EFFECT =
    /(dbService\.(save|add|create|update|delete|remove|set|apply|assign|push|record|register|upsert|mark|complete|approve|reject|link|move|archive|transition)[A-Za-z]*\()|runSourceDiscoveryAgentAsync|runTopicAgent|runResearchSignalsAgent|aiService\.[a-zA-Z]+\(|notifyClient\(|notifyManager\(|fetchSourceItems\(|pushCurrentLocalToFirestore\(/;

  it('no extracted controller performs a material effect at all', () => {
    const offenders = CONTROLLER_FILES.filter((file) => EFFECT.test(code(file))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('the modal presenter is a pure function of its context', () => {
    const source = code(EXTRACTED.modals);
    // The manager-only refusal is returned, not applied by mutating state.
    expect(source).toMatch(/forceClose: true/);
    expect(source).not.toMatch(/activeModal\s*=\s*null/);
  });

  it('no React page or hook performs an effect while rendering', () => {
    // A mutation call at module or component top level (not inside a callback)
    // would run during render. The seam's mutate functions must be invoked from
    // an event handler or a mutation hook, never inline.
    const offenders: string[] = [];
    for (const file of UI_FILES) {
      if (!/\.tsx$/.test(file)) continue;
      const source = code(file);
      if (/^\s{0,4}(await\s+)?commandSeam\./m.test(source)) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });
});

describe('§16 / §26 — the React write ban still holds after the extraction', () => {
  it('React modules import dbService only through the declared facade', () => {
    const importers = UI_FILES.filter((file) => /from\s+['"][^'"]*services\/db['"]/.test(code(file))).map(rel);
    expect(importers).toEqual(['src/ui/data/compatibilityReads.ts']);
  });

  it('the compatibility facade still exposes no mutator', () => {
    const source = code(join(ROOT, 'src/ui/data/compatibilityReads.ts'));
    const exported = source.match(/export (?:async )?function (\w+)/g) || [];
    const nonReaders = exported.filter((name) => !/function read/.test(name));
    expect(nonReaders).toEqual([]);
  });

  it('no React module imports a store, Firestore or an AI provider', () => {
    const banned = [
      /Local[A-Za-z]*Store/,
      /from\s+['"][^'"]*firebase\/(firestore|config)['"]/,
      /from\s+['"](openai|@anthropic-ai\/[^'"]*|@google\/generative-ai)['"]/,
    ];
    const offenders: string[] = [];
    for (const file of UI_FILES) {
      const source = code(file);
      if (banned.some((pattern) => pattern.test(source))) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });
});

describe('§10 — the blocked writes were not wrapped to look canonical', () => {
  // If Phase 4 had "solved" AUDIT010-09 by wrapping legacy writes in a new
  // module, these symbols would appear outside main.ts and the legacy services.
  const BLOCKED = [
    // applyOnboardingStep is CR-1 Master Profile canonical (seam → consumer).
    'saveThesis',
    'addDeliveryItem',
    'setCurationStrategicBriefId',
    'updateTaskStatus',
    'saveContent',
    'addFeedbackEvent',
    'addSignal',
    'recordSourceRun',
    'transitionContentPipeline',
    'updateClient',
  ];

  it('no extracted controller references a blocked write', () => {
    const offenders: string[] = [];
    for (const file of CONTROLLER_FILES) {
      const source = code(file);
      for (const symbol of BLOCKED) {
        if (source.includes(symbol)) offenders.push(`${rel(file)}:${symbol}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no React module references a blocked write', () => {
    const offenders: string[] = [];
    for (const file of UI_FILES) {
      const source = code(file);
      for (const symbol of BLOCKED) {
        if (new RegExp(`\\b${symbol}\\s*\\(`).test(source)) offenders.push(`${rel(file)}:${symbol}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('§8 — the render-time discovery path is still not migrated', () => {
  it('no React module runs the source discovery agent', () => {
    const offenders = UI_FILES.filter((file) =>
      /runSourceDiscoveryAgent(Async)?\s*\(/.test(code(file))
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it('main.ts reaches the network-bearing variant only from intent-driven paths', () => {
    const source = code(MAIN);
    // The synchronous variant re-derives and reads; the async one does network.
    // The controller must only use the async one, which it gates behind a click
    // and behind the hourly tick.
    expect(source).toMatch(/runSourceDiscoveryAgentAsync/);
    expect(source).not.toMatch(/render[A-Za-z]*\(\)[^{]*\{[^}]*runSourceDiscoveryAgent/);
  });
});

describe('§24 — the routing decision is unchanged', () => {
  it('no routing library was introduced', () => {
    const pkg = JSON.parse(read(join(ROOT, 'package.json'))) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const banned of ['react-router', 'react-router-dom', '@tanstack/react-router', 'wouter', 'next', 'remix']) {
      expect(all[banned]).toBeUndefined();
    }
  });

  it('the extracted navigation module does not touch the URL', () => {
    const source = code(EXTRACTED.navigation);
    expect(source).not.toMatch(/history\.(push|replace)State|location\.(href|pathname|search|hash)/);
  });
});

describe('§20 / §23 — DOM ownership and frozen SPECs', () => {
  it('the toast controller owns only its own container', () => {
    const source = code(EXTRACTED.toasts);
    expect(source).toMatch(/getElementById\('toast-container'\)/);
    // It must not reach into the legacy root or the React root.
    expect(source).not.toMatch(/getElementById\('app'\)|react-root/);
  });

  it('no extracted controller imports an Application module', () => {
    const offenders = CONTROLLER_FILES.filter((file) =>
      /from\s+['"][^'"]*application\//.test(code(file))
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it('no extracted controller imports a domain module in order to decide', () => {
    // Reading a domain projection is fine for presentation; none of these modules
    // needs one, and importing one would be the first step to duplicating a rule.
    const offenders = CONTROLLER_FILES.filter((file) => /from\s+['"][^'"]*domain\//.test(code(file))).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('T-010-401 — the audit is recorded, not asserted', () => {
  it('the controller audit document exists and reports every required class', () => {
    const audit = read(join(ROOT, 'specs/010-react-migration/main-controller-audit.md'));
    for (const required of [
      'GATE_FIRST',
      'EFFECT_FIRST',
      'UNKNOWN',
      'LEGACY_BUSINESS_WRITE',
      'RETAINED_LEGACY_BY_AUDIT010_09',
      'RENDER_TIME_RECOMPUTATION',
    ]) {
      expect(audit, required).toContain(required);
    }
  });

  it('the acceptance summary line matches the criteria rows', () => {
    // Phase 3 logged a tally-drift defect and Phase 4 found a second instance:
    // nine rows read PENDING while the summary counted them PARTIAL. Counting the
    // rows here means the two cannot disagree again without a test failing.
    const text = read(join(ROOT, 'specs/010-react-migration/acceptance.md'));
    const rows = text.split('\n').filter((l) => /^\|\s*A\d+\s*\|/.test(l));

    const seen = new Set<string>();
    const tally = { PASS: 0, PARTIAL: 0, FAIL: 0, PENDING: 0 };
    for (const row of rows) {
      const id = /^\|\s*(A\d+)\s*\|/.exec(row)?.[1];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (/✅ PASS/.test(row)) tally.PASS += 1;
      else if (/⚠️ PARTIAL/.test(row)) tally.PARTIAL += 1;
      else if (/❌ FAIL/.test(row)) tally.FAIL += 1;
      else if (/⏳ PENDING/.test(row)) tally.PENDING += 1;
    }

    expect(seen.size).toBe(44);

    const summary = /\*\*A1-A44:\*\*\s*\*\*(\d+) PASS\*\*\s*·\s*\*\*(\d+) PARTIAL\*\*\s*·\s*\*\*(\d+) FAIL\*\*\s*·\s*\*\*(\d+) PENDING\*\*/.exec(text);
    expect(summary, 'acceptance summary line must be parseable').not.toBeNull();
    expect({
      PASS: Number(summary![1]),
      PARTIAL: Number(summary![2]),
      FAIL: Number(summary![3]),
      PENDING: Number(summary![4]),
    }).toEqual(tally);
  });

  it('the audit scripts it cites are present and runnable', () => {
    for (const script of [
      'scripts/auditMainController.mjs',
      'scripts/auditBindTimeEffects.mjs',
      'scripts/auditHandlerOrdering.mjs',
      'scripts/mainStatsGit.mjs',
    ]) {
      expect(readFileSync(join(ROOT, script), 'utf8').length, script).toBeGreaterThan(0);
    }
  });
});
