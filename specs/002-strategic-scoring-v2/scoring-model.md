# Scoring model 002 — Baseline V1 (repository snapshot)

**Purpose:** Keep formula, bands, and versioning contracts readable without overloading `spec.md`.

**Status:** **BASELINE** — not immutable final business policy. Phase 1 extraction must preserve behavior until explicit governance revises weights.

**Baseline identity (Phase 1):** `scoring-v1` — `SCORING_VERSION` in `src/domain/scoringCore.ts`

**Source of truth (canonical):** `src/domain/scoringCore.ts` → `computeStrategicScoreMaterial`

**Compatibility wrapper:** `src/services/scoring.ts` → `calculateStrategicScore` (delegates; injects `Date.now()` for staleness + `calculatedAt`)

**Cloud duplicate (drift risk):** `functions/src/lib/scoreSignal.ts` → `scoreSignalCloud`

---

## Score range

Final score is computed as:

```text
round(clamp(baseScore100 - evidenceGap - risk - staleness - conflict, 0, 100))
```

**Contract:** Baseline v1 produces integer **0–100** inclusive after clamp.

---

## Factor weights (baseline v1)

Contributions to `baseScore100` (each factor is 0–1 unless noted):

| Factor | Max points | Notes |
|--------|------------|-------|
| `thesisMatch` | 25 | territory/audience/token overlap + dossier terms |
| `audienceMatch` | 20 | structured audiences + tier multiplier |
| `timeliness` | 15 | `whyNow` when present, else source-type heuristic |
| `authorityFit` | 15 | evidence vault authority or proof-point proxy |
| `differentiation` | 10 | binary on differentiator presence (0.72 / 0.48) |
| `strategicPotential` | 7.5 | derived: thesisMatch×0.6 + audienceMatch×0.4 |
| `commercialPotential` | 2.5 | business objective weight or regex heuristic |
| `sourceQuality` | 5 | HIGH/MEDIUM/LOW mapping |

Duplicate weight table for explainability UI: `src/domain/scoreExplainCore.ts` imports `SCORING_FACTOR_WEIGHTS` from `scoringCore` — **unified Phase 1**.

---

## Penalties (subtracted)

| Penalty | Baseline behavior (summary) |
|---------|----------------------------|
| `evidenceGap` | 7 if proofPoints < 2; 2 if < 4; else 0 |
| `risk` | 15 fraud/illegal terms; 5 controversy; else 0 |
| `staleness` | by signal age (48h / 7d / 21d tiers) |
| `conflict` | soft-avoid / voice avoid phrase hits × 8 (rounded) |

Hard compliance blocks force disposition `NO_ACTION` via `blockedByLimit`.

---

## Priority bands (baseline v1)

Applied **after** final score:

| Band | Condition |
|------|-----------|
| `CRITICAL` | finalScore ≥ 85 |
| `HIGH` | finalScore ≥ 70 (and < 85) |
| `MEDIUM` | 40 ≤ finalScore < 70 |
| `LOW` | finalScore < 40 |

**Note:** `MEDIUM` is the default assignment before threshold checks — covers 40–69 explicitly.

---

## Routing minimum (SPEC-001 interaction)

`ROUTING_MIN_SCORE = 40` in `thesisRoutingCore.ts` — theses scoring below this may be excluded from routing attribution (UNROUTED path). Scoring still computes per-thesis values; routing applies separate eligibility.

---

## Legacy combined `recommendedAction` (baseline — to be split)

Current ladder in `scoring.ts` ( **mixed disposition + format** ):

| Condition (simplified) | Current value | Target classification |
|------------------------|---------------|------------------------|
| hard block | `NO_ACTION` | disposition |
| risk high + score low | `NO_ACTION` | disposition |
| evidence gap / no proof | `RESEARCH_REQUIRED` | disposition |
| score ≥ 85 | `CREATE_OPPORTUNITY` | disposition |
| score ≥ 70 | `VIDEO` | **format** (legacy mix) |
| score ≥ 50 | `SHORT_POST` | **format** (legacy mix) |
| score ≥ 40 | `MONITOR` | disposition |
| else | `NO_ACTION` | disposition |
| default start | `SAVE` | disposition |

Phase 1 target enums (conceptual — finalize in implementation):

**Strategic disposition:** `NO_ACTION`, `MONITOR`, `SAVE`, `RESEARCH_REQUIRED`, `OPPORTUNITY_CANDIDATE`, `LOW_PRIORITY`

**Output format recommendation:** `VIDEO`, `SHORT_POST`, `ARTICLE`, `LINKEDIN_POST`, `NONE`

---

## scoringVersion contract (mandatory target)

Every material strategic scoring result must record:

```text
scoringVersion: string   // e.g. "scoring-v1"
```

Rules:

- deterministic constant / semver identity — **not** derived from timestamp
- stored with score result and history entries
- any weight/threshold/disposition ladder change **requires** new version + tests + docs

---

## Deterministic inputs (material)

For parity and tests, material inputs include:

- signal text fields (normalized consistently)
- thesis structured fields used by scorer
- scoring context (bilingual terms, owned topics, avoided framings, authorityScore, whyNow)
- scoringVersion constant

Non-material: `scoredAt`, execution environment (must not change score when inputs equal).

---

## Explainability minimum

Reconstructable from persisted + computed artifacts:

- factor names + raw 0–1 values + weighted points
- penalties + points
- scoringVersion
- final score + priority band
- strategicRationale text
- whyNow reason (when present)
- matched territory/audience (when structured thesis)

No hidden AI chain-of-thought required.

---

## Weight change governance

Phase 1 extraction **must not** silently change weights.

Current weights = **BASELINE SCORING V1** until explicit product/governance revision.

Future change requires:

1. new `scoringVersion`
2. updated tests (same-input/same-score per version)
3. updated explainability docs
4. historical version identity preserved
