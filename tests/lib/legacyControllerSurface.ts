/**

 * SPEC-010 T-010-404 — legacy controller surface for architecture tests.

 *

 * After bootstrap reduction, consumer wiring and shell seam live outside

 * `src/main.ts`. Tests that previously grep `main.ts` should use this bundle.

 */

import { readFileSync } from 'node:fs';

import { join } from 'node:path';



const ROOT = join(import.meta.dirname, '../..');



/** Primary legacy controller + extracted presentation modules. */

export const LEGACY_CONTROLLER_FILES = [

  'src/ui/legacy/LegacyApp.ts',

  'src/controllers/contentPipelineCommands.ts',

  'src/controllers/sourceAutomationScheduler.ts',

  'src/ui/legacy/teleprompterController.ts',

  'src/ui/legacy/legacyAppHost.ts',

  'src/ui/legacy/handlers/contentHandlers.ts',

  'src/ui/legacy/handlers/clientPortalHandlers.ts',

  'src/ui/legacy/handlers/loginHandlers.ts',

  'src/ui/legacy/handlers/notificationsHandlers.ts',

  'src/ui/legacy/handlers/navigationHandlers.ts',

  'src/ui/legacy/handlers/filtersHandlers.ts',

  'src/ui/legacy/handlers/sessionHandlers.ts',

  'src/ui/legacy/handlers/clientAdminHandlers.ts',

  'src/ui/legacy/handlers/onboardingHandlers.ts',

  'src/ui/legacy/handlers/profileHandlers.ts',

  'src/ui/legacy/handlers/thesisHandlers.ts',

  'src/ui/legacy/handlers/dossierHandlers.ts',

  'src/ui/legacy/handlers/sourcesHandlers.ts',

  'src/ui/legacy/handlers/tasksHandlers.ts',

  'src/ui/legacy/handlers/radarHandlers.ts',

  'src/ui/legacy/handlers/curationHandlers.ts',

  'src/ui/legacy/handlers/advisorHandlers.ts',

  'src/ui/legacy/handlers/deliveryHandlers.ts',

] as const;



export function readLegacyControllerSurface(): string {

  return LEGACY_CONTROLLER_FILES.map((rel) => readFileSync(join(ROOT, rel), 'utf8')).join('\n\n');

}



export function readMainBootstrap(): string {

  return readFileSync(join(ROOT, 'src/main.ts'), 'utf8');

}


