# Tasks 002 — Strategic Scoring V2

**Spec status:** `APPROVED`  
**Implementation:** **Phase 4 COMPLETE** · Phase 5 **NOT STARTED**  
**Branch (recommended):** `spec/002-strategic-scoring-v2`

---

## Phase 0B — Formal SPEC package

- [x] **T-002-001** Create `specs/002-strategic-scoring-v2/` directory
- [x] **T-002-002** Author `spec.md` (scope, routing contract, AI, tenant, CODE_COMPLETE)
- [x] **T-002-003** Author `plan.md` (strangler, phases, dependencies)
- [x] **T-002-004** Author `tasks.md` (this file)
- [x] **T-002-005** Author `acceptance.md` (A1–A24 + deploy separation)
- [x] **T-002-006** Author `data-flow.md` (routed scoring, CONTESTED, cloud target, AI advisory)
- [x] **T-002-007** Author `hexagonal-boundaries.md`
- [x] **T-002-008** Author `migration-matrix.md` (Phase 0 paths)
- [x] **T-002-009** Author `scoring-model.md` (baseline formula, bands, versioning)
- [x] **T-002-010** Human SPEC approval → status `APPROVED`

**Phase 0B gate:** Package authored · Human SPEC approval **DONE** @ Phase 0B checkpoint `94e6140`

---

## Phase 1 — Domain scoring contracts

- [x] **T-002-101** Extract canonical pure `scoringCore` from `services/scoring.ts` (baseline v1 parity)
- [x] **T-002-102** Introduce `SCORING_ALGORITHM_VERSION` / `scoringVersion` constant (`scoring-v1`)
- [x] **T-002-103** Define disposition vs output-format types (`dispositionCore.ts`)
- [x] **T-002-104** Unify explainability weights with scoring core (single weight source)
- [x] **T-002-105** Domain deterministic tests: same inputs → same score; band boundaries; penalties
- [x] **T-002-106** Document mapping from legacy `recommendedAction` → disposition + format (compat layer plan)

**Exit:** Domain tests PASS; no behavior change vs baseline v1 without explicit version bump. **DONE** — evidence: `tests/scoringCore.test.ts`, `tests/dispositionCore.test.ts`, `tests/scoringArchitecture.test.ts`; `services/scoring.ts` delegates to Domain core.

---

## Phase 2 — Application / governance

- [x] **T-002-201** Define Application use cases (e.g. `ScoreSignalAgainstRoutedContext`, `RecomputeSignalScore`)
- [x] **T-002-202** Scoring ports (read/write/history) — no concrete db in Application
- [x] **T-002-203** Consume SPEC-001 routing context; reject independent thesis selection
- [x] **T-002-204** CLEAR / CONTESTED / UNROUTED consumption policy in Application
- [x] **T-002-205** Remove terminal DISCARD from governed score persistence paths (design + tests)
- [x] **T-002-206** Controlled error model (`SIGNAL_NOT_FOUND`, `TENANT_CONTEXT_INVALID`, etc.)
- [x] **T-002-207** Wire SPEC-001 `StrategicScoringPort` to Domain core (adapter swap)

**Exit:** Application hexagonal tests; no auto-DISCARD on governed persist. **DONE** — evidence: `tests/strategicScoringPhase2.test.ts`, `tests/strategicScoringArchitecture.test.ts`; `src/application/strategicScoring/`.

---

## Phase 3 — Persistence / score history

- [x] **T-002-301** Material score change detection (score, band, disposition, scoringVersion)
- [x] **T-002-302** Score history entry types (storage-neutral Domain)
- [x] **T-002-303** Local or bounded history store (physical form TBD — avoid unbounded Signal arrays)
- [x] **T-002-304** Tenant-safe atomic persist (score + history)
- [x] **T-002-305** Idempotent equivalent re-score (no duplicate history noise)

**Exit:** History append tests; timestamp-only rescore does not grow history. **DONE** — evidence: `scoreHistoryCore.ts`, `tests/scoreHistoryCore.test.ts`, `tests/strategicScoringPhase3.test.ts`, `db.applyGovernedScoreToSignal`.

---

## Phase 4 — Consumer migration

- [x] **T-002-401** Replace `scoreSignalCloud` with Domain core wrapper (parity tests)
- [x] **T-002-402** `scheduledIngest`: remove `thesesSnap.docs[0]` strategic context — defer routing+scoring to governed client pipeline
- [x] **T-002-403** Remove cloud auto-DISCARD from score-at-ingest (P0-2 closure)
- [x] **T-002-404** `ai.analyzeSignalAgainstThesis`: advisory-only; no direct signal score-field mutation
- [x] **T-002-405** Deprecate strategic use of `applyScoreToSignal` auto-DISCARD (zero src callers)
- [x] **T-002-406** Radar/triage consumers: disposition vs format fields (`radarTriageCore`)
- [x] **T-002-407** Migration matrix rows → MIGRATED

**Exit:** Zero strategic primary shortcuts in scoring paths; cloud parity tests PASS. **DONE** — evidence: `tests/scoringPhase4.test.ts`, `functions/src/lib/scoreSignal.ts` (Domain wrapper), `scheduledIngest.ts` (gate-only ingest), `ai.ts` (advisory-only).

---

## Phase 5 — Security / regression

- [ ] **T-002-501** Architecture ban: no duplicate independent scoring formulas in strategic modules
- [ ] **T-002-502** Multi-thesis + CONTESTED + UNROUTED scoring governance tests
- [ ] **T-002-503** Tenant negative tests at persistence boundary
- [ ] **T-002-504** Auto-discard regression suite
- [ ] **T-002-505** SPEC-001 routing regression verification
- [ ] **T-002-506** SPEC-005 Gateway regression verification
- [ ] **T-002-507** Cloud/client parity test matrix

**Exit:** P0/P1 closure evidence; security suite green.

---

## Phase 6 — Acceptance / CODE_COMPLETE

- [ ] **T-002-601** Acceptance matrix A1–A24 evidence filled
- [ ] **T-002-602** `npm run check` PASS
- [ ] **T-002-603** `npm run test:rules` PASS
- [ ] **T-002-604** Human sign-off → **CODE_COMPLETE**
- [ ] **T-002-605** Confirm DEPLOYED/DONE remain separate / NOT STARTED

---

## Explicitly out of scope (task ban)

- SPEC-001 routing changes
- SPEC-005 production D gates
- SPEC-009 production migration
- Strategic Brief (003) implementation
- New AiOperation unless gap proven and approved
- Big-bang scoring rewrite

---

## P0 / P1 tracking

| ID | Item | Phase |
|----|------|-------|
| P0-1 | Formal spec missing | **0B** (this package) |
| P0-2 | Cloud ingest `[0]` + auto-DISCARD | **4** ✅ RESOLVED (402–403) |
| P1-1 | Legacy `applyScoreToSignal` | **4** ✅ DEPRECATED — zero src callers |
| P1-2 | Disposition/format split | **1** ✅ |
| P1-3 | Dual scorer drift | **4** ✅ Domain wrapper |
| P1-4 | Missing scoringVersion | **1** ✅ |
