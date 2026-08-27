# Acceptance 010 — React migration

**Phase 0:** Formal package **COMPLETE** · Human SPEC approval **PENDING** (T-010-010)
**Phase 1+:** **NOT AUTHORIZED**
**A1-A44:** **6 PASS** · **0 PARTIAL** · **0 FAIL** · **38 PENDING**
**CODE_COMPLETE:** **NO**
**DEPLOYED:** **NO** · **DONE:** **NO** · **DEPLOYMENT:** **NOT_STARTED**

Spec **APPROVED** requires T-010-010 human SPEC approval — **PENDING**.
Spec **CODE_COMPLETE** requires Required (A\*) full PASS + human sign-off (T-010-604) — **NOT STARTED**.

**Human SPEC approval model:** TASK-LEVEL only (T-010-010).
**Human CODE_COMPLETE model:** TASK-LEVEL only (T-010-604).
**Baseline:** SPEC-008 CODE_COMPLETE final freeze `642ae9390700a254fa390ba09a959bab3c37d616`
**Branch:** `spec/010-react-migration`

**Acceptance count = 44.** Derived from the functional, security and migration requirements in `spec.md`
and the boundary rules in `ui-architecture.md` / `hexagonal-boundaries.md`. The count is **not** chosen for
symmetry with other SPECs.

Only criteria provable by Phase-0 governance evidence are marked PASS. Everything requiring
implementation is **PENDING** — no implementation is authorized.

---

## Required (implementation → CODE_COMPLETE)

| # | Criterion | Phase | Status | Evidence target |
|---|-----------|-------|--------|-----------------|
| A1 | Constitutional purpose documented as incremental React strangler UI migration | 0 | ✅ PASS (Phase 0) | `spec.md` + §23/§24/§25/§26 refs |
| A2 | Target stack exact — React · TypeScript · Vite · TanStack Query · React Hook Form · Zod (+ Playwright E2E); no substitution | 0–1 | ✅ PASS (design) | `ui-architecture.md` § target stack |
| A3 | Big-bang rewrite prohibited; strangler is the only sanctioned strategy | 0 | ✅ PASS (design) | §25 + `ui-architecture.md` |
| A4 | Constitutional §24 seven-step order preserved verbatim and mapped to phases | 0 | ✅ PASS (design) | `ui-architecture.md` § migration order |
| A5 | Behavior preserved before architecture improved; business logic not rewritten to suit UI | 1–6 | ⏳ PENDING | `parity-model.md` evidence per wave |
| A6 | UI authority = presentation/intent only; UI write authority remains 0 | 1–6 | ⏳ PENDING | architecture tests per wave |
| A7 | SPEC-010 owns no business-domain aggregate and adds no business lifecycle | 0 | ✅ PASS (design) | `spec.md` § Data Model / State Transitions |
| A8 | React modules import `dbService` directly: **0** | 2–6 | ⏳ PENDING | architecture test, scoped to migrated modules |
| A9 | Canonical read boundary — every React read goes through a query hook → facade/consumer → Application | 1–6 | ⏳ PENDING | `data-flow.md` + architecture tests |
| A10 | Canonical command boundary — React intent → consumer/Application → Domain → Ports → Infrastructure | 1–6 | ⏳ PENDING | architecture + command-equivalence tests |
| A11 | TanStack Query cache is non-authoritative; no strategic decision from cached data | 2–6 | ⏳ PENDING | adversarial tests (T-010-05) |
| A12 | React local/presentation state non-authoritative | 2–6 | ⏳ PENDING | adversarial tests |
| A13 | Form state non-authoritative; Zod UI validation never bypasses Domain gates | 2–6 | ⏳ PENDING | adversarial tests (T-010-18) |
| A14 | Optimistic UI state non-authoritative; failure reconciles to canonical state | 2–6 | ⏳ PENDING | adversarial tests (T-010-06) |
| A15 | Stale cached aggregate never used as mutation authority; caller snapshot authority 0 | 2–6 | ⏳ PENDING | adversarial tests (T-010-07) |
| A16 | Trusted tenant — React cannot establish `organizationId`/`clientId`; caller tenant authority 0 | 1–6 | ⏳ PENDING | adversarial tests (T-010-09) |
| A17 | Trusted actor — React cannot establish `actorUid`/`actorType`/role/HUMAN; caller actor authority 0 | 1–6 | ⏳ PENDING | adversarial tests (T-010-10) |
| A18 | Caller role authority 0 — no admin/manager escalation from UI | 1–6 | ⏳ PENDING | adversarial tests (T-010-11) |
| A19 | Tenant-safe query keys — every key carries trusted tenant scope; no cross-tenant cache bleed | 2–6 | ⏳ PENDING | adversarial tests (T-010-08) |
| A20 | Multi-thesis native — no authoritative `theses[0]`/`primaryThesisId`/`getPrimaryThesis`/score winner | 2–6 | ⏳ PENDING | architecture + adversarial tests (T-010-15) |
| A21 | Presentation defaults explicitly non-authoritative; command carries a confirmed, revalidated id | 2–6 | ⏳ PENDING | AUDIT010-06 closure (T-010-16) |
| A22 | SPEC-001 preserved — React displays routing, owns no routing decision | 2–6 | ⏳ PENDING | boundary tests |
| A23 | SPEC-002 preserved — no scoring formula recreated in components/hooks | 2–6 | ⏳ PENDING | boundary tests (T-010-20) |
| A24 | SPEC-003 preserved — Brief consumed via canonical consumer; no lifecycle duplication | 2–6 | ⏳ PENDING | boundary tests |
| A25 | SPEC-004 preserved — Plan/PlanItem via canonical Application boundary | 2–6 | ⏳ PENDING | boundary tests |
| A26 | SPEC-005 preserved — direct AI provider access from React: **0** | 1–6 | ⏳ PENDING | architecture test (T-010-04) |
| A27 | SPEC-006 preserved — React never verifies claims or authorizes publication | 2–6 | ⏳ PENDING | boundary tests |
| A28 | SPEC-007 preserved — no recreation of OpportunityScore / lifecycle / Materialize | 2–6 | ⏳ PENDING | boundary tests (T-010-21) |
| A29 | SPEC-008 preserved — no auto-approve, no auto-apply, no `feedbackScoringHints`, no auto-rescore | 2–6 | ⏳ PENDING | boundary + adversarial tests (T-010-22) |
| A30 | SPEC010→SPEC008 mutation authority = **0** | 2–6 | ⏳ PENDING | architecture test |
| A31 | SPEC-009 security boundary preserved — auth, tenant isolation, rules contracts unchanged | 1–6 | ⏳ PENDING | rules tests + boundary review |
| A32 | React → canonical store (`Local*Store`) direct write: **0** | 2–6 | ⏳ PENDING | architecture test (T-010-02) |
| A33 | React → Firestore direct write: **0** | 2–6 | ⏳ PENDING | architecture test (T-010-03) |
| A34 | No business logic in hooks — no duplicated scoring/routing/lifecycle/approval logic | 2–6 | ⏳ PENDING | architecture test (T-010-19) |
| A35 | No dual command authority — legacy and React invoke the same canonical command | 2–6 | ⏳ PENDING | command-equivalence tests (T-010-12) |
| A36 | No dual read authority — one declared read source per module | 2–6 | ⏳ PENDING | migration matrix + architecture tests (T-010-13) |
| A37 | Single auth/session authority; React Context projects only | 1–6 | ⏳ PENDING | adversarial tests (T-010-23) |
| A38 | No competing DOM/CSS ownership of a subtree | 1–6 | ⏳ PENDING | mount-boundary tests (T-010-24) |
| A39 | `main.ts` strangler — ceases to be a controller/event bus; shrinks per wave | 1–4 | ⏳ PENDING | line/responsibility evidence per wave (T-010-401) |
| A40 | Component migration matrix complete — a row per UI file, dispositioned | 0 | ✅ PASS (Phase 0) | `migration-matrix.md` (17 files) |
| A41 | Behavioral parity proven per migrated module across all applicable dimensions | 5 | ⏳ PENDING | `parity-model.md` evidence |
| A42 | E2E/parity harness (Playwright) implemented; legacy-vs-React journeys pass | 5 | ⏳ PENDING | Playwright suites |
| A43 | Legacy removed only after parity gate; rollback exercised without data migration | 6 | ⏳ PENDING | parity gate + rollback evidence |
| A44 | Full check + rules regression at CODE_COMPLETE; no unintended regression | 6 | ⏳ PENDING | T-010-602 |

**Acceptance count:** **44** (A1–A44)
**Phase 0 evidence:** **6 PASS** (A1, A2, A3, A4, A7, A40) · **0 PARTIAL** · **0 FAIL** · **38 PENDING**

Phase 0 is governance only, so only design/documentation criteria can pass. No implementation criterion is
claimed.

---

## Deployment separation (D1–D3)

| # | Criterion | Status |
|---|-----------|--------|
| D-A1 | CODE_COMPLETE does not require production deploy | ✅ PASS (design) |
| D-A2 | SPEC-009 production rules unchanged until authorized | ✅ PASS (design) |
| D-A3 | Frontend rollout/rollback separate from Phases 0–6 | ✅ PASS (design) |

---

## Phase 0 exit checklist

| Gate | Status |
|------|--------|
| Formal package complete (11 files) | ✅ |
| Constitutional purpose exact | ✅ |
| Target stack exact (§23) | ✅ |
| §24 seven-step order preserved verbatim | ✅ |
| Big-bang prohibition recorded (§25) | ✅ |
| Strangler seam formalized | ✅ |
| Authority model formalized | ✅ |
| UI owns presentation only | ✅ |
| Data-access seam formalized | ✅ |
| `dbService` direct-read migration strategy explicit | ✅ |
| `main.ts` decomposition explicit | ✅ |
| Query authority model explicit | ✅ |
| TanStack cache non-authoritative | ✅ |
| Command boundary explicit | ✅ |
| Trusted tenant explicit | ✅ |
| Trusted actor explicit | ✅ |
| Multi-thesis explicit | ✅ |
| First-selection defaults non-authoritative | ✅ |
| SPEC-001…009 boundaries explicit | ✅ |
| SPEC008 mutation authority target 0 | ✅ |
| Component inventory complete (17 UI files) | ✅ |
| Migration matrix complete | ✅ |
| Behavior parity model complete | ✅ |
| Legacy deletion gate complete | ✅ |
| Playwright/E2E strategy complete | ✅ |
| Side-effect ordering audit strategy complete | ✅ |
| Rollback model complete | ✅ |
| Acceptance complete (44) | ✅ |
| Threat model complete (26) | ✅ |
| Tasks complete | ✅ |
| Deployment separation complete | ✅ |
| Human T-010-010 | **PENDING** |
| Phase-1 authorization | **NO** |
| Product files changed | **0** |
| Test files changed | **0** |
| Dependency files changed | **0** |
| SPEC-001…009 modifications | **0** |

**PHASE-0 DESIGN BLOCKERS:** **0**
**RUNTIME P0:** **0** · **RUNTIME P1:** **0** · **P2:** 4 · **P3:** 4

---

## Human SPEC approval (T-010-010) — REQUIRED

| Field | Value |
|-------|--------|
| **Task** | T-010-010 |
| **Title** | Human SPEC-010 approval |
| **Status** | **TODO · PENDING HUMAN** |
| **Classification** | HUMAN |
| **Authorization text** | «Apruebo formalmente SPEC-010 — React migration y autorizo el cierre de T-010-010 y el inicio de la Phase 1 de implementación.» |

No automation may write this statement, infer it, or mark T-010-010 DONE.

## Human CODE_COMPLETE (T-010-604) — FUTURE

| Field | Value |
|-------|--------|
| **Task** | T-010-604 |
| **Status** | **TODO** |
| **Authorization text** | «Apruebo formalmente el CODE_COMPLETE de SPEC-010 — React migration y autorizo el cierre de T-010-604.» |

Required (A\*) criteria must be **PASS** before T-010-604 may close.
