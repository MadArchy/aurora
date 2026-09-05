# CR-1 Wave B4 — #17 Delivery Assembly

**Class:** `OPERATIONAL_APPLICATION_CANONICALIZATION`  
**Status:** `FORMALLY_ACCEPTED` · `#17 CANONICALIZED_AND_FROZEN`  
**Timezone:** America/Bogota

---

## Scope

| Item | Value |
|------|--------|
| Registry ID | **#17** |
| Commands | `EnsureDraftDelivery` · `AddCurationToDelivery` · `UpdateDeliveryPackageMetadata` · `RemoveDeliveryItemFromDelivery` · `DiscardDraftDelivery` |
| Boundary | Execution Delivery Application |
| Port | `DeliveryAssemblyRepositoryPort` (new) · `CurationRepositoryPort.getById` (B3 read-only reuse) |
| ADD policy | **A2** — attach only after confirmed DeliveryItem creation |
| REMOVE policy | **R1** — detach CurationEntry → remove DeliveryItem |
| DISCARD policy | single in-memory aggregate + one persistence commit |
| Audits | **0** assembly audits |
| `#14→#17` | presentation sequencing only (`queueCurationInBriefing` → `addCurationToDelivery`) |

---

## Regression (Wave B4 formal acceptance)

Targeted rerun at governance closure (test-only; no implementation changes).

| Gate | Result |
|------|--------|
| #21b FORMAL FROZEN | **14/14 PASS** (`-t "#21b"`) |
| #21 broader caller architecture guard | **1/1 PASS** (`-t "primary #21 send-to-curation"`) |
| #20 FORMAL FROZEN | **17/17 PASS** (`-t "#20"`) |
| #14→#20 B3 composite guard | **1/1 PASS** (`-t "#14 curation cascade discard"`) |
| SPEC-010 PHASE5 FOCUSED | **73/73 PASS** (`t010501`–`t010507` · `t010509` · `t010510`) |
| B4 FOCUSED | **14/14 PASS** (`-t "Wave B4"`) |
| CR1 Execution Delivery | **106/106 PASS** |
| B3 FROZEN | **15/15 PASS** (`-t "Wave B3"`) |
| B2 FROZEN | **19/19 PASS** (`-t "Wave B2"`) |
| B1 FROZEN | **19/19 PASS** (`-t "Wave B1"`) |
| #18 Stage B | **7/7 PASS** (`tests/stageBExecutionDeliverySend.test.ts`) |
| ATTACK | **5/5 PASS** (`tests/t010510ThreatCapstone.test.ts`) |
| PLAYWRIGHT (T403+T508) | **21/21 PASS** |
| FULL CHECK | **2074/2074 PASS** |
| RULES | **91/91 PASS** |
| BUILD | **PASS** |

**Historical broader coverage (not relabeled as formal counts):**

- #21b: 14 formal + 1 architecture guard = 15 covered scenarios
- #20: 17 formal + 1 B3 composite guard = 18 covered scenarios

---

## Checkpoint SHAs

| Role | SHA |
|------|-----|
| B4 implementation | `29766eccbfbf444c4ae9da06eab656fbaf4c7e9e` |
| B4 frozen content | `29766eccbfbf444c4ae9da06eab656fbaf4c7e9e` |
| B4 formal acceptance / CR1 governance tip | *(this governance-only commit — branch tip after closure)* |

Implementation and formal acceptance are **separate commits**. The implementation SHA is preserved unchanged; this document’s acceptance SHA records governance-only closure.

---

## Registry

| Row | `CU?` |
|-----|-------|
| #17 | **YES** |
| #14 | **YES** (unchanged) |
| #21 | **YES** (unchanged) |

---

## T-010-603 impact (record only)

Removes six direct `dbService` assembly write symbols from `deliveryHandlers.ts`, `radarHandlers.ts` (`queueCurationInBriefing`), and indirect `#14` composite path. **T-010-603 remains NOT_AUTHORIZED.**

---

## Next action

`CR1_WAVE_B7_ACKNOWLEDGE_DELIVERY_AUTHORIZATION_REVIEW` — do **not** auto-implement #19.
