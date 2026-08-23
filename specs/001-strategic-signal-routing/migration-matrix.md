# Migration matrix 001 — Strategic Signal Routing

**Rule:** Do **not** mechanically delete every `theses[0]`.  
Classify **STRATEGIC DECISION** vs **NON-STRATEGIC PRESENTATION DEFAULT**.

Phase 0 inventory baseline: 2026-08-23.

---

## Classification legend

| Class | Meaning |
|-------|---------|
| **STRATEGIC_ROUTING** | Chooses thesis for signal attribution / score-route / contest |
| **THESIS_CONTEXT_ONLY** | Resolves thesis for a downstream action; should use explicit id or routed context |
| **UI_PRESENTATION** | Display default when no selection — not a routing decision |
| **ADVISORY_AI** | AI analysis context; must not become router |
| **UNRELATED** | Incidental `[0]` (strings, arrays) — ignore |

| Migration | Meaning |
|-----------|---------|
| **MIGRATE** | Must change for SPEC-001 acceptance |
| **REVIEW** | Inspect in Phase 4; may become MIGRATE or ALLOWED |
| **ALLOWED** | Non-strategic presentation / count — OK if documented |
| **NOT_APPLICABLE** | Not a thesis selection |

---

## Helper definitions (forbidden on strategic paths)

| Helper | Definition | Strategic use |
|--------|------------|---------------|
| `getPrimaryThesis` | `getActiveTheses(clientId)[0]` in `db.ts` | **FORBIDDEN** |
| `activeTheses[0]` / `getActiveTheses(...)[0]` | First ACTIVE by priority sort | **FORBIDDEN** for routing |
| `theses[0]` | First in arbitrary/filtered list | **FORBIDDEN** for routing |
| `candidates[0]` | Fallback after router in `scoreSignal` | **FORBIDDEN** |

---

## Persistence (Phase 3)

| Surface | Status | Notes |
|---------|--------|-------|
| Signal current routing fields | **MIGRATED** | `routingDecision` + `thesisScores` + compatibility `thesisId` |
| Material routing history | **IMPLEMENTED (local)** | `postura_signal_routing_history_v1`; Firestore path deferred (rules gap) |
| Auto-DISCARD on routing write | **REMOVED** | `applyStrategicRoutingToSignal` |
| UI/agent strategic consumers | **Phase 4** | unchanged |

---

## Call-site matrix

| Location | Pattern | Class | Migration | Notes |
|----------|---------|-------|-----------|-------|
| `src/domain/thesisRoutingCore.ts` | `routeSignalAcrossTheses` | STRATEGIC_ROUTING | **ALLOWED** (core) | Retain; evolve contract Phase 1 |
| `src/main.ts` `scoreSignal` | Router via Application | STRATEGIC_ROUTING | **MIGRATED** (Phase 2) | `ScoreAndRouteSignal`; primary/`candidates[0]` **REMOVED** |
| `src/main.ts` thesis override | MANUAL path | STRATEGIC_ROUTING | **MIGRATED** (Phase 2) | `OverrideSignalThesis` |
| `src/main.ts` ~2491 AI analyze | `getPrimaryThesis` then `scoreSignal` | ADVISORY_AI + STRATEGIC | **MIGRATE** Phase 4 | AI context still primary; scoreSignal now governed |
| `src/main.ts` ~1886, 1924, 1971, 2022, 2107, 2334 | `getPrimaryThesis` | THESIS_CONTEXT_ONLY | **REVIEW** / likely **MIGRATE** | Radar / ingest adjacent — require explicit thesis or routed signal |
| `src/main.ts` ~2937, 3162, 3292, 3383, 3436, 3629, 3670, 4633 | `getPrimaryThesis` | THESIS_CONTEXT_ONLY | **REVIEW** | Content / portfolio — not all are routing; ban if strategic attribution |
| `src/main.ts` ~1578, 3698 | `theses[0]` fallback | THESIS_CONTEXT_ONLY | **MIGRATE** if selection drives strategy | Prefer fail-closed / explicit id |
| `src/services/db.ts` `getPrimaryThesis` | `[0]` helper | STRATEGIC_ROUTING enabler | **MIGRATE** | Deprecate for strategic paths; optional rename for presentation |
| `src/services/db.ts` ~2414 portfolio | `getPrimaryThesis` | UI_PRESENTATION / metrics | **REVIEW** | Not routing; still prefer explicit |
| `src/services/advisor.ts` ~285, 353 | `getPrimaryThesis` | THESIS_CONTEXT_ONLY / ADVISORY_AI | **MIGRATE** | Advisor must take explicit thesisId or multi-context |
| `src/services/topicAgent.ts` ~31 | `getActiveTheses()[0]` | THESIS_CONTEXT_ONLY | **MIGRATE** | Topics must not invent strategic primary |
| `src/services/researchSignalsAgent.ts` ~106 | `getActiveTheses()[0]` | THESIS_CONTEXT_ONLY | **MIGRATE** | Research scoped to explicit thesis or all ACTIVE without collapse |
| `src/components/ClientWorkspace.ts` ~902 | `activeTheses[0]` | STRATEGIC_ROUTING / display thesis for score UI | **MIGRATE** | Use signal.thesisId / contest UI |
| `src/components/ClientWorkspace.ts` routing badges | `routingDecision` display | UI_PRESENTATION | **ALLOWED** | Keep contested indicators |
| `src/components/ClientPortal.ts` ~532 | `theses[0]` | UI_PRESENTATION | **ALLOWED** / **REVIEW** | Selection default only if not writing routing |
| `src/components/Modals.ts` ~655, 757–758 | `getPrimaryThesis` / `theses[0]` | UI_PRESENTATION / THESIS_CONTEXT | **REVIEW** | Modal defaults ≠ routing |
| `src/components/SourceRegistryModal.ts` ~9, 43 | `getActiveTheses()[0]` | THESIS_CONTEXT_ONLY | **REVIEW** | Source suggestions — prefer explicit |
| `src/components/ManagerCockpit.ts` ~205 | `getActiveTheses()[0]` | UI_PRESENTATION | **ALLOWED** / **REVIEW** | Cockpit summary chip |
| `src/domain/thesisContextCore.ts` | `getPrimary` fallback | THESIS_CONTEXT_ONLY | **MIGRATE** for strategic callers | Presentation may keep ordered fallback if labeled |

---

## Summary counts (Phase 0B)

| Migration | Approx rows |
|-----------|-------------|
| MIGRATE (definite strategic / collapse) | **Core score path + override + agents + Workspace attribution** |
| REVIEW | Content/portfolio/modals/cockpit defaults |
| ALLOWED | Domain router; contested badges; pure presentation after review |

**Acceptance A2** cares about **strategic routing call sites** reaching zero — not every UI default.

---

## Target end state

```text
Strategic path:
  Signal → ScoreAndRouteSignal → all ACTIVE → CLEAR|CONTESTED|UNROUTED
  CONTESTED → OverrideSignalThesis (MANUAL)

Non-strategic UI:
  May show "selected thesis" or empty state — never writes AUTO routing via [0]
```
