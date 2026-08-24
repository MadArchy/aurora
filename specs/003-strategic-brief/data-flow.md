# Data flow 003 — Strategic Brief

**Read-only contract definition (Phase 0B).** Implementation in Phases 1–4.

---

## Target circuit (authoritative)

```text
Signal
  → SPEC-001 ScoreAndRouteSignal (routing + score persist)
  → SPEC-003 CreateStrategicBrief (reads context — no upstream mutation)
  → SPEC-003 ApproveStrategicBrief (human)
  → Downstream authorize (Content / Task / Opportunity) with strategicBriefId
  → SPEC-005 CONTENT_DRAFT (advisory, post-gate)
  → SPEC-006 claimSafety (post-draft)
```

---

## A. Upstream context read (SPEC-001 + SPEC-002)

```text
StrategicContextReader
  ├── read Signal(s) by id (tenant-scoped)
  ├── read routingDecision, routingState, thesisScores, selectedThesisId
  ├── read score projection: relevanceScore, priorityBand, scoringVersion
  ├── read recommendedDisposition, recommendedOutputFormat, whyNow, scoreRationale
  └── validate: no mutation ports exposed
```

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
Persist current + optional history (created event)
```

**Fail-closed:** CONTESTED / UNROUTED → `ROUTING_NOT_CLEAR` — no actionable Brief.

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
May require re-approval if material (policy: override to APPROVED requires explicit approval step — Phase 2 detail)
```

Override **does not** bypass tenant, routing authority, or claim safety.

---

## G. Downstream authorization gate

```text
Request: create Content | Task | Opportunity from strategic context
      ↓
Require strategicBriefId
      ↓
Load Brief → validate:
  ├── status === APPROVED
  ├── not SUPERSEDED
  ├── organizationId + clientId match request
  ├── authorizedAction permits requested downstream type
  └── signalIds still valid tenant + routing policy (staleness optional strict mode Phase 4)
      ↓
Proceed → persist downstream artifact with strategicBriefId
      ↓
Else → fail closed (BRIEF_NOT_AUTHORIZED)
```

---

## H. AI advisory (non-authoritative)

```text
Approved Brief exists (optional for angle suggestion during DRAFT)
      ↓
ADVISOR_CURATION_ANGLE / CONTENT_DRAFT via SPEC-005
      ↓
Structured validated output → suggestion fields only
      ↓
Human incorporates into Brief revision / approval
      ↓
AI output change alone → no new APPROVED revision
```

---

## I. Evidence chain (target reconstructability)

```text
Signal (sourceUrl, snippet, researchBrief)
  → SPEC-001 routing evidence (thesisScores)
  → SPEC-002 score breakdown + whyNow
  → StrategicBrief (signalIds, supportingEvidenceIds, decision snapshot)
  → ContentItem (strategicBriefId)
  → claimSafety review
  → publish
```

Each hop must preserve **reference ids** — not unlinked snippet copies alone.

---

## J. Current flow (legacy — to migrate)

```text
Signal → score/route
  → .btn-send-to-curation → CurationEntry
  → manager destination
  → DeliveryPackage (strategicNote)
  → sendDelivery → CONTENT_DRAFT → saveContent / addTask / addOpportunity
```

**Bypass (no curation):**

- `form-generate-content`
- `.btn-generate-scientific-article`
- `.btn-create-task-from-rec`

Phase 4 replaces strategic authority with Brief gate.

---

## K. CurationEntry role (transitional)

```text
CurationEntry = intake/review queue
  ├── may reference signalId, thesisId (informational during migration)
  ├── destination selection → prompts Brief creation, not direct downstream
  └── must not authorize content/opportunity without strategicBriefId (Phase 4)
```

---

## L. DeliveryPackage role (transitional)

```text
DeliveryPackage = client delivery artifact
  ├── items may reference CurationEntry refId during migration
  ├── strategicNote = presentation — NOT Strategic Decision
  └── Phase 4: strategic items require linked strategicBriefId
```

---

## M. SPEC-004 handoff

```text
Approved StrategicBrief
  + strategicBriefId
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
| Double downstream create same briefId+action | No duplicate artifacts |
| Regenerate AI angle | No new authoritative version without human revise |

---

## O. Tenant failure paths

| Violation | Result |
|-----------|--------|
| signalId from other client | `TENANT_CONTEXT_INVALID` |
| thesisId from other client | `TENANT_CONTEXT_INVALID` |
| evidenceId from other client | `TENANT_CONTEXT_INVALID` |
| cross-org write | `TENANT_CONTEXT_INVALID` |

All fail closed — no partial Brief persist.
