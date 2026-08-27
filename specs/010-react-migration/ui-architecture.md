# UI architecture 010 — React strangler

**Baseline:** SPEC-008 frozen @ `642ae9390700a254fa390ba09a959bab3c37d616`

Constitution: §22A hexagonal · §23 target stack · §24 migration rule · §25 big-bang prohibition.

---

## Target stack (§23 — exact, no substitution)

| Layer | Constitutional target | Present today |
|-------|----------------------|---------------|
| UI framework | **React** | ABSENT |
| Language | **TypeScript** | present (`typescript ^5.7.3`) |
| Build | **Vite** | present (`vite ^6.2.0`) |
| Server-state / query | **TanStack Query** | ABSENT |
| Forms | **React Hook Form** | ABSENT |
| Schema validation | **Zod** | present (`zod ^4.4.3`) |
| Unit/integration tests | **Vitest** | present (`vitest ^3.2.7`) |
| Rules tests | **Firebase Emulator Suite** | present |
| E2E / parity | **Playwright** | ABSENT |

**Not constitutional — decision required, must not be assumed:**

| Concern | Status |
|---------|--------|
| Routing library (e.g. React Router) | **DECISION_REQUIRED** — §23 names no routing library. Phase 1 must either justify one formally or implement navigation on the existing mechanism. |
| React testing library | **DECISION_REQUIRED** — not named in §23. |
| Visual-regression / screenshot testing | **NOT CONSTITUTIONALLY REQUIRED** — not formalized. Behavioral parity is mandatory; an expensive screenshot system is not invented. |

**Version pinning:** the constitution defines no version-pinning policy for frontend packages. Existing
repository convention uses caret ranges (`^`). Phase 1 follows repository convention; no versions are
pinned in Phase 0 because no dependency may be added.

---

## Constitutional migration order (§24 — preserved exactly)

Constitution §24 *REGLA DE MIGRACIÓN FRONTEND*, verbatim sequence:

1. Crear shell React compatible con servicios actuales.
2. Extraer componentes nuevos a React.
3. Mantener temporalmente servicios de dominio existentes.
4. Migrar página por página.
5. Extraer lógica de UI de servicios de dominio.
6. Mantener tests de regresión.
7. Eliminar legacy únicamente después de comprobar equivalencia.

Plus the binding constraints:

> Business Logic no debe ser reescrita únicamente para adaptar UI.
> Primero preservar comportamiento. Después mejorar arquitectura.

§25 *PROHIBICIÓN DE BIG-BANG REWRITE*: recreating AURORA wholesale is **prohibited**; the official
strategy is **Strangler / Incremental Migration**.

### Reconciliation with the baseline audit candidate list — DISCLOSED

`BASELINE_CONSTITUTION_AUDIT.md:352-363` lists "React Migration Candidates" in this order:
`src/main.ts` → `ClientWorkspace.ts` → `ClientPortal.ts` → `Modals.ts` → `ManagerCockpit.ts` →
`ThesisEditorModal/AppShell/OnboardingWizard/OpportunityPanel`, and states
*"Conservar y no reescribir primero: `src/domain/*`, tests Vitest, contratos Firestore."*

That list names `main.ts` first. Taken as a migration *sequence* it would mean rewriting the
5,132-line controller before anything else — the most big-bang-like action available, contradicting §24
(shell first, then new components, then page by page) and §25.

**Resolution:** §29 *SOURCE OF TRUTH HIERARCHY* places the Constitution above other technical documents.
Therefore:

- **§24 governs the sequence.**
- The audit list is treated as the **inventory and priority of surfaces to strangle**, ordered by size and
  coupling impact — not as an instruction to rewrite `main.ts` first.
- `main.ts` is decomposed **incrementally across every wave**, shrinking as pages migrate (§24 step 4),
  with its dedicated strangler phase at §24 step 5.

This reconciliation is recorded rather than silently resolved.

---

## Phase ↔ §24 step mapping

| Phase | §24 step | Scope |
|-------|----------|-------|
| 0 | — | Governance / architecture (this package) |
| 1 | **step 1** + step 3 | React shell compatible with current services; data-access seam; dependencies |
| 2 | **step 2** | Extract leaf/low-authority components to React |
| 3 | **step 4** | Page-by-page migration of major surfaces |
| 4 | **step 5** | Extract UI logic from services; `main.ts` strangler |
| 5 | **step 6** | Regression, parity, security/adversarial, E2E |
| 6 | **step 7** | Legacy removal after proven equivalence; CODE_COMPLETE |

---

## Strangler seam

### Mechanism

§24 step 1 requires a **React shell compatible with current services**, and step 4 requires page-by-page
migration. The seam is therefore a **mount-boundary model**, adopted in two stages:

```text
Stage A (Phases 1-3)   legacy shell (main.ts)  →  mounts React island(s)
Stage B (Phase 4)      React shell             →  mounts remaining legacy island(s)
```

Stage B is entered only when `main.ts` has been reduced to bootstrap/composition responsibility.

### Ownership rules — no competing ownership of the same DOM subtree

| Concern | Rule |
|---------|------|
| **Mount boundary** | Each React island owns exactly one explicitly declared DOM container. Legacy code must not write into that container. |
| **Unmount** | A React island must unmount cleanly, releasing listeners and query subscriptions; the legacy container is restored to a declared empty state. |
| **DOM ownership** | Exactly one owner per subtree. Dual ownership of a subtree is a formal threat (T-010-24). |
| **Event ownership** | The owner of a subtree owns its listeners. Legacy delegated listeners must not bind inside React-owned subtrees. |
| **Routing/navigation ownership** | Single navigation authority per stage: legacy in Stage A, React in Stage B. Never both. |
| **CSS ownership** | See § *CSS coexistence*. |
| **Error boundary** | Every React island is wrapped in an error boundary; a React failure must not corrupt the legacy shell. |
| **Feature toggle** | Each wave is switchable between legacy and React presentation — the rollback mechanism. |

---

## Authority model

### State categories

| Category | Authority | Owner | Lifetime | Persistence | Allowed mutation |
|----------|-----------|-------|----------|-------------|------------------|
| Canonical server/domain state | **AUTHORITATIVE** | SPEC-001…008 Application/Domain | durable | canonical stores | only via Application use cases |
| Query cache (TanStack Query) | **NONAUTHORITATIVE_CACHE** | SPEC-010 | session/GC | memory | invalidate/refetch only |
| Session projection | **NONAUTHORITATIVE** | SPEC-010, projects SPEC-009 auth | session | memory | re-read from trusted auth |
| Form state (React Hook Form) | **NONAUTHORITATIVE** | SPEC-010 | until submit/discard | ephemeral | free (pre-submit) |
| Local presentation state | **NONAUTHORITATIVE** | SPEC-010 | component life | ephemeral | free |
| Legacy compatibility state | **NONAUTHORITATIVE** | legacy `dbService` | durable | localStorage | via compatibility facade only |

### Read path

```text
React component
  → query hook (SPEC-010)
  → UI data facade / canonical consumer or query port
  → Application / canonical store
```

**Forbidden:** React → `dbService` direct · React → `Local*Store` direct · React → Firestore direct.

**TanStack Query is a cache/query orchestration layer, never authority.** No strategic decision may be
made because of `query.data[0]`, a stale cached recommendation, the last rendered value, or optimistic
state.

### Command path

```text
React intent
  → canonical consumer / Application use case
  → Domain
  → Ports
  → Infrastructure
```

**Forbidden:** React → `dbService` strategic mutation · React → `Local*Store` write · React → Firestore
write · React → target-SPEC persistence.

### Trusted tenant

React may **not** establish authoritative `organizationId` / `clientId` from form fields, URL or query
parameters. Tenant identity comes from canonical auth/runtime. URL or client state may **select
presentation context only after trusted validation**. Caller tenant authority target: **0**.

### Trusted actor

React may **not** establish `actorUid`, `actorType`, `role`, `HUMAN`, or manager/admin authority. Trusted
actor comes from canonical auth/runtime. Caller actor and role authority target: **0**.

### Stale state

UI **may display** stale data. UI commands may **not** use a stale cached aggregate as authority. Mutations
send canonical id/version; Application loads current state; Domain validates. This preserves the
SPEC-007/008 invariant *caller snapshot authority = 0*.

### Optimistic UI

If TanStack Query optimistic updates are used, they are **PRESENTATION ONLY**. Optimistic state cannot
approve, apply, publish, change lifecycle authority, or become canonical storage. Failure must reconcile
to canonical state.

### Forms

React Hook Form manages input state; Zod validates UI/schema input. **UI validation ≠ Domain validation.**
A form passing Zod must still pass every tenant, actor, lifecycle, strategic, target-SPEC and publication
gate in Application/Domain.

### Presentation defaults ≠ authority

Default selections are permitted only when explicitly classified non-authoritative. Existing precedent to
preserve:

- `ClientPortal.ts:541` `theses[0]` — annotated `ALLOWED_PRESENTATION_ONLY — does not write routing`
- `db.ts:1376` `getPrimaryThesis` — annotated `PRESENTATION_ONLY / LEGACY_COMPATIBILITY (SPEC-001 Phase 4)`
- `Modals.ts:772` `approvedBriefs[0]?.id` — form pre-selection default (AUDIT010-06)

**React rule:** a default selection is a *rendering* concern. The submitted command must carry an
explicit user-confirmed id, and Application must re-validate it. A default may never be the sole basis of
a strategic write.

### No business logic in hooks

Custom hooks may orchestrate UI and query concerns only. They must not duplicate Strategic Score formulas,
routing decisions, lifecycle transitions, publication gates, Opportunity scoring or Learning approval
logic. **Hooks are not Domain.**

---

## Query cache keys — tenant safety

AUDIT010-05: legacy reads are predominantly `clientId`-scoped, while canonical stores require
`(organizationId, clientId, entityId)`.

**Rule:** every query key must contain trusted tenant scope.

| Forbidden | Required shape |
|-----------|----------------|
| `["recommendation", recommendationId]` | trusted tenant scope + resource + entity scope |

Cross-tenant cache bleed must be impossible. The same entity id in two organizations must occupy distinct
cache entries. Tenant scope in a key must originate from trusted context, never from a URL parameter.

---

## Auth / session coexistence

Legacy UI and React must observe **one** trusted auth/session source (`authService`, SPEC-009 governed).
React Context may **project** session state. React Context does **not** become auth authority. A second
auth state authority is a formal threat (T-010-23).

---

## Error model

| Class | React rendering requirement |
|-------|----------------------------|
| Validation | field-level messages, association with inputs, no raw schema dumps |
| Authorization | controlled "not permitted" state; never a silent no-op |
| Tenant | controlled state; never reveal other-tenant existence |
| Stale state | prompt refetch/reconcile; never force-write |
| Network | retry affordance; distinguish from denial |
| Persistence | controlled failure; no partial-success claim |
| Domain conflict | surface the domain reason code, not the exception |
| Unsupported action | disabled/explained control |

Raw infrastructure internals (stack traces, adapter errors, provider payloads) must never be presented as
authority.

---

## CSS coexistence

- Legacy global styles in `src/styles/index.css` remain authoritative for legacy subtrees.
- React islands must not introduce global selectors that alter legacy subtrees.
- Legacy global selectors that leak into React islands are recorded per wave in `migration-matrix.md`.
- **No total CSS rewrite** is required or authorized by SPEC-010.
- Style ownership follows DOM ownership: the subtree owner owns its styling.

---

## Accessibility

Not a constitutional section; formalized here as a SPEC-010 quality requirement — migration must not
regress usability. Per migrated module: semantic controls, labels, keyboard operability, visible focus,
correct disabled state, and errors programmatically associated with their inputs.

---

## Performance

Non-authoritative evidence only: bundle size, lazy loading, duplicate query elimination, unnecessary
re-renders, startup behavior. No premature optimization. **No performance choice may bypass an
architectural boundary** — caching or memoization must never become authority.

---

## `main.ts` decomposition

Current responsibilities in one 5,132-line file:

| Responsibility | Target owner |
|----------------|--------------|
| Bootstrap / composition wiring | **stays** — minimal entrypoint |
| Navigation / view switching | React (Stage B) |
| Auth/session wiring | trusted auth projection (SPEC-009 unchanged) |
| DOM event binding | React components per wave |
| Render triggers / refresh orchestration | TanStack Query invalidation |
| Canonical consumer invocation | React command hooks (same consumers, unchanged) |
| Legacy module orchestration | shrinks per wave, then removed |
| Notifications / external side effects | retained services, invoked behind gates |

**End state:** a minimal bootstrap/composition entrypoint. Deletion of `main.ts` is **not** promised —
the constitution does not require it. What is required is that it ceases to be a controller/event bus.

**Invariant:** business/application authority does **not** move into React during decomposition. Each wave
*relocates UI orchestration* and *preserves* the canonical call.

---

## Side-effect ordering (AUDIT010-07)

Status: **AUDIT_REQUIRED_IMPLEMENTATION_PENDING**. Phase-0 static reading of a 5,132-line file cannot
prove ordering for all legacy command paths, and **no runtime defect is claimed without evidence**.
Canonical SPEC-007/008 paths were proven gate-before-effect in their own Phase 5.

**Requirement:** before migrating any `main.ts` command path, that path must be audited to identify its
canonical gate and its effect, and to prove:

```text
GATE → EFFECT
```

and never:

```text
EFFECT → RECORD/GATE
```

For each side-effecting action (write, publication, notification, external call, target-SPEC mutation, AI
call, remote sync) the audit records: gate location, effect location, ordering verdict
(`GATE_FIRST` / `EFFECT_FIRST` / `UNKNOWN`), and evidence. A path may not be migrated while its verdict is
`UNKNOWN`.

---

## Dual-authority prohibitions

| Prohibition | Rule |
|-------------|------|
| **No dual command authority** | A legacy button and a React button may both invoke the **same** canonical command. They must not implement separate command logic. |
| **No dual read authority** | Each module declares **one** read source. TanStack Query cache and `dbService` may never be treated as competing truth. |
| **No dual auth authority** | One trusted session source. |
| **No dual DOM ownership** | One owner per subtree. |
| **No duplicated domain logic** | Scoring, routing, lifecycle, opportunity and learning-approval logic exist once, in their owning SPEC. |
