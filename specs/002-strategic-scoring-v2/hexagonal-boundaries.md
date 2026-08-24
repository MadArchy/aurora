# Hexagonal boundaries 002 — Strategic Scoring V2

---

## Target layering

```text
Interfaces / UI (main, radar, modals)
        ↓
Application (ScoreSignalAgainstRoutedContext, RecomputeSignalScore, …)
        ↓
Domain (scoringCore, scoringVersion, dispositionCore, scoreExplainCore, whyNowCore)
        ↑
Ports ← Infrastructure (db adapter, cloud wrapper, SPEC-001 StrategicScoringPort impl)
Composition root wires adapters
```

---

## Domain (pure)

**Owns:**

- deterministic scoring formula (target: `scoringCore.ts`)
- `scoringVersion` constant identity
- factor/penalty math, band thresholds (baseline v1)
- disposition vs format semantic types (`dispositionCore.ts`)
- material score change comparison types
- explainability breakdown (`scoreExplainCore.ts` — unify weights with core)
- whyNow timeliness (`whyNowCore.ts` — already pure)

**Must NOT import:**

- Firebase / Firestore
- React / Vite / Express / HTTP
- `dbService` / concrete DB
- AI provider SDKs / Gateway implementation

**Existing pure modules to preserve:**

- `scoreExplainCore.ts`
- `whyNowCore.ts`
- `radarTriageCore.ts` (consumer — triage buckets, not formula)
- `radarFeedbackCore.ts` (feedback hints input)
- `thesisStrengthCore.ts` (authority input)
- `scientificFocusCore.ts` (radar filter consumer)

---

## Application

**Owns:**

- use case orchestration
- routing context consumption policy (CLEAR / CONTESTED / UNROUTED)
- tenant validation at trust boundary
- error taxonomy (`StrategicScoringError` pattern — mirror SPEC-001)
- ports: `SignalReadPort`, `SignalWritePort`, `ScoreHistoryPort`, `ScoringContextPort`

**Must NOT:**

- import concrete Firestore/db/React
- embed duplicate scoring formula
- call AI providers directly

**Relationship to SPEC-001:**

- SPEC-001 `ScoreAndRouteSignal` orchestrates routing + invokes scoring via `StrategicScoringPort`
- SPEC-002 Application provides the **canonical score function** behind that port
- Avoid circular dependency: Domain scoring has no routing logic; Application composes routing output + scoring

---

## Ports (neutral contracts)

| Port | Responsibility |
|------|----------------|
| `StrategicScoringPort` (existing, SPEC-001) | `createScoreFn`, `scoreThesis`, `computeWhyNow` |
| `ScoreHistoryPort` (planned) | append/list material score history |
| `ScoreWritePort` (planned) | persist current score fields + version |

Ports use Domain types only — no collection path strings as domain law.

---

## Infrastructure

**Owns:**

- `DbStrategicSignalRoutingAdapter` scoring section → **migrate** to Domain core wrapper
- local/cloud persistence mapping
- cloud Functions wrapper importing **same** Domain core (not duplicate formula)

**Current debt:**

- `src/services/scoring.ts` — formula lives in services (extract to Domain)
- `functions/src/lib/scoreSignal.ts` — duplicate lite scorer (**CLOUD_BYPASS**)

---

## Interfaces / UI

**Owns:**

- trigger score-all, display breakdown, triage buckets
- must not embed scoring formula
- presentation-only sorting by score permitted

---

## Functions / Cloud

**Target:** thin adapter calling shared Domain package/core — **not** an independent weight table.

**Current:** `scoreSignalCloud` — **DUPLICATE_SCORER** + ingest auto-DISCARD (**migrate Phase 4**).

---

## Composition

Wiring lives in composition root / adapter factories (same pattern as SPEC-001 `createDbStrategicSignalRoutingPorts`).

---

## Validation placement

| Layer | Validation |
|-------|------------|
| Domain | input sanity (non-empty haystack rules) — minimal |
| Application | tenant envelope, routing context required, signal existence |
| Infrastructure | persistence envelope checks |
| Cloud payloads | runtime validation at boundary (not TS-only) — Phase 2+ |

Do **not** put Zod inside pure Domain by default.

---

## Error model (planned)

Controlled failures (Application):

- `SIGNAL_NOT_FOUND`
- `ROUTING_CONTEXT_REQUIRED`
- `TENANT_CONTEXT_INVALID`
- `SCORING_INPUT_INVALID`
- `PERSISTENCE_ERROR`

No silent null success on governed paths.
