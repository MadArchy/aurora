# CR-1 Workstream 4 — Signal Intake Application

**Class:** `OPERATIONAL_APPLICATION_CANONICALIZATION`  
**Status:** `COMPLETE`  
**Umbrella:** CR-1 — Cutover-Critical Application Ownership  
**Authorized base checkpoint:** `310dffa629332029a5ce014e5988a3698106244f`  
**Implementation SHA:** `112492d85bb177211ca6b7481d29b04f41d3290b`  
**Governance / freeze SHA:** `a4c2d484cf1f3218ed1233b5059015a4e4dee770`  
**Timezone:** America/Bogota

---

## Scope

| Item | Value |
|------|--------|
| Registry IDs | **#8**, **#24**, **#26** |
| Commands | `RegisterSource`, `RegisterManualSignal` |
| Boundary | Signal Intake Application |
| #8 + #24 consolidation | **ONE** command: `RegisterSource` |
| New Domain rules | **NO** — APPLICATION_PLUS_PORT; F6 §186 client-scoped dedup alignment |
| New SPEC ID | **NO** |

---

## Domain-rule / dedup stop gate

**NEW DOMAIN RULE REQUIRED = NO**

| Behavior | Classification |
|----------|----------------|
| Source registration ownership | APPLICATION_PLUS_PORT — trusted org/client/actor |
| Manual signal ownership | APPLICATION_PLUS_PORT |
| Signal content fingerprint | EXISTING product (URL + title) — unchanged |
| Dedup lookup scope | EXISTING product rule F6 §186 — **by Client**; code corrected from global leakage |
| Global monitoring | Preserved — discovery ≠ shared ownership aggregate |
| Routing / scoring | SPEC-001 only — **0** intake authority |

---

## Security

`requireTenantScope` → trusted org/client/actor/role.  
ADMIN for RegisterSource + RegisterManualSignal.  
Caller org / client / routing / score / matched-thesis spoof → DENY.

---

## Adoption

| Surface | Model |
|---------|--------|
| SourceRegistryModal form (#8) | `signalIntakeConsumer.registerSource` |
| ClientWorkspace source adds (#24) | same `registerSource` |
| Manual signal (#26) | `registerManualSignal` then main may call SPEC-001 `scoreSignal` |
| Command seam | `signalIntakeCommands` |
| Persistence | `DbSignalIntakeAdapter` → `dbService.addSource` / `addSignal` |
| React | Still `READ_ONLY_REACT` |
| Double authority | **0** |

---

## Out of scope

Prior CR-1 reopen · Execution Delivery · CR-2 · CR-3 · Phase 5 · source pause/activate (#25) · automatic poll Application ownership · deployment

**NEXT ACTION after freeze:** `AUTHORIZE_CR1_EXECUTION_DELIVERY_WORKSTREAM`

---

## Prior freezes preserved

| Workstream | Implementation | Frozen content |
|------------|----------------|----------------|
| Client Lifecycle | `63e8db8543bf2a13ae29249b71748402007f959a` | `cf9350fb6de3a9b392b207d34e50714f49c13deb` |
| Master Profile | `198772466c3230d01f177b59d2302dc25913012d` | `44c964ff731c46ae36a9dc65aaae0224439f6a3a` |
| Thesis Lifecycle | `9cfbb1520bdc19f3f9ce584cb8f95fef6192638c` | `c20c08dd6f3ba887f4c25d2db3c37e8ee40df34c` |

---

## Checkpoint SHAs

| Role | SHA |
|------|-----|
| Authorized start | `310dffa629332029a5ce014e5988a3698106244f` |
| Implementation | `112492d85bb177211ca6b7481d29b04f41d3290b` |
| Governance / freeze (content) | `a4c2d484cf1f3218ed1233b5059015a4e4dee770` |
| Tip pin | points at freeze content above (not self) |

---

## Cutover after WS4

| Item | Value |
|------|--------|
| Canonicalized IDs | `1, 8, 10, 11, 12, 13, 24, 26, 34` |
| Remaining spine | `28, 31, 32` (3) |
| T-010-403 / T-010-404 | `BLOCKED_BY_PRECONDITION` |
| Phase 5 | `NOT_AUTHORIZED` |
