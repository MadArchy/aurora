# Threat model 010 — React migration

**Phase 0 formal threats.** Defensive evidence through Phase 3 (all 26 PARTIAL).
Adversarial proof: **NOT STARTED** (Phase 5) — **0 PASS**.

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

---

## Phase-2 threat status

Phase 2 extracted nine bounded components carrying real reads and, for five
actions, real canonical commands. That turns several statically-argued controls
into controls with an exercised code path, and it opens three threats that could
not previously be assessed at all because no lifecycle, Opportunity or Learning
surface existed in React.

**No threat is declared PASS.** Adversarial proof is Phase 5 (T-010-501…510),
and every migrated surface is still coexisting rather than cut over, so the
Phase-2 evidence is defensive, not exhaustive.

`ARCH2` = `tests/reactMigrationPhase2Architecture.test.ts` (34/34) ·
`W2` = `tests/reactMigrationPhase2Wave2.test.ts` (18/18) ·
`E2E2` = `e2e/wave2-components.spec.ts` (5/5).

| ID | Phase-1 | **Phase-2** | Phase-2 evidence |
|----|---------|-------------|------------------|
| T-010-01 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH2`: 9 components + all hooks import **0** `dbService`; the facade is still the only importer in `src/ui/**` and exports only `read*` |
| T-010-02 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH2`: 0 store/infrastructure imports across wave 2 |
| T-010-03 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH2`: 0 Firestore imports across wave 2 |
| T-010-04 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH2`: 0 provider imports/endpoints across wave 2 |
| T-010-05 | ⚠️ PARTIAL | ⚠️ PARTIAL | Cache still `staleTime: 0`; every wave-2 read is a projection, none is a decision input |
| T-010-06 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH2`: wave 2 uses `invalidateQueries` and **never** `setQueryData` — 0 optimistic business mutations |
| T-010-07 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH2` + `W2`: commands accept ids and notes only; no projection type or forged snapshot can cross the seam |
| T-010-08 | ⚠️ PARTIAL | ⚠️ PARTIAL | `W2`: runtime proof that two organizations, two clients, and canonical-vs-compatibility never share a key; invalidation is tenant- and source-scoped |
| T-010-09 | ⚠️ PARTIAL | ⚠️ PARTIAL | `W2`: commands carry the trusted scope as claimed identity; a scope with no client fails closed instead of guessing |
| T-010-10 | ⚠️ PARTIAL | ⚠️ PARTIAL | `W2`: no command sends `actorType`, `role`, `actorUid` or `createdBy` |
| T-010-11 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH2`: no privilege-role literal in any wave-2 component |
| T-010-12 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH2`: no component imports a consumer directly; every command goes through the one seam |
| T-010-13 | ⚠️ PARTIAL | ⚠️ PARTIAL | Each of the 6 wave-2 hooks declares exactly one read source, carried in the key |
| T-010-14 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH2`: no component assigns a canonical status; `canSubmit` is supplied by the canonical facade |
| T-010-15 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH2`: no `theses[0]`, `primaryThesisId`, `approvedBriefs[0]` or `sort()[0]`; the spotlight is labelled `DISPLAY_ONLY` and reuses the same card |
| T-010-16 | ⏳ PENDING | ⏳ PENDING | `Modals.ts` still not migrated (T-010-302) |
| T-010-17 | ⏳ PENDING | ⚠️ **PARTIAL** | A lifecycle surface now exists in React. `ARCH2`: no transition is recomputed — accept/decline/submit go to the owning consumer, which re-validates |
| T-010-18 | ⚠️ PARTIAL | ⚠️ PARTIAL | `W2`: the decline-notes check is an input guard; the canonical consumer still rules and can refuse |
| T-010-19 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH2`: no component calls `computeProfileCoverage`, `aggregateWeeklyKpis`, `isCleOpportunity` or `daysUntilDeadline` — all run inside the facades |
| T-010-20 | ⏳ PENDING | ⏳ PENDING | no scoring surface migrated |
| T-010-21 | ⏳ PENDING | ⚠️ **PARTIAL** | Opportunity surface migrated through the canonical consumer only; `W2` proves the four commands reach it with trusted scope and no forged input |
| T-010-22 | ⏳ PENDING | ⚠️ **PARTIAL** | Learning surface limited to the canonical `registerResultRecordIntent`; **0** auto-approve, **0** auto-apply, **0** `feedbackScoringHints`, **0** rescore |
| T-010-23 | ⚠️ PARTIAL | ⚠️ PARTIAL | Session still projected from the single `authService`; wave 2 adds no second source |
| T-010-24 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH2` + `E2E2`: 8 new components added **0** DOM roots; no `getElementById`/`createRoot`/`document.body` outside the mount seam; no cross-nesting |
| T-010-25 | ⚠️ PARTIAL | ⚠️ PARTIAL | 5 further command paths audited, all `GATE_FIRST`; **0** `EFFECT_FIRST` migrated, **0** `UNKNOWN` migrated |
| T-010-26 | ⚠️ PARTIAL | ⚠️ PARTIAL | `E2E2`: rollback after loading wave 2 leaves business storage byte-identical; 0 legacy removed |

**Threat status at Phase-2 exit:** **0 PASS / 24 PARTIAL / 0 FAIL / 2 PENDING**
(row-counted; see the tally reconciliation in the Phase-3 section below)

| Milestone | PASS | PARTIAL | FAIL | PENDING |
|-----------|------|---------|------|---------|
| Phase 0 exit | 0 | 0 | 0 | 26 |
| Phase 1 exit | 0 | 21 | 0 | 5 |
| **Phase 2 exit** | **0** | **24** | **0** | **2** |

---

## Phase-3 threat status

Phase 3 migrated five pages. Every one is HYBRID: presentation and reads in
React, most business commands retained in legacy because AUDIT010-09 blocks
them. That shape matters for the threat model in a specific way — the threats
about *React performing a business write* are argued not only by architecture
assertion but by the absence of the write path altogether, while the threats
about *React displaying a business decision it did not make* now have real
surfaces to be tested against.

**No threat is declared PASS.** Adversarial proof is Phase 5 (T-010-501…510).

`ARCH3` = `tests/reactMigrationPhase3Architecture.test.ts` (28/28) ·
`P3` = `tests/reactMigrationPhase3Pages.test.ts` (19/19) ·
`E2E3` = `e2e/wave3-pages.spec.ts` (6/6).

### Tally reconciliation (governance finding, documentation-only)

The Phase-1 and Phase-2 threat summary lines disagreed with their own tables:
each table's rows counted two more PARTIAL and two fewer PENDING than the
summary beneath it. The rows are the evidence, so the rows win; the summaries
above have been corrected to match, and no threat's actual status changed. The
drift is recorded as a **P3 documentation defect** rather than silently absorbed,
because a governance tally that nobody reconciles is exactly how an unproven
control gets counted as proven. Phase-3 numbers below are row-counted.

| ID | Phase-2 | **Phase-3** | Phase-3 evidence |
|----|---------|-------------|------------------|
| T-010-01 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH3`: 5 pages, 7 modals, `LegacyHandoff` and `useWave3Data` import **0** `dbService`; the facade is still the only importer in `src/ui/**` and exports only `read*` |
| T-010-02 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH3`: 0 `Local*Store` / infrastructure imports across wave 3 |
| T-010-03 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH3`: 0 Firestore imports across wave 3 |
| T-010-04 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH3`: 0 provider imports across wave 3, asserted against `import` statements so that a field named `openaiOutput` cannot pass as a provider call and a real import cannot hide behind one |
| T-010-05 | ⚠️ PARTIAL | ⚠️ PARTIAL | Cache still `staleTime: 0`; all 14 wave-3 reads are projections. The two migrated commands take ids, so no cached object can be the authority |
| T-010-06 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH3`: wave 3 uses `invalidateQueries` only, **never** `setQueryData` — 0 optimistic business mutations |
| T-010-07 | ⚠️ PARTIAL | ⚠️ PARTIAL | `P3`: both commands forward ids only. Brief *creation* was left unmigrated **because** its canonical signature demands the whole `CurationEntry` aggregate — the threat was allowed to block a migration rather than be worked around |
| T-010-08 | ⚠️ PARTIAL | ⚠️ PARTIAL | `P3`: all 14 wave-3 keys proven tenant-scoped and collision-free across organizations, clients, read sources and thesis ids |
| T-010-09 | ⚠️ PARTIAL | ⚠️ PARTIAL | `P3`: a scope with no client fails closed on both commands instead of defaulting |
| T-010-10 | ⚠️ PARTIAL | ⚠️ PARTIAL | `P3`: no wave-3 command sends `actorType`, `role`, `actorUid` or `createdBy`; `ARCH3` bans identity literals in pages |
| T-010-11 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH3`: no privilege-role literal in any wave-3 page. Manager-only surfaces are gated by the shell's trusted session, not by a page-side role string |
| T-010-12 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH3`: no page imports a consumer or an Application module; both commands go through the one seam |
| T-010-13 | ⚠️ PARTIAL | ⚠️ PARTIAL | Each of the 14 wave-3 hooks declares exactly one read source, carried in the key |
| T-010-14 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH3`: no page assigns `APPROVED`/`PUBLISHED`/`COMPLETED`/`APPLIED`. The assertion distinguishes an assignment from a comparison, so displaying a status stays legal and setting one does not |
| T-010-15 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH3`: no `theses[0]`, `primaryThesisId` or `sort()[0]` in wave 3. The cockpit row that legacy rendered from `getActiveTheses(id)[0]` now shows the count and every title |
| T-010-16 | ⏳ PENDING | ⚠️ **PARTIAL** | `Modals.ts` migrated. The legacy generate-content modal pre-selects `approvedBriefs[0]`, biasing the manager whenever several briefs are approved; the React selector starts empty and `P3` proves the brief list carries no default marker |
| T-010-17 | ⚠️ PARTIAL | ⚠️ PARTIAL | Brief approval added: the page forwards ids and SPEC-003 rules on the transition; `P3` proves a canonical refusal surfaces rather than being swallowed |
| T-010-18 | ⚠️ PARTIAL | ⚠️ PARTIAL | `P3`: the thesis-review schema validates shape only — it accepts an empty rationale and rejects nothing a domain rule would own |
| T-010-19 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH3`: no page computes a score, a verdict or a transition; derivations run inside the facades using the existing domain functions |
| T-010-20 | ⏳ PENDING | ⚠️ **PARTIAL** | A scoring surface now exists in React (radar relevance, thesis strength, opportunity score). `ARCH3` asserts **0** score functions and **0** weight arithmetic in any page — every number is a projected value |
| T-010-21 | ⚠️ PARTIAL | ⚠️ PARTIAL | Opportunity surface reachable from the portal page, still via the canonical consumer only |
| T-010-22 | ⚠️ PARTIAL | ⚠️ PARTIAL | Learning surface extended by the canonical signal-outcome *intent*; **0** auto-approve, **0** auto-apply, **0** `feedbackScoringHints`, **0** rescore |
| T-010-23 | ⚠️ PARTIAL | ⚠️ PARTIAL | Session still projected from the single `authService`; `E2E3` proves no wave-3 page renders without a trusted session |
| T-010-24 | ⚠️ PARTIAL | ⚠️ PARTIAL | `ARCH3` + `E2E3`: 9 wave-3 surfaces added **0** DOM roots, and a tab owned by a wave-3 page does not additionally render its wave-2 group |
| T-010-25 | ⚠️ PARTIAL | ⚠️ PARTIAL | All wave-3 command paths audited. Two `EFFECT_FIRST` paths found — `renderRecommendedSources` and `renderDiscoveryPanel` both run `runSourceDiscoveryAgent` while rendering — and both deliberately left legacy. **0** `EFFECT_FIRST` migrated, **0** `UNKNOWN` migrated |
| T-010-26 | ⚠️ PARTIAL | ⚠️ PARTIAL | `E2E3`: rollback after loading wave 3 leaves business storage byte-identical; 0 legacy removed |

**Threat status at Phase-3 exit:** **0 PASS / 26 PARTIAL / 0 FAIL / 0 PENDING**

| Milestone | PASS | PARTIAL | FAIL | PENDING |
|-----------|------|---------|------|---------|
| Phase 2 exit | 0 | 24 | 0 | 2 |
| **Phase 3 exit** | **0** | **26** | **0** | **0** |

Every threat now has at least defensive evidence, and none has adversarial
evidence. PENDING reaching 0 is therefore not a milestone worth much: it says the
surfaces exist, not that they withstand attack. PASS remains 0 until Phase 5.

**Phase-3 severity:** P0 **0** · P1 **0** · P2 **3** · P3 **7** (AUDIT010-09
extended from 10 to 34 registered commands — same finding, wider inventory,
unchanged severity; plus the tally-drift defect above and the
`CANONICAL_CONSUMER_REQUIRES_CALLER_AGGREGATE` blocker on brief creation).

---

**Phase-2 severity:** P0 **0** · P1 **0** · P2 **3** · P3 **5** (AUDIT010-09 extended
from 1 to 10 registered commands — same finding, wider inventory, unchanged
severity; see `audit010-09-registry.md`).

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
