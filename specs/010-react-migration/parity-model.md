# Parity model 010 — behavioral equivalence

Constitution §24 step 7: *"Eliminar legacy únicamente después de comprobar equivalencia."*
Constitution §24: *"Primero preservar comportamiento. Después mejorar arquitectura."*

**Behavioral equivalence is mandatory. Visual sameness is not.**

Pixel-perfect equivalence is **not** required — the constitution does not require it, and no
visual-regression system is constitutionally mandated. Deliberate visual improvement is permitted provided
behavior, authority and accessibility do not regress.

---

## Parity dimensions

Every migrated module must be evidenced across all applicable dimensions before cutover.

| # | Dimension | Requirement |
|---|-----------|-------------|
| 1 | **Rendered capability** | Every capability reachable in legacy is reachable in React (or its removal is formally approved) |
| 2 | **Navigation** | Entry points, deep links and back/forward behavior preserved |
| 3 | **Loading** | A declared loading state exists; no indefinite blank surface |
| 4 | **Empty state** | Same empty-state semantics and messaging intent |
| 5 | **Error state** | Each error class from `ui-architecture.md` renders a controlled state |
| 6 | **Tenant context** | Same tenant scoping; no broadening of visible data |
| 7 | **Permissions** | Same role-gated visibility and action availability |
| 8 | **Commands / actions** | Same set of commands, invoking the **same** canonical use case |
| 9 | **Disabled actions** | Actions disabled in legacy remain disabled, for the same reason |
| 10 | **Validation** | Same rejection outcomes; Domain remains authoritative |
| 11 | **Lifecycle presentation** | Same states shown; no invented or hidden state |
| 12 | **Multi-thesis behavior** | Explicit thesis scope preserved; no new first/primary authority |
| 13 | **Data freshness / revalidation** | Refresh semantics equivalent or better; stale data never used as command authority |
| 14 | **Legacy behavior** | Documented legacy quirks either preserved or formally accepted as changed |
| 15 | **Canonical behavior** | Canonical reads/commands unchanged — same consumer, same use case |
| 16 | **Rollback** | Reverting to legacy restores prior behavior with no data migration |
| 17 | **Accessibility** | Semantic controls, labels, keyboard operability, focus visibility, disabled state, error association — no regression |
| 18 | **Authority parity** | Caller tenant/actor/role/snapshot authority remain **0**; UI write authority remains **0** |

---

## Phase-3 page parity status (T-010-301…306)

All five wave-3 pages are **HYBRID**, so parity is claimed per dimension and per
page rather than as a single verdict. The distinction that governs the table:
where a legacy command intentionally stays outside React, the action-bearing
dimensions cannot be called PARITY, because the React surface does not perform
the action at all. Those dimensions are classified
**`DEFERRED_LEGACY_COMMAND`** — evidenced as *legacy retains the capability and
the React surface truthfully says so*, which is a different and weaker claim than
behavioral equivalence.

| # | Dimension | Status across the 5 pages | Evidence |
|---|-----------|---------------------------|----------|
| 1 | Rendered capability | ⚠️ **PARTIAL** — reads at parity; blocked actions reachable only in legacy | `E2E3`: the legacy pages owning the 34 blocked writes still work; `LegacyHandoff` names the action and links back |
| 2 | Navigation | ✔ **PARITY** | Tab state stays local presentation state; no page reads or writes the URL, asserted. Legacy had no deep links to preserve |
| 3 | Loading | ✔ **PARITY** (improved) | Every panel declares a loading state via `PanelState`; several legacy panels rendered blank while awaiting data |
| 4 | Empty state | ✔ **PARITY** | `PanelState` empty branch per panel |
| 5 | Error state | ✔ **PARITY** (improved) | Each read failure renders a controlled state; the legacy thesis editor silently fell through to *create new thesis* on an unknown id, which the React page reports as an error instead |
| 6 | Tenant context | ✔ **PARITY** | `P3`: all 14 keys tenant-scoped, collision-free; a scope without a client fails closed |
| 7 | Permissions | ⚠️ **PARTIAL** | No page renders without a trusted session (`E2E3`); role-gated visibility is inherited from the shell, and adversarial proof is Phase 5 |
| 8 | Commands / actions | ⚠️ **PARTIAL** — 7 canonical commands at parity, 34 `DEFERRED_LEGACY_COMMAND` | `P3`: the 7 reach the same consumer as legacy with ids only |
| 9 | Disabled actions | ✔ **PARITY** | Blocked actions render disabled or as a handoff with a truthful reason, never silently absent |
| 10 | Validation | ⚠️ **PARTIAL** | RHF + Zod check shape; the Domain still rejects. Full rejection-outcome comparison needs the migrated command, so it is `DEFERRED_LEGACY_COMMAND` for the blocked writes |
| 11 | Lifecycle presentation | ✔ **PARITY** | Statuses displayed from projections; `ARCH3` proves none is assigned |
| 12 | Multi-thesis | ✔ **PARITY** (improved) | Explicit selection replaces `theses[0]`, `awaiting[0] || ACTIVE || theses[0]`, `getActiveTheses(id)[0]` and `approvedBriefs[0]`. `ARCH3` proves no positional selection |
| 13 | Freshness | ✔ **PARITY** | `staleTime: 0`; commands carry ids, so cached data is never command authority |
| 14 | Legacy behavior | ⚠️ **PARTIAL** — 5 quirks formally accepted as changed | Unescaped `diffHtml` injection, the silent thesis-editor fallback, `approvedBriefs[0]`, `getActiveTheses(id)[0]`, and the two render-time agent runs. Each is recorded as a deliberate non-reproduction, not an oversight |
| 15 | Canonical behavior | ✔ **PARITY** | Same consumer, same use case; brief creation left unmigrated rather than reshaped |
| 16 | Rollback | ✔ **PARITY** | `E2E3`: rollback leaves business storage byte-identical; 0 legacy removed |
| 17 | Accessibility | ⚠️ **PARTIAL** | Semantic controls, labels, disabled state and error association present; no audit tooling run — Phase 5 |
| 18 | Authority parity | ✔ **PARITY** | Caller tenant/actor/role/snapshot authority **0**; UI write authority **0**, asserted by `ARCH3` + `P3` |

**Parity verdict:** 12 of 18 dimensions at PARITY, 6 PARTIAL, 0 FAIL. **No page is
declared FULL CUTOVER**, and the parity gate for legacy deletion is therefore not
met for any wave-3 page — as intended, since deletion is Phase 6.

Authenticated page-level E2E is **PARTIAL**: no seeded credentials are formally
available in this environment, so authenticated behavior is evidenced by the
Vitest suites exercising the same seams. Stated rather than papered over; full
parity remains Phase-5 work (A41).

---

## Evidence types

| Evidence | Tool | Scope |
|----------|------|-------|
| Unit / component behavior | Vitest | per component |
| Architecture / boundary purity | Vitest (`*Architecture.test.ts` convention) | per wave, scoped to migrated paths |
| Canonical call equivalence | Vitest — assert the same consumer/use case is invoked with equivalent intent | per command |
| Tenant isolation | Vitest + rules tests | per wave |
| Critical user journeys | **Playwright** | per page |
| Legacy vs React behavior | **Playwright** — same journey against both implementations | per wave |
| Rollback | **Playwright** — toggle back and re-run the journey | per wave |

Existing Vitest suites are **maintained unchanged** throughout (§24 step 6). No test is created in Phase 0.

---

## Playwright strategy (AUDIT010-08)

Playwright is the constitutional E2E tool (§23 Testing) and is **absent**. It is installed in Phase 1
(T-010-104), never in Phase 0.

Planned suites:

| Suite | Purpose |
|-------|---------|
| Legacy-vs-React behavior | run the same journey against both implementations and compare observable behavior |
| Navigation | entry points, deep links, history |
| Critical user journeys | manager workspace, client portal, onboarding, thesis editing, curation/delivery |
| Tenant isolation | two organizations, same entity ids — no bleed in UI or cache |
| Human approval paths | SPEC-008 recommendation approval remains trusted-human-only |
| Errors / loading | each error class renders its controlled state |
| Migration rollback | toggle to legacy mid-journey; canonical state unchanged |

**No paid AI is invoked by any parity test.**

---

## Parity gate — legacy deletion conditions

A legacy component may be deleted **only** when **all** hold:

1. React implementation exists and is served
2. Focused Vitest tests pass for the React module
3. Behavioral-equivalence evidence exists across all applicable dimensions above
4. Canonical authority unchanged — same consumer/use case, no new authority in React
5. Tenant and security checks pass (including rules tests where relevant)
6. Rollback plan exists and has been exercised
7. The mapped acceptance criterion passes
8. For any migrated `main.ts` command path: side-effect ordering verdict is `GATE_FIRST`

Until every condition holds, **legacy remains available**.

**Prohibited sequence:**

```text
rewrite → delete legacy → hope parity exists
```

**Required sequence (§24 step 7):**

```text
implement → coexist → prove parity → cut over → observe → remove legacy
```

---

## Observation window

After cutover and before legacy removal, each wave holds an explicit observation period in which the
React implementation is served while legacy remains present and revertible. Removal requires the wave's
parity evidence to still hold at the end of that window. The window's length is set per wave in Phase 5;
it is not fixed in Phase 0.

---

## Performance evidence (non-authoritative)

Recorded per wave, never used to justify a boundary bypass: bundle size delta, lazy-loading behavior,
duplicate query count, unnecessary re-render count, startup behavior. No premature optimization.
