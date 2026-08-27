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
| 1 | `Login` / invite flow | Accept invitation | `dbService.markInvitationAccepted`, `dbService.updateClient` | invitation state + client record | **NO** | `KEEP_LEGACY` | **UNDETERMINED** | 3 |
| 2 | `ClientProfilePanel` | Add fact | `dbService.addProfileFact` | master profile facts | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 3 |
| 3 | `ClientProfilePanel` | Confirm fact | `dbService.confirmProfileFact` | fact verification state | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 3 |
| 4 | `ClientProfilePanel` | Reject fact | `dbService.rejectProfileFact` | fact verification state | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 3 |
| 5 | `ClientProfilePanel` | Edit fact value | `dbService.updateProfileFact` | master profile facts | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 3 |
| 6 | `ClientProfilePanel` | Extract facts from CV (paste or upload) | `dbService.importCandidateFactsFromCv` | bulk candidate facts | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 3 |
| 7 | `ProofWallPanel` | Mark asset ready / pending | `dbService.updateProofWallItem` | proof-wall item status | **NO** | `READ_ONLY_REACT` | **UNDETERMINED** | 3 |
| 8 | `SourceRegistryModal` | Register source | `dbService.addSource` | source registry | **NO** | `READ_ONLY_REACT` | **UNDETERMINED** | 3 |
| 9 | `SourceRegistryModal` | Ingest now (one / all) | source polling → ingestion | signals produced downstream | **NO** | `READ_ONLY_REACT` | **UNDETERMINED** | 3 |
| 10 | `OnboardingWizard` | Submit onboarding step / finish (handler owned by `main.ts`) | `dbService.applyOnboardingStep` | client + master profile | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 3 |

### Phase-3 page screen — 24 further blocked writes

The Phase-3 screen inventoried all five wave-3 pages. It found that the large
majority of their actions write business state directly through `dbService` with
no canonical Application use case, which is why every wave-3 page is HYBRID or
READ_ONLY rather than a full cutover. Grouped by capability:

| # | Page | User action | Legacy symbol(s) | Business write | CU? | Disposition | Owning SPEC | Blocking phase |
|---|---|---|---|---|---|---|---|---|
| 11 | `ThesisEditorModal` | Save draft / send to client | `dbService.saveThesis` | thesis record + revision | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 4 |
| 12 | `ClientWorkspace` positioning | Activate thesis | `activateThesisByManager` → `dbService.saveThesis` | thesis status | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 4 |
| 13 | `ClientPortal` thesis | Approve / request changes | `approveThesisByClient` / `rejectThesisByClient` → `dbService.saveThesis` | client approval state | **NO** | `DISPLAY_ONLY_REACT` | **UNDETERMINED** | 4 |
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
| 34 | `ManagerCockpit` / `Modals` create-client | Create client + invite | `dbService.createClient`, `createInvitation`, `authService.createPendingAccount` | tenancy + identity | **NO** | `KEEP_LEGACY` | SPEC-009 adjacent, **UNDETERMINED** | 4 |

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

**Severity P2 · `RETAINED_LEGACY_REMEDIATION_REQUIRED`**

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

**Severity P3 · `LEGACY_BEHAVIOUR_PRESERVED`**

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
| **CR-1** | Onboarding, profile facts, proof wall, source registration, curation, delivery assembly and sending, tasks, evidence, content saves, thesis saves, client creation | **34** (registry items 1–34) | No canonical Application use case exists. Creating one is business authority, which SPEC-010 does not hold. | **UNDETERMINED** — no repository document assigns these to a SPEC's Application layer | Blocks FULL CUTOVER for all 5 pages, blocks Stage B (T-010-403), blocks a minimal `main.ts` (T-010-404), blocks legacy removal (Phase 6) |
| **CR-2** | Strategic Brief creation from a curation entry | 1 (not counted in the 34 — the consumer exists) | Consumer requires the caller to pass the whole `CurationEntry` aggregate | **SPEC-003** (frozen) | Blocks migrating brief creation; approval already migrated |

**FORMAL CHANGE REQUESTS REQUIRED = 2.** Neither is granted, drafted into code, or
worked around in Phase 4.

## CR-2 — SPEC-003 consumer signature (§12)

Investigated in Phase 4; **not modified**. SPEC-003 modifications remain **0**.

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
