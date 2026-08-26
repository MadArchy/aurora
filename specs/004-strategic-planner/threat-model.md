# Threat model 004 — Strategic Planner

**Phase 5 COMPLETE** — adversarial + architecture evidence recorded.  
Constitution: AI suggests / software governs · Tenant · Explainability · Thesis-first.

---

## Assets

| Asset | Sensitivity |
|-------|-------------|
| StrategicPlan + PlanItems | Client strategy execution intent |
| Brief binding (id/version) | Strategic authorization linkage |
| Approval metadata | Abuse detection |
| Downstream refs | Content/opportunity/task linkage |
| AI advisory refs | Non-authoritative suggestions |

---

## Threats and controls

| ID | Threat | Impact | Control layer | Phase |
|----|--------|--------|---------------|-------|
| T-004-01 | Caller tenant spoof | Cross-client plan | Trusted actor + tenant envelope | 2–5 |
| T-004-02 | Caller role spoof | Fake plan approval | Trusted context; UI role ignored | 2–5 |
| T-004-03 | AI self-approval | Model approves plan | AI actor ban on approve/activate | 2–5 |
| T-004-04 | Stale Brief | Execute on superseded Brief | version match + revalidation | 1–5 |
| T-004-05 | Superseded Brief | Same as stale | Fail closed | 1–5 |
| T-004-06 | Unauthorized action | PlanItem outside Brief.authorizedAction | Domain bound check | 1–5 |
| T-004-07 | Mixed-thesis plan | Ambiguous thesis authority | One Brief / one thesis invariant | 1–5 |
| T-004-08 | Cross-tenant Plan/Brief | Privacy breach | Tenant match deny | 1–5 |
| T-004-09 | Forged plan status | UI/localStorage PASS | Application-only status writes | 3–5 |
| T-004-10 | History-as-authority | Old APPROVED history activates | Current projection only | 3–5 |
| T-004-11 | Direct UI approval | Badge click without use case | Architecture bans | 4–5 |
| T-004-12 | Direct db status write | Bypass Application | Ports + consumer bans | 4–5 |
| T-004-13 | First/index fallback | Implicit thesis | Explicit thesisId only | 1–5 |
| T-004-14 | Duplicate current plans | Ambiguous authority | Idempotency + one current per Brief revision policy | 2–5 |
| T-004-15 | Replay / non-idempotent | Duplicate items | Idempotency keys | 2–5 |
| T-004-16 | Legacy curation bypass | CurationEntry as fake Plan | Demote curation; strangler Phase 4 | 4–5 |
| T-004-17 | SPEC-006 publication bypass | Publish without claim gate | Explicit non-ownership; tests | 4–5 |

**Local tamper resistance:** structurally valid local fabrication = **KNOWN_LIMITATION** until SPEC-009 remote authority. Malformed → FAIL_CLOSED.

---

## Phase-5 threat evidence matrix

| Threat ID | Attack test | Expected defense | Result | Test file / name | Status |
|-----------|-------------|------------------|--------|------------------|--------|
| T-004-01 | Caller tenant spoof / claimed org+client | Trusted tenant wins; DENY | PASS | `strategicPlanPhase5` · caller tenant spoof | **PASS** |
| T-004-02 | CLIENT trusted / forged ADMIN approvedBy | ADMIN-only approve; trusted actor wins | PASS | `strategicPlanPhase5` · role spoof | **PASS** |
| T-004-03 | AI actorKind / softwareAuthority payload | AI cannot approve; trusted HUMAN wins | PASS | `strategicPlanPhase5` · AI self-approval | **PASS** |
| T-004-04 | Brief version drift after Plan approve | STALE_BRIEF fail closed | PASS | `strategicPlanPhase5` · stale Brief | **PASS** |
| T-004-05 | Brief SUPERSEDED after Plan approve | Fail closed | PASS | `strategicPlanPhase5` · superseded Brief | **PASS** |
| T-004-06 | NONE / RESEARCH_ONLY / action mismatch | ACTION_NOT_AUTHORIZED | PASS | `strategicPlanPhase5` · unauthorized action | **PASS** |
| T-004-07 | Thesis A Plan vs Brief thesis B | THESIS_MISMATCH deny | PASS | `strategicPlanPhase5` · thesis mismatch | **PASS** |
| T-004-08 | Cross-org / cross-client / same-ID | Isolated; undefined foreign | PASS | `strategicPlanPhase5` · cross-tenant | **PASS** |
| T-004-09 | Forged Plan APPROVED snapshot on DRAFT | Repository Plan governs | PASS | `strategicPlanPhase5` · forged Plan | **PASS** |
| T-004-10 | History PLAN_APPROVED + SUPERSEDED plan | History authority NONE | PASS | `strategicPlanPhase5` · history | **PASS** |
| T-004-11 | UI toggle / status-alone | Zero Application writes | PASS | `strategicPlanPhase5` + `SecurityArchitecture` | **PASS** |
| T-004-12 | Direct store / UI repository | Consumer/UI bans = 0 | PASS | `strategicPlanSecurityArchitecture` | **PASS** |
| T-004-13 | primaryThesis / `[0]` patterns | Static ban = 0 | PASS | `strategicPlanSecurityArchitecture` | **PASS** |
| T-004-14 | Two current plans same Brief revision | Fail closed | PASS | `strategicPlanPhase5` · duplicate current | **PASS** |
| T-004-15 | Replay create intentKey / cross-tenant key | Idempotent; no cross-tenant collision | PASS | `strategicPlanPhase5` · idempotency | **PASS** |
| T-004-16 | Curation / Delivery / Content / Task spoof | Legacy strategic fallbacks = 0 | PASS | `strategicPlanPhase5` · legacy spoof | **PASS** |
| T-004-17 | Planner ALLOW + missing content publish | SPEC-006 deny; publication side effects 0 | PASS | `strategicPlanPhase5` · SPEC-006 | **PASS** |

**Threat PASS = 17 · PARTIAL = 0 · FAIL = 0**

---

## Trust boundaries

```text
[Browser UI] --untrusted--> [Application use cases] --trusted actor--> [Domain]
                                      |
                                      v
                              [Ports / local stores]
                                      |
                         (future) [Firestore — SPEC-009]
```

AI Gateway output = **untrusted suggestion**.

---

## Out of scope for SPEC-004 threat remediation

- Production Firestore/Storage rule deployment (SPEC-009)
- Claim verification spoofing (SPEC-006 threat model)
- Brief approval spoofing (SPEC-003 threat model)
