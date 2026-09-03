# T-010-404 — Reduce `main.ts` to minimal bootstrap / composition entrypoint

**Task:** Reduce `main.ts` to minimal bootstrap/composition entrypoint  
**Authorization:** APPROVED (formal implementation authorization)  
**Start SHA:** `30579eeac589e8cd9cf70588861aaef82984041f`  
**T403 formal acceptance SHA:** `30579eeac589e8cd9cf70588861aaef82984041f`  
**Implementation SHA:** `cda56b17db878c5bec98e00619f7916de7cd5178`  
**Frozen content SHA:** `20e5dead2fbd3b951c06a9a07c1f0ef46a62012c`  
**Formal acceptance:** **FORMALLY_ACCEPTED**

## Summary

| Metric | Before | After |
|--------|--------|-------|
| `main.ts` lines | 4,473 | **15** |
| Reduction | — | **99.7%** |
| `LegacyApp` composition | — | **573** lines |
| Handler modules | 0 | **18** under `src/ui/legacy/handlers/` |
| Presentation controllers | partial | `contentPipelineCommands`, `sourceAutomationScheduler`, `teleprompterController` |

## Architecture

| Concern | Owner |
|---------|--------|
| Bootstrap entry | `src/main.ts` — styles, `createLegacyApp()`, strangler mount |
| Legacy composition | `src/ui/legacy/LegacyApp.ts` — boot, render, island seam, handler orchestration |
| Feature event wiring | `src/ui/legacy/handlers/*` — presentation-only legacy binds |
| Content pipeline / #18 send orchestration | `src/controllers/contentPipelineCommands.ts` |
| #9 scheduler wiring | `src/controllers/sourceAutomationScheduler.ts` |
| Teleprompter media | `src/ui/legacy/teleprompterController.ts` |

## T403 invariants preserved

| Check | Result |
|-------|--------|
| Normal Stage-B shell owner | REACT |
| Active global shell count | 1 |
| Normal-mode navigation owner | REACT |
| Navigation authorities | 1 |
| `main.ts` normal-mode shell authority | 0 |
| `main.ts` normal-mode global navigation authority | 0 |
| Rollback | GOVERNED |
| #9 / #18 consumer paths | PASS |
| T403 Playwright regression | **11/11 PASS** |

## Acceptance

| Criterion | Result |
|-----------|--------|
| A38 | PASS (preserved) |
| A39 | **PASS** — bootstrap/composition purity; feature controllers extracted |
| A40 | PASS — migration matrix updated |
| T-010-20 | PARTIAL (unchanged) |
| Regression | **1892/1892** unit · **91/91** rules · BUILD PASS |

## Next action

`SPEC010_PHASE4_CLOSURE_REVIEW`
