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

## Regression (Wave B4 exit)

| Gate | Result |
|------|--------|
| FULL CHECK | **2074/2074 PASS** |
| RULES | **91/91 PASS** |
| BUILD | **PASS** |
| B4 FOCUSED | **14/14 PASS** |
| CR1 Execution Delivery | **106/106 PASS** |
| B3 FROZEN | **15/15 PASS** |
| B2 FROZEN | **19/19 PASS** |
| B1 FROZEN | **19/19 PASS** |
| #21b frozen regression | **15/15 PASS** |
| #20 frozen regression | **18/18 PASS** |
| #18 Stage B | **7/7 PASS** |
| ATTACK | **5/5 PASS** |
| PHASE5 FOCUSED | **73/73 PASS** |
| PLAYWRIGHT | **21/21 PASS** |

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

`CR1_WAVE_B5_PROPOSE_ANGLE_AUTHORIZATION_REVIEW` — do **not** auto-implement #15.
