# Spec 001 — Strategic Signal Routing

| Field | Value |
|-------|--------|
| **Spec ID** | `001-strategic-signal-routing` |
| **Display name** | **SPEC-001 — Strategic Signal Routing** |
| **Status** | **`APPROVED`** · **READY_FOR_IMPLEMENTATION** (Phase 0B human-approved 2026-08-23) |
| **Phase** | 0B COMPLETE · Phase 1 AUTHORIZED |
| **Branch** | `spec/001-strategic-signal-routing` |
| **Implementation baseline** | Phase 0 inventory @ SPEC-005 CODE_COMPLETE |
| **Priority** | P1 (constitution §5 Multi-thesis native) |
| **Constitution** | §4 Thesis First · §5 Multi-thesis · §7 Human-in-the-loop · §AI SUGGESTS, SOFTWARE GOVERNS |
| **Depends on** | SPEC-005 (CLEAR / CODE_COMPLETE — advisory AI only); SPEC-009 envelope (CODE_AVAILABLE; production DEFERRED / NONBLOCKING) |
| **Blocks** | Correct multi-thesis strategic attribution; feeds SPEC-002 / SPEC-003 |
| **Phase 0 inventory** | Chat Phase 0 + `docs/audits/BASELINE_CONSTITUTION_AUDIT.md` F-01 |
| **Test baseline (entering)** | `npm run check` → **487/487 PASS**; `npm run test:rules` → **91/91 PASS** |

---

## Problem

POSTURA partially implements multi-thesis routing:

- **Good:** `src/domain/thesisRoutingCore.ts` (`routeSignalAcrossTheses`) scores **all supplied** theses and can mark contests.
- **Good:** Main ingest score path loads **ACTIVE** theses via `getActiveTheses`.
- **Bad:** Strategic and near-strategic call sites still collapse clients via `getPrimaryThesis`, `activeTheses[0]`, `theses[0]`, and `candidates[0]`.
- **Bad:** Contested routing can still AUTO-assign a primary without a mandatory human decision.
- **Bad:** `applyScoreToSignal` can silently terminal-`DISCARD` low scores during scoring.
- **Bad:** `ThesisStatus` lacks constitution `LEGACY` (Phase 1 work — not changed in 0B).
- **Bad:** No formal approved SPEC package existed before Phase 0B.

---

## Goal

Every strategic Signal is evaluated against **all eligible ACTIVE theses** of its client. Routing deterministically decides attribution state, preserves per-thesis evidence, and requires human decision when contested.

POSTURA must **not** silently collapse a multi-thesis client into:

- `theses[0]`
- `activeTheses[0]`
- `getPrimaryThesis()`
- `candidates[0]`

for **strategic routing decisions**.

---

## Strategic circuit position

```text
Signal
  → Strategic Signal Routing          ← SPEC-001
  → Strategic Scoring                 ← SPEC-002 (adjacent)
  → Strategic Decision
  → Strategic Brief                   ← SPEC-003
  → Planner / Content / Opportunity   ← SPEC-004 / adjacent
```

SPEC-001 is the **routing / attribution layer**. It is deterministic software.

---

## Scope

In scope:

- Eligibility contract (ACTIVE-only production routing)
- Multi-thesis evaluation invariant
- Routing result + states (`CLEAR` / `CONTESTED` / `UNROUTED` + MANUAL source)
- Contested policy (no silent first-thesis attribution)
- Manual override contract (auditable)
- Explainability + material history requirements
- Application use cases + ports (planned)
- Strangler migration off strategic primary helpers
- Architecture bans / acceptance
- Auto-discard governance for the score/route path

Out of scope — see **Non-Goals**.

---

## Non-Goals

SPEC-001 does **not** include:

- content / article / social generation or publishing
- claim / evidence graph (SPEC-006)
- new AI providers or AI Gateway redesign (SPEC-005 frozen CODE_COMPLETE)
- production deploy of SPEC-005 (D1–D4)
- production deploy / backfill of SPEC-009
- full Strategic Brief (SPEC-003)
- news ingestion redesign
- disposition vs format split (SPEC-002)
- React migration (SPEC-010)
- inventing a new AiOperation for routing

---

## Actors

| Actor | Role |
|-------|------|
| **Manager (ADMIN)** | Triggers score/route; resolves CONTESTED; MANUAL override |
| **Client** | Does not perform production routing writes; may later approve strategic artifacts downstream |
| **System (deterministic router)** | Evaluates all ACTIVE theses; classifies CLEAR / CONTESTED / UNROUTED |
| **AI (SPEC-005)** | Optional advisory `SIGNAL_THESIS_EVAL` — never replaces router |

---

## Domain terminology

| Term | Meaning |
|------|---------|
| **Eligible thesis** | Status `ACTIVE` only (production strategic routing) |
| **Routing** | Deterministic attribution of a Signal across eligible theses |
| **thesisScores** | Per-eligible-thesis score evidence preserved on the Signal |
| **CLEAR** | One thesis wins unambiguously under policy |
| **CONTESTED** | Two or more theses materially compete; not a silent final pick |
| **UNROUTED** | No eligible thesis meets minimum / all excluded |
| **MANUAL** | Human override of thesis attribution (source) |
| **AUTO** | System-produced routing source when policy allows CLEAR |
| **Primary helper** | `getPrimaryThesis` / `[0]` shortcuts — **forbidden** on strategic routing paths |

---

## Routing invariants

1. **Thesis-first:** Strategic attribution is mediated by the client's eligible theses — not by news topic, profile, AI output, or content category alone.
2. **All eligible ACTIVE theses** are evaluated on every production routing execution (N ≥ 1 or N = 0 → UNROUTED).
3. **No strategic primary fallback:** Index-0 / `getPrimaryThesis` / `candidates[0]` must not decide strategic attribution.
4. **CONTESTED is legitimate:** Must not silently become a selected `thesisId` via first-thesis fallback.
5. **AI advisory only:** `SIGNAL_THESIS_EVAL` cannot set routing state or replace `routeSignalAcrossTheses`.
6. **Explainable:** Persist all evaluated thesis IDs / scores + decision/rationale + version + source + timestamp.
7. **History:** Material routing changes preserve prior vs new decision evidence (physical form Phase 3).
8. **Tenant:** Persisted Signals keep SPEC-009 envelope; `organizationId` never invented from routing payload.
9. **Routing ≠ terminal discard:** Routing alone SHALL NOT silently convert a Signal to final `DISCARD` (see Auto-discard governance).

---

## Thesis eligibility

| Status | Production strategic routing |
|--------|------------------------------|
| `ACTIVE` | **INCLUDED** |
| `DRAFT` | EXCLUDED |
| `UNDER_REVIEW` | EXCLUDED |
| `PAUSED` | EXCLUDED |
| `ARCHIVED` | EXCLUDED |
| `LEGACY` | EXCLUDED (constitution; **add enum in Phase 1** — not changed in 0B) |

Current code already filters ACTIVE via `getActiveTheses`. Phase 1 formalizes eligibility + adds `LEGACY` to `ThesisStatus`.

---

## Multi-thesis contract

- Client may have **1** or **N** ACTIVE theses.
- Behavior must be correct for both.
- Do **not** define a canonical “primary thesis” shortcut for routing.
- UI presentation defaults (non-strategic) may still pick a display thesis — classified separately in `migration-matrix.md`.

---

## Routing states

Minimum conceptual states:

| State | Meaning |
|-------|---------|
| `CLEAR` | Unambiguous winner under deterministic policy |
| `CONTESTED` | Material competition; awaiting human or explicit policy |
| `UNROUTED` | No eligible winner |

Decision **source** (orthogonal): `AUTO` | `MANUAL`.

Exact TypeScript enums / result schema: **Phase 1**.

---

## Contested policy (CRITICAL)

**CONTESTED MUST NOT** silently AUTO-assign a primary thesis because a thesis exists at index 0.

If deterministic policy cannot confidently select one thesis:

- routing remains **`CONTESTED`**
- until **human MANUAL** decision **or** an **explicitly defined** deterministic resolution policy (documented in implementation acceptance)

No implicit first-thesis fallback.

---

## Manual override

Manual routing must be explicit and auditable. Minimum:

- selected thesisId
- `source = MANUAL`
- actor identity/context when available
- timestamp
- previous routing decision / history linkage
- **retain** per-thesis scoring evidence (`thesisScores`)

---

## Auto-discard governance

Phase 0 found `dbService.applyScoreToSignal` may set `status = DISCARDED` / `managerDecision = DISCARDED` when `recommendedAction === 'NO_ACTION'` and score &lt; 40.

**Frozen requirement:**

> Strategic **routing itself** SHALL NOT silently convert a Signal into final terminal `DISCARD` merely because relevance is low.

Routing / scoring may surface recommendations such as conceptual:

- `LOW_RELEVANCE`
- `DISCARD_CANDIDATE`

Final destructive/terminal disposition requires an **explicit governed decision** under downstream decision policy (manager action or separately approved deterministic policy — not invented here as a silent side effect of routing).

Phase 2 removes or relocates the silent discard from the score/route persistence path.

---

## AI boundary

```text
AI SUGGESTS
SOFTWARE ROUTES
HUMAN DECIDES WHERE REQUIRED
```

| Component | Role |
|-----------|------|
| `routeSignalAcrossTheses` / ScoreAndRouteSignal | **Authoritative** |
| SPEC-005 `SIGNAL_THESIS_EVAL` | **Advisory** evidence only |
| New AiOperation for routing | **Not required / not authorized** |

---

## Explainability

Every routing execution must preserve enough to explain the outcome:

- all evaluated thesis IDs
- per-thesis scores (and factors/rationale as appropriate)
- selected / routing outcome state
- decision rationale
- algorithm / routing version
- decision source (`AUTO` | `MANUAL`)
- timestamp

Avoid opaque “selectedThesisId only.”

---

## History preservation

Phase 0: in-place overwrite of score/routing fields.

**Requirement:** Material routing changes preserve sufficient revision evidence:

- previous decision
- new decision
- source
- actor when applicable
- timestamp
- algorithm version

Physical representation (bounded array vs separate collection vs last-N): **Phase 3**. Avoid unbounded Firestore growth.

---

## Tenant boundary

- Routing is **client-scoped**.
- Signals remain under SPEC-009 envelope (`organizationId` + `clientId`).
- `organizationId` is never invented or caller-trusted from a routing payload.
- SPEC-009 **production** deploy/backfill remains **deferred** and **nonblocking** for SPEC-001 CODE_COMPLETE.

---

## Target architecture

```text
Interfaces / UI
      ↓
Application (ScoreAndRouteSignal, OverrideSignalThesis)
      ↓
Domain (thesisRoutingCore + eligibility)
      ↑
Ports ← Infrastructure (db / Firestore adapters)
Composition wires adapters
```

Domain free of: Firebase, Firestore, React, Vite, Express, HTTP, AI SDKs, concrete DB adapters.

Preserve and strangler around `src/domain/thesisRoutingCore.ts` unless Phase 1 proves the contract inadequate.

---

## Use cases (planned)

| Use case | Purpose |
|----------|---------|
| `ScoreAndRouteSignal` | Evaluate all ACTIVE theses; classify; persist governed result |
| `OverrideSignalThesis` | Auditable MANUAL attribution |
| `GetSignalRoutingExplanation` | Optional — read explainability projection |
| `RecomputeSignalRouting` | Optional — explicit re-route |

---

## Ports (conceptual)

- `ThesisQueryPort` — eligible ACTIVE theses for client
- `SignalReadPort` — if required
- `SignalWritePort` — persist routing fields without silent terminal discard
- `RoutingHistoryPort` — if history is physically separate

No Firestore contracts in Domain/Application.

---

## Dependencies

| Spec | Relation |
|------|----------|
| **SPEC-005** | CLEAR / CODE_COMPLETE — `SIGNAL_THESIS_EVAL` advisory only |
| **SPEC-009** | Envelope/rules CODE_AVAILABLE; production DEFERRED / NONBLOCKING |
| **SPEC-002** | Scoring v2 consumes / aligns with routed thesis context |
| **SPEC-003** | Brief consumes routing output |
| **SPEC-006** | Downstream claims/evidence — no circular ownership |

---

## CODE_COMPLETE vs DEPLOYED

| State | Meaning |
|-------|---------|
| `READY_FOR_HUMAN_SPEC_APPROVAL` | Phase 0B docs complete (current) |
| `APPROVED` | Human authorizes implementation |
| `CODE_COMPLETE` | A1–A18 (and approved extras) PASS in repo; no production required |
| `DEPLOYED` / `DONE` | Separate; not automatic with CODE_COMPLETE |

Deployment gates: see `acceptance.md` (optional D\* — none manufactured as production requirements beyond existing deferred SPEC-009).

---

## Definition of CODE_COMPLETE (implementation)

Gateway of acceptance A1–A18 PASS + human T-001-6xx sign-off. Product must satisfy multi-thesis / contested / MANUAL / no strategic `[0]` / no silent discard-from-routing / domain purity / architecture ban tests.

---

## References

- Constitution §5, §7, §26–28
- `docs/audits/BASELINE_CONSTITUTION_AUDIT.md` F-01
- Existing core: `src/domain/thesisRoutingCore.ts`
- Companion docs: `plan.md`, `tasks.md`, `acceptance.md`, `data-flow.md`, `hexagonal-boundaries.md`, `migration-matrix.md`
