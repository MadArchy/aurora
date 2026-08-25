# Claim model 006 — Evidence Claim Linking

**Authoritative data contract for SPEC-006 (Phase 0 design).**  
Physical persistence is Phase 3. This document defines Domain semantics.

**Constitution authority:** §9 Claim→Evidence→Verification→Source · §8 software governs · §17 PASS / REVIEW_REQUIRED / BLOCK.

---

## Terminology

| Term | Meaning |
|------|---------|
| **Claim** | Factual/assertive proposition in content (SPEC-006) |
| **Evidence** | Tenant-owned proof artifact supporting Claims |
| **Verification** | Authoritative evaluation record |
| **Source** | Provenance of Evidence |
| **auth claims** | SPEC-009 JWT/custom claims — **out of model** |

---

## Aggregate design

```text
ContentItem (existing — not owned by SPEC-006)
  └── Claim[] (aggregate roots scoped to contentId + contentHash/version)

Evidence (tenant vault entity — adapts EvidenceVaultItem)
  └── Source (value object / embedded entity)

ClaimEvidenceLink (association)
Verification (record attached to Claim or Claim+Link evaluation)
```

**Chosen:** Claim is aggregate root for claim lifecycle. Evidence is shared tenant entity (not nested exclusively under one Claim). Verification is append-friendly record with current projection on Claim.

---

## Claim — required fields

| Field | Type | Required | Rule |
|-------|------|----------|------|
| `id` | string | yes | system id |
| `organizationId` | string | yes | trusted tenant |
| `clientId` | string | yes | trusted tenant |
| `contentId` | string | yes | ContentItem id |
| `contentHash` | string | yes | body fingerprint; stale → reverify |
| `text` | string | yes | exact claim span / normalized proposition |
| `kind` | ClaimKind | yes | see kinds |
| `status` | ClaimStatus | yes | lifecycle |
| `thesisId` | string | optional | thesis context when evaluated |
| `strategicBriefId` | string | optional | provenance only |
| `strategicBriefVersion` | number | optional | provenance only |
| `createdAt` / `updatedAt` | ISO | yes | |
| `createdBy` | string | yes | trusted actor or `system:extractor` |
| `schemaVersion` | string | yes | e.g. `claim-v1` |
| `version` | number | yes | monotonic claim revision |

### ClaimKind (from legacy + constitution)

| Kind | Notes |
|------|-------|
| `CREDENTIAL` | Affiliation/role claims |
| `AWARD` | Rankings/awards |
| `METRIC` | Quantitative claims |
| `SUPERLATIVE` | Comparative superlatives |
| `GUARANTEE` | Outcome promises — typically HARD_BLOCKED |
| `HARD_BLOCK` | Thesis hard-limit hit |
| `OTHER` | Extensible with care |

Legacy patterns in `claimSafetyCore` inform extractors — Domain owns kinds.

### ClaimStatus

| Status | Publication gated exposure |
|--------|----------------------------|
| `DETECTED` | Internal OK |
| `EVIDENCE_REQUIRED` | **BLOCK** |
| `RESEARCH_REQUIRED` | **BLOCK** |
| `LINKED` | **BLOCK** until verified |
| `UNDER_REVIEW` | **BLOCK** until resolved |
| `VERIFIED` | **ALLOW** |
| `UNSUPPORTED` | **BLOCK** |
| `HARD_BLOCKED` | **BLOCK** (non-overridable) |
| `OVERRIDDEN` | **ALLOW** only with override audit |

---

## Evidence — required fields (adapt EvidenceVaultItem)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | |
| `organizationId` / `clientId` | string | yes | |
| `title` | string | yes | |
| `type` | EvidenceType | yes | existing enum |
| `snippet` | string | yes | |
| `source` | Source | yes* | *may be `UNKNOWN` typed with reason — prefer explicit |
| `confidenceScore` | number | yes | 0–100 data confidence |
| `authorityWeight` | number | optional | Evidence Authority input (§15) |
| `associatedThesesIds` | string[] | yes | may be empty |
| `supports` | string[] | optional | what it demonstrates |
| `createdAt` | ISO | yes | |

**Legacy `verified: boolean`:** demote to derived projection from Verification — do not treat boolean alone as Verification authority after Phase 1.

---

## Source — metadata (minimal)

| Field | Required | Notes |
|-------|----------|-------|
| `sourceUrl` | optional | |
| `publisher` | optional | |
| `sourceType` | optional | e.g. PRIMARY / SECONDARY / INTERNAL |
| `publishedAt` | optional | |
| `retrievedAt` | optional | |
| `jurisdiction` | optional | only if product needs |
| `reliabilityNote` | optional | human note — not AI authority |

**Non-goal:** generalized news Source Registry redesign (SPEC-007-ish). Source here = evidence provenance.

---

## ClaimEvidenceLink

| Field | Required |
|-------|----------|
| `id` | yes |
| `organizationId` / `clientId` | yes — must match Claim and Evidence |
| `claimId` / `evidenceId` | yes |
| `createdAt` / `createdBy` | yes |
| `note` | optional |

Cross-tenant link = **illegal**.

---

## Verification

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | |
| `claimId` | yes | |
| `organizationId` / `clientId` | yes | |
| `result` | yes | `PASS` \| `REVIEW_REQUIRED` \| `FAIL` \| `HARD_BLOCK` (align §17) |
| `claimStatusAfter` | yes | resulting ClaimStatus |
| `actorType` | yes | `SOFTWARE` \| `HUMAN` — never `AI` |
| `actorId` | yes | |
| `ruleId` / `ruleVersion` | yes | deterministic rule identity |
| `evidenceIds` | yes | ids considered |
| `summary` | yes | human-readable |
| `createdAt` | yes | |
| `contentHash` | yes | must match Claim |

AI suggestions may produce **proposed** draft evaluations via Application projection — **not** Verification records.

---

## EVIDENCE_REQUIRED

| Aspect | Spec |
|--------|------|
| Type | `ClaimStatus` |
| Trigger | Support required + no eligible tenant Evidence link |
| Exit | LinkEvidence → LINKED; or RESEARCH_REQUIRED; or claim removed |
| Gate | Blocks CLIENT_REVIEW / READY / PUBLISHED |
| UI | Show claim + action; cannot clear without Application |

---

## Evidence reuse

Same tenant: **allowed** across Claims / ContentItems / Briefs (as references).  
Cross-tenant: **forbidden**.

Brief `supportingEvidenceIds`: **references only**.

---

## Override

| Allowed | Forbidden |
|---------|-----------|
| VERIFIED-equivalent via OVERRIDDEN with audit for REVIEW/UNSUPPORTED soft cases | HARD_BLOCKED / thesis hard limits / GUARANTEE alwaysFlag without separate product policy |

Override fields: actor, reason, before/after, timestamp, tenant, claim version, content version.

---

## Explainability projection

Minimum reconstructable answer set — see `spec.md` Explainability section.

---

## Mapping from legacy ClaimSafetyReview

| Legacy | Target |
|--------|--------|
| `findings[].claim` | Claim.text |
| `findings[].kind` | Claim.kind |
| `findings[].severity BLOCK` | HARD_BLOCKED or UNSUPPORTED |
| `findings[].severity REVIEW` | EVIDENCE_REQUIRED / UNDER_REVIEW |
| `supportingEvidenceIds` | ClaimEvidenceLink candidates |
| `verdict PASS` | all Claims VERIFIED (or none detected) |
| `verdict REVIEW` | some UNDER_REVIEW / EVIDENCE_REQUIRED |
| `verdict BLOCK` | some HARD_BLOCKED / UNSUPPORTED |
| `thesis:proofPoints` sentinel | **REVISIT** — proofPoints are not Evidence; prefer EVIDENCE_REQUIRED or explicit INTERNAL source policy in Phase 1 |
