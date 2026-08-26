# Acceptance 006 — Evidence Claim Linking

**Phase 0:** Formal package **COMPLETE** · Human SPEC approval **APPROVED** (T-006-010)  
**SPEC-006 FORMAL SPEC:** **APPROVED**  
**SPEC-006 IMPLEMENTATION:** **CODE_COMPLETE**  
**CODE_COMPLETE:** **YES**  
**CODE_COMPLETE CANDIDATE:** **YES** (satisfied; superseded by CODE_COMPLETE)  
**HUMAN CODE_COMPLETE SIGN-OFF:** **APPROVED** (T-006-604)  
**DEPLOYED:** **NO** · **DONE:** **NO** · **DEPLOYMENT:** **NOT_STARTED**  
**SPEC-006 FREEZE:** **ACTIVE**

Spec **APPROVED** requires T-006-010 human SPEC approval — **SATISFIED**.  
Spec **CODE_COMPLETE** requires Required (A\*) full PASS + human sign-off (T-006-604) — **SATISFIED**.  
Spec **DONE** requires CODE_COMPLETE + agreed deploy verification — **NOT STARTED**.

**Implementation baseline:** SPEC-003 CODE_COMPLETE @ `e16280607fa078941078d2cb4c233025a1bd66a1`  
**Phase-0 governance checkpoint:** `d8fe981c1fc15f47fc7fdf6ef7ef0fae211a6fe5`  
**Human SPEC approval checkpoint:** `1bc620b01e83410d2f5daea4f9ba35ecf6fd398d`  
**Phase-1 frozen checkpoint:** `fe1fbc9225919a445eff9463492176356ab0a8f7`  
**Phase-2 frozen checkpoint:** `55bdb03206a9e986898413828c2343bf2afa25af`  
**Phase-3 frozen checkpoint:** `59880e52b115eea35d858f41a325ee0248922eef`  
**Phase-4 frozen checkpoint:** `30d4fc51f9693f21371554e3b8d0d1121eec4b35`  
**Phase-5 frozen checkpoint:** `da7beea02f0533686e31db4a4ed77d878fd489e3`  
**Phase-5 security work:** `3735678c9c627e964e66d59c18eeaf3a4a9c8cde`  
**Phase-6 acceptance evidence checkpoint:** `67cceb0120aea87e9859da705203332290569c19`

### Human SPEC approval (T-006-010)

| Field | Value |
|-------|--------|
| **Task** | T-006-010 |
| **Status** | **DONE** |
| **Date** | **2026-08-24** (America/Bogota) |
| **Authorization text** | «Apruebo formalmente SPEC-006 — Evidence Claim Linking y autorizo el cierre de T-006-010 y el inicio de la Phase 1 de implementación.» |

### Human CODE_COMPLETE approval (T-006-604)

| Field | Value |
|-------|--------|
| **Task** | T-006-604 |
| **Status** | **DONE** |
| **Date** | **2026-08-25** (America/Bogota) |
| **Authorization text** | «Apruebo SPEC-006 — Evidence Claim Linking como CODE_COMPLETE y autorizo el cierre de T-006-604.» |

---

## Required (implementation → CODE_COMPLETE)

| # | Criterion | Phase | Status | Evidence |
|---|-----------|-------|--------|----------|
| A1 | Canonical Claim model exists (aggregate, tenant, content link, text, kind, status) | 1 | ✅ **PASS** | `claimCore.ts` + `claimEvidenceDomain.test.ts` |
| A2 | Canonical Evidence model (adapt vault; tenant; Source linkage) | 1 | ✅ **PASS** | `evidenceCore.ts` + domain tests |
| A3 | Canonical Verification model (actor, rule, result, timestamp, version) | 1 | ✅ **PASS** | `claimVerificationCore.ts` |
| A4 | Canonical Source model (provenance metadata; no news-platform redesign) | 1 | ✅ **PASS** | `claimSourceCore.ts` |
| A5 | Claim→Evidence→Verification→Source reconstructable | 1–3 | ✅ **PASS** | Domain + local stores + vault adapter |
| A6 | Claim lifecycle includes `EVIDENCE_REQUIRED` | 1 | ✅ **PASS** | State machine tests |
| A7 | `RESEARCH_REQUIRED` distinct where constitution applies | 1 | ✅ **PASS** | State machine tests |
| A8 | Tenant isolation: foreign evidence cannot verify local claim | 1–5 | ✅ **PASS** | Domain + Application + Phase-3/5 isolation |
| A9 | Foreign claim/verification cannot authorize local publication | 2–5 | ✅ **PASS** | Tenant-scoped repo + AuthorizePublication |
| A10 | Evidence provenance required for verification | 1–3 | ✅ **PASS** | Source required; vault map fail-closed |
| A11 | Verification authority: software/human only; AI advisory | 2–5 | ✅ **PASS** | Application invocation + AI deny |
| A12 | AI cannot self-approve / set Verification | 2–5 | ✅ **PASS** | `AI_VERIFICATION_FORBIDDEN` |
| A13 | SPEC-003 boundary: no Brief approve/reject/mutate | 2–5 | ✅ **PASS** | Architecture import bans + Brief suites |
| A14 | SPEC-003 refs consumable (`strategicBriefId`/version/evidenceIds) | 4 | ✅ **PASS** | saveContentWithClaimGate preserves Brief refs |
| A15 | Brief `supportingEvidenceIds` are **not** verification authority | 1–5 | ✅ **PASS** | RegisterClaim never auto-verifies |
| A16 | SPEC-005 boundary: advisory only; no new unauthorized AiOperation | 2–5 | ✅ **PASS** | Extractor port only; RUNTIME DEFERRED_NONBLOCKING |
| A17 | SPEC-009 auth claims unchanged / OTHER_SPEC | 5–6 | ✅ **PASS** | Import bans + `posturaClaimsCore`/`firebaseClaims` + rules |
| A18 | Publication gate blocks CLIENT_REVIEW/READY/PUBLISHED on EVIDENCE_REQUIRED | 2–4 | ✅ **PASS** | main + AuthorizePublication strangler |
| A19 | HARD_BLOCKED / hard thesis limits non-overridable | 1–5 | ✅ **PASS** | Override deny + Phase-5 HARD_BLOCK attacks |
| A20 | Human override auditable when permitted | 2–5 | ✅ **PASS** | Override audit + append-only store |
| A21 | No direct UI authorization from displayed status alone | 4–5 | ✅ **PASS** | Panel display-only; Phase-5 architecture |
| A22 | Material history append-only for verification/link/override | 3–5 | ✅ **PASS** | Phase-3 history tests |
| A23 | Idempotency for register/verify where applicable | 2–5 | ✅ **PASS** | Register/Link/Verify + reload |
| A24 | Evidence reuse allowed within same tenant only | 1–5 | ✅ **PASS** | Reuse + tenant tests |
| A25 | Explainability: claim/evidence/source/verifier/rule/result/override/version | 1–3 | ✅ **PASS** | AuthorizePublication explainability |
| A26 | Domain framework-pure | 1–5 | ✅ **PASS** | Architecture tests |
| A27 | Application depends on ports not infrastructure | 2–5 | ✅ **PASS** | Hexagonal application tests |
| A28 | Legacy claimSafety demoted from authority (COMPATIBILITY or DEPRECATED) | 4 | ✅ **PASS** | claimSafetyGateCore requires canonical |
| A29 | Legacy claimSafetyCore + gate suites green or formally superseded | 4–6 | ✅ **PASS** | Core 17 + gate strangler suite green |
| A30 | Content draft save allowed with unresolved claims | 4 | ✅ **PASS** | Non-gated draft save; NO_CLAIMS Domain PASS |
| A31 | Stale contentHash / body change invalidates prior verification projection | 2–5 | ✅ **PASS** | AuthorizePublication + Phase-5 stale attacks |
| A32 | Cross-SPEC: SPEC-001 regression PASS | 6 | ✅ **PASS** | Routing suites **102/102 PASS** |
| A33 | Cross-SPEC: SPEC-002 regression PASS | 6 | ✅ **PASS** | Scoring suites **108/108 PASS** |
| A34 | Cross-SPEC: SPEC-003 regression PASS | 6 | ✅ **PASS** | Brief suites **162/162 PASS** (+ Phase-5 bans) |
| A35 | Cross-SPEC: SPEC-005 regression PASS | 6 | ✅ **PASS** | Gateway suites **201/201 PASS** (+ Phase-5 bans) |
| A36 | Terminology: SPEC-006 Claim ≠ SPEC-009 auth claims | 1–5 | ✅ **PASS** | Architecture bans vs posturaClaims |
| A37 | LOCAL_AUTHORITATIVE documented; remote rules not required for CODE_COMPLETE | 3–6 | ✅ **PASS** | Phase-3 stores + plan |
| A38 | Dedicated SPEC-006 architecture/security suites exist | 5 | ✅ **PASS** | Domain+App+Infra+Consumer+Security suites |
| A39 | `npm run check` PASS | 6 | ✅ **PASS** | **976/976 PASS** |
| A40 | `npm run test:rules` PASS | 6 | ✅ **PASS** | **91/91 PASS** |

**Implementation acceptance A1–A40:** **40 PASS** · **0 FAIL** · **0 PARTIAL**  
**CODE_COMPLETE:** **YES**  
**HUMAN SPEC APPROVAL (T-006-010):** **DONE** — **APPROVED** 2026-08-24 (America/Bogota)  
**HUMAN CODE_COMPLETE (T-006-604):** **DONE** — **APPROVED** 2026-08-25 (America/Bogota)

### Residual classification (nonblocking — preserved at CODE_COMPLETE)

| ID | Classification | Note |
|----|----------------|------|
| **P2-006-01** | **PARTIAL_NONBLOCKING** | Publication authority migrated; CLAIM-006-* legacy module ID/traceability map still open |
| **P2-006-02** | **RESOLVED** | Dedicated architecture/security suites |
| **P3-006-01** | **OPEN_NONBLOCKING** | Naming alias drift; no rename churn |
| Local tamper | **KNOWN_LIMITATION_NONBLOCKING** | Threat-model; SPEC-009 remote authority future |
| Runtime claim extractor | **DEFERRED_NONBLOCKING** | Port-only; A16 PASS; no new AiOperation |
| UI Register/Link/Verify buttons | **DEFERRED_NONBLOCKING** | Not required by A*; publication gate via composition/main; UI display-only (A21) |

**Authorities (preserved):** Claim verification = **SPEC-006** · Publication = **SPEC-006** · AI authoritative Verification = **DENIED** · Authority bypass = **0**  
Legacy `claimSafety` / `ContentItem.claimSafety` = **COMPATIBILITY_ONLY** · Evidence Vault verified flag = **not** verification authority.

---

## Deploy gates (separate — NOT STARTED)

| # | Criterion | Status |
|---|-----------|--------|
| D1 | Remote Claim/Evidence/Verification persistence + rules plan with SPEC-009 | ☐ PENDING / **NOT_STARTED** |
| D2 | Production deploy authorized and executed | ☐ PENDING / **NOT_STARTED** |
| D3 | Post-deploy verification | ☐ PENDING / **NOT_STARTED** |

**D1–D3 = PENDING_DEPLOYMENT_ONLY** · **SPEC-009 PRODUCTION = DEFERRED_UNCHANGED**

---

## Phase-6 verification record

| Suite | Result |
|-------|--------|
| Phase 1 Domain+Arch | **28/28 PASS** |
| Phase 2 App+Arch | **21/21 PASS** |
| Phase 3 Infra+Arch | **28/28 PASS** |
| Phase 4 Consumer+Arch | **20/20 PASS** |
| Phase 5 Security+Arch | **35/35 PASS** |
| Legacy claim-safety | **23/23 PASS** |
| SPEC-001 routing | **102/102 PASS** |
| SPEC-002 scoring | **108/108 PASS** |
| SPEC-003 Brief | **162/162 PASS** |
| SPEC-005 AI Gateway | **201/201 PASS** |
| SPEC-009 auth claims (local) | **12/12 PASS** (`posturaClaimsCore` 8 + `firebaseClaims` 4) |
| `npm run check` | **976/976 PASS** |
| `npm run test:rules` | **91/91 PASS** |
| Product code changes (Phase 6 / closure) | **NONE** |
| Test code changes (Phase 6 / closure) | **NONE** |
| New secrets | **0** |

---

## Sign-off tracking

| Milestone | Status |
|-----------|--------|
| Phase 0 package | ✅ COMPLETE |
| T-006-010 Human SPEC approval | ✅ **DONE** — **APPROVED** 2026-08-24 (America/Bogota) |
| Phase 1 Domain (T-006-101…110) | ✅ **COMPLETE** |
| Phase 2 Application (T-006-201…211) | ✅ **COMPLETE** |
| Phase 3 Persistence (T-006-301…308) | ✅ **COMPLETE** |
| Phase 4 Consumer migration (T-006-401…407) | ✅ **COMPLETE** |
| Phase 5 Security / adversarial (T-006-501…510) | ✅ **COMPLETE** |
| Phase 6 T-006-601…603 / T-006-605 evidence | ✅ **COMPLETE** |
| Phase 6 T-006-604 Human CODE_COMPLETE | ✅ **DONE** — **APPROVED** 2026-08-25 (America/Bogota) |
| DEPLOYED / DONE | ☐ **NO** |

**Current:** **APPROVED** · **IMPLEMENTATION = CODE_COMPLETE** · **CODE_COMPLETE = YES** · **DEPLOYED = NO** · **DONE = NO** · **FREEZE = ACTIVE**

**Next allowed action:** Return to constitutional roadmap. Deployment (D1–D3) and SPEC-004 require separate authorization. Do not modify SPEC-006 except via approved requirement change, authorized deployment, reproducible regression, or approved security remediation.
