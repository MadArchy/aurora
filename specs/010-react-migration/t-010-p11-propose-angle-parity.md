# T603 React Parity Wave P11 — #15 ProposeAngle

**Status:** `FORMALLY_ACCEPTED`  
**Registry:** #15  
**Presentation model:** `P11_PROPOSE_ANGLE`  
**Starting checkpoint:** `19b0d7bafb3ce8af095b1325bd929a730655a73c`

---

## Implementation provenance

| SHA | Message |
|-----|---------|
| `8589b34` | `feat(react): add propose angle parity` |

**P11 IMPLEMENTATION RANGE** = `8589b34..8589b34`  
**P11 FINAL PRE-ACCEPTANCE CHECKPOINT** = `8589b34`

---

## Registry #15 authority

| Field | Value |
|-------|-------|
| NAME | Propose angle |
| MVP REQUIRED | YES |
| CUTOVER SPINE | YES |
| ROLE | ADMIN |
| COMMAND | `ProposeAngle` |
| CU STATUS | YES / frozen B5 |
| OWNER | CR-1 Execution Delivery Application |

**B5 IMPLEMENTATION/FROZEN SHA** = `ca5dfb24b631eb70250c11154cb4605125665e4d`  
**B5 GOVERNANCE SHA** = `fb4c99f5dd65c66903b4e249accdb0441f60b0e0`  
**CURRENT COMMAND TREE MATCHES FROZEN** = YES

---

## Authority conclusions

| Claim | Result |
|-------|--------|
| #15 ProposeAngle React presentation | **COMPLETE** |
| #15 BUSINESS AUTHORITY | **CANONICALIZED_AND_FROZEN** (unchanged) |
| ADMIN PROPOSE ANGLE | **NATIVE_REACT** |
| Deliver surface | **PARTIAL** (brief create, #17 assembly remain legacy) |
| Brief creation | **LEGACY_PRESENTATION / UNCHANGED** |
| #14 DecideCuration | **NATIVE_REACT / UNCHANGED** |
| #17 Delivery assembly | **LEGACY_PRESENTATION / UNCHANGED** |
| #18 Send | **NATIVE_REACT / UNCHANGED** |
| #22 | **PARTIAL_CU / UNCHANGED** |
| NEW DOMAIN RULE | **0** |
| NEW APPLICATION BUSINESS BOUNDARY | **0** |
| FROZEN COMMAND MODIFICATIONS | **0** |
| AI GATEWAY | **FROZEN / UNCHANGED** |

---

## Exact #15 public input

**Consumer public input keys:**

`requestedClientId` · `curationEntryId` · optional `claimedOrganizationId` · optional `claimedClientId`

**Application frozen input keys:**

`trusted` · `curationEntryId` · optional `claimedOrganizationId` · optional `claimedClientId`

**React public input keys:**

`curationEntryId` (+ scope-derived `requestedClientId` via hook)

**EXTRA AUTHORITY KEYS** = **0**

---

## Trusted authority source

| Dimension | Source |
|-----------|--------|
| Tenant / organization / actor / role | `executionDeliveryConsumer.gate(requestedClientId)` → `trustedFrom(g)` |
| Target client | validated `requestedClientId` against session entitlement |
| Curation entry | authoritative reload inside frozen `ProposeAngle` |
| Thesis | `resolveThesisId` inside Application from Brief or signal routing — **no React thesis selection** |
| Caller tenant/role/actor/lifecycle/thesis/Brief/evidence authority | **0** |

---

## Thesis resolution contract

| Field | Value |
|-------|-------|
| THESIS REQUIRED | YES |
| THESIS SOURCE | `entry.strategicBriefId` → brief.thesisId; else `signal.routingDecision.selectedThesisId` |
| MULTI-THESIS BEHAVIOR | Native — governed thesis from Brief or CLEAR routing only |
| THESIS_NOT_RESOLVED | compat return; legacy message preserved |
| NO SILENT WINNER | YES |
| NO DEFAULT THESIS | YES |

---

## Brief dependency

| Field | Value |
|-------|-------|
| BRIEF REQUIRED | NO (optional thesis source via existing Brief on entry) |
| BRIEF STATUS REQUIRED | N/A unless Brief-linked thesis path used |
| P11 Brief create/approve | **0** |

---

## Evidence / AI Gateway

| Field | Value |
|-------|-------|
| EVIDENCE INPUT | `entry.title` · `entry.snippet` at gate-time reload |
| AI PORT | `AdvisorCurationAnglePort.generateAngle` |
| PROMPT OWNER | Application / SPEC-005 gateway |
| STRUCTURED OUTPUT | `advisorCurationAngle` schema |
| React direct AI/provider/prompt | **0** |
| AUDIT EVENT | **none** (B5 frozen) |
| NOTIFICATION OWNER | presentation toast only (legacy-compatible strings) |

---

## Persistence

| Field | Value |
|-------|-------|
| PERSISTED FIELD | `aiAngle` via `CurationAnglePersistencePort.setAngle` |
| REGENERATE | Presentation blocks when `aiAngle` exists (factual read predicate) |

---

## Read / command seam

| Seam | Location |
|------|----------|
| READ EXTENSION | `readWorkspaceDeliver` → `readyEntries[]` (id, signalTitle, destination, rationale, strategicBriefId, aiAngle, stage) |
| COMMAND SEAM | `executionDeliveryCommands.proposeAngle` → `runCurationProposeAnglePresentation` → frozen consumer |
| HOOK | `useProposeAngle` |
| REACT SURFACE | `ReactClientWorkspacePage` → `DeliverPanel` → ready rows |

**No `canProposeAngle` business flag invented.**

---

## Handoff accounting

| Metric | Pre-P11 | Post-P11 |
|--------|---------|----------|
| TOTAL HANDOFF SITES | 12 | 12 |
| DELIVER HANDOFF ACTIONS | 3 | 2 |
| SAFE LEGACY MODULES | 0 | 0 |

Deliver handoff actions removed: `proponer ángulo`. Remaining: `crear el Strategic Brief`, `montar el briefing`.

---

## Test matrix (mandatory green)

| Suite | Result |
|-------|--------|
| P11 FOCUSED | **16/16 PASS** |
| B5/#15 FROZEN | **20/20 PASS** |
| P10 | **14/14 PASS** |
| FULL VITEST | **2389/2389 PASS** |
| PARITY PLAYWRIGHT P1–P11 | **12/12 PASS** |
| RULES | **91/91 PASS** |
| BUILD | **PASS** |

---

## T603 / T604

| Field | Value |
|-------|-------|
| T603 | ZERO_SAFE_SUBSET_DEFERRED |
| T603 IMPLEMENTATION | NOT_AUTHORIZED |
| T604 | NOT_AUTHORIZED |
| SPEC-010 CODE_COMPLETE | NO |
| MVP CODE_COMPLETE | NO |

**NEXT ACTION:** `T603_REACT_PARITY_POST_P11_FRONTIER_REVIEW`
