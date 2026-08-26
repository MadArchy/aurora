# Hexagonal boundaries 004 — Strategic Planner

---

## Target layering (design — not implemented)

```text
Interfaces / UI (ManagerCockpit, ClientWorkspace, Modals, main.ts)
        ↓
Composition seam (future: strategicPlanConsumer / composeStrategicPlan)
        ↓
Application (CreateStrategicPlan, AddPlanItem, ApproveStrategicPlan,
             AuthorizePlannedAction, ActivatePlanItem, …)
        ↓
Domain (strategicPlanCore, planItemCore, planGateCore,
        planMaterialityCore, planTenantCore)
        ↑
Ports ← Infrastructure (local stores, Brief reader, clock, actor,
                        optional PlannerAdvisorPort → SPEC-005)
```

**Rule:** Consumer asks Application. UI does not authorize from displayed plan status alone.

---

## Domain (pure)

**Owns:**

- StrategicPlan / PlanItem types
- PlanStatus / PlanItemStatus transitions
- Brief binding + stale version rules (pure predicates given Brief snapshot)
- authorizedAction subset checks
- Tenant validators
- Materiality detection
- Explainability projection shapes

**Must not:**

- Import Firebase, localStorage, React, fetch, AI SDKs
- Approve/revise StrategicBrief
- Mutate routing/scoring
- Call AuthorizePublication / write Verification
- Parse JWT / set auth claims

---

## Application

**Owns:**

- Use case orchestration
- Trusted actor + clock
- Ports
- Idempotency / error mapping

**Must not:**

- Import concrete `db.ts` / React
- Direct provider calls
- Embed SPEC-006 claim verification algorithm

---

## Ports (outbound)

| Port | Purpose |
|------|---------|
| `StrategicPlanRepository` | Current plan projection |
| `PlanItemStore` | Items under plan |
| `StrategicPlanHistoryPort` | Append-only material history |
| `StrategicBriefReader` | Read APPROVED Brief snapshot (SPEC-003) |
| `TrustedActorContext` / Clock / Id | Trust + time + ids |
| `PlannerAdvisorPort` (optional) | Advisory suggestions via SPEC-005 — never authoritative |

---

## Infrastructure (Phase 3+)

- Local-authoritative plan/item/history adapters
- Brief reader adapter (composition over SPEC-003 stores/ports)
- No production Firestore Claim/Brief rule ownership

---

## UI / consumers

**May:** display plans, request actions, show denial reasons.  
**Must not:** write plan status, invent thesis, set softwareAuthority, bypass Brief/claim gates.

---

## Architecture bans (enforce in Phase 1/5 tests)

1. Domain → Infrastructure/UI/Firebase → **FAIL**
2. Application → concrete db/UI → **FAIL**
3. UI → direct plan repository / storage keys → **FAIL**
4. AI actor approve/activate → **FAIL**
5. SPEC-004 mutates Brief/routing/score/claim Verification → **FAIL**
6. Implicit `theses[0]` / primary as plan thesis → **FAIL**
7. CurationEntry as current Plan authority after migration → **FAIL**

---

## Cross-SPEC coupling

| SPEC | Coupling |
|------|----------|
| 003 | Read Brief via port — **no write** |
| 006 | Call existing publication gate from content consumers — **no reimplement** |
| 005 | Optional advisor port |
| 009 | Auth claims unrelated; production deferred |
