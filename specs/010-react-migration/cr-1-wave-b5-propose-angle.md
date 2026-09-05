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

Targeted rerun at governance closure (test-only; no implementation changes).

| Gate | Result |
|------|--------|
| #21b FORMAL FROZEN | **14/14 PASS** (`-t "#21b"`) |
| #21 broader caller architecture guard | **1/1 PASS** (`-t "primary #21 send-to-curation"`) |
| #20 FORMAL FROZEN | **17/17 PASS** (`-t "#20"`) |
| #14→#20 B3 composite guard | **1/1 PASS** (`-t "#14 curation cascade discard"`) |
| SPEC-010 PHASE5 FOCUSED | **73/73 PASS** (`t010501`–`t010507` · `t010509` · `t010510`) |
| B5 FOCUSED | **20/20 PASS** (`tests/cr1WaveB5ProposeAngle.test.ts`) |
| CR1 Execution Delivery | **107/107 PASS** |
| B4 FROZEN | **14/14 PASS** (`-t "Wave B4"`) |
| B3 FROZEN | **15/15 PASS** (`-t "Wave B3"`) |
| B2 FROZEN | **19/19 PASS** (`-t "Wave B2"`) |
| B1 FROZEN | **19/19 PASS** (`-t "Wave B1"`) |
| #18 Stage B | **7/7 PASS** (`tests/stageBExecutionDeliverySend.test.ts`) |
| ATTACK | **5/5 PASS** (`tests/t010510ThreatCapstone.test.ts`) |
| ROLE REACHABILITY GUARDS | **4/4 PASS** (within B5 suite) |
| PLAYWRIGHT (T403+T508) | **21/21 PASS** |
| FULL CHECK | **2095/2095 PASS** |
| RULES | **91/91 PASS** |
| BUILD | **PASS** |

---

## Checkpoint SHAs

| Role | SHA |
|------|-----|
| B5 implementation | `ca5dfb24b631eb70250c11154cb4605125665e4d` |
| B5 frozen content | `ca5dfb24b631eb70250c11154cb4605125665e4d` |
| B5 formal acceptance / CR1 governance tip | *(this governance-only commit — branch tip after closure)* |

Implementation and formal acceptance are **separate commits**. The implementation SHA is preserved unchanged; this document’s acceptance SHA records governance-only closure.

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
