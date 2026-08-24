# Migration matrix 002 — Strategic Scoring V2

**Rule:** Classify every scoring-related path before migration.  
Phase 4 final inventory: 2026-08-24.

---

## Classification legend

| Class | Meaning |
|-------|---------|
| **CANONICAL_CORE** | Single Domain scoring core |
| **GOVERNED_CONSUMER** | Uses scoring through approved routing/governance path |
| **LEGACY** | Pre-SPEC-002 path; deprecated |
| **DUPLICATE_SCORER** | Independent formula — must converge |
| **CLOUD_BYPASS** | Bypasses SPEC-001 routing/scoring governance |
| **ADVISORY_AI** | AI overlay; must not author score |
| **PRESENTATION_ONLY** | Display/sort; no formula |
| **OTHER_SPEC** | Owned elsewhere |

| Migration action | Meaning |
|------------------|---------|
| **MIGRATED** | Phase 4 complete on governed path |
| **DEPRECATED** | Mark legacy; no new use |
| **COMPATIBILITY_ONLY** | Retained for projection reads |
| **PRESENTATION_ONLY** | Display only |
| **REMOVED** | Deleted |
| **OTHER_SPEC** | Not scoring-owned |

---

## Core formula surfaces

| Location | Phase 4 status | Notes |
|----------|----------------|-------|
| `src/domain/scoringCore.ts` | **CANONICAL_CORE** | Authoritative `scoring-v1` formula + weights |
| `src/services/scoring.ts` | **MIGRATED** | Thin wrapper → Domain core |
| `src/domain/scoreExplainCore.ts` | **MIGRATED** | Imports weights from `scoringCore` only |
| `functions/src/lib/scoreSignal.ts` | **MIGRATED** | Thin wrapper → `computeStrategicScoreMaterial`; no duplicate weights |

---

## Cloud / ingest

| Location | Phase 4 status | Notes |
|----------|----------------|-------|
| `scheduledIngest.ts` | **MIGRATED** | Gate-only ingest; no thesis query; no score-at-ingest; no auto-DISCARD |
| `scoreSignalCloud` | **MIGRATED** | Delegates to Domain core; retained for parity/compatibility wrapper |

**Implemented ingest flow:** tenant envelope → gate → persist NEW/unscored Signal → client governed routing+scoring pipeline.

---

## Persistence

| Location | Phase 4 status | Notes |
|----------|----------------|-------|
| `db.applyGovernedScoreToSignal` | **GOVERNED** | Score-only persist + history |
| `db.applyStrategicRoutingToSignal` | **GOVERNED** | Routing + score snapshot; no auto-DISCARD |
| `db.applyScoreToSignal` | **DEPRECATED** | Zero src callers; auto-DISCARD removed |

---

## UI / services consumers

| Location | Phase 4 status | Notes |
|----------|----------------|-------|
| `main.ts` `scoreSignal` | **GOVERNED** | Via ScoreAndRouteSignal |
| `main.ts` client ingest poll | **MIGRATED** | Removed post-score DISCARDED rejection |
| `ai.ts` `analyzeSignalAgainstThesis` | **MIGRATED** | Advisory-only; uses routed signal score authority |
| `radarTriageCore.ts` | **MIGRATED** | Prefers `recommendedDisposition` / `recommendedOutputFormat` |
| `shouldAutoDiscardScoredSignal` | **DEPRECATED** | No active strategic consumers |

---

## P0-2 closure evidence

| Path | Before | After Phase 4 |
|------|--------|---------------|
| `thesesSnap.docs[0]` | First-thesis scoring context | **REMOVED** — no thesis query at ingest |
| auto-DISCARD on low score | Terminal DISCARD at ingest | **REMOVED** — signals persist as NEW |

**P0-2 = RESOLVED**

---

## Score history authority

| Item | Status |
|------|--------|
| Local score history | **GOVERNED** — `postura_signal_score_history_v1` |
| Remote Firestore score history rules | **DEFERRED** — SPEC-009; NONBLOCKING_LOCAL_AUTHORITY |

---

## Tests

| Location | Status |
|----------|--------|
| `tests/scoringPhase4.test.ts` | **MIGRATED** — consumer migration guards |
| `tests/scoringPhase5.test.ts` | **ADDED** — Phase 5 security/architecture (39 tests) |
| `tests/scoringCore.test.ts` | **KEEP** |
| `tests/radarTriage.test.ts` | **KEEP** |

## Phase 5 evidence

| Check | Status |
|-------|--------|
| Functions package closure | **PASS** — compiled requires resolve under `functions/lib/` |
| Formula authority count | **1** (`scoringCore.ts`) |
| Strategic first-thesis consumers | **0** |
| Auto-discard from scoring | **0** |
| Score history rule contract | **NONBLOCKING_LOCAL_AUTHORITY** |
| Unscored signal reachability | **PASS** — manager bulk score, curation, analyze, client ingest |
