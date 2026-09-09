# T603 React Parity Wave P9 — provenance reconciliation

**Status:** `FORMALLY_ACCEPTED` (provenance reconciled)  
**Registry:** #20 · #21 (radar direct presentation path)  
**Presentation model:** `P9_RADAR_DISCARD_ADD_TO_CURATION`

---

## Why this commit exists

P9 landed as a **four-commit linear chain** (feature → presentation-boundary fix →
E2E assertion fix → governance acceptance). The acceptance document at
`71538bc940be6d45fcfdf75c37874eff08328dcf` correctly lists all three
implementation commits but also labels the **TEST commit** (`7633f2d`) as
`Implementation tip`, which is misleading: that SHA contains **zero production
semantics** and only adjusts the P9 E2E assertion to match canonical
`MarkSignalSaved` projection (`managerDecision = SAVED`, not `status = SAVED`).

This reconciliation records explicit provenance terminology and gate chronology
**without amending** `71538bc` or any implementation commit.

| Role | SHA |
|------|-----|
| Authoritative pre-P9 checkpoint | `c840c759d4c5de4479c24966f27014841449dd94` |
| P9 FEATURE | `d079338277b762a5035cfc4ca1523a1b34c4335d` |
| P9 FIX | `2bce096571dd887f6d7b7576c534d2c2e99c8334` |
| P9 TEST | `7633f2d06f90647629a15a1fcef7cd105f1bb926` |
| P9 FINAL PRE-ACCEPTANCE CHECKPOINT | `7633f2d06f90647629a15a1fcef7cd105f1bb926` |
| Existing acceptance (preserved) | `71538bc940be6d45fcfdf75c37874eff08328dcf` |
| This provenance tip | this commit |

**Linear chain:** `c840c75` → `d079338` → `2bce096` → `7633f2d` → `71538bc` → this tip.

**Canonical terminology (future governance):**

- `P9 IMPLEMENTATION RANGE = d079338..7633f2d`
- `P9 FINAL IMPLEMENTATION CHECKPOINT = 7633f2d`
- Do **not** use TEST SHA as sole `IMPLEMENTATION SHA`.

Existing acceptance `71538bc` is classified as
`PROVENANCE_LABEL_REQUIRES_RECONCILIATION` for the `Implementation tip` field
only. Business authority conclusions and gate totals remain valid. It is **not
amended**.

---

## Feature manifest (`d079338`)

**PRODUCTION**

- `src/ui/commands/commandSeam.ts` — `radarCommands.discardSignal` +
  `radarCommands.sendToCuration` (initial inline composite)
- `src/ui/hooks/useWave3Data.ts` — `useDiscardRadarSignal`,
  `useSendSignalToCuration`
- `src/ui/modules/pages/ReactClientWorkspacePage.tsx` — RadarPanel discard +
  send-to-curation controls; handoff narrowed 5→3 actions; `narrowToClient` scope

**TESTS**

- `tests/reactParityWaveP9RadarDiscardCuration.test.ts` (added)
- `e2e/reactParityWaveP9RadarDiscardCuration.spec.ts` (added)

**GOVERNANCE:** none

**Scope:** Within P9 authorization — #20 DiscardSignal + #21 radar composite
(AddSignalToCuration + MarkSignalSaved + optional ScoreAndRouteSignal pre-score).
No advisor migration. No #22 UI.

---

## Fix manifest (`2bce096`)

**PRODUCTION**

- `src/services/radarSendToCurationPresentation.ts` (added) — presentation
  composite mirroring `radarHandlers.handleSendToCurationClick`; lives under
  `services/` like `articleReviewOpen.ts` to satisfy T-010-503 React dbService
  import ban
- `src/ui/commands/commandSeam.ts` — delegate `sendToCuration` to
  `runRadarSendToCurationPresentation`; remove inline `dbService` usage

**TESTS**

- `tests/reactParityWaveP9RadarDiscardCuration.test.ts` — assert composite
  path + seam remains db-free

**GOVERNANCE:** none

**Why required:** FEATURE placed `dbService` reads inside `commandSeam.ts`,
breaking P1/P2 authority guards (`commandSeam` must not import `dbService`).
Fix **narrowed presentation placement only** — same composite semantics, frozen
consumers unchanged. Did **not** change Domain, Application business rules,
frozen commands, #22, advisor, routing authority, or rollback.

---

## Test manifest (`7633f2d`)

**PRODUCTION:** 0

**TESTS**

- `e2e/reactParityWaveP9RadarDiscardCuration.spec.ts` — assert
  `managerDecision === 'SAVED'` after send-to-curation (not `status === 'SAVED'`)

**GOVERNANCE:** none

**Production semantic changes = 0.** This is **not** the feature implementation
commit.

---

## Existing acceptance manifest (`71538bc`)

**PRODUCTION:** 0  
**TESTS:** 0  
**GOVERNANCE:**

- `specs/010-react-migration/t-010-p9-radar-discard-curation-parity.md` (added)
- `specs/010-react-migration/t-010-p9-final-acceptance-reconciliation.md` (added)

Governance-only = **YES**.

**Provenance claim accuracy:** **PARTIAL**

- Accurate: three implementation commits listed; authority (#20 COMPLETE, #21
  Radar COMPLETE, #21 overall PARTIAL, #22 PARTIAL_CU); gate matrix totals.
- Inaccurate/misleading: `Implementation tip: 7633f2d` conflates TEST commit with
  implementation tip; missing explicit `P9 IMPLEMENTATION RANGE` /
  `FINAL IMPLEMENTATION CHECKPOINT` labels.

---

## Gate chronology proof

| Question | Answer |
|----------|--------|
| Final gates after FEATURE (`d079338`)? | **NO** — P1/P2 seam dbService guards failed |
| Final gates after FIX (`2bce096`)? | **NO** — P9 E2E failed on `status` vs `managerDecision` |
| Final gates after TEST (`7633f2d`)? | **YES** |
| Tree equivalent to pre-governance code? | **YES** — `git diff 7633f2d 71538bc` touches governance only |

Evidence:

1. **Parent chain:** acceptance `71538bc` parent = `7633f2d` (TEST); no code
   commits after TEST before acceptance.
2. **Tree identity:** production + test files at `7633f2d` = production + test
   at `71538bc`.
3. **Gate totals:** acceptance records FULL **2359/2359** (post-P9 delta +13
   vs pre-P9 2346), PARITY **30/30**, COMBINED **52/52** — consistent with
   final run after TEST E2E fix and before governance.
4. **Fix necessity:** FIX resolved Vitest authority guards; TEST resolved sole
   remaining P9 E2E failure — mandatory matrix could not have been green at
   FEATURE or FIX alone.

**GATE CHRONOLOGY = PROVEN** — regression **not re-run** for ceremony.

---

## Accepted business state (unchanged)

| Item | Value |
|------|--------|
| #20 REACT PRESENTATION | **COMPLETE** |
| #21 RADAR PRESENTATION | **COMPLETE** |
| #21 OVERALL REACT PRESENTATION | **PARTIAL** |
| Remaining #21 legacy path | advisor `AddAdviceActionToCuration` |
| #22 | **PARTIAL_CU / UNCHANGED** |
| RADAR SURFACE | **PARTIAL** |
| ADVISOR MIGRATION | **0** |
| #22 BUSINESS MODIFICATIONS | **0** |
| addRecommendation MODIFICATIONS | **0** |

**Pre-score contract (accepted):**

- UNSCORED: ScoreAndRouteSignal → AddSignalToCuration → MarkSignalSaved → audit
- SCORED: AddSignalToCuration → MarkSignalSaved → audit
- No #22 UI migration · no score authority in React · no silent routing winner

**Handoff / T603:**

| Item | Value |
|------|--------|
| Radar actions BEFORE | 5 |
| Radar actions AFTER | 3 |
| HANDOFF COUNT | 12 |
| SAFE LEGACY MODULES | 0 |
| T603 | **ZERO_SAFE_SUBSET_DEFERRED** |
| T604 | **NOT_AUTHORIZED** |

---

## Gate matrix (historic — executed at TEST checkpoint)

| Gate | Result |
|------|--------|
| P9 FOCUSED | **13/13 PASS** |
| #20 FROZEN | **18/18 PASS** |
| #21 FROZEN | **15/15 + 38/38 PASS** |
| #22 NON-REGRESSION | **39/39 PASS** |
| SPEC001 ROUTING | **31/31 PASS** |
| ROLE/REACHABILITY | **41/41 PASS** |
| P8 | **9/9 PASS** |
| B10/#27 | **25/25 PASS** |
| B9/#33 | **18/18 PASS** |
| #28 | **26/26 PASS** |
| P7 | **13/13 PASS** |
| #18 | **7/7 PASS** |
| P6 | **23/23 PASS** |
| #10 | **19/19 PASS** |
| P5 | **18/18 PASS** |
| THESIS | **22/22 PASS** |
| P4 | **15/15 PASS** |
| P3A | **26/26 PASS** |
| P2 | **25/25 PASS** |
| P1 | **25/25 PASS** |
| B7 | **15/15 PASS** |
| EXECUTION DELIVERY | **108/108 PASS** |
| T508 | **13/13 + 10/10 PASS** |
| PHASE5 | **106/106 + 21/21 PASS** |
| FOUNDATION | **22/22 PASS** |
| PARITY | **30/30 PASS** |
| COMBINED | **52/52 PASS** |
| FULL | **2359/2359 PASS** |
| RULES | **91/91 PASS** |
| BUILD | **PASS** |

P9 LOCAL P0/P1/P2 = **0 / 0 / 0**  
GLOBAL PHASE6 P0/P1/P2 = **0 / 0 / 3**

---

## Final state

| Item | Value |
|------|--------|
| PARITY WAVE P9 | **FORMALLY_ACCEPTED** |
| P9 IMPLEMENTATION RANGE | `d079338..7633f2d` |
| P9 FINAL IMPLEMENTATION CHECKPOINT | `7633f2d` |
| SPEC-010 CODE_COMPLETE | **NO** |
| MVP CODE_COMPLETE | **NO** |

**NEXT ACTION:** `T603_REACT_PARITY_POST_P9_FRONTIER_REVIEW`
