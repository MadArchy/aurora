# Threat model 006 — Evidence Claim Linking

**Phase 0 documentation only.** No security implementation in this phase.

Constitution: §8 AI suggests / software governs · §17 Risk & professional safety · §20 Security (tenant).

---

## Assets

| Asset | Sensitivity |
|-------|-------------|
| Claim text + status | Client-confidential positioning assertions |
| Evidence vault contents | Credentials, awards, metrics, documents |
| Source metadata | May include private URLs |
| Verification records | Authority for publication |
| Override audit | Abuse detection |
| Content publication gate | Public reputation / professional risk |

---

## Threats and controls (design)

| ID | Threat | Impact | Phase 0 control (doc) | Future control |
|----|--------|--------|----------------------|----------------|
| T-006-01 | Foreign evidence injection | Wrong-tenant proof authorizes claim | Tenant invariants | Domain + Application deny + tests |
| T-006-02 | Fake source identity | Inflated trust | Source provenance required | Verification considers Source eligibility |
| T-006-03 | Evidence link tampering | Unsupported claim appears linked | Link store + history | Append-only; no silent replace |
| T-006-04 | Verification spoofing | UI/localStorage forges PASS | Trusted actor only | Application writes Verification |
| T-006-05 | AI self-verification | Model approves own draft claims | Ban AI actorType | Architecture + Phase 5 tests |
| T-006-06 | Stale evidence / deleted source | Publish on vanished proof | contentHash + evidence existence check | Reverify on missing evidence |
| T-006-07 | Unsupported claim publication | Professional/regulatory harm | Gate FAIL_CLOSED | AuthorizePublication |
| T-006-08 | Cross-tenant leakage | Privacy / multi-tenant breach | Envelope on all entities | Phase 5 matrix |
| T-006-09 | Legacy bypass | Paths skip gate | Migration matrix | Phase 4 exit = 0 bypass |
| T-006-10 | Direct UI status mutation | Badge cleared without verify | UI display-only rule | Consumer architecture tests |
| T-006-11 | Brief evidence as fake verify | Treat supportingEvidenceIds as proof | Explicit non-authority | Deny tests A15 |
| T-006-12 | Auth-claims confusion | SPEC-009 claims mixed into Domain | Terminology separation | Import bans |
| T-006-13 | Silent override | Manager bypass without audit | Override required fields | OverrideClaimGate |
| T-006-14 | Hard-block override | Guarantee/hard thesis published | Non-overridable kinds | Domain predicate |

---

## Trust boundaries

```text
[Browser UI] --untrusted--> [Application use cases] --trusted actor--> [Domain]
                                      |
                                      v
                              [Ports / local stores]
                                      |
                         (future) [Firestore rules — SPEC-009]
```

AI Gateway output = **untrusted suggestion** until Domain/Application accepts.

---

## Out of scope for SPEC-006 threat remediation

- Production Firestore/Storage rule deployment (SPEC-009)
- Network SSRF against Source URLs (may be shared platform concern)
- Crypto attestation of evidence files

---

## Phase 5 acceptance linkage

Threats T-006-01…14 map to tasks T-006-501…510 and acceptance A8–A13, A19–A21, A36, A38.
