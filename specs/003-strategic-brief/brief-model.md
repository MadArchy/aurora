# Brief model 003 — Strategic Brief

**Authoritative data contract for SPEC-003.**  
Physical persistence shape is Phase 3; this document defines Domain semantics.

**Phase 1 (2026-08-24):** Domain types, state machine, materiality, routing eligibility, override contract, and authorization predicates implemented under `src/domain/strategicBriefCore.ts` (+ `briefMaterialityCore.ts`, `briefRoutingGateCore.ts`, `briefTenantCore.ts`).

**Phase 2 (2026-08-24):** Application use cases + ports under `src/application/strategicBrief/`.

**Phase 3 (2026-08-24):** Local-authoritative persistence under `src/infrastructure/strategicBrief/`. Current projection is operational authority. History and override audit are physically separate append-only stores. First create persists Application `CREATED` history. No Briefs synthesized from CurationEntry / DeliveryPackage / managerDecision / aiAngle.

**Phase 4 (2026-08-24):** Consumer migration complete. Strategic downstream artifacts carry Brief authorization references. Implementation checkpoint: `d2efadf14e930fd45cc46cf4805d4b8a278bd6a6`.

**Approval scoring policy:** live SPEC-001 routing is re-read at approval. The create-time scoring snapshot is **not** overwritten. `scoringVersion` drift does not auto-reject (unchanged).

---

## Aggregate design

**Design A (chosen):** `StrategicBrief` is the aggregate root. It **contains** exactly one current `StrategicDecisionSnapshot` per revision. There is **no** separate top-level StrategicDecision entity.

```text
StrategicBrief (aggregate root)
  ├── identity + tenant envelope
  ├── status + version/revision
  ├── approval metadata
  ├── constitutional + governance fields
  └── decision: StrategicDecisionSnapshot
```

---

## StrategicBrief — required fields

Constitution §12 fields (mandatory) plus governance extensions:

| Field | Type | Required | Source / rule |
|-------|------|----------|---------------|
| `id` | string | yes | system-generated stable id |
| `organizationId` | string | yes | trusted tenant envelope |
| `clientId` | string | yes | trusted tenant envelope |
| `thesisId` | string | yes | SPEC-001 CLEAR `selectedThesisId` only — no fallback |
| `signalIds` | string[] | yes | ≥1; all same client/org; all CLEAR to same thesis |
| `primaryAudience` | string | yes | from thesis/profile or manager entry |
| `geography` | string | yes | governed field |
| `territory` | string | yes | governed field |
| `framework` | string | yes | strategic framing (e.g. narrative framework) |
| `whyNow` | object or string | yes | from SPEC-002 `whyNow` snapshot or manager rationale |
| `strategicAngle` | string | yes | human-approved angle; AI suggestion non-authoritative |
| `supportingEvidenceIds` | string[] | yes | explicit vault/signal evidence refs — may be empty with documented risk |
| `riskFlags` | string[] | yes | strategic risk markers — may be empty |
| `recommendedChannel` | string | yes | e.g. LINKEDIN, YOUTUBE — decision field |
| `recommendedFormat` | string | yes | e.g. ARTICLE, VIDEO — decision field (not SPEC-002 enum copy alone) |
| `CTA` | string | yes | call to action |
| `status` | BriefStatus | yes | see state machine |
| `createdBy` | string | yes | trusted actor |
| `approvedBy` | string \| null | conditional | required when status = APPROVED |
| `version` | number | yes | monotonic revision number ≥ 1 — **not** timestamp |

### Governance extensions (recommended)

| Field | Purpose |
|-------|---------|
| `revision` | alias/clarity for `version` if needed — prefer single `version` integer |
| `schemaVersion` | Brief schema compatibility id (e.g. `brief-v1`) — separate from content `version` |
| `decision` | `StrategicDecisionSnapshot` |
| `createdAt` | ISO timestamp |
| `updatedAt` | ISO timestamp |
| `approvedAt` | ISO timestamp when APPROVED |
| `supersededByBriefId` | when status = SUPERSEDED |
| `supersedesBriefId` | prior revision chain |
| `rejectionReason` | when status = REJECTED |

---

## StrategicDecisionSnapshot

Embedded authoritative decision record. Does **not** duplicate full Signal documents.

| Field | Purpose |
|-------|---------|
| `decisionRationale` | why this strategic action |
| `authorizedAction` | governed downstream action enum (e.g. CREATE_CONTENT, CREATE_OPPORTUNITY, CREATE_TASK, RESEARCH_ONLY, NONE) |
| `dispositionDecision` | manager decision on disposition — may match or override `recommendedDisposition` |
| `formatDecision` | manager decision on format — may match or override `recommendedOutputFormat` |
| `dispositionOverrideReason` | required if disposition differs from SPEC-002 recommendation |
| `formatOverrideReason` | required if format differs from SPEC-002 recommendation |
| `upstreamRoutingRef` | `{ routingState, algorithmVersion, routedAt, source }` snapshot |
| `upstreamScoreRef` | `{ scoringVersion, totalScore, priorityBand, scoredAt }` per signal or aggregate ref |
| `signalContextRefs` | `[{ signalId, scoreSnapshotId?, routingSnapshotId? }]` — linkage only |
| `aiAdvisoryRefs` | optional `{ operation, aiRunId?, suggestedAngle? }` — audit only, not authority |

---

## BriefStatus state machine

**Do not reuse** `Signal.managerDecision`, `DeliveryPackage.status`, or content pipeline status.

```text
DRAFT ──approve──► APPROVED
  │                    │
  │                    └──material change──► new revision (DRAFT) + prior APPROVED → SUPERSEDED
  │
  ├──reject──► REJECTED
  │
  └──supersede──► SUPERSEDED
```

| Status | Meaning | Downstream authorized? |
|--------|---------|------------------------|
| `DRAFT` | Work in progress | **No** |
| `APPROVED` | Human-approved current authorization | **Yes** (if not superseded) |
| `REJECTED` | Explicitly rejected | **No** |
| `SUPERSEDED` | Replaced by newer revision | **No** |

### Legal transitions

| From | To | Trigger |
|------|-----|---------|
| — | DRAFT | CreateStrategicBrief / ReviseStrategicBrief |
| DRAFT | APPROVED | ApproveStrategicBrief (human) |
| DRAFT | REJECTED | RejectStrategicBrief (human) |
| APPROVED | SUPERSEDED | ReviseStrategicBrief material change |
| APPROVED | SUPERSEDED | Upstream routing/scoring material change policy |
| REJECTED | DRAFT | ReviseStrategicBrief (new revision) — optional product policy |

**Invariant:** APPROVED brief **must not** silently mutate in place. Material edits → new `version` + history append + supersede prior APPROVED.

---

## Versioning

- `version` = monotonic integer revision on the Brief aggregate (1, 2, 3…).
- `schemaVersion` = contract compatibility label (e.g. `brief-v1`) — bump only on breaking schema change.
- **Not** `scoringVersion` (SPEC-002) — reference only in snapshot.
- Timestamp is **not** a version.

---

## Material change policy

Material change → new revision + append history + supersede prior APPROVED if applicable.

| Material | Examples |
|----------|----------|
| Identity / scope | `thesisId`, `signalIds`, `organizationId`, `clientId` |
| Decision | `decision.*`, `strategicAngle`, `authorizedAction`, disposition/format decisions |
| Constitutional fields | `framework`, `territory`, `geography`, `primaryAudience`, `CTA`, channel/format |
| Evidence | `supportingEvidenceIds`, `riskFlags` |
| Approval | status transition to/from APPROVED, `approvedBy` change |
| Upstream staleness | routing state no longer CLEAR for claimed thesis; scoring version drift policy (Phase 3 detail) |

**Non-material:** typo fixes in notes if explicitly allowed; timestamp-only reads; AI advisory ref refresh without decision change (Phase 5 policy).

---

## History physical model (Phase 3)

```text
postura_strategic_brief_v1            current StrategicBrief projection (authority)
postura_strategic_brief_history_v1    append-only material history
postura_strategic_brief_override_v1   append-only override audit
```

Store envelopes are versioned (`brief-store-v1`, `brief-history-store-v1`, `brief-override-store-v1`). Brief `schemaVersion` (`brief-v1`) is persisted separately from content `version`.

History entry preserves enough to reconstruct former strategic authorization (decision snapshot, tenant, actor, changeType, materialFingerprint). No raw AI prompts/responses or secrets.

Unversioned / malformed persisted authority fails closed — no silent APPROVED reconstruction.

---

## Idempotency keys (conceptual)

| Operation | Idempotency rule |
|-----------|------------------|
| CreateBrief same `(clientId, thesisId, signalIds sorted, version intent)` | return existing DRAFT or reject duplicate — Application + physical write-unit identity |
| Approve already-approved same version | no-op success; retry of same write unit does not duplicate history |
| Authorize downstream with same `briefId` + action | no duplicate tasks/content/opportunity — Phase 4 |
| AI angle regeneration | does **not** create new authoritative revision without human action |

Do **not** use AI output equality as idempotency key.

---

## Tenant validation

Every referenced `signalId`, `thesisId`, `evidenceId` must resolve under the same `organizationId` + `clientId` as the Brief.

Cross-client / cross-org reference → **fail closed** (`TENANT_CONTEXT_INVALID`).

Caller-supplied tenant without trusted envelope validation → **reject**.

---

## Thesis-first derivation

`thesisId` on Brief **must** be derived from SPEC-001 governed routing:

- `routingState === 'CLEAR'`
- **AUTHORITATIVE PERSISTED THESIS** = `routingDecision.selectedThesisId`

**Forbidden:**

- `signal.thesisId` as strategic authority (legacy field is **COMPATIBILITY_ONLY** and is not read by SPEC-003)
- runtime backfill of CLEAR records missing `selectedThesisId` (those **FAIL_CLOSED**)
- `primaryThesisId`, `getPrimaryThesis`, `theses[0]`, `activeTheses[0]`
- highest score winner
- AI-selected thesis

---

## Downstream traceability (Phase 4 — actual persisted fields)

Canonical authorization reference field: **`strategicBriefId`** (one canonical name — no aliases).

| Artifact | Fields persisted by strategic consumers |
|----------|-----------------------------------------|
| **ContentItem** | `strategicBriefId?`, `strategicBriefVersion?`, `signalIds?`, `supportingEvidenceIds?` |
| **Task** | `strategicBriefId?`, `strategicBriefVersion?`, `signalId?` |
| **Opportunity** | `strategicBriefId?`, `strategicBriefVersion?`, `signalId?` |
| **CurationEntry** | `strategicBriefId?` — link only, **not** authority |
| **DeliveryItem** | `strategicBriefId?` — per-item Brief ref for strategic send |

**Rules:**

- Downstream `thesisId` (where present on Task/Opportunity/Content) is derived from the **approved Brief**, not from `signal.thesisId` or `CurationEntry.thesisId` as authority.
- `strategicBriefVersion` is persisted alongside ID for immutable authorization trace.
- Legacy pre-Brief records may omit these fields — remain readable; do **not** invent retroactive Brief authority.
- `RESEARCH_ONLY` Briefs do not authorize ContentItem / Task / Opportunity creation.

---

## Override audit record (minimum)

When `OverrideStrategicBrief` is invoked:

| Field | Required |
|-------|----------|
| `overrideId` | yes |
| `briefId`, `briefVersion` | yes |
| `organizationId`, `clientId` | yes |
| `actorId` | yes — trusted |
| `reason` | yes — non-empty |
| `previousState` | yes — snapshot or ref |
| `newState` | yes — snapshot or ref |
| `materialFieldsChanged` | yes |
| `timestamp` | yes |

Stored append-only in `postura_strategic_brief_override_v1`; never erases prior history.
