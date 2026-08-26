# Acceptance 008 — Learning Loop

**Phase 0:** Formal package **COMPLETE** · Human SPEC approval **PENDING** (T-008-010)  
**Phase 1–6:** **NOT STARTED**  
**SPEC-008 IMPLEMENTATION:** **NOT_STARTED**  
**CODE_COMPLETE:** **NO**  
**DEPLOYED:** **NO** · **DONE:** **NO** · **DEPLOYMENT:** **NOT_STARTED**

Spec **APPROVED** requires T-008-010 human SPEC approval — **NOT SATISFIED**.  
Spec **CODE_COMPLETE** requires Required (A\*) full PASS + human sign-off (T-008-604) — **NOT STARTED**.

**Human SPEC approval model:** TASK-LEVEL only (T-008-010).  
**Human CODE_COMPLETE model:** TASK-LEVEL only (T-008-604).  
**Implementation baseline:** SPEC-007 CODE_COMPLETE @ `5d084ea9274909fb3f1d1eb2f51a084ec3a1f4c0`  
**Branch:** `spec/008-learning-loop`

### Human SPEC approval (T-008-010) — REQUIRED

| Field | Value |
|-------|--------|
| **Task** | T-008-010 |
| **Status** | **PENDING** |
| **Authorization text** | «Apruebo formalmente SPEC-008 — Learning Loop y autorizo el cierre de T-008-010 y el inicio de la Phase 1 de implementación.» |

---

## Required (implementation → CODE_COMPLETE)

| # | Criterion | Phase | Status | Evidence target |
|---|-----------|-------|--------|-----------------|
| A1 | Constitutional flow RESULTS→LEARNING→STRATEGIC RECOMMENDATION documented | 0 | ✅ PASS (Phase 0) | `spec.md` + circuit refs |
| A2 | Stage A Learning/Observation distinct from Stage B Recommendation | 0–1 | ⏳ Phase 0 design PASS | `spec.md` + Domain |
| A3 | `LearningObservation` canonical aggregate with append/supersession | 1 | ⏳ TODO | Domain |
| A4 | `LearningEvidence` + `LearningAssessment` explainable projections | 1 | ⏳ TODO | Domain |
| A5 | `StrategicRecommendation` first-class versioned aggregate | 1 | ⏳ TODO | Domain |
| A6 | RAW RESULT ≠ LEARNING ≠ RECOMMENDATION ≠ APPROVED CHANGE | 0–1 | ⏳ Phase 0 design PASS | spec + Domain invariants |
| A7 | Learning does not auto-mutate thesis/weights/voice/audience/objective | 1–4 | ⏳ TODO | Domain + Phase 4 migration |
| A8 | Recommendation ≠ approval — lifecycle enforces human gate | 1–2 | ⏳ TODO | Domain + App |
| A9 | AI advisory only — cannot approve or apply | 2–5 | ⏳ TODO | App + Phase 5 |
| A10 | UI intent/display only — zero authoritative learning writes | 4–5 | ⏳ TODO | Consumer + Phase 5 |
| A11 | Trusted actor wins over caller `actorUid`/`createdBy` spoof | 2–5 | ⏳ TODO | App + Phase 5 |
| A12 | No hard-coded actor fallbacks (`user_admin_01`, `"client"`) | 4–5 | ⏳ TODO | Consumer + Phase 5 |
| A13 | Tenant isolation `(organizationId, clientId, entityId)` | 1–5 | ⏳ TODO | Domain + App + Infra |
| A14 | No id-only `getSignalOutcome(signalId)` authority | 4 | ⏳ TODO | Consumer migration |
| A15 | No unscoped authoritative list reads | 3–4 | ⏳ TODO | Infra + consumer |
| A16 | Multi-thesis explicit scope — no `[0]`/primary/winner | 1–5 | ⏳ TODO | Domain + tests |
| A17 | Append-only material observations — no silent replace | 1–4 | ⏳ TODO | Domain + Phase 4 |
| A18 | History audit-only — not current strategic authority | 1–3 | ⏳ TODO | Domain + history port |
| A19 | RecommendationDecision append-only human audit | 2–3 | ⏳ TODO | App + Infra |
| A20 | Schema version + fail-closed malformed parse | 3 | ⏳ TODO | Infra tests |
| A21 | Idempotency on register/propose/approve/apply | 2–3 | ⏳ TODO | App + Infra |
| A22 | ApplyApprovedRecommendation dispatches to TargetSpecApplyPort only | 2 | ⏳ TODO | App |
| A23 | SPEC-008 does not write SPEC-002 storage directly | 2–5 | ⏳ TODO | Arch tests |
| A24 | **P0:** feedbackScoringHints removed from scoring authority path | 4 | ⏳ TODO | Phase 4 T-008-405 |
| A25 | **P0:** post-outcome mass rescore removed | 4 | ⏳ TODO | Phase 4 T-008-406 |
| A26 | Approved SPEC-002 changes only via future SPEC-002 apply port | 2–4 | ⏳ TODO | Apply port + tests |
| A27 | Legacy `dbService` outcome/result mutators demoted | 4 | ⏳ TODO | Consumer |
| A28 | SPEC-001 boundary — no routing authority from learning | 4–5 | ⏳ TODO | Migration + T-008-509 |
| A29 | SPEC-007 Opportunity outcomes ingested read-only | 4 | ⏳ TODO | T-008-407 |
| A30 | Materiality/version — post-approval change requires supersession | 1–2 | ⏳ TODO | Domain |
| A31 | LOCAL_AUTHORITATIVE persistence Phase 3 | 3 | ⏳ TODO | Infra |
| A32 | Legacy key compat readers during migration | 3–4 | ⏳ TODO | Infra |
| A33 | Explainability — source ids, metrics, reason codes; no CoT | 1–2 | ⏳ TODO | Domain projections |
| A34 | Opportunity accept/decline/complete as learning input | 4 | ⏳ TODO | Consumer ingest |
| A35 | `APPROVED_NOT_APPLIED` when target port unavailable | 2 | ⏳ TODO | App lifecycle |
| A36 | feedbackScoringHints may exist DISPLAY_ONLY at most | 4 | ⏳ TODO | Migration matrix |
| A37 | Threat model T-008-01…18 PASS | 5 | ⏳ TODO | Phase 5 suite |
| A38 | Full check + rules regression at CODE_COMPLETE | 6 | ⏳ TODO | T-008-602 |

**Acceptance count:** **38** (A1–A38)  
**Phase 0 formalized:** **38/38** criteria defined · **2/38** PASS at Phase 0 (A1, A6 design-only partial) · implementation evidence **PENDING**

---

## Deployment separation (D1–D3)

| # | Criterion | Status |
|---|-----------|--------|
| D-A1 | CODE_COMPLETE does not require production deploy | ✅ PASS (design) |
| D-A2 | SPEC-009 production rules unchanged until authorized | ✅ PASS (design) |
| D-A3 | Firestore learning backfill separate from Phases 1–6 | ✅ PASS (design) |

---

## P0 acceptance (AUDIT008-03)

| Field | Value |
|-------|--------|
| **Runtime status** | `OPEN_P0_IMPLEMENTATION_REQUIRED` until A24+A25 PASS |
| **Design status** | `RESOLVED_IMPLEMENTATION_PENDING` — Phase 0 package |
| **Blocking acceptance** | A24, A25 required for CODE_COMPLETE |

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
| Human T-008-010 | **PENDING** |
| Phase-1 authorization | **NO** |
| Product implementation changes | **0** |

**PHASE-0 DESIGN BLOCKERS:** **0**

---

## Human CODE_COMPLETE (T-008-604) — FUTURE

| Field | Value |
|-------|--------|
| **Task** | T-008-604 |
| **Status** | **TODO** |
| **Authorization text** | «Apruebo formalmente el CODE_COMPLETE de SPEC-008 — Learning Loop y autorizo el cierre de T-008-604.» |

Required (A\*) criteria must be **PASS** before T-008-604 may close.
