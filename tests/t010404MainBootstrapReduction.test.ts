/**
 * SPEC-010 T-010-404 — bootstrap reduction architecture tests.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEGACY_CONTROLLER_FILES, readLegacyControllerSurface, readMainBootstrap } from './lib/legacyControllerSurface';

const ROOT = join(import.meta.dirname, '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

describe('T-010-404 — main.ts bootstrap purity', () => {
  it('main.ts is a minimal bootstrap entrypoint', () => {
    const main = readMainBootstrap();
    const lines = main.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('*'));
    expect(lines.length).toBeLessThan(25);
    expect(main).toMatch(/createLegacyApp/);
    expect(main).toMatch(/exposeStranglerControls/);
    expect(main).not.toMatch(/class\s+\w+/);
    expect(main).not.toMatch(/addEventListener/);
    expect(main).not.toMatch(/dbService\./);
  });

  it('main.ts does not import business consumers or domain modules', () => {
    const main = readMainBootstrap();
    const forbidden = [/Consumer['"]/, /from\s+['"].*\/domain\//, /from\s+['"].*\/application\//];
    for (const pattern of forbidden) {
      expect(main).not.toMatch(pattern);
    }
  });

  it('legacy controller implementation lives outside main.ts', () => {
    const main = readMainBootstrap();
    expect(main).not.toMatch(/bindContent/);
    expect(main).not.toMatch(/renderMainView/);
    expect(read('src/ui/legacy/LegacyApp.ts')).toMatch(/renderMainView/);
  });
});

describe('T-010-404 — extracted presentation modules', () => {
  it('registers expected handler/controller modules', () => {
    for (const file of LEGACY_CONTROLLER_FILES) {
      expect(read(file).length).toBeGreaterThan(50);
    }
  });

  it('content and client portal handlers are extracted from LegacyApp', () => {
    const legacy = read('src/ui/legacy/LegacyApp.ts');
    expect(legacy).toMatch(/bindContentHandlers/);
    expect(legacy).toMatch(/bindClientPortalHandlers/);
    expect(read('src/ui/legacy/handlers/contentHandlers.ts')).toMatch(/bindContentHandlers/);
  });

  it('source automation and teleprompter are extracted controllers', () => {
    expect(read('src/controllers/sourceAutomationScheduler.ts')).toMatch(/pollRegisteredSource/);
    expect(read('src/ui/legacy/teleprompterController.ts')).toMatch(/TeleprompterController/);
  });
});

describe('T-010-404 — T403 invariants preserved', () => {
  it('React shell seam remains in LegacyApp', () => {
    const legacy = read('src/ui/legacy/LegacyApp.ts');
    expect(legacy).toMatch(/isReactShellOwner/);
    expect(legacy).toMatch(/publishShellNavigation/);
    expect(legacy).toMatch(/mountLegacyIsland/);
  });

  it('#9 and #18 remain consumer-owned in legacy surface', () => {
    const surface = readLegacyControllerSurface();
    expect(surface).toMatch(/pollRegisteredSource/);
    expect(surface).toMatch(/pollAllActiveSources/);
    expect(surface).toMatch(/sendDeliveryPackage/);
    expect(surface).not.toMatch(/async function pollRegisteredSource/);
    expect(surface).not.toMatch(/async function sendDeliveryPackage/);
  });

  it('main.ts normal-mode shell authority remains zero', () => {
    const legacy = read('src/ui/legacy/LegacyApp.ts');
    expect(legacy).toMatch(
      /if \(this\.isReactShellOwner\(\)\) \{\s*\n\s*if \(this\.islandHostEl\) this\.renderIsland\(\);\s*\n\s*return;\s*\n\s*\}/
    );
  });
});
