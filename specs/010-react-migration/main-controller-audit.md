# `main.ts` controller audit — SPEC-010 T-010-401

**Phase:** 4 (§24 step 5 — *Extraer lógica de UI de servicios de dominio*)
**Subject:** `src/main.ts`, the legacy UI controller (`class App`)
**Measured at:** Phase-3 checkpoint `dd9d68bc84372095c18749bb73e436aa68c7e4cf`
**Method:** mechanical inventory, then hand verification of every flagged path.
Scripts: `scripts/auditMainController.mjs`, `scripts/auditBindTimeEffects.mjs`,
`scripts/auditHandlerOrdering.mjs`.

This document closes **T-010-401** and supplies the evidence that decides what
Phase 4 may and may not extract. It also resolves **AUDIT010-07**, which has been
open since Phase 0 on the grounds that ordering could not be proven statically.

---

## 1. Scale

| Measure | Value |
|---|---|
| File | `src/main.ts`, one `class App` |
| Lines at Phase-3 checkpoint | **5,138** |
| Methods | **82** |
| Lines inside methods | 4,931 |
| Event handlers attached | **157** (158 `addEventListener` sites; one is the global `keydown`) |
| Named component imports | 28 |

The controller is not a bootstrap file. It is the application's event bus, view
router, presentation store, notification surface, media recorder, polling
scheduler and command dispatcher, in one class.

---

## 2. Responsibility inventory

Every method classified by its most authoritative signal. Where a method both
writes business state and renders, it counts as a business write — the stronger
claim governs.

| Class | Methods | What it means for Phase 4 |
|---|---|---|
| `LEGACY_BUSINESS_WRITE` | **25** | Writes through `dbService` with no canonical Application use case. **Not extractable to React** (AUDIT010-09). |
| `NOTIFICATION` | 12 | Mixed: toasts (presentation, extractable) and `notifyClient`/`notifyManager` (external effect, stays gated in its command path). |
| `SIDE_EFFECT` | 9 | Media capture, timers, bootstrap subscriptions. Browser-bound; not React's concern. |
| `DOM_MANIPULATION` | 8 | Thesis-editor form stepping and teleprompter DOM. Presentation, but tied to legacy markup. |
| `RENDER_ORCHESTRATION` | 5 | View assembly, modal dispatch, focus restoration. **Extractable.** |
| `READ_PROJECTION` | 5 | Tenant/campaign resolution from trusted sources. Extractable, but must keep reading trusted sources. |
| `AI_OR_AGENT_TRIGGER` | 5 | Discovery, research and ingest ticks. Must not move into a render path. |
| `NAVIGATION` | 3 | Tab/client/modal transitions. **Extractable.** |
| `CANONICAL_COMMAND_INVOCATION` | 3 | Already correct: routing, pipeline and outcome intents reach their consumers. |
| `EVENT_WIRING` | 2 | `bindEvents`, `bindNavigation` dispatchers. |
| `OTHER` | 5 | Constructor, actor projection, gate helper, URL revocation. |

**The load-bearing number is 25.** Those methods hold the 34 business writes
registered under AUDIT010-09. They cannot become canonical use cases in Phase 4
(that would be creating business authority, which is forbidden and belongs to a
formal change request), and they cannot move into React (React must not write
through `dbService`). They can therefore only stay legacy — which is what §17
prescribes and what this phase does.

---

## 3. Side-effect ordering (AUDIT010-07)

A *material* effect is persistence, agent/AI execution, network I/O, media
capture, or a notification that leaves the browser tab. A toast and a re-render
are presentation and need no gate; treating them as effects was the first pass's
error and would have inflated the numbers.

Ordering is a property of a **path**, not of a method: a `bind*` method attaches
many handlers, each with its own gate. Paths were therefore counted as
*effect-bearing handlers* plus *command-method bodies*.

| Population | Count |
|---|---|
| Handlers attached | 157 |
| — with no material effect | 101 |
| — effect-bearing | **56** |
| Command-method effect sites | **30** |
| **Total material side-effecting paths audited** | **86** |

### Result

| Ordering | Count |
|---|---|
| `GATE_FIRST` | **80** |
| `EFFECT_FIRST` | **6** |
| `UNKNOWN` | **0** |

**`UNKNOWN` is zero**, which is the outcome that matters: AUDIT010-07 was open
because ordering was unproven, not because a defect was alleged. Every path is
now accounted for.

### The first, permissive pass was wrong in a way worth recording

A tolerant gate pattern reported **0** `EFFECT_FIRST` across all 157 handlers.
Tightening the pattern to require a real refusal — an early return, a throw, an
authorization call, a confirmation — surfaced 7 candidates, of which 6 survived
hand inspection. An audit that finds nothing should be distrusted before it is
believed; the tolerant run was counting `?.` and `=== '…'` as gates.

### The 6 `EFFECT_FIRST` paths

None is migrated. All stay legacy, per §20.

| Line | Effect | Why it is `EFFECT_FIRST` |
|---|---|---|
| 743 | `pushCurrentLocalToFirestore()` | Admin sync utility. The only thing preventing a non-manager from reaching it is that the button is not rendered for them — authorization by UI visibility, with no in-path check. |
| 883 | `dbService.applyOnboardingStep(clientId, step, fields)` | The tenant is taken from a **DOM attribute** (`data-client-id`), falling back to `resolveClientId()`, and the write runs with no authorization check and no field validation. This is AUDIT010-09 registry #10 — the write that T-010-205 deliberately left legacy. The audit now shows that decision was not merely procedural: the path is genuinely ungated. |
| 1232 | `aiService.generateThesisProposal(clientId)` | Provider spend from a click, tenant from a DOM attribute. `btn.disabled = true` prevents double-submission but is not an authorization gate. |
| 2315 | `runResearchSignalsAgent(clientId, { maxSignals: 3 })` | Agent execution with no pre-gate. |
| 2688 | `generatePositioningAdvice(clientId)` | Advisory generation with no pre-gate. |
| 2704 | `runTopicAgent(clientId)` | Agent execution with no pre-gate. |

Four of the six are advisory AI/agent generators. They produce proposals a human
must still accept, so they hold no business authority — but they do spend a
provider budget from an unauthenticated-in-path click, which is why they are
registered rather than waved through.

Registered as **AUDIT010-10**, severity **P2**, disposition
`RETAINED_LEGACY_REMEDIATION_REQUIRED`. Remediation means adding an in-path
authorization gate to legacy code, which is not a Phase-4 extraction task.

### No effect runs at bind time or render time

`scripts/auditBindTimeEffects.mjs` walks every method and reports material
effects that are **not** inside a deferred context (handler, timer, promise
continuation, array callback).

- Sites found: **30**
- Sites inside a `bind*` method: **0**
- Sites inside a `render*` method: **0**

All 30 are command-method bodies — `submitClientVideo`, `approveClientArticle`,
`pollOneSource` and so on — where writing is the method's purpose. So the legacy
controller attaches listeners without executing them, and renders without
writing. That property is what makes §9 (React render must stay pure)
enforceable rather than aspirational, and it is asserted by the Phase-4
architecture suite.

---

## 4. `runSourceDiscoveryAgent` — correction to the Phase-3 classification

Phase 3 recorded 2 `EFFECT_FIRST` occurrences of `runSourceDiscoveryAgent` at
`ClientWorkspace.ts:1983` and `:2247`, called during render, and declined to
migrate those surfaces. **The decision was right; the stated reason was wrong.**

Reading the implementation (`src/services/sourceDiscoveryAgent.ts:186`):

```text
runSourceDiscoveryAgent(client, thesis)
  → buildProfileKeywords(...)        pure
  → mergePendingSources(...)         pure
  → dbService.getSourcesByClient()   READ
  → toRecommendations(...)           pure
  → returns recommendations
```

There is **no write, no network call and no provider call**. Persistence and
network live in `runSourceDiscoveryAgentAsync` (Tavily + YouTube enrichment) and
in `saveLastAgentRun`, and neither is reached from the render path. The two
render-time calls are therefore **`RENDER_TIME_RECOMPUTATION`**, not side effects:
expensive re-derivation on every render, reading persistence during render, but
changing nothing.

Corrected disposition:

| | Phase 3 | Phase 4 (evidenced) |
|---|---|---|
| Classification | `EFFECT_FIRST` | `RENDER_TIME_RECOMPUTATION (NO_MATERIAL_EFFECT)` |
| Migrated to React | No | No — unchanged |
| Reason for not migrating | "runs an agent during render" | reads persistence during render and re-derives on every pass; a React read facade must not do either |

`main.ts` calls the **async** variant twice: line 2133 (an explicit "force"
button) and line 4925 (the hourly timer). Both are intent-driven and gated, so
`EFFECT_FIRST` for this symbol is **0** in the controller.

The net effect on the governance record is that the repository's total
`EFFECT_FIRST` count does not include these two, and the 6 findings in §3 are
new and unrelated.

---

## 5. Extraction decisions

Applying §14 (allowed) and §15 (forbidden) to the inventory.

### Extracted in Phase 4 (T-010-402)

| Responsibility | Was | Now | Authority moved |
|---|---|---|---|
| Presentation state (tab, client scope, campaign, modal, filters, login error) | 11 mutable fields on `App` | `src/controllers/appUiState.ts` | none — no service, no `dbService`, no DOM import |
| Toast queue + rendering | `showToast`, `renderToasts` | `src/controllers/toastController.ts` | none — owns only `#toast-container`, via an injectable sink so the queue and the escaping are provable without a DOM |
| Modal dispatch (17 modals) | `renderActiveModal`, 72 lines of `if` chains | `src/controllers/modalPresenter.ts` | none — returns markup; the manager-only refusal is returned as `forceClose` instead of mutating state during a render |
| Navigation transition rules | `setTab`, `enterClient`, `backToPortfolio` | `src/controllers/navigationController.ts` | none — pure decisions; the caller performs render/toast/audit |

Consequences: 17 named component imports left the controller, the modal dispatch
table left with them, and navigation became testable without a DOM.

Equivalence evidence (§27), per responsibility:

| Responsibility | Evidence |
|---|---|
| Presentation state | `tests/reactMigrationPhase4Controllers.test.ts` — initial scope, workspace-tab defaulting, the four filters that reset on client entry **and the four that deliberately do not**, modal-data retention on `openModal`, and the absence of any tenant/actor/permission surface |
| Navigation | same suite — the portfolio/workspace guard, the legacy refusal message verbatim, alias resolution, and alias-before-guard ordering (`ws-results` → `ws-briefing` is still refused without a client) |
| Toasts | same suite — default type, 3,500 ms expiry, independent expiry of stacked toasts, and HTML escaping |
| Modal dispatch | `tests/reactMigrationPhase4Architecture.test.ts` — the manager-only refusal is returned as `forceClose` and no longer assigns state during a render |
| File download | same suite — one DOM-driven download in `src/`, and neither service creates an anchor |
| End-to-end | `e2e/phase4-controller-strangler.spec.ts` — the shell boots through the extracted orchestration, `loginError` round-trips state → render → alert, no business state is written on a failed sign-in, the toast sink never nests inside a presentation root, rollback is byte-identical, and exactly one root is visible |

### Extracted in Phase 4 (T-010-405)

| Service | UI logic removed | New owner |
|---|---|---|
| `services/dossierExport.ts` | anchor creation + click to save a `.md` | `lib/fileDownload.ts`; service now exposes `buildDossierExport` returning bytes + filename |
| `services/recordings.ts` | anchor creation + click to save a `.webm` | same |

Both services previously decided *what the document contains* (correctly theirs)
and *how a browser saves it* (not theirs). There is now exactly one DOM-driven
download in the codebase. `services/theme.ts` also touches the DOM, but it is a
pure presentation service rather than a domain-adjacent one, so it is left alone
rather than churned.

### Not extractable — and why

| Responsibility | Blocker |
|---|---|
| 25 `LEGACY_BUSINESS_WRITE` methods (34 writes) | AUDIT010-09. No canonical use case exists; creating one is business authority, which requires a formal change request. Marked `RETAINED_LEGACY_BY_AUDIT010_09`. |
| Media capture / teleprompter (~250 lines) | `MediaRecorder`, camera streams and IndexedDB blobs, plus 2 business writes. Browser-device orchestration, and not a Phase-4-listed target. |
| Polling and agent ticks | Must not enter a render path; a scheduler is not presentation. Correctly placed in the legacy controller for now. |
| Thesis-editor form DOM stepping | Bound to legacy markup that Phase 3 replaced with a React page for *display*; the legacy form remains because its save is blocked. Removing it before Phase 6 would delete a reachable capability. |

---

## 6. Observations registered as findings

| ID | Severity | Finding |
|---|---|---|
| **AUDIT010-10** | **P2** | 6 legacy command paths execute a material effect with no in-path authorization gate; authorization is by UI visibility, and 3 of them take the tenant from a DOM attribute. Retained legacy; remediation required before those paths are ever migrated. |
| **AUDIT010-11** | **P3** | `resolveClientId()` falls back to `dbService.getClients()[0]?.id` — a positional default for **tenant** selection. It is not thesis positional authority, so multi-thesis governance is unaffected, but a first-record fallback for tenant scope is the kind of default that should be an explicit refusal. Legacy behaviour preserved unchanged in Phase 4. |

Neither is P0 or P1: both are pre-existing legacy paths, untouched by this phase,
and tenant isolation is enforced by SPEC-009 rules (91/91 passing) rather than by
these call sites.

---

## 7. T-010-403 / T-010-404 feasibility

Recorded here because the audit is what determines it.

**T-010-403 — "Invert the seam — React shell hosts remaining legacy islands
(Stage B)."** `ui-architecture.md:121` states the precondition: *"Stage B is
entered only when `main.ts` has been reduced to bootstrap/composition
responsibility."* After T-010-402 the controller still owns 157 handlers, 25
business-write methods and the polling scheduler. The precondition is unmet, so
Stage B is **not entered**.

There is also a substantive reason, not just a sequencing one. Stage B makes
React the single navigation authority. The 34 blocked writes are reached through
legacy event wiring bound during a legacy render; hosting those surfaces inside a
React shell while legacy still owns their navigation and event binding is exactly
the dual-navigation-authority condition that §18 and `ui-architecture.md:131`
forbid. Inverting the seam is safe only once those command paths are canonical —
which needs the formal change request, not more refactoring.

**T-010-404 — "Reduce `main.ts` to minimal bootstrap/composition entrypoint."**
Depends on T-010-403. It is additionally bounded by §27: a smaller `main.ts` with
duplicated authority is a failure, and every extracted responsibility needs
behavioural-equivalence evidence. The remaining ~4,400 lines are DOM event
handlers with no unit coverage; relocating them into legacy modules would be
permissible in principle (legacy → legacy moves no authority) but this phase
cannot produce equivalence evidence for them, and moving untested handler code to
claim a line count would be the failure §27 describes.

Both are therefore **BLOCKED_BY_PRECONDITION**, not task-contract conflicts: no
forbidden action is *required* by either task, so §3's STOP condition is not
triggered. What is required is the AUDIT010-09 change request that Phase 4 is
explicitly not allowed to grant itself.

---

## 8. `main.ts` before / after

Measured by one method and one encoding for both revisions
(`scripts/mainStatsGit.mjs`).

| | Phase-3 checkpoint | Phase 4 | Δ |
|---|---|---|---|
| Lines | **5,138** | **5,041** | −97 |
| Methods | 82 | 82 | 0 |
| Component import statements | 11 | 7 | −4 |
| Named component imports | 28 | 11 | **−17** |
| `addEventListener` sites | 158 | 158 | 0 |
| Responsibility classes present | 12 | 11 | −1 (`UI_STATE` gone) |

−97 lines is the least interesting figure and is reported only because §6 asks
for it. Two others say more:

- **Named component imports fell 28 → 11.** The controller no longer knows that
  17 of the application's components exist. Modal dispatch was the coupling, and
  it left with the dispatch table.
- **Method count and handler count did not move at all.** That is the honest
  shape of this phase: the controller is not yet less of an event bus. Nothing
  was renamed or shuffled to make the file look smaller, and the four
  responsibilities that left are gone from it rather than relocated within it.

What remains is dominated by the 25 business-write methods and their 158
handlers, which cannot move until the blocked writes have a canonical owner.
That is why §7 below records T-010-403/404 as blocked rather than attempted.

---

## Phase-4C re-audit (after local security remediation)

Same scripts, same units, so the numbers are comparable.

| Measure | Phase 4 | Phase 4C | Δ |
|---|---|---|---|
| Lines | 5,041 | **5,130** | +89 |
| Methods | 82 | **85** | +3 |
| `addEventListener` sites | 158 | 158 | 0 |
| Handlers: `EFFECT_FIRST` | **6** | **0** | **−6** |
| Handlers: `GATE_FIRST` | 50 | **56** | +6 |
| Handlers: `NO_EFFECT` | 101 | 101 | 0 |
| Effects at bind time / render time | 0 | 0 | 0 |

`main.ts` **grew**, which is the correct outcome and worth stating plainly: a
fail-closed gate is several lines, and this phase added nine of them. §6 and §17
both warn against line count as acceptance; here it would point the wrong way
entirely. The load-bearing figure is `EFFECT_FIRST` 6 → 0, produced by
`scripts/auditHandlerOrdering.mjs` — the same script, with the same strict gate
pattern, that surfaced the 6 in the first place.

The +3 methods are `displayClientId`, `requireTenant` and `requireAdmin`. The
first is the display-only default that §10 permits; the other two are one-line
delegations to `controllers/trustedTenant.ts`, which exists so the gate can be
tested without a DOM or a store.

### A discrepancy in the Phase-4 accounting, recorded

The Phase-4 audit reported 86 paths as 56 effect-bearing handlers plus 30
command-method bodies, with 6 `EFFECT_FIRST` — all 6 attributed to handlers,
implying all 30 command bodies were `GATE_FIRST`. The method-level scan does not
support that: it reports 6 effect-bearing *method bodies* with no in-path gate
(`boot`, `completeLinkedArticleTask`, `markVideoCaptureStarted`,
`markArticleReviewStarted`, `pollSources`, `pollOneSource`).

These are a different population from AUDIT010-10 — internal helpers invoked
from handlers that are themselves gated, plus one bootstrap path — so the
remediation claim above is unaffected. But the two populations were never
reconciled, and the coincidence of both being 6 is exactly the kind of thing
that invites a false equivalence. Registered as **AUDIT010-12** (P3) rather than
asserted safe: proving it requires verifying the 12 call sites those helpers
have, which is outside this phase's authorization.
