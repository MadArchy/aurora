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
| **T-010-010** | **Human SPEC-010 approval** | **HUMAN** | T-010-001…009 | approval record | Phase-1 gate | — | **[ ] TODO · PENDING HUMAN** |

**Phase 0 IDs:** T-010-001 … T-010-010
**Product files changed:** **0** · **Test files changed:** **0** · **Dependency files changed:** **0**

**Required human SPEC-010 statement (T-010-010) — REQUIRED NOW:**

> «Apruebo formalmente SPEC-010 — React migration y autorizo el cierre de T-010-010 y el inicio de la Phase 1 de implementación.»

This statement must be provided by the human owner. It has **not** been given.
No automation may write it, infer it, or mark T-010-010 DONE.

**Exit:** Phase 0 **COMPLETE** pending human approval · Phase 1 authorization **NO**

---

## Phase 1 — React shell + data-access seam (§24 steps 1, 3) — NOT AUTHORIZED

| ID | Title | Class | Depends on | Outputs | Acceptance | Threats | Status |
|----|-------|-------|-----------|---------|------------|---------|--------|
| **T-010-101** | Add target-stack dependencies (React, React DOM, TanStack Query, React Hook Form, Vite React plugin) | TECHNICAL | T-010-010 | `package.json`, lockfile, Vite config | A2 | — | **[ ] TODO** |
| **T-010-102** | Decide and record routing/navigation approach (constitution names none) | TECHNICAL | T-010-101 | decision record | A2 | — | **[ ] TODO** |
| **T-010-103** | Decide and record React component-testing approach | TECHNICAL | T-010-101 | decision record | A41 | — | **[ ] TODO** |
| **T-010-104** | Add Playwright E2E/parity harness | TECHNICAL | T-010-101 | Playwright config + first journey | A42 | T-010-26 | **[ ] TODO** |
| **T-010-105** | Create React shell compatible with current services (§24 step 1) | TECHNICAL | T-010-101, T-010-102 | React shell + mount boundary | A3, A38 | T-010-24 | **[ ] TODO** |
| **T-010-106** | Implement UI query boundary (query hooks + canonical consumer/query facade) | TECHNICAL | T-010-105 | query layer | A9, A11, A19 | T-010-05, 08 | **[ ] TODO** |
| **T-010-107** | Implement explicit legacy compatibility read facade (labelled non-canonical) | TECHNICAL | T-010-106 | compatibility facade | A36 | T-010-13 | **[ ] TODO** |
| **T-010-108** | Implement UI command boundary (command hooks → canonical use cases) | TECHNICAL | T-010-106 | command layer | A10, A35 | T-010-01…03, 12 | **[ ] TODO** |
| **T-010-109** | Implement trusted session projection (single auth authority) | TECHNICAL | T-010-105 | session context | A16, A17, A18, A37 | T-010-09…11, 23 | **[ ] TODO** |
| **T-010-110** | Wave-1 architecture tests (boundary purity, scoped to migrated modules) | TECHNICAL | T-010-106…109 | architecture suite | A8, A26, A32, A33 | T-010-01…04 | **[ ] TODO** |
| **T-010-111** | Migrate `AppShell` and `Login` to React (wave 1) | TECHNICAL | T-010-105…110 | React shell modules | A5, A6 | T-010-24 | **[ ] TODO** |

**Depends on:** T-010-010 human approval.

---

## Phase 2 — Extract leaf components (§24 step 2) — NOT AUTHORIZED

| ID | Title | Class | Depends on | Acceptance | Status |
|----|-------|-------|-----------|------------|--------|
| **T-010-201** | Migrate zero-`dbService` leaves — `ClaimSafetyPanel`, `PageHeader`, `MasterDossierPanel` | TECHNICAL | Phase 1 | A5, A6 | **[ ] TODO** |
| **T-010-202** | Migrate `OpportunityPanel` as the canonical-read reference module | TECHNICAL | T-010-201 | A9, A28 | **[ ] TODO** |
| **T-010-203** | Migrate `KpiWeeklyChart`, `ClientProfilePanel`, `ProofWallPanel` | TECHNICAL | T-010-202 | A5, A36 | **[ ] TODO** |
| **T-010-204** | Migrate `SourceRegistryModal` | TECHNICAL | T-010-203 | A5, A20 | **[ ] TODO** |
| **T-010-205** | Migrate `OnboardingWizard` (React Hook Form + Zod) | TECHNICAL | T-010-203 | A13, A18 | **[ ] TODO** |
| **T-010-206** | Wave-2 parity evidence + tenant-safe cache tests | TECHNICAL | T-010-201…205 | A19, A41 | **[ ] TODO** |

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
