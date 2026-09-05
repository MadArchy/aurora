# CR-1 Wave B6 — #16-R / #16-O Remove / Reopen Curation

**Class:** `OPERATIONAL_APPLICATION_CANONICALIZATION`  
**Status:** `FORMALLY_ACCEPTED` · `#16-R CANONICALIZED_AND_FROZEN` · `#16-O CANONICALIZED_AND_FROZEN`  
**Timezone:** America/Bogota

---

## Scope

| Item | Value |
|------|--------|
| Registry ID | **#16** (two command identities: **#16-R** Remove · **#16-O** Reopen) |
| Commands | `RemoveCuration` · `ReopenCuration` |
| Boundary | Execution Delivery Application |
| Ports | `CurationRepositoryPort.getById` (B3 read-only reuse) · `CurationRemovalPersistencePort` · `CurationReopenPersistencePort` |
| Role | **ADMIN only** (authority remediation; CLIENT production reachability structurally absent) |
| Remove semantic | **Physical delete** of `CurationEntry`; no referential cleanup |
| Reopen semantic | Partial decision reset only (`destination`, `managerRationale`, `decidedAt`, `decidedBy`); preserves `aiAngle`, `strategicBriefId`, `deliveryPackageId`, `signalId`, `thesisId` |
| Audits | Remove: `CURATION_REMOVED` ×1 per click at handler seam (including missing-id compat) · Reopen: **0** |
| SPEC-003 gate | **NONE** for #16 |

**GENERIC COMBINED STATUS COMMAND = 0.**

---

## T508 rollback stability (Decision B)

B6 formal acceptance was blocked pending T508 rollback parity. Human Decision B authorized **narrow T508 governance amendment**: canonical JSON **object-key order** normalization only for stable rollback comparison. See `t-010-508-rollback-stable-storage-amendment.md`. **Production changes for T508 = 0.**

---

## Regression (Wave B6 formal acceptance)

| Gate | Frozen contract | Result | Filter / command |
|------|-----------------|--------|------------------|
| T508 comparator focused | **13** | **13/13 PASS** | `tests/e2eRollbackStableSnapshot.test.ts` |
| T508 isolated rollback | **1** | **1/1 PASS** | `-g "mid-journey rollback"` |
| T508 full Playwright | **10** | **10/10 PASS** | `e2e/t010508-phase5-parity.spec.ts` |
| PLAYWRIGHT Stage-B + T508 | **21** | **21/21 PASS** | `e2e/t010403-stage-b-seam.spec.ts` + `e2e/t010508-phase5-parity.spec.ts` |
| B6 FOCUSED | **25** | **25/25 PASS** | `tests/cr1WaveB6RemoveReopenCuration.test.ts` |
| CR1 Execution Delivery | **108** | **108/108 PASS** | `tests/cr1ExecutionDelivery.test.ts` |
| B5 FROZEN | **20** | **20/20 PASS** | `tests/cr1WaveB5ProposeAngle.test.ts` |
| B4 FROZEN | **14** | **14/14 PASS** | `-t "Wave B4"` |
| B3 FROZEN | **15** | **15/15 PASS** | `describe('CR-1 Wave B3 #14 — DecideCuration')` only |
| B3 broader selector | — | **16/16 PASS** (filter expansion only) | `-t "Wave B3"` |
| B2 FROZEN | **19** | **19/19 PASS** | `-t "Wave B2"` |
| B1 FROZEN | **19** | **19/19 PASS** | `-t "Wave B1"` |
| #21b FORMAL FROZEN | **14** | **14/14 PASS** | formal blocks |
| #21b broader selector | — | **17/17 PASS** (filter expansion only) | `-t "#21b"` |
| #20 FORMAL FROZEN | **17** | **17/17 PASS** | formal blocks |
| #20 broader selector | — | **20/20 PASS** (filter expansion only) | `-t "#20"` |
| #18 Stage B | **7** | **7/7 PASS** | `tests/stageBExecutionDeliverySend.test.ts` |
| SPEC-010 PHASE5 FOCUSED | **73** | **73/73 PASS** | nine adversarial files |
| ATTACK | **5** | **5/5 PASS** | `tests/t010510ThreatCapstone.test.ts` |
| ROLE REACHABILITY GUARDS | **4** | **4/4 PASS** | within `tests/cr1WaveB6RemoveReopenCuration.test.ts` |
| FULL CHECK | **2134** | **2134/2134 PASS** | `npm run check` (+13 T508 comparator tests vs B6 implementation baseline) |
| RULES | **91** | **91/91 PASS** | `npm run test:rules` |
| BUILD | — | **PASS** | `npm run build` |

**B3 / #21b / #20 CONTRACT CHANGE = 0** (filter expansion only).

---

## Severity / debt scope

| Scope | P0 | P1 | P2 | P3 |
|-------|----|----|----|----|
| **B6-local** | **0** | **0** | **0** | **0** |
| **Global SPEC-010 / Phase 6** (unchanged by B6) | **0** | **0** | **3** | **7** |

**B6 AUTHORIZED P2 REMEDIATIONS = 0.**

---

## Checkpoint SHAs

| Role | SHA |
|------|-----|
| B6 starting checkpoint | `fb4c99f5dd65c66903b4e249accdb0441f60b0e0` |
| B6 implementation | `7d33ee4c90c687db1bc9f0998e2638acc6fc36d1` |
| B6 frozen content | `7d33ee4c90c687db1bc9f0998e2638acc6fc36d1` |
| Premature governance closure (historical; preserved) | `2b07af7da7bca288f375553a22675a8bab0b9c83` |
| Premature metadata pin (historical; preserved) | `34b5660a3440ad2d1d88c5d25ed57fa2b297ab7c` |
| T508 stability patch (Decision B) | `1f6bab09b1a52e6a3c9f97ed224bfecf0b709b3b` |
| B6 formal acceptance / CR1 governance tip | *(this governance commit — branch tip after acceptance)* |

Implementation, T508 amendment, and formal acceptance are **separate commits**.

---

## Registry

| Row | `CU?` |
|-----|-------|
| #16 | **YES** |
| #16-R RemoveCuration | canonical |
| #16-O ReopenCuration | canonical |
| #14–#15, #17–#18, #20–#21 | unchanged frozen |

---

## T-010-603 impact (record only)

Removes direct `dbService.removeCuration` / `dbService.reopenCuration` from `curationHandlers.ts`. **T-010-603 remains NOT_AUTHORIZED.**

---

## Next action

`CR1_WAVE_B7_ACKNOWLEDGE_DELIVERY_AUTHORIZATION_REVIEW` — do **not** auto-implement #19.
