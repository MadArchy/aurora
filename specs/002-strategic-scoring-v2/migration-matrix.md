# Migration matrix 002 — Strategic Scoring V2

**Rule:** Classify every scoring-related path before migration.  
Phase 0 inventory baseline: 2026-08-23.

---

## Classification legend

| Class | Meaning |
|-------|---------|
| **CANONICAL_CORE_CANDIDATE** | Should become or feed the single Domain scoring core |
| **GOVERNED_CONSUMER** | Uses scoring through approved routing/governance path |
| **LEGACY** | Pre-SPEC-002 path; deprecate |
| **DUPLICATE_SCORER** | Independent formula — must converge |
| **CLOUD_BYPASS** | Bypasses SPEC-001 routing/scoring governance |
| **ADVISORY_AI** | AI overlay; must not author score |
| **PRESENTATION_ONLY** | Display/sort; no formula |
| **OTHER_SPEC** | Owned elsewhere |

| Migration action | Meaning |
|------------------|---------|
| **KEEP** | Retain as-is (possibly with docs) |
| **EXTRACT** | Move logic into Domain core |
| **MIGRATE** | Change call site to governed path |
| **DEPRECATE** | Mark legacy; no new use |
| **REMOVE_LATER** | Delete after zero consumers |
| **REVIEW** | Needs product decision |
| **NOT_APPLICABLE** | Not scoring-related |

---

## Core formula surfaces

| Location | Class | Action | Notes |
|----------|-------|--------|-------|
| `src/services/scoring.ts` | GOVERNED_CONSUMER | **KEEP** (wrapper) | Delegates to Domain `scoringCore`; injects clock |
| `src/domain/scoringCore.ts` | CANONICAL_CORE_CANDIDATE | **EXTRACT** ✅ Phase 1 | Baseline v1 formula + `scoringVersion` |
| `src/domain/scoreExplainCore.ts` | CANONICAL_CORE_CANDIDATE | **KEEP** ✅ unified | Explainability; weights from `scoringCore` |
| `src/domain/whyNowCore.ts` | CANONICAL_CORE_CANDIDATE | **KEEP** | Timeliness input to scoring |
| `src/domain/dispositionCore.ts` | CANONICAL_CORE_CANDIDATE | **EXTRACT** ✅ Phase 1 | Split disposition/format + legacy map |
| `functions/src/lib/scoreSignal.ts` | DUPLICATE_SCORER | **REMOVE_LATER** | Replace with Domain wrapper Phase 4 |

---

## Application / infrastructure

| Location | Class | Action | Notes |
|----------|-------|--------|-------|
| `StrategicScoringPort.ts` | GOVERNED_CONSUMER | **KEEP** | SPEC-001 port boundary |
| `DbStrategicSignalRoutingAdapter.ts` | GOVERNED_CONSUMER | **MIGRATE** | Wire Domain core; build context |
| `src/application/strategicScoring/` | GOVERNED_CONSUMER | **EXTRACT** ✅ Phase 2 | Post-routing scoring use cases |
| `composeStrategicScoring.ts` | GOVERNED_CONSUMER | **KEEP** ✅ Phase 2 | Composition root |
| `OverrideSignalThesis.ts` | GOVERNED_CONSUMER | **KEEP** | Rescores selected thesis on MANUAL |

---

## Persistence

| Location | Class | Action | Notes |
|----------|-------|--------|-------|
| `db.applyStrategicRoutingToSignal` | GOVERNED_CONSUMER | **KEEP** | Persists score fields; no auto-DISCARD |
| `db.applyScoreToSignal` | LEGACY | **DEPRECATE** → **REMOVE_LATER** | Auto-DISCARD path; zero strategic consumers target |
| Signal.`relevanceScore`, `scoreBreakdown`, etc. | GOVERNED_CONSUMER | **KEEP** | Add scoringVersion Phase 1+ |

---

## Cloud / ingest

| Location | Class | Action | Notes |
|----------|-------|--------|-------|
| `functions/.../scheduledIngest.ts` | CLOUD_BYPASS | **MIGRATE** | P0-2: `docs[0]` + auto-DISCARD |
| `scoreSignalCloud` usage in ingest | DUPLICATE_SCORER | **MIGRATE** | Parity with Domain core |

---

## UI / services consumers

| Location | Class | Action | Notes |
|----------|-------|--------|-------|
| `main.ts` `scoreSignal` | GOVERNED_CONSUMER | **KEEP** | Via ScoreAndRouteSignal |
| `main.ts` AI analyze | ADVISORY_AI | **MIGRATE** | Fail-closed routing; governed persist |
| `main.ts` radar triage display | PRESENTATION_ONLY | **KEEP** | Uses persisted score fields |
| `src/services/ai.ts` `analyzeSignalAgainstThesis` | ADVISORY_AI | **MIGRATE** | Direct signal field writes → governed |
| `src/services/ai.ts` `calculateStrategicScore` | GOVERNED_CONSUMER | **MIGRATE** | Delegate to Domain core |
| `radarTriageCore.ts` | PRESENTATION_ONLY | **KEEP** | Bucket by band/action — update for disposition split |
| `shouldAutoDiscardScoredSignal` | LEGACY | **REVIEW** | Used conceptually by ingest — governance conflict |
| `researchSignalsAgent.ts` | GOVERNED_CONSUMER | **KEEP** | Filters RESEARCH_REQUIRED |
| `topics.ts` / clustering | PRESENTATION_ONLY | **KEEP** | Score sort — not selection |
| `scientificFocusCore.ts` | PRESENTATION_ONLY | **KEEP** | Filter by score band |
| `portfolioMetrics.ts` | PRESENTATION_ONLY | **KEEP** | Aggregates |

---

## AI / SPEC-005

| Location | Class | Action | Notes |
|----------|-------|--------|-------|
| `SIGNAL_THESIS_EVAL` Gateway op | ADVISORY_AI | **KEEP** | No new AiOperation |
| `signalThesisEval.ts` schema | ADVISORY_AI | **KEEP** | Validates advisory JSON |

---

## Tests (migration targets)

| Location | Action | Notes |
|----------|--------|-------|
| `tests/scoring.test.ts` | **KEEP** | Lock baseline v1; extend determinism |
| `tests/whyNowCore.test.ts` | **KEEP** | |
| `tests/radarTriage.test.ts` | **MIGRATE** | Disposition split updates |
| New: scoring architecture test | **EXTRACT** | Phase 5 — ban duplicate formulas |
| New: cloud parity test | **EXTRACT** | Phase 4 |

---

## SPEC-001 / OTHER_SPEC

| Item | Class | Action |
|------|-------|--------|
| SPEC-001 routing fields | OTHER_SPEC | **NOT_APPLICABLE** — read-only consumption |
| SPEC-003 Brief | OTHER_SPEC | **NOT_APPLICABLE** — downstream |
| SPEC-006 claim safety | OTHER_SPEC | **NOT_APPLICABLE** — downstream of drafts |
| Content generation | OTHER_SPEC | **NOT_APPLICABLE** |

---

## Phase 0 P0-2 explicit rows

| Path | Issue | Target phase |
|------|-------|--------------|
| `scheduledIngest` L281 `thesesSnap.docs[0]` | First-thesis scoring | Phase 4 T-002-402 |
| `scheduledIngest` auto-DISCARD | Terminal disposition from score | Phase 4 T-002-403 |

**Not resolved in Phase 0B.**
