# Acceptance 002 — Strategic Scoring V2

**Phase 0B:** criteria defined.  
**Phase 1:** Domain contracts implemented (partial acceptance advance).  
**Phase 2–6:** not started.

Spec **CODE_COMPLETE** requires Required (A\*) full PASS + human sign-off (Phase 6).  
Spec **DONE** requires CODE_COMPLETE + any agreed deploy verification (separate).

**Implementation baseline:** SPEC-001 CODE_COMPLETE @ `057a284`; governance @ `4643cad`.

---

## Required (implementation → CODE_COMPLETE)

| # | Criterion | Maps to | Status |
|---|-----------|---------|--------|
| A1 | Same material inputs + `scoringVersion` produce same material score | Determinism | ✅ Phase 1 — `tests/scoringCore.test.ts` |
| A2 | Single canonical deterministic algorithm used by all strategic scoring execution paths | Parity | ☐ Partial — client Domain core + service wrapper; cloud Phase 4 |
| A3 | Scoring consumes SPEC-001 routing context; does not independently select/route thesis | SPEC-001 contract | ☐ Phase 2+ |
| A4 | Zero strategic scoring path uses first/primary thesis shortcuts | Multi-thesis | ☐ Phase 4/5 |
| A5 | Required eligible thesis evidence from SPEC-001 remains preserved | Evidence | ☐ Phase 2+ |
| A6 | CLEAR scoring respects selected routed thesis | CLEAR | ☐ Phase 2+ |
| A7 | CONTESTED cannot silently become single-thesis downstream context | CONTESTED | ☐ Phase 2+ |
| A8 | UNROUTED cannot fabricate thesis context | UNROUTED | ☐ Phase 2+ |
| A9 | Every material score result records `scoringVersion` | Versioning | ✅ Phase 1 — `SCORING_VERSION` / `scoring-v1` |
| A10 | Score explainability reconstructs factors, penalties, total | Explainability | ✅ Phase 1 — `scoreExplainCore` + reconstruction tests |
| A11 | Strategic disposition and output/content format are separate contracts | Disposition split | ✅ Phase 1 — `dispositionCore.ts` + tests |
| A12 | Scoring persistence alone cannot silently perform terminal DISCARD | Auto-discard | ☐ Phase 2/4 |
| A13 | Cloud and client paths use same canonical formula/version or explicitly versioned approved divergence | Parity | ☐ Phase 4+ |
| A14 | Legacy `applyScoreToSignal` is not an active governed strategic scoring path | Legacy | ☐ Phase 4+ |
| A15 | Score history preserves material scoring transitions | History | ☐ Phase 3+ |
| A16 | Tenant mismatch at scoring persistence boundary is rejected | Tenant | ☐ Phase 3+ |
| A17 | AI remains advisory; deterministic score remains authoritative | SPEC-005 boundary | ☐ Phase 2+ |
| A18 | Domain scoring is infrastructure/framework pure | Hexagonal | ✅ Phase 1 — `tests/scoringArchitecture.test.ts` |
| A19 | Application depends on ports rather than concrete persistence | Hexagonal | ☐ Phase 2+ |
| A20 | No duplicate score history for timestamp-only equivalent re-score | Idempotency | ☐ Phase 3+ |
| A21 | SPEC-001 frozen routing regression remains PASS | Regression | ☐ Phase 5+ |
| A22 | SPEC-005 frozen Gateway regression remains PASS | Regression | ☐ Phase 5+ |
| A23 | `npm run check` PASS | Governance | ☐ Phase 6 |
| A24 | `npm run test:rules` PASS | Governance | ☐ Phase 6 |

No A25+ added in Phase 0B unless implementation proves a genuine gap.

---

## Deploy gates (separate from CODE_COMPLETE)

| # | Criterion | Status |
|---|-----------|--------|
| D1 | Production/hosted verification of cloud scoring parity (if/when deploy authorized) | ☐ PENDING — not required for CODE_COMPLETE |
| D2 | Cloud Functions deploy with consolidated scorer (if/when authorized) | ☐ PENDING |
| D3 | Spec `DEPLOYED` / `DONE` | ☐ PENDING — separate human authorization |

---

## Phase 0B evidence (documentation)

| Item | Status |
|------|--------|
| Problem / goal / non-goals | ✅ `spec.md` |
| Routing consumption + states | ✅ `spec.md` |
| Baseline formula + bands | ✅ `scoring-model.md` |
| Disposition vs format | ✅ `spec.md` + `scoring-model.md` |
| Data flows | ✅ `data-flow.md` |
| Hexagonal boundaries | ✅ `hexagonal-boundaries.md` |
| Migration matrix | ✅ `migration-matrix.md` |
| Tasks / phases | ✅ `tasks.md` / `plan.md` |

---

## Sign-off

| Role | Date | Result |
|------|------|--------|
| Phase 0 inventory | 2026-08-23 | **COMPLETE** |
| Phase 0B formal package | 2026-08-23 | **COMPLETE** (docs authored) |
| Human SPEC approver | 2026-08-23 | ✅ **APPROVED** (T-002-010) |
| CODE_COMPLETE human | | ☐ (Phase 6) |

**Current:** `APPROVED` · Phase 1 **COMPLETE** · Phase 2 **NOT STARTED**
