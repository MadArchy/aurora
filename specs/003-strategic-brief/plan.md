# Plan 003 — Strategic Brief

| Field | Value |
|-------|--------|
| **Spec** | `003-strategic-brief` |
| **Phase** | **Phase 0B COMPLETE / HUMAN APPROVED** · Phase 1 **AUTHORIZED** · Phase 1 implementation **NOT STARTED** |
| **Status** | `APPROVED` |
| **Strategy** | **Strangler / Incremental Migration** — **NO BIG-BANG REWRITE** |

---

## Why incremental

Working operational flows already exist:

- Curation → DeliveryPackage → content/task/opportunity (`main.ts`, `db.ts`)
- SPEC-001/002 upstream context is CODE_COMPLETE
- SPEC-005 AI gateways are structured and advisory
- SPEC-006 claim safety gates exist downstream

The debt is **missing Brief entity**, **fragmented decision authority**, **bypass paths**, and **no governance hexagon** — not a missing curation concept.

Therefore:

1. Define Domain contracts + invariants (Phase 1).
2. Add Application use cases + context reader + gates (Phase 2).
3. Persist Brief + material history locally (Phase 3).
4. Migrate consumers to require `strategicBriefId` (Phase 4).
5. Security/adversarial regression suite (Phase 5).
6. A1–A36 evidence + human CODE_COMPLETE (Phase 6).

---

## Dependencies

| Dependency | State | Impact |
|------------|-------|--------|
| SPEC-001 routing | **CODE_COMPLETE** @ `4643cad` | **BLOCKING contract** — Brief consumes routing; must not mutate |
| SPEC-002 scoring | **CODE_COMPLETE** @ `e422359` | **BLOCKING contract** — Brief consumes scoring; must not recompute |
| SPEC-005 AI Gateway | **CODE_COMPLETE** | CLEAR — advisory operations only |
| SPEC-006 claim safety | Partial (Claim Safety Core) | **BOUNDARY** — downstream; unchanged by 003 |
| SPEC-009 security | **CODE_AVAILABLE**; production **DEFERRED** | NONBLOCKING for 003 CODE_COMPLETE (local authority) |
| SPEC-004 Planner | **NOT IMPLEMENTED** | Downstream consumer — handoff contract only |
| SPEC-002 deployment | **NOT STARTED** | **NOT REQUIRED** for 003 implementation start |

Exit: no circular ownership with 001/002/005/006.

---

## Strangler migration target

```text
TODAY (invalid strategic authority):
  Signal → score/route → CurationEntry.destination → DeliveryPackage → Content/Task/Opportunity

TARGET:
  Signal → score/route → CreateStrategicBrief → ApproveStrategicBrief
         → downstream (Content/Task/Opportunity) requires strategicBriefId
  CurationEntry → intake/review only (COMPATIBILITY_ONLY)
  DeliveryPackage → client delivery only; references Brief where strategic
```

Preserve product usability during migration — dual-read/compatibility windows in Phase 4.

---

## Phase ordering

| Phase | Goal | Exit gate |
|-------|------|-----------|
| **0B** | Formal SPEC package | Human SPEC approval (T-003-010) |
| **1** | Domain: StrategicBrief, StrategicDecisionSnapshot, status, materiality, invariants | Domain unit tests PASS |
| **2** | Application: create/approve/reject/revise/override; context reader; tenant/routing gates | App + governance tests |
| **3** | Persistence: current Brief + append-only history; idempotency; actor audit | History + tenant tests |
| **4** | Consumer migration: block bypass paths; wire curation/delivery/sendDelivery/content/opportunity | A10, A28 green |
| **5** | Security/regression: CONTESTED/UNROUTED, cross-tenant, AI advisory, SPEC-001/002/005/006 regression | P1/P2 closure evidence |
| **6** | Acceptance A1–A36 + human CODE_COMPLETE sign-off | CODE_COMPLETE |

T-003-010 human SPEC approval **DONE**. Phase 1 **AUTHORIZED**. Do **not** declare Phase 1 complete until Domain exit gate.

---

## P1 closure mapping

| Finding | Closure phase |
|---------|---------------|
| F-003-01 Strategic Brief entity absent | Phase 1–3 |
| F-003-02 Bypass paths without Brief | Phase 4 |
| F-003-03 No auditable override | Phase 1–3 (contract) + Phase 2 (use case) |

---

## P2 closure mapping

| Finding | Closure phase |
|---------|---------------|
| Curation/Brief naming collision | Phase 4 migration + docs |
| CONTESTED/UNROUTED fail-open in curation | Phase 2 gates + Phase 4 |
| `proposeAngle` thesis fallback | Phase 4 (require Brief context) |
| Single-thesis delivery package validation | Phase 4 (per-item Brief ref) |
| Evidence ID loss signal→content | Phase 1–3 linkage + Phase 4 |

---

## SPEC-004 handoff (documentation only)

Approved StrategicBrief exports:

- `strategicBriefId`
- `briefVersion`
- `authorizedAction`
- `thesisId`, `signalIds`
- tenant envelope

SPEC-004 Planner consumes these — does not recreate strategic authority.

---

## Test strategy (future)

Documented in `acceptance.md` and Phase 5 tasks. Minimum themes:

- CLEAR / CONTESTED / UNROUTED
- stale thesisId, cross-client thesis/evidence
- multi-signal same thesis vs mixed thesis
- approval / reject / revision / override audit
- history / version / idempotency
- content/task/opportunity without brief blocked
- AI advisory failure non-blocking
- Domain purity + Application hexagonal
- SPEC-001/002/005/006 regression

No tests implemented in Phase 0B.

---

## Persistence authority (Phase 0B decision)

Given current local-first architecture:

- **Local authoritative Brief store** acceptable for CODE_COMPLETE (mirrors SPEC-002 score history pattern).
- Remote Firestore rules for Brief collections → **DEFERRED** to SPEC-009 deployment track.
- Physical store name target: `postura_strategic_brief_v1` + `postura_strategic_brief_history_v1` (Phase 3).

---

## Deployment separation

CODE_COMPLETE ≠ DEPLOYED. Deploy gates D1–D3 in `acceptance.md` — not executed in implementation phases unless separately authorized.
