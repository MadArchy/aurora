# Plan 003 — Strategic Brief

| Field | Value |
|-------|--------|
| **Spec** | `003-strategic-brief` |
| **Phase** | **Phase 5 COMPLETE** · Phase 6 **NOT STARTED** · Phase 6 **READY** |
| **Status** | `APPROVED` |
| **Strategy** | **Strangler / Incremental Migration** — **NO BIG-BANG REWRITE** |
| **Phase-4 implementation checkpoint** | `d2efadf14e930fd45cc46cf4805d4b8a278bd6a6` |
| **Phase-4 governance checkpoint** | `e049fba24766be656de99a0592a28fd256b44a94` |
| **Phase-3 frozen checkpoint** | `73004305561be5d12faaf2a524e50405d5e6809e` |

---

## Why incremental

Working operational flows already exist:

- Curation → DeliveryPackage → content/task/opportunity (`main.ts`, `db.ts`)
- SPEC-001/002 upstream context is CODE_COMPLETE
- SPEC-005 AI gateways are structured and advisory
- SPEC-006 claim safety gates exist downstream

The debt was **missing Brief entity**, **fragmented decision authority**, **bypass paths**, and **no governance hexagon** — not a missing curation concept.

Therefore:

1. Define Domain contracts + invariants (Phase 1) — **DONE**.
2. Add Application use cases + context reader + gates (Phase 2) — **DONE**.
3. Persist Brief + material history locally (Phase 3) — **DONE**.
4. Migrate consumers to require approved Brief authorization (Phase 4) — **DONE**.
5. Security/adversarial regression suite (Phase 5) — **DONE**.
6. A1–A36 evidence + human CODE_COMPLETE (Phase 6) — **NOT STARTED**.

---

## Dependencies

| Dependency | State | Impact |
|------------|-------|--------|
| SPEC-001 routing | **CODE_COMPLETE** @ `4643cad` + compatibility persist @ `80c93d8b` | **BLOCKING contract** — Brief consumes `routingDecision.selectedThesisId`; must not mutate |
| SPEC-002 scoring | **CODE_COMPLETE** @ `e422359` | **BLOCKING contract** — Brief consumes scoring; must not recompute |
| SPEC-005 AI Gateway | **CODE_COMPLETE** | CLEAR — advisory operations only |
| SPEC-006 claim safety | Partial (Claim Safety Core) | **BOUNDARY** — downstream; unchanged by 003 |
| SPEC-009 security | **CODE_AVAILABLE**; production **DEFERRED** | NONBLOCKING for 003 CODE_COMPLETE (local authority) |
| SPEC-004 Planner | **NOT IMPLEMENTED** | Downstream consumer — handoff contract only |
| SPEC-002 deployment | **NOT STARTED** | **NOT REQUIRED** for 003 implementation start |

Exit: no circular ownership with 001/002/005/006.

---

## Strangler migration target (Phase 4 achieved)

```text
IMPLEMENTED (Phase 4):
  Signal → SPEC-001 routing → SPEC-002 scoring
         → CreateStrategicBrief (DRAFT)
         → human ApproveStrategicBrief (APPROVED)
         → AuthorizeStrategicDownstream
         → Content / Task / Opportunity (strategicBriefId + version)
         → SPEC-005 CONTENT_DRAFT only after authorization
         → SPEC-006 claimSafety where applicable

  CurationEntry → intake/review only (NOT authority)
  DeliveryPackage → client packaging only; per-item strategicBriefId for strategic send
  form-add-task → GENERIC_NON_STRATEGIC (Brief not required)
```

No Signal → Content shortcut. No CurationEntry / DeliveryPackage / managerDecision strategic authority.

---

## Phase ordering

| Phase | Goal | Exit gate |
|-------|------|-----------|
| **0B** | Formal SPEC package | Human SPEC approval (T-003-010) — **DONE** |
| **1** | Domain: StrategicBrief, StrategicDecisionSnapshot, status, materiality, invariants | **DONE** |
| **2** | Application: create/approve/reject/revise/override; context reader; tenant/routing gates | **DONE** |
| **3** | Persistence: current Brief + append-only history; idempotency; actor audit | **DONE** |
| **4** | Consumer migration: approved-Brief mandatory gate; strategic vs generic distinction | **DONE** — A10, A28, A29 PASS |
| **5** | Security/regression: CONTESTED/UNROUTED, cross-tenant, AI advisory, SPEC-001/002/005/006 regression | **DONE** — T-003-501…510 |
| **6** | Acceptance A1–A36 + human CODE_COMPLETE sign-off | **NOT STARTED** · **READY** |

---

## Phase 4 completion record

| Item | Status |
|------|--------|
| Approved-Brief mandatory consumer gate | **DONE** — `AuthorizeStrategicDownstream` via `strategicBriefConsumer` |
| Strategic vs generic task distinction | **DONE** — strategic gated; `form-add-task` preserved ungated |
| Consumer migration (content / article / rec→task / sendDelivery / opportunity / planner strategic) | **DONE** — ungated strategic executable paths = 0 |
| Per-item Delivery Brief authorization | **DONE** — `DeliveryItem.strategicBriefId` |
| Partial delivery denial policy | **DONE** — all-or-nothing; unauthorized item blocks entire send **before AI** |
| Authorization-before-AI | **DONE** — denied paths: AI calls = 0 |
| Traceability propagation | **DONE** — `strategicBriefId`, `strategicBriefVersion`, Brief-derived `thesisId`, `signalIds` / `supportingEvidenceIds` on ContentItem |
| Legacy behavior | **DONE** — no retroactive Brief invent; legacy CLEAR without `selectedThesisId` fail-closed; pre-Brief artifacts readable |
| P1 closure | **DONE** — F-003-01 / F-003-02 / F-003-03 = **RESOLVED**; P1 UNRESOLVED = 0 |
| Remaining P2 partials | **2** — P2-003-01 naming collision; P2-003-02 CONTESTED/UNROUTED curation queue fail-open |
| Phase 5 | **NOT STARTED** · **READY** (no Phase-4 implementation blockers) |

---

## P1 closure mapping

| Finding | Status | Evidence |
|---------|--------|----------|
| F-003-01 Strategic Brief entity absent | **RESOLVED** | Domain + Application + Persistence + consumers integrated |
| F-003-02 Bypass paths without Brief | **RESOLVED** | Strategic ungated executable paths = 0 |
| F-003-03 No auditable override | **RESOLVED** | Override audit + consumers respect Application gate |

**P1 ORIGINAL = 3 · P1 RESOLVED = 3 · P1 UNRESOLVED = 0 · P1 FINDINGS (unresolved) = 0**

---

## P2 closure mapping

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| P2-003-01 | Curation/Brief naming collision | **PARTIAL / NONBLOCKING** | UI labels distinguish; legacy comments/surfaces remain |
| P2-003-02 | CONTESTED/UNROUTED fail-open in curation | **PARTIAL / NONBLOCKING** | Queue entry may still occur; **cannot** authorize strategic downstream without governed Brief |
| P2-003-03 | `proposeAngle` thesis fallback | **RESOLVED** | Explicit governed `thesisId: string` required |
| P2-003-04 | Single-thesis delivery package validation | **RESOLVED** | Per-item Brief authorization |
| P2-003-05 | Evidence ID loss signal→content | **RESOLVED** | `supportingEvidenceIds` / `signalIds` propagated on strategic ContentItem |

**P2 ORIGINAL = 5 · P2 RESOLVED = 3 · P2 PARTIAL = 2**

Curation queue entry ≠ strategic authorization.

---

## Phase-5 completion record

| Item | Status |
|------|--------|
| Architecture ban enforcement (T-003-501) | **DONE** — `strategicBriefSecurityArchitecture.test.ts` |
| CONTESTED / UNROUTED / stale adversarial (T-003-502) | **DONE** — fail-closed |
| Cross-tenant negative matrix (T-003-503) | **DONE** — no foreign Brief data leakage |
| Multi-signal mixed-thesis (T-003-504) | **DONE** |
| Override audit completeness (T-003-505) | **DONE** |
| Idempotency + history / malformed / legacy (T-003-506) | **DONE** |
| SPEC-001/002/005/006 regression (T-003-507…510) | **DONE** — via existing suites under `npm run check` |
| P0 | **0** |
| New unresolved P1 | **0** |
| P2 PARTIAL carried | **2** (P2-003-01 naming; P2-003-02 curation intake) |
| Local-store threat model | Malformed fail-closed; **not** crypto tamper-proof (LOCAL_AUTHORITATIVE) |
| Phase 6 | **READY** · **NOT STARTED** — CODE_COMPLETE requires Phase 6 + human sign-off |

---

## Phase-5 readiness

Phase 5 tasks (T-003-501+) are **work Phase 5 exists to perform**, not blockers to **starting** Phase 5.

| Criterion | Value |
|-----------|-------|
| Phase-4 implementation blockers | **0** |
| P0 | **0** |
| Phase-4 exact tasks T-003-401…409 | **DONE** |
| Approved Brief gate | **PASS** |
| Working tree at Phase-4 implementation checkpoint | **CLEAN** @ `d2efadf…` |
| **PHASE 5** | **COMPLETE** |
| **PHASE 6** | **READY** · **NOT_STARTED** |

---

## Nonblocking debt (not Phase-4 blockers)

- P2-003-01 Curation/Brief legacy naming remnants
- P2-003-02 CONTESTED/UNROUTED operational curation queue behavior (downstream gated)
- Legacy CLEAR records lacking `selectedThesisId` (fail-closed; no production backfill)
- SPEC-009 remote Brief rules (**DEFERRED_TO_SPEC-009**)
- Deployment-only gates D1–D3

---

## SPEC-004 handoff (documentation only)

Approved StrategicBrief exports:

- `strategicBriefId`
- `briefVersion` / `strategicBriefVersion`
- `authorizedAction`
- `thesisId`, `signalIds`
- tenant envelope

SPEC-004 Planner consumes these — does not recreate strategic authority.

---

## Test strategy

Documented in `acceptance.md`. Phase 4 added consumer gate + architecture static checks. Phase 5 expands adversarial / regression suite (T-003-501…510).

Minimum themes remaining for Phase 5/6:

- CONTESTED / UNROUTED adversarial matrix
- stale thesisId, cross-client thesis/evidence
- multi-signal mixed thesis
- AI advisory failure non-blocking
- full architecture ban suite
- SPEC-001/002/005/006 regression verification at CODE_COMPLETE

---

## Persistence authority (Phase 0B decision)

Given current local-first architecture:

- **Local authoritative Brief store** acceptable for CODE_COMPLETE (mirrors SPEC-002 score history pattern).
- Physical stores (Phase 3): `postura_strategic_brief_v1` + `postura_strategic_brief_history_v1` + `postura_strategic_brief_override_v1`.
- Remote Firestore rules for Brief collections → **FUTURE_NONBLOCKING / DEFERRED** to SPEC-009 deployment track.
- Local atomicity = one in-memory write-unit apply + one persist of the three versioned keys. Not a distributed Firestore transaction.

---

## Deployment separation

CODE_COMPLETE ≠ DEPLOYED. Deploy gates D1–D3 in `acceptance.md` — not executed in implementation phases unless separately authorized.
