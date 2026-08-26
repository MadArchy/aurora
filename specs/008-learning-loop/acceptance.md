# Acceptance 008 — Learning Loop

**Phase 0:** Formal package **COMPLETE** · Human SPEC approval **APPROVED** (T-008-010)  
**Phase 1:** Domain **COMPLETE** (T-008-101…110)  
**Phase 2:** Application + Ports **COMPLETE** (T-008-201…211)  
**Phase 3:** Persistence **COMPLETE** (T-008-301…308)  
**Phase 4:** Consumer / legacy migration **COMPLETE** (T-008-401…407)  
**Phase 5:** Security / adversarial hardening **COMPLETE** (T-008-501…510) — **26/26 threats PASS**  
**Phase 6:** **NOT STARTED**  
**SPEC-008 IMPLEMENTATION:** Phase 5 Security **COMPLETE**  
**CODE_COMPLETE:** **NO**  
**DEPLOYED:** **NO** · **DONE:** **NO** · **DEPLOYMENT:** **NOT_STARTED**

Spec **APPROVED** requires T-008-010 human SPEC approval — **SATISFIED** (2026-08-26 America/Bogota).  
Spec **CODE_COMPLETE** requires Required (A\*) full PASS + human sign-off (T-008-604) — **NOT STARTED**.

**Human SPEC approval model:** TASK-LEVEL only (T-008-010).  
**Human CODE_COMPLETE model:** TASK-LEVEL only (T-008-604).  
**Implementation baseline:** SPEC-007 CODE_COMPLETE @ `5d084ea9274909fb3f1d1eb2f51a084ec3a1f4c0`  
**Branch:** `spec/008-learning-loop`  
**Phase-1 checkpoint:** `de4d7def9fdc386e1f1c962b8439b4a03658d506`

### Human SPEC approval (T-008-010) — RECORDED

| Field | Value |
|-------|--------|
| **Task** | T-008-010 |
| **Status** | **DONE** |
| **Date** | 2026-08-26 |
| **Timezone** | America/Bogota |
| **Authorization text** | «Apruebo formalmente SPEC-008 — Learning Loop y autorizo el cierre de T-008-010 y el inicio de la Phase 1 de implementación.» |

---

## Required (implementation → CODE_COMPLETE)

| # | Criterion | Phase | Status | Evidence target |
|---|-----------|-------|--------|-----------------|
| A1 | Constitutional flow RESULTS→LEARNING→STRATEGIC RECOMMENDATION documented | 0 | ✅ PASS (Phase 0) | `spec.md` + circuit refs |
| A2 | Stage A Learning/Observation distinct from Stage B Recommendation | 0–1 | ✅ PASS | `spec.md` + Domain |
| A3 | `LearningObservation` canonical aggregate with append/supersession | 1 | ✅ PASS | `learningObservationCore.ts` |
| A4 | `LearningEvidence` + `LearningAssessment` explainable projections | 1 | ✅ PASS | `learningEvidenceCore.ts` |
| A5 | `StrategicRecommendation` first-class versioned aggregate | 1 | ✅ PASS | `strategicRecommendationCore.ts` |
| A6 | RAW RESULT ≠ LEARNING ≠ RECOMMENDATION ≠ APPROVED CHANGE | 0–1 | ✅ PASS | spec + `learningAuthorityCore.ts` |
| A7 | Learning does not auto-mutate thesis/weights/voice/audience/objective | 1–4 | ✅ PASS | Phase 5 T-008-507/508: 0 hint call sites · 0 rescore sites · apply port-only |
| A8 | Recommendation ≠ approval — lifecycle enforces human gate | 1–2 | ✅ PASS | Phase 5 T-008-503: software approve denied · PROPOSED→APPROVED denied |
| A9 | AI advisory only — cannot approve or apply | 1–5 | ✅ PASS | Phase 5 T-008-503: AI actor kind zero authority · 0 provider calls |
| A10 | UI intent/display only — zero authoritative learning writes | 4–5 | ✅ PASS | Phase 5 T-008-510: 0 UI repo imports · consumer 0 direct store writes |
| A11 | Trusted actor wins over caller `actorUid`/`createdBy` spoof | 2–5 | ✅ PASS | Phase 5 T-008-503: persisted `actorUid`/`approvedBy` = trusted actor |
| A12 | No hard-coded actor fallbacks (`user_admin_01`, `"client"`) | 4–5 | ⏳ PARTIAL | Canonical learning runtime = 0 (Phase 5 T-008-510) · 13 non-learning `main.ts` fallbacks remain out of SPEC-008 scope |
| A13 | Tenant isolation `(organizationId, clientId, entityId)` | 1–5 | ✅ PASS | Phase 5 T-008-502: tenant spoof denied · same-ID isolated |
| A14 | No id-only `getSignalOutcome(signalId)` authority | 4 | ✅ PASS | Phase 5 T-008-502: repository `getById` requires tenant scope |
| A15 | No unscoped authoritative list reads | 3–4 | ✅ PASS | Phase 5 T-008-502: `list()` tenant-scoped · foreign list = `[]` |
| A16 | Multi-thesis explicit scope — no `[0]`/primary/winner | 1–5 | ✅ PASS | `learningThesisScopeCore.ts` + Phase 5 T-008-510 |
| A17 | Append-only material observations — no silent replace | 1–4 | ✅ PASS | Phase 5 T-008-505: supersession retains prior · overwrite FAIL_CLOSED |
| A18 | History audit-only — not current strategic authority | 1–3 | ✅ PASS | Domain + persistence adapters + Phase 5 T-008-505 |
| A19 | RecommendationDecision append-only human audit | 1–3 | ✅ PASS | Phase 5 T-008-505: decisions `AUDIT_ONLY` · replay holds no authority |
| A20 | Schema version + fail-closed malformed parse | 3 | ✅ PASS | Phase 5 T-008-506: 7 malformed-persistence attacks FAIL_CLOSED |
| A21 | Idempotency on register/propose/approve/apply | 2–3 | ✅ PASS | Phase 5 T-008-506: replay · collision · cross-tenant governed |
| A22 | ApplyApprovedRecommendation dispatches to TargetSpecApplyPort only | 2 | ✅ PASS | Phase 5 T-008-504: single `port.apply(` dispatch site |
| A23 | SPEC-008 does not write SPEC-002 storage directly | 1–5 | ✅ PASS | Phase 5 T-008-509: 0 SPEC-002 store imports or mutators |
| A24 | **P0:** feedbackScoringHints removed from scoring authority path | 4 | ✅ PASS | main.ts + DbStrategicSignalRoutingAdapter |
| A25 | **P0:** post-outcome mass rescore removed | 4 | ✅ PASS | main.ts outcome handler |
| A26 | Approved SPEC-002 changes only via future SPEC-002 apply port | 2–4 | ✅ PASS | Phase 5 T-008-504: no route to SPEC-002 exists other than the apply port |
| A27 | Legacy `dbService` outcome/result mutators demoted | 4 | ✅ PASS | mirror-only + LEGACY_AUTHORITY_REMOVED (re-verified against real `dbService`) |
| A28 | SPEC-001 boundary — no routing authority from learning | 4–5 | ✅ PASS | Phase 5 T-008-509: 0 routing mutators · no SPEC-001 port registered |
| A29 | SPEC-007 Opportunity outcomes ingested read-only | 2–4 | ✅ PASS | Phase 5 T-008-509: 7 ingest attacks · Opportunity byte-identical after ingest |
| A30 | Materiality/version — post-approval change requires supersession | 1–2 | ✅ PASS | `learningMaterialityCore.ts` + Phase 5 T-008-506 |
| A31 | LOCAL_AUTHORITATIVE persistence Phase 3 | 3–4 | ✅ PASS | Phase 5 T-008-506: store authoritative · rollback verified |
| A32 | Legacy key compat readers during migration | 3–4 | ✅ PASS | Phase 5 T-008-507: forged legacy rows stay COMPATIBILITY_ONLY |
| A33 | Explainability — source ids, metrics, reason codes; no CoT | 1–2 | ✅ PASS | `learningExplainabilityCore.ts` |
| A34 | Opportunity accept/decline/complete as learning input | 4 | ✅ PASS | opportunityScoutConsumer ingest |
| A35 | `APPROVED_NOT_APPLIED` when target port unavailable | 1–2 | ✅ PASS | Phase 5 T-008-504: verified at runtime for unsupported + rejected targets |
| A36 | feedbackScoringHints may exist DISPLAY_ONLY at most | 4 | ✅ PASS | Phase 5 T-008-507: **DEAD** definition + TEST_ONLY · 0 src call sites |
| A37 | Threat model T-008-01…26 PASS | 5 | ✅ PASS | Phase 5: **26/26** formal threats PASS with individual evidence |
| A38 | Full check + rules regression at CODE_COMPLETE | 6 | ⏳ PENDING | T-008-602 (Phase 6) |

**Acceptance count:** **38** (A1–A38)  
**Phase 5 evidence:** **36 PASS** · **1 PARTIAL** (A12) · **0 FAIL** · **1 PENDING** (A38)

**Governance correction:** the previous Phase-4 header read *16 PASS / 18 PARTIAL /
4 PENDING*, which did not reconcile with its own table. The Phase-4 table actually
held **15 PASS / 21 PARTIAL / 2 PENDING** (= 38). Phase 5 converted 21 PARTIAL and
1 PENDING to PASS on fresh adversarial evidence, giving 36 / 1 / 0 / 1.

**A12 remains PARTIAL by evidence:** the canonical Learning Loop runtime has **zero**
authoritative actor fallbacks, but `src/main.ts` still contains 13 `user_admin_01`
occurrences on **non-learning** paths owned by other SPECs. Closing A12 would require
work outside the SPEC-008 Phase-5 file scope, so it is not claimed.

---

## P0 acceptance (AUDIT008-03)

| Field | Value |
|-------|--------|
| **Runtime status** | `RESOLVED` (Phase 4 T-008-405/406 · re-verified adversarially Phase 5 T-008-507/508) |
| **Design status** | `RESOLVED` |
| **Blocking acceptance** | A24, A25 **PASS** |
| **P0** | **0** · **P1** | **0** |
| **feedbackScoringHints strategic authority** | **0** (DEAD definition · 0 src call sites) |
| **Learning-triggered auto-rescore authority** | **0** |

---

## Deployment separation (D1–D3)

| # | Criterion | Status |
|---|-----------|--------|
| D-A1 | CODE_COMPLETE does not require production deploy | ✅ PASS (design) |
| D-A2 | SPEC-009 production rules unchanged until authorized | ✅ PASS (design) |
| D-A3 | Firestore learning backfill separate from Phases 1–6 | ✅ PASS (design) |

---

## Phase 0 exit checklist

| Gate | Status |
|------|--------|
| Formal package complete | ✅ |
| Constitutional purpose exact | ✅ |
| Human approval gate formalized | ✅ |
| P0 design remediation explicit | ✅ |
| Cross-SPEC boundaries explicit | ✅ |
| feedbackScoringHints migration explicit | ✅ |
| Tasks + acceptance + threats complete | ✅ |
| Human T-008-010 | **DONE** |
| Phase-1 authorization | **YES** |
| Product implementation changes | **Phase 4 consumer** |

**PHASE-0 DESIGN BLOCKERS:** **0**

---

## Human CODE_COMPLETE (T-008-604) — FUTURE

| Field | Value |
|-------|--------|
| **Task** | T-008-604 |
| **Status** | **TODO** |
| **Authorization text** | «Apruebo formalmente el CODE_COMPLETE de SPEC-008 — Learning Loop y autorizo el cierre de T-008-604.» |

Required (A\*) criteria must be **PASS** before T-008-604 may close.
