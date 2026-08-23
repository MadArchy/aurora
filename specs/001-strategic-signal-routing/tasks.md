# Tasks 001 — Strategic Signal Routing

**Spec status:** `APPROVED` · **READY_FOR_IMPLEMENTATION**  
**Implementation:** Phase 1 **AUTHORIZED** (not complete)  
**Branch:** `spec/001-strategic-signal-routing`

---

## Phase 0B — Formal SPEC package

- [x] **T-001-001** Create `specs/001-strategic-signal-routing/` directory
- [x] **T-001-002** Author `spec.md` (scope, invariants, contested, AI, tenant, CODE_COMPLETE)
- [x] **T-001-003** Author `plan.md` (strangler, phases, dependencies)
- [x] **T-001-004** Author `tasks.md` (this file)
- [x] **T-001-005** Author `acceptance.md` (A1–A18 + deploy separation)
- [x] **T-001-006** Author `data-flow.md` (AUTO / CONTESTED / AI advisory)
- [x] **T-001-007** Author `hexagonal-boundaries.md`
- [x] **T-001-008** Author `migration-matrix.md` (Phase 0 call sites)
- [x] **T-001-009** Human SPEC approval → status `APPROVED` (2026-08-23 — explicit human authorization)

**Phase 0B gate:** ✅ COMPLETE · Human SPEC approval **APPROVED**

---

## Phase 1 — Contracts / domain foundation

- [ ] **T-001-101** Add `LEGACY` to `ThesisStatus` (constitution alignment)
- [ ] **T-001-102** Domain eligibility helper: production routing = ACTIVE only; exclude DRAFT/UNDER_REVIEW/PAUSED/ARCHIVED/LEGACY
- [ ] **T-001-103** Freeze routing result conceptual contract (states CLEAR/CONTESTED/UNROUTED; source AUTO/MANUAL; version; timestamp)
- [ ] **T-001-104** Introduce `routingAlgorithmVersion` (or equivalent) constant
- [ ] **T-001-105** Align/extend `thesisRoutingCore` without gratuitous rewrite
- [ ] **T-001-106** Domain unit tests: 1 / 2 / N ACTIVE; eligibility exclusions; contested margin

**Exit:** Typecheck + domain tests PASS; no strategic behavior change required yet beyond contracts.

---

## Phase 2 — Application / use cases

- [ ] **T-001-201** Implement `ScoreAndRouteSignal` application use case
- [ ] **T-001-202** Implement `OverrideSignalThesis` application use case
- [ ] **T-001-203** Contested policy: no silent first/primary attribution
- [ ] **T-001-204** Eliminate primary/`candidates[0]` fallback in central `scoreSignal` flow
- [ ] **T-001-205** Terminal discard governance: routing persist path MUST NOT silent-DISCARD
- [ ] **T-001-206** Optional: `GetSignalRoutingExplanation` / `RecomputeSignalRouting` only if needed

**Exit:** Central score/route path obeys CLEAR/CONTESTED/UNROUTED; discard side effect removed/relocated.

---

## Phase 3 — Persistence / history

- [ ] **T-001-301** `ThesisQueryPort` / `SignalWritePort` (+ read/history ports as needed)
- [ ] **T-001-302** Infrastructure adapters over `dbService` / Firestore sync
- [ ] **T-001-303** Persist full `thesisScores` + routing decision/rationale/version/source
- [ ] **T-001-304** Material history representation (bounded; no unbounded array by default)
- [ ] **T-001-305** Tenant-safe writes: preserve SPEC-009 envelope; never invent `organizationId`

**Exit:** Persistence tests PASS; history reconstructs material changes.

---

## Phase 4 — Interface / call-site migration

- [ ] **T-001-401** Migrate STRATEGIC_ROUTING rows in `migration-matrix.md`
- [ ] **T-001-402** Explicit routed thesis context in UI (no strategic primary collapse)
- [ ] **T-001-403** Contested UI: human MANUAL resolution path
- [ ] **T-001-404** Wire OverrideSignalThesis to existing override controls
- [ ] **T-001-405** REVIEW rows: classify remain PRESENTATION vs MIGRATE
- [ ] **T-001-406** Agents (`advisor`, `topicAgent`, `researchSignalsAgent`) — explicit thesisId or multi-eval; no silent `[0]` for strategic attribution

**Exit:** Strategic matrix rows = MIGRATE complete; presentation ALLOWED only where classified.

---

## Phase 5 — Governance / security

- [ ] **T-001-501** Architecture test: ban strategic `getPrimaryThesis` / `activeTheses[0]` / `theses[0]` / `candidates[0]` on listed modules
- [ ] **T-001-502** Contested + MANUAL override tests
- [ ] **T-001-503** Multi-thesis 1/2/N regression tests
- [ ] **T-001-504** Tenant envelope regression on signal routing writes
- [ ] **T-001-505** AI boundary test: SIGNAL_THESIS_EVAL cannot set routingDecision as authority
- [ ] **T-001-506** Negative: silent discard absent from ScoreAndRouteSignal persist path
- [ ] **T-001-507** Full call-site inventory re-scan

**Exit:** A14–A16 style evidence green.

---

## Phase 6 — Acceptance / CODE_COMPLETE

- [ ] **T-001-601** Acceptance matrix A1–A18 evidence filled
- [ ] **T-001-602** `npm run check` PASS
- [ ] **T-001-603** `npm run test:rules` PASS
- [ ] **T-001-604** Human sign-off → **CODE_COMPLETE**
- [ ] **T-001-605** Confirm DEPLOYED/DONE remain separate / NOT STARTED unless separately authorized

---

## Explicitly out of scope (task ban)

- SPEC-005 production D1–D4
- SPEC-009 production migration
- New AiOperation for routing
- Strategic Brief implementation (003)
- Big-bang UI rewrite
