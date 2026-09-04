# CR-1 Wave B2 — #21a AddAdviceActionToCuration (advisor advice-backed path)

**Class:** `OPERATIONAL_APPLICATION_CANONICALIZATION`  
**Status:** `FORMALLY_ACCEPTED` · `#21a ADVISOR PATH CANONICALIZED_AND_FROZEN` · `#21a FULL COMMAND CANONICALIZED_AND_FROZEN`  
**Timezone:** America/Bogota

---

## Split authority (registry #21)

| Sub-intent | Status | Command / surface |
|---|---|---|
| **#21a radar** `addToCuration(...)` | **CANONICALIZED_AND_FROZEN** (Wave B1) | `AddSignalToCuration` · `.btn-send-to-curation` |
| **#21a advisor** `addToCuration(...)` | **CANONICALIZED_AND_FROZEN** (Wave B2) | `AddAdviceActionToCuration` · `handleAdviceToCurationClick` · `.btn-advice-to-curation` |
| **#21b** `MarkSignalSaved` | **CANONICALIZED_AND_FROZEN** (Wave A2) | unchanged |

**Registry row #21 `CU?` = YES** — all authoritative #21a/#21b production paths canonical; zero remaining handler direct `dbService.addToCuration` for #21.

---

## Scope

| Item | Value |
|------|--------|
| Registry ID | **#21a advisor** (completes composite **#21**) |
| Command | `AddAdviceActionToCuration` |
| Boundary | Execution Delivery Application |
| Primary caller migrated | `advisorHandlers.ts` · `handleAdviceToCurationClick` · `.btn-advice-to-curation` |
| Business input | `{ adviceActionId }` + `requestedClientId` lookup/scope only |
| Authoritative reload | `PositioningAdvice` + `AdviceAction` via `AdviceReadPort` |
| New port | `AdviceReadPort` (read-only) · `DbAdviceReadAdapter` |
| Reused port | `CurationRepositoryPort` (B1 semantics unchanged) |
| Signal / #21b / AI / dedup | **0** |
| `createdBy` | trusted CR-3 `actorId` only · **0** `user_admin_01` fallback |
| Missing advice/action UX | typed `ADVICE_ACTION_NOT_FOUND` → handler silent return |
| Source traceability debt | `CurationEntry` has no `adviceActionId` · audit carries `actionId` · **EXISTING_NONBLOCKING_DEBT** |

---

## Field mapping (advisor-origin parity)

| CurationEntry field | Source |
|---|---|
| `organizationId` | authoritative `PositioningAdvice.organizationId` |
| `clientId` | authoritative `PositioningAdvice.clientId` |
| `title` | `AdviceAction.title` |
| `snippet` | `` `${AdviceAction.why} ${AdviceAction.how}` `` |
| `score` | `AdviceAction.impact` |
| `aiAngle` | `AdviceAction.how` |
| `createdBy` | trusted `actorId` |
| `signalId` / `thesisId` | **not written** |

---

## Gate-first order

1. validate `adviceActionId`
2. trusted session (CR-3)
3. spoof / tenant checks
4. authoritative `AdviceReadPort.findAdviceAction`
5. persisted client/org vs trusted entitlement
6. construct CurationEntry
7. synchronous persist (no async yield between lookup and write)

---

## Normal success path

`AddAdviceActionToCuration` → write **1** → handler `ADVICE_TO_CURATION` audit **1** → toast `Acción enviada a la mesa de curación` → `setTab('ws-curation')` · **0** refreshMain · **0** #21b · **0** dedup

Repeat clicks: multiple writes/audits/toasts/navigation (legacy parity).

---

## Regression (Wave B2 exit)

| Gate | Result |
|------|--------|
| FULL CHECK | **2044/2044 PASS** |
| RULES | **91/91 PASS** |
| BUILD | **PASS** |
| B2 FOCUSED | **19/19 PASS** |
| CR1 Execution Delivery | **76/76 PASS** |
| B1 FROZEN REGRESSION | **19/19 PASS** |
| #21b frozen regression | **15/15 PASS** |
| #20 frozen regression | **18/18 PASS** |
| ATTACK capstone (T-010-510) | **5/5 PASS** |
| PHASE5 FOCUSED | **73/73 PASS** |
| PLAYWRIGHT (Stage-B + T508) | **21/21 PASS** |

---

## Checkpoint SHAs

| Role | SHA |
|------|-----|
| Authorized start | `546772cc44598c714dbbb6b704536a5889733e21` |
| B2 implementation | `0803b637d0d02c856bf1e8feb4ca1552bc540a4f` |
| B2 frozen content | `0803b637d0d02c856bf1e8feb4ca1552bc540a4f` |
| B2 formal acceptance / CR1 governance tip | *(recorded in acceptance commit)* |

---

## T-010-603 impact (record only)

Complete #21 canonicalization removes advisor handler direct `dbService.addToCuration` authority — one fewer legacy write seam blocking subset removal review. **T-010-603 remains NOT_AUTHORIZED**; no deletion or host cutover.

---

## Frozen references (unchanged)

| Role | SHA |
|------|-----|
| B1 implementation (Wave B1) | `0b5a50c87d09fe51a94552106eee05f7e01e5c2d` |
| B1 formal acceptance | `39a1e94716ec2fb80e34b16fa06516ebb7d6c651` |
| #21b implementation (Wave A2) | `a54bd351733ea4d3984e2738362fc7f93c0797a0` |
| #20 implementation (Wave A1) | `c7377ff525a27fbaea44b1b42914d8b14bc012da` |

---

## Next action

`CR1_WAVE_B3_DECIDE_CURATION_AUTHORIZATION_REVIEW` — do **not** auto-implement #14 DecideCuration.
