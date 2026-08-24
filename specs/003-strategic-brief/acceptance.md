# Acceptance 003 — Strategic Brief

**Phase 0B:** criteria defined.  
**Phase 6:** not started (CODE_COMPLETE human sign-off pending).

Spec **CODE_COMPLETE** requires Required (A\*) full PASS + human sign-off (Phase 6 T-003-604).  
Spec **DONE** requires CODE_COMPLETE + agreed deploy verification (separate).

**Implementation baseline:** SPEC-002 CODE_COMPLETE @ `ab01c46` product; `e422359` governance.

---

## Required (implementation → CODE_COMPLETE)

| # | Criterion | Maps to | Status |
|---|-----------|---------|--------|
| A1 | StrategicBrief canonical entity satisfies constitutional required fields | `brief-model.md` §12 | ✅ **PASS (Domain)** |
| A2 | One authoritative Strategic Decision contract (StrategicDecisionSnapshot in Brief) | Design A | ✅ **PASS (Domain)** |
| A3 | Brief consumes SPEC-001 routing without mutating it | Context reader | ✅ **PASS (Application+Infrastructure)** — read-only adapter |
| A4 | Brief consumes SPEC-002 scoring without recomputing it | Context reader | ✅ **PASS (Application+Infrastructure)** — projection copy only; no rescore |
| A5 | CLEAR uses explicit governed thesis (`selectedThesisId`) | Routing gate | ✅ **PASS (Domain+Application+Infrastructure)** — exclusive `routingDecision.selectedThesisId`; no `signal.thesisId` companion |
| A6 | CONTESTED cannot authorize downstream action | Fail-closed | ✅ **PASS (Domain+Application gate)** — consumer paths Phase 4 |
| A7 | UNROUTED cannot authorize downstream action | Fail-closed | ✅ **PASS (Domain+Application gate)** — consumer paths Phase 4 |
| A8 | No primary/first thesis fallback | Architecture ban | ✅ **PASS (Application+Infrastructure scan)** — Phase 5 remaining |
| A9 | Multi-signal Brief requires tenant-safe compatible thesis context | Multi-signal validator | ✅ **PASS (Domain+Application)** |
| A10 | No strategic downstream artifact without approved Brief authorization | Downstream gate | ☐ Phase 4 |
| A11 | CurationEntry is not strategic authority | Migration | ☐ Phase 4 |
| A12 | DeliveryPackage is not StrategicBrief authority | Migration | ☐ Phase 4 |
| A13 | AI remains advisory only | SPEC-005 boundary | ✅ **PASS (Domain+Application boundary)** — Phase 5 remaining |
| A14 | AI structured output remains SPEC-005 validated | Gateway schemas | ☐ Phase 5 |
| A15 | Evidence linkage preserved (`signalIds`, `supportingEvidenceIds`) | Brief model | ✅ **PASS (Domain+persistence)** — consumer carry Phase 4 |
| A16 | SPEC-006 remains claim-verification authority | Boundary test | ☐ Phase 5 |
| A17 | Decision/Brief explainability reconstructable | History + snapshot | ✅ **PASS (append-only history store)** |
| A18 | Human approval required for actionable Brief | Approve use case | ✅ **PASS (Domain+Application)** |
| A19 | Override auditable or bypass formally prohibited | Override contract | ✅ **PASS (Domain+Application+override store)** |
| A20 | Tenant mismatch / cross-client references rejected | Tenant gate | ✅ **PASS (Application+tenant-safe persistence)** |
| A21 | Version/revision semantics implemented | `version` integer | ✅ **PASS (Domain+persistence)** |
| A22 | Material history append-only | History store | ✅ **PASS (Phase 3)** |
| A23 | Equivalent operation idempotent / no uncontrolled duplication | Idempotency | ✅ **PASS (Application+physical write-unit identity)** |
| A24 | Approved Brief material changes cannot silently overwrite authority | Supersede | ✅ **PASS (Domain+Application+persistence)** |
| A25 | Domain framework-pure | Architecture test | ✅ **PASS (Domain files)** — Phase 5 remaining |
| A26 | Application depends on ports, not infrastructure | Hexagonal test | ✅ **PASS (Application+Infrastructure architecture)** — Phase 5 remaining |
| A27 | Direct UI Brief-authority writes prohibited | Architecture ban | ◐ **PARTIAL (Application API exists)** — UI still Phase 4/5 |
| A28 | Legacy direct strategic content paths migrated or blocked | Phase 4 matrix | ☐ Phase 4 |
| A29 | Strategic downstream artifacts carry Brief authorization reference | `strategicBriefId` | ☐ Phase 4 |
| A30 | No silent learning / automatic strategic mutation | Governance | ✅ **PASS (Domain+Application)** — Phase 5 remaining |
| A31 | SPEC-001 regression PASS | Test suite | ☐ Phase 6 |
| A32 | SPEC-002 regression PASS | Test suite | ☐ Phase 6 |
| A33 | SPEC-005 regression PASS | Test suite | ☐ Phase 6 |
| A34 | SPEC-006 regression PASS | Test suite | ☐ Phase 6 |
| A35 | `npm run check` PASS | Governance | ☐ Phase 6 |
| A36 | `npm run test:rules` PASS | Governance | ☐ Phase 6 |

**Implementation acceptance:** **Domain + Application + local persistence advanced (Phase 3)** — not CODE_COMPLETE  
**CODE_COMPLETE:** **NO** — consumer migration remaining (Phase 4)

**P1 at Phase 3 exit:** F-003-01 **IMPLEMENTED_BEFORE_CONSUMER_MIGRATION** · F-003-02 **OPEN_PHASE_4** · F-003-03 **IMPLEMENTED_AUDIT_PERSISTENCE** · P1 count **3** (unchanged)

**Thesis authority (corrected Phase 3):** `AUTHORITATIVE PERSISTED THESIS = routingDecision.selectedThesisId`. Legacy `signal.thesisId` = **COMPATIBILITY_ONLY / NOT USED BY SPEC-003 AUTHORITY**. Legacy CLEAR without `selectedThesisId` = **FAIL_CLOSED**. SPEC-001 compatibility checkpoint = `80c93d8b0b03a5eaa0e3a75e953131e4700873d5`. Original SPEC-001 CODE_COMPLETE = `4643cad115b4294c2fb04bd15a08d4478cc64039`. Production backfill **NOT PERFORMED**.

---

## Test themes (future — Phase 5/6)

| Theme | Acceptance |
|-------|------------|
| CLEAR happy path | A5, A10 |
| CONTESTED blocked | A6 |
| UNROUTED blocked | A7 |
| Stale `thesisId` | A5, A8 |
| Cross-client thesis/evidence | A20 |
| Multi-signal same thesis | A9 |
| Multi-signal mixed thesis | A9 |
| Approve / reject / revision | A18, A24 |
| Override audit | A19 |
| History / version | A21, A22 |
| Idempotency | A23 |
| Content without brief blocked | A10, A28 |
| Task without brief blocked | A10, A28 |
| Opportunity without brief blocked | A10, A28 |
| AI advisory failure | A13 |
| SPEC-006 unchanged | A16, A34 |
| Domain purity | A25 |
| Application hexagonal | A26 |

---

## Deploy gates (separate from CODE_COMPLETE)

| # | Criterion | Status |
|---|-----------|--------|
| D1 | Deploy Brief persistence/gating infrastructure if required for hosted parity | ☐ **DEPLOYMENT_ONLY** |
| D2 | Production smoke: CLEAR → create/approve brief; strategic downstream blocked without approved brief | ☐ **DEPLOYMENT_ONLY** |
| D3 | Spec `DEPLOYED` / `DONE` | ☐ **DEPLOYMENT_ONLY** — separate human authorization |

---

## Phase 0 findings (unchanged)

| Severity | Count |
|----------|-------|
| P0 | 0 |
| P1 | 3 (F-003-01, F-003-02, F-003-03) |
| P2 | 5 |
| P3 | 2 |

**P1 resolved:** 0 — F-003-01 / F-003-03 persistence-complete but acceptance still requires Phase-4 consumer integration; F-003-02 **OPEN_PHASE_4**

---

## Sign-off tracking

| Milestone | Status |
|-----------|--------|
| Phase 0B package | ✅ COMPLETE (2026-08-24) |
| T-003-010 Human SPEC approval | ✅ **APPROVED** (2026-08-24) |
| Phase 1 authorization | ✅ **AUTHORIZED** |
| Phase 1 Domain implementation | ✅ **COMPLETE** |
| Phase 2 Application / governance | ✅ **COMPLETE** |
| Phase 3 Persistence / history | ✅ **COMPLETE** (pre-remediation `52d61df4…`) |
| Phase 3 correction (exclusive thesis reader) | ✅ **COMPLETE** — SPEC-001 patch `80c93d8b…` integrated |
| Phase 4 Consumer migration | ☐ **NOT STARTED** |
| CODE_COMPLETE (T-003-604) | ☐ **NOT STARTED** |

**Current:** `APPROVED` · Phase 3 **COMPLETE** · Phase 4 **NOT STARTED**
