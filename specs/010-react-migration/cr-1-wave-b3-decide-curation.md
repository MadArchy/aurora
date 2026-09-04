# CR-1 Wave B3 — #14 DecideCuration

**Class:** `OPERATIONAL_APPLICATION_CANONICALIZATION`  
**Status:** `FORMALLY_ACCEPTED` · `#14 CANONICALIZED_AND_FROZEN`  
**Human partial-failure approval SHA:** `9133d28fcc8a1dce3b2478046a3e42642483715e`  
**Timezone:** America/Bogota

---

## Scope

| Item | Value |
|------|--------|
| Registry ID | **#14** |
| Command | `DecideCuration` |
| Boundary | Execution Delivery Application |
| Primary caller | `curationHandlers.ts` · `handleCurationFormSubmit` · `.curation-form` |
| DISCARD cascade | explicit frozen `#20` via `discardSignalForCurationComposite` (no consumer `SIGNAL_DISCARDED` audit) |
| Port extension | `CurationRepositoryPort.getById` · `decideCuration` (additive; B1/B2 unchanged) |
| Mutated fields | `destination` · `managerRationale` · `decidedAt` · `decidedBy` only |
| `decidedBy` | trusted CR-3 `actorId` only |
| Presentation validation | destination required · rationale trim ≥10 (handler-side) |
| Missing entry compat | typed `CURATION_NOT_FOUND` → audit 1 · success toast 1 · render 1 · write 0 |
| DISCARD `SIGNAL_NOT_FOUND` compat | success continuation after successful #14 |
| DISCARD non-not-found failure | `BEST_EFFORT_SEQUENTIAL` · warning · curation persisted |
| `queueCurationInBriefing` | remains handler composite (not #14 / not #17) |

---

## DISCARD composite (binding)

1. `DecideCuration` persists `destination = DISCARD`
2. if `entry.signalId`: `discardSignalForCurationComposite` (frozen #20 Application, no composite audit)
3. `CURATION_DECIDED` audit (handler)
4. success or partial-failure toast
5. `render`

**No** rollback · **no** `SIGNAL_DISCARDED` audit on this path · **no** `#20` modifications.

---

## Regression (Wave B3 exit)

| Gate | Result |
|------|--------|
| FULL CHECK | **2060/2060 PASS** |
| RULES | **91/91 PASS** |
| BUILD | **PASS** |
| B3 FOCUSED | **15/15 PASS** |
| CR1 Execution Delivery | **92/92 PASS** |
| B2 FROZEN | **19/19 PASS** |
| B1 FROZEN | **19/19 PASS** |
| #21b frozen regression | **15/15 PASS** |
| #20 frozen regression | **18/18 PASS** |
| ATTACK | **5/5 PASS** |
| PHASE5 FOCUSED | **73/73 PASS** |
| PLAYWRIGHT | **21/21 PASS** |

---

## Checkpoint SHAs

| Role | SHA |
|------|-----|
| Authorized start | `1981269000d2f3d93f8e754a1be29b23ebcbd502` |
| B3 human partial-failure approval | `9133d28fcc8a1dce3b2478046a3e42642483715e` |
| B3 implementation | `745f642f07b60955378a4677a42e92ab717a5c43` |
| B3 frozen content | `745f642f07b60955378a4677a42e92ab717a5c43` |
| B3 formal acceptance / CR1 governance tip | `5c347f77f120116d9169d4769e4917681bd72301` |

---

## Registry

| Row | `CU?` |
|-----|-------|
| #14 | **YES** |
| #21 | **YES** (unchanged) |

---

## T-010-603 impact (record only)

Removes `#14` direct `dbService.decideCuration` and DISCARD-path direct `dbService.decideSignal` from `curationHandlers.ts`. **T-010-603 remains NOT_AUTHORIZED.**

---

## Next action

`CR1_WAVE_B4_DELIVERY_ASSEMBLY_AUTHORIZATION_REVIEW` — do **not** auto-implement #17.
