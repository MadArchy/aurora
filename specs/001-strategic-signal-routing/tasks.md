# Tasks 001 — Strategic Signal Routing

**Spec status:** `APPROVED` · **READY_FOR_IMPLEMENTATION**  
**Implementation:** Phase 1–4 **COMPLETE** · Phase 5 **NOT STARTED**  
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

## Phase 1 — Contracts / domain foundation ✅

- [x] **T-001-101** Add `LEGACY` to `ThesisStatus` (constitution alignment)
- [x] **T-001-102** Domain eligibility helper: production routing = ACTIVE only; exclude DRAFT/UNDER_REVIEW/PAUSED/ARCHIVED/LEGACY
- [x] **T-001-103** Freeze routing result conceptual contract (states CLEAR/CONTESTED/UNROUTED; source AUTO/MANUAL; version; timestamp)
- [x] **T-001-104** Introduce `routingAlgorithmVersion` (or equivalent) constant
- [x] **T-001-105** Align/extend `thesisRoutingCore` without gratuitous rewrite
- [x] **T-001-106** Domain unit tests: 1 / 2 / N ACTIVE; eligibility exclusions; contested margin

**Exit:** ✅ Typecheck + domain tests PASS (Phase 1 checkpoint).

### Phase 1 implementation notes

| Artifact | Location |
|----------|----------|
| `LEGACY` status | `src/types/index.ts` `ThesisStatus` |
| Eligibility | `src/domain/thesisRoutingEligibility.ts` |
| Router + contracts | `src/domain/thesisRoutingCore.ts` (`ROUTING_ALGORITHM_VERSION = routing-v1`) |
| Domain tests | `tests/thesisRoutingCore.test.ts` |
| Architecture tests | `tests/thesisRoutingArchitecture.test.ts` |

**Contract decisions:**
- CONTESTED does **not** set `selectedThesisId` / `primaryThesisId` (no silent attribution).
- Exact score tie + unequal thesis priority → CLEAR via priority (deterministic).
- Near-score within `ROUTING_CONTEST_MARGIN` → CONTESTED.
- Router filters ACTIVE-only before scoring.
- `routingSignalPatch` writes `thesisId` only when CLEAR.
- Manual override / history: domain draft types only (`ManualRoutingOverrideDraft`, `MaterialRoutingDecision`); no persistence.
- Call sites **not** migrated (Phase 4).

**Acceptance advanced (not full PASS):** A3, A8, A10, A15 (domain); A1/A4/A5/A11 partial (domain only).

---

## Phase 2 — Application / use cases ✅

- [x] **T-001-201** Implement `ScoreAndRouteSignal` application use case
- [x] **T-001-202** Implement `OverrideSignalThesis` application use case
- [x] **T-001-203** Contested policy: no silent first/primary attribution
- [x] **T-001-204** Eliminate primary/`candidates[0]` fallback in central `scoreSignal` flow
- [x] **T-001-205** Terminal discard governance: routing persist path MUST NOT silent-DISCARD
- [ ] **T-001-206** Optional: `GetSignalRoutingExplanation` / `RecomputeSignalRouting` only if needed — **deferred** (not required)

**Exit:** ✅ Central score/route path obeys CLEAR/CONTESTED/UNROUTED; discard side effect removed from routing writer.

### Phase 2 implementation notes

| Artifact | Location |
|----------|----------|
| Application | `src/application/strategicSignalRouting/` |
| Ports | ThesisQuery / SignalRead / SignalWrite / StrategicScoring |
| Infra adapter (strangler) | `src/infrastructure/strategicSignalRouting/DbStrategicSignalRoutingAdapter.ts` |
| Composition | `src/composition/strategicSignalRouting/composeStrategicSignalRouting.ts` |
| Central UI glue | `main.scoreSignal` → `scoreAndRouteSignal`; override → `overrideSignalThesis` |
| Persistence | `db.applyStrategicRoutingToSignal` (no auto-DISCARD) |
| Tests | `tests/strategicSignalRoutingPhase2.test.ts`, `strategicSignalRoutingArchitecture.test.ts` |

**Manual override eligibility:** ACTIVE theses only (SPEC-aligned).  
**Stale attribution:** CONTESTED/UNROUTED clears `thesisId` (false current attribution); `thesisScores` retained; physical history Phase 3.  
**T-001-206:** not implemented (optional).

---

## Phase 3 — Persistence / history ✅

- [x] **T-001-301** `ThesisQueryPort` / `SignalWritePort` (+ read/history ports as needed)
- [x] **T-001-302** Infrastructure adapters over `dbService` / Firestore sync
- [x] **T-001-303** Persist full `thesisScores` + routing decision/rationale/version/source
- [x] **T-001-304** Material history representation (bounded; no unbounded array by default)
- [x] **T-001-305** Tenant-safe writes: preserve SPEC-009 envelope; never invent `organizationId`

**Exit:** ✅ Persistence tests PASS; history reconstructs material changes.

### Phase 3 implementation notes

| Artifact | Location |
|----------|----------|
| Material change + history types | `src/domain/routingHistoryCore.ts` |
| History read port | `RoutingHistoryPort` |
| Atomic write | `SignalWritePort.persistStrategicRouting` (+ optional `historyEntry`) |
| Local store | `db.signalRoutingHistory` → `postura_signal_routing_history_v1` |
| Logical Firestore path (future) | `clients/{clientId}/signals/{signalId}/routingHistory/{id}` |
| Tests | `tests/strategicSignalRoutingPhase3.test.ts` |

**Material fields:** `routingState`, `selectedThesisId`, `source`, `algorithmVersion`  
**Not material:** `routedAt`, rationale-only changes  

**First assignment:** no history entry (INITIAL without prior).  
**Algorithm version change:** material (YES history).  
**AUTO→MANUAL same thesis:** material.  
**Equivalent reroute:** no history growth.

**SPEC-001 ROUTING HISTORY RULES CONTRACT GAP:** nested `routingHistory` under signals is **not** covered by current `firestore.rules`. History is **local-authoritative** for Phase 3; remote sync deferred with SPEC-009 (production unchanged). Current Signal routing fields continue to sync via existing `signals` path.

**Atomicity:** local single `saveAll` unit for history append + current update = PASS. Cross-network Firestore batch for history = BLOCKED until rules (documented gap).

---

## Phase 4 — Interface / call-site migration ✅

- [x] **T-001-401** Migrate STRATEGIC_ROUTING rows in `migration-matrix.md`
- [x] **T-001-402** Explicit routed thesis context in UI (no strategic primary collapse)
- [x] **T-001-403** Contested UI: human MANUAL resolution path
- [x] **T-001-404** Wire OverrideSignalThesis to existing override controls
- [x] **T-001-405** REVIEW rows: classify remain PRESENTATION vs MIGRATE
- [x] **T-001-406** Agents (`advisor`, `topicAgent`, `researchSignalsAgent`) — explicit thesisId or multi-eval; no silent `[0]` for strategic attribution

**Exit:** ✅ Strategic matrix rows migrated; presentation ALLOWED only where classified.

### Phase 4 implementation notes

| Area | Disposition |
|------|-------------|
| `main.scoreSignal` / override | Already MIGRATED (Phase 2) |
| `main` analyze / discovery / content fallbacks | MIGRATED — fail-closed or multi-ACTIVE |
| `advisor` | Client-wide without primary; `proposeAngle` needs explicit `thesisId` |
| `topicAgent` | ALL ACTIVE theses |
| `researchSignalsAgent` | Per-signal routed CLEAR only |
| `ClientWorkspace` radar | `canScore` via ACTIVE count — no `[0]` |
| `SourceRegistryModal` | Multi-thesis discovery; no silent source↔thesis bind |
| `ClientPortal` `theses[0]` | **ALLOWED_PRESENTATION_ONLY** |
| `ManagerCockpit` chip | **ALLOWED_PRESENTATION_ONLY** |
| `getPrimaryThesis` | PRESENTATION_ONLY / LEGACY — portfolio metrics only |
| `thesisContextCore` | No primary fallback unless `allowPrimaryFallback` |

**Debt:** D-001-02 strategic primary/[0] = **RESOLVED** · D-001-06 candidates[0] = **RESOLVED**

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
