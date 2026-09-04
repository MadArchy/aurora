# CR-1 Wave B3 — #14 DISCARD Partial-Failure Policy (Human Approval)

**Class:** `GOVERNANCE_COMPATIBILITY_POLICY`  
**Status:** `HUMAN_APPROVED` · **B3 IMPLEMENTATION = NOT AUTHORIZED**  
**Authorized base checkpoint:** `1a08eb26ca589db1fb5109fee15437bc53f2ee20`  
**Wave scope:** **#14 DecideCuration** · DISCARD cascade to frozen **#20 DiscardSignal** only  
**Timezone:** America/Bogota

---

## Human governance approval

Human governance authority explicitly approves the remaining CR-1 Wave B3
compatibility policy for the best-effort sequential workflow:

`#14 DecideCuration` (persist `destination = DISCARD`) → explicit second
canonical `#20 DiscardSignal`.

This approval records **governance policy only**. It does **not** authorize B3
code implementation.

---

## Approved situation

Applies **only** when:

1. Canonical `#14 DecideCuration` has **successfully persisted**
   `destination = DISCARD`, and then
2. Explicit frozen `#20 DiscardSignal` fails with an error **other than**
   exact typed `SIGNAL_NOT_FOUND`.

---

## DECISION — BEST_EFFORT_SEQUENTIAL (non-`SIGNAL_NOT_FOUND` failure)

| Requirement | Value |
|---|---|
| Cascade failure model | `BEST_EFFORT_SEQUENTIAL` |
| Rollback | **0** |
| Transaction | **0** |
| Compensation | **0** |
| Hidden cross-boundary orchestrator inside Execution Delivery | **0** |
| Already-successful `#14` curation decision | **MUST remain persisted** |

### Approved observables (non-`SIGNAL_NOT_FOUND` `#20` failure)

| Observable | Value |
|---|---|
| Curation decision write | **1** (already succeeded) |
| Signal discard write | **0** / failed |
| `CURATION_DECIDED` audit | **1** |
| `SIGNAL_DISCARDED` audit | **0** |
| Overall success toast | **0** |
| Warning/error toast | **1** |
| Render | **1** |
| Rollback | **0** |
| Compensation | **0** |
| Event rejection | **0** when handler translates typed failure into approved warning path |

The warning must truthfully communicate that the curation decision was saved
but the linked Signal could not be discarded. Exact wording may follow existing
Execution Delivery / Signal Intake handler conventions.

The handler **MUST NOT** present the entire DISCARD workflow as successful when
`#20` failed for:

- tenant denial
- role denial
- missing session
- persistence error
- unknown error
- any other non-`SIGNAL_NOT_FOUND` failure

---

## Frozen special compatibility — `SIGNAL_NOT_FOUND` (unchanged)

If canonical `#14` succeeds and frozen `#20` returns exact typed
`SIGNAL_NOT_FOUND`, preserve legacy success continuation:

| Observable | Value |
|---|---|
| Curation decision | persisted |
| Signal write | **0** |
| `CURATION_DECIDED` audit | **1** |
| Warning | **0** |
| Success toast | **1** |
| Render | **1** |

This `SIGNAL_NOT_FOUND` compatibility **MUST NOT** be broadened to any other
error.

---

## Ratified architecture principles

| Principle | Value |
|---|---|
| `#14 DISCARD CASCADE FAILURE MODEL` | `BEST_EFFORT_SEQUENTIAL` |
| Execution Delivery `#14` authority | curation decision only |
| Signal Intake `#20` authority | signal discard only |
| Presentation/composite authority | workflow sequencing only |
| `COMPETING AUTHORITY` | **0** |
| `ROLLBACK` | **0** |
| `COMPENSATION` | **0** |
| `#20` modifications | **0** |
| `NEW DOMAIN RULE` | **0** |
| `NEW APPLICATION BUSINESS BOUNDARY` | **0** |

---

## Additional B3 compatibility (from read-only review — unchanged by this approval)

| Item | Status |
|---|---|
| Missing CurationEntry handler shim | required at implementation |
| `#20` composite invocation suppresses consumer `SIGNAL_DISCARDED` audit on curation DISCARD path | required (`markSignalSaved` precedent) |
| `decidedBy` trusted CR-3 actor remediation | required |
| `#14` authoritative CurationEntry reload | required |
| Rationale/destination presentation validation | remains caller-side |

---

## Explicitly NOT authorized

Modifications to frozen #20 · #21a / #21b · #15 · #16-R · #16-O · #17 · React
work · legacy deletion · host cutover · T-010-603 · T-010-604 · Planner ·
SPEC-009 production · deployment

---

## Frozen references (unchanged)

| Item | Status |
|---|---|
| B1 | `FORMALLY_ACCEPTED` · `#21a` radar `CANONICALIZED_AND_FROZEN` |
| B2 | `FORMALLY_ACCEPTED` · `#21a` advisor `CANONICALIZED_AND_FROZEN` |
| #21 full command | `CANONICALIZED_AND_FROZEN` · registry `#21 CU? = YES` |
| #20 | `CANONICALIZED_AND_FROZEN` |
| #21b | `CANONICALIZED_AND_FROZEN` |
| Registry #14 `CU?` | **NO** (until B3 implementation) |

---

## Next action

`AUTHORIZE_CR1_WAVE_B3_DECIDE_CURATION` — separate narrowly scoped
implementation authorization. Do **not** auto-implement.
