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

## Threats and controls (Phase 5 evidence)

| ID | Threat | Impact | Control layer | Phase 5 status |
|----|--------|--------|---------------|----------------|
| T-006-01 | Foreign evidence injection | Wrong-tenant proof authorizes claim | Domain + Application link deny | **PASS** |
| T-006-02 | Fake source identity | Inflated trust | Source VO + vault map fail-closed | **PASS** |
| T-006-03 | Evidence link tampering | Unsupported claim appears linked | Append-only links + history | **PASS** |
| T-006-04 | Verification spoofing | UI/localStorage forges PASS | Application-only Verification write; history non-authority | **PASS** |
| T-006-05 | AI self-verification | Model approves own draft claims | AI actor ban + advisory projection | **PASS** |
| T-006-06 | Stale evidence / deleted source | Publish on vanished proof | contentHash + evidence existence | **PASS** |
| T-006-07 | Unsupported claim publication | Professional/regulatory harm | AuthorizePublication FAIL_CLOSED | **PASS** |
| T-006-08 | Cross-tenant leakage | Privacy / multi-tenant breach | Tenant envelope + Phase-5 matrix | **PASS** |
| T-006-09 | Legacy bypass | Paths skip gate | Strangler canonical required | **PASS** |
| T-006-10 | Direct UI status mutation | Badge cleared without verify | UI display-only architecture | **PASS** |
| T-006-11 | Brief evidence as fake verify | Treat supportingEvidenceIds as proof | Traceability ≠ verification | **PASS** |
| T-006-12 | Auth-claims confusion | SPEC-009 claims mixed into Domain | Import bans | **PASS** |
| T-006-13 | Silent override | Manager bypass without audit | OverrideClaimGate required fields | **PASS** |
| T-006-14 | Hard-block override | Guarantee/hard thesis published | Domain non-overridable | **PASS** |

**Local tamper resistance:** structurally valid local fabrication remains **KNOWN_LIMITATION** (not SPEC-009 cryptographic authority). Malformed tampering → FAIL_CLOSED.

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

**Phase 5 status:** **COMPLETE** — dedicated `claimEvidenceSecurityArchitecture.test.ts` + `claimEvidencePhase5.test.ts`.
