# CR-1 Wave B5 — #15 Propose Angle

**Class:** `OPERATIONAL_APPLICATION_CANONICALIZATION`  
**Status:** `FORMALLY_ACCEPTED` · `#15 CANONICALIZED_AND_FROZEN`  
**Timezone:** America/Bogota

---

## Scope

| Item | Value |
|------|--------|
| Registry ID | **#15** |
| Command | `ProposeAngle` |
| Boundary | Execution Delivery Application · SPEC-005 AI (live gateway only) |
| Ports | `CurationRepositoryPort.getById` (B3 read-only reuse) · `CurationAnglePersistencePort` (new) · `CurationStrategicBriefReadPort` · `CurationThesisReadPort` · `SignalReadPort` · `AdvisorCurationAnglePort` |
| Role | **ADMIN only** (authority remediation; CLIENT production reachability structurally absent) |
| Live AI | `ADVISOR_CURATION_ANGLE` via frozen SPEC-005 gateway |
| Local heuristic | **NON-AI COMPATIBILITY FALLBACK** (deterministic template) |
| Post-AI reload | **NO** |
| Audits | **0** |
| SPEC-003 gate | **NONE** for #15 |

---

## Regression (Wave B5 formal acceptance)

**Reconciliation rerun** at acceptance provenance closure (test-only; no implementation changes). Commands and counts below are authoritative; frozen historical contract counts are **not** redefined by broader Vitest title filters.

| Gate | Frozen contract | Reconciliation result | Filter / command |
|------|-----------------|----------------------|------------------|
| #21b FORMAL FROZEN | **14** | **14/14 PASS** | `describe('CR-1 Signal Intake — MarkSignalSaved (#21b)')` + consumer + Wave A2 blocks |
| #21b broader selector | — | **17/17 PASS** (filter expansion only) | `-t "#21b"` also matches B1/B2 architecture tests mentioning `#21b` |
| #21 broader caller guard | — | **1/1 PASS** | `-t "primary #21 send-to-curation"` |
| #20 FORMAL FROZEN | **17** | **17/17 PASS** | Signal Intake `#20` formal + consumer + Wave A1 + architecture guard |
| #20 broader selector | — | **19/19 PASS** (filter expansion only) | `-t "#20"` also matches B3 DecideCuration tests mentioning `#20` |
| #14→#20 B3 composite guard | — | **1/1 PASS** | `-t "#14 curation cascade discard"` |
| SPEC-010 PHASE5 FOCUSED | **73** | **73/73 PASS** | `npx vitest run tests/t010501AuthorityAdversarial.test.ts tests/t010502CacheAdversarial.test.ts tests/t010503WritePathAdversarial.test.ts tests/t010504ApprovalAdversarial.test.ts tests/t010505DuplicationAdversarial.test.ts tests/t010506DualAuthorityAdversarial.test.ts tests/t010507MultiThesisDefaults.test.ts tests/t010509AccessibilityPerformance.test.ts tests/t010510ThreatCapstone.test.ts` |
| B5 FOCUSED | **20** | **20/20 PASS** | `tests/cr1WaveB5ProposeAngle.test.ts` |
| CR1 Execution Delivery | **107** | **107/107 PASS** | `tests/cr1ExecutionDelivery.test.ts` |
| B4 FROZEN | **14** | **14/14 PASS** | `-t "Wave B4"` |
| B3 FROZEN | **15** | **15/15 PASS** | `describe('CR-1 Wave B3 #14 — DecideCuration')` only |
| B3 broader selector | — | **16/16 PASS** (filter expansion only) | `-t "Wave B3"` also matches `#14 curation cascade discard delegates discardSignalForCurationComposite (Wave B3)` |
| B2 FROZEN | **19** | **19/19 PASS** | `-t "Wave B2"` |
| B1 FROZEN | **19** | **19/19 PASS** | `-t "Wave B1"` |
| #18 Stage B | **7** | **7/7 PASS** | `tests/stageBExecutionDeliverySend.test.ts` |
| ATTACK | **5** | **5/5 PASS** | `tests/t010510ThreatCapstone.test.ts` |
| ROLE REACHABILITY GUARDS | **4** | **4/4 PASS** | within `tests/cr1WaveB5ProposeAngle.test.ts` |
| FULL CHECK | **2095** | **2095/2095 PASS** | `npm run check` |
| RULES | **91** | **91/91 PASS** | `npm run test:rules` |
| BUILD | — | **PASS** | `npm run build` |

**Filter expansion only (B3 / #21b / #20):** historical frozen scenarios unchanged; additional matches are architecture/integration tests whose titles contain the same substring filters.

### Filter-expansion detail

| Contract | Additional match | Class |
|----------|------------------|-------|
| B3 frozen **15** → selector **16** | `#14 curation cascade discard delegates discardSignalForCurationComposite (Wave B3)` | B3 composite architecture guard (`cr1SignalIntake.test.ts`) |
| #21b frozen **14** → selector **17** | B1 `stale Signal TOCTOU…no #21b`; B1 `duplicate race…no #21b`; B2 `no Signal, #21b, AI…` | cross-wave architecture guards |
| #20 frozen **17** → selector **19** | B3 `use case does not invoke Signal, #20…`; B3 `handler DISCARD without signalId skips #20` | B3 DecideCuration architecture guards |

**B3 CONTRACT CHANGE = 0 · #21b CONTRACT CHANGE = 0 · #20 CONTRACT CHANGE = 0.**

---

## Severity / debt scope (reconciliation)

| Scope | P0 | P1 | P2 | P3 |
|-------|----|----|----|----|
| **B5-local** (Wave B5 implementation + #15 canonicalization) | **0** | **0** | **0** | **0** |
| **Global SPEC-010 / Phase 6** (unchanged by B5; `t-010-phase6-pre-removal-gates.md`) | **0** | **0** | **3** | **7** |

**B5 AUTHORIZED P2 REMEDIATIONS = 0.** B5 did not modify artifacts resolving global P2 debt.

**Pre-B5 global P2 items** (Phase 4C exit ledger · `audit010-09-registry.md` §Severity after Phase 4C; carried unchanged through Phase 5/6):

| ID | Item |
|----|------|
| **P2-1** | **AUDIT010-02** — React strangler / target-stack migration debt (`migration-matrix.md`; foundation installed, cutover incomplete) |
| **P2-2** | **AUDIT010-04** — Legacy component direct `dbService` reads (`QUERY_SEAM_IMPLEMENTED_MIGRATION_PENDING`; 11 retained legacy components) |
| **P2-3** | **AUDIT010-09 / CR-1 residual** — Deferred noncutover registry inventory and residual migration architecture debt (`t-010-phase4-formal-closure.md`) |

Do **not** report global P2 as 0 in B5 acceptance evidence.

---

## Checkpoint SHAs

| Role | SHA |
|------|-----|
| B5 implementation | `ca5dfb24b631eb70250c11154cb4605125665e4d` |
| B5 frozen content | `ca5dfb24b631eb70250c11154cb4605125665e4d` |
| B5 intermediate governance closure | `aa4f426dc267230a214de3eb27c153035bac9558` |
| B5 formal acceptance / CR1 governance tip | *(this governance-only reconciliation commit — branch tip after acceptance)* |

Implementation and formal acceptance are **separate commits**. `aa4f426` remains historical intermediate closure (registry #15 CU?=YES); this reconciliation commit corrects regression-label and P2-scope evidence without rewriting history.

**Authoritative starting checkpoint:** `eb4b4269044bc570f81bac384d38521efa255f88`

---

## Registry

| Row | `CU?` |
|-----|-------|
| #15 | **YES** |
| #14 | **YES** (unchanged) |
| #17 | **YES** (unchanged) |

---

## T-010-603 impact (record only)

Removes direct `dbService.setCurationAngle` and direct handler `services/advisor.proposeAngle` business seam from `#15` path. **T-010-603 remains NOT_AUTHORIZED.**

---

## Next action

`CR1_WAVE_B6_REMOVE_REOPEN_CURATION_AUTHORIZATION_REVIEW` — do **not** auto-implement #16.
