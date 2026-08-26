# Threat model 008 — Learning Loop

**Phase 0 formal threats.** Phase 5 adversarial implementation **COMPLETE** — **26/26 PASS**.

**Phase 6 threat freeze (T-008-601/602):** Phase 6 changed **0 product files**, so no threat surface
was altered and no threat could regress. Re-confirmed at Phase-6 closure: **26/26 PASS · 0 PARTIAL ·
0 FAIL · 0 PENDING** · P0 **0** · P1 **0** · authority bypasses **0** · full check **1466/1466 PASS** ·
rules **91/91 PASS**. Threat matrix is **FROZEN** for the CODE_COMPLETE candidate.

Constitution: Observation ≠ authority · Learning ≠ mutation · Recommendation ≠ approval · AI advisory · Tenant · Multi-thesis.

Baseline: SPEC-007 FROZEN @ `5d084ea9274909fb3f1d1eb2f51a084ec3a1f4c0`

---

## Assets

| Asset | Sensitivity |
|-------|-------------|
| LearningObservation + evidence | Client strategy feedback / performance |
| LearningAssessment metrics | Mis-prioritization risk |
| StrategicRecommendation | Proposed strategic change |
| RecommendationDecision | Human approval audit |
| Apply dispatch metadata | Cross-SPEC authority linkage |
| History | Abuse detection |

---

## Threats and controls

| ID | Threat | Impact | Control layer | Phase | Status |
|----|--------|--------|---------------|-------|--------|
| T-008-01 | Caller tenant spoof | Cross-client learning/recommendation | Trusted actor + tenant envelope | 2–5 | **FORMALIZED** |
| T-008-02 | Same-ID cross-tenant lookup | Privacy / wrong observation | Tenant-keyed stores; ban id-only get | 3–5 | **FORMALIZED** |
| T-008-03 | Caller role / actorUid spoof | Fake human approval | Trusted context; ignore caller snapshot | 2–5 | **FORMALIZED** |
| T-008-04 | Hard-coded actor fallback | False audit identity | Ban `user_admin_01` / `"client"` fallbacks | 4–5 | **FORMALIZED** |
| T-008-05 | UI direct db write | Authoritative learning without gate | Consumer intent-only; arch bans | 4–5 | **FORMALIZED** |
| T-008-06 | UI status sets APPROVED | Bypass human gate | Lifecycle validator; no raw setStatus | 2–5 | **FORMALIZED** |
| T-008-07 | AI self-approval | Model approves recommendation | AI actor ban on approve/apply | 2–5 | **FORMALIZED** |
| T-008-08 | AI auto-learning mutation | Model mutates scoring/thesis | AI advisory only; no apply port access | 2–5 | **FORMALIZED** |
| T-008-09 | Silent strategic mutation (feedbackScoringHints) | Outcome changes scoring without approval | **REMOVE** hints from scoring path (P0) | 4–5 | **FORMALIZED** |
| T-008-10 | Automatic mass rescore | Bulk scoring change on outcome | **REMOVE** post-outcome rescore (P0) | 4–5 | **FORMALIZED** |
| T-008-11 | SPEC-002 authority theft | 008 writes scoring weights | TargetSpecApplyPort only; no direct write | 2–5 | **FORMALIZED** |
| T-008-12 | SPEC-001 authority theft | Learning reroutes signals | No routing mutation from 008 | 4–5 | **FORMALIZED** |
| T-008-13 | SPEC-007 authority theft | 008 materializes/changes Opportunity | Read-only Opportunity ingest | 4–5 | **FORMALIZED** |
| T-008-14 | Apply before approval | Target mutation without APPROVED | Lifecycle gate + tests | 2–5 | **FORMALIZED** |
| T-008-15 | Target-SPEC bypass | 008 writes foreign storage | Apply port dispatch only | 2–5 | **FORMALIZED** |
| T-008-16 | Recommendation self-approval | Software sets approvedBy | Human-required transition | 2–5 | **FORMALIZED** |
| T-008-17 | Latest-outcome authority / replace-by-signalId | History loss drives scoring | Append + supersession; history non-authoritative | 1–5 | **FORMALIZED** |
| T-008-18 | History replay | Old APPROVED decision re-applied | Version + current projection only | 3–5 | **FORMALIZED** |
| T-008-19 | Stale recommendation apply | Apply superseded revision | Version check at apply | 2–5 | **FORMALIZED** |
| T-008-20 | Malformed persistence coercion | Invented APPROVED status | FAIL_CLOSED parse | 3–5 | **FORMALIZED** |
| T-008-21 | Stale write / duplicate current | Duplicate authoritative recommendation | Idempotency + unique policies | 2–5 | **FORMALIZED** |
| T-008-22 | Idempotency replay | Double apply side effects | Idempotency store | 2–5 | **FORMALIZED** |
| T-008-23 | Side-effect before gate | Observation triggers rescore | Zero strategic side effects on register | 4–5 | **FORMALIZED** |
| T-008-24 | Direct provider bypass | Learning calls OpenAI/Anthropic directly | SPEC-005 gateway only (future advisory) | 2–5 | **FORMALIZED** |
| T-008-25 | First-index thesis fallback | Wrong thesis scope | Explicit thesisScope only | 1–5 | **FORMALIZED** |
| T-008-26 | SPEC-003/004/006 boundary bypass | Approve Brief/Plan or publish via learning | Arch bans + tests | 4–5 | **FORMALIZED** |

**Threat count:** **26** (T-008-01 … T-008-26)

**Note:** Phase 0 tasks reference T-008-501 covering threats 01–18; full model includes 01–26. Phase 5 task T-008-501 implements all formalized threats.

---

## Phase 5 adversarial result — 26/26 PASS

Evidence suites (`SEC` = `tests/learningLoopPhase5Security.test.ts`,
`CON` = `tests/learningLoopPhase5Consumer.test.ts`,
`ARC` = `tests/learningLoopPhase5Architecture.test.ts`).

A threat is PASS only where the attack is executed and the defense observed at
runtime; static bans are supporting evidence only, never the sole basis.

| ID | Attack executed | Entry point | Actual defense observed | Evidence | Status |
|----|-----------------|-------------|-------------------------|----------|--------|
| T-008-01 | `claimedOrganizationId`/`claimedClientId` = foreign tenant on register, supersede, evidence, generate, review, approve, reject, apply | Application + consumer facade | `assertNoTenantSpoof` throws; foreign read → `RECOMMENDATION_NOT_FOUND`; list → `[]` | SEC + CON | **PASS** |
| T-008-02 | Same `observationId` / `recommendationId` created in org_a and org_b; foreign-scope `getById` | Repositories | Tenant-keyed `org\|client\|id`; foreign scope → `undefined`; no id-only accessor exists | SEC | **PASS** |
| T-008-03 | Payload `actorUid`, `createdBy`, `role`, `actorType`, `approvedBy`, `humanAuthority` | Application + consumer | `ignoreCallerActorClaims`; persisted `actorUid`/`approvedBy` = trusted actor | SEC + CON | **PASS** |
| T-008-04 | `user_admin_01` / `"client"` payloads; blank trusted actor, tenant and clock | Application + consumer + static | Caller values discarded; blank trusted context throws; 0 authoritative literals in canonical runtime | SEC + ARC | **PASS** |
| T-008-05 | Direct `dbService.recordSignalOutcome` / `addResult`; UI/`main.ts` import of repositories | Real `dbService` + static | Both throw `LEGACY_AUTHORITY_REMOVED`; 0 UI/main imports of Application/Infrastructure/Composition | SEC + ARC | **PASS** |
| T-008-06 | `forgedStatus: 'APPROVED'`; PROPOSED → APPROVED skipping review | Application | No generic `setStatus`; illegal transition rejected; forged snapshot ignored | SEC | **PASS** |
| T-008-07 | `actorKind: 'AI'` transition to APPROVED/REJECTED/APPLIED | Domain + Application | `AI_AUTHORITY_FORBIDDEN`; no Application path can produce an AI actor kind | SEC | **PASS** |
| T-008-08 | AI-shaped advisory claiming approval/apply | Domain + static | AI holds no lifecycle authority and no apply-port access; 0 provider imports | SEC + ARC | **PASS** |
| T-008-09 | Search every runtime use of `feedbackScoringHints` | Whole `src` tree | Only its own **DEAD** definition in `radarFeedbackCore.ts`; **0 src call sites**; TEST_ONLY in `radarSprintC.test.ts` | ARC | **PASS** |
| T-008-10 | Search rescore / `scoreSignal` / routing recompute in learning runtime and the outcome handler | Learning runtime + `main.ts` | 0 call sites; outcome handler contains only `registerSignalOutcomeIntent` | ARC | **PASS** |
| T-008-11 | Approved SPEC-002 recommendation with no registered port; foreign-store imports | Application + static | `APPROVED_NOT_APPLIED`, `targetPortCalled=false`; 0 SPEC-002 store imports | SEC + ARC | **PASS** |
| T-008-12 | SPEC-001 routing recommendation approved then applied; `setRoutingDecision`/`selectedThesisId` search | Application + static | No SPEC-001 port → `APPROVED_NOT_APPLIED`; 0 routing mutators | SEC + ARC | **PASS** |
| T-008-13 | Ingest with foreign tenant, fabricated id, non-terminal PROPOSED, duplicate event, same id other tenant | Consumer ingest | Opportunity byte-identical before/after; denial or `ingested:false`; reader exposes only `getOutcome`/`listOutcomes` | CON + ARC | **PASS** |
| T-008-14 | Apply from PROPOSED, UNDER_REVIEW, REJECTED, APPLIED, plus forged APPROVED snapshot | Application | `RECOMMENDATION_NOT_APPROVED`; **target port calls = 0** | SEC | **PASS** |
| T-008-15 | Apply with empty registry and with a wrong-`specId` port | Application | Dispatch only via `targetApplyRegistry.resolve`; single `port.apply(` site; trusted tenant passed | SEC + ARC | **PASS** |
| T-008-16 | Trusted SOFTWARE approve/reject with HUMAN payload claims; HIGH confidence; `forgedApproved` | Application | `HUMAN_APPROVAL_REQUIRED`; HIGH confidence stays PROPOSED; forged approval throws | SEC | **PASS** |
| T-008-17 | Supersede prior observation; material overwrite of an ACTIVE row at same id | Application + persistence | Prior retained as SUPERSEDED (2 rows, 1 ACTIVE); overwrite → *material change requires supersession* | SEC | **PASS** |
| T-008-18 | Forged history entry claiming APPROVED/APPLIED; replayed APPROVE decision against REJECTED | History + decision adapters | Aggregate unchanged; all rows `AUDIT_ONLY`; history append idempotent | SEC | **PASS** |
| T-008-19 | `expectedVersion` = N against current N+1 on approve and apply; stale write lowering stored version | Application + persistence | `STALE_STATE`; *Stale write denied*; SUPERSEDED revival blocked | SEC | **PASS** |
| T-008-20 | Unknown store schema, non-JSON, forged APPROVED row, unknown status, missing tenant envelope, invalid + collapsed MULTI scope, disagreeing envelope | Persistence | **FAIL_CLOSED** on every case — malformed data never becomes authority | SEC | **PASS** |
| T-008-21 | Two writes to the same tenant-keyed id; duplicate-current projection | Persistence | Structurally one current row per `org\|client\|id`; duplicate-current assertion active | SEC | **PASS** |
| T-008-22 | Apply replay on same key; fresh key on APPLIED; double-click register; key with different fingerprint; same key in two tenants | Application + persistence | **target mutation count = 1**; `IDEMPOTENCY_CONFLICT` on fingerprint change; tenant-scoped keys independent | SEC + CON | **PASS** |
| T-008-23 | Register observation and ingest outcome, then inspect for strategic side effects; all failed preconditions | Application + static | Zero scoring/routing effects; **target calls = 0** on every failed precondition | SEC + ARC | **PASS** |
| T-008-24 | Search provider SDK imports, raw `fetch(`, provider endpoints across learning tree | Domain + Application + Infrastructure + Composition + consumer | **0 occurrences** — no paid provider invoked in Phase 5 | ARC | **PASS** |
| T-008-25 | MULTI and CLIENT_WIDE through the full pipeline; `theses[0]`, `primaryThesisId`, sort-winner search; mismatched-scope evidence | Application + static | Scope preserved end to end; MULTI never collapses; 0 fallback patterns; mismatch rejected | SEC + ARC | **PASS** |
| T-008-26 | Search `approveStrategicBrief`, `authorizePublication`, `verifyClaim` and SPEC-003/004/006 imports in learning runtime | Static | **0 occurrences** — no Brief/Plan approval or publication authority | ARC | **PASS** |

**Result:** **26 PASS · 0 PARTIAL · 0 FAIL · 0 PENDING**  
**Authority bypasses found:** **0** · **Product fixes required:** **0**

---

## Trust boundaries

```text
[Browser UI] --untrusted--> [learningLoopConsumer] --intent--> [Application]
                                                                    ↓
                                                              [Domain]
                                                                    ↑
                                                         [Ports / local stores]
                                                                    ↓
                                                    TargetSpecApplyPort → TARGET SPEC

Trusted HUMAN --required--> APPROVED → ApplyApprovedRecommendation
SPEC-005 AI --advisory only--> LearningAdvisorPort (optional)
```

---

## P0 threat linkage

| Runtime defect | Threat IDs |
|----------------|------------|
| feedbackScoringHints → scoring | T-008-09, T-008-11, T-008-23 |
| mass rescore on outcome | T-008-10, T-008-23 |
| replace-by-signalId | T-008-17 |

**RUNTIME P0:** **RESOLVED** — removed in Phase 4, re-verified adversarially in Phase 5.
All five linked threats are PASS. **RUNTIME P0 = 0.**

---

## Out of scope for SPEC-008 threat remediation

- Production Firestore/Storage rule deployment (SPEC-009)
- Opportunity lifecycle spoofing (SPEC-007 threat model)
- Brief/Plan approval spoofing (SPEC-003/004)
- Claim verification spoofing (SPEC-006)

---

## AUDIT008 mapping

| AUDIT | Threat coverage |
|-------|-----------------|
| AUDIT008-03 | T-008-09, T-008-10, T-008-23 |
| AUDIT008-04 | T-008-04 |
| AUDIT008-05 | T-008-02 |
| AUDIT008-06 | T-008-17 |
| AUDIT008-09 | T-008-09, T-008-11, T-008-12 |
| AUDIT008-11 | T-008-05, T-008-06 |

All mapped threats are **PASS** after Phase 5, so AUDIT008-03, -04, -05, -06, -09 and
-11 are **RESOLVED**. AUDIT008-02, -07, -08 and -12 have no threat mapping in this
model and no Phase-5 task owns them; they remain **IMPLEMENTATION_PENDING** for
Phase 6 rather than being closed without evidence.
