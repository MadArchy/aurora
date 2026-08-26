# Opportunity scoring 007 — Opportunity Scout

**Phase 0.** Opportunity Score is **formalized as a contract** with a **PROPOSED_FOR_HUMAN_APPROVAL** dimension formula.

Constitution (§10): *Ningún Opportunity Score debe ser una caja negra.*

---

## Hard boundary vs SPEC-002

| | **Strategic Score (SPEC-002)** | **Opportunity Score (SPEC-007)** |
|--|-------------------------------|----------------------------------|
| Subject | Signal under thesis | OpportunityCandidate |
| Owner | SPEC-002 | SPEC-007 |
| Selects thesis? | No (routing is SPEC-001) | **No** |
| Authorizes CREATE_OPPORTUNITY? | May *recommend* disposition | **No** — SPEC-004 authorizes |
| Formula reuse | N/A | **Must not duplicate** SPEC-002 weights |

SPEC-007 may **read** Strategic Score snapshots for context inside thesis evaluations. It must not rewrite Strategic Score, disposition, or routing.

---

## OpportunityScore artifact

```text
OpportunityScore {
  id
  organizationId
  clientId
  candidateId
  scoringModelVersion     // e.g. opportunity-score-v1-proposed
  totalScore              // 0..100 deterministic from dimensions
  band                    // LOW | MEDIUM | HIGH | CRITICAL (thresholds proposed)
  dimensions: [
    { key, rawInput, weight, contribution, reasonCode }
  ]
  evidenceRefs[]
  riskFlags[]
  computedAt
  schemaVersion
}
```

Properties:

- deterministic given inputs + model version
- dimension-level explainability
- structured reason codes (no chain-of-thought)
- versioned model
- **no thesis selection authority**
- **no execution / materialization authority**

---

## PROPOSED_FOR_HUMAN_APPROVAL dimension set

Repository evidence:

- Constitution requires explainable Opportunity Score
- Legacy `fitRationale` / deadline / CLE heuristics exist in UI helpers
- SPEC-002 already owns signal strategic relevance
- Fase docs describe CREATE_OPPORTUNITY as “acción externa concreta”

**Proposed dimensions (not approved for implementation until T-007-010 + Phase 1 refinement):**

| Key | Intent | Weight (proposed) | Evidence notes |
|-----|--------|-------------------|----------------|
| `strategicFit` | Fit to evaluated thesis context | 0.25 | May consume read-only Strategic Score band as **input**, not as total |
| `timeliness` | Deadline / whyNow urgency | 0.20 | Legacy deadline heuristics in `clientOpportunityCore` |
| `actionability` | Concrete external action possible | 0.20 | Constitutional CREATE_OPPORTUNITY framing |
| `expectedUpside` | Positioning / visibility upside | 0.15 | Proposed — needs human confirmation |
| `effortCost` | Effort inverse (higher effort → lower contribution) | 0.10 | Proposed |
| `risk` | Compliance / reputation risk inverse | 0.10 | Aligns with riskFlags |

`totalScore = round(100 * Σ contribution_i)` with contributions clamped.

**Band thresholds (proposed):** LOW `<40` · MEDIUM `40–69` · HIGH `70–84` · CRITICAL `≥85`.

These weights/thresholds are **PROPOSED_FOR_HUMAN_APPROVAL**. Phase 1 Domain must not ship alternate silent formulas.

---

## Forbidden

- Hidden AI score as authority
- Using Opportunity Score to pick `theses[0]` / primary thesis
- Using Opportunity Score to bypass SPEC-004
- Replacing SPEC-002 Strategic Score
- Mutating routingDecision / selectedThesisId

---

## Future AI (optional)

If SPEC-005 later adds `OPPORTUNITY_SUGGEST` (**PROPOSED_FUTURE_NONBLOCKING**):

- AI may suggest dimension inputs / rationale text
- Domain/Application must validate structured output
- AI never sets authoritative totalScore without Domain compute
