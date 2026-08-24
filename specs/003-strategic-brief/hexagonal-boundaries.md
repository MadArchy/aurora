# Hexagonal boundaries 003 — Strategic Brief

---

## Target layering

```text
Interfaces / UI (main, workspace, modals)
        ↓
Application (CreateStrategicBrief, ApproveStrategicBrief, ReviseStrategicBrief,
             RejectStrategicBrief, OverrideStrategicBrief, AuthorizeDownstreamAction)
        ↓
Domain (strategicBriefCore, briefMaterialityCore, briefRoutingGateCore, briefTenantCore)
        ↑
Ports ← Infrastructure (BriefRepository adapter, StrategicContextReader adapter, history store)
Composition root wires adapters — NOT main.ts direct db mutations for Brief authority
```

---

## Domain (pure)

**Owns:**

- `StrategicBrief` + `StrategicDecisionSnapshot` types
- `BriefStatus` transitions (legal state machine)
- material brief change detection
- routing eligibility for brief (CLEAR / CONTESTED / UNROUTED rules)
- multi-signal same-thesis validation
- tenant reference validation (pure — receives resolved entity ids)
- override audit record shape validation
- downstream action authorization rules (given Brief state)

**Must NOT import:**

- Firebase / Firestore
- React / Vite / Express / HTTP
- `dbService` / concrete DB
- AI provider SDKs / Gateway implementation
- `main.ts`

**Target modules (Phase 1 — implemented):**

- `src/domain/strategicBriefCore.ts`
- `src/domain/strategicBriefErrors.ts`
- `src/domain/briefMaterialityCore.ts`
- `src/domain/briefRoutingGateCore.ts`
- `src/domain/briefTenantCore.ts`

Architecture evidence: `tests/strategicBriefArchitecture.test.ts`. Phase 2 Application package **NOT STARTED**.

---

## Application

**Owns:**

- use case orchestration
- trusted actor + clock injection
- StrategicContextReader consumption (SPEC-001/002 read models)
- error taxonomy (`StrategicBriefError` — mirror SPEC-001/002 patterns)
- ports: `StrategicBriefRepository`, `StrategicBriefHistoryPort`, `StrategicContextReader`, optional `TrustedActorPort` / `ClockPort`

**Must NOT:**

- import concrete Firestore/db/React
- mutate SPEC-001 routing or SPEC-002 score fields
- call AI providers directly (UI/services call Gateway; Brief records advisory refs only)
- embed claim verification logic (SPEC-006)

**Target package (Phase 2):**

- `src/application/strategicBrief/`

**Minimum use cases:**

| Use case | Responsibility |
|----------|----------------|
| `CreateStrategicBrief` | DRAFT from governed context |
| `ApproveStrategicBrief` | Human approval gate |
| `RejectStrategicBrief` | Explicit rejection |
| `ReviseStrategicBrief` | Material revision + supersede |
| `OverrideStrategicBrief` | Auditable governance override |
| `AuthorizeDownstreamAction` | Query gate for Content/Task/Opportunity |

Do not overbuild speculative use cases in Phase 0B.

---

## Ports (neutral contracts)

| Port | Responsibility |
|------|----------------|
| `StrategicBriefRepository` | CRUD current Brief projection; tenant-scoped |
| `StrategicBriefHistoryPort` | Append-only material history |
| `StrategicContextReader` | Read Signal routing + scoring projections (no write) |
| `TrustedActorPort` | Resolve current actor for approve/override (optional if injected) |
| `ClockPort` | Trusted timestamps (optional) |

**StrategicContextReader** maps to existing governed Signal fields — does not duplicate SPEC-001/002 business logic in Application.

---

## Infrastructure

**Owns:**

- local store adapters (`postura_strategic_brief_v1`, history store)
- future Firestore adapter (SPEC-009 deploy track)
- wiring in composition root

**Pattern:** mirror `DbStrategicScoringAdapter` / `DbStrategicSignalRoutingAdapter`.

---

## Interfaces / UI

**May:**

- invoke Application use cases
- render Brief forms and approval UX
- display explainability from Brief + history

**Must NOT:**

- write Brief authority directly to db/localStorage
- infer APPROVED status without Application approve workflow
- bypass gate for strategic content buttons (Phase 4)

**Ban target (Phase 5):** direct Brief field mutation from `main.ts`.

---

## Relationship to adjacent specs

| Spec | Boundary |
|------|----------|
| SPEC-001 | ContextReader reads routing — Application never calls routing mutators from Brief use cases |
| SPEC-002 | ContextReader reads score — no rescore from Brief |
| SPEC-005 | AI invoked from services layer; Brief stores optional `aiAdvisoryRefs` |
| SPEC-006 | Claim review after draft — Brief does not call `claimSafetyCore` for authorization |
| SPEC-009 | Tenant envelope on persist — adapter validates org/client |

---

## Architecture bans (acceptance A25–A27)

1. No Firebase/React/HTTP in Domain Brief modules.
2. No `dbService` in Application use cases.
3. No strategic downstream create without Application authorization query.
4. No `getPrimaryThesis` / `[0]` thesis selection in Brief paths (A8).
5. No AI approval of Brief status.

---

## Composition root (target)

```text
src/composition/strategicBriefComposition.ts (or server equivalent)
  wires:
    CreateStrategicBrief(contextReader, briefRepo, historyPort)
    ApproveStrategicBrief(...)
    ...
```

UI imports use cases from composition — not concrete db.

---

## Persistence authority (Phase 0B)

Local-authoritative store acceptable for CODE_COMPLETE (consistent with SPEC-002 score history).

Remote Firestore Brief rules → SPEC-009 deployment — not blocking Domain/Application implementation.

---

## Physical history shape

**Current Brief document** + **append-only history collection** — no unbounded embedded arrays on Brief (A22).

Implementation detail Phase 3.
