# Data flow 002 — Strategic Scoring V2

---

## A. Governed routed scoring (target steady state)

```text
UI / ingest trigger
      ↓
Trusted tenant context (organizationId, clientId)
      ↓
SPEC-001 ScoreAndRouteSignal (or post-ingest equivalent)
      ├─ routeSignalAcrossTheses (ACTIVE-only)
      ├─ scoreFn → SPEC-002 Domain scoringCore (per eligible thesis)
      └─ routingDecision + thesisScores persisted
      ↓
SPEC-002 score snapshot for Signal display fields
      ├─ factors, penalties, band, rationale, breakdown
      ├─ scoringVersion
      ├─ strategicDisposition (+ optional outputFormatRecommendation)
      └─ whyNow (when computed)
      ↓
Persistence (current score + optional material history)
      ↓
Strategic decision consumers (radar, research agent, Brief handoff)
```

**Invariant:** Scoring never selects thesis; routing context is input.

---

## B. CLEAR path

```text
Signal + ACTIVE theses
      ↓
SPEC-001 routing → CLEAR + selectedThesisId
      ↓
Per-thesis scores preserved (thesisScores[])
      ↓
Display/persist score snapshot from selected thesis (or explicit policy)
      ↓
Downstream thesis-specific actions allowed (fail-closed helpers verify CLEAR)
```

---

## C. CONTESTED path

```text
Signal + ACTIVE theses
      ↓
SPEC-001 routing → CONTESTED (no selectedThesisId)
      ↓
Per-thesis scores preserved for comparison
      ↓
Optional display score from leading competitor (presentation only — not attribution)
      ↓
Downstream thesis-specific actions → FAIL CLOSED
      ↓
Manager MANUAL resolution (SPEC-001 OverrideSignalThesis) → then CLEAR scoring context
```

**No silent single-thesis downstream action.**

---

## D. UNROUTED path

```text
Signal + (zero eligible ACTIVE OR all below routing minimum)
      ↓
SPEC-001 routing → UNROUTED
      ↓
No selectedThesisId; compatibility thesisId cleared on persist
      ↓
Score metadata may reflect unrouted state (policy-defined — not hidden thesis pick)
      ↓
Thesis-specific downstream actions → FAIL CLOSED
```

---

## E. Cloud ingest target (migration)

**Current (legacy — P0-2):**

```text
RSS/item → gate → scoreSignalCloud(thesis from docs[0]) → optional auto-DISCARD → write Signal
```

**Target:**

```text
ingest → tenant envelope validate
      ↓
persist Signal (minimal)
      ↓
SPEC-001 governed routing (multi-thesis)
      ↓
SPEC-002 governed scoring (canonical core)
      ↓
persistence (no terminal DISCARD from score alone)
```

**NO** `thesesSnap.docs[0]` strategic shortcut.

---

## F. AI advisory overlay

```text
Deterministic score (authoritative)
      ↓
Optional SIGNAL_THESIS_EVAL via SPEC-005 Gateway
      ↓
Validated JSON: proposedAngle, strategicRationale (advisory)
      ↓
UI / Recommendation artifact — must NOT overwrite:
  - routingState
  - selectedThesisId
  - numeric score / band / scoringVersion
  - terminal disposition
```

AI failure → deterministic score and routing unchanged.

---

## G. Material score history (Phase 3)

```text
previous score snapshot
      ↓
compare(material fields) — scoringVersion, score, band, disposition, breakdown identity
      ↓
if material → append history entry (actor, timestamp, routing context ref)
      ↓
update current score fields (single authoritative current)
```

Timestamp-only re-score → **no** history append.

---

## H. SPEC-003 handoff (read-only contract)

Strategic Brief may consume:

- `relevanceScore` / total score
- `priorityBand`
- factor breakdown / `scoreBreakdown`
- `scoreRationale`
- `whyNow`
- `strategicDisposition` (+ format recommendation when split)
- `scoringVersion`
- SPEC-001 routing context (`routingDecision`, `thesisScores`, CLEAR thesis id)

Brief implementation is **out of scope** for SPEC-002.
