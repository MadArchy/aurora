# CR-1 Pre-T603 Wave A2 — #21b MarkSignalSaved

**Class:** `OPERATIONAL_APPLICATION_CANONICALIZATION`  
**Status:** `FORMALLY_ACCEPTED` · `#21b CANONICALIZED_AND_FROZEN`  
**Authorized base checkpoint:** `15e4a82b6ff091312e665347f780ef0663ace83b`  
**Wave scope:** **#21b only** — `#21a`, `#14`, and all other CR-1 IDs **NOT AUTHORIZED**  
**Timezone:** America/Bogota

---

## Split authority (registry #21)

| Sub-intent | Status | Command / surface |
|---|---|---|
| **#21a** `addToCuration(...)` | **DEFERRED** | Legacy `dbService.addToCuration` in `.btn-send-to-curation` |
| **#21b** `decideSignal(..., SAVED)` | **CANONICALIZED_AND_FROZEN** | `MarkSignalSaved` via `signalIntakeConsumer.markSignalSaved` |

**Registry row #21 `CU?` remains NO** — composite not fully canonical while #21a deferred.

---

## Error-semantics compatibility (Wave A2)

After legacy `#21a` persists, canonical `#21b` may return typed `SIGNAL_NOT_FOUND`.
`handleSendToCurationClick` translates **only** that code into legacy composite continuation:

- no warning/error toast
- `SIGNAL_TO_CURATION` audit
- success toast `Enviada a curación`
- `refreshMain`

Application fail-closed contract **unchanged** (`MarkSignalSaved` still throws).

Other auth/tenant errors are **not** swallowed. No rollback of #21a (**BEST_EFFORT_SEQUENTIAL**).

---

## Scope

| Item | Value |
|------|--------|
| Registry ID | **#21b** (partial of composite **#21**) |
| Command | `MarkSignalSaved` |
| Boundary | Signal Intake Application |
| Primary caller migrated | `src/ui/legacy/handlers/radarHandlers.ts` · `.btn-send-to-curation` · `#21b step only` |
| #21a | **NOT migrated** — remains legacy `dbService.addToCuration` |
| #20 DiscardSignal | **FROZEN** — **0 modifications** |
| #14 curation cascade | **NOT migrated** |
| New Domain rules | **0** |
| Scoring / routing authority in #21b | **0** |
| Consumer SAVED audit | **0** — composite owns `SIGNAL_TO_CURATION` |

---

## Legacy intent preserved (#21b)

`decideSignal(signalId, 'SAVED')` — sets `managerDecision = SAVED` only; does **not** change `status`, `discardReason`, scoring, routing, or thesis fields. Already-SAVED repeat still persists (no new idempotency rule).

---

## Composite order (unchanged)

`scoreSignal?` → `#21a addToCuration` → `#21b markSignalSaved` → `SIGNAL_TO_CURATION` audit → success toast → `refreshMain`

---

## Security

`requireTenantScope` → trusted org/client/actor/role.  
ADMIN required. Authoritative reload by `signalId` inside Application.  
Caller org/client spoof → DENY. GATE_FIRST ordering enforced.

---

## Adoption

| Surface | Model |
|---------|--------|
| Send-to-curation #21b | `signalIntakeConsumer.markSignalSaved` |
| Send-to-curation #21a | Legacy `dbService.addToCuration` (deferred) |
| Persistence | `DbSignalIntakeAdapter` → `getSignalById` + `decideManagerOutcome(SAVED)` |
| React | **0 product file modifications** |

---

## Regression (Wave A2 exit)

| Gate | Result |
|------|--------|
| FULL CHECK | **2003/2003 PASS** |
| RULES | **91/91 PASS** |
| BUILD | **PASS** |
| PHASE5 FOCUSED | **73/73 PASS** |
| PLAYWRIGHT (Stage-B + T508) | **21/21 PASS** |
| FOCUSED #21b | **14/14** (within `cr1SignalIntake.test.ts`) |
| CR1 Signal Intake | **52/52 PASS** |
| #20 frozen regression | **18/18 PASS** (unchanged Wave A1 block) |
| CR-3 attack suite | **17/17 PASS** |
| ATTACK capstone (T-010-510) | **5/5 PASS** |

---

## Checkpoint SHAs

| Role | SHA |
|------|-----|
| Authorized start | `15e4a82b6ff091312e665347f780ef0663ace83b` |
| Implementation | `a54bd351733ea4d3984e2738362fc7f93c0797a0` |
| Frozen content (#21b Wave A2) | `a54bd351733ea4d3984e2738362fc7f93c0797a0` |
| Wave A2 formal acceptance / governance tip | *(recorded after freeze commit)* |

---

## Frozen Wave A1 references (unchanged)

| Role | SHA |
|------|-----|
| #20 implementation | `c7377ff525a27fbaea44b1b42914d8b14bc012da` |
| #20 remediation / frozen content | `eccd91268acc329ba2669334b07ade7e6c07f762` |
| Wave A1 formal acceptance | `38bf364d721155572f6ae9a4c11ff94f628e6fcc` |

---

## Next action

`CR1_PRE_T603_WAVE_B_AUTHORIZATION_REVIEW` — review `#21a`, `#14`, `#15`, `#16`, `#17`; do **not** auto-implement Wave B.
