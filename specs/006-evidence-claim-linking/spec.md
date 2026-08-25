# Spec 006 — Evidence Claim Linking

| Field | Value |
|-------|--------|
| **Spec ID** | `006-evidence-claim-linking` |
| **Display name** | **SPEC-006 — Evidence Claim Linking** |
| **Status** | **`READY_FOR_HUMAN_APPROVAL`** (Phase 0 package authored 2026-08-24) |
| **Phase** | Phase 0 **COMPLETE** (governance / discovery only) · Implementation **NOT_AUTHORIZED** |
| **Branch** | `spec/006-evidence-claim-linking` |
| **Baseline SHA** | SPEC-003 CODE_COMPLETE `e16280607fa078941078d2cb4c233025a1bd66a1` |
| **Priority** | P1 (constitution §9 Evidence before Claim · §17 Risk & professional safety) |
| **Constitution** | §8 AI suggests / software governs · §9 Claim→Evidence→Verification→Source · §10 Explainable intelligence · §14 Provenance · §17 Hard/Soft limits |
| **Depends on** | SPEC-003 (CODE_COMPLETE — Brief gate upstream, frozen); SPEC-005 (CODE_COMPLETE — advisory AI); SPEC-001/002 (CODE_COMPLETE — thesis/routing/scoring context); SPEC-009 (CODE_AVAILABLE; production DEFERRED) |
| **Blocks** | Governed publication of claim-bearing content; SPEC-004 adjacent planner/content publish paths that require verified claims |
| **Test baseline (Phase 0)** | `npm run check` → **844/844**; `npm run test:rules` → **91/91**; legacy claim suites **23/23** |
| **Human SPEC approval** | **PENDING** (T-006-010) |

---

## Critical terminology separation

| Term | Authority | Meaning |
|------|-----------|---------|
| **Claim** (SPEC-006) | This spec | A factual/assertive proposition inside strategic or content output that requires evidence-backed verification before publication exposure |
| **claims** (SPEC-009) | SPEC-009 | Authentication / authorization token claims (`role`, `organizationId`, `clientId`) |

These are **completely different** authorities. No shared domain model merely because both use the word "claim".

`posturaClaimsCore.ts` / `firebase/claims.ts` = **OTHER_SPEC (SPEC-009)** — not SPEC-006.

---

## Problem

POSTURA has a **partial legacy Claim Safety engine** but does **not** implement the constitutional Claim→Evidence→Verification→Source model.

**Bad:**

- No formal `Claim`, `Verification`, or governed `Source` entities.
- `claimSafetyCore.reviewClaims` is regex-pattern detection + token overlap against `EvidenceVaultItem` — not a claim lifecycle.
- No `EVIDENCE_REQUIRED` / `RESEARCH_REQUIRED` claim states (constitution §9).
- Findings are ephemeral strings on `ClaimSafetyVerdictRecord` — not first-class Claims with provenance.
- `EvidenceVaultItem.verified` is a boolean flag without Verification record, actor, rule version, or Source chain.
- `StrategicBrief.supportingEvidenceIds` are **references**, not proof that downstream content claims are verified.
- Thesis `proofPoints` can satisfy support without vault Evidence (`thesis:proofPoints` sentinel).
- Publication gate (`claimSafetyGateCore`) uses aggregate PASS/REVIEW/BLOCK — not claim-state semantics.
- No SPEC-006 governance package existed before Phase 0 (finding F-006-01).
- No dedicated SPEC-006 architecture/security suite (finding P2-006-02).
- Functional naming ("claim safety") drifts from canonical title `006-evidence-claim-linking` (P3-006-01).

**Good:**

- SPEC-003 CODE_COMPLETE — Brief authorization precedes strategic content; does **not** verify claims.
- Evidence Vault (`EvidenceVaultItem`) exists with tenant envelope and local persistence.
- Legacy `claimSafetyCore` + `claimSafetyGateCore` provide operational publish protection (23 tests PASS).
- SPEC-005 Gateway drafts content and may attach advisory claim-safety snapshots without AI self-approval.

---

## Goal

SPEC-006 establishes the **authoritative Claim ↔ Evidence ↔ Verification ↔ Source** governance for POSTURA content publication.

It answers:

> **Are the factual claims in this content supported by tenant-owned evidence, verified under governed rules, and safe to expose or publish?**

SPEC-006 does **not** answer:

> **Which thesis should this signal belong to?** (SPEC-001)  
> **How important is this signal?** (SPEC-002)  
> **What strategic action is authorized?** (SPEC-003)  
> **Which AI model drafts the text?** (SPEC-005)  
> **How are Firebase auth claims / production rules enforced?** (SPEC-009)

---

## Strategic circuit position

```text
Signal
  → Strategic Signal Routing          ← SPEC-001 (CODE_COMPLETE)
  → Strategic Scoring                 ← SPEC-002 (CODE_COMPLETE)
  → Strategic Decision / Brief        ← SPEC-003 (CODE_COMPLETE · FROZEN)
  → Planner / Content / Opportunity   ← SPEC-004 / adjacent (future)
  → CONTENT_DRAFT (advisory)          ← SPEC-005 (CODE_COMPLETE)
  → Claim / Evidence / Verification   ← SPEC-006 (this spec)
  → Publication exposure              ← SPEC-006 gate
```

---

## Scope

In scope:

- Formal **Claim** aggregate (content-linked factual propositions)
- **Evidence** entity governance (migrate/adapt from `EvidenceVaultItem`)
- **Verification** record (who/what/when/rule/result)
- **Source** identity metadata for evidence provenance
- **ClaimEvidenceLink** (explicit Claim↔Evidence association)
- Claim lifecycle including **EVIDENCE_REQUIRED** and related states
- Publication gate semantics replacing/adapting legacy claim-safety gate
- Tenant isolation invariants (org/client)
- Evidence reuse policy within tenant
- Application use cases + ports (planned)
- Hexagonal Domain / Application / Infrastructure boundaries
- Strangler migration off legacy `claimSafetyCore` / `claimSafetyGateCore` as authority
- Architecture bans / acceptance criteria
- Material history / audit / override contract (designed; implemented later)
- Explainability reconstruction requirements

Out of scope — see **Non-Goals**.

---

## Non-Goals

SPEC-006 does **not** include:

- Strategic Brief redesign or mutation (SPEC-003 **FROZEN**)
- Routing / scoring changes (SPEC-001 / SPEC-002 **FROZEN**)
- New AI providers or new `AiOperation` in Phase 0 (SPEC-005 boundary)
- SPEC-009 production deploy, rules rewrite, or auth-claims changes
- SPEC-004 Planner implementation
- Generalized news-source discovery redesign (Source is claim-evidence provenance only)
- Production backfill of historical content claims
- Crypto-tamper / remote attestation claims
- Authority Score redesign (constitution §15 — Evidence Authority may be *consumed*, not redefined)

---

## Constitutional requirements (canonical)

From `docs/architecture/POSTURA_CONSTITUTION.md`:

| § | Requirement | SPEC-006 implication |
|---|-------------|----------------------|
| §8 | AI suggests; software governs | AI may extract/suggest; cannot set authoritative Verification |
| §9 | Claim → Evidence → Verification → Source | Core domain chain |
| §9 | Missing evidence → `EVIDENCE_REQUIRED` or `RESEARCH_REQUIRED` | Claim / gate semantics |
| §10 | Explainable / auditable decisions | Reconstruct claim decision trail |
| §12 | Brief `supportingEvidenceIds` | Upstream **references only** — not verification |
| §14 | Provenance (declared vs inferred) | Claim/evidence origin must be explicit |
| §15 | Evidence Authority | Consume vault strength metadata; do not invent new score authority |
| §17 | Hard/Soft limits; unsupported claims; PASS / REVIEW_REQUIRED / BLOCK | Gate outcomes aligned |

Baseline audit (`docs/audits/BASELINE_CONSTITUTION_AUDIT.md`) marks §9 **PARTIAL**: Claim Safety exists; formal Claim lifecycle / `EVIDENCE_REQUIRED` **missing**.

---

## Domain model (Phase 0 design — not implemented)

See `claim-model.md` for field-level contracts.

### Aggregates / entities (minimal canonical set)

| Concept | Kind | Role |
|---------|------|------|
| **Claim** | Aggregate root (content-scoped) | Factual proposition extracted/registered from content |
| **Evidence** | Entity (tenant vault) | Reusable proof artifact (adapt `EvidenceVaultItem`) |
| **Source** | Value object / entity | Provenance of Evidence (URL, publisher, type, retrievedAt, …) |
| **Verification** | Entity / record | Authoritative evaluation of Claim (or Claim+Evidence link) |
| **ClaimEvidenceLink** | Association | Explicit Claim↔Evidence link with tenant + provenance |

**Not invented without constitution support:** separate EvidenceQuality aggregate, external VerificationProvider entity, multi-tenant Source catalog.

### Claim lifecycle (canonical)

| State | Meaning | Publication exposure |
|-------|---------|----------------------|
| `DETECTED` | Identified in content; not yet assessed | Internal draft OK |
| `EVIDENCE_REQUIRED` | No adequate Evidence linked | Blocks gated exposure |
| `RESEARCH_REQUIRED` | Needs further research before link/verify | Blocks gated exposure |
| `LINKED` | Evidence linked; verification pending | Blocks unless soft-review path |
| `UNDER_REVIEW` | Human review in progress | Blocks gated exposure until resolved |
| `VERIFIED` | Authoritative Verification = PASS | May allow gated exposure |
| `UNSUPPORTED` | Verification failed / rejected | Blocks gated exposure |
| `HARD_BLOCKED` | Hard-limit / always-flag (e.g. guarantee) | Always blocks |
| `OVERRIDDEN` | Human override with audit | Allowed only with override record |

Initial state after extraction: **`DETECTED`**. Missing support → **`EVIDENCE_REQUIRED`** (default) or **`RESEARCH_REQUIRED`** when constitution/product marks research path.

### EVIDENCE_REQUIRED semantics

| Aspect | Definition |
|--------|------------|
| **What it is** | A **ClaimStatus** (not merely a gate reason string) |
| **Triggers** | Claim of kind requiring support has zero tenant-valid Evidence links; or links exist but Evidence fails eligibility |
| **Exits** | Successful `LinkEvidenceToClaim` → `LINKED`; or human marks `RESEARCH_REQUIRED`; or claim removed/superseded |
| **Publication** | Target statuses in `CLAIM_GATED_STATUSES` (CLIENT_REVIEW / READY / PUBLISHED) **FAIL_CLOSED** |
| **UI** | Surface claim text, required action, empty evidence list — display only; UI cannot clear status |

`RESEARCH_REQUIRED` = claim needs investigation beyond existing vault (distinct from "evidence exists but not linked").

### Verification authority

| Actor | May suggest | May set authoritative status |
|-------|-------------|------------------------------|
| Deterministic software (Domain rules) | — | **YES** (primary) |
| Human reviewer (trusted actor) | — | **YES** (review / override) |
| AI (SPEC-005) | **YES** | **NO** |
| External provider | Future / out of scope Phase 0 | **NO** unless separately authorized |

**AI SUGGESTS · SOFTWARE GOVERNS.** No AI self-verification.

### Evidence reuse

Within the **same** `organizationId` + `clientId`:

- One Evidence **MAY** support multiple Claims
- One Evidence **MAY** appear on multiple ContentItems / Briefs as a **reference**
- Provenance of each ClaimEvidenceLink remains claim-specific
- **Cross-tenant reuse = FORBIDDEN**

### Brief / Content relationship

```text
StrategicBrief APPROVED (SPEC-003)
  → CONTENT_DRAFT via SPEC-005 (advisory)
  → Extract/Register Claims (SPEC-006)
  → Link Evidence → Verify
  → AuthorizePublication / gate (SPEC-006)
```

- Brief `supportingEvidenceIds` = candidate/reference IDs only
- ContentItem may carry `strategicBriefId`, `strategicBriefVersion`, `supportingEvidenceIds` as **traceability**, not verification
- SPEC-006 **SHALL NOT** approve/reject Brief, select thesis, or mutate routing/scoring

---

## Publication gate (design)

Legacy: `assertClaimSafeTransition` on aggregate `ClaimSafetyVerdictRecord`.

Target: Application `AuthorizePublication` (name TBD in Phase 2) evaluates **Claim statuses** for the content revision:

| Content target | Allowed when |
|----------------|--------------|
| Draft / internal edit | Always (claims may be DETECTED / EVIDENCE_REQUIRED) |
| Manager review (non-client) | Soft — REVIEW/UNDER_REVIEW may proceed with ack policy |
| `CLIENT_REVIEW` / `READY` / `PUBLISHED` | All claim-bearing assertions **VERIFIED** or **OVERRIDDEN** (audited); none in EVIDENCE_REQUIRED / UNSUPPORTED / HARD_BLOCKED |

Legacy PASS/REVIEW/BLOCK maps as **compatibility projection** until Phase 4 migration completes.

---

## Upstream / cross-SPEC boundaries

### SPEC-003 (FROZEN)

**Consume:** `strategicBriefId`, `strategicBriefVersion`, `supportingEvidenceIds`, `signalIds`, content context.

**Must not:** approve/reject/revise Brief; modify Brief; modify routing/scoring; select thesis; create strategic authorization.

**Contract conflict:** **NONE** (Phase 0).

### SPEC-005

AI may assist claim **extraction**, **classification**, **evidence suggestion** — advisory only.

No new `AiOperation` in Phase 0. Proposed future operations (documentation only): `CLAIM_EXTRACT`, `EVIDENCE_SUGGEST` — require separate SPEC-005 coordination if authorized later.

**Contract conflict:** **NONE**.

### SPEC-009

Owns production security, Firestore/Storage rules, auth claims, backup, production tenant enforcement.

SPEC-006 Phase 0–CODE_COMPLETE may use **LOCAL_AUTHORITATIVE** persistence (same pattern as SPEC-003). Remote rules = **DEPLOYMENT_ONLY / DEFERRED_UNCHANGED**.

**SPEC-009 PRODUCTION = DEFERRED_UNCHANGED.**

### SPEC-001 / SPEC-002

Thesis context for claim evaluation (hard blocks, proof points, thesis association). Read-only consumption. No mutation.

---

## Tenant model

Every Claim / Evidence / Verification / Source / ClaimEvidenceLink carries or inherits:

- `organizationId`
- `clientId`

**Invariants:**

1. Foreign Evidence cannot verify local Claim
2. Foreign Claim cannot link into local Content
3. Foreign Verification cannot authorize local publication
4. Tenant-private Source metadata must not leak across tenants
5. Brief evidence refs outside tenant → reject at link/verify time

---

## Persistence authority (Phase 0 classification)

| Store / shape | Classification |
|---------------|----------------|
| `EvidenceVaultItem` in `db.ts` / `postura_evidence_v5` | **LEGACY** → **MIGRATE** to Evidence under SPEC-006 ports |
| `ContentItem.claimSafety` | **LEGACY** compatibility projection |
| Formal Claim / Verification / ClaimEvidenceLink stores | **MISSING** → Phase 3 **LOCAL_AUTHORITATIVE** |
| Remote Firestore Claim/Evidence rules | **REMOTE_FUTURE** / SPEC-009 |
| Auth custom claims | **OTHER_SPEC** (SPEC-009) |

---

## Material history / audit

Required (design): append-only history for:

- Verification result changes
- ClaimEvidenceLink add/remove
- Claim status transitions
- Source material changes on Evidence
- Human override
- Publication authorization decisions

Minimum audit fields: actor, tenant, timestamp, before/after, reason, contentId, claimId, version.

---

## Override

Human override **permitted** for publication-blocking claims **except** hard thesis limits / `HARD_BLOCKED` kinds that Domain marks non-overridable.

Required future fields: trusted actor, reason, before/after, timestamp, tenant, claim version, content version. **No silent verification bypass.**

---

## Explainability

SPEC-006 must reconstruct:

1. What claim was evaluated?
2. What evidence supported it?
3. What source did the evidence come from?
4. Who/what verified it?
5. What rule/result was applied?
6. Why is publication allowed or blocked?
7. Was there human override?
8. What version was used?

No hidden chain-of-thought requirement.

---

## Security / threat model

See `threat-model.md`. Threats include: foreign evidence injection, fake source identity, link tampering, verification spoofing, AI self-verification, stale evidence, deleted source, unsupported claim publication, cross-tenant leakage, legacy bypass, direct UI status mutation.

---

## Findings baseline (Phase 0)

| ID | Sev | Finding | Status after Phase 0 |
|----|-----|---------|----------------------|
| **F-006-01** | P1 | No SPEC-006 governance package | **RESOLVED** by Phase 0 package |
| **F-006-02** | P1 | Constitutional Claim→Evidence→Verification→Source model missing in code | **OPEN** — implementation |
| **P2-006-01** | P2 | Legacy claim-safety lacks formal requirement traceability | **OPEN** — Domain phase |
| **P2-006-02** | P2 | No dedicated SPEC-006 architecture/security suite | **OPEN** — Phase 5 |
| **P3-006-01** | P3 | Naming alias drift ("claim safety" vs `006-evidence-claim-linking`) | **OPEN** — nonblocking; docs use canonical title |

**P0 = 0** · **P1 open = 1** (F-006-02) · **P2 = 2** · **P3 = 1**

---

## Implementation authorization

| Gate | State |
|------|-------|
| Phase 0 governance | **COMPLETE** (this package) |
| Human SPEC approval (T-006-010) | **PENDING** |
| Implementation | **NOT_AUTHORIZED** |
| Deployment | **NOT_STARTED** |
| DONE | **NO** |

**Next action:** Human SPEC approval → status `APPROVED` → Phase 1 Domain may be authorized separately.
