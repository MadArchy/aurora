# Tasks 010 — React migration

**Baseline:** SPEC-008 CODE_COMPLETE final freeze `642ae9390700a254fa390ba09a959bab3c37d616`
**Branch:** `spec/010-react-migration`

Phases derive from the constitutional §24 seven-step migration order, **not** from another SPEC's
structure. Each phase maps to one §24 step (see `ui-architecture.md` § *Phase ↔ §24 step mapping*).

**Authorized now:** Phase 0 only. **Phase 1+ requires human T-010-010.**

---

## Phase 0 — Governance / architecture (AUTHORIZED · COMPLETE except human gate)

| ID | Title | Class | Depends on | Outputs | Acceptance | Threats | Status |
|----|-------|-------|-----------|---------|------------|---------|--------|
| **T-010-001** | Verify SPEC-008 freeze and branch from frozen parent | TECHNICAL | SPEC-008 freeze | branch `spec/010-react-migration` @ `642ae939` | — | — | **[x] DONE** |
| **T-010-002** | Extract constitutional purpose, target stack and §24 order verbatim | TECHNICAL | T-010-001 | `spec.md`, `ui-architecture.md` | A1, A2, A4 | — | **[x] DONE** |
| **T-010-003** | Formalize strangler seam, mount/DOM/CSS ownership and big-bang prohibition | TECHNICAL | T-010-002 | `ui-architecture.md` | A3, A38 | T-010-24 | **[x] DONE** |
| **T-010-004** | Formalize UI authority model and state categories | TECHNICAL | T-010-002 | `ui-architecture.md`, `spec.md` | A6, A11, A12, A13, A14, A15 | T-010-05…07 | **[x] DONE** |
| **T-010-005** | Formalize data-access seam, read/command paths and tenant-safe query keys | TECHNICAL | T-010-004 | `data-flow.md`, `ui-architecture.md` | A8, A9, A10, A19, A36 | T-010-01…03, 08, 13 | **[x] DONE** |
| **T-010-006** | Formalize hexagonal boundaries and all SPEC-001…009 contracts | TECHNICAL | T-010-004 | `hexagonal-boundaries.md` | A22…A33 | T-010-04, 17, 20…23 | **[x] DONE** |
| **T-010-007** | Complete component migration matrix for every UI file + `main.ts` strangler plan | TECHNICAL | T-010-005 | `migration-matrix.md` | A39, A40 | T-010-25 | **[x] DONE** |
| **T-010-008** | Formalize behavioral parity model, legacy deletion gate, E2E and rollback | TECHNICAL | T-010-007 | `parity-model.md` | A5, A41, A42, A43 | T-010-26 | **[x] DONE** |
| **T-010-009** | Formalize acceptance (A1–A44), threats (T-010-01…26), deployment separation and AUDIT010 dispositions | TECHNICAL | T-010-002…008 | `acceptance.md`, `threat-model.md`, `deployment.md`, `plan.md` | all | all | **[x] DONE** |
| **T-010-010** | **Human SPEC-010 approval** | **HUMAN** | T-010-001…009 | approval record | Phase-1 gate | — | **[x] DONE** (2026-08-26 America/Bogota) |

**Phase 0 IDs:** T-010-001 … T-010-010
**Product files changed:** **0** · **Test files changed:** **0** · **Dependency files changed:** **0**

### Human SPEC-010 approval (T-010-010) — RECORDED

Provided verbatim by the human owner on **2026-08-26** (**America/Bogota**):

> «Apruebo formalmente SPEC-010 — React migration y autorizo el cierre de T-010-010 y el inicio de la Phase 1 de implementación.»

Authorized transitions performed by this approval and nothing else:
`T-010-010` TODO → **DONE** · `HUMAN SPEC-010 APPROVAL` PENDING → **APPROVED** ·
`PHASE-1 IMPLEMENTATION AUTHORIZATION` NO → **YES**.

`PHASE-2 IMPLEMENTATION AUTHORIZATION` remains **NO**. No approver identity, email, user ID,
organization, role or signature was recorded — none was supplied, and none may be invented.

**Exit:** Phase 0 **COMPLETE** · Phase 1 authorization **YES** · Phase 2 authorization **NO**

---

## Phase 1 — React shell + data-access seam (§24 steps 1, 3) — COMPLETE

| ID | Title | Class | Depends on | Outputs | Acceptance | Threats | Status |
|----|-------|-------|-----------|---------|------------|---------|--------|
| **T-010-101** | Add target-stack dependencies (React, React DOM, TanStack Query, React Hook Form, Vite React plugin) | TECHNICAL | T-010-010 | `package.json`, lockfile, Vite config | A2 | — | **[x] DONE** |
| **T-010-102** | Decide and record routing/navigation approach (constitution names none) | TECHNICAL | T-010-101 | decision record | A2 | — | **[x] DONE** |
| **T-010-103** | Decide and record React component-testing approach | TECHNICAL | T-010-101 | decision record | A41 | — | **[x] DONE** |
| **T-010-104** | Add Playwright E2E/parity harness | TECHNICAL | T-010-101 | Playwright config + first journey | A42 | T-010-26 | **[x] DONE** |
| **T-010-105** | Create React shell compatible with current services (§24 step 1) | TECHNICAL | T-010-101, T-010-102 | React shell + mount boundary | A3, A38 | T-010-24 | **[x] DONE** |
| **T-010-106** | Implement UI query boundary (query hooks + canonical consumer/query facade) | TECHNICAL | T-010-105 | query layer | A9, A11, A19 | T-010-05, 08 | **[x] DONE** |
| **T-010-107** | Implement explicit legacy compatibility read facade (labelled non-canonical) | TECHNICAL | T-010-106 | compatibility facade | A36 | T-010-13 | **[x] DONE** |
| **T-010-108** | Implement UI command boundary (command hooks → canonical use cases) | TECHNICAL | T-010-106 | command layer | A10, A35 | T-010-01…03, 12 | **[x] DONE** (session commands; see AUDIT010-09) |
| **T-010-109** | Implement trusted session projection (single auth authority) | TECHNICAL | T-010-105 | session context | A16, A17, A18, A37 | T-010-09…11, 23 | **[x] DONE** |
| **T-010-110** | Wave-1 architecture tests (boundary purity, scoped to migrated modules) | TECHNICAL | T-010-106…109 | architecture suite | A8, A26, A32, A33 | T-010-01…04 | **[x] DONE** (27/27 PASS) |
| **T-010-111** | Migrate `AppShell` and `Login` to React (wave 1) | TECHNICAL | T-010-105…110 | React shell modules | A5, A6 | T-010-24 | **[x] DONE** (coexisting behind toggle; see scope note) |

**Depends on:** T-010-010 human approval — **RECORDED**.

### Phase-1 delivered artifacts

| Area | Files |
|------|-------|
| Mount seam | `src/ui/mount.ts`, `src/ui/strangler/toggle.ts`, `src/ui/strangler/strangler.css`, `index.html` (`#react-root` sibling) |
| Shell | `src/ui/shell/AppRoot.tsx` |
| Providers | `src/ui/providers/QueryProvider.tsx`, `SessionProvider.tsx`, `ErrorBoundary.tsx` |
| Query boundary | `src/ui/query/tenantScope.ts`, `src/ui/query/queryKeys.ts`, `src/ui/hooks/useShellData.ts` |
| Read seams | `src/ui/data/canonicalReads.ts` (canonical), `src/ui/data/compatibilityReads.ts` (compatibility) |
| Command seam | `src/ui/commands/commandSeam.ts` |
| Wave-1 modules | `src/ui/modules/AppShell/ReactAppShell.tsx`, `src/ui/modules/Login/ReactLogin.tsx` |
| Tests | `tests/reactMigrationPhase1Architecture.test.ts` (27), `e2e/strangler-foundation.spec.ts` (5) |
| Toolchain | `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `playwright.config.ts`, `.gitignore` |

### T-010-111 scope note — NO CUTOVER

The React `AppShell` and `Login` are **implemented and mountable**, not cut over. The legacy
presentation remains the default and is untouched. This is required by §24 step 7 and the parity gate:
cutover and legacy removal need parity evidence that belongs to Phases 5–6. Both implementations
coexist behind the presentation toggle, exactly as the strangler model specifies.

`ReactLogin` deliberately omits invitation acceptance — see **AUDIT010-09**.

### Decision records

**T-010-102 · ROUTING LIBRARY = NONE.** §23 names no routing library, so none was assumed. The legacy
application performs no URL routing: navigation is in-memory tab state (`activeTab`) re-rendered by the
controller, and the only URL parameter read is the `invite` token. Introducing a router in Phase 1 would
therefore add a dependency, change browser history behaviour that legacy does not implement, and create a
second navigation authority during coexistence — all without a requirement. Wave-1 React navigation uses
local presentation state, matching legacy behaviour exactly. Revisit in Phase 3, when page-level migration
may justify real URL routing; a router must then be introduced as its own formally justified decision.

**T-010-103 · REACT COMPONENT-TESTING LIBRARY = DEFERRED (none installed).** §23 names Vitest and
Playwright only. Wave-1 foundation properties are boundary and ownership properties, proven statically by
27 architecture assertions and behaviourally by 5 Playwright tests; a DOM-rendering unit library would add
`jsdom` plus a testing library without proving anything those two do not already cover. Revisit in Phase 2,
when leaf components with real interaction logic migrate. Existing Vitest suites remain unchanged
(`environment: 'node'`).

**Version policy.** Repository convention (caret ranges) followed; no exact pinning introduced and no
unrelated dependency upgraded. Vite deliberately stays at `^6.2.0`: `@vitejs/plugin-react@6` requires
Vite `^8`, so plugin `^5.2.0` was selected to fit the existing Vite rather than upgrading the build
toolchain, which no task authorizes.

### Side-effect ordering audit (wave-1 scope, AUDIT010-07)

| Path | Gate | Effect | Verdict | Migrated |
|------|------|--------|---------|----------|
| Login | `authService.login` credential verification | trusted session established | **GATE_FIRST** | yes |
| Logout / return to manager | trusted runtime state transition | session cleared | **GATE_FIRST** (no business effect) | yes |
| Invitation acceptance | `authService.registerFromInvite` | `dbService.markInvitationAccepted`, `dbService.updateClient` | **GATE_FIRST** | **no** — AUDIT010-09 |

Audited: **3** · `GATE_FIRST`: **3** · `EFFECT_FIRST`: **0** · `UNKNOWN`: **0**.
Only `GATE_FIRST` paths were migrated. All other `main.ts` command paths remain unaudited and were
therefore **not** migrated; they stay owned by Phase 4 (T-010-401).

### `main.ts` measurement

| Metric | Value |
|--------|-------|
| Lines before Phase 1 | **5,132** |
| Lines after Phase 1 | **5,138** (+6) |
| Responsibilities removed | **0** |
| Responsibilities retained | all |
| Change made | one import plus a four-line bootstrap call to the mount seam |

Phase 1 adds the seam; it does not extract the controller. Extraction is Phase 4 (T-010-401…404) and no
Phase-1 task assigns it. The `+6` lines are the honest cost of installing the strangler seam, and the
purpose is strangling rather than cosmetic line reduction.

**New finding — AUDIT010-09 · P3 · `LEGACY_COMMAND_WITHOUT_CANONICAL_USE_CASE`.** Invitation acceptance
gates correctly on trusted auth, then completes with two legacy `dbService` business writes
(`markInvitationAccepted`, `updateClient`) for which no canonical Application use case exists. Routing it
through the React command seam would make the UI layer perform a legacy business mutation, violating the
command-boundary target, so the flow stays on the legacy path and `ReactLogin` omits it. This is the first
concrete instance of a general constraint: **a legacy command with no canonical use case cannot be
migrated until one exists**, and creating it is other-SPEC work outside SPEC-010's authority. Every
migration wave must screen for this class before promising a module. Not a runtime defect; ordering is
sound and no capability was lost because legacy remains served.

---

## Phase 2 — Extract leaf components (§24 step 2) — COMPLETE

| ID | Title | Class | Depends on | Acceptance | Status |
|----|-------|-------|-----------|------------|--------|
| **T-010-201** | Migrate zero-`dbService` leaves — `ClaimSafetyPanel`, `PageHeader`, `MasterDossierPanel` | TECHNICAL | Phase 1 | A5, A6 | **[x] DONE** |
| **T-010-202** | Migrate `OpportunityPanel` as the canonical-read reference module | TECHNICAL | T-010-201 | A9, A28 | **[x] DONE** (canonical read **and** canonical commands) |
| **T-010-203** | Migrate `KpiWeeklyChart`, `ClientProfilePanel`, `ProofWallPanel` | TECHNICAL | T-010-202 | A5, A36 | **[x] DONE** (`KpiWeeklyChart` full; other two display/read-only — AUDIT010-09) |
| **T-010-204** | Migrate `SourceRegistryModal` | TECHNICAL | T-010-203 | A5, A20 | **[x] DONE** (read-only; both writes blocked — AUDIT010-09) |
| **T-010-205** | Migrate `OnboardingWizard` (React Hook Form + Zod) | TECHNICAL | T-010-203 | A13, A18 | **[x] DONE** (presentation + reads; the step write stays legacy — see reconciliation below) |
| **T-010-206** | Wave-2 parity evidence + tenant-safe cache tests | TECHNICAL | T-010-201…205 | A19, A41 | **[x] DONE** (52 Vitest + 5 Playwright) |

### Phase-2 command migratability screen

Every action of every candidate was classified before any component was written.
Classification of the underlying legacy command decided what could migrate.

| Component | Action | Legacy command | Class | Migrated? |
|---|---|---|---|---|
| `PageHeader` | — | — | `NO_COMMAND` | ✔ |
| `ClaimSafetyPanel` | Go to phrase | editor cursor move | `PRESENTATION_ONLY` | ✔ |
| `MasterDossierPanel` | Copy / download `.md` | `dossierExport` + audit log | `PRESENTATION_ONLY` | ✔ |
| `OpportunityPanel` | Accept · Decline · Toggle checklist · Mark sent | `acceptClientOpportunity`, `declineClientOpportunity`, `toggleClientOpportunityChecklistItem`, `submitClientOpportunity` | `CANONICAL_CONSUMER` | ✔ |
| `KpiWeeklyChart` | Register consultation (+1) | `registerResultRecordIntent` | `CANONICAL_CONSUMER` | ✔ |
| `ClientProfilePanel` | Add / confirm / reject / edit fact · extract CV facts | 5 × raw `dbService` write | `LEGACY_WRITE_WITHOUT_CANONICAL_USE_CASE` | ✘ blocked |
| `ProofWallPanel` | Mark ready / pending | `dbService.updateProofWallItem` | `LEGACY_WRITE_WITHOUT_CANONICAL_USE_CASE` | ✘ blocked |
| `SourceRegistryModal` | Register source · Ingest now | `dbService.addSource` · ingestion polling | `LEGACY_WRITE_WITHOUT_CANONICAL_USE_CASE` | ✘ blocked |
| `OnboardingWizard` | Submit step / finish (owned by `main.ts`, not by the component) | `dbService.applyOnboardingStep` | `LEGACY_WRITE_WITHOUT_CANONICAL_USE_CASE` | ✘ blocked |

Full detail, dispositions and enforcement: **`audit010-09-registry.md`**.

### T-010-205 — formal reconciliation (supersedes the first Phase-2 verdict)

The first Phase-2 pass recorded T-010-205 as `BLOCKED`, on the grounds that the
component's purpose was to submit `dbService.applyOnboardingStep`. Re-reading the
formal package showed that attribution to be wrong, and the error mattered
because it produced a self-contradicting exit gate.

**Contract classification: `B — DISPLAY_READ_ONLY_ALLOWED_WITH_LEGACY_COMMAND_RETENTION`.**

Repository evidence, not convenience:

| Source | Statement |
|--------|-----------|
| `migration-matrix.md` row 10 | `OnboardingWizard.ts` — `dbService` reads **2**, **Writes: no**, boundary `<OnboardingWizard/>` (RHF), wave **2**, disposition **MIGRATE** |
| `migration-matrix.md` totals | «**0 components performing writes**» — true of all 16 components |
| `migration-matrix.md` row 1 | `src/main.ts` — «**yes** (all UI-originated commands)», wave **1→4** |
| `tasks.md` Phase-2 table | T-010-205 declares **no** output and **no** threat column; its acceptance mapping is **A13, A18** |
| `tasks.md` Phase 4 | `main.ts` command extraction is **T-010-401…404**, explicitly not Phase 2 |

The onboarding write lives in the legacy controller, which the matrix assigns to
Phase 4. It was never inside the boundary of T-010-205, so migrating this
component never required migrating it, and the task's mapped criteria are both
constraints on a form rather than demands for a save: A13 requires that form
state be non-authoritative and that Zod never bypass a Domain gate; A18 requires
zero caller role authority. Neither is satisfied by adding a write; both are
satisfied by a form that provably holds none.

What was implemented, and its exact limit:

- `ReactOnboardingWizard` renders all six steps with React Hook Form + Zod
  validating **input shape only**; the schemas contain no identity, role,
  lifecycle or completion field, and Zod strips injected ones.
- Its single read is the declared compatibility read `readOnboardingContext`;
  coverage and the suggested step are computed by `domain/profileCoverage`
  inside the facade, so no completion rule exists in React.
- It performs **no** write and imports **no** command seam. Saving is disabled
  with its real reason (AUDIT010-09 #10) and hands off to the legacy wizard,
  which remains served and unchanged.
- The «this view does not save yet» notice is rendered **before** any field, so
  no long answer is typed in the belief that it will be stored. This is the one
  accepted UX cost of coexistence, recorded rather than hidden.

`AUDIT010-09` is therefore **not** resolved by this closure. The command remains
`KEEP_LEGACY`, the registry entry stands, and the architecture suite continues to
fail if `applyOnboardingStep` ever appears in the React layer.

### Phase-2 delivered artifacts

| Area | Files |
|------|-------|
| Wave-2 components | `src/ui/modules/PageHeader/ReactPageHeader.tsx`, `ClaimSafety/ReactClaimSafetyPanel.tsx`, `MasterDossier/ReactMasterDossierPanel.tsx`, `Opportunity/ReactOpportunityPanel.tsx`, `Kpi/ReactKpiWeeklyChart.tsx`, `ClientProfile/ReactClientProfilePanel.tsx`, `ProofWall/ReactProofWallPanel.tsx`, `SourceRegistry/ReactSourceRegistryPanel.tsx`, `Onboarding/ReactOnboardingWizard.tsx` + `Onboarding/onboardingStepSchemas.ts` |
| Bounded surface | `src/ui/modules/wave2/Wave2Surface.tsx`, wiring inside `ReactAppShell` |
| Read seams | `src/ui/data/canonicalReads.ts` (+ `OpportunityCardView`), `src/ui/data/compatibilityReads.ts` (+ 6 reads) |
| Command seam | `src/ui/commands/commandSeam.ts` (+ `opportunityCommands`, `resultCommands`, `dossierPresentationCommands`) |
| Hooks | `src/ui/hooks/useWave2Data.ts` |
| Tests | `tests/reactMigrationPhase2Architecture.test.ts` (34), `tests/reactMigrationPhase2Wave2.test.ts` (18), `e2e/wave2-components.spec.ts` (5) |
| Governance | `specs/010-react-migration/audit010-09-registry.md` |

**`main.ts` unchanged: 5,138 lines before and after**, including the T-010-205
reconciliation. Wave-2 components render inside the React shell that Phase 1
already mounted, so no new island, no new mount contract and no controller wiring
was needed.

### T-010-206 — status basis

Verified against its own contract rather than assumed from the existence of test
files. Title: *Wave-2 parity evidence + tenant-safe cache tests*; acceptance
**A19, A41**.

- **A19 (tenant-safe query keys):** proven, not partial — every wave-2 read key
  is built by the tenant factory, cross-organization, cross-client and
  cross-source collisions are each asserted, and invalidation is tenant-scoped.
- **A41 (parity evidence):** A41 is a **Phase-5** criterion; at Phase 2 the task
  owes wave-2 evidence, which exists across 12 of the 18 parity dimensions
  (rendered capability, loading, empty, error, tenant, commands, disabled
  actions, validation, multi-thesis, freshness, canonical behaviour, rollback).
  Permissions, navigation, accessibility audit, legacy-quirk sign-off, authority
  adversarial proof and observation remain owned by Phases 3–5.

Evidence: 34 architecture + 18 focused Vitest + 5 wave-2 Playwright, all PASS.
The task is **DONE** for its Phase-2 scope; A41 stays **PARTIAL** by design.

**Exit:** Phase 2 **COMPLETE** — T-010-201…206 all **DONE** ·
Phase 3 authorization **NO** (external review owns it)

---

## Phase 3 — Page-by-page migration (§24 step 4) — NOT AUTHORIZED

| ID | Title | Class | Depends on | Acceptance | Status |
|----|-------|-------|-----------|------------|--------|
| **T-010-301** | Migrate `ThesisEditorModal` (multi-thesis explicit scope) | TECHNICAL | Phase 2 | A20, A21 | **[ ] TODO** |
| **T-010-302** | Decompose and migrate `Modals.ts` into per-modal components | TECHNICAL | T-010-301 | A21, A35 | **[ ] TODO** |
| **T-010-303** | Migrate `ManagerCockpit` | TECHNICAL | T-010-302 | A5, A18 | **[ ] TODO** |
| **T-010-304** | Migrate `ClientPortal` | TECHNICAL | T-010-302 | A5, A20 | **[ ] TODO** |
| **T-010-305** | Migrate `ClientWorkspace` (decomposed route + panel tree) | TECHNICAL | T-010-303, T-010-304 | A5, A29 | **[ ] TODO** |
| **T-010-306** | Wave-3 parity evidence + boundary tests for SPEC-001…008 | TECHNICAL | T-010-301…305 | A22…A30, A41 | **[ ] TODO** |

---

## Phase 4 — Extract UI logic from services + `main.ts` strangler (§24 step 5) — NOT AUTHORIZED

| ID | Title | Class | Depends on | Acceptance | Status |
|----|-------|-------|-----------|------------|--------|
| **T-010-401** | Audit and record side-effect ordering (gate→effect) for every `main.ts` command path | TECHNICAL | Phase 3 | A5, A39 | **[ ] TODO** |
| **T-010-402** | Relocate UI orchestration out of `main.ts` per audited path | TECHNICAL | T-010-401 | A39 | **[ ] TODO** |
| **T-010-403** | Invert the seam — React shell hosts remaining legacy islands (Stage B) | TECHNICAL | T-010-402 | A38 | **[ ] TODO** |
| **T-010-404** | Reduce `main.ts` to minimal bootstrap/composition entrypoint | TECHNICAL | T-010-403 | A39 | **[ ] TODO** |
| **T-010-405** | Extract UI logic from domain-adjacent services without changing authority | TECHNICAL | T-010-402 | A5, A34 | **[ ] TODO** |

---

## Phase 5 — Regression / parity / security / E2E (§24 step 6) — NOT AUTHORIZED

| ID | Title | Class | Depends on | Acceptance | Threats | Status |
|----|-------|-------|-----------|------------|---------|--------|
| **T-010-501** | Adversarial authority suite — caller tenant/actor/role spoof | TECHNICAL | Phase 4 | A16, A17, A18 | T-010-09…11 | **[ ] TODO** |
| **T-010-502** | Adversarial cache suite — stale, optimistic, cross-tenant bleed | TECHNICAL | Phase 4 | A11, A14, A15, A19 | T-010-05…08 | **[ ] TODO** |
| **T-010-503** | Adversarial write-path suite — `dbService`/store/Firestore/provider bypass | TECHNICAL | Phase 4 | A8, A26, A32, A33 | T-010-01…04 | **[ ] TODO** |
| **T-010-504** | Adversarial approval suite — UI approval spoof, SPEC-008 boundary | TECHNICAL | Phase 4 | A29, A30 | T-010-14, 22 | **[ ] TODO** |
| **T-010-505** | Duplication suite — scoring/routing/lifecycle/opportunity/learning logic | TECHNICAL | Phase 4 | A23, A28, A34 | T-010-17, 19…22 | **[ ] TODO** |
| **T-010-506** | Dual-authority suite — command, read, auth, DOM ownership | TECHNICAL | Phase 4 | A35, A36, A37, A38 | T-010-12, 13, 23, 24 | **[ ] TODO** |
| **T-010-507** | Multi-thesis and presentation-default suite | TECHNICAL | Phase 4 | A20, A21 | T-010-15, 16 | **[ ] TODO** |
| **T-010-508** | Playwright legacy-vs-React parity journeys + rollback | TECHNICAL | Phase 4 | A41, A42, A43 | T-010-26 | **[ ] TODO** |
| **T-010-509** | Accessibility and performance evidence per migrated module | TECHNICAL | Phase 4 | A41 | — | **[ ] TODO** |
| **T-010-510** | Confirm all 26 formal threats | TECHNICAL | T-010-501…509 | all threats | T-010-01…26 | **[ ] TODO** |

---

## Phase 6 — Final acceptance / legacy removal / CODE_COMPLETE (§24 step 7) — NOT AUTHORIZED

| ID | Title | Class | Depends on | Acceptance | Status |
|----|-------|-------|-----------|------------|--------|
| **T-010-601** | Run full acceptance matrix A1–A44 | TECHNICAL | Phase 5 | A1–A44 | **[ ] TODO** |
| **T-010-602** | Full check + rules regression | TECHNICAL | T-010-601 | A44 | **[ ] TODO** |
| **T-010-603** | Remove legacy implementations that passed the parity gate | TECHNICAL | T-010-601, T-010-602 | A43 | **[ ] TODO** |
| **T-010-604** | **Human CODE_COMPLETE approval** | **HUMAN** | T-010-601…603 | CODE_COMPLETE gate | **[ ] TODO** |

**Required human CODE_COMPLETE statement (T-010-604) — future:**

> «Apruebo formalmente el CODE_COMPLETE de SPEC-010 — React migration y autorizo el cierre de T-010-604.»

---

## Deployment (separate — NOT AUTHORIZED)

| Task | Title | Status |
|------|-------|--------|
| **D1** | Frontend rollout strategy (staged React exposure, toggle governance) | **NOT_STARTED** |
| **D2** | Frontend rollback/observation procedure in production | **NOT_STARTED** |
| **D3** | Production cutover verification (SPEC-009 coordination) | **NOT_STARTED** |

Deployment requires separate authorization. SPEC-009 production remains **DEFERRED_UNCHANGED**.

---

## Summary task counts

| Phase | ID range | Count | Status |
|-------|----------|-------|--------|
| 0 | T-010-001…010 | 10 | 9 DONE · 1 PENDING HUMAN (T-010-010) |
| 1 | T-010-101…111 | 11 | NOT AUTHORIZED |
| 2 | T-010-201…206 | 6 | NOT AUTHORIZED |
| 3 | T-010-301…306 | 6 | NOT AUTHORIZED |
| 4 | T-010-401…405 | 5 | NOT AUTHORIZED |
| 5 | T-010-501…510 | 10 | NOT AUTHORIZED |
| 6 | T-010-601…604 | 4 | NOT AUTHORIZED |
| Deploy | D1–D3 | 3 | NOT_STARTED |

**Total formal tasks:** 55 (52 implementation + 3 deployment)
