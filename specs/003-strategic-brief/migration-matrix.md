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
| `thesisId` on Signal | SPEC-001 compatibility projection | **COMPATIBILITY_ONLY** — not SPEC-003 authority |
| `routingDecision.selectedThesisId` | SPEC-001 CLEAR identity | **AUTHORITATIVE** — consumed by Brief |
| `CurationEntry.thesisId` | Legacy display | **COMPATIBILITY_ONLY** — not strategic authority |
| `CurationEntry.strategicBriefId` | Brief reference | **MIGRATED** — link only, not authority |
| `DeliveryPackage.strategicNote` | Was de-facto authority | **DEPRECATED** — not used for authorization |
| `DeliveryItem.strategicBriefId` | Per-item Brief ref | **MIGRATED** — required for strategic send |
| `form-generate-content` | Direct AI content | **MIGRATED** — requires APPROVED Brief |
| `.btn-generate-scientific-article` | Direct AI article | **MIGRATED** |
| `.btn-create-task-from-rec` | Rec → task | **MIGRATED** |
| `sendDelivery` | Package materialization | **MIGRATED** — per-item Brief authorization |
| `saveContent` / `addTask` / `addOpportunity` | Downstream writes | **MIGRATED** — carry `strategicBriefId` |
| `proposeAngle` | Advisory angle | **MIGRATED** — explicit governed `thesisId` required |
| `form-add-task` | Manual manager task | **KEEP** — generic operational (non-strategic) |

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

| ID | Item | Target | Phase 4 status |
|----|------|--------|----------------|
| P2-003-01 | Curation/Brief naming collision | Document + UX rename where needed | **PARTIAL / NONBLOCKING** — UI labels distinguish; legacy comments/surfaces remain |
| P2-003-02 | CONTESTED/UNROUTED fail-open in curation | Brief routing gate on create | **PARTIAL / NONBLOCKING** — queue entry may still occur; downstream authorization gated (queue ≠ Brief authority) |
| P2-003-03 | `proposeAngle` thesis fallback | Fail-closed without thesis/Brief | **RESOLVED** — explicit governed `thesisId` required |
| P2-003-04 | Single-thesis delivery validation | Per-item Brief authorization | **RESOLVED** — `DeliveryItem.strategicBriefId` + all-or-nothing send |
| P2-003-05 | Evidence ID loss | `supportingEvidenceIds` on Brief + consumer carry | **RESOLVED** — ContentItem carries `supportingEvidenceIds` / `signalIds` |

**P2 ORIGINAL = 5 · P2 RESOLVED = 3 · P2 PARTIAL = 2**

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

## Exit criteria (Phase 4) — **MET**

- Zero **BYPASS** rows remain **BYPASS** on strategic paths — **DONE** (ungated strategic executable paths = 0)
- All **STRATEGIC_AUTHORITY** substitutes **MIGRATED** or **DEPRECATED** — **DONE**
- `strategicBriefId` (+ `strategicBriefVersion`) on strategic Content/Task/Opportunity — **DONE**
- CurationEntry/DeliveryPackage demoted to **COMPATIBILITY_ONLY** / delivery packaging — **DONE**
- Generic manual tasks (`form-add-task`) remain **KEEP** / ungated — **PRESERVED**
- Implementation checkpoint: `d2efadf14e930fd45cc46cf4805d4b8a278bd6a6`
