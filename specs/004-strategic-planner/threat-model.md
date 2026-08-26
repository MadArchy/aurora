# Threat model 004 — Strategic Planner

**Phase 0 documentation only.** No security implementation in this phase.

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
