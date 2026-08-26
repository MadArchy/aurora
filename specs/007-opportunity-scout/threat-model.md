# Threat model 007 — Opportunity Scout

**Phase 0 documentation only.** No security implementation in this phase.

Constitution: AI suggests / software governs · Tenant · Explainability · Thesis-first · Opportunity Score not black box.

---

## Assets

| Asset | Sensitivity |
|-------|-------------|
| OpportunityCandidate + evaluations | Client strategy / external intent |
| OpportunityScore | Mis-prioritization risk |
| Materialized Opportunity + checklist | Client operational commitments |
| Brief/Plan binding metadata | Execution authority linkage |
| History | Abuse detection |

---

## Threats and controls

| ID | Threat | Impact | Control layer | Phase |
|----|--------|--------|---------------|-------|
| T-007-01 | Caller tenant spoof | Cross-client Opportunity | Trusted actor + tenant envelope | 2–5 |
| T-007-02 | Caller role spoof | Fake accept/submit | Trusted context; UI role ignored | 2–5 |
| T-007-03 | AI self-approval | Model materializes/accepts | AI actor ban on materialize/accept/submit | 2–5 |
| T-007-04 | Caller snapshot spoof | Fake Plan/Brief/Opportunity status | Application loads authoritative state | 2–5 |
| T-007-05 | UI status mutation | Badge/checklist without use case | Architecture bans; consumer facade | 4–5 |
| T-007-06 | Legacy db bypass | `dbService.addOpportunity` as authority | Phase 4 strangler; inventory = 0 | 4–5 |
| T-007-07 | Dual lifecycle ambiguity | Wrong transition / silent coerce | Canonical lifecycle + migration fail-closed | 1–4 |
| T-007-08 | Stale candidate | Act on superseded candidate | version + reevaluate | 1–5 |
| T-007-09 | Stale Opportunity | Act on superseded/archived | Domain status machine | 1–5 |
| T-007-10 | Stale Brief/Plan auth | Materialize after Plan deny/stale | Require fresh SPEC-004 allow | 2–5 |
| T-007-11 | History replay | Old ACCEPTED history activates | Current projection only | 3–5 |
| T-007-12 | Malformed persistence | Coercion invents authority | FAIL_CLOSED parse | 3–5 |
| T-007-13 | Same-ID cross-tenant | Privacy / collision | Tenant-keyed stores | 1–5 |
| T-007-14 | First-index thesis fallback | Wrong thesis Opportunity | Explicit thesisId / evaluations only | 1–5 |
| T-007-15 | Opportunity Score manipulation | Fake priority | Domain compute only; versioned model | 1–5 |
| T-007-16 | Execution before Plan gate | Unauthorized materialize | Materialize requires SPEC-004 allow | 2–5 |
| T-007-17 | Duplicate current / idempotency replay | Duplicate Opportunities | Idempotency + unique policies | 2–5 |
| T-007-18 | SPEC-003/004/006 boundary bypass | Mutate Brief/Plan or publish | Arch bans + tests | 4–5 |

**Local tamper resistance:** structurally valid local fabrication = **KNOWN_LIMITATION** until SPEC-009 remote authority. Malformed → FAIL_CLOSED.

**Threat count:** **18** (T-007-01 … T-007-18)

---

## Trust boundaries

```text
[Browser UI / The Scout] --untrusted--> [Application] --trusted--> [Domain]
                                              |
                                              v
                                       [Ports / local stores]
                                              |
                                  (future) [Firestore — SPEC-009]

SPEC-004 AuthorizePlannedAction --required--> MaterializeOpportunity
```

AI Gateway output = **untrusted suggestion**.

---

## Out of scope for SPEC-007 threat remediation

- Production Firestore/Storage rule deployment (SPEC-009)
- Claim verification spoofing (SPEC-006)
- Brief/Plan approval spoofing (SPEC-003/004 threat models)
