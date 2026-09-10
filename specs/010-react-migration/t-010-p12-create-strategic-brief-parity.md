# T603 React Parity Wave P12 — Create Strategic Brief from Curation

**Status:** `FORMALLY_ACCEPTED`  
**Starting checkpoint:** `533441e348f3f3d08ebb345dbb7a309b22b06d0d`  
**Capability:** CR-2 / SPEC-003 `createBriefFromCurationEntry`  
**AUDIT010 registry row:** NONE (not #1–#34)

---

## Authority

| Field | Value |
|-------|-------|
| ROLE | ADMIN |
| CONSUMER | `src/services/strategicBriefConsumer.ts` → `createBriefFromCurationEntry` |
| APPLICATION COMMAND | `CreateStrategicBrief` via `useCases.create` |
| CR-2 IMPLEMENTATION SHA | `3eb548487a425e830a4758244326b78a88481521` |
| CR-2 GOVERNANCE SHA | `3c53b49f1eddc1606ad74828708e7dd83c8cd45a` |
| CR-2 FROZEN CHECKPOINT | `e5b62e1648ad4b49c0ff0c282ea62bc5557f76cd` |

---

## Public input

| Layer | Keys |
|-------|------|
| FROZEN PUBLIC INPUT | `curationEntryId`, `destination`, optional `briefId`, optional `now` |
| LEGACY CALLER | `curationEntryId` + `data-destination` from persisted entry row |
| REACT INPUT | `curationEntryId` + factual `destination` from `readyEntries` read |
| SCOPE-DERIVED | `clientId` via hook tenant scope gate only (not passed to consumer) |

---

## Destination authority

| Field | Value |
|-------|-------|
| DESTINATION PUBLIC INPUT | YES (factual passthrough) |
| AUTHORITATIVE DESTINATION SOURCE | React passes `entry.destination` from compatibility read only |
| CALLER DESTINATION AUTHORITY | **0** (no picker; canonical consumer maps `params.destination`) |
| MISMATCH BEHAVIOR | Consumer does not compare to `entry.destination`; React must mirror legacy factual passthrough |

---

## Trusted context

`curationEntryId` → `dbService.getCurationById` → `entry.clientId` → `buildTrustedBriefContext` / CR-3 `requireTenantScope`.

Caller tenant/role/actor/client/thesis/destination/Brief lifecycle authority = **0**. Write-before-auth = **0**.

---

## Thesis / scoring / routing

| Field | Value |
|-------|-------|
| THESIS REQUIRED | YES |
| THESIS SOURCE | `CreateStrategicBrief` → `loadGovernedSignalCluster` |
| MULTI-THESIS | Rejected (`THESIS_CONTEXT_MISMATCH`) |
| React thesis selection | **0** |
| SCORING REQUIRED | YES (`scoringVersion` on signal context) |
| ROUTING REQUIRED | YES (CLEAR + `selectedThesisId`) |
| P12 #22 COMMAND CALLS | **0** |

---

## Destination mapping (`curationDestinationToAuthorizedAction`)

| Destination | Brief allowed | authorizedAction |
|-------------|---------------|------------------|
| TASK_VIDEO | YES | CREATE_CONTENT |
| TASK_ARTICLE | YES | CREATE_CONTENT |
| OPPORTUNITY | YES | CREATE_OPPORTUNITY |
| REFERENCE_READING | YES | CREATE_TASK |
| EVIDENCE | NO | — |
| DISCARD | NO | — |

---

## AI angle / evidence / lifecycle

| Field | Value |
|-------|-------|
| AI ANGLE REQUIRED | NO |
| AI ANGLE FALLBACK | `entry.aiAngle \|\| entry.title` (authoritative reload) |
| P11 PRECONDITION | NO |
| DIRECT AI DEPENDENCY | NO |
| supportingEvidenceIds | `[]` from consumer |
| CREATED STATUS | DRAFT |
| IDEMPOTENCY | Existing DRAFT for scope → `created: false`, same brief id |

---

## Audit / notification

| Field | Value |
|-------|-------|
| AUDIT EVENT | NONE |
| AUDIT OWNER | N/A |
| React audit | **0** |
| SUCCESS TOAST | `Strategic Brief DRAFT created (${brief.id}).` |
| FAILURE TOAST | `error.message` or `Could not create Strategic Brief.` |

---

## React surface

| Field | Value |
|-------|-------|
| REACT SURFACE | `ReactClientWorkspacePage` → `DeliverPanel` ready rows |
| READ SEAM | `readWorkspaceDeliver` → `readyEntries[]` |
| READ EXTENSION | NONE (`destination`, `strategicBriefId` already present) |
| COMMAND SEAM | `briefCommands.createFromCuration` → `runBriefCreateFromCurationPresentation` |
| HOOK | `useCreateBriefFromCuration` |
| VISIBILITY | `destination` + `curationDestinationToAuthorizedAction(destination)` + `!strategicBriefId` |

---

## Boundaries (verified zero)

Domain **0** · Application business **0** · frozen CR-2 consumer **0** · #14 **0** · #15 **0** · Brief approval **0** · #17 **0** · #18 **0** · #22 **0** · React dbService **0** · command seam dbService **0**

---

## Handoff accounting

| Item | Pre-P12 | Post-P12 |
|------|---------|----------|
| HANDOFF SITE COUNT | 12 | 12 |
| DELIVER HANDOFF ACTIONS | 2 | **1** (`montar el briefing` only) |
| SAFE LEGACY MODULES | 0 | 0 |

---

## Tests

| Gate | Result |
|------|--------|
| P12 FOCUSED | **16/16 PASS** |
| CR-2 | **13/13 PASS** |
| FULL VITEST | **2405/2405 PASS** |
| PARITY PLAYWRIGHT P1–P12 | **14/14 PASS** (13 spec files) |
| COMBINED PLAYWRIGHT | **57/57 PASS** |
| RULES | **91/91 PASS** |
| BUILD | **PASS** |

---

## T603 / T604

T603 = `ZERO_SAFE_SUBSET_DEFERRED` · T603 IMPLEMENTATION = NOT AUTHORIZED · T604 = NOT AUTHORIZED

**NEXT ACTION:** `T603_REACT_PARITY_POST_P12_FRONTIER_REVIEW`
