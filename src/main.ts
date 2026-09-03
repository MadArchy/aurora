/**
 * SPEC-010 T-010-404 — minimal application bootstrap / composition entrypoint.
 *
 * Environment startup, strangler mount, and legacy controller composition only.
 * Feature presentation, event wiring, and island rendering live under
 * `src/ui/legacy/` and `src/controllers/`.
 */
import './styles/index.css';
import { exposeStranglerControls, initReactStrangler } from './ui/mount';
import { createLegacyApp } from './ui/legacy/LegacyApp';

createLegacyApp();

// SPEC-010 strangler mount seam. Owns #react-root only; never touches #app.
// Stage B (T-010-403): normal mode is React-owned shell; legacy rollback remains available.
exposeStranglerControls();
void initReactStrangler();
