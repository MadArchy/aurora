# CR-1 Pre-T603 Wave A1 — #20 DiscardSignal

**Class:** `OPERATIONAL_APPLICATION_CANONICALIZATION`  
**Status:** `CANONICALIZED_AND_FROZEN`  
**Authorized base checkpoint:** `2c099a94b0ef79f902b2e5a37a38c811c4ba0466`  
**Wave scope:** **#20 only** — `#21b`, `#14`, and all other CR-1 IDs **NOT AUTHORIZED**  
**Timezone:** America/Bogota

---

## Scope

| Item | Value |
|------|--------|
| Registry ID | **#20** |
| Command | `DiscardSignal` |
| Boundary | Signal Intake Application |
| Primary caller migrated | `src/ui/legacy/handlers/radarHandlers.ts` · `.btn-discard-signal` |
| #14 curation cascade | **NOT migrated** — remains legacy `dbService.decideSignal` until its wave |
| #21b (`SAVED`) | **DEFERRED** |
| New Domain rules | **0** |
| Scoring / routing authority in #20 | **0** |

---

## Legacy intent preserved

`decideSignal(signalId, 'DISCARDED', reason)` — sets `managerDecision = DISCARDED`, `status = DISCARDED`, `discardReason = reason`, `saveAll()`. Default reason: `Descartado por el manager en el radar.`

---

## Security

`requireTenantScope` → trusted org/client/actor/role.  
ADMIN required. Authoritative reload by `signalId` inside Application.  
Caller org/client spoof → DENY. GATE_FIRST ordering enforced.

---

## Adoption

| Surface | Model |
|---------|--------|
| Radar discard (#20) | `signalIntakeConsumer.discardSignal` |
| Persistence | `DbSignalIntakeAdapter` → `getSignalById` + `decideSignal` |
| React | **0 product file modifications** |
| #14 DISCARD cascade | Legacy direct (deferred) |

---

## Regression (Wave A1 exit)

| Gate | Result |
|------|--------|
| FULL CHECK | **1985/1985 PASS** |
| RULES | **91/91 PASS** |
| BUILD | **PASS** |
| PHASE5 FOCUSED | **73/73 PASS** |
| PLAYWRIGHT | **21/21 PASS** (Stage-B 11 + T508 10) |
| FOCUSED #20 | **15/15** (within `cr1SignalIntake.test.ts`) |
| CR1 Signal Intake | **34/34 PASS** |
| CR-3 attack suite | **17/17 PASS** |

---

## Checkpoint SHAs

| Role | SHA |
|------|-----|
| Authorized start | `2c099a94b0ef79f902b2e5a37a38c811c4ba0466` |
| Implementation | `c7377ff525a27fbaea44b1b42914d8b14bc012da` |
| Governance tip | *(filled at commit)* |

---

## Next action

`CR1_PRE_T603_WAVE_A2_AUTHORIZATION_REVIEW` — decide #21b vs Wave B; do **not** auto-implement #21b.
