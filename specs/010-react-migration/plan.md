# Plan 010 — React migration

**Baseline:** SPEC-008 CODE_COMPLETE final freeze `642ae9390700a254fa390ba09a959bab3c37d616`
**Branch:** `spec/010-react-migration`
**Status:** Phase 0 **COMPLETE** (T-010-010 **APPROVED** 2026-08-26 America/Bogota) ·
Phase 1 **COMPLETE** · Phase 2 **COMPLETE** (T-010-201…206 all **DONE**; AUDIT010-09 remains open) ·
Phase 3 **COMPLETE** (T-010-301…306 all **DONE**; 5 pages HYBRID, 0 fully cut over; AUDIT010-09
extended to 34 blocked writes) · Phase 4+ **NOT AUTHORIZED**

### Phase-3 outcome, stated plainly

Every one of the five migrated pages is **HYBRID**, and none qualifies for full
cutover. That is a finding about the codebase, not a shortfall in the migration:
§31 requires that all of a page's necessary commands be canonical before cutover,
and the Phase-3 screen established that canonical Application paths exist only
for signal routing, signal outcomes, strategic briefs, opportunities and result
intents. The remaining ~24 page-level writes go straight to `dbService`.

So Phase 3 migrated what could be migrated safely — all the read surfaces, and
the two page-level commands that were already canonical — and delegated the rest
visibly. Making any page a full cutover would require either inventing business
authority (forbidden) or hiding capability (forbidden). The formal change request
for ownership of those writes therefore remains **REQUIRED**, and it is the real
prerequisite for cutover, not more React work.

---

## Strategy

Incremental strangler migration of presentation only, governed by constitution §24 and constrained by §25.

**Non-negotiables:**

1. No big-bang rewrite (§25).
2. Behavior preserved before architecture improved (§24).
3. Business logic never rewritten to accommodate UI (§24).
4. React never enters Domain or Application (§22A — UI frameworks forbidden inward).
5. Legacy removed only after proven equivalence (§24 step 7).

## Phase sequence (1:1 with §24 steps)

| Phase | §24 step | Deliverable | Gate to exit |
|-------|----------|-------------|--------------|
| 0 | — | formal package | human T-010-010 |
| 1 | 1, 3 | React shell + data-access seam + trusted session | wave-1 architecture tests pass |
| 2 | 2 | leaf components in React | wave-2 parity evidence |
| 3 | 4 | major pages in React | wave-3 parity + boundary evidence |
| 4 | 5 | UI logic extracted; `main.ts` reduced | side-effect audit `GATE_FIRST` for migrated paths |
| 5 | 6 | parity, adversarial, security, E2E | 26/26 threats PASS |
| 6 | 7 | legacy removal + CODE_COMPLETE | A1–A44 PASS + human T-010-604 |

## Risk posture

| Risk | Mitigation |
|------|-----------|
| Big-bang pressure from `main.ts` size | decomposed across every wave; never rewritten in one step |
| Read-path divergence | one declared read source per module; compatibility reads labelled |
| Authority leaking into React | boundary architecture tests from wave 1, widened per wave |
| Cross-tenant cache bleed | trusted tenant scope mandatory in every query key |
| Capability loss during migration | 18-dimension parity model; legacy retained until the gate passes |
| Rollback damaging state | rollback switches presentation only; no data migration permitted |
| Silent security regression | SPEC-009 remains owner; rules tests unchanged and re-run |

## Sequencing rationale (evidence-based)

Wave 2 begins with the five components that have **zero** `dbService` reads
(`ClaimSafetyPanel`, `Login`, `PageHeader`, `MasterDossierPanel`, `OpportunityPanel`) and with
`OpportunityPanel`, which already reads exclusively through a canonical consumer. It is therefore the
lowest-risk reference implementation of the target read pattern. The most coupled surfaces
(`ClientWorkspace` at 2,562 lines / 25 `dbService` reads, `ClientPortal`, `Modals`) migrate only after the
seam is proven.

---

## AUDIT010 disposition (Phase 0)

| ID | Sev | Phase-0 disposition | Owning phase |
|----|-----|--------------------|--------------|
| ID | Sev | Phase-0 disposition | **Phase-1 disposition** | Owning phase |
|----|-----|--------------------|-------------------------|--------------|
| AUDIT010-01 | P2 | RESOLVED | **RESOLVED** (unchanged) | 0 |
| AUDIT010-02 | P2 | DESIGN_RESOLVED_IMPLEMENTATION_PENDING | **FOUNDATION_IMPLEMENTED** — exact §23 stack installed, Vite React integration working, build PASS | 1 ✔ |
| AUDIT010-03 | P2 | DESIGN_RESOLVED_IMPLEMENTATION_PENDING | **DESIGN_RESOLVED_IMPLEMENTATION_PENDING** (unchanged) — mount seam exists but **0** responsibilities extracted; 5,132 → 5,138 lines | 4 (T-010-401…404) |
| AUDIT010-04 | P2 | DESIGN_RESOLVED_IMPLEMENTATION_PENDING | **QUERY_SEAM_IMPLEMENTED_MIGRATION_PENDING** — canonical + compatibility facades live and enforced; 11 legacy components still read `dbService` directly | 2–3 |
| AUDIT010-05 | P3 | DESIGN_RESOLVED_IMPLEMENTATION_PENDING | **SEAM_IMPLEMENTED_MIGRATION_PENDING** — every React cache key now carries `organizationId`; the underlying legacy reads remain `clientId`-scoped | 2–3 |
| AUDIT010-06 | P3 | DESIGN_GOVERNED_IMPLEMENTATION_PENDING | **DESIGN_GOVERNED_IMPLEMENTATION_PENDING** (unchanged) — `Modals.ts` not migrated | 3 (T-010-302) |
| AUDIT010-07 | P3 | AUDIT_REQUIRED_IMPLEMENTATION_PENDING | **AUDIT_REQUIRED_IMPLEMENTATION_PENDING** (unchanged) — 3 wave-1 paths audited `GATE_FIRST`; the remaining `main.ts` paths are still unaudited and were not migrated | 4 (T-010-401) |
| AUDIT010-08 | P3 | DESIGN_RESOLVED_IMPLEMENTATION_PENDING | **E2E_FOUNDATION_IMPLEMENTED** — Playwright installed and configured, 5/5 foundation tests PASS | 1 ✔ |
| **AUDIT010-09** | **P3** | — | **NEW · LEGACY_COMMAND_WITHOUT_CANONICAL_USE_CASE** — invitation acceptance completes with legacy `dbService` business writes that have no canonical use case, so it cannot cross the React command seam; it stays on the legacy path | 2–3 |

**No finding is marked RESOLVED without evidence.** AUDIT010-03, -06 and -07 are deliberately unchanged:
Phase 1 built the seam they will eventually use but performed none of the migration or auditing they
require, and claiming progress would be false. AUDIT010-07 in particular still cannot be proven statically
across 5,132 lines, and **no runtime defect is claimed**.

**RUNTIME P0:** **0** · **RUNTIME P1:** **0** · **P2:** 3 · **P3:** 5
**PHASE-0 DESIGN BLOCKERS:** **0** · **PHASE-1 BLOCKERS:** **0**

### Phase-2 dispositions

| ID | Phase-1 disposition | **Phase-2 disposition** | Owning phase |
|----|--------------------|-------------------------|--------------|
| AUDIT010-01 | RESOLVED | **RESOLVED** (unchanged) | 0 ✔ |
| AUDIT010-02 | FOUNDATION_IMPLEMENTED | **FOUNDATION_IMPLEMENTED** (unchanged) | 1 ✔ |
| AUDIT010-03 | DESIGN_RESOLVED_IMPLEMENTATION_PENDING | **DESIGN_RESOLVED_IMPLEMENTATION_PENDING** (unchanged) — `main.ts` is 5,138 lines before and after Phase 2; **0** responsibilities extracted | 4 |
| AUDIT010-04 | QUERY_SEAM_IMPLEMENTED_MIGRATION_PENDING | **SEAM_ADOPTED_MIGRATION_PARTIAL** — the seam is now used by 8 real components (6 hooks, 1 canonical + 5 compatibility reads). The legacy components still read `dbService` directly because they were retained, not replaced | 3 |
| AUDIT010-05 | SEAM_IMPLEMENTED_MIGRATION_PENDING | **SEAM_ADOPTED_MIGRATION_PARTIAL** — every wave-2 key carries `organizationId`, proven at runtime; the underlying legacy reads remain `clientId`-scoped | 3 |
| AUDIT010-06 | DESIGN_GOVERNED_IMPLEMENTATION_PENDING | **DESIGN_GOVERNED_IMPLEMENTATION_PENDING** (unchanged) — `Modals.ts` not migrated. The one place a modal was needed (decline notes) was satisfied inline without migrating it | 3 |
| AUDIT010-07 | AUDIT_REQUIRED_IMPLEMENTATION_PENDING | **AUDIT_REQUIRED_IMPLEMENTATION_PENDING** (unchanged) — 5 further paths audited `GATE_FIRST`, but the remaining `main.ts` paths are still unaudited and were not migrated | 4 |
| AUDIT010-08 | E2E_FOUNDATION_IMPLEMENTED | **E2E_FOUNDATION_IMPLEMENTED** (unchanged) — Playwright now 10/10; full parity journeys remain Phase 5 | 1 ✔ |
| **AUDIT010-09** | NEW · registered (1 command) | **MIGRATION_BLOCKER_FOR_AFFECTED_CAPABILITY** — the Phase-2 screen extended the inventory from 1 to **10** commands across 5 components, each with a recorded disposition. **NOT RESOLVED**: leaving them legacy is correct handling, not closure | 3+ / other SPEC |

AUDIT010-09 grew because the screen worked, not because something regressed. The
finding's severity is unchanged at **P3**: no runtime defect, ordering sound in
every case, and no capability lost because every blocked action remains available
on the legacy surface.

**PHASE-2 BLOCKERS:** **0** · **PHASE-2 P0:** **0** · **PHASE-2 P1:** **0**

**T-010-205 reconciliation.** The first Phase-2 pass reported this task as
blocked, having attributed `main.ts`'s `applyOnboardingStep` handler to the
component. The Phase-0 matrix records `OnboardingWizard.ts` as **0 writes** and
assigns every UI command to `main.ts` (wave 1→4, Phase 4), so the write was never
inside the task's boundary. The component's presentation and its two
compatibility reads were migrated; the write stayed legacy, no canonical use case
was invented, and AUDIT010-09 remains open. Detail: `tasks.md`
§ *T-010-205 — formal reconciliation*.

### Phase-3 dispositions

| ID | Phase-2 disposition | **Phase-3 disposition** | Owning phase |
|----|--------------------|-------------------------|--------------|
| AUDIT010-01 | RESOLVED | **RESOLVED** (unchanged) | 0 ✔ |
| AUDIT010-02 | FOUNDATION_IMPLEMENTED | **FOUNDATION_IMPLEMENTED** (unchanged) | 1 ✔ |
| AUDIT010-03 | DESIGN_RESOLVED_IMPLEMENTATION_PENDING | **DESIGN_RESOLVED_IMPLEMENTATION_PENDING** (unchanged) — `main.ts` is 5,138 lines before and after Phase 3; **0** responsibilities extracted, asserted by test | 4 |
| AUDIT010-04 | SEAM_ADOPTED_MIGRATION_PARTIAL | **SEAM_ADOPTED_MIGRATION_PARTIAL** — the seam now serves 5 pages as well as 9 components (14 wave-3 queries; 11 new compatibility + 3 new canonical reads). The legacy pages still read `dbService` directly because they were retained, not replaced (§32) | 4–6 |
| AUDIT010-05 | SEAM_ADOPTED_MIGRATION_PARTIAL | **SEAM_ADOPTED_MIGRATION_PARTIAL** — every wave-3 key carries `organizationId`, proven at runtime across 14 resources; the underlying legacy reads remain `clientId`-scoped | 4–6 |
| **AUDIT010-06** | DESIGN_GOVERNED_IMPLEMENTATION_PENDING | **IMPLEMENTED_PARTIAL** — `Modals.ts` is decomposed: 7 of its 13 modals now exist as individual React components. The other 6 each hold a blocked legacy write and were not migrated | 4–6 |
| AUDIT010-07 | AUDIT_REQUIRED_IMPLEMENTATION_PENDING | **AUDIT_PARTIAL** — every command-bearing path on the five wave-3 pages was classified; all migrated paths are `GATE_FIRST` and **2 `EFFECT_FIRST`** paths were found and left legacy (render-time `runSourceDiscoveryAgent`). The remaining `main.ts` paths are still unaudited | 4 (T-010-401) |
| AUDIT010-08 | E2E_FOUNDATION_IMPLEMENTED | **E2E_FOUNDATION_IMPLEMENTED** (unchanged) — Playwright now 16/16; authenticated page journeys remain PARTIAL and full parity remains Phase 5 | 1 ✔ |
| **AUDIT010-09** | MIGRATION_BLOCKER_FOR_AFFECTED_CAPABILITY (10 commands) | **MIGRATION_BLOCKER_FOR_AFFECTED_CAPABILITY** — the Phase-3 page screen extended the inventory from 10 to **34** commands across 10 surfaces. **NOT RESOLVED** | 4+ / other SPEC |

AUDIT010-09 more than tripled because the screen covered 5,235 lines of legacy
pages holding the bulk of the application's writes. Its severity is unchanged at
**P3**: no runtime defect, ordering sound in every migrated case, and no
capability lost — every blocked action remains reachable on the legacy surface,
and each migrated page names the actions that still live there.

One new item was registered that is **not** an AUDIT010-09 case: brief creation
is blocked because its canonical consumer requires the caller to pass a
`CurationEntry` aggregate. Class
`CANONICAL_CONSUMER_REQUIRES_CALLER_AGGREGATE`, resolvable by an id-based
overload in SPEC-003 rather than by new business authority.

**PHASE-3 BLOCKERS:** **0** · **PHASE-3 P0:** **0** · **PHASE-3 P1:** **0** ·
**P2:** 2 · **P3:** 4

A discovery/runtime finding is distinct from a design blocker. P2/P3 debt remains open while migration is
incomplete; nothing is suppressed.

---

## Open decisions (must be recorded before Phase 2)

| Decision | Resolution | Task |
|----------|-----------|------|
| Routing/navigation library | **RESOLVED — NONE.** Legacy performs no URL routing (in-memory tab state); adding a router would create a second navigation authority during coexistence with no requirement. **Revisited in Phase 3 and reaffirmed:** migrating five pages produced no requirement for URL routing — no page reads or writes the URL, no deep link is expected, and tab state remained local presentation state. Asserted by test (no routing dependency, no `location`/`history` use in any page). | T-010-102 ✔ |
| React component-testing library | **RESOLVED — DEFERRED, none installed.** Foundation properties are proven by 27 architecture assertions and 5 Playwright tests; a DOM unit library would add tooling without new coverage. Revisit in Phase 2. | T-010-103 ✔ |
| Visual-regression testing | not constitutionally required; default **NO** | — (recorded, not adopted) |
| Observation-window length per wave | depends on wave surface | Phase 5 |

---

## Cross-SPEC freeze commitments

| SPEC | Commitment |
|------|-----------|
| 001–008 | modifications **0**; consumed read-only or via existing canonical boundaries |
| 008 | frozen @ `642ae939`; mutation authority target **0** |
| 009 | security owner; production **DEFERRED_UNCHANGED**; no rules changes without formal coordination |

## Definition of Done alignment (§28)

CODE_COMPLETE for SPEC-010 requires, per §28: specification approved · requirements implemented ·
typecheck · build · unit tests · integration tests · acceptance criteria · security requirements ·
no secret detected · documentation synchronized · **no unintended regression** · human review completed.

`parity-model.md` supplies the "no unintended regression" evidence for a UI migration, since compiling and
rendering are explicitly insufficient under §28.
