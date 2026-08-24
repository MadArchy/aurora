# Migration matrix 003 — Strategic Brief

**Rule:** Classify every strategic-authority and bypass path before migration.  
Phase 0 inventory: 2026-08-24.

---

## Classification legend

| Class | Meaning |
|-------|---------|
| **STRATEGIC_AUTHORITY** | Currently acts as decision/brief substitute — must migrate |
| **COMPATIBILITY_ONLY** | Retained during strangler; demoted from authority |
| **OPERATIONAL** | Non-strategic workflow — keep with clarified role |
| **DOWNSTREAM** | Consumer to gate with `strategicBriefId` |
| **BYPASS** | Violates Brief gate — must block or require override |
| **OTHER_SPEC** | Owned elsewhere |
| **PRESENTATION_ONLY** | Display — no authority |

| Migration action | Meaning |
|------------------|---------|
| **MIGRATE** | Wire to Brief gate / carry strategicBriefId |
| **DEPRECATE** | Mark legacy; no new strategic use |
| **COMPATIBILITY_ONLY** | Transitional dual-read |
| **KEEP** | Unchanged role |
| **REMOVE_LATER** | Delete after migration window |
| **BLOCK** | Fail closed in Phase 4 |
| **OTHER_SPEC** | Not SPEC-003 owned |

---

## Strategic authority substitutes (P1)

| Location | Phase 0 class | Target action | Closure phase |
|----------|---------------|---------------|---------------|
| `CurationEntry.destination` | **STRATEGIC_AUTHORITY** | **COMPATIBILITY_ONLY** → intake only | Phase 4 |
| `DeliveryPackage.strategicNote` | **STRATEGIC_AUTHORITY** | **DEPRECATE** as decision | Phase 4 |
| `CurationEntry.aiAngle` | **STRATEGIC_AUTHORITY** (de facto) | **MIGRATE** → Brief.strategicAngle | Phase 4 |
| Absent `StrategicBrief` | **MISSING** | **MIGRATE** — new entity | Phase 1–3 **IMPLEMENTED_BEFORE_CONSUMER_MIGRATION** |

---

## Signal fields (clarify roles)

| Field | Phase 0 | Target |
|-------|---------|--------|
| `Signal.managerDecision` | Radar triage | **KEEP** — **OPERATIONAL** — not Strategic Decision |
| `recommendedDisposition` | SPEC-002 input | **KEEP** — consumed by Brief snapshot |
| `recommendedOutputFormat` | SPEC-002 input | **KEEP** — consumed by Brief snapshot |
| `recommendedAction` (legacy) | Mixed enum on curation | **DEPRECATE** on strategic paths |
| `thesisId` on Signal | SPEC-001 projection | **KEEP** — read via ContextReader only |
| `routingDecision` | SPEC-001 | **OTHER_SPEC** — read only |

---

## Bypass paths (F-003-02)

| Location | Phase 0 | Target | Phase |
|----------|---------|--------|-------|
| `main.ts` `form-generate-content` | **BYPASS** | **BLOCK** or require Brief | Phase 4 |
| `main.ts` `.btn-generate-scientific-article` | **BYPASS** | **BLOCK** or require Brief | Phase 4 |
| `main.ts` `.btn-create-task-from-rec` | **BYPASS** | **BLOCK** or require Brief | Phase 4 |
| `main.ts` `sendDelivery` | **BYPASS** (no Brief) | **MIGRATE** — require strategicBriefId | Phase 4 |
| Manual task form (non-strategic) | **OPERATIONAL** | **KEEP** — exclude from Brief requirement | — |

---

## Curation / delivery flow

| Location | Phase 0 | Target | Phase |
|----------|---------|--------|-------|
| `main.ts` `.btn-send-to-curation` | Pre-Brief intake | **MIGRATE** → create Brief draft or queue | Phase 4 |
| `dbService.addToCuration` | Creates CurationEntry | **COMPATIBILITY_ONLY** | Phase 4 |
| `main.ts` `queueCurationInBriefing` | Delivery packaging | **MIGRATE** — link Brief | Phase 4 |
| `main.ts` `bindCuration` / decide destination | Operational decision | **MIGRATE** → feeds Brief, not authority | Phase 4 |
| `deliveryCore.validateDeliveryForSend` | Single-thesis check | **MIGRATE** — per-item Brief ref (P2) | Phase 4 |
| `dbService.markDeliverySent` | Marks CONVERTED | **KEEP** with Brief linkage audit | Phase 4 |

---

## Downstream persistence

| Location | Phase 0 | Target | Phase |
|----------|---------|--------|-------|
| `dbService.saveContent` | No briefId | **MIGRATE** — strategicBriefId | Phase 4 |
| `dbService.addTask` | Optional curationEntryId | **MIGRATE** — strategicBriefId for strategic tasks | Phase 4 |
| `dbService.addOpportunity` | No briefId | **MIGRATE** — strategicBriefId | Phase 4 |
| `aiService.generateContentDraft` | Pre-gate AI | **MIGRATE** — post-Brief-approve only (strategic) | Phase 4 |
| `advisor.proposeAngle` | Thesis fallback heuristic | **MIGRATE** — require Brief/thesis context | Phase 4 |

---

## AI / claim boundaries

| Location | Owner | SPEC-003 action |
|----------|-------|-----------------|
| `contentDraftGateway` | SPEC-005 | **KEEP** — downstream of gate |
| `advisorGateway` ADVISOR_CURATION_ANGLE | SPEC-005 | **KEEP** — advisory to Brief draft |
| `claimSafetyCore` | SPEC-006 | **OTHER_SPEC** — unchanged |
| `claimSafetyGateCore` | SPEC-006 | **OTHER_SPEC** — unchanged |

---

## Architecture / orchestration

| Location | Phase 0 | Target |
|----------|---------|--------|
| `main.ts` Brief orchestration | Monolith | **REMOVE_LATER** — Application use cases |
| `db.ts` curation/delivery | Direct mutations | **COMPATIBILITY_ONLY** — adapter behind ports |

---

## P2 debt rows

| ID | Item | Target | Phase |
|----|------|--------|-------|
| P2-003-01 | Curation/Brief naming collision | Document + UX rename where needed | Phase 4 |
| P2-003-02 | CONTESTED/UNROUTED fail-open in curation | Brief routing gate on create | Phase 2–4 |
| P2-003-03 | `proposeAngle` thesis fallback | Fail-closed without thesis/Brief | Phase 4 |
| P2-003-04 | Single-thesis delivery validation | Per-item Brief authorization | Phase 4 |
| P2-003-05 | Evidence ID loss | `supportingEvidenceIds` on Brief | Phase 1–3 **PARTIAL_PERSISTENCE** (consumer carry Phase 4) |

---

## Override (F-003-03)

| Item | Phase 0 | Target |
|------|---------|--------|
| Silent bypass | **MISSING** | **BLOCK** all strategic bypass |
| Auditable override | **MISSING** | **MIGRATE** — `OverrideStrategicBrief` + history | Phase 2–3 **IMPLEMENTED_AUDIT_PERSISTENCE** |

---

## SPEC-004 / SPEC-006

| Spec | Migration |
|------|-----------|
| SPEC-004 Planner | **DOWNSTREAM** — consume strategicBriefId (future) |
| SPEC-006 Claims | **OTHER_SPEC** — no change to claim verification |

---

## Exit criteria (Phase 4)

- Zero **BYPASS** rows remain **BYPASS** on strategic paths
- All **STRATEGIC_AUTHORITY** substitutes **MIGRATED** or **DEPRECATED**
- `strategicBriefId` on strategic Content/Task/Opportunity
- CurationEntry/DeliveryPackage demoted to **COMPATIBILITY_ONLY** / delivery packaging
