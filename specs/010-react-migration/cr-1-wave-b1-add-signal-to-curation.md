# CR-1 Wave B1 — #21a AddSignalToCuration (radar signal-backed path)

**Class:** `OPERATIONAL_APPLICATION_CANONICALIZATION`  
**Status:** `FORMALLY_ACCEPTED` · `#21a RADAR PATH CANONICALIZED_AND_FROZEN`  
**Human governance approval SHA:** `1dd61ee3bcc74e0a720e2fec857de9bd3e7496a8`  
**Authorized decisions:** `AUTHORIZE_FAIL_CLOSED_AUTHORITATIVE_RELOAD` · `AUTHORIZE_WRITE_TIME_EXISTING_DEDUP_RECHECK`  
**Timezone:** America/Bogota

---

## Split authority (registry #21)

| Sub-intent | Status | Command / surface |
|---|---|---|
| **#21a radar** `addToCuration(...)` | **CANONICALIZED_AND_FROZEN** | `AddSignalToCuration` via `executionDeliveryConsumer.addSignalToCuration` · `.btn-send-to-curation` |
| **#21a advisor** `addToCuration(...)` | **DEFERRED** (B2) | Legacy `dbService.addToCuration` · `.btn-advice-to-curation` |
| **#21b** `MarkSignalSaved` | **CANONICALIZED_AND_FROZEN** (Wave A2) | unchanged |

**Registry row #21 `CU?` remains NO** — advisor #21a deferred; full composite not fully canonical.

---

## Governed authority corrections (binding)

### Stale Signal TOCTOU (`AUTHORIZE_FAIL_CLOSED_AUTHORITATIVE_RELOAD`)

Signal present at presentation preload but absent at Application authoritative reload:

- curation write **0**
- #21b **0**
- `SIGNAL_TO_CURATION` audit **0**
- success toast **0**
- warning toast **1**
- refresh **0**
- snapshot fallback **0**

Classification: `INTENTIONAL_GOVERNED_AUTHORITY_CORRECTION`

### Write-time dedup (`AUTHORIZE_WRITE_TIME_EXISTING_DEDUP_RECHECK`)

Application rechecks existing `isSignalInCuration(clientId, signalId)` immediately before persist.  
Presentation duplicate check remains UX-only.

Duplicate at Application recheck: info toast `Esta señal ya está en la mesa de curación.` · no write · no #21b · no audit · no refresh.

Classification: `EXISTING_RULE_CANONICALIZATION` · **0** new Domain rule · **0** DB uniqueness constraint.

---

## Scope

| Item | Value |
|------|--------|
| Registry ID | **#21a** (partial of composite **#21**) |
| Command | `AddSignalToCuration` |
| Boundary | Execution Delivery Application |
| Primary caller migrated | `radarHandlers.ts` · `handleSendToCurationClick` · `.btn-send-to-curation` |
| Advisor #21a | **NOT migrated** — B2 deferred |
| #21b MarkSignalSaved | **FROZEN** — **0 modifications** |
| #20 DiscardSignal | **FROZEN** — **0 modifications** |
| New Domain rules | **0** |
| Scoring / routing inside B1 | **0** |
| Consumer composite audit | **0** — handler owns `SIGNAL_TO_CURATION` |

---

## Composite order (unchanged on success)

`scoreSignal?` → `#21a AddSignalToCuration` → `#21b markSignalSaved` → `SIGNAL_TO_CURATION` audit → success toast → `refreshMain`

#21a failure stops composite (#21b, audit, success toast, refresh all **0**).

Wave A2 `#21b` missing-signal compat shim (after successful `#21a`) remains **frozen** and **unchanged**.

---

## Gate-first order

1. validate input (`signalId`)
2. trusted session (CR-3)
3. authoritative Signal reload
4. tenant / role authorization
5. authoritative duplicate recheck
6. construct CurationEntry from persisted Signal
7. persist
8. return entry

---

## Regression (Wave B1 exit)

| Gate | Result |
|------|--------|
| FULL CHECK | **2024/2024 PASS** |
| RULES | **91/91 PASS** |
| BUILD | **PASS** |
| B1 FOCUSED | **19/19 PASS** |
| CR1 Execution Delivery | **56/56 PASS** |
| CR1 Signal Intake | **52/52 PASS** |
| #21b frozen regression | **15/15 PASS** |
| #20 frozen regression | **18/18 PASS** |
| ATTACK capstone (T-010-510) | **5/5 PASS** |
| PHASE5 FOCUSED | **73/73 PASS** |
| PLAYWRIGHT (Stage-B + T508) | **21/21 PASS** |

---

## Checkpoint SHAs

| Role | SHA |
|------|-----|
| Authorized start / human governance approval | `1dd61ee3bcc74e0a720e2fec857de9bd3e7496a8` |
| B1 implementation | `0b5a50c87d09fe51a94552106eee05f7e01e5c2d` |
| B1 frozen content | `0b5a50c87d09fe51a94552106eee05f7e01e5c2d` |
| B1 formal acceptance / CR1 governance tip | `PLACEHOLDER_GOV` |

---

## Frozen references (unchanged)

| Role | SHA |
|------|-----|
| #21b implementation (Wave A2) | `a54bd351733ea4d3984e2738362fc7f93c0797a0` |
| Wave A2 formal acceptance | `4c20429d1050b574c660e39da46206ca6844cbe2` |
| #20 implementation (Wave A1) | `c7377ff525a27fbaea44b1b42914d8b14bc012da` |
| Wave A1 formal acceptance | `38bf364d721155572f6ae9a4c11ff94f628e6fcc` |

---

## Next action

`CR1_WAVE_B2_ADVISOR_ADDTOCURATION_AUTHORIZATION_REVIEW` — do **not** auto-implement B2.
