# CR-1 Wave B10 — #27 Assign / Cancel Client Task

**Class:** `OPERATIONAL_APPLICATION_CANONICALIZATION`  
**Status:** `FORMALLY_ACCEPTED` · `#27 CANONICALIZED_AND_FROZEN`  
**Timezone:** America/Bogota

---

## Scope

| Item | Value |
|------|--------|
| Registry ID | **#27** |
| Commands | `AssignClientTask` · `CancelClientTask` |
| Assign origins | `MANUAL` · `FROM_RECOMMENDATION` (closed typed variants) |
| Boundary | Execution Delivery Application |
| Assign ports | `TaskAssignmentPersistencePort` · `ClientExecutionReadPort` · reuse `CurationThesisReadPort` |
| Cancel ports | reuse `TaskRepository.saveStatus` |
| Role | **ADMIN only** (`requireAdminRole` + `gate`) |
| Missing client | **DENY** — no session-org fallback write |
| Cancel missing task | **compat** — write 0 · audit 1 · success toast preserved |
| Composite path | frozen #33 → `assignClientTask(FROM_RECOMMENDATION)` → orphan `updateRecommendationStatus` |
| Orphan debt | `RESIDUAL_ORPHAN_RECOMMENDATION_STATUS_AUTHORITY` = **1** (presentation seam in `contentHandlers.ts`) |

**GENERIC TASK STATUS COMMAND = 0** · **GENERIC TASK CREATE COMMAND = 0** · **NEW DOMAIN RULE = 0** · **#28 / #33 MODIFICATIONS = 0**

---

## Regression (Wave B10 formal acceptance)

| Gate | Frozen contract | Result | Filter / command |
|------|-----------------|--------|------------------|
| B10 FOCUSED | **25** | **25/25 PASS** | `tests/cr1WaveB10AssignCancelClientTask.test.ts` |
| CR1 Execution Delivery | **108** | **108/108 PASS** | `tests/cr1ExecutionDelivery.test.ts` |
| B9 FROZEN | **18** | **18/18 PASS** | `tests/cr1WaveB9CreateContentDraft.test.ts` |
| B7 FROZEN | **15** | **15/15 PASS** | `tests/cr1WaveB7AcknowledgeDelivery.test.ts` |
| B6 FROZEN | **25** | **25/25 PASS** | `tests/cr1WaveB6RemoveReopenCuration.test.ts` |
| B5 FROZEN | **20** | **20/20 PASS** | `tests/cr1WaveB5ProposeAngle.test.ts` |
| B4 FROZEN | **14** | **14/14 PASS** | `-t "Wave B4"` |
| B3 HISTORICAL | **15** | **15/15 PASS** | `describe('CR-1 Wave B3 #14 — DecideCuration')` only |
| B3 CURRENT | **15** | **15/15 PASS** | `-t "Wave B3"` |
| B2 FROZEN | **19** | **19/19 PASS** | `-t "Wave B2"` |
| B1 FROZEN | **19** | **19/19 PASS** | `-t "Wave B1"` |
| #21b HISTORICAL | **14** | **14/14 PASS** | formal blocks |
| #21b CURRENT | **14** | **14/14 PASS** | `-t "#21b"` |
| #20 HISTORICAL | **17** | **17/17 PASS** | formal blocks |
| #20 CURRENT | **17** | **17/17 PASS** | `-t "#20"` |
| #18 Stage B | **7** | **7/7 PASS** | `tests/stageBExecutionDeliverySend.test.ts` |
| #28 FROZEN | — | **PASS** (within CR1 Execution Delivery) | TransitionClientTask blocks unchanged |
| #31 FROZEN | — | **PASS** (within CR1 Execution Delivery) | SaveContentDraft blocks unchanged |
| #32 FROZEN | — | **PASS** (within CR1 Execution Delivery) | ReviewClientArticle blocks unchanged |
| T508 comparator | **13** | **13/13 PASS** | `tests/e2eRollbackStableSnapshot.test.ts` |
| T508 full Playwright | **10** | **10/10 PASS** | `e2e/t010508-phase5-parity.spec.ts` |
| PLAYWRIGHT Stage-B + T508 | **21** | **21/21 PASS** | `e2e/t010403-stage-b-seam.spec.ts` + `e2e/t010508-phase5-parity.spec.ts` |
| SPEC-010 PHASE5 FOCUSED | **73** | **73/73 PASS** | nine adversarial files |
| ATTACK | **5** | **5/5 PASS** | `tests/t010510ThreatCapstone.test.ts` |
| ROLE/REACHABILITY | **12** | **12/12 PASS** | frozen B5/B6/B9 architecture guards |
| FULL | **2192** | **2192/2192 PASS** | `npm run test:run` (+25 B10 tests vs B9 acceptance baseline 2167) |
| RULES | **91** | **91/91 PASS** | `npm run test:rules` |
| BUILD | — | **PASS** | `npm run build` |

**Compose key-list guard:** `assignClientTask` + `cancelClientTask` added (+2 commands, **19** total). **#28 / #33 semantic contract change = 0.**

---

## Severity / debt scope

| Scope | P0 | P1 | P2 | P3 |
|-------|----|----|----|----|
| **B10-local** | **0** | **0** | **0** | **0** |
| **Global SPEC-010 / Phase 6** (unchanged by B10) | **0** | **0** | **3** | **7** |
| **Orphan recommendation status** (explicitly outside #27) | — | — | — | **1 OPEN** |

**ORPHAN RECOMMENDATION STATUS DEBT = 1** at `contentHandlers.ts` → `dbService.updateRecommendationStatus(..., 'CONVERTED_TO_TASK')`.

**MVP REGISTRY AUTHORITY CANONICALIZATION = COMPLETE (20/20)**  
**MVP BUSINESS AUTHORITY CANONICALIZATION = PENDING_ORPHAN_RECONCILIATION**

---

## Checkpoint SHAs

| Role | SHA |
|------|-----|
| B10 starting checkpoint | `bcd7d94019c99b639830145607ab054049c5431b` |
| B10 implementation / frozen content | `28949c0a03adffbc724155ce5636bae4f3abba27` |
| B10 formal acceptance / CR1 governance tip | recorded at acceptance commit |

Implementation and formal acceptance are **separate commits**.

---

## Registry

| Row | `CU?` |
|-----|-------|
| #27 Assign / cancel task | **YES** |

**MVP-required CU? YES = 20 / 20** · **MVP-required CU? NO = 0**

---

## T-010-603 impact (record only)

Removes direct `dbService.addTask` and manager `updateTaskStatus(..., 'CANCELLED')` from `tasksHandlers.ts` and path-C `addTask` from `contentHandlers.ts`. Orphan `updateRecommendationStatus` remains presentation-side. **T-010-603 remains NOT_AUTHORIZED.**

---

## Next action

`CR1_POST_B10_ORPHAN_RECOMMENDATION_STATUS_AUTHORITY_REVIEW` — read-only ownership review for orphan recommendation status before T603 authorization.
