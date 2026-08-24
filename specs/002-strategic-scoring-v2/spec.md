# Spec 002 — Strategic Scoring V2

| Field | Value |
|-------|--------|
| **Spec ID** | `002-strategic-scoring-v2` |
| **Display name** | **SPEC-002 — Strategic Scoring V2** |
| **Status** | **`READY_FOR_HUMAN_SPEC_APPROVAL`** (Phase 0B package authored 2026-08-23) |
| **Phase** | 0B COMPLETE · Phase 1 **NOT AUTHORIZED** |
| **Branch (recommended)** | `spec/002-strategic-scoring-v2` from governance checkpoint `4643cad` |
| **Implementation baseline** | Phase 0 inventory @ SPEC-001 CODE_COMPLETE (`057a284` product) |
| **Priority** | P1 (constitution thesis-first circuit; disposition split) |
| **Constitution** | §4 Thesis First · §5 Multi-thesis · §AI SUGGESTS, SOFTWARE GOVERNS · §Explainability |
| **Depends on** | SPEC-001 (CODE_COMPLETE — routing authority); SPEC-005 (CODE_COMPLETE — advisory AI); SPEC-009 (CODE_AVAILABLE; production DEFERRED) |
| **Blocks** | Strategic Brief (SPEC-003); governed strategic decision inputs |
| **Phase 0 inventory** | Chat Phase 0 + existing `src/services/scoring.ts` + cloud duplicate |
| **Test baseline (entering)** | `npm run check` → **573/573 PASS**; `npm run test:rules` → **91/91 PASS** |

---

## Problem

POSTURA implements deterministic strategic scoring, but governance is incomplete:

- **Good:** `calculateStrategicScore` produces factor breakdown, penalties, rationale, priority band.
- **Good:** Pure explainability helpers exist (`scoreExplainCore`, `whyNowCore`).
- **Good:** SPEC-001 routing injects scoring per eligible ACTIVE thesis without primary fallback on the governed path.
- **Bad:** No formal SPEC-002 package or acceptance criteria existed before Phase 0B.
- **Bad:** `recommendedAction` mixes **strategic disposition** and **output/content format** in one enum.
- **Bad:** No `scoringVersion` on material score results — explainability/history risk.
- **Bad:** Dual formulas: `src/services/scoring.ts` vs `functions/src/lib/scoreSignal.ts` (drift risk).
- **Bad:** Cloud ingest uses `thesesSnap.docs[0]` and may terminal-`DISCARD` from score alone.
- **Bad:** Legacy `db.applyScoreToSignal` retains auto-DISCARD path (uncalled from SPEC-001 routing, but present).
- **Bad:** Score fields overwrite in-place on Signal — no material score history contract.

---

## Goal

SPEC-002 **deterministically evaluates and prioritizes** a Signal within the strategic context already established by SPEC-001.

It produces an **explainable strategic score** and **recommendation inputs** (disposition + optional format metadata).

SPEC-002 answers:

> **How strategically important is this signal, given its valid thesis context and supporting evidence?**

SPEC-002 does **not** answer:

> **Which thesis should this signal belong to?**

That belongs exclusively to **SPEC-001**.

---

## Strategic circuit position

```text
Signal
  → Strategic Signal Routing          ← SPEC-001 (CODE_COMPLETE)
  → Strategic Scoring                 ← SPEC-002 (this spec)
  → Strategic Decision
  → Strategic Brief                   ← SPEC-003
  → Planner / Content / Opportunity   ← SPEC-004 / adjacent
```

SPEC-002 receives routing context. It does **not** re-route.

---

## Scope

In scope:

- Canonical deterministic scoring algorithm contract (single source of truth target)
- `scoringVersion` identity on every material score result
- Factor/penalty/band explainability
- Strategic disposition vs output-format separation (contracts)
- Consumption of SPEC-001 routing states (CLEAR / CONTESTED / UNROUTED)
- Multi-thesis score evidence preservation (via SPEC-001 outputs)
- Auto-discard governance for score persistence paths
- Cloud/client scoring parity target
- Score history / material change semantics (physical form Phase 3)
- Application use cases + ports (planned)
- Strangler migration off duplicate/legacy scorers
- Architecture bans / acceptance

Out of scope — see **Non-Goals**.

---

## Non-Goals

SPEC-002 does **not** include:

- Strategic Signal Routing redesign (SPEC-001 frozen CODE_COMPLETE)
- new AI providers or AI Gateway redesign (SPEC-005 frozen CODE_COMPLETE)
- Strategic Brief implementation (SPEC-003)
- content generation / publishing system
- claim / evidence graph (SPEC-006)
- production deploy of SPEC-009
- full planner implementation (SPEC-004)
- news ingestion redesign (except scoring alignment hooks)
- React migration (SPEC-010)
- inventing a new AiOperation unless Phase N proves a genuine gap

---

## Actors

| Actor | Role |
|-------|------|
| **Manager (ADMIN)** | Triggers score/re-score; consumes radar triage; performs terminal disposition |
| **Client** | Read-only consumption of scored signals |
| **System (deterministic scorer)** | Computes score from material inputs + routing context |
| **AI (SPEC-005)** | Optional advisory `SIGNAL_THESIS_EVAL` — angle/rationale augmentation only |

---

## Input contract (conceptual)

| Input | Source | Notes |
|-------|--------|-------|
| Signal material fields | Signal entity | title, snippet, source metadata, timestamps |
| Routing context | SPEC-001 | `routingDecision`, `thesisScores`, `selectedThesisId` when CLEAR |
| Thesis structure | Thesis query | For per-thesis scoring — **not** for independent thesis selection |
| Scoring context | Infrastructure | dossier keywords, authority, whyNow, feedback hints |
| Trusted tenant envelope | Application boundary | `organizationId`, `clientId` — never caller-invented |

---

## Output contract (conceptual)

See `scoring-model.md` for baseline formula. Material outputs include:

- overall strategic score (0–100 clamped baseline v1)
- priority band (`LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL`)
- factor breakdown + penalties
- strategic rationale
- whyNow snapshot (when computed)
- **`scoringVersion`** (mandatory target — Phase 1)
- **`strategicDisposition`** (target — separated from format)
- **`outputFormatRecommendation`** (optional target — separated from disposition)
- scoredAt timestamp
- routing context identity reference where material

Legacy field `recommendedAction` remains during migration — **deprecated as combined contract**.

---

## Ownership boundaries

| Owner | Owns |
|-------|------|
| **SPEC-001** | routingState, selectedThesisId, thesisScores, routingDecision, routing history |
| **SPEC-002** | deterministic score, factors, penalties, band, rationale, breakdown, whyNow scoring input, scoringVersion, score history semantics, disposition recommendation |
| **SPEC-003** | Strategic Brief entity + gate |
| **SPEC-005** | AI Gateway / `SIGNAL_THESIS_EVAL` advisory |
| **SPEC-006** | Claim safety downstream |
| **SPEC-009** | Security envelope / rules |

No circular ownership.

---

## Routing contract with SPEC-001 (frozen)

SPEC-001 is **CODE_COMPLETE** and authoritative for:

- `routingState` (`CLEAR` \| `CONTESTED` \| `UNROUTED`)
- `selectedThesisId` (CLEAR only)
- `thesisScores` / per-thesis routing evidence
- `routingDecision` (source, algorithm version, rationale)
- routing history

SPEC-002 **SHALL NOT**:

- select another thesis
- use `getPrimaryThesis`, `theses[0]`, `activeTheses[0]`, `candidates[0]`, or first-item fallback for strategic thesis context
- overwrite `selectedThesisId` or routing state

---

## Routing states consumed by scoring

### CLEAR

- Thesis-specific strategic scoring **may** use the routed `selectedThesisId`.
- Scoring does **not** independently choose thesis.
- Display/persist score snapshot may reflect selected thesis score while preserving full `thesisScores`.

### CONTESTED

- Preserve multi-thesis score evidence from SPEC-001.
- No downstream single-thesis strategic action may silently choose a winner.
- Scoring may support comparison/explainability across competing thesis scores where safe.
- Thesis-specific downstream actions **fail closed** until governed MANUAL resolution (SPEC-001).

### UNROUTED

- No fabricated thesis; no primary fallback.
- No thesis-specific downstream strategic action.
- Scoring may persist non-thesis metadata (e.g. zero/placeholder display score) only as explicitly defined — not as hidden attribution.

SPEC-002 must **not** invent a hidden routing layer.

---

## Multi-thesis invariant

Any path that scores multiple thesis candidates must respect SPEC-001 eligible thesis set (ACTIVE-only on production path).

**Never** use `thesesSnap.docs[0]`, `theses[0]`, `activeTheses[0]`, or equivalent as strategic thesis selection.

Cloud and browser behavior must converge on the same governed routing contract.

---

## Deterministic contract

```text
same material inputs + same scoringVersion = same material scoring result
```

- Timestamp may differ on `scoredAt`.
- Input array order must **not** alter semantic score (domain sort rules apply where relevant).
- AI is **not** required for deterministic scoring.

---

## AI boundary

| Component | Role |
|-----------|------|
| Deterministic scoring core | **Authoritative** for numeric score, band, disposition recommendation |
| SPEC-005 `SIGNAL_THESIS_EVAL` | **Advisory** — angle, analysis, rationale augmentation |
| New AiOperation | **Not required** per Phase 0 evidence |

AI must **not** become authoritative for: numeric formula, priority band, routing state, selected thesis, terminal disposition.

### AI failure

Deterministic score remains valid if advisory AI fails. No primary fallback, fake score, score erasure, or terminal discard because AI failed.

---

## Auto-discard governance (frozen)

> Strategic scoring itself **SHALL NOT** silently perform terminal `DISCARD` solely because score is below a threshold.

Scoring may surface:

- low relevance / low priority
- `NO_ACTION` disposition candidate
- discard **candidate** metadata (if approved terminology)

Final destructive terminal disposition requires **explicit governed decision policy** (manager action or separately approved policy — not silent score persistence).

**Known offending paths (migration — not fixed in 0B):**

- `functions/src/lib/scheduledIngest.ts`
- legacy `db.applyScoreToSignal`

---

## Human governance (frozen)

```text
SOFTWARE SCORES
AI ADVISES
HUMAN / GOVERNED POLICY DECIDES TERMINAL ACTIONS
```

Scoring cannot silently: activate thesis, change routing, publish content, perform final destructive disposition, or change human-approved strategy.

---

## Tenant boundary

Scoring functions may be pure (no tenant logic). Application/persistence boundaries must validate `organizationId`, `clientId`, `signalId`, and routing context through **trusted** context — no caller-invented organization identity, no default org fallback.

---

## History requirement

Material score changes should be reconstructable. Minimum history snapshot fields (physical storage Phase 3):

- previous/new score, band, disposition, scoringVersion
- factor/penalty identity where material
- actor/system, timestamp
- routing context identity where material

Avoid unbounded arrays on current Signal document.

---

## CODE_COMPLETE vs DEPLOYED

| State | Meaning |
|-------|---------|
| `READY_FOR_HUMAN_SPEC_APPROVAL` | Phase 0B docs complete (current) |
| `APPROVED` | Human authorizes implementation |
| `CODE_COMPLETE` | Acceptance A* PASS in repo + human sign-off; no production required |
| `DEPLOYED` / `DONE` | Separate; requires deploy gates if defined |

---

## P0 closure plan (Phase 0 findings)

| ID | Finding | Closure |
|----|---------|---------|
| **P0-1** | Missing formal SPEC/acceptance | **Closed by Phase 0B** after human SPEC approval |
| **P0-2** | Cloud ingest `docs[0]` + auto-DISCARD | **NOT fixed in 0B** — implementation blocker; target Phase 2/4 |

---

## P1 ownership (Phase 0 findings)

| Finding | Target phase |
|---------|--------------|
| Legacy `applyScoreToSignal` auto-DISCARD | Phase 2 / 4 |
| `recommendedAction` disposition/format mix | Phase 1 contracts |
| Dual scorer drift | Phase 1 / 4 |
| Missing `scoringVersion` | Phase 1 |

---

## References

- Constitution strategic circuit §4–§5
- `docs/spec/Postura_Fase_12_Documento_12_Scoring_Priorizacion_Recomendaciones.md` (informative legacy functional spec)
- `docs/audits/BASELINE_CONSTITUTION_AUDIT.md` — `002-strategic-scoring-v2`
- Existing implementation: `src/services/scoring.ts`, `src/domain/scoreExplainCore.ts`, `src/domain/whyNowCore.ts`
- Companion docs: `plan.md`, `tasks.md`, `acceptance.md`, `data-flow.md`, `hexagonal-boundaries.md`, `migration-matrix.md`, `scoring-model.md`
