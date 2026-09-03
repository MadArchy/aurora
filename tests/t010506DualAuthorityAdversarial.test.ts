/**
 * SPEC-010 T-010-506 — dual-authority suite (A35, A36, A37, A38 · T-010-12…24).
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import {
  code,
  read,
  REACT_UI_FILES,
  rel,
  ROOT,
  PHASE4_EXTRACTED_CONTROLLERS,
} from './lib/reactMigrationPhase5Surface';

describe('T-010-506 — shell and navigation ownership', () => {
  it('ACTIVE GLOBAL SHELLS = 1 — main.ts boots one presentation owner', () => {
    const main = read(join(ROOT, 'src/main.ts'));
    expect(main).toMatch(/createLegacyApp/);
    expect(main).toMatch(/initReactStrangler/);
    expect(main).toMatch(/exposeStranglerControls/);
    expect(main).not.toMatch(/new LegacyApp\(\)/);
  });

  it('LegacyApp remains the legacy island host under React shell', () => {
    const legacy = read(join(ROOT, 'src/ui/legacy/LegacyApp.ts'));
    expect(legacy).toMatch(/mountLegacyIsland/);
    expect(legacy).toMatch(/Stage-B legacy island host/);
  });

  it('NORMAL NAVIGATION AUTHORITIES = 1 — navigationController owns tab transitions', () => {
    const nav = read(join(ROOT, 'src/controllers/navigationController.ts'));
    expect(nav.length).toBeGreaterThan(0);
    const legacy = code(join(ROOT, 'src/ui/legacy/LegacyApp.ts'));
    expect(legacy).toMatch(/resolveTabTransition\(/);
    expect(legacy).not.toMatch(/normalizeTab\(tab\)/);
  });
});

describe('T-010-506 — DUAL COMMAND AUTHORITY = 0', () => {
  it('command seam is the sole React command surface', () => {
    const seam = read(join(ROOT, 'src/ui/commands/commandSeam.ts'));
    expect(seam).toContain('AUTHORITY: NONE');
    const importers = REACT_UI_FILES.filter((file) =>
      /from\s+['"][^'"]*services\/db['"]/.test(code(file))
    ).map(rel);
    expect(importers).toEqual(['src/ui/data/compatibilityReads.ts']);
  });

  it('extracted controllers perform no material business commands', () => {
    const EFFECT =
      /(dbService\.(save|add|create|update|delete|remove|set|apply|assign|push|record|register|upsert|mark|complete|approve|reject|link|move|archive|transition)[A-Za-z]*\()|runSourceDiscoveryAgentAsync|runTopicAgent|runResearchSignalsAgent|aiService\.[a-zA-Z]+\(|notifyClient\(|notifyManager\(|fetchSourceItems\(|pushCurrentLocalToFirestore\(/;
    const offenders = PHASE4_EXTRACTED_CONTROLLERS.filter((file) => EFFECT.test(code(file))).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('T-010-506 — DUAL READ AUTHORITY = 0', () => {
  it('React reads through compatibility/canonical facades only', () => {
    const offenders = REACT_UI_FILES.filter((file) => {
      const r = rel(file);
      if (r.includes('compatibilityReads') || r.includes('canonicalReads')) return false;
      return /from\s+['"][^'"]*services\/db['"]/.test(code(file));
    }).map(rel);
    expect(offenders).toEqual([]);
  });

  it('session projection is read-only', () => {
    const source = read(join(ROOT, 'src/ui/providers/SessionProvider.tsx'));
    expect(source).toContain('NONAUTHORITATIVE_SESSION_PROJECTION');
    expect(source).not.toMatch(/setUser\s*[,}]\s*=\s*useContext/);
  });
});

describe('T-010-506 — DUAL AUTH AUTHORITY = 0', () => {
  it('single authService source — React does not reimplement login', () => {
    const offenders = REACT_UI_FILES.filter((file) =>
      /function\s+login\s*\(|authService\.login\s*=/.test(code(file))
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it('React login delegates to sessionCommands.login', () => {
    const loginPage = read(join(ROOT, 'src/ui/modules/Login/ReactLogin.tsx'));
    expect(loginPage).toMatch(/sessionCommands\.login/);
    expect(loginPage).not.toMatch(/\brole\s*[:=]\s*['"]ADMIN['"]/);
  });
});

describe('T-010-506 — DOM ownership exclusive', () => {
  it('no React page touches document/window outside React boundaries', () => {
    const banned = [
      /document\.(getElementById|querySelector|createElement|body)/,
      /window\.(location|confirm|prompt)/,
      /innerHTML/,
      /dangerouslySetInnerHTML/,
    ];
    const pageFiles = REACT_UI_FILES.filter((file) => rel(file).includes('/pages/'));
    const offenders = pageFiles.filter((file) =>
      banned.some((pattern) => pattern.test(code(file)))
    ).map(rel);
    expect(offenders).toEqual([]);
  });
});
