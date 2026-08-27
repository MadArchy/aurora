# Acceptance 010 — React migration

**Phase 0:** **COMPLETE** · Human SPEC approval **APPROVED** (T-010-010, 2026-08-26 America/Bogota)
**Phase 1:** **COMPLETE** — React foundation, shell, strangler seams, query/command boundaries, E2E foundation
**Phase 2+:** **NOT AUTHORIZED**
**A1-A44:** **7 PASS** · **24 PARTIAL** · **0 FAIL** · **13 PENDING**
**CODE_COMPLETE:** **NO**
**DEPLOYED:** **NO** · **DONE:** **NO** · **DEPLOYMENT:** **NOT_STARTED**

Spec **APPROVED** — T-010-010 human SPEC approval **RECORDED**.
Spec **CODE_COMPLETE** requires Required (A\*) full PASS + human sign-off (T-010-604) — **NOT STARTED**.

**Human SPEC approval model:** TASK-LEVEL only (T-010-010).
**Human CODE_COMPLETE model:** TASK-LEVEL only (T-010-604).
**Baseline:** SPEC-008 CODE_COMPLETE final freeze `642ae9390700a254fa390ba09a959bab3c37d616`
**Branch:** `spec/010-react-migration`

**Acceptance count = 44.** Derived from the functional, security and migration requirements in `spec.md`
and the boundary rules in `ui-architecture.md` / `hexagonal-boundaries.md`. The count is **not** chosen for
symmetry with other SPECs.

Only criteria provable by Phase-0 governance evidence are marked PASS. Everything requiring
implementation is **PENDING** — no implementation is authorized.

---

## Required (implementation → CODE_COMPLETE)

| # | Criterion | Phase | Status | Evidence target |
|---|-----------|-------|--------|-----------------|
Status legend — ✅ **PASS** fully evidenced · ⚠️ **PARTIAL** evidenced for the foundation/wave-1 scope,
open for later waves or Phase-5 adversarial proof · ⏳ **PENDING** no evidence yet.

`ARCH` = `tests/reactMigrationPhase1Architecture.test.ts` (27/27 PASS) ·
`E2E` = `e2e/strangler-foundation.spec.ts` (5/5 PASS).

| # | Criterion | Phase | Status | Evidence |
|---|-----------|-------|--------|----------|
| A1 | Constitutional purpose documented as incremental React strangler UI migration | 0 | ✅ PASS | `spec.md` + §23/§24/§25/§26 |
| A2 | Target stack exact — React · TypeScript · Vite · TanStack Query · React Hook Form · Zod (+ Playwright E2E); no substitution | 0–1 | ✅ PASS | T-010-101: exact stack installed, versions recorded, no substitution, Vite not upgraded; build PASS |
| A3 | Big-bang rewrite prohibited; strangler is the only sanctioned strategy | 0–1 | ✅ PASS | §25 + coexisting implementations behind the toggle; legacy untouched and still served |
| A4 | Constitutional §24 seven-step order preserved verbatim and mapped to phases | 0–1 | ✅ PASS | `ui-architecture.md` § phase mapping — all 7 steps mapped, order preserved |
| A5 | Behavior preserved before architecture improved; business logic not rewritten to suit UI | 1–6 | ⚠️ PARTIAL | `E2E`: legacy fully operational after a React round trip; 0 business-logic files changed. Per-module parity is Phase 5 |
| A6 | UI authority = presentation/intent only; UI write authority remains 0 | 1–6 | ⚠️ PARTIAL | `ARCH`: no lifecycle-status assignment, no persistence write in `src/ui/**`. Later waves open |
| A7 | SPEC-010 owns no business-domain aggregate and adds no business lifecycle | 0–1 | ✅ PASS | No `domain-model.md`; no lifecycle added by Phase 1 |
| A8 | React modules import `dbService` directly: **0** | 2–6 | ⚠️ PARTIAL | `ARCH`: **0** in `src/ui/**` except the one declared compatibility facade. Scope widens per wave |
| A9 | Canonical read boundary — every React read goes through a query hook → facade/consumer → Application | 1–6 | ⚠️ PARTIAL | `canonicalReads.ts` via `opportunityScoutConsumer`; all wave-1 reads go through hooks |
| A10 | Canonical command boundary — React intent → consumer/Application → Domain → Ports → Infrastructure | 1–6 | ⚠️ PARTIAL | `commandSeam.ts` delegates to trusted auth; `ARCH` proves no direct persistence. Strategic commands pending |
| A11 | TanStack Query cache is non-authoritative; no strategic decision from cached data | 2–6 | ⚠️ PARTIAL | `ARCH`: `staleTime: 0`, `retry: 0`, cache labelled non-authoritative. Adversarial proof T-010-502 |
| A12 | React local/presentation state non-authoritative | 2–6 | ⚠️ PARTIAL | Wave-1 state is tab/filter only; no authority derived from it |
| A13 | Form state non-authoritative; Zod UI validation never bypasses Domain gates | 2–6 | ⚠️ PARTIAL | `ReactLogin` + `ReactOnboardingWizard`: Zod checks shape, trusted auth / the domain still decide. Adversarial proof T-010-501 |
| A14 | Optimistic UI state non-authoritative; failure reconciles to canonical state | 2–6 | ⚠️ PARTIAL | `ARCH`: wave 1 introduces **0** optimistic mutations |
| A15 | Stale cached aggregate never used as mutation authority; caller snapshot authority 0 | 2–6 | ⚠️ PARTIAL | `staleTime: 0`; no wave-1 command consumes a cached aggregate. Adversarial proof T-010-502 |
| A16 | Trusted tenant — React cannot establish `organizationId`/`clientId`; caller tenant authority 0 | 1–6 | ⚠️ PARTIAL | `ARCH`: branded `TrustedTenantScope`, sole constructor takes the trusted `User`; fail-closed when absent |
| A17 | Trusted actor — React cannot establish `actorUid`/`actorType`/role/HUMAN; caller actor authority 0 | 1–6 | ⚠️ PARTIAL | `ARCH`: session projection has no setter; no actor literal in `src/ui/**` |
| A18 | Caller role authority 0 — no admin/manager escalation from UI | 1–6 | ⚠️ PARTIAL | `ARCH`: no `role: 'ADMIN'` / `isAdmin = true` assignment in `src/ui/**` |
| A19 | Tenant-safe query keys — every key carries trusted tenant scope; no cross-tenant cache bleed | 2–6 | ⚠️ PARTIAL | `ARCH`: factory requires a trusted scope; no bare entity-only key exists. Runtime bleed test T-010-502 |
| A20 | Multi-thesis native — no authoritative `theses[0]`/`primaryThesisId`/`getPrimaryThesis`/score winner | 2–6 | ⚠️ PARTIAL | `ARCH`: none present in `src/ui/**`; thesis selector defaults to explicit "all" |
| A21 | Presentation defaults explicitly non-authoritative; command carries a confirmed, revalidated id | 2–6 | ⏳ PENDING | `Modals.ts` not migrated (T-010-302) |
| A22 | SPEC-001 preserved — React displays routing, owns no routing decision | 2–6 | ⏳ PENDING | boundary tests |
| A23 | SPEC-002 preserved — no scoring formula recreated in components/hooks | 2–6 | ⏳ PENDING | boundary tests (T-010-20) |
| A24 | SPEC-003 preserved — Brief consumed via canonical consumer; no lifecycle duplication | 2–6 | ⏳ PENDING | boundary tests |
| A25 | SPEC-004 preserved — Plan/PlanItem via canonical Application boundary | 2–6 | ⏳ PENDING | boundary tests |
| A26 | SPEC-005 preserved — direct AI provider access from React: **0** | 1–6 | ⚠️ PARTIAL | `ARCH`: **0** provider imports or endpoints in `src/ui/**` |
| A27 | SPEC-006 preserved — React never verifies claims or authorizes publication | 2–6 | ⏳ PENDING | boundary tests |
| A28 | SPEC-007 preserved — no recreation of OpportunityScore / lifecycle / Materialize | 2–6 | ⏳ PENDING | boundary tests (T-010-21) |
| A29 | SPEC-008 preserved — no auto-approve, no auto-apply, no `feedbackScoringHints`, no auto-rescore | 2–6 | ⏳ PENDING | boundary + adversarial tests (T-010-22) |
| A30 | SPEC010→SPEC008 mutation authority = **0** | 2–6 | ⏳ PENDING | architecture test |
| A31 | SPEC-009 security boundary preserved — auth, tenant isolation, rules contracts unchanged | 1–6 | ⏳ PENDING | rules 91/91 unchanged, but no security review performed in Phase 1 |
| A32 | React → canonical store (`Local*Store`) direct write: **0** | 2–6 | ⚠️ PARTIAL | `ARCH`: **0** store/infrastructure imports in `src/ui/**` |
| A33 | React → Firestore direct write: **0** | 2–6 | ⚠️ PARTIAL | `ARCH`: **0** Firebase/Firestore imports in `src/ui/**` |
| A34 | No business logic in hooks — no duplicated scoring/routing/lifecycle/approval logic | 2–6 | ⚠️ PARTIAL | `ARCH`: no scoring/routing/approval symbol in `src/ui/**` |
| A35 | No dual command authority — legacy and React invoke the same canonical command | 2–6 | ⚠️ PARTIAL | Both logins call the same `authService.login`; no duplicate logic. Full proof T-010-506 |
| A36 | No dual read authority — one declared read source per module | 2–6 | ⚠️ PARTIAL | Each hook declares one source, and the source is part of the cache key |
| A37 | Single auth/session authority; React Context projects only | 1–6 | ⚠️ PARTIAL | `ARCH`: projection is derived and setter-free. Adversarial proof T-010-506 |
| A38 | No competing DOM/CSS ownership of a subtree | 1–6 | ✅ PASS | `ARCH` + `E2E`: sibling containers, exclusive owners, never both visible, no cross-nesting, CSS scoped to the two ids, clean unmount |
| A39 | `main.ts` strangler — ceases to be a controller/event bus; shrinks per wave | 1–4 | ⏳ PENDING | 5,132 → 5,138 lines; **0** responsibilities removed. Extraction is Phase 4 (T-010-401…404) |
| A40 | Component migration matrix complete — a row per UI file, dispositioned | 0 | ✅ PASS | `migration-matrix.md` (17 files) |
| A41 | Behavioral parity proven per migrated module across all applicable dimensions | 5 | ⏳ PENDING | no module cut over; parity is Phase 5 |
| A42 | E2E/parity harness (Playwright) implemented; legacy-vs-React journeys pass | 5 | ⚠️ PARTIAL | harness implemented, 5/5 foundation tests PASS. Full journey/parity suites T-010-508 |
| A43 | Legacy removed only after parity gate; rollback exercised without data migration | 6 | ⚠️ PARTIAL | `E2E`: rollback leaves business storage byte-identical. **0** legacy removed |
| A44 | Full check + rules regression at CODE_COMPLETE; no unintended regression | 6 | ⏳ PENDING | T-010-602. Phase-1 regression: check 1494/1494, rules 91/91 |

**Acceptance count:** **44** (A1–A44) — unchanged.

| Milestone | PASS | PARTIAL | FAIL | PENDING |
|-----------|------|---------|------|---------|
| Phase 0 exit | 6 | 0 | 0 | 38 |
| Phase 1 exit | 7 | 24 | 0 | 13 |
| **Phase 2 exit** | **7** | **26** | **0** | **11** |

### Phase-2 acceptance movement (T-010-201…206)

`ARCH2` = `tests/reactMigrationPhase2Architecture.test.ts` (29/29) ·
`W2` = `tests/reactMigrationPhase2Wave2.test.ts` (13/13) ·
`E2E2` = `e2e/wave2-components.spec.ts` (5/5).

Two criteria advanced from PENDING to PARTIAL, because Phase 2 produced the
first evidence that could bear on them at all:

| # | Was | Now | Why |
|---|-----|-----|-----|
| **A28** | ⏳ PENDING | ⚠️ PARTIAL | SPEC-007 surface migrated. `ARCH2` + `W2`: OpportunityScore, lifecycle and Materialize are **not** recreated — the four commands reach `opportunityScoutConsumer`, and derived flags come from the canonical facade |
| **A41** | ⏳ PENDING | ⚠️ PARTIAL | Parity evidence now exists per migrated component (rendered information, loading, empty, error, tenant context, actions, disabled actions, validation, freshness, rollback). Cutover parity remains Phase 5 |

Criteria that stayed PARTIAL but gained materially stronger evidence:

| # | Phase-2 evidence |
|---|------------------|
| A6 | `ARCH2`: 9 components carry reads and 5 canonical commands, with **0** persistence writes and **0** lifecycle assignments |
| A8 | `ARCH2`: React → `dbService` direct component imports **0**; facade remains the only importer and exposes **0** mutators |
| A9 | Canonical read path exercised by a real component (`readClientOpportunityCards`); 7 hooks, each with one declared source |
| A10 | 5 commands now flow React intent → seam → canonical consumer; `W2` proves the forwarded payload |
| A11 / A15 | `ARCH2`: `invalidateQueries` only, never `setQueryData`; commands carry ids, never aggregates |
| A14 | Wave 2 introduces **0** optimistic business mutations |
| A16 / A17 / A18 | `W2`: trusted scope forwarded as claimed identity; **0** actor/role fields sent; portfolio scope fails closed |
| A19 | `W2`: runtime cross-tenant, cross-client and cross-source key separation |
| A20 | `ARCH2`: no primary/first-thesis pattern; the spotlight is `DISPLAY_ONLY` |
| A26 | `ARCH2`: **0** provider imports across wave 2 |
| A32 / A33 | `ARCH2`: **0** store and **0** Firestore imports across wave 2 |
| A34 | `ARCH2`: no domain calculation runs in a component or hook |
| A35 | `ARCH2`: components cannot import a consumer directly — one command entry point |
| A36 | One read source per module, provenance in the key |
| A13 | `ReactOnboardingWizard` (T-010-205): RHF + Zod validate input shape only; the schemas hold **0** identity, role, lifecycle or completion fields, Zod strips injected ones, the suggested step is computed by `domain/profileCoverage`, and the form performs **0** writes — so no Zod pass can bypass a Domain gate |
| A38 | `ARCH2` + `E2E2`: 9 new components, **0** new DOM roots, no cross-nesting |
| A42 | Playwright now 10/10 (5 foundation + 5 wave-2 focused) |
| A43 | `E2E2`: rollback after wave 2 leaves business storage byte-identical; **0** legacy files removed |

Criteria deliberately **not** advanced:

| # | Why not |
|---|---------|
| A5 | Behaviour parity per module needs cutover evidence (Phase 5) |
| A21 | `Modals.ts` not migrated (T-010-302) |
| A22, A23, A24, A25, A27, A29, A30 | No routing, scoring, Brief, Plan, Claim or Learning-approval surface was migrated |
| A31 | No security review performed in Phase 2; rules unchanged at 91/91 |
| A39 | `main.ts` is **5,138 lines before and after** — 0 responsibilities extracted. Phase 4 owns this |
| A44 | CODE_COMPLETE regression is T-010-602 |

Phase 1 advanced A2, A3, A4 to full PASS (stack installed, strangler demonstrated, mapping verified) and
newly passed A38. No criterion depending on page migration, `main.ts` extraction, legacy deletion, full
E2E parity, Phase-5 security or Phase-6 closure is claimed.

---

## Deployment separation (D1–D3)

| # | Criterion | Status |
|---|-----------|--------|
| D-A1 | CODE_COMPLETE does not require production deploy | ✅ PASS (design) |
| D-A2 | SPEC-009 production rules unchanged until authorized | ✅ PASS (design) |
| D-A3 | Frontend rollout/rollback separate from Phases 0–6 | ✅ PASS (design) |

---

## Phase 0 exit checklist

| Gate | Status |
|------|--------|
| Formal package complete (11 files) | ✅ |
| Constitutional purpose exact | ✅ |
| Target stack exact (§23) | ✅ |
| §24 seven-step order preserved verbatim | ✅ |
| Big-bang prohibition recorded (§25) | ✅ |
| Strangler seam formalized | ✅ |
| Authority model formalized | ✅ |
| UI owns presentation only | ✅ |
| Data-access seam formalized | ✅ |
| `dbService` direct-read migration strategy explicit | ✅ |
| `main.ts` decomposition explicit | ✅ |
| Query authority model explicit | ✅ |
| TanStack cache non-authoritative | ✅ |
| Command boundary explicit | ✅ |
| Trusted tenant explicit | ✅ |
| Trusted actor explicit | ✅ |
| Multi-thesis explicit | ✅ |
| First-selection defaults non-authoritative | ✅ |
| SPEC-001…009 boundaries explicit | ✅ |
| SPEC008 mutation authority target 0 | ✅ |
| Component inventory complete (17 UI files) | ✅ |
| Migration matrix complete | ✅ |
| Behavior parity model complete | ✅ |
| Legacy deletion gate complete | ✅ |
| Playwright/E2E strategy complete | ✅ |
| Side-effect ordering audit strategy complete | ✅ |
| Rollback model complete | ✅ |
| Acceptance complete (44) | ✅ |
| Threat model complete (26) | ✅ |
| Tasks complete | ✅ |
| Deployment separation complete | ✅ |
| Human T-010-010 | **PENDING** |
| Phase-1 authorization | **NO** |
| Product files changed | **0** |
| Test files changed | **0** |
| Dependency files changed | **0** |
| SPEC-001…009 modifications | **0** |

**PHASE-0 DESIGN BLOCKERS:** **0**
**RUNTIME P0:** **0** · **RUNTIME P1:** **0** · **P2:** 4 · **P3:** 4

---

## Human SPEC approval (T-010-010) — REQUIRED

| Field | Value |
|-------|--------|
| **Task** | T-010-010 |
| **Title** | Human SPEC-010 approval |
| **Status** | **TODO · PENDING HUMAN** |
| **Classification** | HUMAN |
| **Authorization text** | «Apruebo formalmente SPEC-010 — React migration y autorizo el cierre de T-010-010 y el inicio de la Phase 1 de implementación.» |

No automation may write this statement, infer it, or mark T-010-010 DONE.

## Human CODE_COMPLETE (T-010-604) — FUTURE

| Field | Value |
|-------|--------|
| **Task** | T-010-604 |
| **Status** | **TODO** |
| **Authorization text** | «Apruebo formalmente el CODE_COMPLETE de SPEC-010 — React migration y autorizo el cierre de T-010-604.» |

Required (A\*) criteria must be **PASS** before T-010-604 may close.
