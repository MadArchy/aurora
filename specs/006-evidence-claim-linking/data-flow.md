# Data flow 006 — Evidence Claim Linking

---

## A. End-to-end strategic → claim → publish

```text
Signal
  → SPEC-001 routing (CLEAR + selectedThesisId)
  → SPEC-002 scoring
  → SPEC-003 StrategicBrief APPROVED
       (supportingEvidenceIds = REFERENCES ONLY)
  → SPEC-005 CONTENT_DRAFT (advisory body)
  → SPEC-006 ExtractClaims / RegisterClaim
  → LinkEvidenceToClaim (tenant-safe Evidence + Source)
  → VerifyClaim | RequireEvidence | ReviewClaim
  → AuthorizePublication
  → Content status CLIENT_REVIEW / READY / PUBLISHED
```

**Fail-closed:** gated exposure without VERIFIED/OVERRIDDEN claim set.

---

## B. Legacy current flow (KEEP until Phase 4)

```text
Content body + thesis + EvidenceVault(client)
  → claimSafetyCore.reviewClaims
       (regex ClaimKind detection)
       (token overlap vs verified EvidenceVaultItem + thesis proofPoints)
  → ClaimSafetyReview { PASS | REVIEW | BLOCK, findings[] }
  → ai.reviewDraftClaims → ClaimSafetyVerdictRecord on ContentItem
  → claimSafetyGateCore.assertClaimSafeTransition
       for target ∈ { CLIENT_REVIEW, READY, PUBLISHED }
  → saveContentWithClaimGate (main.ts)
```

**Gaps vs constitution:** no Claim entity; no Verification; no Source chain; no EVIDENCE_REQUIRED state; proofPoints sentinel; Brief evidence IDs unused by claimSafetyCore.

---

## C. Target Claim evaluation flow

```text
ContentItem (revision N, contentHash H)
  → ExtractClaims (deterministic patterns ± advisory AI suggestion)
  → RegisterClaim(s) status=DETECTED
  → for each Claim:
       if needs support and no eligible Evidence:
         RequireEvidence → EVIDENCE_REQUIRED | RESEARCH_REQUIRED
       else:
         LinkEvidenceToClaim → LINKED
         VerifyClaim → VERIFIED | UNSUPPORTED | HARD_BLOCKED
  → AuthorizePublication(contentId, targetStatus, actor)
```

---

## D. Evidence / Source flow

```text
EvidenceVaultItem (LEGACY) ──map──► ClaimEvidence (TARGET)
  ├── organizationId, clientId
  ├── title, type, snippet, supports[]
  ├── verified flag (LEGACY) → IGNORED (never Verification authority)
  └── Source { url?, publisher?, type?, retrievedAt?, … }
        ↑
ClaimEvidenceLink (claimId, evidenceId, tenant, createdBy, createdAt)
        ↑
ClaimVerification (current store) + ClaimHistory (append-only; audit only)
```

One Evidence → many Claims (same tenant).  
Brief `supportingEvidenceIds` → candidate IDs for linking — **not** auto-VERIFIED.  
Vault presence / `verified: true` → **does not** create Verification or authorize publication.

### Phase 3 persistence (LOCAL_AUTHORITATIVE)

```text
ClaimWriteUnit
  → LocalClaimEvidenceStore.commitWriteUnit
       (claims + links + verifications + history + override)
  → versioned localStorage keys (postura_claim_*_v1)
  → ClaimHistoryPort.append (idempotent re-append)
```

Current Claim/Verification projections are authority for Application reload.  
History / prior PUBLICATION_AUTHORIZED events are **audit only**.

---

## E. Gate points

| Gate | Owner | Rule |
|------|-------|------|
| Strategic downstream create | SPEC-003 | Approved Brief required |
| AI draft | SPEC-005 | Advisory; may attach claim projection |
| Claim publication | SPEC-006 | Claim statuses authorize exposure |
| Auth / Firestore rules | SPEC-009 | Production DEFERRED |

Legacy gate statuses: `CLIENT_REVIEW`, `READY`, `PUBLISHED` — preserved as gated set unless product change authorized.

---

## F. What does NOT flow through SPEC-006

- Brief approval / rejection / override (SPEC-003)
- Thesis selection / routing mutation (SPEC-001)
- Score recomputation (SPEC-002)
- Firebase custom auth claims provisioning (SPEC-009)
- AI model registry / provider secrets (SPEC-005)

---

## G. Traceability fields on ContentItem (consume, do not redefine)

| Field | Role for SPEC-006 |
|-------|-------------------|
| `strategicBriefId` | Provenance — Brief that authorized creation |
| `strategicBriefVersion` | Version pin |
| `signalIds` | Upstream signal provenance |
| `supportingEvidenceIds` | Brief-copied **references** — not verification |
| `claimSafety` | **LEGACY** aggregate projection — demote Phase 4 |

---

## H. Error / deny flows (design)

| Condition | Result |
|-----------|--------|
| Foreign evidenceId | `EVIDENCE_TENANT_MISMATCH` — deny link/verify |
| Missing claim review on gated transition | Deny (legacy: missing claimSafety) |
| Any Claim `EVIDENCE_REQUIRED` on gated target | Deny |
| Any Claim `HARD_BLOCKED` | Deny (non-overridable) |
| AI attempts Verification write | Deny |
| Brief evidence IDs without ClaimEvidenceLink | Not sufficient for VERIFIED |

---

## I. SPEC-004 handoff (documentation only)

Planner / content execution consumes:

- Brief authorization (SPEC-003)
- Claim publication authorization (SPEC-006)

SPEC-006 owns claim verification; SPEC-004 must not invent a parallel claim gate.
