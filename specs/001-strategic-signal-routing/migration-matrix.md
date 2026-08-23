# Migration matrix 001 — Strategic Signal Routing

**Rule:** Do **not** mechanically delete every `theses[0]`.  
Classify **STRATEGIC DECISION** vs **NON-STRATEGIC PRESENTATION DEFAULT**.

Phase 0 inventory baseline: 2026-08-23.  
**Phase 4 status:** COMPLETE — strategic primary consumers = **0**.

---

## Classification legend

| Class | Meaning |
|-------|---------|
| **STRATEGIC_ROUTING** | Chooses thesis for signal attribution / score-route / contest |
| **STRATEGIC_CONTEXT** | Resolves thesis for a downstream strategic/advisory action |
| **UI_PRESENTATION** | Display default when no selection — not a routing decision |
| **ADVISORY_AI** | AI analysis context; must not become router |
| **UNRELATED** | Incidental `[0]` (strings, arrays) — ignore |

| Migration | Meaning |
|-----------|---------|
| **MIGRATED** | Changed for SPEC-001 |
| **ALLOWED_PRESENTATION_ONLY** | Non-strategic presentation — documented |
| **REMOVED** | Pattern eliminated |
| **DEFERRED_TO_OTHER_SPEC** | Content gating beyond SPEC-001 scope |
| **NOT_APPLICABLE** | Not a thesis selection |

---

## Persistence (Phase 3)

| Surface | Status | Notes |
|---------|--------|-------|
| Signal current routing fields | **MIGRATED** | `routingDecision` + `thesisScores` + compatibility `thesisId` |
| Material routing history | **IMPLEMENTED (local)** | `postura_signal_routing_history_v1` |
| Auto-DISCARD on routing write | **REMOVED** | `applyStrategicRoutingToSignal` |

---

## Call-site matrix (Phase 4 final)

| Location | Pattern | Class | Disposition | Notes |
|----------|---------|-------|-------------|-------|
| `thesisRoutingCore` | router | STRATEGIC_ROUTING | **MIGRATED** (core) | Domain authority |
| `main.scoreSignal` | Application | STRATEGIC_ROUTING | **MIGRATED** | Phase 2 |
| `main` thesis override | OverrideSignalThesis | STRATEGIC_ROUTING | **MIGRATED** | Phase 2/4 |
| `main` analyze signal | routed CLEAR | ADVISORY_AI | **MIGRATED** | Score first; CONTESTED/UNROUTED fail-closed |
| `main` source discovery / add | multi-ACTIVE / no thesisId | STRATEGIC_CONTEXT | **MIGRATED** | No primary bind |
| `main` content/claim fallbacks | explicit only | STRATEGIC_CONTEXT | **MIGRATED** | Fail-closed; content gating may remain other SPEC |
| `main` comparative / challenge | explicit id | ADVISORY_AI | **MIGRATED** | No `theses[0]` |
| `advisor.ts` | client-wide / explicit | ADVISORY_AI | **MIGRATED** | No getPrimaryThesis |
| `topicAgent.ts` | all ACTIVE | STRATEGIC_CONTEXT | **MIGRATED** | Multi-thesis |
| `researchSignalsAgent.ts` | routed per signal | STRATEGIC_CONTEXT | **MIGRATED** | CONTESTED/UNROUTED errors |
| `ClientWorkspace` radar | ACTIVE count | STRATEGIC_CONTEXT | **MIGRATED** | No `activeTheses[0]` |
| `ClientWorkspace` contested UI | override buttons | STRATEGIC_ROUTING | **MIGRATED** | OverrideSignalThesis |
| `SourceRegistryModal` | multi-thesis | STRATEGIC_CONTEXT | **MIGRATED** | No `[0]` bind |
| `ClientPortal` `theses[0]` | view default | UI_PRESENTATION | **ALLOWED_PRESENTATION_ONLY** | No write |
| `ManagerCockpit` chip | label | UI_PRESENTATION | **ALLOWED_PRESENTATION_ONLY** | No write |
| `Modals` generate-content select | select default | UI_PRESENTATION | **ALLOWED_PRESENTATION_ONLY** | Empty if none selected |
| `Modals` add-task | explicit select | STRATEGIC_CONTEXT | **MIGRATED** | Required thesis select |
| `db.getPrimaryThesis` | helper | LEGACY | **ALLOWED_PRESENTATION_ONLY** | Portfolio metrics only |
| `db` portfolio ~2500 | getPrimaryThesis | UI_PRESENTATION | **ALLOWED_PRESENTATION_ONLY** | Industry preset label |
| `thesisContextCore` | primary fallback | STRATEGIC_CONTEXT | **MIGRATED** | Off unless `allowPrimaryFallback` |
| `candidates[0]` | — | — | **REMOVED** | Central path |

---

## Strategic consumer counts (Phase 4 end)

| Pattern | Strategic count |
|---------|----------------:|
| `getPrimaryThesis` | **0** |
| `activeTheses[0]` / `getActiveTheses()[0]` | **0** |
| `theses[0]` | **0** |
| `candidates[0]` | **0** |
| `primaryThesisId` as decision source | **0** |

Presentation-only leftovers: ManagerCockpit chip, ClientPortal view default, `getPrimaryThesis` definition + portfolio label.

---

## Target end state

```text
Strategic path:
  Signal → ScoreAndRouteSignal → all ACTIVE → CLEAR|CONTESTED|UNROUTED
  CONTESTED → OverrideSignalThesis (MANUAL)

Non-strategic UI:
  May show first thesis as visual default — never writes AUTO routing via [0]
```
