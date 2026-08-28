# AUDIT010-09 registry — `LEGACY_COMMAND_WITHOUT_CANONICAL_USE_CASE`

**SPEC:** 010-react-migration
**Finding:** AUDIT010-09 · severity **P3**
**Status:** **MIGRATION_BLOCKER_FOR_AFFECTED_CAPABILITY** (registered, non-blocking for the phase as a whole)
**Opened:** Phase 1 · extended by the Phase-2 command screen · extended by the Phase-3 page screen · **Phase-4 controller audit added AUDIT010-10/-11 and the formal CR inventory; registry count unchanged at 34**

---

## The rule this registry enforces

> A legacy command that writes business state and has **no canonical Application
> use case** MUST NOT be migrated into React.

SPEC-010 owns presentation. It does not own the authority to create a business
use case, and it may not invent one to make a UI migration look complete.
Wrapping a raw `dbService` write in a React handler would move a business
mutation into the presentation layer, which is exactly the boundary the
migration exists to establish.

**Consequence for the user: none.** Every blocked capability stays available on
the legacy surface, which remains served and unmodified. The React view either
omits the action or points at the legacy surface that still owns it.

## Allowed dispositions

| Disposition | Meaning |
|---|---|
| `KEEP_LEGACY` | The whole capability stays legacy for now. |
| `DISPLAY_ONLY_REACT` | Read/display migrated; all writes stay legacy. |
| `READ_ONLY_REACT` | React renders a read-only projection; the action is absent as it is in the legacy read-only view. |
| `MIGRATION_BLOCKED_OTHER_SPEC` | Unblocking requires new Application authority owned by another SPEC. |

## Registry

`CU?` = does a canonical Application use case exist for this write?

| # | Component | User action | Legacy symbol(s) | Business write | CU? | Disposition | Owning SPEC | Blocking phase |
|---|---|---|---|---|---|---|---|---|
| 1 | `Login` / invite flow | Accept invitation | `acceptClientInvitation` → Application `AcceptClientInvitation` (legacy symbols: `markInvitationAccepted`, `updateClient`) | invitation state + client record | **YES** | `KEEP_LEGACY` (legacy UI invokes canonical consumer) | **CR-1 Client Lifecycle Application** | 3 |
| 2 | `ClientProfilePanel` | Add fact | `dbService.addProfileFact` | master profile facts | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 3 |
| 3 | `ClientProfilePanel` | Confirm fact | `dbService.confirmProfileFact` | fact verification state | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 3 |
| 4 | `ClientProfilePanel` | Reject fact | `dbService.rejectProfileFact` | fact verification state | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 3 |
| 5 | `ClientProfilePanel` | Edit fact value | `dbService.updateProfileFact` | master profile facts | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 3 |
| 6 | `ClientProfilePanel` | Extract facts from CV (paste or upload) | `dbService.importCandidateFactsFromCv` | bulk candidate facts | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 3 |
| 7 | `ProofWallPanel` | Mark asset ready / pending | `dbService.updateProofWallItem` | proof-wall item status | **NO** | `READ_ONLY_REACT` | **UNDETERMINED** | 3 |
| 8 | `SourceRegistryModal` | Register source | `dbService.addSource` | source registry | **NO** | `READ_ONLY_REACT` | **UNDETERMINED** | 3 |
| 9 | `SourceRegistryModal` | Ingest now (one / all) | source polling → ingestion | signals produced downstream | **NO** | `READ_ONLY_REACT` | **UNDETERMINED** | 3 |
| 10 | `OnboardingWizard` | Submit onboarding step / finish (handler owned by `main.ts`) | `applyOnboardingStep` → Application `ApplyOnboardingStep` (legacy symbol: `dbService.applyOnboardingStep` DEPRECATED) | client + master profile | **YES** | `DISPLAY_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Master Profile Application** | 3 |

### Phase-3 page screen — 24 further blocked writes

The Phase-3 screen inventoried all five wave-3 pages. It found that the large
majority of their actions write business state directly through `dbService` with
no canonical Application use case, which is why every wave-3 page is HYBRID or
READ_ONLY rather than a full cutover. Grouped by capability:

| # | Page | User action | Legacy symbol(s) | Business write | CU? | Disposition | Owning SPEC | Blocking phase |
|---|---|---|---|---|---|---|---|---|
| 11 | `ThesisEditorModal` | Save draft / send to client | `saveThesis` → Application `SaveThesis` (persistence: `dbService.saveThesis` via adapter) | thesis record + revision | **YES** | `DISPLAY_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Thesis Lifecycle Application** | 4 |
| 12 | `ClientWorkspace` positioning | Activate thesis | `activateThesis` → Application `ActivateThesis` (Domain `activateThesisByManager`; persistence via adapter) | thesis status | **YES** | `DISPLAY_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Thesis Lifecycle Application** | 4 |
| 13 | `ClientPortal` thesis | Approve / request changes | `decideThesisClientReview` → Application `DecideThesisClientReview` (Domain `approveThesisByClient` / `rejectThesisByClient`) | client approval state | **YES** | `DISPLAY_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Thesis Lifecycle Application** | 4 |
| 14 | `ClientWorkspace` deliver | Confirm destination | `dbService.decideCuration`, `decideSignal` | curation decision | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 4 |
| 15 | `ClientWorkspace` deliver | Propose angle | `dbService.setCurationAngle` | curation angle | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 4 |
| 16 | `ClientWorkspace` deliver | Remove / reopen curation | `dbService.removeCuration`, `reopenCuration` | curation lifecycle | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 4 |
| 17 | `ClientWorkspace` deliver | Assemble briefing | `dbService.ensureDraftDelivery`, `addDeliveryItem`, `attachCurationToDelivery`, `removeDeliveryItem`, `updateDelivery`, `discardDraftDelivery` | delivery package | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 4 |
| 18 | `ClientWorkspace` deliver | Send to client | canonical gate, then delivery writes + notifications | delivery + notification | **PARTIAL** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 4 |
| 19 | `ClientPortal` home | Mark briefing read | `dbService.acknowledgeDelivery` | delivery acknowledgement | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 4 |
| 20 | `ClientWorkspace` radar | Discard signal | `dbService.decideSignal` | signal decision | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 4 |
| 21 | `ClientWorkspace` radar | Add to delivery | `dbService.addToCuration`, `decideSignal` | curation entry | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 4 |
| 22 | `ClientWorkspace` radar | Score signal | canonical routing use case, then `dbService.addRecommendation` | recommendation | **PARTIAL** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 4 |
| 23 | `ClientWorkspace` radar | Pin / unpin topic | `dbService.toggleTopicPin` | topic pin | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 4 |
| 24 | `ClientWorkspace` sources | Register / activate source | `dbService.addSource` | source registry | **NO** | `READ_ONLY_REACT` | **UNDETERMINED** | 4 |
| 25 | `ClientWorkspace` sources | Pause / reactivate / archive / test feed | `dbService.updateSourceStatus`, `recordSourceRun` | source state | **NO** | `READ_ONLY_REACT` | **UNDETERMINED** | 4 |
| 26 | `ClientWorkspace` sources | Manual signal | `dbService.addSignal` | signal record | **NO** | `READ_ONLY_REACT` | **UNDETERMINED** | 4 |
| 27 | `ClientWorkspace` tasks | Assign / cancel task | `dbService.addTask`, `updateTaskStatus` | task record | **NO** | `READ_ONLY_REACT` | **UNDETERMINED** | 4 |
| 28 | `ClientPortal` feed | Open / complete / request changes on a task | `dbService.updateTaskStatus`, `updateTaskEvidence` | task state + evidence | **NO** | `READ_ONLY_REACT` | **UNDETERMINED** | 4 |
| 29 | `ClientWorkspace` positioning | Assign evidence to thesis | `dbService.toggleEvidenceThesis` | evidence assignment | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 4 |
| 30 | `Modals` add-evidence | Add evidence item | `dbService.addEvidenceItem` | evidence vault | **NO** | `KEEP_LEGACY` | **UNDETERMINED** | 4 |
| 31 | `Modals` content-editor | Save content | `dbService.saveContent` | content record | **NO** | `KEEP_LEGACY` | **UNDETERMINED** | 4 |
| 32 | `Modals` article-review | Save / approve / reject article | `dbService.saveClientArticleRevision`, `transitionContentPipeline`, `addFeedbackEvent`, `saveContent` | content + pipeline | **NO** | `KEEP_LEGACY` | **UNDETERMINED** | 4 |
| 33 | `Modals` generate-content | Generate draft | provider call, then `dbService.saveContent` | content record | **NO** | `READ_ONLY_REACT` | **UNDETERMINED** | 4 |
| 34 | `ManagerCockpit` / `Modals` create-client | Create client + invite | `createClientWithInvite` → Application `CreateClientWithInvite` (legacy symbols: `createClient`, `createInvitation`, `createPendingAccount`) | tenancy + identity | **YES** | `KEEP_LEGACY` (legacy UI invokes canonical consumer) | **CR-1 Client Lifecycle Application** (SPEC-009 remains authz/RBAC only) | 4 |

Items 18 and 22 are recorded as `CU? PARTIAL` deliberately: their *authorization*
is canonical but their *persistence* is not. A partially canonical command is not
a migratable command — routing it through React would move the non-canonical half
into the presentation layer — so both stay legacy in full.

Item 34 also mutates the session (`impersonateClient`) on the neighbouring "ver
como cliente" control, which is SPEC-009 authority and out of scope regardless.

### A separate, non-AUDIT010-09 blocker: brief creation

`createBriefFromCurationEntry` (SPEC-003) **is** a canonical consumer, so
AUDIT010-09 does not apply. It is nevertheless not migrated, for a different
reason: its signature requires the caller to pass the whole `CurationEntry`
aggregate (`strategicBriefConsumer.ts:117-122`). Passing a cached aggregate as
command input is precisely the caller-snapshot authority the seam keeps at zero
(threat T-010-07), and the seam cannot re-read the entry from a trusted source
without importing `dbService`.

Class: `CANONICAL_CONSUMER_REQUIRES_CALLER_AGGREGATE`. Unlike the rows above,
this one is resolvable by an id-based overload in SPEC-003 rather than by new
business authority. Brief *approval* has no such problem and was migrated.

**Owning SPEC is deliberately recorded as `UNDETERMINED`.** No repository
document assigns profile facts, proof-wall status, source registration or
onboarding to a specific SPEC's Application layer, and inventing an owner would
be a governance fabrication. Determining ownership is the prerequisite for
unblocking, and it is other-SPEC work.

### Item 10 changed disposition without changing the blocker

The T-010-205 reconciliation moved item 10 from `KEEP_LEGACY` to
`DISPLAY_ONLY_REACT`: the onboarding form's presentation and its two
compatibility reads are now in React, while the write stays exactly where it was.
The blocker itself is unchanged — no canonical use case exists, none was invented,
and `applyOnboardingStep` appears nowhere in `src/ui/**`. The handler was always
owned by `main.ts`, whose extraction is Phase 4, so it was never inside the
component boundary that T-010-205 migrates.

### Item 9 has a second reason to stay legacy

Source polling triggers ingestion, which produces signals that later reach
scoring and routing. That is a side-effect chain owned by the radar/signal
SPECs. Even with a canonical write for `addSource`, "ingest now" would still not
belong behind a React button in a bounded component phase.

### The legacy modal's render-time agent run is not reproduced

`SourceRegistryModal` calls `runSourceDiscoveryAgent` while rendering. A React
read facade must not launch an agent run as a side effect of rendering, so the
recommendation chips are not migrated. They remain on the legacy surface.

## What was NOT blocked

The screen also found commands that are already canonical. These migrated
because doing so changes the caller and nothing else — React and legacy converge
on the identical use case:

| Component | Action | Canonical target | Class |
|---|---|---|---|
| `OpportunityPanel` | Accept | `acceptClientOpportunity` (SPEC-007) | `CANONICAL_CONSUMER` |
| `OpportunityPanel` | Decline (notes required) | `declineClientOpportunity` | `CANONICAL_CONSUMER` |
| `OpportunityPanel` | Toggle checklist item | `toggleClientOpportunityChecklistItem` | `CANONICAL_CONSUMER` |
| `OpportunityPanel` | Mark submission sent | `submitClientOpportunity` | `CANONICAL_CONSUMER` |
| `KpiWeeklyChart` | Register consultation (+1) | `registerResultRecordIntent` (SPEC-008) | `CANONICAL_CONSUMER` |
| `MasterDossierPanel` | Copy / download Markdown | `dossierExport` formatter + audit log | `PRESENTATION_ONLY` |
| `ClaimSafetyPanel` | Go to phrase | editor cursor move | `PRESENTATION_ONLY` |
| `PageHeader` | — | — | `NO_COMMAND` |

Phase 3 added two more, on the same basis:

| Page | Action | Canonical target | Class |
|---|---|---|---|
| `ClientWorkspace` radar | Signal outcome "¿sirvió?" Sí/No | `registerSignalOutcomeIntent` (SPEC-008) | `CANONICAL_CONSUMER` |
| `ClientWorkspace` briefs | Approve Strategic Brief | `approveStrategicBrief` (SPEC-003) | `CANONICAL_CONSUMER` |

## Enforcement

The rule is enforced mechanically, not by review. `tests/reactMigrationPhase2Architecture.test.ts`
and `tests/reactMigrationPhase3Architecture.test.ts` assert that none of the
blocked symbols above appears anywhere under `src/ui/**`, that the compatibility
facade exports only `read*` functions, and that no component or page imports a
consumer or service command directly instead of going through the command seam.
The Phase-3 suite additionally asserts that every page holding a blocked action
renders the `LegacyHandoff` element, so a blocked action cannot be quietly
dropped instead of delegated, and that `createBriefFromCurationEntry` is absent
from the seam.

## Why this is not RESOLVED

Leaving the affected commands on the legacy path is the correct handling of the
finding, not a resolution of it. The finding closes when each capability either
gains a canonical Application use case (other-SPEC work) or is formally retired.
Until then it stays **MIGRATION_BLOCKER_FOR_AFFECTED_CAPABILITY** at **P3**: no
capability loss, and no defect introduced by the migration.

> **Corrected in Phase 4.** This section previously read "ordering sound in every
> case (gate before effect)". The Phase-4 controller audit
> (`main-controller-audit.md`) disproves that for **6** of the legacy paths,
> including registry item 10 — `dbService.applyOnboardingStep` takes its tenant
> from a DOM attribute and runs with no authorization check. The earlier claim
> rested on a tolerant gate pattern that counted optional chaining as a gate.
> The paths are unchanged and still legacy; only the claim about them was wrong.
> Recorded as **AUDIT010-10** below.

---

# Phase-4 additions

**Opened:** Phase 4 · T-010-401 controller audit
**Registry count:** unchanged at **34** blocked writes. Phase 4 extracted no
command and canonicalized nothing, so no row moved.

## AUDIT010-10 — material effect with no in-path authorization gate

**Severity P2 · opened Phase 4 · `RETAINED_LEGACY_REMEDIATION_REQUIRED`
→ Phase 4C: `RESOLVED`** (remediation below)

Six legacy paths execute a material effect without an authorization check in the
path. Authorization is by UI visibility — the control is not rendered for users
who should not have it — and in three cases the tenant comes from a DOM
attribute. Full evidence in `main-controller-audit.md` §3.

| Path | Effect | Tenant source |
|---|---|---|
| `main.ts:743` | `pushCurrentLocalToFirestore()` | session |
| `main.ts:883` | `dbService.applyOnboardingStep` (registry #10) | **DOM attribute** |
| `main.ts:1232` | `aiService.generateThesisProposal` | **DOM attribute** |
| `main.ts:2315` | `runResearchSignalsAgent` | workspace scope |
| `main.ts:2688` | `generatePositioningAdvice` | **DOM attribute** |
| `main.ts:2704` | `runTopicAgent` | workspace scope |

Four of the six are advisory AI/agent generators. They produce proposals a human
must accept, so they hold no business authority — but they spend a provider
budget from a click that nothing in-path authorizes.

Not P0/P1: all six are pre-existing legacy paths, untouched by this phase, and
tenant isolation is enforced by SPEC-009 Firestore rules (91/91 passing) rather
than by these call sites. Remediation means adding gates to legacy code, which is
not an extraction task and is not authorized here.

**Migration impact:** these paths must not be migrated until gated. §20 forbids
migrating an `EFFECT_FIRST` path, and 0 were migrated.

## AUDIT010-11 — positional default for tenant selection

**Severity P3 (recorded Phase 4) → P2 (reclassified Phase 4B evidence) · `LEGACY_BEHAVIOUR_PRESERVED`
→ Phase 4C: `RESOLVED`** (remediation below)

`main.ts` `resolveClientId()` falls back to `dbService.getClients()[0]?.id` — a
first-record default for **tenant** scope. It is not thesis positional authority,
so multi-thesis governance is unaffected and `PRIMARY/FIRST THESIS AUTHORITY`
stays 0. But a first-record fallback for tenant scope should be an explicit
refusal, not a silent pick. Behaviour preserved unchanged in Phase 4; recorded so
that whoever migrates these paths does not carry the fallback across.

## AUDIT010-07 — closed as an audit

**Was:** `AUDIT_REQUIRED_IMPLEMENTATION_PENDING` since Phase 0, on the grounds
that ordering could not be proven statically across 5,132 lines.

**Now:** `AUDIT_COMPLETE · DEFECTS REGISTERED · 0 MIGRATED`. All **86** material
side-effecting paths in the controller are classified: **80 `GATE_FIRST`**,
**6 `EFFECT_FIRST`** (AUDIT010-10), **0 `UNKNOWN`**. Zero `EFFECT_FIRST` and zero
`UNKNOWN` paths were migrated. The audit obligation is discharged; the six
defects it surfaced are open remediation items on legacy code.

---

# Formal change-request inventory (§11)

Consolidated here because §8 requires the debt to stay visible and §10 forbids
Phase 4 from discharging it.

| CR | Capability | Blocked writes | Why blocked | Candidate owner | Cut-over impact |
|---|---|---|---|---|---|
| **CR-1** | Onboarding, profile facts, proof wall, source registration, curation, delivery, tasks, evidence, content, thesis, **client lifecycle + master profile (partial)** | **34** registry rows · **3 canonicalized** (#34, #1, #10) · **31** still without CU | Remaining writes lack Application owners. Client Lifecycle (#34/#1) + Master Profile (#10) owned by CR-1 workstreams. | **PARTIAL** — Client Lifecycle + Master Profile Application; others UNDETERMINED / approved CR-1 workstreams pending | Blocks FULL CUTOVER / T-010-403 / T-010-404 / Phase 6 until cutover spine completes |
| **CR-2** | Strategic Brief creation from a curation entry | 1 (not counted in the 34 — the consumer exists) | Consumer requires the caller to pass the whole `CurationEntry` aggregate | **SPEC-003** (frozen) | Blocks migrating brief creation; approval already migrated |
| **CR-3** | Trusted tenant entitlement in four consumer `buildTrusted*Context` builders | 4 builders (003/004/007/008) | Trusted `organizationId` was derived from the requested client record | **SPEC-003 · 004 · 007 · 008** | **RESOLVED** — see `cr-3-trusted-tenant-entitlement.md`; implementation `af49c59c9c8042b925e29c8a71ac1cd585d2f941` |

**FORMAL CHANGE REQUESTS:** CR-1 **OPEN** · CR-2 **CHANGE_REQUIRED** · CR-3 **RESOLVED** (security amendment; not a product CR).

## CR-2 — SPEC-003 consumer signature (§12)

Investigated in Phase 4; **not modified**. `createBriefFromCurationEntry` signature
modifications remain **0**. (CR-3 amended only `buildTrustedBriefContext`.)

| Field | Repository truth |
|---|---|
| Consumer | `createBriefFromCurationEntry` |
| File | `src/services/strategicBriefConsumer.ts:117` |
| Current signature | `{ entry: CurationEntry; destination: CurationDestination; briefId?: string; now?: string }` |
| Caller-supplied aggregate | `entry: CurationEntry` — the whole record |
| Frozen SPEC owner | **SPEC-003** (Strategic Brief) |
| Classification | **`FORMAL_CHANGE_REQUEST_REQUIRED`** |

### Why the current signature is a caller-snapshot risk

The consumer derives business-material values from the caller's object without
re-reading it from persistence:

| Derived value | Taken from |
|---|---|
| tenant `clientId` (feeds `buildTrustedBriefContext`) | `entry.clientId` |
| `signalIds` | `entry.signalId` |
| `territory` | `entry.title.slice(0, 120)` |
| `strategicAngle` | `entry.aiAngle \|\| entry.title` |
| `decisionRationale` | `entry.managerRationale` |
| `briefId` | `brief_${entry.id}` |

Two parts of the context **are** trusted and should be credited as such:
`actorId`/`actorRole` come from `authService`, and `organizationId` is resolved
server-side via `dbService.getClientById(clientId)?.organizationId`. So the
organization cannot be forged.

What can be supplied by the caller is the **`clientId`** and the Brief's entire
substantive content. Nothing verifies that the passed entry matches the stored
one, or that the session is entitled to that client. Today's only caller
(`main.ts:2651`) passes an entry it just read, so no live defect is claimed — the
risk is what the contract *permits*, which matters the moment a React caller
exists. That is why the seam refused it in Phase 3 rather than adopting it.

### Proposed safe contract — recorded, not implemented

```text
createBriefFromCurationEntry({
  curationEntryId: string,      // an id, not an aggregate
  destination: CurationDestination,
  briefId?: string,
  now?: string,
})
```

The consumer re-reads the entry itself (`dbService.getCurationById` already
exists, `src/services/db.ts:2449`) and derives `clientId`, `signalId`, territory,
angle and rationale from the stored record. Caller snapshot authority becomes 0
for this path, and the change needs no new infrastructure.

**Authorization required from the SPEC-003 owner. Not implemented in Phase 4.**

---

# Phase 4C — local security remediation

**Scope:** AUDIT010-10 and AUDIT010-11 only. No cross-SPEC implementation, no
canonical use case created, no registry row removed. **CR-1 stays at 34 blocked
writes and CR-2 stays `CHANGE_REQUIRED`** — this phase fixed how the legacy
paths establish *who is acting on which tenant*, not who owns the commands.

## The gate

`src/controllers/trustedTenant.ts` — `requireTenantScope` and
`requireAdminActor`. It is a **gate, not a tenant authority**: it holds no state,
imports no store or service, and receives identity through injected
dependencies. §6 forbids a second tenant authority, so nothing here can mint
identity; the organization is always the actor's own.

| Rule | Behaviour |
|---|---|
| No session | refuse `NO_SESSION` |
| Session without `organizationId` | refuse `NO_TRUSTED_ORG` |
| `CLIENT` actor proposing another client | refuse `CLIENT_SCOPE_VIOLATION` |
| `CLIENT` actor | pinned to trusted `user.clientId`; a proposal is only ever accepted when it matches |
| `ADMIN` actor, nothing chosen | refuse `NO_CLIENT_SCOPE` — no positional default |
| `ADMIN` actor, unknown client | refuse `UNKNOWN_CLIENT` |
| `ADMIN` actor, client in another org | refuse `CROSS_ORG` |
| Grant | `organizationId` from the **session**, never from the client record |

That last row is the substantive fix. `main.ts` `resolveOrganizationId()` reads
the organization from the client record first, so it answers *"does this client
have an org?"* — a presence check that **any existing client passes**. It never
answered *"may this actor act on this client?"*. The gate answers the second
question, which is the one that matters when the proposed client id arrives from
a DOM attribute.

## AUDIT010-10 — the six paths, remediated

| Path | Effect | Tenant before | Tenant after | Gate added |
|---|---|---|---|---|
| `btn-firebase-push-local` | `pushCurrentLocalToFirestore()` | session | n/a (org-wide) | `requireAdminActor` — role from trusted session |
| `form-onboarding-step` | `dbService.applyOnboardingStep` (registry #10) | **DOM attribute** | trusted grant | `requireTenantScope` |
| `btn-generate-thesis-proposal` | `aiService.generateThesisProposal` | **DOM attribute** | trusted grant | `requireTenantScope` |
| `btn-research-all-signals` | `runResearchSignalsAgent` | **DOM attribute** | trusted grant | `requireTenantScope` |
| `btn-generate-advice` | `generatePositioningAdvice` | **DOM attribute** | trusted grant | `requireTenantScope` |
| `btn-run-topic-agent` | `runTopicAgent` | **DOM attribute** | trusted grant | `requireTenantScope` |

Three adjacent sites were gated in the same pass, because leaving a twin
ungated would have gated only what was counted: the deferred
`generateThesisProposal` auto-run, the per-signal `.btn-research-signal`
handler, and the `btn-onboarding-skip` write (whose `if (clientId)` was a
presence check before `dbService.updateClient`).

**Mechanical evidence.** `scripts/auditHandlerOrdering.mjs` — the same script
that produced the finding — now reports **`EFFECT_FIRST: 0`** across all 157
handlers, down from 6. `scripts/auditMainController.mjs` no longer flags
`bindOnboarding`.

**DOM-derived tenant authority: 5 → 0. Button-visibility authorization: 6 → 0.**
`data-client-id` still exists in markup and is still passed in, but it is now
`DISPLAY_ONLY` input to a gate that can refuse it.

## AUDIT010-11 — positional tenant authority removed

The Phase-4B analysis found `resolveClientId`'s `getClients()[0]` fallback.
Writing the test found **two more sites the analysis had missed**, and one was
worse than the recorded finding:

| Site | Behaviour before | Behaviour after |
|---|---|---|
| `resolveClientId()` | ended in `dbService.getClients()[0]?.id`, feeding business writes | returns `''`; callers must pass it through the gate |
| `renderMainView()` | a `CLIENT` session with no `clientId` fell through to `getClients()[0]`, **rendering another tenant's portal** | fails closed with an explanatory empty state |
| `tickScheduledIngest()` | with no active workspace, ingested for `getClients()[0]` — a background effect choosing tenant by position | requires a grant; skips the tick otherwise |

The `renderMainView` case is the reason the severity reclassification was right.
A first-record *default* is untidy; rendering a different tenant's portal to a
client whose session lacks a `clientId` is a tenant-isolation defect. It was
reachable only for a malformed client session, and SPEC-009 rules would still
have refused the reads server-side, so no P0/P1 is claimed — but it is not P3.

One positional pick remains, deliberately and per §10: `displayClientId()`,
used **only** for the modal presenter's fallback. `DISPLAY DEFAULT ≠ BUSINESS
CLIENT AUTHORITY`, and a test asserts it is the only `getClients()[0]` left in
the controller's code and that it is confined to that method.

## AUDIT010-12 — internal helpers with no gate of their own (new, P3)

**Severity P3 · `DEFENCE_IN_DEPTH_GAP`**

The method-level scan reports 6 command-method bodies that execute an effect
with no in-path gate: `boot`, `completeLinkedArticleTask`,
`markVideoCaptureStarted`, `markArticleReviewStarted`, `pollSources`,
`pollOneSource`. These are **not** the AUDIT010-10 population — they are
internal helpers reached from handlers that are themselves gated, and `boot` is
bootstrap rather than a user action.

Registered rather than closed or ignored, for two honest reasons. Static
ordering analysis cannot prove a helper is safe from its callers' gates, and
each of these has 1–4 call sites that would each need verifying. And the
Phase-4 audit's accounting attributed all 6 `EFFECT_FIRST` paths to handlers,
which the method-level view does not support; the populations were never
reconciled. Verifying the 12 call sites is the remediation, and it is not this
phase's authorized scope.

## Severity after Phase 4C

Row-level derivation, not an edited total. Entering: P2 **4** recorded / **5**
evidence-supported (AUDIT010-11 reclassified P3→P2), P3 **7** / **6**.

| Change | P2 | P3 |
|---|---|---|
| Evidence-supported entry | 5 | 6 |
| AUDIT010-10 resolved | −1 | — |
| AUDIT010-11 resolved (at P2) | −1 | — |
| AUDIT010-12 opened | — | +1 |
| **Exit** | **3** | **7** |

**P0 0 · P1 0 · P2 3 · P3 7.**

## What Phase 4C did not touch

| Item | State |
|---|---|
| CR-1 blocked writes | **34** registry rows · **6** canonicalized (#34/#1 Client Lifecycle, #10 Master Profile, #11/#12/#13 Thesis Lifecycle) · **28** still CU?=NO |
| CR-1 ownership | **PARTIAL** — Client Lifecycle + Master Profile + Thesis Lifecycle Application; remaining UNDETERMINED / pending workstreams |
| CR-1 provisional groups | **10** — Client Lifecycle (1, 34) + Master Profile (#10) + Thesis Lifecycle (11–13) Application-owned; IDs 2–6 remain OWNER_RESOLVED / NOT_IMPLEMENTED |
| CR-2 / SPEC-003 | **CHANGE_REQUIRED**, `CALLER_SNAPSHOT_AUTHORITY_PRESENT` — unchanged |
| SPEC-003 modifications | **0** |
| T-010-403 / T-010-404 | **BLOCKED_BY_PRECONDITION** — CR-1 unresolved |

Gating a legacy write does not canonicalize it. **Exceptions (CR-1):** registry
**#34**, **#1** (Client Lifecycle), **#10** (Master Profile), and **#11**, **#12**,
**#13** (Thesis Lifecycle) now have canonical Application use cases; legacy UI
invokes the consumer only (double authority 0). The remaining **28** CU?=NO rows
still write through `dbService` with no Application use case and remain barred
from React until their CR-1 workstreams land.

---

## CR-1 Workstream 1 — Client Lifecycle (post-adoption note)

| Field | Value |
|---|---|
| Registry IDs | **#34**, **#1** |
| Commands | `CreateClientWithInvite`, `AcceptClientInvitation` |
| Owner | CR-1 Client Lifecycle Application (operational) |
| Previous legacy authority | `main.ts` orchestrated `createClient` + `createInvitation` + `createPendingAccount` / `markInvitationAccepted` + `updateClient` |
| Compatibility path | Legacy login + create-client forms call `clientLifecycleConsumer`; React remains `KEEP_LEGACY` / LegacyHandoff until presentation migration |
| Removal eligibility | Not eligible — cutover-spine writes remain; T-010-403/404 stay blocked |
| Evidence | `specs/010-react-migration/cr-1-client-lifecycle.md`; `tests/cr1ClientLifecycle.test.ts` |

---

## CR-1 Workstream 2 — Master Profile (post-adoption note)

| Field | Value |
|---|---|
| Registry ID | **#10** |
| Command | `ApplyOnboardingStep` |
| Owner | CR-1 Master Profile Application (operational) |
| Previous legacy authority | `main.ts` → `dbService.applyOnboardingStep` (now DEPRECATED fail-closed) |
| Domain reuse | `buildFactsFromProfile`, `computeProfileCoverage` / `nextIncompleteOnboardingStep` (resume) |
| Completeness | Domain-derived on `saveMasterProfile` refresh — not caller/legacy constant authority |
| IDs 2–6 | OWNER_RESOLVED → Master Profile · **NOT_IMPLEMENTED** this workstream |
| Compatibility path | Legacy onboarding form → `masterProfileConsumer`; React remains `DISPLAY_ONLY_REACT` |
| Removal eligibility | Not eligible — 9 other cutover-spine writes remain |
| Evidence | `specs/010-react-migration/cr-1-master-profile.md`; `tests/cr1MasterProfile.test.ts` |

---

## CR-1 Workstream 3 — Thesis Lifecycle (post-adoption note)

| Field | Value |
|---|---|
| Registry IDs | **#11**, **#12**, **#13** |
| Commands | `SaveThesis`, `ActivateThesis`, `DecideThesisClientReview` |
| Owner | CR-1 Thesis Lifecycle Application (operational) |
| Previous legacy authority | `main.ts` orchestrated `planThesisSave` / `activateThesisByManager` / `approveThesisByClient` / `rejectThesisByClient` → `dbService.saveThesis` |
| Domain reuse | `planThesisSave`, `assertThesisReadyForReview`, `activateThesisByManager` / `canActivateThesis`, `approveThesisByClient`, `rejectThesisByClient` |
| Multi-thesis | Explicit `thesisId` required — positional thesis authority **0** |
| SPEC-001 | Integration via ACTIVE thesis state only — routing unmodified |
| Compatibility path | Legacy ThesisEditor / ClientWorkspace / ClientPortal → `thesisLifecycleConsumer`; React remains `DISPLAY_ONLY_REACT`; command seam exposes `thesisLifecycleCommands` |
| Removal eligibility | Not eligible — 6 other cutover-spine writes remain |
| Evidence | `specs/010-react-migration/cr-1-thesis-lifecycle.md`; `tests/cr1ThesisLifecycle.test.ts` |
