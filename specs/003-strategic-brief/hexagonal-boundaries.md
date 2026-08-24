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

Architecture evidence: `tests/strategicBriefArchitecture.test.ts`.

**Phase 2 Application package (implemented):**

- `src/application/strategicBrief/`
- evidence: `tests/strategicBriefPhase2.test.ts`, `tests/strategicBriefApplicationArchitecture.test.ts`

**Phase 3 Infrastructure package (implemented):**

- `src/infrastructure/strategicBrief/`
- `src/composition/strategicBrief/composeStrategicBrief.ts`
- evidence: `tests/strategicBriefPhase3.test.ts`, `tests/strategicBriefInfrastructureArchitecture.test.ts`

Phase 4 consumer migration **NOT STARTED**.

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

- local store adapters (`postura_strategic_brief_v1`, `postura_strategic_brief_history_v1`, `postura_strategic_brief_override_v1`)
- `LocalStrategicBriefRepository` / `LocalStrategicBriefHistoryAdapter` / `LocalStrategicContextReader`
- future Firestore adapter (SPEC-009 deploy track)
- wiring in `src/composition/strategicBrief/composeStrategicBrief.ts`

**Pattern:** mirror `DbStrategicScoringAdapter` / `DbStrategicSignalRoutingAdapter`.

**Does NOT:** write routing/score fields, auto-DISCARD, verify claims, or hook UI/main.ts.

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

## Composition root (Phase 3)

```text
src/composition/strategicBrief/composeStrategicBrief.ts
  wires:
    CreateStrategicBrief(contextReader, briefRepo, historyPort)
    ApproveStrategicBrief(...)
    RejectStrategicBrief / ReviseStrategicBrief / OverrideStrategicBrief
    AuthorizeStrategicDownstream
```

UI is **not** wired in Phase 3. Callers supply the SPEC-001/002 read source. Application remains free of `dbService`.

---

## Persistence authority (Phase 3)

Local-authoritative store is the CODE_COMPLETE persistence model.

- Current projection: `postura_strategic_brief_v1` (`brief-store-v1`)
- History: `postura_strategic_brief_history_v1` (`brief-history-store-v1`)
- Override audit: `postura_strategic_brief_override_v1` (`brief-override-store-v1`)
- **Local atomicity:** one in-memory write-unit apply + persist of all three keys. Not a distributed Firestore transaction.
- Remote Firestore Brief rules → **FUTURE_NONBLOCKING / SPEC-009**

---

## Physical history shape

**Current Brief document** + **append-only history collection** + **append-only override audit** — no unbounded embedded arrays on Brief (A22). Phase 3 implemented.
