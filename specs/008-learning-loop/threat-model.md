# Threat model 008 — Learning Loop

**Phase 0 formal threats.** Phase 5 implementation tests pending.

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
**Phase-5 evidence target:** `tests/learningLoopPhase5Security.test.ts` (future) · architecture suites

**Note:** Phase 0 tasks reference T-008-501 covering threats 01–18; full model includes 01–26. Phase 5 task T-008-501 implements all formalized threats.

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

**RUNTIME P0 remains open until Phase 4 controls verified.**

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
