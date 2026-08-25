# Tasks 003 — Strategic Brief

**Spec status:** `APPROVED`  
**Implementation:** **CODE_COMPLETE** · DEPLOYED **NO** · DONE **NO** · DEPLOYMENT **NOT_STARTED**  
**Branch:** `spec/003-strategic-brief`  
**Base SHA:** `e422359ab90e84d4eb26007db23da6d54390cf15`  
**Formal SPEC checkpoint:** `3c04c6df42d1d51fe8e38fd96deec3af826995eb`  
**Phase-1 checkpoint:** `005420565eee138cad097d6a741d19eede2676d1`  
**Phase-2 checkpoint:** `d4371e8d6a6b57c553c6723a1304e85a7e24f433`  
**Phase-3 frozen checkpoint:** `73004305561be5d12faaf2a524e50405d5e6809e`  
**Phase-4 implementation checkpoint:** `d2efadf14e930fd45cc46cf4805d4b8a278bd6a6`  
**Phase-4 governance checkpoint:** `e049fba24766be656de99a0592a28fd256b44a94`  
**Phase-5 frozen checkpoint:** `68a2d7db12f4cd5e3d9436418af98a83c90faae2`  
**Phase-6 acceptance evidence checkpoint:** `2cfe13cc8f3369e3da59b0c4829022e0cc10a0c7`  
**Human SPEC approval:** **APPROVED** (T-003-010) — 2026-08-24  
**Human CODE_COMPLETE approval (T-003-604):** **APPROVED** — 2026-08-24 (America/Bogota)  
**Approval text:** «Apruebo SPEC-003 como CODE_COMPLETE y autorizo el cierre de T-003-604.»

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

- [x] **T-003-301** Current Brief projection store (local-authoritative)
- [x] **T-003-302** Append-only Brief history store
- [x] **T-003-303** Tenant-safe atomic persist (Brief + history)
- [x] **T-003-304** Idempotent create/approve commands
- [x] **T-003-305** Actor/audit fields from trusted auth context
- [x] **T-003-306** Supersede chain integrity (no silent APPROVED mutation)

**Exit:** History append tests; approved Brief immutability tests. **DONE** — evidence: `src/infrastructure/strategicBrief/`; `src/composition/strategicBrief/composeStrategicBrief.ts`; `tests/strategicBriefPhase3.test.ts`; `tests/strategicBriefInfrastructureArchitecture.test.ts`.

Physical stores: `postura_strategic_brief_v1` (current) · `postura_strategic_brief_history_v1` (append-only history) · `postura_strategic_brief_override_v1` (append-only override audit). Local-authoritative only. Firestore Brief rules remain **FUTURE_NONBLOCKING / SPEC-009**.

First-create policy: Application emits `CREATED` history; Phase 3 persists that record. No synthesized Briefs from CurationEntry/DeliveryPackage.

F-003-01 = **IMPLEMENTED_BEFORE_CONSUMER_MIGRATION** · F-003-03 = **IMPLEMENTED_AUDIT_PERSISTENCE** · F-003-02 remains **OPEN_PHASE_4**. P1 count unchanged (3). Phase 4 **NOT STARTED**.

---

## Phase 3 correction — SPEC-001 patch integration + exclusive thesis authority

Original Phase-3 persistence checkpoint (pre-remediation): `52d61df4faf5e7ac4f2fe359ae4526b73e905bf3`

SPEC-001 original historical CODE_COMPLETE (unchanged): `4643cad115b4294c2fb04bd15a08d4478cc64039`

SPEC-001 compatibility persistence patch (algorithm unchanged): `80c93d8b0b03a5eaa0e3a75e953131e4700873d5`

Human authorization: persist `selectedThesisId` inside `routingDecision` and consume it exclusively in SPEC-003.

**Authoritative persisted thesis:** `signal.routingDecision.selectedThesisId` when `routingState === 'CLEAR'`.

**Legacy `signal.thesisId`:** COMPATIBILITY_ONLY — **not used** by SPEC-003 authority.

**Legacy CLEAR without `selectedThesisId`:** FAIL_CLOSED (`ROUTING_NOT_CLEAR`). No runtime backfill. `LEGACY_CLEAR_ROUTING_RECORDS = MIGRATION_NOT_PERFORMED`. Production data backfill **NOT PERFORMED**. Local/dev regeneration path: re-route through patched SPEC-001.

Corrected Phase-3 checkpoint is recorded after this remediation commit. Phase 4 **NOT STARTED**.

F-003-01 = **IMPLEMENTED_BEFORE_CONSUMER_MIGRATION** · F-003-03 = **IMPLEMENTED_AUDIT_PERSISTENCE** · F-003-02 remains **OPEN_PHASE_4**. P1 count unchanged (3).

---

## Phase 4 — Consumer migration

- [x] **T-003-401** Block `form-generate-content` without approved Brief (strategic path)
- [x] **T-003-402** Block `.btn-generate-scientific-article` without approved Brief
- [x] **T-003-403** Block `.btn-create-task-from-rec` without approved Brief
- [x] **T-003-404** `sendDelivery`: require `strategicBriefId` on strategic items
- [x] **T-003-405** Curation → Brief workflow (intake only; Brief is authority)
- [x] **T-003-406** `addOpportunity` / `saveContent` / task create: carry `strategicBriefId`
- [x] **T-003-407** `proposeAngle`: require Brief/thesis context — remove silent fallback
- [x] **T-003-408** DeliveryPackage: reference Brief; demote `strategicNote`
- [x] **T-003-409** Migration matrix rows → MIGRATED / DEPRECATED

**Exit:** A10, A28, A29 advanced — strategic consumer paths gated. **DONE** — evidence: `strategicBriefConsumer.ts`, `main.ts`, Phase 4 tests.

**Partial delivery policy:** all-or-nothing — unauthorized strategic item blocks entire send before AI.

**Generic manual tasks:** `form-add-task` ungated (GENERIC_NON_STRATEGIC).

**P1:** ORIGINAL **3** · RESOLVED **3** · UNRESOLVED **0** · FINDINGS **0**  
F-003-01 = **RESOLVED** · F-003-02 = **RESOLVED** · F-003-03 = **RESOLVED**

**P2:** ORIGINAL **5** · RESOLVED **3** · PARTIAL **2**  
P2-003-01 naming = **PARTIAL** · P2-003-02 curation queue fail-open = **PARTIAL** · P2-003-03/04/05 = **RESOLVED**

**Phase-4 implementation blockers:** **0**  
**Phase 5:** **READY** · **NOT STARTED** (T-003-501+ unchecked)  
**Implementation checkpoint:** `d2efadf14e930fd45cc46cf4805d4b8a278bd6a6`

---

## Phase 5 — Security / regression

**Status:** **COMPLETE** · Phase 6 **READY** / **NOT_STARTED**

- [x] **T-003-501** Architecture ban: no Brief authority in `main.ts` direct writes
- [x] **T-003-502** CONTESTED / UNROUTED / stale thesis adversarial matrix
- [x] **T-003-503** Cross-tenant negative tests (signal, thesis, evidence refs)
- [x] **T-003-504** Multi-signal mixed-thesis rejection tests
- [x] **T-003-505** Override audit completeness tests
- [x] **T-003-506** Idempotency + history regression suite
- [x] **T-003-507** SPEC-001 routing regression verification
- [x] **T-003-508** SPEC-002 scoring regression verification
- [x] **T-003-509** SPEC-005 Gateway regression verification
- [x] **T-003-510** SPEC-006 claim safety unchanged regression

**Exit:** P0/P1 closure evidence; security suite green. **DONE**

**Evidence:**
- `tests/strategicBriefSecurityArchitecture.test.ts` (T-003-501)
- `tests/strategicBriefPhase5.test.ts` (T-003-502…506)
- T-003-507…510 verified via existing SPEC-001/002/005/006 suites under `npm run check`

**P0 = 0 · New unresolved P1 = 0**

**P2 after Phase 5:** ORIGINAL **5** · RESOLVED **3** · PARTIAL **2** (unchanged)  
P2-003-01 naming = **PARTIAL / NONBLOCKING** (no authority risk)  
P2-003-02 curation queue fail-open = **PARTIAL / NONBLOCKING** — intake may still occur; strategic authorization fail-closed proven

**Local-store threat model:** LOCAL_AUTHORITATIVE — malformed records fail closed; cryptographic tamper-resistance **not claimed** (SPEC-009 deferred).

**Phase 6:** **READY** · **NOT STARTED** — do not declare CODE_COMPLETE without Phase 6 + human sign-off.

---

## Phase 6 — Acceptance / CODE_COMPLETE

**Status:** **IMPLEMENTATION = CODE_COMPLETE** · DEPLOYED **NO** · DONE **NO** · DEPLOYMENT **NOT_STARTED**

- [x] **T-003-601** Acceptance matrix A1–A36 evidence filled
- [x] **T-003-602** `npm run check` PASS — **844/844** (Phase 6 evidence + closure re-verify)
- [x] **T-003-603** `npm run test:rules` PASS — **91/91** (Phase 6 evidence + closure re-verify)
- [x] **T-003-604** Human sign-off → **CODE_COMPLETE** — **DONE**
- [x] **T-003-605** Confirm DEPLOYED/DONE remain separate / NOT STARTED — **CONFIRMED** (DEPLOYED=NO · DONE=NO · D1–D3 DEPLOYMENT_ONLY_PENDING)

**Exit:** Implementation acceptance **36/36 PASS** · Human sign-off **APPROVED** · **IMPLEMENTATION = CODE_COMPLETE**.

### Human CODE_COMPLETE approval (T-003-604)

| Field | Value |
|-------|--------|
| **Status** | **DONE** |
| **Date** | **2026-08-24** (America/Bogota) |
| **Authorization text** | «Apruebo SPEC-003 como CODE_COMPLETE y autorizo el cierre de T-003-604.» |
| **Basis** | A1–A36 = 36/36 PASS · P0 = 0 · P1 unresolved = 0 · blocking P2 = 0 · cross-SPEC PASS · check PASS · rules PASS · Phase-6 evidence checkpoint `2cfe13cc8f3369e3da59b0c4829022e0cc10a0c7` |

### T-003-605 meaning (unchanged)

**Confirm DEPLOYED/DONE remain separate / NOT STARTED** — not a second CODE_COMPLETE declaration. Remains **CONFIRMED**: CODE_COMPLETE ≠ DEPLOYED ≠ DONE. D1–D3 stay **PENDING_DEPLOYMENT_ONLY**.

### Final implementation status

| Field | Value |
|-------|--------|
| **SPEC-003 IMPLEMENTATION** | **CODE_COMPLETE** |
| **DEPLOYED** | **NO** |
| **DEPLOYMENT** | **NOT_STARTED** |
| **DONE** | **NO** |
| **D1–D3** | **PENDING_DEPLOYMENT_ONLY** |
| **LOCAL_AUTHORITATIVE** | **KNOWN_LIMITATION_NONBLOCKING** |
| **LEGACY CLEAR MIGRATION** | **DEFERRED_NONBLOCKING** |
| **SPEC-009 PRODUCTION** | **DEFERRED_UNCHANGED** |

**Prohibited without separate authorization:** deploy · merge main · D1–D3 · production backfill · SPEC-009 production changes · start another SPEC.

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
