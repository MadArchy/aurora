# Tasks 003 — Strategic Brief

**Spec status:** `APPROVED`  
**Implementation:** **Phase 2 COMPLETE** · Phase 3 **NOT STARTED**  
**Branch:** `spec/003-strategic-brief`  
**Base SHA:** `e422359ab90e84d4eb26007db23da6d54390cf15`  
**Formal SPEC checkpoint:** `3c04c6df42d1d51fe8e38fd96deec3af826995eb`  
**Phase-1 checkpoint:** `005420565eee138cad097d6a741d19eede2676d1`  
**Human SPEC approval:** **APPROVED** (T-003-010) — 2026-08-24

---

## Phase 0B — Formal SPEC package

- [x] **T-003-001** Create `specs/003-strategic-brief/` directory
- [x] **T-003-002** Author `spec.md` (decision boundary, gate, upstream contracts)
- [x] **T-003-003** Author `plan.md` (strangler, phases, dependencies)
- [x] **T-003-004** Author `tasks.md` (this file)
- [x] **T-003-005** Author `acceptance.md` (A1–A36 + deploy separation)
- [x] **T-003-006** Author `data-flow.md` (flows, gate points, routing policies)
- [x] **T-003-007** Author `hexagonal-boundaries.md`
- [x] **T-003-008** Author `migration-matrix.md` (legacy paths)
- [x] **T-003-009** Author `brief-model.md` (fields, status, materiality)
- [x] **T-003-010** Human SPEC approval → status `APPROVED` — **DONE**

**Phase 0B gate:** Package authored · Human SPEC approval **DONE**

**Exit:** Formal package complete · **APPROVED** · Phase 1 **AUTHORIZED** · Phase 1 implementation **NOT STARTED**

---

## Phase 1 — Domain contracts

- [x] **T-003-101** Define `StrategicBrief` aggregate + `StrategicDecisionSnapshot` types (Domain)
- [x] **T-003-102** Define `BriefStatus` enum + legal transition guard
- [x] **T-003-103** Material change detection for Brief revisions
- [x] **T-003-104** Thesis-first + tenant reference validation (pure functions)
- [x] **T-003-105** CLEAR / CONTESTED / UNROUTED brief eligibility rules
- [x] **T-003-106** Multi-signal same-thesis validation
- [x] **T-003-107** Override audit record types (minimum fields)
- [x] **T-003-108** Domain unit tests: status transitions, materiality, routing gates

**Exit:** Domain tests PASS; no Firebase/db/React imports. **DONE** — evidence: `src/domain/strategicBriefCore.ts`, `briefMaterialityCore.ts`, `briefRoutingGateCore.ts`, `briefTenantCore.ts`, `strategicBriefErrors.ts`; `tests/strategicBriefCore.test.ts`, `tests/strategicBriefArchitecture.test.ts`.

F-003-01 = **PARTIAL_DOMAIN_IMPLEMENTED** · F-003-03 = **PARTIAL_DOMAIN_CONTRACT** · F-003-02 remains **OPEN_PHASE_4**. P1 count unchanged (3).

---

## Phase 2 — Application / governance

- [x] **T-003-201** `CreateStrategicBrief` use case
- [x] **T-003-202** `ApproveStrategicBrief` / `RejectStrategicBrief` use cases
- [x] **T-003-203** `ReviseStrategicBrief` use case (supersede semantics)
- [x] **T-003-204** `OverrideStrategicBrief` use case (auditable)
- [x] **T-003-205** `StrategicContextReader` port — read SPEC-001/002 projections
- [x] **T-003-206** `StrategicBriefRepository` + `StrategicBriefHistoryPort`
- [x] **T-003-207** Downstream authorization query (`isBriefAuthorizedForAction`)
- [x] **T-003-208** Controlled error model (`BRIEF_NOT_FOUND`, `ROUTING_NOT_CLEAR`, `TENANT_CONTEXT_INVALID`, …)
- [x] **T-003-209** Disposition/format override rationale enforcement

**Exit:** Application hexagonal tests; no concrete db in use cases. **DONE** — evidence: `src/application/strategicBrief/`; `tests/strategicBriefPhase2.test.ts`; `tests/strategicBriefApplicationArchitecture.test.ts`.

F-003-01 = **PARTIAL_APPLICATION_IMPLEMENTED** · F-003-03 = **PARTIAL_APPLICATION_IMPLEMENTED** · F-003-02 remains **OPEN_PHASE_4**. P1 count unchanged (3). Persistence remains Phase 3.

---

## Phase 3 — Persistence / history

- [ ] **T-003-301** Current Brief projection store (local-authoritative)
- [ ] **T-003-302** Append-only Brief history store
- [ ] **T-003-303** Tenant-safe atomic persist (Brief + history)
- [ ] **T-003-304** Idempotent create/approve commands
- [ ] **T-003-305** Actor/audit fields from trusted auth context
- [ ] **T-003-306** Supersede chain integrity (no silent APPROVED mutation)

**Exit:** History append tests; approved Brief immutability tests.

---

## Phase 4 — Consumer migration

- [ ] **T-003-401** Block `form-generate-content` without approved Brief (strategic path)
- [ ] **T-003-402** Block `.btn-generate-scientific-article` without approved Brief
- [ ] **T-003-403** Block `.btn-create-task-from-rec` without approved Brief
- [ ] **T-003-404** `sendDelivery`: require `strategicBriefId` on strategic items
- [ ] **T-003-405** Curation → Brief workflow (intake only; Brief is authority)
- [ ] **T-003-406** `addOpportunity` / `saveContent` / task create: carry `strategicBriefId`
- [ ] **T-003-407** `proposeAngle`: require Brief/thesis context — remove silent fallback
- [ ] **T-003-408** DeliveryPackage: reference Brief; demote `strategicNote`
- [ ] **T-003-409** Migration matrix rows → MIGRATED / DEPRECATED

**Exit:** A10, A28, A29 green; zero strategic bypass paths.

---

## Phase 5 — Security / regression

- [ ] **T-003-501** Architecture ban: no Brief authority in `main.ts` direct writes
- [ ] **T-003-502** CONTESTED / UNROUTED / stale thesis adversarial matrix
- [ ] **T-003-503** Cross-tenant negative tests (signal, thesis, evidence refs)
- [ ] **T-003-504** Multi-signal mixed-thesis rejection tests
- [ ] **T-003-505** Override audit completeness tests
- [ ] **T-003-506** Idempotency + history regression suite
- [ ] **T-003-507** SPEC-001 routing regression verification
- [ ] **T-003-508** SPEC-002 scoring regression verification
- [ ] **T-003-509** SPEC-005 Gateway regression verification
- [ ] **T-003-510** SPEC-006 claim safety unchanged regression

**Exit:** P0/P1 closure evidence; security suite green.

---

## Phase 6 — Acceptance / CODE_COMPLETE

- [ ] **T-003-601** Acceptance matrix A1–A36 evidence filled
- [ ] **T-003-602** `npm run check` PASS
- [ ] **T-003-603** `npm run test:rules` PASS
- [ ] **T-003-604** Human sign-off → **CODE_COMPLETE**
- [ ] **T-003-605** Confirm DEPLOYED/DONE remain separate / NOT STARTED

**Exit:** Implementation acceptance 36/36 PASS · Human sign-off · CODE_COMPLETE

---

## Out of scope (explicit)

- SPEC-001 / SPEC-002 product changes
- SPEC-005 Gateway redesign
- SPEC-006 claim algorithm changes
- SPEC-009 production rules
- SPEC-004 Planner implementation
- Phase 1 start before T-003-010 approval — **CLOSED** (approval recorded 2026-08-24)

---

## Deferred debt register (Phase 0B)

| ID | Item | Status |
|----|------|--------|
| D-003-01 | Remote Firestore Brief rules | **DEFERRED_TO_SPEC-009** |
| D-003-02 | Composite multi-thesis Brief | **OUT_OF_SCOPE** |
| D-003-03 | Non-actionable CONTESTED DRAFT candidate | **DEFERRED** — prefer fail-closed |
