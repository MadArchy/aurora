# CR-1 Workstream 1 — Client Lifecycle Application

**Class:** `OPERATIONAL_APPLICATION_CANONICALIZATION`  
**Status:** `COMPLETE`  
**Umbrella:** CR-1 — Cutover-Critical Application Ownership  
**Authorized base checkpoint:** `d5472703aa39d5321417798860c7a5e476837b2b`  
**Implementation SHA:** `63e8db8543bf2a13ae29249b71748402007f959a`  
**Timezone:** America/Bogota

---

## Human authorization (summary)

Formal CR-1 ownership approval ratified five operational Application boundaries and
authorized implementation with a Domain-rule stop gate. Workstream 1 scope:

| Item | Value |
|------|--------|
| Registry IDs | **#34**, **#1** |
| Commands | `CreateClientWithInvite`, `AcceptClientInvitation` |
| Boundary | Client Lifecycle Application |
| Order | First of five (Client → Master → Thesis → Signal Intake → Execution Delivery) |

SPEC-009 remains authentication / RBAC / entitlement / audit policy owner.  
SPEC-010 remains presentation only (`SPEC-010 BUSINESS AUTHORITY = 0`).

---

## Domain-rule stop gate

**NEW DOMAIN RULE REQUIRED = NO**

Existing repository semantics reused without inventing Domain invariants:

- Invitation `PENDING` / `ACCEPTED` / `REVOKED` / `EXPIRED` statuses
- Invitation `expiresAt` (already enforced in `authService.registerFromInvite`)
- Client operational statuses `INVITED` → `ACTIVE` (+ `ARCHIVED` compensation)
- Admin-only create via `requireAdminActor`

---

## Commands

### CreateClientWithInvite (#34)

Intent fields: `firstName`, `lastName`, `email`, optional profile strings, optional
`claimedOrganizationId` (spoof-checked only).

Trusted context from `requireAdminActor`: `organizationId`, `actorId`, `actorRole`.

Orchestration: create client shell → create invitation → create pending account.  
Partial failure: archive client + revoke invitation (Application compensation; no
distributed transaction infrastructure).

### AcceptClientInvitation (#1)

Intent fields: `token`, `password`, `displayName` only.

Application loads invitation + client; validates PENDING + expiry + org match;
activates identity via SPEC-009 port; marks invitation accepted; sets client
`ACTIVE` / `onboardingStatus: IN_PROGRESS`.

---

## Ports / adapters

| Port | Role |
|------|------|
| `ClientShellPort` | Client create / get / update |
| `InvitationPort` | create / getByToken / getById / markAccepted / markRevoked |
| `PendingAccountPort` | pending CLIENT account shell |
| `ClientIdentityActivationPort` | invitation → auth account + session |

Adapters: `src/infrastructure/clientLifecycle/DbClientLifecycleAdapters.ts`  
**TEMPORARY LEGACY** — wrap `dbService` / `authService`; Application owns decisions.

---

## Adoption

| Surface | Model |
|---------|--------|
| `main.ts` create-client / accept-invite | Calls `clientLifecycleConsumer` only |
| Command seam | `clientLifecycleCommands` → same consumer |
| React | Still `KEEP_LEGACY` / LegacyHandoff (presentation); no React→dbService writes |
| Double business authority | **0** |

---

## Security targets

| Target | Value |
|--------|-------|
| CALLER TENANT AUTHORITY | 0 |
| CALLER ORGANIZATION AUTHORITY | 0 |
| CALLER ACTOR AUTHORITY | 0 |
| CALLER ROLE AUTHORITY | 0 |
| CALLER CLIENT ENTITLEMENT AUTHORITY | 0 |
| CALLER SNAPSHOT AUTHORITY | 0 |
| SPEC-010 BUSINESS AUTHORITY | 0 |
| CR-2 / CR-3 modifications | 0 |

---

## Tests

- `tests/cr1ClientLifecycle.test.ts` — Application, tenant attacks, compensation, adoption architecture

---

## Out of scope (unchanged)

Master Profile · Thesis Lifecycle · Signal Intake · Execution Delivery · CR-2 · CR-3 · Phase 5 · Phase 6 · legacy global removal · Firestore production · deployment · new SPEC IDs · new product modules

**T-010-403 / T-010-404** remain `BLOCKED_BY_PRECONDITION` (10 other cutover-spine writes).

**NEXT ACTION after freeze:** `AUTHORIZE_CR1_MASTER_PROFILE_WORKSTREAM`

---

## Checkpoint SHAs

| Role | SHA |
|------|-----|
| Authorized start | `d5472703aa39d5321417798860c7a5e476837b2b` |
| Implementation | `63e8db8543bf2a13ae29249b71748402007f959a` |
| Governance / freeze (content) | this ratification commit (recorded in commit message; tip may pin parent) |
| Tip | branch tip after push |
