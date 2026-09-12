# T603 React Parity Wave P14 — Create Client With Invite (#34)

**Status:** `FORMALLY_ACCEPTED`  
**Starting checkpoint:** `a280ebafebc049d24d42a1f80bdcb2d2a6789e8e`  
**Registry:** `#34` — Create client + invite  
**Role:** ADMIN

---

## Authority

| Field | Value |
|-------|-------|
| CR-1 IMPLEMENTATION SHA | `63e8db8543bf2a13ae29249b71748402007f959a` |
| CR-1 GOVERNANCE/FREEZE SHA | `cf9350fb6de3a9b392b207d34e50714f49c13deb` |
| COMMAND | `CreateClientWithInvite` |
| CONSUMER | `clientLifecycleConsumer.createClientWithInvite` |
| MVP REQUIRED | YES |
| CUTOVER | YES |
| CU STATUS | YES / CR-1 frozen |

---

## Public input (frozen)

| Field | Class |
|-------|-------|
| `firstName` | USER DATA |
| `lastName` | USER DATA |
| `email` | USER DATA |
| `profession?` | USER DATA |
| `company?` | USER DATA |
| `targetMarket?` | USER DATA |
| `claimedOrganizationId?` | COMPATIBILITY ASSERTION (never authority) |

Caller tenant / actor / role / organization authority = **0**.

Trusted context from `requireAdminActor`: `organizationId`, `actorId`, `actorRole=ADMIN`.

`claimedOrganizationId` mismatch → `TENANT_CONTEXT_INVALID` before writes.

---

## Lifecycle (frozen, unchanged)

| Artifact | Initial state |
|----------|---------------|
| Client | `status=INVITED`, `onboardingStatus=NOT_STARTED`, `profileCompleteness=15` |
| Invitation | `status=PENDING`, token port-generated, 7-day expiry |
| Pending account | created via auth port |

Write sequence: client shell → invitation → pending account.  
Partial failure: archive client + revoke invitation (best-effort).  
Audit: `CREATE_CLIENT` (consumer). Notification: manager `ONBOARDING` push with factual token (consumer).

---

## Presentation seam

| Layer | Artifact |
|-------|----------|
| Seam | `clientLifecycleCommands.createClientWithInvite` (returns factual clientId + invitationToken) |
| Hook | `useCreateClientWithInvite` |
| Read | `readPortfolioOverview` (existing) |
| Refresh | `tenantInvalidationKey(scope, 'compatibility')` |
| Surface | `ReactManagerCockpitPage` — native create-client form |

React dbService = **0** · NEW DOMAIN = **0** · NEW APPLICATION = **0** · frozen command modifications = **0**

---

## Exclusions (unchanged)

| Area | Status |
|------|--------|
| #1 AcceptClientInvitation | **LEGACY** — 0 React changes |
| ReactLogin / invite route | **0** modifications |
| Impersonation / view-as-client | **LEGACY** |
| Firestore push | **LEGACY** |
| Pipeline / content generation | **LEGACY** |

---

## Handoff / surface

| Metric | Pre-P14 | Post-P14 |
|--------|---------|----------|
| Cockpit handoff actions | 5 | **3** (infra residuals only) |
| HANDOFF SITES | 11 | **11** (site retained) |
| #34 React presentation | LEGACY | **COMPLETE** |
| ManagerCockpit | READ_ONLY | **PARTIAL** |
| SAFE LEGACY MODULES | 0 | **0** |
| T603 | ZERO_SAFE_SUBSET_DEFERRED | ZERO_SAFE_SUBSET_DEFERRED |

---

## Tests

| Suite | Result |
|-------|--------|
| P14 FOCUSED | **16/16 PASS** |
| CR-1 Client Lifecycle (#34/#1) | **18/18 PASS** |
| FULL CHECK | **2454/2454 PASS** |
| RULES | **91/91 PASS** |
| BUILD | **PASS** |
| FOUNDATION PLAYWRIGHT | **22/22 PASS** |
| P14 E2E | **2/2 PASS** |
| PARITY P1–P14 E2E | **18/18 PASS** |
| PHASE5 E2E | **21/21 PASS** |
| COMBINED E2E | **61/61 PASS** |

---

## Provenance

| Role | SHA |
|------|-----|
| Starting checkpoint | `a280ebafebc049d24d42a1f80bdcb2d2a6789e8e` |
| P14 feature/tests | `845d853e36bfba8ec15058fa7ef1f997ec7869d4` |

**NEXT ACTION:** `T603_REACT_PARITY_POST_P14_FRONTIER_REVIEW`
