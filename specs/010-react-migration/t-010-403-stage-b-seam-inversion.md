# T-010-403 — Stage-B seam inversion

**Task:** Invert the seam — React shell hosts remaining legacy islands (Stage B)  
**Authorization:** APPROVED (human governance, precondition review PASS)  
**Start SHA:** `33aea7a6336d031b0d02e9d7cd0d8bb4ab01187d`  
**Implementation SHA:** `66d849b3bbb78ede5e34a06f3166cb332d97bc34`  
**Frozen content SHA:** `654707d9b8fb7738b4cd76ca8ad11aa1fce9832a`  
**E2E verification SHA:** `f0d84824285be0c7d265417b2f09142a67ed3707`  
**Formal acceptance:** **FORMALLY_ACCEPTED**  
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
| #9 / #18 regression | Consumer paths preserved; E2E proof in Stage-B hosted UI |
| T-010-404 | NOT implemented — **READY_FOR_AUTHORIZATION** after formal acceptance |

## A38 / A39 / A40 / T-010-20

| Criterion | Result |
|---|---|
| A38 | PASS — sibling roots, exclusive visibility, clean unmount; **11/11 Stage-B E2E PASS** |
| A39 | PARTIAL — shell ownership inverted; `main.ts` still large (T-404) |
| A40 | PASS — migration matrix updated: Stage B entered, T404 pending |
| T-010-20 | PARTIAL — scoring remains display-only in React |

## Tests

- `tests/t010403StageBSeamInversion.test.ts` (11 architecture tests)
- `e2e/t010403-stage-b-seam.spec.ts` (11 E2E scenarios — Playwright `channel: 'chrome'`)
- Updated Phase 1–4 E2E defaults for Stage-B normal mode

**Regression (post-acceptance):** FULL CHECK **1883/1883 PASS** · RULES **91/91 PASS** · BUILD **PASS** · T403 Playwright **11/11 PASS**

## E2E verification scope (11 scenarios)

1. Normal React boot  
2. Explicit legacy rollback  
3. Rollback storage immutability  
4. Single global presentation root  
5. Manager navigation (single shell authority)  
6. React → legacy island (`ws-briefing`)  
7. Legacy island → React (`ws-radar`)  
8. Island mount / unmount / remount  
9. #9 hosted poll (`SOURCE_RUN_COMPLETED` audit, mocked `/api/rss`)  
10. #18 hosted send (`DELIVERY_SENT` audit, deterministic ADVICE fixture)  
11. Legacy island navigation → React page (`ws-deliver`)

## Next action

`AUTHORIZE_T010404_MAIN_TS_BOOTSTRAP_REDUCTION`
