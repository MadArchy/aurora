/**
 * SPEC-010 Phase 5 — shared surface helpers for adversarial architecture tests.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const ROOT = join(import.meta.dirname, '../..');
export const UI_ROOT = join(ROOT, 'src/ui');
export const CONTROLLERS_ROOT = join(ROOT, 'src/controllers');

export const COMPATIBILITY_FACADE = 'src/ui/data/compatibilityReads.ts';
export const CANONICAL_FACADE = 'src/ui/data/canonicalReads.ts';
export const COMMAND_SEAM = 'src/ui/commands/commandSeam.ts';

/** T-010-404 presentation controllers — orchestration only, not business authority. */
export const T404_PRESENTATION_CONTROLLERS = new Set([
  'src/controllers/contentPipelineCommands.ts',
  'src/controllers/sourceAutomationScheduler.ts',
]);

export function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

export const rel = (file: string) => relative(ROOT, file).replace(/\\/g, '/');

export function isReactUiFile(file: string): boolean {
  const r = rel(file);
  if (r.startsWith('src/ui/legacy/handlers/')) return false;
  if (r === 'src/ui/legacy/LegacyApp.ts') return false;
  if (r === 'src/ui/legacy/teleprompterController.ts') return false;
  if (r === 'src/ui/legacy/legacyAppHost.ts') return false;
  return true;
}

export const UI_FILES = collectFiles(UI_ROOT);
export const REACT_UI_FILES = UI_FILES.filter(isReactUiFile);
export const CONTROLLER_FILES = collectFiles(CONTROLLERS_ROOT);
export const PHASE4_EXTRACTED_CONTROLLERS = CONTROLLER_FILES.filter(
  (file) => !T404_PRESENTATION_CONTROLLERS.has(rel(file))
);

export const read = (file: string) => readFileSync(file, 'utf8');

export const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

export const MIGRATED_PAGE_ROOTS = [
  'react-manager-cockpit',
  'react-client-workspace',
  'react-client-portal',
  'react-thesis-editor',
  'react-ws-radar',
  'react-ws-deliver',
  'react-ws-briefs',
  'react-ws-sources',
  'react-ws-tasks',
] as const;
