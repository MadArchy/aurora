# Tasks 006 — Evidence Claim Linking

**Spec status:** `APPROVED`  
**Implementation:** **PHASE_1_AUTHORIZED** · DEPLOYED **NO** · DONE **NO** · DEPLOYMENT **NOT_STARTED**  
**Branch:** `spec/006-evidence-claim-linking`  
**Base SHA:** SPEC-003 CODE_COMPLETE `e16280607fa078941078d2cb4c233025a1bd66a1`  
**Phase-0 governance checkpoint:** `d8fe981c1fc15f47fc7fdf6ef7ef0fae211a6fe5`  
**Human SPEC approval:** **APPROVED** (T-006-010) — 2026-08-24 (America/Bogota)  
**Approval text:** «Apruebo formalmente SPEC-006 — Evidence Claim Linking y autorizo el cierre de T-006-010 y el inicio de la Phase 1 de implementación.»

Status legend: `TODO` · `DOING` · `DONE` · `BLOCKED` · `PENDING`

Requirement ID prefix (future Domain): `CLAIM-006-001` …

---

## Phase 0 — Inventory + formal SPEC package

- [x] **T-006-001** Create `specs/006-evidence-claim-linking/` directory
- [x] **T-006-002** Author `spec.md` (boundaries, model, EVIDENCE_REQUIRED, gates)
- [x] **T-006-003** Author `plan.md` (strangler, phases, dependencies)
- [x] **T-006-004** Author `tasks.md` (this file)
- [x] **T-006-005** Author `acceptance.md` (A1–A40 + deploy separation)
- [x] **T-006-006** Author `data-flow.md` (flows, gate points, Brief/AI boundaries)
- [x] **T-006-007** Author `hexagonal-boundaries.md`
- [x] **T-006-008** Author `migration-matrix.md` (legacy claim-safety inventory)
- [x] **T-006-009** Author `claim-model.md` + `threat-model.md`
- [x] **T-006-010** Human SPEC approval → status `APPROVED` — **DONE** (2026-08-24 America/Bogota)

**Phase 0 gate:** Package authored · Human SPEC approval **DONE**

**Exit:** Formal package complete · **APPROVED** · Phase 1 **AUTHORIZED** · Phase 1 implementation starts after this approval checkpoint.

**Newly authored Phase 0 IDs:** T-006-001 … T-006-010

---

## Phase 1 — Domain contracts (AUTHORIZED)

- [ ] **T-006-101** Define `Claim` aggregate + identity/tenant/content linkage
- [ ] **T-006-102** Define `Evidence` entity (adapt `EvidenceVaultItem` contract)
- [ ] **T-006-103** Define `Source` value object / entity metadata
- [ ] **T-006-104** Define `Verification` record + authority rules
- [ ] **T-006-105** Define `ClaimEvidenceLink` association invariants
- [ ] **T-006-106** `ClaimStatus` state machine (`DETECTED` … `OVERRIDDEN`) including `EVIDENCE_REQUIRED` / `RESEARCH_REQUIRED`
- [ ] **T-006-107** Tenant isolation pure validators (foreign evidence/claim/verification deny)
- [ ] **T-006-108** Publication eligibility predicates from Claim set
- [ ] **T-006-109** Override audit record shape (non-overridable hard blocks)
- [ ] **T-006-110** Domain unit tests + architecture purity tests

**Exit:** Domain tests PASS; no Firebase/db/React/provider imports.

**Phase 1 IDs:** T-006-101 … T-006-110

---

## Phase 2 — Application / governance (NOT AUTHORIZED)

- [ ] **T-006-201** `ExtractClaims` use case
- [ ] **T-006-202** `RegisterClaim` use case
- [ ] **T-006-203** `LinkEvidenceToClaim` use case
- [ ] **T-006-204** `RequireEvidence` use case
- [ ] **T-006-205** `VerifyClaim` / `RejectClaimVerification` use cases
- [ ] **T-006-206** `ReviewClaim` use case
- [ ] **T-006-207** `OverrideClaimGate` use case (auditable)
- [ ] **T-006-208** `AuthorizePublication` use case
- [ ] **T-006-209** Ports: ClaimRepository, EvidenceReader, VerificationStore, HistoryPort, Clock, Actor, optional ClaimSuggestionPort
- [ ] **T-006-210** Controlled error model (`CLAIM_NOT_FOUND`, `EVIDENCE_TENANT_MISMATCH`, `VERIFICATION_FORBIDDEN`, …)
- [ ] **T-006-211** Application hexagonal tests

**Exit:** Application depends on ports only.

**Phase 2 IDs:** T-006-201 … T-006-211

---

## Phase 3 — Persistence / history (NOT AUTHORIZED)

- [ ] **T-006-301** Local-authoritative Claim store
- [ ] **T-006-302** ClaimEvidenceLink store
- [ ] **T-006-303** Verification + append-only history stores
- [ ] **T-006-304** Evidence vault adapter behind EvidenceReader/Writer ports
- [ ] **T-006-305** Tenant-safe atomic persist (claim + link + history)
- [ ] **T-006-306** Idempotent register/verify commands
- [ ] **T-006-307** Actor/audit fields from trusted auth context
- [ ] **T-006-308** Infrastructure architecture tests

**Exit:** History append-only; LOCAL_AUTHORITATIVE. Firestore Claim rules = FUTURE / SPEC-009.

**Phase 3 IDs:** T-006-301 … T-006-308

---

## Phase 4 — Consumer / publication gate migration (NOT AUTHORIZED)

- [ ] **T-006-401** Migrate `saveContentWithClaimGate` to `AuthorizePublication`
- [ ] **T-006-402** Migrate Modals / ClaimSafetyPanel to Claim-status display (compatibility OK)
- [ ] **T-006-403** Migrate `ai.reviewDraftClaims` to advisory ExtractClaims projection (no AI Verification)
- [ ] **T-006-404** Demote `ContentItem.claimSafety` to COMPATIBILITY_ONLY projection
- [ ] **T-006-405** Preserve SPEC-003 `strategicBriefId` / version / evidence refs on ContentItem
- [ ] **T-006-406** Block gated status transitions without governed Claim set
- [ ] **T-006-407** Consumer architecture tests + migration matrix exit

**Exit:** Legacy claim-safety no longer authoritative for publication.

**Phase 4 IDs:** T-006-401 … T-006-407

---

## Phase 5 — Security / adversarial (NOT AUTHORIZED)

- [ ] **T-006-501** Architecture bans: Domain purity; no UI authorization from status alone
- [ ] **T-006-502** Cross-tenant evidence/claim/verification deny matrix
- [ ] **T-006-503** AI self-verification / spoof deny tests
- [ ] **T-006-504** Link tampering / stale contentHash / deleted evidence tests
- [ ] **T-006-505** Override abuse / hard-block non-override tests
- [ ] **T-006-506** Legacy bypass path static inventory = 0
- [ ] **T-006-507** SPEC-003 regression (Brief frozen contract)
- [ ] **T-006-508** SPEC-005 regression (no paid AI; advisory only)
- [ ] **T-006-509** SPEC-009 auth-claims suites unchanged (`posturaClaimsCore`, `firebaseClaims`)
- [ ] **T-006-510** Legacy claimSafety suites remain green or formally superseded

**Phase 5 IDs:** T-006-501 … T-006-510

---

## Phase 6 — Acceptance / CODE_COMPLETE (NOT AUTHORIZED)

- [ ] **T-006-601** Consolidate A1–A40 evidence matrix
- [ ] **T-006-602** `npm run check` PASS
- [ ] **T-006-603** `npm run test:rules` PASS
- [ ] **T-006-604** Human CODE_COMPLETE sign-off — **PENDING** (separate from T-006-010)
- [ ] **T-006-605** Confirm DEPLOYED/DONE remain NO / NOT_STARTED

**Phase 6 IDs:** T-006-601 … T-006-605

---

## Deployment (SEPARATE AUTHORIZATION — NOT STARTED)

- [ ] **D1** Remote persistence / rules plan with SPEC-009
- [ ] **D2** Production deploy authorization
- [ ] **D3** Post-deploy verification

**D1–D3 = PENDING_DEPLOYMENT_ONLY** · SPEC-009 PRODUCTION = **DEFERRED_UNCHANGED**

---

## Out of scope (explicit)

- SPEC-003 / 001 / 002 / 005 product changes
- SPEC-009 production rules / auth claims changes
- SPEC-004 Planner implementation
- Phase 1 start before T-006-010 approval
- Production evidence/claim backfill

---

## Deferred debt register (Phase 0)

| ID | Item | Status |
|----|------|--------|
| D-006-01 | Remote Firestore Claim/Evidence/Verification rules | **DEFERRED_TO_SPEC-009** |
| D-006-02 | New SPEC-005 AiOperations (`CLAIM_EXTRACT`, `EVIDENCE_SUGGEST`) | **PROPOSED_ONLY** — not authorized |
| D-006-03 | Historical content claim backfill | **OUT_OF_SCOPE** Phase 1–6 |
| D-006-04 | External verification provider | **OUT_OF_SCOPE** |
| D-006-05 | Rename legacy `claimSafety*` modules | **DEFERRED** (P3-006-01) — nonblocking |

---

## Task ID inventory (all newly authored)

```text
Phase 0:  T-006-001 … T-006-010
Phase 1:  T-006-101 … T-006-110
Phase 2:  T-006-201 … T-006-211
Phase 3:  T-006-301 … T-006-308
Phase 4:  T-006-401 … T-006-407
Phase 5:  T-006-501 … T-006-510
Phase 6:  T-006-601 … T-006-605
Deploy:   D1, D2, D3
```

**Total authored task IDs:** 10 + 10 + 11 + 8 + 7 + 10 + 5 = **61** (+ 3 deploy)
