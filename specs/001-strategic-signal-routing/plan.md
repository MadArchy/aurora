# Plan 001 — Strategic Signal Routing

| Field | Value |
|-------|--------|
| **Spec** | `001-strategic-signal-routing` |
| **Phase** | **2 COMPLETE** · Phase 3 **NOT STARTED** |
| **Status** | `APPROVED` · Application use cases + central path migrated |
| **Strategy** | **Strangler / Incremental Migration** — **NO BIG-BANG REWRITE** |

---

## Why incremental

A working domain router already exists:

`src/domain/thesisRoutingCore.ts` → `routeSignalAcrossTheses`

Main ingest scoring already loads ACTIVE theses and calls the router. The debt is **call-site collapse**, **contested policy**, **silent discard**, **layering**, and **missing formal contracts** — not a missing algorithm.

Therefore:

1. Retain and wrap `thesisRoutingCore` unless Phase 1 proves the contract inadequate.
2. Introduce application use cases + ports around it.
3. Migrate strategic call sites file-by-file.
4. Add architecture bans so primary helpers cannot regress on strategic paths.
5. Never rewrite POSTURA for routing alone.

---

## Dependencies

| Dependency | State | Impact |
|------------|-------|--------|
| SPEC-005 AI Gateway | **CODE_COMPLETE** | CLEAR — advisory `SIGNAL_THESIS_EVAL` only |
| SPEC-009 security | Rules/envelope **CODE_AVAILABLE**; production **DEFERRED** | NONBLOCKING for 001 implementation |
| Scoring engine | `src/services/scoring.ts` | Injected scoreFn; SPEC-002 may later split disposition |
| UI monolith | `main.ts` / Workspace | Phase 4 migration surface |

Exit: no circular ownership with 002/003/006.

---

## Phase ordering

| Phase | Goal | Exit gate |
|-------|------|-----------|
| **0B** | Formal SPEC package | Human SPEC approval |
| **1** | Contracts / domain eligibility / version / tests | Unit + typecheck |
| **2** | Application use cases; contested policy; central score flow; discard governance | App + domain tests |
| **3** | Persistence / history / tenant-safe writes | Persistence tests |
| **4** | Interface + strategic call-site migration | Architecture grep bans start |
| **5** | Governance / security / negative + regression tests | A14–A16 style bans green |
| **6** | Acceptance matrix + human CODE_COMPLETE sign-off | CODE_COMPLETE |

Do **not** start Phase 1 until human marks this SPEC `APPROVED`.

---

## Regression strategy

- Keep `tests/thesisRoutingCore.test.ts` green every phase.
- Preserve SPEC-005 suite (487 baseline entering 0B) — no Gateway edits.
- Add multi-thesis (1 / 2 / N), contested + MANUAL, and architecture ban tests before CODE_COMPLETE.
- `npm run check` + `npm run test:rules` required for implementation checkpoints.

---

## Risk controls

| Risk | Mitigation |
|------|------------|
| Over-removing `[0]` in UI | Migration matrix classifies STRATEGIC vs PRESENTATION |
| Contested UX gap | Phase 2 policy + Phase 4 UI contested handling |
| History unbounded growth | Phase 3 chooses bounded representation |
| Silent discard regression | A12 + Phase 2 relocate/remove from route persist |

---

## Explicit non-approach

- No rewrite of scoring into a new AI router
- No new AiOperation for routing
- No SPEC-009 production work inside 001
- No merge to `main` as part of 001 authoring
