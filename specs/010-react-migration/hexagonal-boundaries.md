# Hexagonal boundaries 010 — React migration

Constitution §22A: Domain and Application **must not** depend on Firebase/Firestore, AI provider SDKs,
concrete HTTP transport, **UI frameworks**, or environment-specific infrastructure. Dependencies point
inward. §22B: Domain purity.

**React is a UI framework. It may therefore never be imported by Domain or Application.**

---

## Layer stack (target)

```text
            Domain            (src/domain/**)                    pure
              ↑
          Application         (src/application/**)                use cases + ports
              ↑
            Ports             (src/application/*/ports/**)        contracts
              ↑
        Infrastructure        (src/infrastructure/**)             adapters, stores
              ↑
         Composition          (src/composition/**)                wiring
              ↑
     Consumers / Facades      (src/services/*Consumer.ts)         intent + projection
              ↑
          React UI            (future)                            presentation only
```

Dependencies point **inward / upward only**. React sits farthest from Domain.

---

## What React may depend on

| Allowed | Notes |
|---------|-------|
| Canonical consumers (`src/services/*Consumer.ts`) | existing pattern; 4 components already do this |
| A UI-facing query/command facade | Phase-1 seam |
| Query hooks built on the above | SPEC-010 owned |
| Domain **types** (type-only imports) | types carry no authority; runtime domain calls are not permitted for decisions |
| Presentation utilities (`src/lib/**` formatting/labels) | non-authoritative |

## What React must never depend on

| Forbidden | Target |
|-----------|--------|
| `src/services/db.ts` (`dbService`) direct import in a React module | **0** |
| `src/infrastructure/**` `Local*Store` direct | **0** |
| Firebase / Firestore SDK direct | **0** |
| AI provider SDK or endpoint direct | **0** |
| Domain mutation invoked directly from React | **0** |
| Target-SPEC persistence direct | **0** |

## Reverse-direction prohibitions

| Forbidden | Target |
|-----------|--------|
| `src/domain/**` imports React | **0** |
| `src/application/**` imports React | **0** |
| `src/domain/**` or `src/application/**` imports a query/cache library | **0** |
| Domain or Application imports a component | **0** |

---

## Current measured boundary state (Phase-0 evidence, read-only)

| Check | Measured |
|-------|----------|
| `src/domain/**` imports of Firebase/Firestore/localStorage/`dbService` | **0** |
| Generic `setStatus` / `updateStatus` in `src` | **0** (domain cores explicitly forbid it) |
| Status assignments in `src/components/**` | **0** |
| `dbService` mutator calls in `src/components/**` | **0** |
| Direct AI provider calls in `src/components/**` or `src/main.ts` | **0** |
| Provider adapters location | `src/infrastructure/ai/providers/` (correct layer) |
| Components importing `dbService` for **reads** | **11 of 16** |
| Components importing canonical consumers | **4** (`ClientWorkspace`, `ClientPortal`, `Modals`, `OpportunityPanel`) |

**Architectural violations of the frozen rules: 0.**
The 11 read couplings are a **migration obstacle**, not a breach of an existing frozen rule — no rule
currently forbids legacy components from reading `dbService`. SPEC-010 introduces that rule for React
modules.

---

## Enforcement model

Phase-1+ architecture tests (Vitest, following the existing `*Architecture.test.ts` convention used by
SPEC-007/008) must assert, for React modules only:

1. zero `dbService` imports
2. zero `Local*Store` imports
3. zero Firebase/Firestore imports
4. zero AI provider imports/endpoints
5. zero React imports inside `src/domain/**` and `src/application/**`
6. zero duplicated scoring/routing/lifecycle/approval logic (symbol and formula checks)
7. every query key carries trusted tenant scope
8. one declared read source per migrated module

Legacy (non-migrated) modules are explicitly exempt until their wave completes, so the tests must scope
themselves to migrated paths and be widened wave by wave. That scoping must be explicit, never implicit.

---

## Cross-SPEC boundary contracts

| SPEC | Owns | SPEC-010 relationship | Mutation authority |
|------|------|----------------------|--------------------|
| **001** | signal → thesis routing | READ_ONLY_INPUT + canonical intent where interfaces exist | **0** |
| **002** | Strategic Signal scoring | READ_ONLY_INPUT (display score/explainability) | **0** |
| **003** | StrategicBrief | DOWNSTREAM_CONSUMER via `strategicBriefConsumer` | **0** |
| **004** | StrategicPlan / PlanItem / planned-action authorization | DOWNSTREAM_CONSUMER via `strategicPlanConsumer` | **0** |
| **005** | AI Gateway + provider governance | DOWNSTREAM_CONSUMER via gateway only | **0** |
| **006** | Claims / Evidence / Verification / publication authorization | READ_ONLY_INPUT (display) | **0** |
| **007** | Opportunity Intelligence + lifecycle | DOWNSTREAM_CONSUMER via `opportunityScoutConsumer` | **0** |
| **008** | Results → Learning → StrategicRecommendation → human approval → target application | DOWNSTREAM_CONSUMER via `learningLoopConsumer` | **0** |
| **009** | security / auth / rules / production controls | COMPATIBILITY — preserved, not redefined | **0** |

**No duplication:** React must not recreate `OpportunityScore`, `MaterializeOpportunity`, Opportunity
lifecycle, Brief lifecycle, Plan lifecycle, scoring formulas, routing decisions, claim verification, or
Learning approval logic.

### SPEC-008 boundary (frozen @ `642ae939`)

React may present Learning observations, assessments and StrategicRecommendations, and may expose
human-intent controls **only** where canonical use cases already exist.

React may **not**: auto-approve a StrategicRecommendation · auto-apply · reintroduce
`feedbackScoringHints` authority · reintroduce outcome-triggered auto-rescore · bypass the human approval
gate · directly mutate target-SPEC state.

**SPEC010→SPEC008 mutation authority target: 0.**
