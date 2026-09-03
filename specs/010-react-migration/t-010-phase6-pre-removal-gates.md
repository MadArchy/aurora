# SPEC-010 Phase 6 — T-601 / T-602 pre-removal gates

**Authorization:** Staged Phase-6 implementation (T-010-601 + T-010-602 only)  
**Start SHA:** `b5624357b886cb71ed25537aeff3487f7ce57b0e`  
**Phase-5 stability SHA:** `284d7065adbbe15b38981238b05820b338ee4d5d`  
**Status:** **PRE_REMOVAL_GATES_COMPLETE_PENDING_T603_AUTHORIZATION_REVIEW**

## Scope assertion

| Gate | Result |
|------|--------|
| T-010-601 | **COMPLETE** |
| T-010-602 | **COMPLETE** (`REGRESSION_GATE_PASS`) |
| T-010-603 | **NOT_AUTHORIZED** |
| T-010-604 | **NOT_AUTHORIZED** |
| Product file modifications (`src/**`) | **0** |
| Legacy files deleted | **0** |
| CR-1 new canonicalizations | **0** |
| CR-1 CU changes | **0** |
| CR-2 modifications | **0** |
| Planner implementation | **0** |
| SPEC-009 production changes | **0** |

## A1–A44 reconciliation tally (T-601)

| Status | Count | Notes |
|--------|-------|-------|
| PASS | **8** | A1–A4, A7, A38–A40 |
| PARTIAL | **33** | Strengthened by Phase 5; no false promotion |
| PENDING | **3** | A25, A31, A44 |
| FAIL | **0** | — |

**A44 distinction:** `T602 REGRESSION_GATE_PASS` at **1965/1965 · 91/91 · BUILD PASS · 73/73 · 21/21**.  
**A44 formal status remains PENDING** — CODE_COMPLETE requires all Required (A\*) PASS + T-603 + human T-604; A25/A31 still open.

### A25 / A31 blockers

| Criterion | Blocks T601? | Blocks T602? | Blocks T603? | Blocks T604? | Blocks MVP CODE_COMPLETE? |
|-----------|--------------|--------------|--------------|--------------|---------------------------|
| **A25** (Planner) | **NO** | **NO** | **NO** | **YES** | **YES** |
| **A31** (SPEC-009 prod review) | **NO** | **NO** | **NO** | **YES** | **YES** |

- **A25 owner:** SPEC-004 / external product UI (no React plan surface; `react-ws-plan` absent)  
- **A31 owner:** SPEC-009 production closure (local rules **91/91 PASS**; no production security review performed)

### CR-2

**COMPLETE / FROZEN** (`cr-2-brief-from-curation-entry.md` @ `3c53b49…`).  
`createBriefFromCurationEntry` uses authoritative reload; **CR-2 REOPENED = NO**.

Stale `CHANGE_REQUIRED` references in `spec.md` header / `audit010-09-registry.md` § Phase 4C are **documentation drift only**.

## Phase-4 / Phase-5 invariants (preserved)

| Invariant | State |
|-----------|-------|
| Normal Stage-B shell owner | **REACT** |
| Active global shell count | **1** |
| Normal navigation owner | **REACT** |
| Normal navigation authorities | **1** |
| `main.ts` | **15-line bootstrap/composition** |
| `LegacyApp.ts` | **compatibility host** (not relocated monolith) |
| React business authority | **0** |
| SPEC-010 business authority | **0** |
| CR-1 competing authority | **0** |

## Threat ledger (unchanged)

**23 PASS · 3 PARTIAL · 0 FAIL** — T-010-20, T-010-25, T-010-26 preserved truthfully.

| Threat | Status | Remaining condition | T603 impact |
|--------|--------|---------------------|-------------|
| T-010-20 | PARTIAL | Display-only score labels in React radar | May remain PARTIAL under display-only policy |
| T-010-25 | PARTIAL | 22 deferred CR-1 legacy writes | Blocks deletion of hosts for deferred commands |
| T-010-26 | PARTIAL | Legacy not removed | T-603 dependency (not authorized here) |

**T-010-20 verification:** `tests/t010505DuplicationAdversarial.test.ts` — SCORING FORMULAS IN REACT = **0**, WEIGHT ARITHMETIC IN REACT = **0**, ROUTING AUTHORITY IN REACT = **0**; display labels permitted.

## #9 / #18 canonical regression

| ID | Canonical path | UI trigger | T508 E2E | NEW AUTHORITY | HOST REMOVAL AUTHORIZED |
|----|----------------|------------|----------|---------------|-------------------------|
| **#9** | `PollRegisteredSource` / `PollAllActiveSources` | Legacy island **`ws-sources`** | **PASS** | **0** | **NO** |
| **#18** | `SendDeliveryPackage` | Legacy island **`ws-deliver`** + modal | **PASS** | **0** | **NO** |

Removing `ClientWorkspace` island hosts, `LegacyApp.ts`, or legacy source/delivery surfaces would break #9/#18 reachability.

## 18 parity dimensions (reconciled)

| # | Dimension | State | Evidence | T603 impact |
|---|-----------|-------|----------|-------------|
| 1 | Rendered capability | PARTIAL | 34 deferred commands; LegacyHandoff | Blocks full cutover |
| 2 | Navigation | PARITY | Stage-B shell; T-508 | Low |
| 3 | Loading | PARITY | PanelState | Low |
| 4 | Empty | PARITY | PanelState | Low |
| 5 | Error | PARITY | Controlled errors | Low |
| 6 | Tenant | PARITY | T-501, T-508 | Low |
| 7 | Permissions | PARTIAL→strengthened | T-501 adversarial + T-508 auth | Per-module |
| 8 | Commands | PARTIAL | 7 canonical + 34 DEFERRED_LEGACY | **High** |
| 9 | Disabled actions | PARITY | Phase 3 + T-505 | Low |
| 10 | Validation | PARTIAL | Shape-only React; Domain decides | Deferred commands |
| 11 | Lifecycle presentation | PARITY | Projections only | Low |
| 12 | Multi-thesis | PARITY | T-507 | Low |
| 13 | Freshness | PARITY | T-502, staleTime 0 | Low |
| 14 | Legacy quirks | PARTIAL | 5 accepted changes documented | Low |
| 15 | Canonical | PARITY | Same consumers | Low |
| 16 | Rollback | PARITY | T-508 stability proven | Required before any deletion |
| 17 | Accessibility | PARTIAL | T-509 static only | Nonblocking |
| 18 | Authority | PARITY | T-501…507 | Low |

**12 PARITY · 6 PARTIAL · 0 FAIL · FULL CUTOVER PAGES = 0**

## 8-condition parity gate — wave-2 leaf candidates

| Candidate | C1 React served | C2 Vitest | C3 Dimensions | C4 Authority | C5 Tenant/rules | C6 Rollback | C7 Acceptance | C8 GATE_FIRST | Removable? |
|-----------|-----------------|-----------|---------------|--------------|-----------------|-------------|---------------|---------------|------------|
| `PageHeader.ts` | PASS | PASS | PARTIAL overall | PASS | PASS | **PARTIAL** (legacy rollback path) | PARTIAL | N/A | **NO** until T603 auth + rollback plan |
| `ClaimSafetyPanel.ts` | PASS | PASS | PARTIAL | PASS | PASS | PARTIAL | PARTIAL | N/A | **NO** |
| `MasterDossierPanel.ts` | PASS | PASS | PARTIAL | PASS | PASS | PARTIAL | PARTIAL | N/A | **NO** |
| `OpportunityPanel.ts` | PASS | PASS | PARTIAL | PASS | PASS | PARTIAL | PARTIAL | N/A | **NO** |
| `KpiWeeklyChart.ts` | PASS | PASS | PARTIAL | PASS | PASS | PARTIAL | PARTIAL | N/A | **NO** |

**REMOVABLE AFTER T601/T602 alone = NO** for all candidates (condition 6 rollback + hybrid parity not met for legacy-mode path).

## T-603 pre-removal inventory (manifest only — no deletion)

| File / surface | Classification | Commands / notes | Safe to delete now? |
|----------------|----------------|------------------|---------------------|
| `PageHeader.ts` | REMOVE_SAFE_CANDIDATE | none | **NO** — rollback + T603 not authorized |
| `ClaimSafetyPanel.ts` | REMOVE_SAFE_CANDIDATE | presentation only | **NO** |
| `MasterDossierPanel.ts` | REMOVE_SAFE_CANDIDATE | presentation only | **NO** |
| `OpportunityPanel.ts` | REMOVE_SAFE_CANDIDATE | canonical ×4 | **NO** |
| `KpiWeeklyChart.ts` | REMOVE_SAFE_CANDIDATE | canonical consumer | **NO** |
| `ClientProfilePanel.ts` | BLOCKED_BY_DEFERRED_COMMAND | #2–#6 | **NO** |
| `ProofWallPanel.ts` | BLOCKED_BY_DEFERRED_COMMAND | #7 | **NO** |
| `SourceRegistryModal.ts` | REQUIRES_PRODUCT_REPLACEMENT | #8 canonical; #9 poll legacy-hosted | **NO** |
| `OnboardingWizard.ts` | BLOCKED_BY_DEFERRED_COMMAND | #10 write legacy | **NO** |
| `Login.ts` | ROLLBACK_DEPENDENCY | auth presentation | **NO** |
| `AppShell.ts` | ROLLBACK_DEPENDENCY | legacy shell host | **NO** |
| `ThesisEditorModal.ts` | BLOCKED_BY_DEFERRED_COMMAND | #11 save legacy | **NO** |
| `ManagerCockpit.ts` | BLOCKED_BY_DEFERRED_COMMAND | #33–#34 | **NO** |
| `Modals.ts` | BLOCKED_BY_DEFERRED_COMMAND | #30–#33 | **NO** |
| `ClientPortal.ts` | BLOCKED_BY_DEFERRED_COMMAND | #13, #19, #28, etc. | **NO** |
| `ClientWorkspace.ts` | BLOCKED_BY_DEFERRED_COMMAND | #9/#18 islands + 22-row subset | **NO** |
| `LegacyApp.ts` + handlers | BLOCKED_BY_DEFERRED_COMMAND | island host + deferred writes | **NO** |
| `main.ts` bootstrap | KEEP | bootstrap only | **NO** |
| Legacy island `ws-briefing` | BLOCKED_BY_DEFERRED_COMMAND | briefing modals | **NO** |
| Legacy island `ws-sources` | REQUIRES_PRODUCT_REPLACEMENT | **#9 poll trigger** | **NO** |
| Legacy island `ws-deliver` | REQUIRES_PRODUCT_REPLACEMENT | **#18 send trigger** | **NO** |
| Legacy island `ws-production` | BLOCKED_BY_DEFERRED_COMMAND | content pipeline | **NO** |
| Registry #23 topic pin | POST_MVP | presentation state | **NO** (post-MVP) |

**T603 SAFE REMOVAL CANDIDATES (future authorization review) = 5** (wave-2 leaves, pending rollback + observation window)  
**T603 BLOCKED CANDIDATES = 12+** (hybrid pages, islands, LegacyApp, Login, AppShell)  
**FULL LEGACY DELETION READY = NO**

## CR-1 deferred commands (22 rows, CU?=NO or PARTIAL)

| IDs | Runtime required? | Legacy host | React replacement | Blocks host deletion? | Post-MVP? |
|-----|-------------------|-------------|-------------------|----------------------|-----------|
| 2–6 | Yes (profile facts) | ClientProfilePanel + islands | Display-only React; writes legacy | **YES** | No |
| 7 | Yes | ProofWallPanel | Read-only React | **YES** | No |
| 14–17, 19, 27, 33 | Yes (delivery/curation) | ClientWorkspace, Modals | Handoff / islands | **YES** | No |
| 20–21, 25 | Yes (signals/curation) | ClientWorkspace radar/sources | Partial React reads | **YES** | No |
| 22 | Yes | ClientWorkspace radar | Partial (routing canonical; persist legacy) | **YES** | No |
| 23 | Optional | ClientWorkspace | — | Low | **YES** |
| 29–30 | Yes | Modals, positioning | Handoff | **YES** | No |

Cutover-spine rows **#1, #8–#13, #18, #24, #26, #28, #31–#32, #34** remain legacy-invoked canonical consumers — still block naive deletion of their UI hosts.

## T-602 regression (pre-removal baseline)

| Gate | Result |
|------|--------|
| FULL CHECK | **1965/1965 PASS** |
| RULES | **91/91 PASS** |
| BUILD | **PASS** |
| Phase-5 focused Vitest | **73/73 PASS** |
| Stage-B + T508 Playwright | **21/21 PASS** |
| P0 | **0** |
| P1 | **0** |
| P2 | **3** (unchanged) |

## Exit

| Field | Value |
|-------|--------|
| **SPEC-010 Phase 6** | **PRE_REMOVAL_GATES_COMPLETE_PENDING_T603_AUTHORIZATION_REVIEW** |
| **SPEC-010 CODE_COMPLETE** | **NO** |
| **MVP CODE_COMPLETE** | **NO** |
| **PLANNER REACHABILITY** | **UNREACHABLE** |
| **NEXT ACTION** | **SPEC010_T603_SUBSET_REMOVAL_AUTHORIZATION_REVIEW** |
