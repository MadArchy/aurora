# Stage B Blocker Canonicalization — Registry #9 + #18

**Class:** `STAGE_B_BLOCKER_REMEDIATION`  
**Status:** `COMPLETE`  
**Authorized base checkpoint:** `e5b62e1648ad4b49c0ff0c282ea62bc5557f76cd`  
**Scope:** Registry **#9** (Signal Intake scheduled/source ingest) · Registry **#18** (Execution Delivery send orchestration) only  
**Timezone:** America/Bogota

---

## Registry #9 — Signal Intake

| Item | Value |
|------|-------|
| Owner | **Signal Intake Application** |
| Application commands | `PollRegisteredSource` · `PollAllActiveSources` |
| Consumer | `signalIntakeConsumer.pollRegisteredSource` · `pollAllActiveSources` |
| Runtime location | **LOCAL** (browser scheduler / manual poll via `main.ts` wiring) |
| Cloud Functions scheduled ingest | **Unchanged** — not registry #9 executable path |
| Authoritative Source load | `SourceRegistryPort.getById(sourceId)` |
| Trusted tenant | `requireTenantScope` → `TrustedSignalIntakeContext` |
| Post-ingest routing | `PostIngestRoutingPort` → canonical `scoreAndRouteSignal` (SPEC-001/SPEC-002 consumer) |
| Signal Intake routing authority | **0** |
| Signal Intake scoring authority | **0** |
| First/primary thesis authority | **0** |
| `#9 MAIN.TS BUSINESS AUTHORITY` | **0** (timer/event wiring + consumer invocation only) |
| CU? | **YES** |

---

## Registry #18 — Execution Delivery

| Item | Value |
|------|-------|
| Owner | **Execution Delivery Application** |
| Application orchestrator | `SendDeliveryPackage` |
| Consumer | `executionDeliveryConsumer.sendDeliveryPackage` |
| Authoritative package reload | `DeliverySendPort.getPackageById(packageId)` |
| Package policy | **All-or-nothing** — `validateDeliveryForSend` preflight entire package |
| SPEC-003 gate | `gateStrategicDownstream` via adapter |
| SPEC-004 gate | `requirePlannedAuthorization` per strategic item |
| SPEC-005 boundary | `generateContentDraft` only after preflight pass |
| SPEC-006 boundary | `saveDeliveryGeneratedContent` |
| SPEC-007 boundary | `materializeOpportunityForDelivery` via adapter |
| `#18 MAIN.TS BUSINESS ORCHESTRATION` | **0** |
| CU? | **YES** |

---

## Preserved (unchanged)

| Boundary | Status |
|----------|--------|
| SPEC-001 … SPEC-009 semantics | **0 modifications** |
| CR-2 | **0 modifications** |
| CR-3 | **0 modifications** |
| Other 20 noncutover registry rows | **0 CU changes** |
| T-010-403 / T-010-404 | **Not marked DONE** |

---

## Governance pins

| Pin | SHA |
|-----|-----|
| **#9 + #18 implementation** | `75497f7b30110da5f40114d29164223b2d5caa8a` |
| **Governance content** | `7593c79` (tip commit; see `stage-b-blocker-canonicalization.md` at ratification) |
| **Governance tip** | `7593c79b30110da5f40114d29164223b2d5caa8a` |
| **CR-2 freeze preserved** | `3c53b49f1eddc1606ad74828708e7dd83c8cd45a` (unchanged) |

**Full check:** 1872/1872 · **Rules:** 91/91 · **Build:** PASS

