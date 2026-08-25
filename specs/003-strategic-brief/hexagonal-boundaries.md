# Hexagonal boundaries 003 — Strategic Brief

---

## Target layering (Phase 4 — implemented)

```text
Interfaces / UI / consumers (main.ts, workspace, modals)
        ↓
Composition seam: src/services/strategicBriefConsumer.ts
  (authorizeStrategicDownstream, requireStrategicAuthorization,
   createBriefFromCurationEntry, approveStrategicBrief, list/get Brief)
        ↓
Composition root: src/composition/strategicBrief/composeStrategicBrief.ts
        ↓
Application (CreateStrategicBrief, ApproveStrategicBrief, ReviseStrategicBrief,
             RejectStrategicBrief, OverrideStrategicBrief, AuthorizeStrategicDownstream)
        ↓
Domain (strategicBriefCore, briefMaterialityCore, briefRoutingGateCore,
        briefTenantCore, briefConsumerCore)
        ↑
Ports ← Infrastructure (BriefRepository, history, override, StrategicContextReader)
```

**Rule:** Consumer asks Application. Application decides. UI does not authorize from `Brief.status` alone.

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
- destination → authorizedAction mapping helpers (`briefConsumerCore`)

**Must NOT import:**

- Firebase / Firestore
- React / Vite / Express / HTTP
- `dbService` / concrete DB
- AI provider SDKs / Gateway implementation
- `main.ts`

**Implemented modules:**

- `src/domain/strategicBriefCore.ts`
- `src/domain/strategicBriefErrors.ts`
- `src/domain/briefMaterialityCore.ts`
- `src/domain/briefRoutingGateCore.ts`
- `src/domain/briefTenantCore.ts`
- `src/domain/briefConsumerCore.ts` (Phase 4 mapping helpers)

Architecture evidence: `tests/strategicBriefArchitecture.test.ts`.

---

## Application

**Owns:**

- use case orchestration
- trusted actor + clock injection
- StrategicContextReader consumption (SPEC-001/002 read models)
- error taxonomy (`StrategicBriefError`)
- ports: `StrategicBriefRepository`, `StrategicBriefHistoryPort`, `StrategicContextReader`
- `AuthorizeStrategicDownstream` — sole strategic downstream authorization query

**Must NOT:**

- import concrete Firestore/db/React
- mutate SPEC-001 routing or SPEC-002 score fields
- call AI providers directly
- embed claim verification logic (SPEC-006)

**Use cases:**

| Use case | Responsibility |
|----------|----------------|
| `CreateStrategicBrief` | DRAFT from governed context |
| `ApproveStrategicBrief` | Human approval gate |
| `RejectStrategicBrief` | Explicit rejection |
| `ReviseStrategicBrief` | Material revision + supersede |
| `OverrideStrategicBrief` | Auditable governance override |
| `AuthorizeStrategicDownstream` | Query gate for Content/Task/Opportunity |

---

## Phase 4 consumer composition seam

**`src/services/strategicBriefConsumer.ts`** is the consumer-facing Application boundary used by `main.ts` / UI handlers.

| Export | Role |
|--------|------|
| `authorizeStrategicDownstream` / `requireStrategicAuthorization` | Gate strategic writes/generation |
| `formatAuthorizationDenial` | Controlled UX messages |
| `createBriefFromCurationEntry` / `approveStrategicBrief` | Minimum manager Brief workflow |
| `listStrategicBriefs` / `getStrategicBrief` | Read for UI display (not authority) |

**Explicit Phase-4 boundaries:**

| Concern | Authority |
|---------|-----------|
| Consumer authorize from `Brief.status` alone | **FORBIDDEN** — Application gate required |
| CurationEntry | Intake only — **NOT** strategic authority |
| DeliveryPackage | Packaging only — **NOT** strategic authority |
| `DeliveryPackage.strategicNote` | Presentation — **NOT** decision authority |
| `Signal.managerDecision` | Operational triage — **NOT** Strategic Decision |
| AI (`CONTENT_DRAFT`, `ADVISOR_CURATION_ANGLE`) | Advisory / drafting only |
| Claim verification | **SPEC-006** owns — SPEC-003 does not |

---

## Ports (neutral contracts)

| Port | Responsibility |
|------|----------------|
| `StrategicBriefRepository` | CRUD current Brief projection; tenant-scoped |
| `StrategicBriefHistoryPort` | Append-only material history |
| `StrategicContextReader` | Read Signal routing + scoring projections (no write). Thesis authority = `routingDecision.selectedThesisId` only. |
| `TrustedActorPort` | Resolve current actor for approve/override (optional if injected) |
| `ClockPort` | Trusted timestamps (optional) |

---

## Infrastructure

**Owns:**

- local store adapters (`postura_strategic_brief_v1`, `postura_strategic_brief_history_v1`, `postura_strategic_brief_override_v1`)
- `LocalStrategicBriefRepository` / history / override / `LocalStrategicContextReader`
- future Firestore adapter (SPEC-009 deploy track)
- wiring in `src/composition/strategicBrief/composeStrategicBrief.ts`

**Does NOT:** write routing/score fields, auto-DISCARD, verify claims, or authorize downstream without Application use cases.

---

## Interfaces / UI

**May:**

- invoke `strategicBriefConsumer` / Application use cases
- render Brief forms and approval UX
- filter Brief lists for display (e.g. APPROVED candidates)
- display explainability from Brief + history
- show controlled denial UX (Brief required / awaiting approval / superseded / action not authorized)

**Must NOT:**

- write Brief authority directly to db/localStorage as sole gate
- treat `brief.status === 'APPROVED'` as sole write authority without Application authorize
- bypass gate for strategic content / article / rec→task / sendDelivery / opportunity
- invent Brief authority from CurationEntry or DeliveryPackage

**Phase 5 remaining:** none for T-003-501 — expanded static architecture ban suite implemented in `tests/strategicBriefSecurityArchitecture.test.ts`. Adversarial evidence in `tests/strategicBriefPhase5.test.ts`.

---

## Relationship to adjacent specs

| Spec | Boundary |
|------|----------|
| SPEC-001 | ContextReader reads routing — Application never calls routing mutators from Brief use cases |
| SPEC-002 | ContextReader reads score — no rescore from Brief; recommendations advisory only |
| SPEC-005 | AI invoked from services layer after authorization on strategic paths; Brief stores optional `aiAdvisoryRefs` |
| SPEC-006 | Claim review after draft — Brief does not call `claimSafetyCore` for authorization |
| SPEC-009 | Tenant envelope on persist — adapter validates org/client; remote Brief rules deferred |

---

## Architecture bans (acceptance A25–A27)

1. No Firebase/React/HTTP in Domain Brief modules.
2. No `dbService` in Application use cases.
3. No strategic downstream create without Application authorization query.
4. No `getPrimaryThesis` / `[0]` thesis selection in Brief / strategic consumer authority paths (A8).
5. No AI approval of Brief status.

---

## Composition root

```text
src/composition/strategicBrief/composeStrategicBrief.ts
  wires:
    CreateStrategicBrief(contextReader, briefRepo, historyPort)
    ApproveStrategicBrief(...)
    RejectStrategicBrief / ReviseStrategicBrief / OverrideStrategicBrief
    AuthorizeStrategicDownstream

src/services/strategicBriefConsumer.ts
  → consumer-facing seam used by Phase-4 migrated callers
```

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

Phase 4 / Phase 3 packages:

- Application: `src/application/strategicBrief/` — evidence `tests/strategicBriefPhase2.test.ts`
- Infrastructure: `src/infrastructure/strategicBrief/` — evidence `tests/strategicBriefPhase3.test.ts`
- Consumer gate: `tests/strategicBriefPhase4.test.ts`, `tests/strategicBriefConsumerArchitecture.test.ts`
- Phase 5 security: `tests/strategicBriefSecurityArchitecture.test.ts`, `tests/strategicBriefPhase5.test.ts`
