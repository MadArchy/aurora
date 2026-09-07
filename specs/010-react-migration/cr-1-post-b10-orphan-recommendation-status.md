# CR-1 Post-B10 — Orphan Recommendation Status Governance Disposition

**Class:** `GOVERNANCE_ONLY_RECONCILIATION`  
**Status:** `RECORDED`  
**Timezone:** America/Bogota  
**Starting checkpoint:** `baecc2f80d80041a621bebba2e4a508e83c688b9`

---

## Orphan identity

| Field | Value |
|-------|--------|
| **Classification** | `RESIDUAL_LEGACY_RECOMMENDATION_STATUS_PROJECTION_DEBT` |
| **Nature** | Nonauthoritative legacy denormalized presentation / compatibility projection |
| **Symbol** | `dbService.updateRecommendationStatus(id, status)` |
| **Definition** | `src/services/db.ts` — `public updateRecommendationStatus(id: string, status: Recommendation['status']): void` |
| **Production write location** | `src/ui/legacy/handlers/contentHandlers.ts` — path C after frozen #33 → frozen #27 |
| **Status value written** | `'CONVERTED_TO_TASK'` |
| **Persisted entity** | Legacy radar `Recommendation` (`src/types/index.ts`) |
| **Persisted store** | `postura_recommendations_v5` (localStorage) / Firestore `recommendations` subcollection via sync |

---

## Repository facts (reconfirmed read-only)

| Fact | Value |
|------|--------|
| Production callers of `updateRecommendationStatus` | **1** |
| Production writers of `CONVERTED_TO_TASK` | **1** |
| Authoritative reads of `Recommendation.status === 'CONVERTED_TO_TASK'` | **0** |
| Presentation reads of `CONVERTED_TO_TASK` | **0** |
| Hard business dependencies on this status | **0** |
| Domain transition authority for legacy `Recommendation.status` | **NONE** |
| Existing registry owner for status transition | **NONE** |
| Normative SPEC owner | **NONE** |

**Note:** This orphan concerns the **legacy radar** `Recommendation` entity only. It is **not** the SPEC-008 Learning Loop `StrategicRecommendation` (separate store, separate lifecycle, domain transitions in `recommendationLifecycleCore.ts`).

---

## Frozen boundary record

| Row | Relationship to orphan |
|-----|------------------------|
| **#22** | **PARTIAL** — owns legacy `addRecommendation` create persistence (Signal Intake compatibility advisory after SPEC-001 routing). Does **not** own Recommendation status lifecycle or `CONVERTED_TO_TASK` transition. |
| **#27** | **CANONICALIZED_AND_FROZEN** — `AssignClientTask` / `CancelClientTask` own Task assign/cancel. Do **not** own Recommendation mutation. |
| **#33** | **CANONICALIZED_AND_FROZEN** — `CreateContentDraft` owns ContentItem creation. Reads recommendation by id for generation inputs; does **not** mutate recommendation status. |

No new registry row is required for MVP authority completeness.

---

## Classification rationale

The orphan is **nonauthoritative projection/compatibility debt**:

- It persists a denormalized marker after a successful composite conversion (path C).
- **Zero** production code reads `CONVERTED_TO_TASK` for business decisions, UI filtering, routing, or gates.
- **No** hard business operation requires this status to locate Task, ContentItem, Brief, Signal, or DeliveryPackage.
- **No** Domain transition table governs legacy `Recommendation.status`.

### Exact Recommendation ↔ Task identity is NOT declared

Task/Content relationships demonstrate that the composite conversion operation occurred, but:

- `Task` has **no** `recommendationId` field.
- Linkage from Recommendation to Task is **indirect** (composite handler inputs + persisted Task fields such as `contentItemId`, `signalId`, `thesisId`, `strategicBriefId`).

Therefore **exact one-to-one derivation is NOT declared** as a normative identity rule. This clarification does **not** change the business-authority result.

---

## MVP authority state (formal)

| Metric | Value |
|--------|--------|
| MVP-REQUIRED REGISTRY TOTAL | **20** |
| MVP-REQUIRED CU? YES | **20** |
| MVP-REQUIRED CU? NO | **0** |
| **MVP REGISTRY AUTHORITY CANONICALIZATION** | **COMPLETE** |
| **MVP BUSINESS AUTHORITY CANONICALIZATION** | **COMPLETE** |
| RESIDUAL ORPHAN BUSINESS AUTHORITY | **0** |
| RESIDUAL LEGACY PROJECTION DEBT | **1** |

**Not declared:**

- `MVP CODE_COMPLETE` = NO  
- `SPEC-010 CODE_COMPLETE` = NO  

---

## T603 disposition (record only)

| Field | Value |
|-------|--------|
| **T603 PRECONDITION** | `READY_FOR_LEGACY_REMOVAL_REVIEW_WITH_PRESENTATION_COMPATIBILITY_DEBT` |
| **T603** | **NOT_AUTHORIZED** |

Future T603 legacy removal review must explicitly disposition this orphan among:

- **A.** Delete the orphan projection write; rely on canonical Task/Content authority without preserving `Recommendation.status`.
- **B.** Retain temporarily as legacy compatibility debt during presentation cutover.
- **C.** Separately govern/canonicalize the status later (would require human approval for new registry/Application authority — not required for MVP completeness).

**No choice is authorized in this governance task.**

---

## Global Phase 6 debt (unchanged)

| Scope | P0 | P1 | P2 |
|-------|----|----|-----|
| **GLOBAL SPEC-010 / Phase 6** | **0** | **0** | **3** |

---

## Regression (not re-executed)

Governance-only reconciliation. Accepted B10 evidence preserved:

| Gate | Result |
|------|--------|
| B10 | 25/25 PASS |
| Execution Delivery | 108/108 PASS |
| B9 | 18/18 PASS |
| Role/reachability | 12/12 PASS |
| T508 | 10/10 PASS |
| Playwright | 21/21 PASS |
| Full | 2192/2192 PASS |
| Rules | 91/91 PASS |
| Build | PASS |

**NOT RE-EXECUTED — GOVERNANCE ONLY.**

---

## Next action

`CR1_T603_LEGACY_REMOVAL_REVIEW` — read-only reassessment of global legacy rollback architecture, React/legacy presentation gaps, candidate module deletion, orphan recommendation status projection, progressive host cutover, and rollback guarantees. **No deletion in this governance task.**
