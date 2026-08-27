# Spec 010 — React migration

| Field | Value |
|-------|--------|
| **Spec ID** | `010-react-migration` |
| **Display name** | **SPEC-010 — React migration** |
| **Status** | **`APPROVED`** · Phase 0 **COMPLETE** · human approval **APPROVED** (T-010-010, 2026-08-26 America/Bogota) |
| **Phase** | Phase 0 **COMPLETE** · Phase 1 **COMPLETE** · Phase 2 **COMPLETE** (T-010-201…206 all **DONE**) · Phase 3 **COMPLETE** (T-010-301…306 all **DONE**; 5 pages HYBRID, 0 fully cut over) · Phase 4+ **NOT AUTHORIZED** · deployment **NOT_STARTED** |
| **Branch** | `spec/010-react-migration` |
| **Baseline SHA** | SPEC-008 CODE_COMPLETE final freeze `642ae9390700a254fa390ba09a959bab3c37d616` |
| **Priority** | P2 — terminal SPEC in the constitutional dependency graph |
| **Constitution** | §22A hexagonal · §23 target stack · §24 frontend migration rule · §25 big-bang prohibition · §26 spec-driven |
| **Constitutional position** | **10th / terminal** — `010-react-migration` in §26; dependency graph ends `008-learning → 010-react-migration` |
| **Depends on** | SPEC-001…008 stable domain contracts (**all CODE_COMPLETE or frozen**); SPEC-009 (security owner; production DEFERRED) |
| **Blocks** | Nothing — terminal SPEC |
| **Test baseline (Phase 0)** | `npm run check` **1467/1467 PASS** · `npm run test:rules` **91/91 PASS** — unchanged by Phase 0 |
| **Test baseline (Phase 1)** | `npm run check` **1494/1494 PASS** · `npm run test:rules` **91/91 PASS** · `npm run build` **PASS** · Playwright **5/5 PASS** |
| **Test baseline (Phase 2)** | `npm run check` **1546/1546 PASS** · `npm run test:rules` **91/91 PASS** · `npm run build` **PASS** · Playwright **10/10 PASS** |
| **Test baseline (Phase 3)** | `npm run check` **1592/1592 PASS** · `npm run test:rules` **91/91 PASS** · `npm run build` **PASS** · Playwright **16/16 PASS** |
| **Human SPEC approval** | **APPROVED** — T-010-010, 2026-08-26 (America/Bogota) |

**Title provenance (HIGH confidence):** `POSTURA_CONSTITUTION.md:847` and `specify/memory/constitution.md:847`
(byte-identical files) declare `010-react-migration/`. `docs/audits/BASELINE_CONSTITUTION_AUDIT.md:331/348/413`
names it "React migration — strangler por módulo UI". Six frozen specs declare "React migration (SPEC-010)"
as out-of-scope. No conflicting name, alias or legacy identifier exists.

---

## Problem

The POSTURA UI is vanilla TypeScript that renders by string concatenation and is orchestrated by a single
controller/event bus.

| Surface | Measured size |
|---------|---------------|
| `src/main.ts` | **5,132 lines** |
| `src/components/**` (16 files) | **6,873 lines** |
| **Total legacy UI** | **12,005 lines** |

Two structural facts make this a migration problem rather than a cosmetic one:

1. **`src/main.ts` is a 5,132-line controller/event bus.** It owns bootstrap, navigation, auth/session
   wiring, DOM event binding, render triggers, consumer invocation and legacy orchestration in one file.
   `BASELINE_CONSTITUTION_AUDIT.md:356` estimated ~4,200 lines; it has since grown ~22%.
2. **11 of 16 components import the legacy `dbService` singleton directly for reads.** There is no
   UI-facing query boundary, so no component can be moved without either dragging `dbService` with it or
   inventing an ad-hoc data path.

At Phase-0 time the constitutional target stack (§23) was **entirely absent**: `package.json` declared no
`react`, `react-dom`, `@tanstack/react-query`, `react-hook-form`, `@vitejs/plugin-react` or Playwright,
and runtime dependencies were only `firebase` and `zod`. **Phase 1 installed the exact stack**
(AUDIT010-02 → `FOUNDATION_IMPLEMENTED`); the two structural facts above remain unchanged, because Phase 1
built the seam rather than migrating the surfaces.

The domain, however, is ready — which is precisely the precondition the constitution sets
("React (`010`) no antes de contratos de dominio estables"):

- `src/domain/**` has **0** imports of Firebase, Firestore, `localStorage` or `dbService`
- **0** generic `setStatus`/`updateStatus` mutators exist anywhere in `src`
- UI components perform **0** writes — they are pure render functions
- 4 components already read through canonical consumers (`opportunityScoutConsumer`,
  `strategicBriefConsumer`, `learningLoopConsumer`)

## Goal

Incrementally replace vanilla-TypeScript rendering and controller-driven UI with the constitutionally
approved React stack, **preserving behavior and every existing strategic authority boundary**.

**Core principle:**

> **UI MIGRATION ≠ BUSINESS LOGIC REWRITE.**
> **UI MIGRATION ≠ AUTHORITY MIGRATION.**
> **UI MIGRATION ≠ PERSISTENCE MIGRATION.**

React is a **presentation technology**. Constitution §24: *"Business Logic no debe ser reescrita únicamente
para adaptar UI. Primero preservar comportamiento. Después mejorar arquitectura."*

## Non-Goals

SPEC-010 does **not**:

- rewrite, redesign or "improve" business logic to suit React
- migrate canonical persistence (no Firestore migration because React arrives)
- redefine RBAC, authentication, tenant authority or security rules (SPEC-009 owns these)
- modify any frozen SPEC-001…009 implementation
- introduce a big-bang rewrite (§25 — **prohibited**)
- take ownership of routing decisions, scoring, brief/plan lifecycle, opportunity lifecycle,
  learning approval, claim verification or publication authorization
- guarantee pixel-perfect visual equivalence (behavioral equivalence is the requirement)

## Actors

| Actor | Role in SPEC-010 |
|-------|------------------|
| Manager / admin (human) | Uses migrated UI; authority unchanged, sourced from trusted auth |
| Client (human) | Uses migrated portal; authority unchanged |
| React UI (software) | **Presentation only** — zero strategic authority |
| Canonical consumers / Application | Sole read and command authority |
| AI (SPEC-005) | Advisory only; never reachable directly from React |

## Preconditions

- SPEC-001…008 contracts stable (satisfied — SPEC-008 CODE_COMPLETE, freeze active)
- SPEC-009 remains security owner; production **DEFERRED_UNCHANGED**
- Human SPEC-010 approval (T-010-010) before any Phase-1 work
- No dependency installation before Phase 1

## Functional Requirements

**FR-1 Target stack.** React · TypeScript · Vite · TanStack Query · React Hook Form · Zod (§23), with
Playwright for E2E/parity evidence (§23 Testing). No substitution without a constitution amendment.

**FR-2 Strangler.** Migration unit = one bounded UI module. Legacy and React UI may coexist; business
authority may not be duplicated.

**FR-3 React shell.** A React shell compatible with current services must exist before module migration
(§24 step 1).

**FR-4 Data-access seam.** React components must read through a UI-facing query boundary that delegates to
canonical consumers/Application. Direct `dbService` imports from React modules: target **0**.

**FR-5 Command path.** React intent → canonical consumer/Application use case → Domain → Ports →
Infrastructure. No other write path.

**FR-6 Trusted context.** Tenant and actor identity come from canonical auth/runtime, never from form
fields, URL or query parameters.

**FR-7 Multi-thesis.** No authoritative `theses[0]`, `primaryThesisId`, `getPrimaryThesis`, first-thesis or
implicit score winner. Presentation defaults must be explicitly classified as non-authoritative.

**FR-8 Parity before removal.** Legacy implementation is removed only after proven behavioral equivalence
(§24 step 7).

**FR-9 main.ts strangler.** Each migration wave removes responsibility from `main.ts`. It must cease to be
a 5,132-line controller/event bus.

**FR-10 Rollback.** Every wave can revert presentation implementation without changing canonical business
state.

## Business Rules

SPEC-010 introduces **no business rules**. All business rules remain owned by SPEC-001…008.

The single SPEC-010 rule is a negative one: **no business rule may be expressed in React code** —
not in components, not in hooks, not in query selectors, not in form validation.

## Data Model

**SPEC-010 has NO business-domain aggregate.**

No `domain-model.md` is created, because the repository shows no SPEC-010 domain entity and inventing one
for package symmetry would be false. SPEC-010 owns **UI state categories** only, defined in
`ui-architecture.md`:

| Category | Authority | Persistence |
|----------|-----------|-------------|
| Canonical server/domain state | **AUTHORITATIVE** (owned by SPEC-001…008) | canonical stores |
| Query cache (TanStack Query) | **NONAUTHORITATIVE** | memory only |
| Session projection | **NONAUTHORITATIVE** (projects trusted auth) | memory only |
| Form state (React Hook Form) | **NONAUTHORITATIVE** | ephemeral |
| Local presentation state | **NONAUTHORITATIVE** | ephemeral |
| Legacy compatibility state | **NONAUTHORITATIVE** | `dbService` localStorage |

Constitution §22A forbids UI frameworks in Domain and Application. React may therefore never be imported
by `src/domain/**` or `src/application/**`.

## State Transitions

SPEC-010 defines **no business lifecycle**. It must not add one.

The only SPEC-010 state machine is the **migration state of a UI module**, per
`migration-matrix.md`:

```text
LEGACY_ONLY
  → REACT_IMPLEMENTED (coexisting, legacy still authoritative presentation)
  → PARITY_PROVEN
  → REACT_CUTOVER (React is the served presentation; legacy retained)
  → LEGACY_REMOVED
```

Rollback moves `REACT_CUTOVER → LEGACY_ONLY` without touching canonical business state.
`LEGACY_REMOVED` is reachable only from `REACT_CUTOVER` after the parity gate passes.

## Error Cases

Formalized in `ui-architecture.md` § *Error model*. React must distinguish and render controlled states
for: validation, authorization, tenant, stale state, network, persistence, domain conflict, unsupported
action. Raw infrastructure internals must never surface as authority.

## Security Requirements

- **SPEC-009 remains the security owner.** SPEC-010 cannot redefine RBAC or modify rules.
- Caller tenant authority = **0**; caller actor authority = **0**; caller role authority = **0**;
  caller snapshot authority = **0**
- Query cache keys must carry trusted tenant scope — cross-tenant cache bleed must be impossible
- One trusted auth/session source; React Context projects it and never becomes auth authority
- Zod UI validation never substitutes for Domain validation or any strategic gate
- Direct AI provider access from React: **0** (SPEC-005 gateway only)

## Observability Requirements

Per §23: Cloud Logging, Cloud Monitoring, OpenTelemetry, Sentry are the constitutional targets. SPEC-010
adds no new observability authority. Frontend error boundaries must report without exposing tenant data or
secrets. Parity evidence (Phase 5) is the primary migration observability artifact.

## Acceptance Criteria

See `acceptance.md` — **44 criteria (A1–A44)**, derived from the requirements above. Count is derived, not
chosen for symmetry with other SPECs.

## Tests

Preserve the existing Vitest architecture/unit/regression suites unchanged (§24 step 6: *"Mantener tests de
regresión"*). Phase-5 adds parity and adversarial suites; Playwright becomes the E2E/parity harness
(Phase 1 dependency work). No test is created in Phase 0.

## Migration Impact

| Area | Impact |
|------|--------|
| `src/domain/**` | **KEEP** — audit: *"Conservar y no reescribir primero"* |
| Vitest suites | **KEEP** |
| Firestore contracts | **KEEP** |
| `src/application/**`, `src/infrastructure/**`, `src/composition/**` | **OTHER_SPEC** — unchanged |
| `src/services/db.ts` (`dbService`) | **COMPATIBILITY** — direct React imports removed; deletion not promised |
| `src/main.ts` | **MIGRATE** — incremental strangler to minimal bootstrap/composition entrypoint |
| 16 components | **MIGRATE / ADAPT** per `migration-matrix.md` |
| `package.json` / lockfile | Phase-1 dependency work — **untouched in Phase 0** |

---

## Authority owned by SPEC-010

React application shell · UI composition · presentation state · view state · form state · navigation state ·
query/cache orchestration · component lifecycle · progressive module migration · behavioral-equivalence
proof · frontend rollout and rollback.

## Authority explicitly NOT owned

Signal routing (SPEC-001) · Strategic Score (SPEC-002) · StrategicBrief (SPEC-003) ·
StrategicPlan/PlanItem (SPEC-004) · AI provider authority (SPEC-005) · Claim verification and publication
authorization (SPEC-006) · Opportunity lifecycle (SPEC-007) · Learning Loop and StrategicRecommendation
approval (SPEC-008) · canonical persistence · tenant authority · authentication authority · production
security rules (SPEC-009).

## UI authority

UI = **INTENT / DISPLAY ONLY**.

React cannot record authoritative state, approve anything by assigning a status, apply strategic change,
or choose trusted actor/tenant. Current measured UI write authority is already **NONE** (0 status
assignments, 0 `dbService` mutators in `src/components/**`); SPEC-010 must preserve that at 0.
