# Plan 002 — Strategic Scoring V2

| Field | Value |
|-------|--------|
| **Spec** | `002-strategic-scoring-v2` |
| **Phase** | **Phase 3 COMPLETE** · Phase 4 **NOT STARTED** |
| **Status** | `APPROVED` — score persistence + material history implemented |
| **Strategy** | **Strangler / Incremental Migration** — **NO BIG-BANG REWRITE** |

---

## Why incremental

Working scoring already exists:

- `src/services/scoring.ts` → `calculateStrategicScore`
- Pure helpers: `scoreExplainCore`, `whyNowCore`, `radarTriageCore`
- SPEC-001 injects scoring via `StrategicScoringPort` on the governed path

The debt is **governance**, **versioning**, **disposition split**, **duplicate cloud formula**, **legacy auto-DISCARD**, **score history**, and **missing formal contracts** — not a missing scoring concept.

Therefore:

1. Extract/wrap existing formula into canonical Domain core (`scoringCore`) preserving baseline v1 behavior.
2. Introduce `scoringVersion` + disposition/format contracts (Phase 1).
3. Add Application use cases + persistence/history ports (Phase 2–3).
4. Migrate consumers: cloud ingest, AI analyze persistence, radar, legacy `applyScoreToSignal` (Phase 4).
5. Add architecture bans + security regression suite (Phase 5).
6. Human CODE_COMPLETE sign-off (Phase 6).

---

## Dependencies

| Dependency | State | Impact |
|------------|-------|--------|
| SPEC-001 routing | **CODE_COMPLETE** @ `057a284` | **BLOCKING contract** — scoring consumes routing; must not re-route |
| SPEC-005 AI Gateway | **CODE_COMPLETE** | CLEAR — `SIGNAL_THESIS_EVAL` advisory only |
| SPEC-009 security | **CODE_AVAILABLE**; production **DEFERRED** | NONBLOCKING for 002 CODE_COMPLETE |
| SPEC-003 Brief | **NOT IMPLEMENTED** | Downstream consumer — handoff defined, not blocking Phase 1–2 |
| Cloud Functions | Duplicate scorer | Phase 4 consolidation |

Exit: no circular ownership with 001/003/005/006.

---

## Phase ordering

| Phase | Goal | Exit gate |
|-------|------|-----------|
| **0B** | Formal SPEC package | Human SPEC approval |
| **1** | Domain scoring core, `scoringVersion`, disposition/format types, deterministic tests | Domain unit tests PASS | **DONE** |
| **2** | Application use cases, routing consumption, no terminal discard on score persist, validation | App + governance tests | **DONE** |
| **3** | Score persistence + material history + tenant-safe writes | History tests | **DONE** |
| **4** | Consumer migration (cloud, AI analyze, radar, legacy path) | Architecture/parity tests |
| **5** | Security/regression (multi-thesis, tenant, cloud parity, SPEC-001/005 regression) | A21–A22 green |
| **6** | Acceptance matrix + human CODE_COMPLETE sign-off | CODE_COMPLETE |

Do **not** start Phase 4 until Phase 3 exit gate evidence is recorded (complete).

---

## Phase 3 evidence (2026-08-23)

| Item | Location |
|------|----------|
| Materiality | `src/domain/scoreHistoryCore.ts` |
| Current score writer | `db.applyGovernedScoreToSignal` |
| History store | `postura_signal_score_history_v1` (local-authoritative) |
| Adapter | `DbStrategicScoringAdapter.ts` |
| First-score policy | Policy A — history on first **material** transition only |
| Tests | `tests/scoreHistoryCore.test.ts`, `tests/strategicScoringPhase3.test.ts` |

---

## Phase 2 evidence (2026-08-23)

| Item | Location |
|------|----------|
| Use cases | `ScoreSignalAgainstRoutedContext`, `RecomputeSignalScore` |
| Application package | `src/application/strategicScoring/` |
| Routing governance | `routingGovernance.ts` → `resolveGovernedThesisForScoring` |
| Write port (contract) | `StrategicScoreWritePort` — physical persist Phase 3 |
| Adapter swap | `DbStrategicSignalRoutingAdapter` → `computeStrategicScoreMaterial` |
| Composition | `composeStrategicScoring.ts` |
| Tests | `tests/strategicScoringPhase2.test.ts`, `tests/strategicScoringArchitecture.test.ts` |

---

## Phase 1 evidence (2026-08-23)

| Item | Location |
|------|----------|
| Canonical scorer | `src/domain/scoringCore.ts` |
| Disposition/format split | `src/domain/dispositionCore.ts` |
| Unified weights | `SCORING_FACTOR_WEIGHTS` in `scoringCore`; consumed by `scoreExplainCore` |
| Service strangler | `src/services/scoring.ts` → delegates to Domain core |
| Tests | `tests/scoringCore.test.ts`, `tests/dispositionCore.test.ts`, `tests/scoringArchitecture.test.ts` |
| Baseline regression | `tests/scoring.test.ts` PASS |

## Regression strategy

- Keep `tests/scoring.test.ts` + `tests/whyNowCore.test.ts` green every phase (baseline behavior locked for v1).
- Preserve SPEC-001 suite — no routing regression.
- Preserve SPEC-005 suite — no Gateway edits.
- Add same-input/same-score, routing-state, cloud parity, and architecture ban tests before CODE_COMPLETE.
- `npm run check` + `npm run test:rules` required for implementation checkpoints.

---

## Risk controls

| Risk | Mitigation |
|------|------------|
| Silent weight change on extract | Baseline v1 lock + scoringVersion + parity tests |
| Breaking radar UX | Migration matrix; disposition/format mapping layer |
| Cloud ingest outage during migration | Strangler: align ingest after core extraction |
| Score history growth | Phase 3 bounded representation (mirror SPEC-001 pattern) |
| Auto-DISCARD regression | A12 + remove from governed persist paths |

---

## Explicit non-approach

- No rewrite of SPEC-001 routing
- No new AI provider architecture
- No big-bang replacement of all score consumers in Phase 1
- No silent business weight changes during extraction

---

## Branch policy

**Recommended:** create `spec/002-strategic-scoring-v2` from governance checkpoint `4643cad115b4294c2fb04bd15a08d4478cc64039`.

Do not treat ongoing SPEC-002 implementation docs as belonging on frozen SPEC-001 branch long-term.

Phase 0B may author docs on current branch; **commit target branch is a human/process decision**.
