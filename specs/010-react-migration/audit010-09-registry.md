# AUDIT010-09 registry — `LEGACY_COMMAND_WITHOUT_CANONICAL_USE_CASE`

**SPEC:** 010-react-migration
**Finding:** AUDIT010-09 · severity **P3**
**Status:** **MIGRATION_BLOCKER_FOR_AFFECTED_CAPABILITY** (registered, non-blocking for the phase as a whole)
**Opened:** Phase 1 · **extended by the Phase-2 command screen**

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

## Enforcement

The rule is enforced mechanically, not by review. `tests/reactMigrationPhase2Architecture.test.ts`
asserts that none of the blocked symbols above appears anywhere under `src/ui/**`,
that the compatibility facade exports only `read*` functions, and that no
component imports a consumer or service command directly instead of going
through the command seam.

## Why this is not RESOLVED

Leaving the affected commands on the legacy path is the correct handling of the
finding, not a resolution of it. The finding closes when each capability either
gains a canonical Application use case (other-SPEC work) or is formally retired.
Until then it stays **MIGRATION_BLOCKER_FOR_AFFECTED_CAPABILITY** at **P3**: no
runtime defect, no capability loss, ordering sound in every case
(gate before effect).
