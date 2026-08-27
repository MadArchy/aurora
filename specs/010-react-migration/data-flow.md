# Data flow 010 — React migration

**Baseline:** SPEC-008 frozen @ `642ae9390700a254fa390ba09a959bab3c37d616`

---

## Current read flow (legacy — measured)

```text
legacy component  ──direct──►  dbService (localStorage)          11 of 16 components
legacy component  ──────────►  canonical consumer  ──►  Application  ──►  canonical store    4 components
main.ts           ──────────►  canonical consumer  ──►  Application  ──►  canonical store
main.ts           ──direct──►  dbService
```

Two read paths coexist with no declared authority per module. This is the divergence risk SPEC-010 must
close (AUDIT010-04).

## Target read flow

```text
React component
  → query hook                       (SPEC-010, non-authoritative)
  → UI data facade / canonical consumer or query port
  → Application use case
  → Ports
  → canonical store                  (AUTHORITATIVE)
```

Legacy compatibility reads, where no canonical projection exists yet:

```text
React component
  → query hook
  → explicit compatibility read facade   (declared LEGACY_COMPATIBILITY_READ)
  → dbService
```

The compatibility facade must be **explicitly named as compatibility**. It must never be presented as
canonical. Every module declares exactly **one** read source.

## Target command flow

```text
React intent (user action)
  → command hook                     (SPEC-010, non-authoritative)
  → canonical consumer / Application use case
  → trusted tenant + trusted actor resolved here, never in React
  → Domain validation + lifecycle gate
  → Ports
  → Infrastructure (canonical store)
  → query invalidation (presentation refresh only)
```

**Invalidation is a presentation concern.** A successful command's authority comes from the Application
result, never from the refetched cache.

---

## Authority per hop

| Hop | Authority |
|-----|-----------|
| React component | **NONE** |
| Query hook / command hook | **NONE** |
| Query cache | **NONE** |
| UI data facade | **NONE** (projection/compatibility only) |
| Canonical consumer | **NONE** — orchestrates, never decides |
| Application use case | **AUTHORITATIVE** — resolves trusted context, enforces gates |
| Domain | **AUTHORITATIVE** — invariants and lifecycle |
| Canonical store | **AUTHORITATIVE** persistence |
| `dbService` | **COMPATIBILITY** — non-authoritative for SPEC-003/004/006/007/008 |

---

## Trusted context resolution

```text
SPEC-009 auth (authService)
  → trusted session
  → React Context projection            [DISPLAY ONLY — not authority]
  → canonical consumer resolves trusted tenant + actor per command
```

React never supplies `organizationId`, `clientId`, `actorUid`, `actorType`, `role` or human/admin flags as
authority. A URL or UI selection may **request** a presentation context; the consumer validates it against
trusted session before use.

---

## Cross-SPEC read projections (all READ_ONLY)

```text
SPEC-001 routing state        → displayed; no reroute from React
SPEC-002 score/explainability → displayed; no local formula
SPEC-003 StrategicBrief       → strategicBriefConsumer
SPEC-004 StrategicPlan/Items  → strategicPlanConsumer
SPEC-006 claim safety         → displayed; React never verifies
SPEC-007 Opportunities        → opportunityScoutConsumer
SPEC-008 learning + recs      → learningLoopConsumer
```

## SPEC-008 human approval flow (must be preserved exactly)

```text
React UI intent (trusted human control)
  → learningLoopConsumer / canonical facade
  → trusted actor resolved from SPEC-009 auth
  → ApproveStrategicRecommendation            [HUMAN gate, SPEC-008 Domain]
  → APPROVED
```

Application of the approved change remains separate:

```text
  → ApplyApprovedRecommendation
  → TargetSpecApplyPort
  → owning SPEC
  → APPLIED | APPLY_FAILED | APPROVED_NOT_APPLIED
```

**Approval ≠ application.** React must never collapse them, and must never produce `APPROVED` by assigning
a status.

---

## Side-effect ordering requirement

For every side-effecting action, the required order is:

```text
authorization / validation gate  →  effect
```

Prohibited:

```text
effect  →  record / gate
```

Side-effect classes in scope: write, publication, notification, external call, target-SPEC mutation, AI
call, remote sync.

Current status: **0** ordering violations proven for canonical SPEC-007/008 paths;
**UNKNOWN** for portions of legacy `main.ts` (AUDIT010-07). Each path must be audited before migration —
see `ui-architecture.md` § *Side-effect ordering*.

---

## Prohibited flows

```text
React  ──✗──►  dbService strategic mutation
React  ──✗──►  Local*Store (any canonical store) direct
React  ──✗──►  Firestore direct
React  ──✗──►  AI provider endpoint or SDK
React  ──✗──►  target-SPEC persistence
React  ──✗──►  status = 'APPROVED' (or any lifecycle assignment)
query cache  ──✗──►  authority for a strategic decision
optimistic state  ──✗──►  canonical storage
stale cached aggregate  ──✗──►  mutation basis
React Context  ──✗──►  auth authority
form-supplied tenant/actor  ──✗──►  authority
```
