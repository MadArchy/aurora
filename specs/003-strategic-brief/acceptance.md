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
| A1 | StrategicBrief canonical entity satisfies constitutional required fields | `brief-model.md` §12 | ☐ Phase 1 |
| A2 | One authoritative Strategic Decision contract (StrategicDecisionSnapshot in Brief) | Design A | ☐ Phase 1 |
| A3 | Brief consumes SPEC-001 routing without mutating it | Context reader | ☐ Phase 2 |
| A4 | Brief consumes SPEC-002 scoring without recomputing it | Context reader | ☐ Phase 2 |
| A5 | CLEAR uses explicit governed thesis (`selectedThesisId`) | Routing gate | ☐ Phase 1–2 |
| A6 | CONTESTED cannot authorize downstream action | Fail-closed | ☐ Phase 2 |
| A7 | UNROUTED cannot authorize downstream action | Fail-closed | ☐ Phase 2 |
| A8 | No primary/first thesis fallback | Architecture ban | ☐ Phase 5 |
| A9 | Multi-signal Brief requires tenant-safe compatible thesis context | Multi-signal validator | ☐ Phase 1–2 |
| A10 | No strategic downstream artifact without approved Brief authorization | Downstream gate | ☐ Phase 4 |
| A11 | CurationEntry is not strategic authority | Migration | ☐ Phase 4 |
| A12 | DeliveryPackage is not StrategicBrief authority | Migration | ☐ Phase 4 |
| A13 | AI remains advisory only | SPEC-005 boundary | ☐ Phase 5 |
| A14 | AI structured output remains SPEC-005 validated | Gateway schemas | ☐ Phase 5 |
| A15 | Evidence linkage preserved (`signalIds`, `supportingEvidenceIds`) | Brief model | ☐ Phase 1–3 |
| A16 | SPEC-006 remains claim-verification authority | Boundary test | ☐ Phase 5 |
| A17 | Decision/Brief explainability reconstructable | History + snapshot | ☐ Phase 3 |
| A18 | Human approval required for actionable Brief | Approve use case | ☐ Phase 2 |
| A19 | Override auditable or bypass formally prohibited | Override contract | ☐ Phase 2–3 |
| A20 | Tenant mismatch / cross-client references rejected | Tenant gate | ☐ Phase 2–3 |
| A21 | Version/revision semantics implemented | `version` integer | ☐ Phase 1–3 |
| A22 | Material history append-only | History store | ☐ Phase 3 |
| A23 | Equivalent operation idempotent / no uncontrolled duplication | Idempotency | ☐ Phase 3–4 |
| A24 | Approved Brief material changes cannot silently overwrite authority | Supersede | ☐ Phase 3 |
| A25 | Domain framework-pure | Architecture test | ☐ Phase 5 |
| A26 | Application depends on ports, not infrastructure | Hexagonal test | ☐ Phase 5 |
| A27 | Direct UI Brief-authority writes prohibited | Architecture ban | ☐ Phase 5 |
| A28 | Legacy direct strategic content paths migrated or blocked | Phase 4 matrix | ☐ Phase 4 |
| A29 | Strategic downstream artifacts carry Brief authorization reference | `strategicBriefId` | ☐ Phase 4 |
| A30 | No silent learning / automatic strategic mutation | Governance | ☐ Phase 5 |
| A31 | SPEC-001 regression PASS | Test suite | ☐ Phase 6 |
| A32 | SPEC-002 regression PASS | Test suite | ☐ Phase 6 |
| A33 | SPEC-005 regression PASS | Test suite | ☐ Phase 6 |
| A34 | SPEC-006 regression PASS | Test suite | ☐ Phase 6 |
| A35 | `npm run check` PASS | Governance | ☐ Phase 6 |
| A36 | `npm run test:rules` PASS | Governance | ☐ Phase 6 |

**Implementation acceptance:** **0/36** (Phase 0B — criteria only)  
**CODE_COMPLETE:** **NO** — awaiting implementation + human sign-off

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

**P1 resolved:** 0

---

## Sign-off tracking

| Milestone | Status |
|-----------|--------|
| Phase 0B package | ✅ COMPLETE (2026-08-24) |
| T-003-010 Human SPEC approval | ✅ **APPROVED** (2026-08-24) |
| Phase 1 authorization | ✅ **AUTHORIZED** · implementation **NOT STARTED** |
| CODE_COMPLETE (T-003-604) | ☐ **NOT STARTED** |

**Current:** `APPROVED` · Phase 1 **AUTHORIZED** · Implementation **NOT STARTED**
