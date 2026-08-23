# Data flow 001 — Strategic Signal Routing

Canonical flows for SPEC-001. Implementation syntax is Phase 1–4; this document freezes **behavior**.

---

## A. Automatic signal routing (CLEAR path)

```text
Signal created / pending score
        │
        ▼
Fetch ALL eligible ACTIVE theses for client
  (exclude DRAFT / UNDER_REVIEW / PAUSED / ARCHIVED / LEGACY)
        │
        ▼
Deterministic per-thesis scoring
  (injected scoreFn — today calculateStrategicScore)
        │
        ▼
routeSignalAcrossTheses (domain)
  → thesisScores[]
  → classification: CLEAR | CONTESTED | UNROUTED
        │
        ├── UNROUTED → persist evidence; no strategic thesisId attribution
        ├── CONTESTED → see flow B (do NOT first-thesis fallback)
        └── CLEAR
              │
              ▼
Governed decision (AUTO source)
  + algorithm/routing version
  + timestamp
  + rationale
        │
        ▼
Persistence (SignalWritePort)
  - thesisScores retained
  - routing state / selected thesis (CLEAR only)
  - NO silent terminal DISCARD from routing alone
        │
        ▼
UI refresh (attribution, scores, rationale)
```

**Invariant:** Strategic attribution is thesis-mediated, never news/profile/AI alone.

---

## B. Contested routing

```text
Signal
        │
        ▼
All ACTIVE theses scored
        │
        ▼
Material competition (policy margin)
        │
        ▼
State = CONTESTED
  - thesisScores[] preserved
  - NO silent thesisId finalization via [0] / primary
        │
        ▼
UI surfaces contest (secondary / competitors)
        │
        ▼
Human MANUAL decision
  OverrideSignalThesis
  - selected thesisId
  - source = MANUAL
  - actor + timestamp
  - previous decision → history
        │
        ▼
Persistence
  - thesisScores retained
  - routing source MANUAL
```

**Forbidden:** `CONTESTED` → AUTO `thesisId = eligible[0]`.

---

## C. AI advisory flow (SPEC-005)

```text
Signal + (optional) single thesis context
        │
        ▼
SPEC-005 SIGNAL_THESIS_EVAL
  (AiCompleteHttpClient → Gateway → Zod validation → aiRun)
        │
        ▼
Validated advisory output
        │
        ▼
May inform manager / enrich analysis UI
        │
        ✗ MUST NOT directly set authoritative routingDecision
        ✗ MUST NOT replace routeSignalAcrossTheses
        ✗ MUST NOT bypass contested / MANUAL policy
```

```text
AI SUGGESTS → SOFTWARE ROUTES → HUMAN DECIDES WHERE REQUIRED
```

---

## D. Central score path — Phase 2/3 landed

| Step | Phase 2–3 |
|------|---------|
| Eligible theses | ThesisQueryPort → Domain ACTIVE filter |
| Router | `routeSignalAcrossTheses` via `ScoreAndRouteSignal` |
| Fallback | **Removed** (`candidates[0]` / primary) |
| Contested | CONTESTED persisted; no `thesisId` |
| Persist current | `SignalWritePort` → `applyStrategicRoutingToSignal` (**no silent DISCARD**) |
| Persist history | Material transitions → `signalRoutingHistory` (local authority) |
| Material fields | state / selectedThesisId / source / algorithmVersion |
| First assignment | No history entry |
| Orchestration | `main.scoreSignal` → Application use case |
| Manual | `OverrideSignalThesis` (ADMIN + ACTIVE only) + history when material |

### Persistence inventory (Signal document)

| Field | Classification |
|-------|----------------|
| `organizationId`, `clientId` | AUTHORITATIVE (SPEC-009 envelope) |
| `routingDecision.*` | ROUTING_OWNED (current state) |
| `thesisScores` | ROUTING_OWNED (per-thesis evidence) |
| `thesisId` | LEGACY_COMPATIBILITY (mirror CLEAR selected only) |
| `relevanceScore`, `priorityBand`, `scoreRationale`, `scoreBreakdown` | DERIVED (score snapshot) |
| `whyNow` | DERIVED (adjacent explainability) |
| `status`, `managerDecision` | OTHER_SPEC_OWNED (not set by routing writer) |
| History store | Separate local collection — not embedded unbounded array |

---

## E. Side-effect order (required)

```text
input validation
  → authorization / tenant scope
  → domain routing calculation
  → governed decision (CLEAR / CONTESTED / UNROUTED / MANUAL)
  → persistence (scores + decision + history)
  → UI / downstream side effects
```

AI (if any) runs **alongside** as advisory — never as the governed decision step.
