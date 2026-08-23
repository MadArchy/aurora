# Hexagonal boundaries 001 — Strategic Signal Routing

---

## Target layers

```text
┌─────────────────────────────────────────────┐
│ Interfaces / UI                             │
│  main.ts triggers, ClientWorkspace, Modals  │
└───────────────────┬─────────────────────────┘
                    ▼
┌─────────────────────────────────────────────┐
│ Application                                 │
│  ScoreAndRouteSignal                        │
│  OverrideSignalThesis                       │
│  (optional explanation / recompute)         │
└───────────────────┬─────────────────────────┘
                    ▼
┌─────────────────────────────────────────────┐
│ Domain                                      │
│  thesisRoutingCore                          │
│  eligibility rules                          │
│  routing state classification               │
└─────────────────────────────────────────────┘
          ▲ ports
┌─────────┴───────────────────────────────────┐
│ Infrastructure                              │
│  dbService / Firestore sync adapters        │
│  scoring adapter (scoreFn injection)        │
└─────────────────────────────────────────────┘

Composition root wires ports → adapters.
```

---

## Layer responsibilities

| Layer | Owns | Must not own |
|-------|------|--------------|
| **Domain** | Routing calculation, eligibility, contested/clear/unrouted rules, versioned rationale helpers | Firebase, HTTP, UI, AI SDKs, concrete DB |
| **Application** | Use-case orchestration, policy enforcement (no silent discard; contested gate), port calls | Firestore SDK, DOM |
| **Ports** | Neutral query/write/scoring contracts | Collection path strings as domain law |
| **Infrastructure** | Persistence, envelope preservation, scoreFn bridge to `scoring.ts` (`DbStrategicSignalRoutingAdapter`) | Business routing policy |
| **Interfaces** | Triggers, contested UI, MANUAL override UX (`main.ts` strangler) | Direct provider/AI for routing authority |
| **Composition** | `composeStrategicSignalRouting` wiring | Business rules |

### Phase 2 landed modules

- `src/application/strategicSignalRouting/` — use cases + ports + errors
- `src/infrastructure/strategicSignalRouting/DbStrategicSignalRoutingAdapter.ts` — transitional bridge
- `src/composition/strategicSignalRouting/composeStrategicSignalRouting.ts`

---

## Forbidden dependencies

| From | To | Status |
|------|----|--------|
| Domain | Firebase / Firestore / firebase-admin | **FORBIDDEN** |
| Domain | React / Vite / Express / HTTP clients | **FORBIDDEN** |
| Domain | OpenAI / Anthropic SDKs or URLs | **FORBIDDEN** |
| Domain | Concrete `dbService` class | **FORBIDDEN** |
| Application | Concrete Firestore adapters | **FORBIDDEN** (ports only) |
| Browser UI | Server composition / Secret Manager | **FORBIDDEN** |
| Routing authority | `SIGNAL_THESIS_EVAL` output without software gate | **FORBIDDEN** |

---

## Allowed patterns

| Pattern | Notes |
|---------|-------|
| Domain imports shared `types` | OK if types stay free of infra |
| Application injects `ThesisScoreFn` | Keeps scoring engine swappable |
| UI calls application facade / existing thin service wrapping use case | Strangler OK |
| SPEC-005 client for advisory eval | Parallel path; not router |

---

## Existing foundation

| Artifact | Boundary status |
|----------|-----------------|
| `src/domain/thesisRoutingCore.ts` | **Domain-pure** (types only) — **retain** |
| `src/services/scoring.ts` | Service/infra-adjacent scorer — inject via port/fn |
| `src/main.ts` `scoreSignal` | Interface/orchestration debt — migrate to Application |
| `src/services/db.ts` `applyScoreToSignal` | Infrastructure — wrap behind `SignalWritePort` |

---

## Architecture tests (Phase 5)

- Domain `thesisRouting*` / eligibility modules: no Firebase/provider imports
- Application routing use cases: no direct `dbService` / Firestore imports
- Strategic module allowlist: zero `getPrimaryThesis` / strategic `[0]` patterns (see A14)
