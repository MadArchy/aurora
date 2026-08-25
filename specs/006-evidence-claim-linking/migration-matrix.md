# Migration matrix 006 — Evidence Claim Linking

**Phase 0 inventory only.** No code migration performed.

Baseline SHA: `e16280607fa078941078d2cb4c233025a1bd66a1`

Legend: **KEEP** · **MIGRATE** · **ADAPT** · **DEPRECATE** · **OTHER_SPEC** · **REMOVE_LATER** · **MISSING**

---

## Legacy claim-safety components

| Component | Path | Classification | Notes | Owning phase |
|-----------|------|----------------|-------|--------------|
| Claim review engine | `src/domain/claimSafetyCore.ts` | **ADAPT** → Domain extractors + eligibility | Regex kinds useful; not full Claim lifecycle | 1–4 |
| Publication gate | `src/domain/claimSafetyGateCore.ts` | **MIGRATE** → `AuthorizePublication` / claimGateCore | Preserve gated statuses | 1–4 |
| UI panel | `src/components/ClaimSafetyPanel.ts` | **ADAPT** | Display Claim statuses | 4 |
| Live bind / save gate | `src/main.ts` (`saveContentWithClaimGate`, `refreshClaimSafetyLive`, …) | **MIGRATE** | Orchestration → Application | 4 |
| Draft review wrapper | `src/services/ai.ts` `reviewDraftClaims` | **ADAPT** | Must remain non-authoritative Verification | 2–4 |
| Modals claim UI | `src/components/Modals.ts` | **ADAPT** | Ack for REVIEW → ReviewClaim | 4 |
| Manager badges | `src/components/ManagerCockpit.ts` | **ADAPT** | Display only | 4 |
| Client workspace flags | `src/components/ClientWorkspace.ts` | **ADAPT** | Display only | 4 |
| Content publish helpers | `src/domain/contentPublishCore.ts` | **KEEP** | Pipeline labels; not claim authority | — |
| Verdict on ContentItem | `types` `ClaimSafetyVerdictRecord` | **DEPRECATE** (compat projection) | After Claim aggregate | 4 |
| Evidence vault type | `types` `EvidenceVaultItem` | **MIGRATE** → Evidence entity | Keep fields; add Source | 1–3 |
| Evidence persistence | `db.ts` `postura_evidence_v5` | **ADAPT** behind `LocalEvidenceVaultAdapter` | LOCAL current + local ClaimEvidence | 3 |
| Evidence UI vault | ClientWorkspace evidence rows | **KEEP** / **ADAPT** | Tenant vault UX | 4 |
| Thesis strength evidence | `thesisStrengthCore.ts` | **OTHER_SPEC** / shared read | Evidence Authority scoring — not claim gate | — |
| Brief evidence refs | SPEC-003 Brief / ContentItem | **KEEP** (consume) | References ≠ verification | — |
| Auth claims core | `posturaClaimsCore.ts` | **OTHER_SPEC** (SPEC-009) | Do not merge | — |
| Firebase claims bridge | `src/firebase/claims.ts` | **OTHER_SPEC** (SPEC-009) | Do not merge | — |
| Formal Claim entity | — | **IMPLEMENTED** (Domain + local store) | Phase 1–3 | 1–3 |
| Verification entity | — | **IMPLEMENTED** (Domain + local store) | Phase 1–3 | 1–3 |
| Source entity | — | **IMPLEMENTED** (Domain VO + vault map) | Phase 1–3 | 1 |
| ClaimEvidenceLink | — | **IMPLEMENTED** (Domain + local store) | Phase 1–3 | 1–3 |
| EVIDENCE_REQUIRED state | — | **IMPLEMENTED** | Phase 1 | 1 |
| Material history (claims) | — | **IMPLEMENTED** (`postura_claim_history_v1`) | Phase 3 | 3 |
| Override audit (claims) | — | **IMPLEMENTED** (`postura_claim_override_v1`) | Phase 2–3 | 2–3 |

---

## Requirement vs legacy gap matrix

| Requirement | Current implementation | Gap | Severity | Migration strategy | Phase |
|-------------|------------------------|-----|----------|--------------------|-------|
| Claim→Evidence→Verification→Source | findings + evidence IDs + boolean `verified` | Full chain missing | **P1** F-006-02 | New Domain model; adapt vault | 1–3 |
| EVIDENCE_REQUIRED state | Implied via REVIEW/BLOCK text | No first-class state | **P1** | ClaimStatus enum | 1 |
| RESEARCH_REQUIRED | Absent | Missing | **P1** | ClaimStatus | 1 |
| Verification actor/rule/version | Absent | Missing audit | **P1** | Verification record | 1–3 |
| Source provenance | `sourceUrl` optional on vault | Incomplete Source model | **P2** | Source VO | 1 |
| Tenant foreign evidence deny | Client filter in `getEvidenceVaultByClient`; Brief has stronger checks | Claim path weak vs Brief | **P1** | Domain tenant validators | 1–5 |
| AI advisory only | `reviewDraftClaims` is deterministic local — OK; no AI verify | Must keep ban | — | Architecture tests | 5 |
| Publication gate | `claimSafetyGateCore` aggregate | Not claim-state based | **P2** | AuthorizePublication | 2–4 |
| Brief evidence ≠ verified | claimSafety ignores Brief IDs | Documented; enforce | **P2** | Explicit tests | 1–5 |
| Material history | None for claims | Missing | **P2** | Append-only stores | 3 ✅ |
| Override audit | REVIEW ack boolean | Weak | **P2** | OverrideClaimGate + store | 2–3 ✅ |
| Requirement traceability | None | P2-006-01 | **P2** | CLAIM-006-* IDs | 1 |
| Architecture/security suites | None dedicated | P2-006-02 | **P2** | Infra arch Phase 3; security Phase 5 | 3–5 |
| Naming canonical title | "claim safety" modules | P3-006-01 | **P3** | Docs first; rename later | 0 / later |
| Governance package | Was missing | F-006-01 | **P1→RESOLVED** | Phase 0 docs | 0 |

---

## Test inventory (baseline — do not modify in Phase 0)

| File | Tests | Classification |
|------|-------|----------------|
| `tests/claimSafetyCore.test.ts` | 17 | **KEEP** baseline / migrate later |
| `tests/claimSafetyGateCore.test.ts` | 6 | **KEEP** baseline / migrate later |
| **Direct legacy total** | **23** | SPEC-006-adjacent |
| `tests/posturaClaimsCore.test.ts` | 8 | **OTHER_SPEC** SPEC-009 |
| `tests/firebaseClaims.test.ts` | 4 | **OTHER_SPEC** SPEC-009 |

---

## SPEC-003 / 005 / 009 rows

| Location | Owner | SPEC-006 action |
|----------|-------|-----------------|
| StrategicBrief + gate | SPEC-003 FROZEN | **OTHER_SPEC** — consume only |
| AI Gateway operations | SPEC-005 | **OTHER_SPEC** — advisory suggestion port optional |
| Auth claims / rules | SPEC-009 | **OTHER_SPEC** — DEFERRED production |
| `claimSafetyCore` | SPEC-006 | **ADAPT** |
| `claimSafetyGateCore` | SPEC-006 | **MIGRATE** |

---

## Exit criteria (Phase 4 — future)

- Zero authoritative publication paths using only legacy aggregate without Claim set
- `ContentItem.claimSafety` COMPATIBILITY_ONLY or removed
- EVIDENCE_REQUIRED blocks gated statuses
- SPEC-003 Brief refs preserved
- 23 legacy tests green or formally superseded with mapped successors
- F-006-02 closed
