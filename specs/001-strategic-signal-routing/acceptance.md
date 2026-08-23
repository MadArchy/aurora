# Acceptance 001 — Strategic Signal Routing

**Phase 0B:** criteria defined — **none marked PASS for implementation** until coded and evidenced.

Spec **CODE_COMPLETE** requires Required (A\*) PASS + human sign-off.  
Spec **DONE** requires CODE_COMPLETE + any agreed deploy verification (separate).

---

## Required (implementation → CODE_COMPLETE)

| # | Criterion | Maps to | Phase 0B |
|---|-----------|---------|----------|
| A1 | Every production signal routing execution evaluates all eligible ACTIVE theses | Multi-thesis · Eligibility | ☐ |
| A2 | Zero strategic routing call sites use `getPrimaryThesis`, `activeTheses[0]`, `theses[0]`, or `candidates[0]` as implicit strategic selection | Constitution §5 | ☐ |
| A3 | DRAFT, UNDER_REVIEW, PAUSED, ARCHIVED, and LEGACY theses are excluded from production strategic routing | Eligibility | ☐ |
| A4 | A contested result cannot silently become a final thesis attribution through first/primary fallback | Contested policy | ☐ |
| A5 | Routing persists complete per-thesis scoring evidence plus routing decision/rationale | Explainability | ☐ |
| A6 | Manual override is explicitly marked MANUAL and auditable | Human override | ☐ |
| A7 | `SIGNAL_THESIS_EVAL` remains advisory and cannot replace deterministic routing | AI boundary · SPEC-005 | ☐ |
| A8 | Domain routing remains infrastructure/framework pure | Hexagonal | ☐ |
| A9 | Application depends on ports rather than concrete Firestore/db adapters | Hexagonal | ☐ |
| A10 | Routing outputs include an algorithm/routing version | Explainability | ☐ |
| A11 | Material routing changes preserve history/audit evidence | History | ☐ |
| A12 | Routing alone cannot silently perform an unauthorized terminal DISCARD | Auto-discard governance | ☐ |
| A13 | Tenant envelope remains consistent with SPEC-009 contracts | Tenant | ☐ |
| A14 | Architecture test prevents primary-thesis strategic regression | Governance | ☐ |
| A15 | Multi-thesis tests cover 1, 2, and N ACTIVE theses | Tests | ☐ |
| A16 | Contested + manual override tests PASS | Tests | ☐ |
| A17 | `npm run check` PASS | Governance | ☐ |
| A18 | `npm run test:rules` PASS | Governance | ☐ |

No A19+ added in Phase 0B (avoid inflation). Append only if implementation proves a genuine gap.

---

## Deploy gates (separate from CODE_COMPLETE)

| # | Criterion | Status |
|---|-----------|--------|
| D1 | Production/hosted verification of multi-thesis routing (if/when product deploy authorized) | ☐ PENDING — **not required for CODE_COMPLETE** |
| D2 | SPEC-009 production deploy/backfill | ☐ DEFERRED — **nonblocking** for 001 CODE_COMPLETE |
| D3 | Spec `DEPLOYED` / `DONE` | ☐ PENDING — separate human authorization |

No manufactured production smoke beyond D1–D3.

---

## Phase 0 evidence (documentation)

| Item | Status |
|------|--------|
| Problem / goal / non-goals | ✅ `spec.md` |
| Contested + MANUAL + discard policies | ✅ `spec.md` |
| Data flows | ✅ `data-flow.md` |
| Hexagonal boundaries | ✅ `hexagonal-boundaries.md` |
| Migration matrix | ✅ `migration-matrix.md` |
| Tasks / phases | ✅ `tasks.md` / `plan.md` |

---

## Sign-off

| Role | Date | Result |
|------|------|--------|
| Phase 0 inventory | 2026-08-23 | **COMPLETE** (NEEDS_SPEC_REPAIR → package authored) |
| Phase 0B formal package | 2026-08-23 | **COMPLETE** |
| Human SPEC approver | 2026-08-23 | **APPROVED** (T-001-009) → Phase 1 authorized |
| CODE_COMPLETE human | | ☐ (Phase 6) |

**Current:** `APPROVED` · `READY_FOR_IMPLEMENTATION`  
**Phase 1:** AUTHORIZED · **not complete** · CODE_COMPLETE = NO.
