# T603 React Parity Wave P9 — #20 DiscardSignal + #21 Radar Send-to-Curation

**Status:** `FORMALLY_ACCEPTED`  
**Registry:** #20 · #21 (radar direct presentation path)  
**Presentation model:** `P9_RADAR_DISCARD_ADD_TO_CURATION`  
**Starting checkpoint:** `c840c759d4c5de4479c24966f27014841449dd94`

---

## Scope

Presentation parity only. Frozen Application command semantics unchanged.

| Item | Value |
|------|--------|
| P9 surface | `ReactClientWorkspacePage` RadarPanel |
| Commands | `DiscardSignal` (#20) · radar composite `AddSignalToCuration` + `MarkSignalSaved` (#21a/#21b) |
| Pre-score | Presentation composite calls frozen `ScoreAndRouteSignal` only when authoritative `relevanceScore === undefined` |
| Role | ADMIN |
| Public discard input | `{ requestedClientId, signalId }` |
| Public send-to-curation input | `{ requestedClientId, signalId }` |
| Advisor `AddAdviceActionToCuration` | **NOT migrated** · remains legacy `#21` non-radar path |
| #22 score/investigate/addRecommendation | **UNCHANGED / PARTIAL_CU** |
| Read seam | `readWorkspaceRadar` + existing signal-outcome reads |
| Command seam | `radarCommands.discardSignal` · `radarCommands.sendToCuration` → `runRadarSendToCurationComposite` |
| Legacy retained | `postura_ui_mode=legacy` radar discard/send + advisor path + #22 UI |

**DiscardSignal modifications = 0** · **AddSignalToCuration modifications = 0** · **MarkSignalSaved modifications = 0** · **ScoreAndRouteSignal modifications = 0** · **NEW DOMAIN RULE = 0** · **NEW APPLICATION BUSINESS BOUNDARY = 0** · **DIRECT REACT dbService READ/WRITE = 0** · **ROUTING GOVERNANCE = NO** · **ROLLBACK = 0**

---

## #21 ownership gate

| Path | Owner |
|------|--------|
| Radar discard | **#20** direct React presentation (P9) |
| Radar `.btn-send-to-curation` / React send | **#21** radar composite (P9) |
| Advisor `.btn-advice-to-curation` | **#21a advisor** · legacy presentation residual |
| `MarkSignalSaved` | **#21b** · invoked only inside radar composite (not independent UI) |

**#21 RADAR PRESENTATION = COMPLETE**  
**#21 OVERALL REACT PRESENTATION = PARTIAL** (advisor residual remains)

---

## Pre-score composite

| Field | Value |
|-------|--------|
| PRESCORE REQUIRED | **YES** (when authoritative signal unscored) |
| OWNER | **PRESENTATION_COMPOSITE** |
| COMMAND | `ScoreAndRouteSignal` via `createStrategicSignalRoutingUseCases()` |
| UNSCORED ORDER | scoreAndRoute → addSignalToCuration → markSignalSaved → SIGNAL_TO_CURATION audit |
| SCORED ORDER | addSignalToCuration → markSignalSaved → SIGNAL_TO_CURATION audit |

Partial failure: add failure stops before mark/audit (pre-score may persist). Mark `SIGNAL_NOT_FOUND` continues (A2). Other mark failures return error without invented rollback.

---

## Regression (P9 formal acceptance)

| Gate | Result |
|------|--------|
| P9 FOCUSED | **13/13 PASS** · `tests/reactParityWaveP9RadarDiscardCuration.test.ts` |
| #20 FROZEN | **18/18 PASS** · DiscardSignal / Wave A1 subset of `cr1SignalIntake` |
| #21 FROZEN | **15/15 + 38/38 PASS** · MarkSignalSaved/A2 + B1/B2 Execution Delivery |
| #22 / scoring | **39/39 PASS** · `scoringPhase5` |
| SPEC-001 routing | **31/31 PASS** · `strategicSignalRoutingPhase5` |
| ROLE/REACHABILITY | **41/41 PASS** · P2 + thesis + `t010501` (baseline preserved) |
| P8 | **9/9 PASS** |
| B10 / #27 | **25/25 PASS** |
| B9 / #33 | **18/18 PASS** |
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
| T508 COMPARATOR | **13/13 PASS** |
| T508 FULL | **10/10 PASS** |
| PHASE5 VITEST | **106/106 PASS** |
| PHASE5 E2E | **21/21 PASS** · Stage-B + T508 |
| FOUNDATION PLAYWRIGHT | **22/22 PASS** |
| PARITY PLAYWRIGHT | **30/30 PASS** · Stage-B + T508 + P1–P9 |
| COMBINED PLAYWRIGHT | **52/52 PASS** |
| FULL | **2359/2359 PASS** · `npm run check` |
| RULES | **91/91 PASS** |
| BUILD | **PASS** |

P9 LOCAL P0/P1/P2 = **0 / 0 / 0**  
GLOBAL PHASE6 P0/P1/P2 = **0 / 0 / 3**

---

## Handoff effect

| Item | Value |
|------|--------|
| Radar actions BEFORE | 5 (`puntuar`, `descartarlas`, `investigarlas`, `añadirlas a una entrega`, `fuentes recomendadas`) |
| Radar actions AFTER | 3 (`puntuar`, `investigarlas`, `fuentes recomendadas`) |
| TOTAL JSX handoff sites | **12** (unchanged) |

---

## Final state

| Item | Value |
|------|-------|
| PARITY WAVE P9 | **FORMALLY_ACCEPTED** |
| #20 REACT PRESENTATION | **COMPLETE** |
| #21 RADAR PRESENTATION | **COMPLETE** |
| #21 OVERALL REACT PRESENTATION | **PARTIAL** |
| #22 | **PARTIAL_CU / UNCHANGED** |
| RADAR SURFACE | **PARTIAL** |
| SAFE LEGACY MODULES | **0** |
| T603 | **ZERO_SAFE_SUBSET_DEFERRED** |
| T603 IMPLEMENTATION | **NOT_AUTHORIZED** |
| T604 | **NOT_AUTHORIZED** |
| SPEC-010 CODE_COMPLETE | **NO** |
| MVP CODE_COMPLETE | **NO** |

**NEXT ACTION:** `T603_REACT_PARITY_POST_P9_FRONTIER_REVIEW`
