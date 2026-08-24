# Acceptance 001 — Strategic Signal Routing

**Phase 0B:** criteria defined.  
**Phase 1–4:** domain → application → persistence → call-site migration.  
**Phase 5:** security / governance hardening.  
**Phase 6:** final acceptance + human CODE_COMPLETE sign-off — **APPROVED** (2026-08-23).

Spec **CODE_COMPLETE** requires Required (A\*) full PASS + human sign-off (T-001-604).  
Spec **DONE** requires CODE_COMPLETE + any agreed deploy verification (separate).

**Phase-5 frozen checkpoint:** `057a284a7cea7979beb0e180da208a85b7d72619`  
**Phase-6 evidence re-verified:** 2026-08-23 final pass (docs-only; product code unchanged @ `057a284`).  
**Final automated verification (this session):**  
- `npm run check` → **573/573** (75 test files; typecheck + lint + vitest)  
- `npm run test:rules` → **91/91** (18 storage + 73 firestore emulator)  
- SPEC-001 architecture/security suite → **106/106** (8 files: arch 19 + Phase2–5 87 + thesisRoutingCore 22 — overlap none; total unique SPEC-001 routing tests in dedicated run)

---

## Required (implementation → CODE_COMPLETE)

| # | Criterion | Maps to | Status | Automated evidence | Manual evidence | Checkpoint/source |
|---|-----------|---------|--------|--------------------|-----------------|-------------------|
| A1 | Every production signal routing execution evaluates all eligible ACTIVE theses | Multi-thesis · Eligibility | ✅ PASS | `thesisRoutingCore` + Phase 2/4/5 tests; adapter scores all ACTIVE | — | `057a284` + Phase-6 re-verify |
| A2 | Zero strategic routing call sites use `getPrimaryThesis`, `activeTheses[0]`, `theses[0]`, or `candidates[0]` as implicit strategic selection | Constitution §5 | ✅ PASS | Architecture + Phase 4/5 ban scans; strategic consumers = 0 | Presentation leftovers classified | Phase-6 static scan |
| A3 | DRAFT, UNDER_REVIEW, PAUSED, ARCHIVED, and LEGACY theses are excluded from production strategic routing | Eligibility | ✅ PASS | `thesisRoutingEligibility.ts` ACTIVE-only | — | Domain authoritative |
| A4 | A contested result cannot silently become a final thesis attribution through first/primary fallback | Contested policy | ✅ PASS | Domain: no `selectedThesisId` on CONTESTED; Phase 5 consumer/UI tests | — | `thesisRoutingCore` |
| A5 | Routing persists complete per-thesis scoring evidence plus routing decision/rationale | Explainability | ✅ PASS | Persist path writes `thesisScores` + `routingDecision` | — | Writer + Phase 2/3 |
| A6 | Manual override is explicitly marked MANUAL and auditable | Human override | ✅ PASS | `OverrideSignalThesis` → `source: MANUAL` + actorId + history | Human confirms UI path | Application |
| A7 | `SIGNAL_THESIS_EVAL` remains advisory and cannot replace deterministic routing | AI boundary · SPEC-005 | ✅ PASS | Strategic app free of AI authority; Phase 5 AI boundary test | — | SPEC-005 intact |
| A8 | Domain routing remains infrastructure/framework pure | Hexagonal | ✅ PASS | Domain imports types + eligibility only; architecture tests | — | Phase-6 arch run |
| A9 | Application depends on ports rather than concrete Firestore/db adapters | Hexagonal | ✅ PASS | `strategicSignalRoutingArchitecture.test.ts` | — | Phase-6 arch run |
| A10 | Routing outputs include an algorithm/routing version | Explainability | ✅ PASS | `ROUTING_ALGORITHM_VERSION` on AUTO/MANUAL | — | Domain + Application |
| A11 | Material routing changes preserve history/audit evidence | History | ✅ PASS (local; remote rules deferred) | `routingHistoryCore` + local store; Phase 3/5 history tests | Human notes P2 rules gap | See P2 disposition |
| A12 | Routing alone cannot silently perform an unauthorized terminal DISCARD | Auto-discard governance | ✅ PASS | `applyStrategicRoutingToSignal` no DISCARD; `applyScoreToSignal` unused | — | Phase 5 + Phase-6 scan |
| A13 | Tenant envelope remains consistent with SPEC-009 contracts | Tenant | ✅ PASS | Phase 5 cross-client/org/foreign thesis rejection | — | Application guards |
| A14 | Architecture test prevents primary-thesis strategic regression | Governance | ✅ PASS | SPEC-001 dedicated suite **106/106** (arch + Phase2–5 + domain) | — | Phase-6 final run |
| A15 | Multi-thesis tests cover 1, 2, and N ACTIVE theses | Tests | ✅ PASS | Domain + Phase 2/4/5 suites | — | vitest |
| A16 | Contested + manual override tests PASS | Tests | ✅ PASS | Phase 2/5 MANUAL + CONTESTED | — | vitest |
| A17 | `npm run check` PASS | Governance | ✅ PASS | **573/573** (typecheck + lint + vitest 75 files) | — | Phase-6 final 2026-08-23 |
| A18 | `npm run test:rules` PASS | Governance | ✅ PASS | **91/91** (firestore.rules emulator) | — | Phase-6 final 2026-08-23 |

**Implementation acceptance classification (Phase 6):**

| ID | Classification |
|----|----------------|
| A1–A18 | PASS (implementation evidence in repo) |
| CODE_COMPLETE human (T-001-604) | **APPROVED** |
| D1–D3 | DEPLOYMENT_ONLY / PENDING |

No A19+ added. Append only if implementation proves a genuine gap.

---

## Deploy gates (separate from CODE_COMPLETE)

| # | Criterion | Status |
|---|-----------|--------|
| D1 | Production/hosted verification of multi-thesis routing (if/when product deploy authorized) | ☐ PENDING — **not required for CODE_COMPLETE** |
| D2 | SPEC-009 production deploy/backfill | ☐ DEFERRED — **nonblocking** for 001 CODE_COMPLETE |
| D3 | Spec `DEPLOYED` / `DONE` | ☐ PENDING — separate human authorization |

No manufactured production smoke beyond D1–D3.  
**DEPLOYMENT = NOT STARTED.** These gates must not be marked complete by Phase-6 evidence prep.

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

## T-001 FINAL HUMAN SIGN-OFF PACKAGE

Human approval received via explicit development-workflow authorization (2026-08-23).

| Field | Value |
|-------|--------|
| Phase-5 product checkpoint SHA | `057a284a7cea7979beb0e180da208a85b7d72619` |
| Branch | `spec/001-strategic-signal-routing` |
| Implementation acceptance matrix | A1–A18 = PASS (table above) |
| Security summary | Tenant/cross-org/cross-client/CLIENT override blocked; actor from trusted auth; P0=0 P1=0 |
| Multi-thesis summary | ACTIVE-only N-thesis evaluation; strategic primary/`[0]` consumers = 0 |
| Routing-state summary | CLEAR / CONTESTED / UNROUTED first-class; AUTO / MANUAL source distinct |
| Human-governance summary | `OverrideSignalThesis` ADMIN-only; ACTIVE thesis; tenant-checked |
| History summary | Material transitions append-only local history; timestamp-only not material |
| Tenant summary | Signal/thesis org+client checks; rejection has no write/history side effect |
| Architecture summary | Domain pure; Application ports-only; SPEC-005 gateway/arch tests intact |
| P0 findings | 0 |
| P1 findings | 0 |
| P2 findings | 1 — routing-history Firestore rules contract gap (below) |
| Known deferred | D-001-hist-rules (SPEC-009); D-001-content (other SPEC); T-001-206 optional |
| SPEC-005 dependency | CLEAR / CODE_COMPLETE — advisory `SIGNAL_THESIS_EVAL` only; regression PASS |
| SPEC-009 dependency | Production DEFERRED_UNCHANGED; envelope CODE_AVAILABLE; history rules deferred |
| Deployment gates | D1–D3 PENDING / NOT STARTED |
| **Human decision** | **APPROVED** |
| **HUMAN SIGN-OFF** | **APPROVED** |
| **SPEC-001 IMPLEMENTATION** | **CODE_COMPLETE** |

### P2 disclosure — SPEC-001 SECURITY RULE CONTRACT GAP

| Field | Value |
|-------|--------|
| Finding | Nested `routingHistory` under signals is **not** present in `firestore.rules` |
| Owner | SPEC-009 (cross-SPEC security/rules) + future remote history deploy |
| Reason | SPEC-001 Phase 3 made history **local-authoritative** (`postura_signal_routing_history_v1`); current Signal routing fields sync via existing signals path |
| Acceptance wording | A11 PASS “(local; remote rules deferred)”; CODE_COMPLETE = A1–A18 in-repo, no production required (`spec.md`) |
| Disposition | **NONBLOCKING_DEFERRED** / `DEFERRED_TO_OTHER_SPEC` (debt D-001-hist-rules) |
| CODE_COMPLETE impact | **None** — remote history rules not required by A\* before CODE_COMPLETE |
| Deployment impact | Blocks remote Firestore history sync / D2-related production history until SPEC-009 covers path |
| Deployment impact | Blocks remote Firestore history sync / D2-related production history until SPEC-009 covers path |
| Post-CODE_COMPLETE status | **Remains NONBLOCKING_DEFERRED — not RESOLVED** |

---

## Sign-off

| Role | Date | Result |
|------|------|--------|
| Phase 0 inventory | 2026-08-23 | **COMPLETE** (NEEDS_SPEC_REPAIR → package authored) |
| Phase 0B formal package | 2026-08-23 | **COMPLETE** |
| Human SPEC approver | 2026-08-23 | **APPROVED** (T-001-009) → Phase 1 authorized |
| Phases 1–5 implementation | 2026-08-23 | **COMPLETE** @ `057a284` |
| Phase 6 evidence package | 2026-08-23 | **COMPLETE** |
| CODE_COMPLETE human (T-001-604) | 2026-08-23 | **APPROVED** |

**Current governance state (CODE_COMPLETE — not DONE):**

- **SPEC-001 PHASE 6** = **COMPLETE**
- **T-001-604** = **DONE**
- **HUMAN SIGN-OFF** = **APPROVED**
- **IMPLEMENTATION ACCEPTANCE** = **18/18 PASS**
- **SPEC-001 IMPLEMENTATION** = **CODE_COMPLETE**
- **SPEC-001 DEPLOYED** = **NO**
- **DEPLOYMENT** = **NOT STARTED**
- **Deployment gates D1–D3** = **PENDING** (D2 DEFERRED per existing wording)
- **SPEC-001 DONE** = **NO**
- **P2 routing-history rules** = **NONBLOCKING_DEFERRED** (SPEC-009 owner; not RESOLVED)

**Compatibility persistence patch (2026-08-24, authorized):** `routingDecision.selectedThesisId` is now persisted for CLEAR. Original CODE_COMPLETE checkpoint `4643cad115b4294c2fb04bd15a08d4478cc64039` remains historical evidence. No algorithm change. No production backfill (`LEGACY_CLEAR_ROUTING_RECORDS = MIGRATION_NOT_PERFORMED`).
