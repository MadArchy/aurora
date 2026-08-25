# Acceptance 006 — Evidence Claim Linking

**Phase 0:** Formal package **COMPLETE** · Human SPEC approval **APPROVED** (T-006-010)  
**SPEC-006 FORMAL SPEC:** **APPROVED**  
**SPEC-006 IMPLEMENTATION:** **PHASE_1_AUTHORIZED** · CODE_COMPLETE **NO**  
**CODE_COMPLETE CANDIDATE:** **NO**  
**DEPLOYED:** **NO** · **DONE:** **NO** · **DEPLOYMENT:** **NOT_STARTED**

Spec **APPROVED** requires T-006-010 human SPEC approval — **SATISFIED**.  
Spec **CODE_COMPLETE** requires Required (A\*) full PASS + human sign-off (T-006-604) — **NOT STARTED**.  
Spec **DONE** requires CODE_COMPLETE + agreed deploy verification — **NOT STARTED**.

**Implementation baseline:** SPEC-003 CODE_COMPLETE @ `e16280607fa078941078d2cb4c233025a1bd66a1`  
**Phase-0 governance checkpoint:** `d8fe981c1fc15f47fc7fdf6ef7ef0fae211a6fe5`

### Human SPEC approval (T-006-010)

| Field | Value |
|-------|--------|
| **Task** | T-006-010 |
| **Status** | **DONE** |
| **Date** | **2026-08-24** (America/Bogota) |
| **Authorization text** | «Apruebo formalmente SPEC-006 — Evidence Claim Linking y autorizo el cierre de T-006-010 y el inicio de la Phase 1 de implementación.» |

---

## Required (implementation → CODE_COMPLETE candidate)

Status column remains **PENDING** until evidence is produced in later phases. Do **not** mark PASS in Phase 0.

| # | Criterion | Phase | Status | Evidence target |
|---|-----------|-------|--------|-----------------|
| A1 | Canonical Claim model exists (aggregate, tenant, content link, text, kind, status) | 1 | ☐ PENDING | `claim-model.md` + Domain types |
| A2 | Canonical Evidence model (adapt vault; tenant; Source linkage) | 1 | ☐ PENDING | Domain Evidence |
| A3 | Canonical Verification model (actor, rule, result, timestamp, version) | 1 | ☐ PENDING | Domain Verification |
| A4 | Canonical Source model (provenance metadata; no news-platform redesign) | 1 | ☐ PENDING | Domain Source |
| A5 | Claim→Evidence→Verification→Source reconstructable | 1–3 | ☐ PENDING | History + explainability tests |
| A6 | Claim lifecycle includes `EVIDENCE_REQUIRED` | 1 | ☐ PENDING | State machine tests |
| A7 | `RESEARCH_REQUIRED` distinct where constitution applies | 1 | ☐ PENDING | State machine tests |
| A8 | Tenant isolation: foreign evidence cannot verify local claim | 1–5 | ☐ PENDING | Cross-tenant matrix |
| A9 | Foreign claim/verification cannot authorize local publication | 2–5 | ☐ PENDING | Gate + security tests |
| A10 | Evidence provenance required for verification | 1–3 | ☐ PENDING | Link without Source/Evidence deny |
| A11 | Verification authority: software/human only; AI advisory | 2–5 | ☐ PENDING | AI authority ban |
| A12 | AI cannot self-approve / set Verification | 2–5 | ☐ PENDING | Phase 5 |
| A13 | SPEC-003 boundary: no Brief approve/reject/mutate | 2–5 | ☐ PENDING | Architecture bans |
| A14 | SPEC-003 refs consumable (`strategicBriefId`/version/evidenceIds) | 4 | ☐ PENDING | Consumer carry |
| A15 | Brief `supportingEvidenceIds` are **not** verification authority | 1–5 | ☐ PENDING | Explicit deny tests |
| A16 | SPEC-005 boundary: advisory only; no new unauthorized AiOperation | 2–5 | ☐ PENDING | Gateway regression |
| A17 | SPEC-009 auth claims unchanged / OTHER_SPEC | 5–6 | ☐ PENDING | `posturaClaimsCore` + `firebaseClaims` |
| A18 | Publication gate blocks CLIENT_REVIEW/READY/PUBLISHED on EVIDENCE_REQUIRED | 2–4 | ☐ PENDING | Gate tests |
| A19 | HARD_BLOCKED / hard thesis limits non-overridable | 1–5 | ☐ PENDING | Override deny |
| A20 | Human override auditable when permitted | 2–5 | ☐ PENDING | Override audit store |
| A21 | No direct UI authorization from displayed status alone | 4–5 | ☐ PENDING | Architecture / consumer tests |
| A22 | Material history append-only for verification/link/override | 3–5 | ☐ PENDING | History tests |
| A23 | Idempotency for register/verify where applicable | 2–5 | ☐ PENDING | Idempotency tests |
| A24 | Evidence reuse allowed within same tenant only | 1–5 | ☐ PENDING | Reuse + tenant tests |
| A25 | Explainability: claim/evidence/source/verifier/rule/result/override/version | 1–3 | ☐ PENDING | Reconstruction tests |
| A26 | Domain framework-pure | 1–5 | ☐ PENDING | Architecture tests |
| A27 | Application depends on ports not infrastructure | 2–5 | ☐ PENDING | Hexagonal tests |
| A28 | Legacy claimSafety demoted from authority (COMPATIBILITY or DEPRECATED) | 4 | ☐ PENDING | Migration matrix exit |
| A29 | Legacy claimSafetyCore + gate suites green or formally superseded | 4–6 | ☐ PENDING | 23 tests or successor |
| A30 | Content draft save allowed with unresolved claims | 4 | ☐ PENDING | Gate policy tests |
| A31 | Stale contentHash / body change invalidates prior verification projection | 2–5 | ☐ PENDING | Hash tests |
| A32 | Cross-SPEC: SPEC-001 regression PASS | 6 | ☐ PENDING | Routing suites |
| A33 | Cross-SPEC: SPEC-002 regression PASS | 6 | ☐ PENDING | Scoring suites |
| A34 | Cross-SPEC: SPEC-003 regression PASS | 6 | ☐ PENDING | Brief suites |
| A35 | Cross-SPEC: SPEC-005 regression PASS | 6 | ☐ PENDING | Gateway suites |
| A36 | Terminology: SPEC-006 Claim ≠ SPEC-009 auth claims | 1–5 | ☐ PENDING | Doc + test naming bans |
| A37 | LOCAL_AUTHORITATIVE documented; remote rules not required for CODE_COMPLETE | 3–6 | ☐ PENDING | plan.md / tasks.md |
| A38 | Dedicated SPEC-006 architecture/security suites exist | 5 | ☐ PENDING | New test files |
| A39 | `npm run check` PASS | 6 | ☐ PENDING | Full suite |
| A40 | `npm run test:rules` PASS | 6 | ☐ PENDING | Rules suite |

**Implementation acceptance A1–A40:** **0/40 PASS** (Phase 1 Domain will advance A1–A8, A10–A11, A18–A19, A24–A26, A36 partially)  
**CODE_COMPLETE CANDIDATE:** **NO**  
**HUMAN SPEC APPROVAL (T-006-010):** **DONE** — **APPROVED** 2026-08-24 (America/Bogota)  
**HUMAN CODE_COMPLETE (T-006-604):** **NOT STARTED**

---

## Deploy gates (separate — NOT STARTED)

| # | Criterion | Status |
|---|-----------|--------|
| D1 | Remote Claim/Evidence/Verification persistence + rules plan with SPEC-009 | ☐ PENDING |
| D2 | Production deploy authorized and executed | ☐ PENDING |
| D3 | Post-deploy verification | ☐ PENDING |

**SPEC-009 PRODUCTION = DEFERRED_UNCHANGED**

---

## Phase 0 verification record

| Suite | Result |
|-------|--------|
| Legacy `claimSafetyCore` | **17/17 PASS** (baseline; unchanged) |
| Legacy `claimSafetyGateCore` | **6/6 PASS** (baseline; unchanged) |
| Legacy claim-adjacent total | **23/23 PASS** |
| SPEC-009 auth claims (`posturaClaimsCore`, `firebaseClaims`) | OTHER_SPEC — included in full check; **not** SPEC-006 |
| `npm run check` | **844/844 PASS** (Phase 0 baseline) |
| `npm run test:rules` | **91/91 PASS** (Phase 0 baseline) |
| Product code changes | **NONE** |
| Test behavior changes | **NONE** |

---

## Sign-off tracking

| Milestone | Status |
|-----------|--------|
| Phase 0 package | ✅ COMPLETE |
| T-006-010 Human SPEC approval | ✅ **DONE** — **APPROVED** 2026-08-24 (America/Bogota) |
| Phase 1 Domain (T-006-101…110) | ☐ **AUTHORIZED** — in progress after approval checkpoint |
| Phase 2–5 implementation | ☐ NOT AUTHORIZED |
| Phase 6 T-006-604 Human CODE_COMPLETE | ☐ NOT STARTED |
| DEPLOYED / DONE | ☐ **NO** |

**Current:** **APPROVED** · **HUMAN_SPEC_APPROVAL = DONE** · **PHASE_1 = AUTHORIZED** · **CODE_COMPLETE = NO** · **DEPLOYED = NO** · **DONE = NO**

**Next allowed state:** Phase 1 Domain implementation (T-006-101…T-006-110). Do not begin Phase 2 without separate authorization.
