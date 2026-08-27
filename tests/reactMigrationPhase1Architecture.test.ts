/**
 * SPEC-010 Phase 1 — wave-1 architecture tests (T-010-110).
 *
 * Scope: `src/ui/**` only — the migrated React presentation layer. Legacy
 * modules are deliberately exempt until their own wave migrates them, and the
 * scope is stated explicitly here rather than left implicit, so widening it in a
 * later wave is a visible change.
 *
 * These assertions are the mechanical evidence for acceptance A8, A26, A32, A33
 * and threats T-010-01…04, plus the wave-1 portions of A16…A20 and A34.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..');
const UI_ROOT = join(ROOT, 'src/ui');

/** The single file allowed to import the legacy `dbService`. */
const COMPATIBILITY_FACADE = 'src/ui/data/compatibilityReads.ts';

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectFiles(full));
      continue;
    }
    if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const UI_FILES = collectFiles(UI_ROOT);
const rel = (file: string) => relative(ROOT, file).replace(/\\/g, '/');
const read = (file: string) => readFileSync(file, 'utf8');

/**
 * File contents with comments removed.
 *
 * Boundary violations are properties of code, not of prose. These modules
 * document the very patterns they forbid — e.g. the command seam explains which
 * legacy write kept invitation acceptance on the legacy path — so scanning raw
 * text would flag the documentation instead of a real breach. Assertions about
 * labels and documentation deliberately use `read` instead.
 */
const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('SPEC-010 wave-1 React layer exists and is scoped', () => {
  it('the React UI layer contains files', () => {
    expect(UI_FILES.length).toBeGreaterThan(0);
  });

  it('every React UI file lives under src/ui', () => {
    for (const file of UI_FILES) {
      expect(rel(file).startsWith('src/ui/')).toBe(true);
    }
  });
});

describe('A8 / T-010-01 — React modules never import dbService directly', () => {
  it('only the declared compatibility facade imports dbService', () => {
    const offenders = UI_FILES.filter((file) => {
      if (rel(file) === COMPATIBILITY_FACADE) return false;
      return /from\s+['"][^'"]*services\/db['"]/.test(code(file));
    }).map(rel);

    expect(offenders).toEqual([]);
  });

  it('the compatibility facade is explicitly labelled non-authoritative', () => {
    const source = read(join(ROOT, COMPATIBILITY_FACADE));
    expect(source).toContain('NONAUTHORITATIVE_COMPATIBILITY_READ');
  });

  it('the compatibility facade exposes no legacy mutator', () => {
    const source = code(join(ROOT, COMPATIBILITY_FACADE));
    // Every legacy write helper is named with one of these verbs.
    const mutators = /dbService\.(save|update|create|add|remove|delete|set|mark|record|reset|push)/;
    expect(mutators.test(source)).toBe(false);
  });
});

describe('A32 / T-010-02 — React never imports a canonical store', () => {
  it('no React UI file imports a Local*Store or infrastructure store', () => {
    const offenders = UI_FILES.filter((file) => {
      const source = code(file);
      return (
        /from\s+['"][^'"]*infrastructure\//.test(source) ||
        /\bLocal[A-Z]\w*Store\b/.test(source)
      );
    }).map(rel);

    expect(offenders).toEqual([]);
  });
});

describe('A33 / T-010-03 — React never imports Firestore', () => {
  it('no React UI file imports the Firebase/Firestore SDK', () => {
    const offenders = UI_FILES.filter((file) => {
      const source = code(file);
      return (
        /from\s+['"]firebase\//.test(source) ||
        /from\s+['"]firebase['"]/.test(source) ||
        /from\s+['"][^'"]*firebase\/config['"]/.test(source)
      );
    }).map(rel);

    expect(offenders).toEqual([]);
  });
});

describe('A26 / T-010-04 — React never reaches an AI provider', () => {
  it('no React UI file imports a provider SDK or calls a provider endpoint', () => {
    const forbidden = [
      /from\s+['"]openai['"]/,
      /from\s+['"]@anthropic-ai\//,
      /from\s+['"]@google\/generative-ai['"]/,
      /api\.openai\.com/,
      /api\.anthropic\.com/,
      /generativelanguage\.googleapis\.com/,
    ];

    const offenders = UI_FILES.filter((file) => {
      const source = code(file);
      return forbidden.some((pattern) => pattern.test(source));
    }).map(rel);

    expect(offenders).toEqual([]);
  });
});

describe('A34 / T-010-19 — no business authority inside the React layer', () => {
  it('no React UI file assigns a lifecycle status', () => {
    // Catches `status: 'APPROVED'`, `status = 'PUBLISHED'`, etc. The UI may
    // render a status but must never author one.
    const assignment =
      /\bstatus\s*[:=]\s*['"](APPROVED|APPLIED|PUBLISHED|COMPLETED|VERIFIED|REJECTED|ACTIVE)['"]/;

    const offenders = UI_FILES.filter((file) => assignment.test(code(file))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('no React UI file recreates scoring, routing or approval logic', () => {
    const forbidden = [
      /computeStrategicScore/,
      /calculateStrategicScore/,
      /routeSignal/,
      /scoreSignal/,
      /computeOpportunityScore/,
      /approveRecommendation\s*\(/,
      /applyRecommendation\s*\(/,
      /authorizePublication\s*\(/,
      /feedbackScoringHints/,
    ];

    const offenders = UI_FILES.filter((file) => {
      const source = code(file);
      return forbidden.some((pattern) => pattern.test(source));
    }).map(rel);

    expect(offenders).toEqual([]);
  });
});

describe('A16-A18 / T-010-09…11 — React cannot manufacture trusted identity', () => {
  it('no React UI file asserts a role or actor type as a literal', () => {
    const forbidden = [
      /\brole\s*[:=]\s*['"]ADMIN['"]/,
      /\bactorType\s*[:=]\s*['"]HUMAN['"]/,
      /\bisManager\s*[:=]\s*true/,
      /\bisAdmin\s*[:=]\s*true\b/,
    ];

    const offenders = UI_FILES.filter((file) => {
      const source = code(file);
      return forbidden.some((pattern) => pattern.test(source));
    }).map(rel);

    expect(offenders).toEqual([]);
  });

  it('the tenant scope can only be built from a trusted session user', () => {
    const source = read(join(ROOT, 'src/ui/query/tenantScope.ts'));
    // The single constructor takes a `User` from the trusted runtime.
    expect(source).toMatch(/export function buildTrustedTenantScope\(user: User\)/);
    // And the brand makes an object-literal forgery impossible outside this module.
    expect(source).toContain('declare const trustedTenantBrand: unique symbol');
  });

  it('the session projection exposes no setter', () => {
    const source = read(join(ROOT, 'src/ui/providers/SessionProvider.tsx'));
    expect(source).not.toMatch(/setUser\s*[,}]\s*=\s*useContext/);
    expect(source).toContain('NONAUTHORITATIVE_SESSION_PROJECTION');
  });
});

describe('A19 / T-010-08 — tenant-safe query keys', () => {
  it('every query key factory requires a trusted tenant scope', () => {
    const source = read(join(ROOT, 'src/ui/query/queryKeys.ts'));
    expect(source).toMatch(/export function tenantQueryKey\(\s*scope: TrustedTenantScope/);
  });

  it('no React UI file builds a bare entity-only query key', () => {
    // A tenant-owned key must come from `tenantQueryKey`. A literal array key is
    // only allowed as the disabled-query placeholder.
    const offenders: string[] = [];
    for (const file of UI_FILES) {
      const source = code(file);
      const matches = source.match(/queryKey:\s*\[[^\]]*\]/g) ?? [];
      for (const match of matches) {
        if (!match.includes("['disabled']")) offenders.push(`${rel(file)} → ${match}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('A20 / T-010-15 — multi-thesis preserved in the React layer', () => {
  it('no React UI file treats a first/primary thesis as authority', () => {
    const forbidden = [
      /getPrimaryThesis/,
      /primaryThesisId/,
      /\btheses\s*\[\s*0\s*\]/,
      /approvedBriefs\s*\[\s*0\s*\]/,
      /\.sort\([^)]*\)\s*\[\s*0\s*\]/,
    ];

    const offenders = UI_FILES.filter((file) => {
      const source = code(file);
      return forbidden.some((pattern) => pattern.test(source));
    }).map(rel);

    expect(offenders).toEqual([]);
  });
});

describe('A11 / T-010-05 — the query cache is non-authoritative', () => {
  it('the query client is documented and configured as a non-authoritative cache', () => {
    const source = read(join(ROOT, 'src/ui/providers/QueryProvider.tsx'));
    expect(source).toContain('NONAUTHORITATIVE_CACHE');
    // Always-stale plus no retry: cached data is never presented as current and a
    // denial is never retried into looking transient.
    expect(source).toMatch(/staleTime:\s*0/);
    expect(source).toMatch(/retry:\s*0/);
  });

  it('wave 1 introduces no optimistic mutation', () => {
    const offenders = UI_FILES.filter((file) => /onMutate\s*:/.test(code(file))).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('T-010-24 — exclusive DOM ownership', () => {
  it('the two roots are declared as siblings with distinct ids', () => {
    const html = read(join(ROOT, 'index.html'));
    expect(html).toContain('<div id="app"></div>');
    expect(html).toContain('<div id="react-root"></div>');
  });

  it('React only ever mounts into the react root', () => {
    const source = read(join(ROOT, 'src/ui/mount.ts'));
    expect(source).toMatch(/createRoot\(container\)/);
    expect(source).toMatch(/getElementById\(REACT_ROOT_ID\)/);
    // The legacy container id is referenced for documentation, never mounted into.
    expect(source).not.toMatch(/createRoot\([^)]*LEGACY_ROOT_ID/);
  });

  it('no React UI file writes into the legacy container', () => {
    const offenders = UI_FILES.filter((file) => {
      const source = code(file);
      return /getElementById\(\s*['"]app['"]\s*\)/.test(source);
    }).map(rel);

    expect(offenders).toEqual([]);
  });

  it('unmount restores the react root to its declared empty state', () => {
    const source = read(join(ROOT, 'src/ui/mount.ts'));
    expect(source).toMatch(/export function unmountReactShell/);
    expect(source).toMatch(/activeRoot\.unmount\(\)/);
  });
});

describe('T-010-26 — rollback is presentation-only', () => {
  it('the toggle only persists a presentation preference', () => {
    const source = code(join(ROOT, 'src/ui/strangler/toggle.ts'));
    expect(source).toMatch(/DEFAULT_UI_MODE: UiMode = 'legacy'/);
    // The toggle must not reach any data or business surface. `localStorage` is
    // permitted because the only value it holds is the presentation preference.
    expect(source).not.toMatch(/\bdbService\b/);
    expect(source).not.toMatch(/\bLocal[A-Z]\w*Store\b/);
    expect(source).not.toMatch(/firestore/i);
    expect(source).not.toMatch(/\w+Consumer\b/);
    // Its only storage key is the UI mode.
    const writes = source.match(/localStorage\.setItem\([^)]*\)/g) ?? [];
    expect(writes).toEqual(['localStorage.setItem(UI_MODE_STORAGE_KEY, mode)']);
  });

  it('the strangler CSS scopes itself to the two container ids', () => {
    const css = read(join(ROOT, 'src/ui/strangler/strangler.css'));
    expect(css).toContain('#app');
    expect(css).toContain('#react-root');
    // No global element/class selector that could reach legacy markup.
    expect(css).not.toMatch(/^\s*(body|\*|\.[\w-]+)\s*\{/m);
  });
});

describe('A10 / T-010-01 — the command seam is the only write path', () => {
  it('no React UI file performs a persistence write', () => {
    const forbidden = [
      /localStorage\.setItem/,
      /setDoc\s*\(/,
      /updateDoc\s*\(/,
      /addDoc\s*\(/,
      /deleteDoc\s*\(/,
    ];

    const offenders = UI_FILES.filter((file) => {
      if (rel(file) === 'src/ui/strangler/toggle.ts') return false; // presentation preference only
      const source = code(file);
      return forbidden.some((pattern) => pattern.test(source));
    }).map(rel);

    expect(offenders).toEqual([]);
  });

  it('the command seam delegates to the trusted auth runtime', () => {
    const source = code(join(ROOT, 'src/ui/commands/commandSeam.ts'));
    expect(source).toMatch(/from\s+['"]\.\.\/\.\.\/services\/auth['"]/);
    expect(source).not.toMatch(/\bdbService\b/);
  });
});

describe('Domain and Application remain free of React (constitution §22A)', () => {
  const layers = ['src/domain', 'src/application'];

  it('no domain or application file imports React or a query library', () => {
    const offenders: string[] = [];
    for (const layer of layers) {
      for (const file of collectFiles(join(ROOT, layer))) {
        const source = code(file);
        if (
          /from\s+['"]react['"]/.test(source) ||
          /from\s+['"]react-dom/.test(source) ||
          /from\s+['"]@tanstack\//.test(source) ||
          /from\s+['"]react-hook-form['"]/.test(source)
        ) {
          offenders.push(rel(file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
