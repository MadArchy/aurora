# CR-2 Destination Authority Remediation + P12 Final Re-Acceptance

**Status:** `FORMALLY_ACCEPTED`  
**Starting checkpoint:** `b55006d857f7f687cd9b866edb739f37fe929023`  
**Premature prior acceptance:** `b55006d857f7f687cd9b866edb739f37fe929023` classified as `PREMATURE_P12_ACCEPTANCE_BEFORE_CR2_DESTINATION_AUTHORITY_REMEDIATION`

---

## Confirmed defect (pre-remediation)

| Field | Value |
|-------|-------|
| CONSUMER | `createBriefFromCurationEntry` |
| PRE-REMEDIATION ACTION SOURCE | `params.destination` → `curationDestinationToAuthorizedAction(params.destination)` |
| ENTRY DESTINATION USE | Reloaded but **unused** for action mapping |
| MISMATCH REJECTED | **NO** |
| ATTACK | `entry.destination=TASK_VIDEO` + caller `OPPORTUNITY` → `CREATE_OPPORTUNITY` |

---

## CR-2 lineage (unchanged)

| Label | SHA | Message |
|-------|-----|---------|
| IMPLEMENTATION | `3eb548487a425e830a4758244326b78a88481521` | `fix(brief): reload curation entry before brief creation` |
| GOVERNANCE | `3c53b49f1eddc1606ad74828708e7dd83c8cd45a` | `docs(cr-2): ratify brief-from-curation consumer remediation` |
| FROZEN | `e5b62e1648ad4b49c0ff0c282ea62bc5557f76cd` | `docs(cr-2): pin brief-from-curation remediation checkpoint SHA` |

---

## Remediation contract

| Field | Value |
|-------|-------|
| REMEDIATION SHA | `a2e9a6c5fb2330262fa177cb5234acf66a56c582` |
| POST-REMEDIATION ACTION SOURCE | `entry.destination` (authoritative) only |
| PARAM DESTINATION ROLE | `NONAUTHORITATIVE_COMPATIBILITY_ASSERTION` |
| ENTRY DESTINATION ROLE | **SOLE AUTHORITY** |
| MISMATCH ERROR CODE | `CURATION_DESTINATION_MISMATCH` |
| MISMATCH ERROR MESSAGE | `Curation destination mismatch: caller asserted ${params.destination}, authoritative destination is ${authoritativeDestination}.` |
| ERROR OWNER | `BriefFromCurationConsumerError` in `strategicBriefConsumer.ts` |
| MISMATCH WRITE COUNT | **0** (before `useCases.create` / `setCurationStrategicBriefId`) |

---

## Tamper regression coverage

| Test | Result |
|------|--------|
| TASK_VIDEO + caller OPPORTUNITY | REJECT / no writes |
| OPPORTUNITY + caller TASK_ARTICLE | REJECT / no writes |
| EVIDENCE + caller TASK_ARTICLE | REJECT / no writes |
| DISCARD + caller OPPORTUNITY | REJECT / no writes |
| Matching destinations (all Brief-producing) | PASS |
| DRAFT idempotency + mismatch | REJECT mismatch first |

Files: `tests/cr2BriefFromCurationEntry.test.ts`, `tests/reactParityWaveP12CreateStrategicBrief.test.ts`

---

## P12 provenance

| Field | Value |
|-------|-------|
| P12 FEATURE SHA | `06010ecfe2961fea10341a750ca8a6673ac4e8cb` |
| PREMATURE GOVERNANCE SHA | `b55006d857f7f687cd9b866edb739f37fe929023` |
| REACT MODIFICATIONS | **0** (presentation passes factual read assertion; canonical consumer enforces) |

---

## Unchanged boundaries

Trusted context · thesis/routing (`loadGovernedSignalCluster`) · idempotency semantics · #14/#15/Brief approval/#17/#18/#22 · React destination authority **0**

---

## Gate matrix (re-run post-remediation)

| Gate | Result |
|------|--------|
| CR-2 | **21/21 PASS** |
| P12 FOCUSED | **18/18 PASS** |
| SPEC003 (phase2–5 + core) | **123/123 PASS** |
| CR-3 | **17/17 PASS** |
| FULL VITEST | **2415/2415 PASS** |
| COMBINED PLAYWRIGHT | **57/57 PASS** |
| RULES | **91/91 PASS** |
| BUILD | **PASS** |

---

## Handoff / T603

| Item | Value |
|------|-------|
| HANDOFF COUNT | **12** |
| DELIVER ACTIONS | **1** |
| CR-2 DESTINATION AUTHORITY | **REMEDIATED_AND_FROZEN** |
| P12 | **FORMALLY_ACCEPTED** |
| T603 | `ZERO_SAFE_SUBSET_DEFERRED` |
| T603 IMPLEMENTATION | NOT AUTHORIZED |
| T604 | NOT AUTHORIZED |

**NEXT ACTION:** `T603_REACT_PARITY_POST_P12_FRONTIER_REVIEW`
