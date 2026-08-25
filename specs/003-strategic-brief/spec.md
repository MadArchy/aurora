# Spec 003 — Strategic Brief

| Field | Value |
|-------|--------|
| **Spec ID** | `003-strategic-brief` |
| **Display name** | **SPEC-003 — Strategic Brief** |
| **Status** | **`CODE_COMPLETE`** (implementation) · DEPLOYED **NO** · DONE **NO** |
| **Phase** | Phase 0B–6 **COMPLETE** · T-003-604 human CODE_COMPLETE approval **2026-08-24** (America/Bogota) |
| **Branch** | `spec/003-strategic-brief` |
| **Implementation baseline** | Phase 0 inventory @ SPEC-002 CODE_COMPLETE (`ab01c46` product; `e422359` governance) |
| **Priority** | P1 (constitution §4, §12 — Strategic Brief gate) |
| **Constitution** | §4 Thesis First · §5 Multi-thesis · §11 Strategic Decision ≠ Content Format · §12 Strategic Brief Obligatorio · §AI SUGGESTS, SOFTWARE GOVERNS |
| **Depends on** | SPEC-001 (CODE_COMPLETE — routing authority); SPEC-002 (CODE_COMPLETE — scoring authority); SPEC-005 (CODE_COMPLETE — advisory AI); SPEC-006 (claim safety downstream); SPEC-009 (CODE_AVAILABLE; production DEFERRED) |
| **Blocks** | Governed strategic downstream action (Planner / Content / Opportunity — SPEC-004 adjacent) |
| **Phase 0 inventory** | Chat Phase 0 (2026-08-24) — Brief absent; curation/delivery substitute |
| **Test baseline (CODE_COMPLETE)** | `npm run check` → **844/844 PASS**; `npm run test:rules` → **91/91 PASS** |
| **Human CODE_COMPLETE approval** | «Apruebo SPEC-003 como CODE_COMPLETE y autorizo el cierre de T-003-604.» — 2026-08-24 (America/Bogota) |

---

## Problem

POSTURA lacks a governed **Strategic Decision** and **Strategic Brief** authority. Strategic downstream action is fragmented and bypassable:

- **Bad:** No `StrategicBrief` entity — zero symbols in `src/`.
- **Bad:** Strategic authority is split across `Signal.managerDecision`, SPEC-002 recommendations, `CurationEntry.destination`, `DeliveryPackage.strategicNote`, and AI `aiAngle`.
- **Bad:** Signal → Content paths exist without Brief gate (`form-generate-content`, scientific article, recommendation→task).
- **Bad:** `CurationEntry` + `DeliveryPackage` substitute for constitution §12 Brief.
- **Bad:** No auditable override contract for Brief bypass (F-003-03).
- **Bad:** CONTESTED/UNROUTED signals can enter curation with stale/empty `thesisId`.
- **Bad:** No brief versioning, material history, or idempotency contract.
- **Bad:** Orchestration lives in `main.ts` / `db.ts` — no Application hexagon for brief authority.

**Good:** SPEC-001 routing and SPEC-002 scoring are CODE_COMPLETE and produce consumable upstream context. SPEC-005 Gateway operations (`ADVISOR_CURATION_ANGLE`, `CONTENT_DRAFT`) are structured and advisory. SPEC-006 claim safety exists downstream.

---

## Goal

SPEC-003 establishes **one authoritative Strategic Decision record** embedded in a **Strategic Brief aggregate**, plus a **mandatory downstream authorization gate**.

It answers:

> **What strategic action is authorized for this thesis and signal cluster, and why?**

SPEC-003 does **not** answer:

> **Which thesis should this signal belong to?** (SPEC-001)  
> **How important is this signal?** (SPEC-002)  
> **Are claims in this draft safe to publish?** (SPEC-006)

---

## Strategic circuit position

```text
Signal
  → Strategic Signal Routing          ← SPEC-001 (CODE_COMPLETE)
  → Strategic Scoring                 ← SPEC-002 (CODE_COMPLETE)
  → Strategic Decision                ← SPEC-003 (this spec — authoritative)
  → Strategic Brief                   ← SPEC-003 (this spec — aggregate + gate)
  → Planner / Content / Opportunity   ← SPEC-004 / adjacent
  → Claim safety / publish            ← SPEC-006
```

---

## Scope

In scope:

- **StrategicDecisionSnapshot** — sub-record owned by StrategicBrief (design **A**)
- **StrategicBrief** aggregate — constitution §12 fields + governance extensions
- Brief status model (DRAFT / APPROVED / REJECTED / SUPERSEDED)
- Human approval workflow (approve / reject / revise)
- Auditable override contract (or formal bypass prohibition)
- Consumption of SPEC-001 routing without mutation
- Consumption of SPEC-002 scoring without recomputation
- CLEAR / CONTESTED / UNROUTED policies for brief authorization
- Multi-signal brief semantics (same thesis, same tenant)
- Evidence linkage (`signalIds`, `supportingEvidenceIds`)
- Version/revision + material history + idempotency
- Application use cases + ports (planned)
- Downstream authorization gate (`briefId` required)
- Strangler migration off curation/delivery as strategic authority
- Architecture bans / acceptance A1–A36

Out of scope — see **Non-Goals**.

---

## Non-Goals

SPEC-003 does **not** include:

- Strategic Signal Routing redesign (SPEC-001 frozen CODE_COMPLETE)
- Strategic Scoring redesign (SPEC-002 frozen CODE_COMPLETE)
- new AI providers or AI Gateway redesign (SPEC-005 frozen CODE_COMPLETE)
- claim verification / publication claim gates (SPEC-006)
- full Planner implementation (SPEC-004)
- production deploy of SPEC-009
- React migration (SPEC-010)
- inventing a new AiOperation unless Phase N proves unavoidable gap
- composite multi-thesis Brief (constitution requires singular `thesisId`)

---

## Strategic Decision boundary

### What Strategic Decision **is**

The **StrategicDecisionSnapshot** embedded in StrategicBrief — the single authoritative record of:

- which thesis is strategically selected for action (from SPEC-001 CLEAR only)
- which signals are in scope (`signalIds`)
- what disposition and output the manager **decides** (may accept/override SPEC-002 recommendations)
- strategic angle, channel, format, CTA, framework, territory
- decision rationale and approver identity
- upstream reference snapshots (routing algo version, scoringVersion, score band — not full Signal copies)

### What Strategic Decision is **NOT**

| Artifact | Role | SPEC-003 |
|----------|------|----------|
| `routingState` / `routingDecision` | SPEC-001 routing evidence | **Input only** — not decision authority |
| `selectedThesisId` / `thesisScores` | SPEC-001 attribution | **Input only** |
| Numeric score / `priorityBand` | SPEC-002 evaluation | **Input only** |
| `recommendedDisposition` / `recommendedOutputFormat` | SPEC-002 recommendations | **Input only** — decision may accept/override |
| AI prose (`aiAngle`, draft body) | Advisory | **Not authority** |
| `CurationEntry.destination` | Operational intake | **Not authority** — migrate to COMPATIBILITY_ONLY |
| `DeliveryPackage.strategicNote` | Client delivery note | **Not authority** |
| `Signal.managerDecision` | Radar triage enum | **Operational only** — not strategic decision |

**Design choice:** StrategicDecision is **not** a separate persisted top-level entity. It is **sub-record A** — `StrategicDecisionSnapshot` owned by `StrategicBrief`. One Brief = one authoritative decision revision.

---

## Actors

| Actor | Role |
|-------|------|
| **Manager (ADMIN)** | Creates/revises Brief; approves/rejects; may request override; triggers downstream only via approved Brief |
| **Client** | Read-only consumption of approved strategic artifacts downstream — **cannot** approve Brief |
| **System (deterministic governance)** | Validates routing/scoring/tenant gates; enforces Brief gate; records history |
| **AI (SPEC-005)** | Advisory angle/draft/rationale — never approves Brief or bypasses gate |

---

## Upstream ownership (read-only consumption)

### SPEC-001 — MUST NOT mutate

- `routingState`, `routingDecision`, `selectedThesisId`, `thesisScores`
- routing algorithm version, routing history

### SPEC-002 — MUST NOT mutate or recompute

- numeric score, `priorityBand`, `scoringVersion`
- factor/penalty breakdown, `whyNow`, `scoreRationale`
- `recommendedDisposition`, `recommendedOutputFormat`, score history

SPEC-003 **reads** governed upstream projections via `StrategicContextReader` port.

---

## SPEC-005 AI boundary

Existing operations sufficient:

- `ADVISOR_CURATION_ANGLE` — suggest editorial angle
- `CONTENT_DRAFT` — draft language (downstream of Brief gate in Phase 4)
- `ADVISOR_POSITIONING` — positioning advice

AI **may suggest**; AI **may NOT** approve strategy, select thesis, change routing/score, or bypass Brief gate.

No new `AiOperation` in Phase 0B.

---

## SPEC-006 claim boundary

SPEC-006 remains authority for claim verification, claim safety, publication gates.

SPEC-003 may reference `supportingEvidenceIds` and `riskFlags` but **SHALL NOT** perform claim verification.

Claim safety remains **downstream** of Brief-authorized content generation.

---

## SPEC-009 boundary

Tenant envelope and remote rules owned by SPEC-009. Production closure **DEFERRED**.

SPEC-003 CODE_COMPLETE may use **local-authoritative** Brief persistence (same pattern as SPEC-002 score history). Remote rules are a separate deployment concern.

---

## Routing state policies

### CLEAR

- Brief creation/actionable path requires `routingState === 'CLEAR'` with valid governed `selectedThesisId`.
- **AUTHORITATIVE PERSISTED THESIS** = `routingDecision.selectedThesisId`. Legacy `signal.thesisId` is **COMPATIBILITY_ONLY** and is not SPEC-003 authority.
- CLEAR without `routingDecision.selectedThesisId` **FAIL_CLOSED** (`ROUTING_NOT_CLEAR`). No runtime backfill.
- `thesisId` on Brief **must** match SPEC-001 authoritative selected thesis — no legacy `signal.thesisId` fallback.
- If routing changes materially after Brief creation → prior revision **SUPERSEDED**; revalidation required.

### CONTESTED

- **Fail-closed** for actionable/approved Brief.
- No highest-score thesis, first thesis, legacy `thesisId`, or AI-selected thesis.
- Resolve via SPEC-001 MANUAL override first.
- Optional non-actionable DRAFT candidate **out of scope** for Phase 1 unless product need proven — prefer fail-closed simplicity.

### UNROUTED

- **Cannot** authorize Strategic Brief or downstream strategic action.
- Routing must become governed (CLEAR or resolved MANUAL) first.

---

## Multi-signal / multi-thesis

Constitution: `signalIds` (plural), `thesisId` (singular).

**Policy:**

- One StrategicBrief is **thesis-specific**.
- It may aggregate **N signals** only if every signal resolves CLEAR to the **same** `thesisId` under the **same** `organizationId` + `clientId`.
- Mixed-thesis signal clusters → **separate Briefs** — no silent collapse.
- Composite multi-thesis Brief → **out of scope**.

---

## Human approval

Actionable Brief requires human approval:

- `approvedBy` — trusted actor from auth context (not client-submitted)
- `approvedAt` — trusted clock

UI inference alone is **not** approval authority.

---

## Override contract (F-003-03)

Normal flows **MUST NOT** bypass Brief gate.

**Permitted:** auditable **OverrideStrategicBrief** governance event with minimum fields:

- `actorId`, `reason`, `previousState`, `newState`, `timestamp`
- `organizationId`, `clientId`, `briefId`, material fields overridden

Override **may NOT** bypass: tenant isolation, SPEC-001 routing authority, SPEC-006 claim safety, or authentication.

Override modifies governed decision — it **does not** erase Brief requirement silently.

**Prohibited:** silent bypass, client-initiated override, AI-initiated override.

---

## Downstream gate invariant

Only an **APPROVED**, **current** (not SUPERSEDED), **tenant-valid** Brief may authorize strategic downstream creation.

Strategic downstream artifacts **must carry** `strategicBriefId` (immutable reference).

**Strategic paths requiring Brief (Phase 4 migration targets):**

- Content generation from signal context
- Planner tasks derived from signal/decision
- Opportunity creation from signal context
- `sendDelivery` materialization of strategic items
- Scientific article flow
- Recommendation → task flow

**Excluded:** generic operational/admin tasks unrelated to signal-driven strategy.

---

## Legacy artifact roles (migration intent)

| Artifact | Future role |
|----------|-------------|
| `CurationEntry` | Operational intake/review queue — **not** strategic authority |
| `DeliveryPackage` | Client delivery packaging — references approved Brief where strategic |
| `managerDecision` | Radar triage — unchanged operational enum |
| `recommendedDisposition` / `recommendedOutputFormat` | SPEC-002 inputs — decision may override with audit |

---

## Ownership boundaries

| Owner | Owns |
|-------|------|
| **SPEC-001** | routing, thesis attribution, routing history |
| **SPEC-002** | score, band, disposition/format recommendations, score history |
| **SPEC-003** | StrategicDecisionSnapshot, StrategicBrief, brief history, downstream authorization gate |
| **SPEC-005** | AI Gateway execution |
| **SPEC-006** | claim verification downstream |
| **SPEC-009** | security envelope / remote rules |

No circular ownership.

---

## Phase 0 findings (unchanged at 0B)

| Severity | Count | IDs |
|----------|-------|-----|
| P0 | 0 | — |
| P1 | 3 | F-003-01, F-003-02, F-003-03 |
| P2 | 5 | naming collision, CONTESTED/UNROUTED fail-open, proposeAngle fallback, single-thesis delivery validation, evidence ID loss |
| P3 | 2 | main.ts monolith, legacy `recommendedAction` on curation |

**P1 resolved at Phase 2:** 0 (F-003-01 / F-003-03 Application-partial; F-003-02 OPEN_PHASE_4; persistence Phase 3)

---

## Related documents

| Document | Purpose |
|----------|---------|
| `brief-model.md` | Field contract, snapshot, status machine, materiality |
| `data-flow.md` | End-to-end flows, gate points |
| `hexagonal-boundaries.md` | Domain/Application/ports |
| `migration-matrix.md` | Legacy path classification |
| `acceptance.md` | A1–A36 + deploy gates |
| `plan.md` | Phases, dependencies |
| `tasks.md` | T-003 task IDs |
