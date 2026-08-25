# Plan 006 — Evidence Claim Linking

| Field | Value |
|-------|--------|
| **Spec** | `006-evidence-claim-linking` |
| **Phase** | **Phase 0 COMPLETE** · **Phase 1 COMPLETE** · **Phase 2 COMPLETE** · Phase 3 **NOT_AUTHORIZED** · CODE_COMPLETE **NO** · DEPLOYED **NO** · DONE **NO** |
| **Status** | **`APPROVED`** (T-006-010) |
| **Strategy** | **Strangler / Incremental Migration** — **NO BIG-BANG REWRITE** |
| **Baseline SHA** | SPEC-003 CODE_COMPLETE `e16280607fa078941078d2cb4c233025a1bd66a1` |
| **Phase-0 governance checkpoint** | `d8fe981c1fc15f47fc7fdf6ef7ef0fae211a6fe5` |
| **Human approval checkpoint** | `1bc620b01e83410d2f5daea4f9ba35ecf6fd398d` |
| **Phase-1 frozen checkpoint** | `fe1fbc9225919a445eff9463492176356ab0a8f7` |
| **Branch** | `spec/006-evidence-claim-linking` |
| **Human SPEC approval** | **APPROVED** (T-006-010) — 2026-08-24 (America/Bogota) |
| **Approval text** | «Apruebo formalmente SPEC-006 — Evidence Claim Linking y autorizo el cierre de T-006-010 y el inicio de la Phase 1 de implementación.» |

---

## Why incremental

Working operational flows already exist:

- Evidence Vault (`EvidenceVaultItem`) with local persistence
- `claimSafetyCore.reviewClaims` pattern detection + vault token support
- `claimSafetyGateCore` publication transition gate
- UI Claim Safety panel + manager/client surfaces
- SPEC-003 Brief gate upstream (frozen) — claim verification remains downstream
- SPEC-005 drafts content and attaches advisory claim-safety snapshots

The debt is **missing formal Claim/Verification/Source model**, **no EVIDENCE_REQUIRED lifecycle**, **no requirement-traced Domain/Application hexagon**, and **legacy aggregate PASS/REVIEW/BLOCK as authority** — not absence of any publish protection.

Therefore:

1. Phase 0 — Inventory + formal SPEC package + gap matrix — **THIS PHASE**.
2. Phase 1 — Domain contracts (Claim, Evidence, Verification, Source, links, lifecycle).
3. Phase 2 — Application use cases + ports.
4. Phase 3 — Local-authoritative persistence + material history.
5. Phase 4 — Consumer / publication-gate migration (strangle legacy claim-safety authority).
6. Phase 5 — Security / adversarial regression.
7. Phase 6 — Acceptance evidence + human CODE_COMPLETE.
8. Deployment (D1–D3) — separate authorization; SPEC-009 production DEFERRED.

---

## Dependencies

| Dependency | State | Impact |
|------------|-------|--------|
| SPEC-003 Strategic Brief | **CODE_COMPLETE** @ `e162806` · **FROZEN** | **BOUNDARY** — consume Brief refs; must not mutate Brief/routing/scoring |
| SPEC-005 AI Gateway | **CODE_COMPLETE** | Advisory extraction/suggestion only; no new AiOperation in Phase 0 |
| SPEC-001 routing | **CODE_COMPLETE** | Thesis context read-only |
| SPEC-002 scoring | **CODE_COMPLETE** | No recomputation; no claim ownership |
| SPEC-009 security | **CODE_AVAILABLE**; production **DEFERRED** | NONBLOCKING for 006 CODE_COMPLETE (local authority) |
| SPEC-004 Planner | **NOT IMPLEMENTED** | Downstream consumer of gate; not required to start 006 |
| Legacy claim-safety | **PARTIAL** | **MIGRATE** via strangler — keep operational until Phase 4 |

Exit: no circular ownership with 001/002/003/005/009.

---

## Strangler target

```text
CURRENT (legacy):
  Content draft → ai.reviewDraftClaims → claimSafetyCore
    → ContentItem.claimSafety (PASS|REVIEW|BLOCK)
    → claimSafetyGateCore on CLIENT_REVIEW/READY/PUBLISHED

TARGET:
  StrategicBrief APPROVED → CONTENT_DRAFT (SPEC-005)
    → ExtractClaims / RegisterClaim
    → LinkEvidenceToClaim
    → VerifyClaim / RequireEvidence
    → AuthorizePublication (Claim statuses)
    → Compatibility projection optional during migration
```

Legacy modules remain **KEEP** until Phase 4 consumers migrate; then **ADAPT** → **DEPRECATE**.

---

## Phase plan

### Phase 0 — Inventory + formal package (DONE)

- Author governance docs
- Inventory legacy code/tests
- Define models, gates, boundaries, findings
- Human SPEC approval gate **DONE** (T-006-010)

**Exit:** Package complete · `APPROVED` · product code **unchanged** at approval checkpoint.

### Phase 1 — Domain (COMPLETE)

- Claim / Evidence / Verification / Source / ClaimEvidenceLink types
- ClaimStatus state machine + EVIDENCE_REQUIRED / RESEARCH_REQUIRED semantics
- Tenant invariants (pure)
- Publication eligibility predicates (pure)
- Override Domain invariants (non-overridable hard blocks)
- Domain unit + architecture tests — **28/28 PASS**

**Exit:** Domain tests PASS; no Firebase/db/React imports. **MET** · F-006-02 **RESOLVED**

### Phase 2 — Application (COMPLETE)

- Use cases T-006-201…208
- Ports T-006-209 (no Infrastructure adapters)
- TrustedActorContext + SOFTWARE authority non-spoofable
- Application hexagonal tests — **21/21 PASS**
- RUNTIME EXTRACTOR = **DEFERRED** (port only)

**Exit:** Application depends on ports only. **MET**

### Phase 3 — Persistence (NOT AUTHORIZED)

- Local-authoritative Claim / Verification / Link stores
- Evidence vault adaptation behind ports
- Append-only material history
- Idempotency for register/verify

**Exit:** History append tests; tenant isolation tests.

### Phase 4 — Consumer / gate migration

- Replace authoritative reliance on `ContentItem.claimSafety` aggregate
- Migrate `saveContentWithClaimGate` / `main.ts` / Modals paths
- Keep compatibility projection if needed
- Preserve SPEC-003 Brief refs on ContentItem

**Exit:** Ungated claim-bearing publication paths = 0.

### Phase 5 — Security / adversarial

- Foreign evidence / verification spoof / AI self-verify / UI mutation bans
- Cross-SPEC regressions (001/002/003/005/009 auth claims unchanged)

### Phase 6 — Acceptance

- A1–An evidence matrix
- Human CODE_COMPLETE (T-006-604)
- DEPLOYED/DONE remain separate

### Deployment (separate authorization)

- D1–D3 remote rules / production — **NOT** in Phase 0–6 CODE_COMPLETE requirement
- SPEC-009 PRODUCTION remains **DEFERRED_UNCHANGED** unless separately authorized

---

## Minimal canonical use cases (proposed — not implemented)

| Use case | Purpose |
|----------|---------|
| `ExtractClaims` | Deterministic (+ optional advisory AI) claim detection from content body |
| `RegisterClaim` | Persist/register a Claim against content revision |
| `LinkEvidenceToClaim` | Create tenant-safe ClaimEvidenceLink |
| `RequireEvidence` | Transition Claim → `EVIDENCE_REQUIRED` / `RESEARCH_REQUIRED` |
| `VerifyClaim` | Authoritative Verification (software/human) |
| `RejectClaimVerification` | Mark UNSUPPORTED / fail verification |
| `ReviewClaim` | Human UNDER_REVIEW workflow |
| `OverrideClaimGate` | Audited override (non-hard-block) |
| `AuthorizePublication` | Gate content status transition by Claim set |

**Not included without evidence of need:** external provider verify, bulk historical backfill, Brief approval use cases.

---

## Persistence strategy

| Phase | Authority |
|-------|-----------|
| 0–2 | Design only |
| 3–6 CODE_COMPLETE | **LOCAL_AUTHORITATIVE** |
| Production remote | **REMOTE_FUTURE** + SPEC-009 |

**Phase 3 physical keys (implemented):**

| Store | Key | Schema |
|-------|-----|--------|
| Claim current | `postura_claim_v1` | `claim-store-v1` |
| ClaimEvidenceLink | `postura_claim_link_v1` | `claim-link-store-v1` |
| Verification current | `postura_claim_verification_v1` | `claim-verification-store-v1` |
| ClaimEvidence local | `postura_claim_evidence_v1` | `claim-evidence-store-v1` |
| Material history | `postura_claim_history_v1` | `claim-history-store-v1` |
| Override audit | `postura_claim_override_v1` | `claim-override-store-v1` |

Evidence Vault (`postura_evidence_v5`) remains LEGACY source adapted via `LocalEvidenceVaultAdapter`.  
Local write-unit = coherent in-memory mutate + multi-key persist with snapshot rollback (not distributed TX).  
Local tamper resistance = structural validation only (**KNOWN_LIMITATION** vs threat-model; not SPEC-009).

---

## Risk register (Phase 0)

| ID | Risk | Mitigation |
|----|------|------------|
| R-006-01 | Big-bang rewrite of claimSafety | Strangler; keep 23 tests green |
| R-006-02 | Confusing SPEC-009 auth "claims" | Terminology ban in docs + architecture tests |
| R-006-03 | Treating Brief evidence IDs as verified | Explicit non-authority rule + tests |
| R-006-04 | AI self-approval | Ban AI as Verification actor |
| R-006-05 | Cross-tenant evidence | Tenant invariants Phase 1–5 |
| R-006-06 | Production rules pressure | Defer to SPEC-009; local authority OK |

---

## Findings carried into plan

| ID | Sev | Action |
|----|-----|--------|
| F-006-01 | P1 | **RESOLVED** Phase 0 |
| F-006-02 | P1 | **RESOLVED** Phase 1 Domain |
| P2-006-01 | P2 | Requirement IDs CLAIM-006-* — PARTIAL (authority migrated; legacy ID map open) |
| P2-006-02 | P2 | Architecture/security suite — **RESOLVED** Phase 5 |
| P3-006-01 | P3 | Canonical title in all new docs; legacy module names OK |

---

## Prohibited without separate authorization

- Product / test behavior changes in Phase 0
- SPEC-003 / 001 / 002 / 005 modifications
- SPEC-009 production changes
- Deploy / merge main / backfill
- Begin SPEC-004
- Mark T-006-010 DONE without human approval text
- Begin Phase 1 before T-006-010 **APPROVED**
