# T-010-403 — Stage-B seam inversion

**Task:** Invert the seam — React shell hosts remaining legacy islands (Stage B)  
**Authorization:** APPROVED (human governance, precondition review PASS)  
**Start SHA:** `33aea7a6336d031b0d02e9d7cd0d8bb4ab01187d`  
**Implementation SHA:** `66d849b3bbb78ede5e34a06f3166cb332d97bc34`  
**Former status:** `BLOCKED_BY_PRECONDITION` (stale — circular blockers invalidated)  
**Precondition review:** PASS · `TRUE PRECONDITIONS TO START T403 = 0`

## Governance decision (preserved history)

Earlier `BLOCKED_BY_PRECONDITION` cited:

1. requiring `main.ts` bootstrap reduction before T403 (T-404 outcome), and  
2. requiring React to already own the shell before T403 (T403 outcome).

Human authorization records both as **invalid start blockers**. They remain historical evidence; they are not rewritten.

## Implementation summary

| Concern | Evidence |
|---|---|
| Normal Stage-B shell owner | React (`DEFAULT_UI_MODE = react`) |
| Rollback shell owner | Legacy (explicit `ui-mode=legacy`) |
| Active global shell count | 1 (CSS visibility + unmount) |
| Normal-mode navigation owner | `ReactAppShell` + `navigationBridge` |
| Legacy island host | `LegacyIslandHost` → `legacyIslandBridge` → `App.renderIsland()` |
| `main.ts` normal-mode shell authority | 0 (early return; no `renderAppShell` in React mode) |
| `main.ts` normal-mode global navigation authority | 0 (`setTab` / `enterClient` publish intents) |
| React business authority | 0 (architecture tests) |
| #9 / #18 regression | Consumer paths preserved |
| T-010-404 | NOT implemented (blocked pending closure review) |

## A38 / A39 / A40 / T-010-20

| Criterion | Result |
|---|---|
| A38 | PASS — sibling roots, exclusive visibility, clean unmount preserved |
| A39 | PARTIAL — shell ownership inverted; `main.ts` still large (T-404) |
| A40 | PASS — matrix updated only for T403 shell evidence |
| T-010-20 | PARTIAL — scoring remains display-only in React |

## Tests

- `tests/t010403StageBSeamInversion.test.ts` (11 tests)
- `e2e/t010403-stage-b-seam.spec.ts` (4 tests — requires Playwright browser install)
- Updated Phase 1–4 E2E defaults for Stage-B normal mode

**Regression (post-implementation):** FULL CHECK **1883/1883 PASS** · RULES **91/91 PASS** · BUILD **PASS**

## Next action

`T010403_CLOSURE_REVIEW` — required before T-010-404 authorization.
