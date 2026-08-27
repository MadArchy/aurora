# Plan 010 — React migration

**Baseline:** SPEC-008 CODE_COMPLETE final freeze `642ae9390700a254fa390ba09a959bab3c37d616`
**Branch:** `spec/010-react-migration`
**Status:** Phase 0 **COMPLETE** (T-010-010 **APPROVED** 2026-08-26 America/Bogota) ·
Phase 1 **COMPLETE** · Phase 2+ **NOT AUTHORIZED**

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

A discovery/runtime finding is distinct from a design blocker. P2/P3 debt remains open while migration is
incomplete; nothing is suppressed.

---

## Open decisions (must be recorded before Phase 2)

| Decision | Resolution | Task |
|----------|-----------|------|
| Routing/navigation library | **RESOLVED — NONE.** Legacy performs no URL routing (in-memory tab state); adding a router would create a second navigation authority during coexistence with no requirement. Revisit in Phase 3. | T-010-102 ✔ |
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
