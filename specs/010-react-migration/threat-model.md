# Threat model 010 — React migration

**Phase 0 formal threats.** Implementation and adversarial proof: **NOT STARTED** (Phase 5).

Constitution: UI = intent/display only · AI advisory · human-in-the-loop · tenant isolation ·
multi-thesis native · strangler only.

Baseline: SPEC-008 frozen @ `642ae9390700a254fa390ba09a959bab3c37d616`

**Threat count = 26 (T-010-01 … T-010-26).** Every threat derives from a real risk of introducing a
presentation layer over governed domains. No filler threats.

---

## Assets

| Asset | Sensitivity |
|-------|-------------|
| Canonical strategic state (SPEC-001…008) | Highest — authority must not migrate to UI |
| Trusted tenant identity | Cross-tenant exposure |
| Trusted actor identity | False audit identity / privilege escalation |
| Human approval gates (SPEC-006/008) | Governance bypass |
| Query cache contents | Cross-tenant bleed |
| Session/auth state | Authentication bypass |
| Legacy behavior contract | Silent capability loss during migration |

## Trust boundaries

| Boundary | Trusted? |
|----------|----------|
| React component / hook | **NO** |
| Query cache | **NO** |
| Form input (incl. Zod-valid) | **NO** |
| URL / query parameters | **NO** |
| Canonical consumer | orchestration only |
| Application / Domain | **YES** |
| SPEC-009 auth runtime | **YES** (source of trusted context) |

---

## Formal threats

| ID | Threat | Attack | Required defense | Acceptance | Phase |
|----|--------|--------|------------------|------------|-------|
| **T-010-01** | React direct `dbService` strategic write | component/hook calls a `dbService` mutator | architecture test: 0 `dbService` imports in React modules; commands only via consumers | A8, A10 | 2–5 |
| **T-010-02** | React direct canonical-store write | component imports a `Local*Store` and writes | architecture test: 0 store imports in React | A32 | 2–5 |
| **T-010-03** | React direct Firestore write | component imports Firestore SDK and writes | architecture test: 0 Firestore imports in React | A33 | 2–5 |
| **T-010-04** | React direct AI provider call | component calls an OpenAI/Anthropic endpoint or SDK | architecture test: 0 provider imports/endpoints; SPEC-005 gateway only | A26 | 1–5 |
| **T-010-05** | Query cache treated as authority | strategic decision made from `query.data` | cache declared non-authoritative; commands send id/version, Application reloads | A11 | 2–5 |
| **T-010-06** | Optimistic state becomes authority | optimistic update treated as committed approval/publication | optimistic state presentation-only; failure reconciles to canonical | A14 | 2–5 |
| **T-010-07** | Stale cached aggregate drives mutation | command built from a stale cached entity | canonical id/version only; Domain revalidates; caller snapshot authority 0 | A15 | 2–5 |
| **T-010-08** | Cross-tenant query cache bleed | same entity id in two orgs shares a cache entry | every query key carries trusted tenant scope | A19 | 2–5 |
| **T-010-09** | Caller tenant spoof | React supplies `organizationId`/`clientId` from form/URL | trusted tenant from auth runtime; UI selection revalidated | A16 | 1–5 |
| **T-010-10** | Caller actor spoof | React supplies `actorUid`/`createdBy`/`actorType` | trusted actor from auth runtime; caller values ignored | A17 | 1–5 |
| **T-010-11** | Caller role spoof | React claims admin/manager/HUMAN | role from trusted runtime only | A18 | 1–5 |
| **T-010-12** | Dual command authority | React reimplements a command instead of calling the canonical one | both UIs invoke the identical use case; command-equivalence tests | A35 | 2–5 |
| **T-010-13** | Divergent read authority | React cache and `dbService` treated as competing truth | one declared read source per module; compatibility reads labelled | A36 | 2–5 |
| **T-010-14** | UI approval spoof | React marks a recommendation/claim approved by assigning status | no status assignment in React; human gate in Domain | A6, A29 | 2–5 |
| **T-010-15** | First-thesis fallback becomes authority | React uses `theses[0]`/primary as strategic scope | explicit thesis scope; 0 authoritative first-thesis paths | A20 | 2–5 |
| **T-010-16** | First-Brief default becomes authority | `approvedBriefs[0]` default submitted as the authoritative brief | command carries a user-confirmed id; Application revalidates | A21 | 2–5 |
| **T-010-17** | Duplicated lifecycle logic | React recomputes allowed transitions | lifecycle only in owning Domain; architecture test | A34 | 2–5 |
| **T-010-18** | Form validation bypasses Domain | Zod-valid form treated as authorized | UI validation ≠ Domain validation; all gates re-enforced | A13 | 2–5 |
| **T-010-19** | Business logic in hooks | hook duplicates scoring/routing/approval logic | hooks orchestrate UI only; symbol/formula checks | A34 | 2–5 |
| **T-010-20** | Duplicated scoring logic | React recreates Strategic Score | display only; SPEC-002 authoritative | A23 | 2–5 |
| **T-010-21** | Duplicated Opportunity logic | React recreates OpportunityScore/lifecycle/Materialize | canonical consumer only | A28 | 2–5 |
| **T-010-22** | Duplicated Learning approval logic | React auto-approves/applies, or revives `feedbackScoringHints` / auto-rescore | SPEC-008 frozen boundary; mutation authority 0 | A29, A30 | 2–5 |
| **T-010-23** | Auth/session dual authority | React Context becomes a second auth source | one trusted session source; Context projects only | A37 | 1–5 |
| **T-010-24** | CSS / DOM ownership collision | legacy and React both own a subtree; styles corrupt each other | one owner per subtree; declared mount boundaries; error boundary | A38 | 1–5 |
| **T-010-25** | Side-effect before gate | effect executes before authorization/validation | per-path gate→effect audit before migrating that path | A5, A39 | 4–5 |
| **T-010-26** | Legacy deletion before parity / destructive rollback | legacy removed without equivalence, or rollback mutates canonical state | parity gate (8 conditions); rollback switches presentation only | A43 | 6 |

**Additional constitutional threat, permanently enforced:**
big-bang migration itself (§25) — mitigated structurally by the wave model and the parity gate, and
asserted by A3/A4.

---

## Severity model

| Severity | Meaning |
|----------|---------|
| **P0** | constitutional/security blocker |
| **P1** | major authority/integrity risk |
| **P2** | material architecture/migration issue |
| **P3** | cleanup / nonblocking debt |

**Phase-0 status:** P0 **0** · P1 **0** · P2 **4** (AUDIT010-01…04, with -01 resolved by this package) ·
P3 **4** (AUDIT010-05…08).

**Phase-1 status:** P0 **0** · P1 **0** · P2 **3** · P3 **5** (AUDIT010-02 closed as foundation
implemented; AUDIT010-09 opened at P3).

---

## Phase-1 threat status

Phase 1 built the foundation, so foundation-scoped threats have real defensive evidence while every threat
whose surface arrives with later page migrations, dual authority, full parity or legacy removal stays
PARTIAL or PENDING. **No threat is declared PASS on the strength of a Phase-1 foundation alone**, because
adversarial proof is Phase 5 (T-010-501…510).

`ARCH` = `tests/reactMigrationPhase1Architecture.test.ts` (27/27) · `E2E` = `e2e/strangler-foundation.spec.ts` (5/5).

| ID | Phase-1 status | Evidence / why not higher |
|----|----------------|---------------------------|
| T-010-01 | ⚠️ PARTIAL | `ARCH`: 0 `dbService` imports in `src/ui/**` beyond the declared facade, which exposes no mutator. Adversarial proof T-010-503 |
| T-010-02 | ⚠️ PARTIAL | `ARCH`: 0 store/infrastructure imports. T-010-503 |
| T-010-03 | ⚠️ PARTIAL | `ARCH`: 0 Firestore imports. T-010-503 |
| T-010-04 | ⚠️ PARTIAL | `ARCH`: 0 provider imports/endpoints. T-010-503 |
| T-010-05 | ⚠️ PARTIAL | `staleTime: 0`, cache labelled non-authoritative. T-010-502 |
| T-010-06 | ⚠️ PARTIAL | `ARCH`: 0 optimistic mutations exist. T-010-502 |
| T-010-07 | ⚠️ PARTIAL | No wave-1 command consumes a cached aggregate. T-010-502 |
| T-010-08 | ⚠️ PARTIAL | `ARCH`: every key carries trusted tenant scope; no bare key. Runtime bleed test T-010-502 |
| T-010-09 | ⚠️ PARTIAL | Branded scope, sole constructor takes trusted `User`, fail-closed. T-010-501 |
| T-010-10 | ⚠️ PARTIAL | Setter-free projection; no actor literal. T-010-501 |
| T-010-11 | ⚠️ PARTIAL | `ARCH`: no role/admin literal assignment. T-010-501 |
| T-010-12 | ⚠️ PARTIAL | Both logins invoke the same `authService.login`. T-010-506 |
| T-010-13 | ⚠️ PARTIAL | One read source per hook, provenance embedded in the cache key. T-010-506 |
| T-010-14 | ⚠️ PARTIAL | `ARCH`: no lifecycle-status assignment in `src/ui/**`. T-010-504 |
| T-010-15 | ⚠️ PARTIAL | `ARCH`: no first/primary-thesis pattern; selector defaults to explicit "all". T-010-507 |
| T-010-16 | ⏳ PENDING | `Modals.ts` not migrated (T-010-302) |
| T-010-17 | ⏳ PENDING | no lifecycle surface migrated |
| T-010-18 | ⚠️ PARTIAL | `ReactLogin`: Zod checks shape only; trusted auth decides. T-010-501 |
| T-010-19 | ⚠️ PARTIAL | `ARCH`: no business symbol in hooks. T-010-505 |
| T-010-20 | ⏳ PENDING | no scoring surface migrated |
| T-010-21 | ⏳ PENDING | no Opportunity surface migrated beyond a canonical read |
| T-010-22 | ⏳ PENDING | no Learning surface migrated |
| T-010-23 | ⚠️ PARTIAL | Single `authService` source; Context projects only. T-010-506 |
| T-010-24 | ⚠️ PARTIAL | `ARCH` + `E2E`: exclusive sibling ownership, never both visible, no cross-nesting, clean unmount. Re-proved per wave |
| T-010-25 | ⚠️ PARTIAL | 3 wave-1 paths audited, all `GATE_FIRST`; only those migrated. Remaining `main.ts` paths unaudited — T-010-401 |
| T-010-26 | ⚠️ PARTIAL | `E2E`: rollback leaves business storage byte-identical; 0 legacy removed. Full proof T-010-508 |

**Threat status at Phase-1 exit:** **0 PASS / 19 PARTIAL / 0 FAIL / 7 PENDING**

| Milestone | PASS | PARTIAL | FAIL | PENDING |
|-----------|------|---------|------|---------|
| Phase 0 exit | 0 | 0 | 0 | 26 |
| **Phase 1 exit** | **0** | **19** | **0** | **7** |

No new constitutional or security blocker was found: **P0 = 0**, **P1 = 0**.

---

## Highest-risk threats for early waves

| Threat | Why early |
|--------|-----------|
| T-010-24 (DOM/CSS ownership) | materializes the moment the first React island mounts (W1) |
| T-010-23 (auth dual authority) | the shell projects session in W1 |
| T-010-09/10/11 (caller spoof) | the first command hook in W1/W2 |
| T-010-08 (cache bleed) | the first query key in W1/W2 |
| T-010-13 (divergent reads) | the first compatibility read facade in W1 |

These must be covered by tests from the first wave, not deferred to Phase 5.
