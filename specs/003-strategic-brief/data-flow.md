# Data flow 003 — Strategic Brief

**Phase 4 COMPLETE** — consumer migration implemented. Authoritative flow below matches product at Phase-4 implementation checkpoint `d2efadf14e930fd45cc46cf4805d4b8a278bd6a6`.

---

## Target circuit (authoritative — Phase 4)

```text
Signal
  → SPEC-001 ScoreAndRouteSignal (routing + score persist)
  → SPEC-002 scoring projection (consumed, not recomputed)
  → SPEC-003 CreateStrategicBrief (DRAFT — reads context, no upstream mutation)
  → SPEC-003 ApproveStrategicBrief (human APPROVED)
  → AuthorizeStrategicDownstream (Application gate)
  → Content / Task / Opportunity (strategicBriefId + strategicBriefVersion)
  → SPEC-005 CONTENT_DRAFT only after authorization (strategic paths)
  → SPEC-006 claimSafety (post-draft, where claim handling applies)
```

**Forbidden shortcuts:**

- No Signal → Content
- No CurationEntry as strategic authority
- No DeliveryPackage / `strategicNote` as strategic authority
- No `Signal.managerDecision` as Strategic Decision authority
- No SPEC-002 recommendation fields as authorization
- No `aiAngle` as authorization

---

## A. Upstream context read (SPEC-001 + SPEC-002)

```text
StrategicContextReader
  ├── read Signal(s) by id (tenant-scoped)
  ├── read routingDecision.routingState
  ├── read routingDecision.selectedThesisId (CLEAR thesis authority — exclusive)
  ├── read score projection: relevanceScore, priorityBand, scoringVersion
  ├── read recommendedDisposition, recommendedOutputFormat, whyNow, scoreRationale
  └── validate: no mutation ports exposed
```

**Authoritative persisted thesis:** `routingDecision.selectedThesisId` when `routingState === 'CLEAR'`.

**Legacy `signal.thesisId`:** COMPATIBILITY_ONLY. SPEC-003 **does not read it** for `governedThesisId`, Brief `thesisId`, snapshot thesis, approval, or downstream authorization.

**CLEAR without `selectedThesisId`:** FAIL_CLOSED (`ROUTING_NOT_CLEAR`). No runtime backfill from `signal.thesisId` or thesisScores.

**Invariant:** Reader **never** writes routing or score fields.

---

## B. Create Brief (CLEAR only)

```text
Manager selects signal cluster (1..N)
      ↓
Application: validate tenant envelope (organizationId, clientId)
      ↓
For each signalId:
  ├── same organizationId + clientId
  ├── routingState === CLEAR
  └── selectedThesisId === target thesisId (all match)
      ↓
Reject if any: CONTESTED | UNROUTED | mixed thesis | cross-tenant
      ↓
Build StrategicDecisionSnapshot from upstream refs + manager inputs
      ↓
Create StrategicBrief status=DRAFT version=1
      ↓
Persist current projection (`postura_strategic_brief_v1`) + CREATED history (`postura_strategic_brief_history_v1`)
```

**Fail-closed:** CONTESTED / UNROUTED → `ROUTING_NOT_CLEAR` — no actionable Brief.

**Note (P2-003-02 PARTIAL):** A CONTESTED/UNROUTED signal may still enter the **operational** Curation queue if product allows it. Queue entry ≠ Brief creation ≠ downstream authorization.

---

## C. Revise Brief

```text
Load APPROVED or DRAFT Brief
      ↓
Manager edits material fields
      ↓
Domain: isMaterialBriefChange(previous, next)?
      ↓
if material:
  ├── mark prior APPROVED → SUPERSEDED
  ├── new revision version = prior + 1
  ├── status = DRAFT
  └── append history entry
      ↓
Re-validate routing still CLEAR for thesisId (staleness check)
```

If upstream routing becomes CONTESTED/UNROUTED after APPROVED:

- existing APPROVED revision → SUPERSEDED
- downstream authorization revoked until new APPROVED Brief

---

## D. Approve Brief (human gate)

```text
Brief status === DRAFT
      ↓
Validate CLEAR routing still holds for thesisId + signalIds
      ↓
Validate required constitutional fields present
      ↓
Validate disposition/format override rationales if overriding SPEC-002
      ↓
Re-read live SPEC-001 routing (do not trust create-time snapshot alone)
      ↓
Scoring snapshot is not overwritten (scoringVersion drift does not auto-reject)
      ↓
Set status = APPROVED
Set approvedBy, approvedAt from trusted actor
      ↓
Append history (approved event)
```

**Only APPROVED + current version** authorizes downstream.

---

## E. Reject Brief

```text
DRAFT → REJECTED + rejectionReason
No downstream authorization
History append
```

---

## F. Override (auditable)

```text
OverrideStrategicBrief invoked (ADMIN)
      ↓
Record override audit (previousState, newState, reason, actor, timestamp)
      ↓
Apply governed field changes via normal materiality rules
      ↓
May require re-approval if material
```

Override **does not** bypass tenant, routing authority, or claim safety.

---

## G. Downstream authorization gate (Phase 4 — implemented)

```text
Strategic consumer (content / article / rec→task / opportunity / sendDelivery item)
      ↓
strategicBriefConsumer.requireStrategicAuthorization
  → AuthorizeStrategicDownstream
      ↓
Require:
  ├── strategicBriefId present
  ├── trusted organizationId + clientId
  ├── requested authorizedAction
  └── Brief: APPROVED, current, tenant-valid, action-valid
      ↓
if authorized === true:
  proceed with Brief-derived thesisId, version, signalIds, supportingEvidenceIds
      ↓
else → fail closed (no AI call, no downstream write)
```

**UI must not authorize from `brief.status` alone.** Application gate is sole authority.

**Generic operational tasks** (`form-add-task`) remain ungated — not strategic downstream.

---

## H. Delivery send (Phase 4 — implemented)

```text
sendDelivery(packageId)
      ↓
validateDeliveryForSend + per-item authorizeItem callback
  ├── resolve DeliveryItem.strategicBriefId || CurationEntry.strategicBriefId
  ├── map destination → CREATE_CONTENT | CREATE_TASK | CREATE_OPPORTUNITY
  └── AuthorizeStrategicDownstream for each strategic item
      ↓
Policy: ALL-OR-NOTHING
  — any unauthorized strategic item → BRIEF_DENIED
  — entire send blocked BEFORE any CONTENT_DRAFT / AI call
      ↓
On success: materialize Content / Task / Opportunity with
  strategicBriefId, strategicBriefVersion, Brief thesisId,
  signalIds / supportingEvidenceIds (ContentItem)
      ↓
markDeliverySent(packageId, convertedSignalIds) — only signals actually materialized
```

Multi-thesis packages: each item independently authorized by its corresponding Brief. One Brief does not authorize unrelated thesis contexts.

`DeliveryPackage.strategicNote` = presentation only — **not** authorization.

---

## I. AI advisory (non-authoritative)

```text
ADVISOR_CURATION_ANGLE / CONTENT_DRAFT via SPEC-005
      ↓
proposeAngle requires explicit governed thesisId (no first/primary/legacy fallback)
      ↓
Structured validated output → suggestion fields only
      ↓
AI cannot approve Brief or bypass AuthorizeStrategicDownstream
```

On strategic content paths: **authorization occurs before CONTENT_DRAFT**. Denied authorization → AI Gateway call count = 0.

---

## J. Evidence / traceability chain (Phase 4)

```text
Signal (sourceUrl, snippet, researchBrief)
  → SPEC-001 routing evidence (thesisScores)
  → SPEC-002 score breakdown + whyNow
  → StrategicBrief (signalIds, supportingEvidenceIds, decision snapshot, thesisId)
  → ContentItem / Task / Opportunity
       ├── strategicBriefId
       ├── strategicBriefVersion
       ├── thesisId (from approved Brief — not signal.thesisId authority)
       ├── signalIds / signalId (where applicable)
       └── supportingEvidenceIds (ContentItem)
  → claimSafety review (SPEC-006)
  → publish
```

Each hop preserves **reference ids** — not unlinked snippet copies alone.

Legacy pre-Brief ContentItem / Task / Opportunity may lack `strategicBriefId` — readable; **not** proof of governed authorization. No retroactive Brief invent.

---

## K. CurationEntry role (Phase 4)

```text
CurationEntry = operational intake/review queue
  ├── may reference signalId, thesisId (COMPATIBILITY_ONLY / display)
  ├── may reference strategicBriefId (link only — NOT authority)
  ├── destination selection informs Brief authorizedAction mapping
  └── must not authorize content/opportunity/task without Application gate
```

---

## L. DeliveryPackage role (Phase 4)

```text
DeliveryPackage = client delivery / packaging artifact
  ├── items may reference CurationEntry refId
  ├── DeliveryItem.strategicBriefId required for strategic materialization
  ├── strategicNote = presentation — NOT Strategic Decision
  └── package status alone cannot authorize downstream
```

---

## M. SPEC-004 handoff

```text
Approved StrategicBrief
  + strategicBriefId
  + strategicBriefVersion
  + authorizedAction
  + thesisId, signalIds
      ↓
Planner / Content / Opportunity modules (SPEC-004)
```

SPEC-003 owns authorization; SPEC-004 owns execution planning.

---

## N. Idempotency flows

| Scenario | Expected behavior |
|----------|-------------------|
| Double CreateBrief same scope | Return existing DRAFT or deterministic reject |
| Approve already-approved vN | No-op success |
| Double downstream create same briefId+action | No uncontrolled duplicate artifacts |
| Regenerate AI angle / content retry | No new authoritative version without explicit new draft/revision; do not use content equality as key |

---

## O. Tenant failure paths

| Violation | Result |
|-----------|--------|
| signalId from other client | `TENANT_CONTEXT_INVALID` |
| thesisId from other client | `TENANT_CONTEXT_INVALID` |
| evidenceId from other client | `TENANT_CONTEXT_INVALID` |
| foreign strategicBriefId | DENIED — writes = 0 |
| cross-org write | `TENANT_CONTEXT_INVALID` |

All fail closed — no partial Brief persist. Mixed-tenant write units are rejected as a whole (local in-memory + three-key persist rolled back together).

---

## P. Phase 3 persistence boundary

```text
BriefWriteUnit { briefs, history, overrideAudit? }
      ↓
Infrastructure commitWriteUnit
  ├── tenant envelope consistency (org + client + brief ownership)
  ├── apply entire unit to in-memory snapshot
  └── persist:
        postura_strategic_brief_v1
        postura_strategic_brief_history_v1
        postura_strategic_brief_override_v1
```

Retry of an identical successful write unit converges: current projection unchanged, no duplicate history/audit.

Current projection is operational authority. History is transition evidence only.

Firestore Brief writes: none. Rules contract: **FUTURE_NONBLOCKING / SPEC-009**.

---

## Q. Signal state (Phase 4)

- Brief creation alone does **not** mark Signal CONVERTED.
- Authorization failure does **not** mark CONVERTED.
- No auto-DISCARD from Brief lifecycle.
- `markDeliverySent` converts only signals with actually materialized authorized downstream results.
