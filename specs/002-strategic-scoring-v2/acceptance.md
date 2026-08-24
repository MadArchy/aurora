# Acceptance 002 — Strategic Scoring V2

**Phase 0B:** criteria defined.  
**Phase 5:** Security/architecture hardening complete.  
**Phase 6:** **COMPLETE** — human sign-off **APPROVED** (T-002-604).

Spec **CODE_COMPLETE** requires Required (A\*) full PASS + **human sign-off** (T-002-604).  
Spec **DONE** requires CODE_COMPLETE + any agreed deploy verification (separate).

**Implementation baseline:** SPEC-001 CODE_COMPLETE @ `057a284`; governance @ `4643cad`.  
**Implementation checkpoint:** `ab01c463d0d3b884226adec078ca8b255cba4fe3`.

---

## Required (implementation → CODE_COMPLETE)

| # | Criterion | Implementation location | Direct test/evidence | Status |
|---|-----------|----------------------|----------------------|--------|
| A1 | Same material inputs + `scoringVersion` produce same material score | `src/domain/scoringCore.ts` | `tests/scoringCore.test.ts` (determinism); `tests/scoringPhase5.test.ts` (adversarial repeat + JSON round-trip) | **PASS** |
| A2 | Single canonical deterministic algorithm all strategic paths | `scoringCore.ts`; `services/scoring.ts` wrapper; `functions/src/lib/scoreSignal.ts` delegate | `tests/scoringPhase4.test.ts`, `tests/scoringPhase5.test.ts` (formula authority = 1); Functions build | **PASS** |
| A3 | Scoring consumes SPEC-001 routing; no independent thesis selection | `routingGovernance.ts`; `ScoreAndRouteSignal` via `main.ts scoreSignal` | `tests/strategicScoringPhase2.test.ts`; `tests/scoringPhase5.test.ts` routing matrix | **PASS** |
| A4 | Zero strategic first/primary thesis shortcuts | Phase 4 `scheduledIngest.ts`; Application layer | `tests/scoringPhase4.test.ts`, `tests/scoringPhase5.test.ts` (strategic scan = 0) | **PASS** |
| A5 | SPEC-001 per-thesis evidence preserved; scoring does not collapse | `ScoreAndRouteSignal` + `thesisScores[]` on Signal | `tests/strategicSignalRoutingPhase2.test.ts`, `tests/strategicScoringPhase2.test.ts` | **PASS** |
| A6 | CLEAR respects authoritative routed thesis | `resolveGovernedThesisForScoring` | `tests/strategicScoringPhase2.test.ts`; `tests/scoringPhase5.test.ts` CLEAR matrix | **PASS** |
| A7 | CONTESTED fail-closed for single-thesis governed scoring | `routingGovernance.ts` | `tests/strategicScoringPhase2.test.ts`; `tests/scoringPhase5.test.ts` CONTESTED matrix | **PASS** |
| A8 | UNROUTED cannot fabricate thesis context | `routingGovernance.ts` | `tests/strategicScoringPhase2.test.ts`; `tests/scoringPhase5.test.ts` UNROUTED matrix | **PASS** |
| A9 | Every governed material score carries `scoring-v1` | Domain + `applyGovernedScoreToSignal` / `applyStrategicRoutingToSignal` | `tests/scoringCore.test.ts`; `tests/strategicScoringPhase3.test.ts`; legacy unversioned compat documented in `scoreHistoryCore.ts` | **PASS** |
| A10 | Explainability reconstructs factors + penalties → total | `scoreExplainCore.ts` ← `scoringCore` weights | `tests/scoringCore.test.ts`; `tests/scoringPhase5.test.ts` reconstruction | **PASS** |
| A11 | Disposition vs output format separated | `dispositionCore.ts`; `radarTriageCore.ts`; governed Signal fields | `tests/dispositionCore.test.ts`; `tests/scoringPhase5.test.ts` separation | **PASS** |
| A12 | Scoring alone cannot terminal DISCARD | Phase 4 cloud ingest; deprecated `applyScoreToSignal` stripped | `tests/scoringPhase4.test.ts`; `tests/scoringPhase5.test.ts` auto-discard scan (manager `decideSignal` excluded) | **PASS** |
| A13 | Cloud/client canonical parity | `scoreSignalCloud` → Domain core | `tests/scoringPhase4.test.ts`; `tests/scoringPhase5.test.ts` parity with explicit `nowMs` | **PASS** |
| A14 | `applyScoreToSignal` not active governed path | `@deprecated` in `db.ts`; zero src callers | `tests/scoringPhase4.test.ts`; `tests/scoringPhase5.test.ts` caller scan | **PASS** |
| A15 | Score history preserves material transitions | `scoreHistoryCore.ts`; `postura_signal_score_history_v1` | `tests/scoreHistoryCore.test.ts`; `tests/strategicScoringPhase3.test.ts` | **PASS** |
| A16 | Tenant mismatch rejected at persistence | `DbStrategicScoringAdapter`; use cases | `tests/strategicScoringPhase3.test.ts`; `tests/scoringPhase5.test.ts` tenant matrix | **PASS** |
| A17 | AI advisory only; deterministic score authoritative | `ai.ts analyzeSignalAgainstThesis` | `tests/scoringPhase4.test.ts`; `tests/scoringPhase5.test.ts` AI static + failure | **PASS** |
| A18 | Domain scoring framework/infrastructure pure | `scoringCore`, `dispositionCore`, `scoreExplainCore`, `scoreHistoryCore` | `tests/scoringArchitecture.test.ts`; `tests/scoringPhase5.test.ts` domain purity | **PASS** |
| A19 | Application hexagonal; ports not concrete db | `src/application/strategicScoring/` | `tests/strategicScoringArchitecture.test.ts`; `tests/scoringPhase5.test.ts` | **PASS** |
| A20 | Equivalent rescore → no duplicate history noise | `isMaterialScoreChange` in `scoreHistoryCore.ts` | `tests/scoreHistoryCore.test.ts`; `tests/strategicScoringPhase3.test.ts`; Phase 5 materiality | **PASS** |
| A21 | SPEC-001 frozen routing regression PASS | SPEC-001 test suites | `strategicSignalRoutingPhase*` (65 tests) in fresh `npm run check` 677/677 @ Phase 6 | **PASS** |
| A22 | SPEC-005 frozen Gateway regression PASS | SPEC-005 test suites | `aiGatewayPhase*` + architecture in fresh `npm run check` 677/677 @ Phase 6 | **PASS** |
| A23 | `npm run check` PASS | repo-wide | Fresh Phase 6: **677/677 PASS** (2026-08-24) | **PASS** |
| A24 | `npm run test:rules` PASS | Firestore/storage rules | Fresh Phase 6: **91/91 PASS** (2026-08-24) | **PASS** |

**Implementation acceptance:** **24/24 PASS**  
**CODE_COMPLETE:** **YES** — human sign-off **APPROVED** (T-002-604).

---

## Presentation-only exceptions (A4)

| Location | Usage | Classification |
|----------|-------|----------------|
| `db.getPrimaryThesis` @ `getPortfolioSummary` | Industry preset label for dashboard | **PRESENTATION_ONLY** — not strategic scoring authority |
| `thesisRoutingCore` `primaryThesisId` in CONTESTED metadata | Routing audit field; no selected thesis | **OTHER_SPEC (SPEC-001)** — not scoring selection |

---

## Score history rule contract (P2)

| Item | Classification |
|------|----------------|
| Local score history (`postura_signal_score_history_v1`) | **Authoritative** under SPEC-002 |
| Remote Firestore score-history rules | **Deferred to SPEC-009** — not modified in SPEC-002 |
| CODE_COMPLETE impact | **NONBLOCKING_LOCAL_AUTHORITY** |

---

## Local atomicity scope

**ATOMICITY PASS** = coherent single `saveAll()` mutation for current score fields + local score history append in `db.ts`.  
**NOT claimed:** distributed Firestore/localStorage transaction.

---

## Unscored Signal reachability (cloud ingest deferral)

Governed paths for Signals created unscored by `scheduledIngest`:

| Trigger | Location | Path |
|---------|----------|------|
| Bulk score button | `main.ts` `#btn-score-all-signals` | `scoreSignal` → `ScoreAndRouteSignal` |
| Send to curation | `main.ts` `.btn-send-to-curation` | scores if `relevanceScore === undefined` |
| AI analyze | `main.ts` `.btn-analyze-signal` | `scoreSignal` before advisory |
| Client-side source poll | `main.ts` ingest poll | `scoreSignal` after signal create |
| Manual rescore | outcome feedback loop | `scoreSignal` on open signals |

**Status:** **PASS** — reachable governed orchestration exists (intentional deferral, not stranding).

---

## Deploy gates (separate from CODE_COMPLETE)

| # | Criterion | Status |
|---|-----------|--------|
| D1 | Production/hosted verification of cloud scoring parity (if/when deploy authorized) | ☐ **DEPLOYMENT_ONLY** — not required for CODE_COMPLETE |
| D2 | Cloud Functions deploy with consolidated scorer (if/when authorized) | ☐ **DEPLOYMENT_ONLY** — not started |
| D3 | Spec `DEPLOYED` / `DONE` | ☐ **DEPLOYMENT_ONLY** — separate human authorization |

---

## Sign-off

| Role | Date | Result |
|------|------|--------|
| Phase 0 inventory | 2026-08-23 | **COMPLETE** |
| Phase 0B formal package | 2026-08-23 | **COMPLETE** (docs authored) |
| Human SPEC approver | 2026-08-23 | ✅ **APPROVED** (T-002-010) |
| Phase 6 acceptance evidence | 2026-08-24 | ✅ **COMPLETE** (T-002-601/602/603/605) |
| CODE_COMPLETE human (T-002-604) | 2026-08-24 | ✅ **APPROVED** — explicit human approval recorded |

**Current:** `CODE_COMPLETE` · Implementation acceptance **24/24 PASS** · **HUMAN DECISION = APPROVED** · **SPEC-002 IMPLEMENTATION = CODE_COMPLETE**
