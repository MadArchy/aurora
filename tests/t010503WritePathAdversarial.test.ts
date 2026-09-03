/**
 * SPEC-010 T-010-503 — adversarial write-path suite (A8, A26, A32, A33 · T-010-01…04).
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import {
  code,
  COMPATIBILITY_FACADE,
  PHASE4_EXTRACTED_CONTROLLERS,
  read,
  REACT_UI_FILES,
  rel,
  ROOT,
  T404_PRESENTATION_CONTROLLERS,
} from './lib/reactMigrationPhase5Surface';

const MUTATOR =
  /dbService\.(save|update|create|add|remove|delete|set|mark|record|reset|push|apply|assign|upsert|complete|approve|reject|link|move|archive|transition)/;

describe('T-010-503 — React write ban', () => {
  it('NEW REACT BUSINESS WRITE AUTHORITY = 0 — only compatibility facade imports dbService', () => {
    const offenders = REACT_UI_FILES.filter((file) => {
      if (rel(file) === COMPATIBILITY_FACADE) return false;
      return /from\s+['"][^'"]*services\/db['"]/.test(code(file));
    }).map(rel);
    expect(offenders).toEqual([]);
  });

  it('compatibility facade exposes no mutator', () => {
    expect(MUTATOR.test(code(join(ROOT, COMPATIBILITY_FACADE)))).toBe(false);
  });

  it('FIRESTORE BYPASS = 0 — no Firebase imports in React UI', () => {
    const offenders = REACT_UI_FILES.filter((file) =>
      /from\s+['"]firebase\//.test(code(file))
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it('APPLICATION BYPASS = 0 — pages/hooks do not import Application modules', () => {
    const offenders = REACT_UI_FILES.filter((file) => {
      const r = rel(file);
      if (r === 'src/ui/commands/commandSeam.ts') return false;
      if (r.startsWith('src/ui/data/')) return false;
      if (!r.includes('/pages/') && !r.includes('/hooks/')) return false;
      return /from\s+['"][^'"]*application\//.test(code(file));
    }).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('T-010-503 — store and provider bypass', () => {
  it('no React UI file imports Local*Store or infrastructure stores', () => {
    const offenders = REACT_UI_FILES.filter((file) =>
      /\bLocal[A-Z]\w*Store\b/.test(code(file)) ||
      /from\s+['"][^'"]*infrastructure\//.test(code(file))
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it('no React UI file imports AI provider SDKs', () => {
    const forbidden = [/from\s+['"]openai['"]/, /from\s+['"]@anthropic-ai\//, /api\.openai\.com/];
    const offenders = REACT_UI_FILES.filter((file) =>
      forbidden.some((pattern) => pattern.test(code(file)))
    ).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('T-010-503 — extracted Phase-4 controllers remain write-free', () => {
  it('NEW CONTROLLER BUSINESS WRITE AUTHORITY = 0 — Phase-4 extracted modules', () => {
    const offenders = PHASE4_EXTRACTED_CONTROLLERS.filter((file) => MUTATOR.test(code(file))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('T-404 presentation controllers delegate #9/#18 without redefining consumers', () => {
    for (const path of T404_PRESENTATION_CONTROLLERS) {
      const source = read(join(ROOT, path));
      expect(source).not.toMatch(/async function pollRegisteredSource/);
      expect(source).not.toMatch(/async function sendDeliveryPackage/);
    }
  });
});
