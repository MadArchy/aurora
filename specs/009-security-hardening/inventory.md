# SPEC-009 Phase 0 Inventory

| Campo | Valor |
|-------|--------|
| **Spec** | `009-security-hardening` |
| **Phase** | 0 only (`T-009-00`, `T-009-00b`, `T-009-00c`) |
| **Branch checkpoint** | `spec/009-security-hardening` (created from dirty `main`; **no** reset; working tree preserved) |
| **Baseline HEAD** | `3d7ea20b5c997d035736abdeb97d30d33a996bfc` |
| **Repo state at inventory** | **Dirty** — pre-existing piloto/constitution work retained on branch |
| **Date** | 2026-08-22 |
| **Phase 0 final correction** | Applied — Q1 (Rules ≠ filters), SEC-009-020, claims no-default, A21–A23 |
| **Scope** | Read-only analysis of call sites + types + seed; **no** rules/app/data changes |

---

## Git checkpoint (gate 1)

```text
Branch: spec/009-security-hardening
Prior:  main @ 3d7ea20 (dirty)
Action: git checkout -b spec/009-security-hardening
```

**Recommendation:** keep implementing 009 only on this branch; do not force-clean the dirty tree; commit Spec/inventory when human requests. Optional later: stash-free checkpoint commit of Spec docs only.

**Do not:** `reset --hard`, discard untracked Spec/piloto work, or deploy rules from Phase 0.

---

## Architecture finding (critical)

Firestore client SDK usage is **centralized**:

1. UI / `dbService` mutates in-memory snapshot.
2. `saveAll` → `scheduleFirestorePush(exportSnapshot())`.
3. `importSnapshotToFirestore` → `writeBatch` + `batch.set(doc, row, { merge: true })` for every client/row in memory.

There are **no** production `updateDoc` / `addDoc` / `deleteDoc` / `query`+`where` / `collectionGroup` call sites in `src/` application code.

**Security implication:** field-level and state rules must treat merge-`set` as CREATE-or-UPDATE; CLIENT can only push what is in memory after hydrate (`[user.clientId]`), but a full-document merge can still attempt to change any field present on the object.

---

## A. Firestore operations inventory

### A.1 Production SDK call sites (`src/`)

| # | File | Function | Operation | Path / collection | Actor (runtime) | Org scope | Client scope | Query constraints | Fields written | Status transition | Workflow timestamps | Current security assumption | Expected under SPEC-009 |
|---|------|----------|-----------|-------------------|-----------------|-----------|--------------|-------------------|----------------|-------------------|---------------------|----------------------------|-------------------------|
| 1 | `src/services/firestore/sync.ts` | `importSnapshotToFirestore` | `writeBatch` + `batch.set` merge | `clients/{id}` | ADMIN or CLIENT (whoever is authoritative) | whatever is in snapshot rows | iterates `snapshot.clients` | none (doc by id) | **entire client object** | n/a | `updatedAt` if present on object | ADMIN/CLIENT ownsClient; ADMIN cross-org OK today | CREATE/UPDATE envelope; ADMIN org-only; CLIENT only own client; preserve org/clientIds; field/state rules |
| 2 | same | same | `batch.set` merge | `clients/{id}/{sub}/{docId}` for all `COLLECTION_MAP` subs | same | row.organizationId if present | `itemsForClient` filter | none | **entire row** | depends on row | ISO strings on row | same | same + per-collection CLIENT allowlists |
| 3 | same | same | `batch.set` merge | `clients/{id}/profile/data` | same | profile.organizationId | keyed by client.id | none | entire profile | onboarding statuses | `updatedAt` | ownsClient write | CLIENT allowlist profile fields; envelope |
| 4 | same | same | `batch.set` merge | `clients/{id}/dossier/data` | typically ADMIN (no CLIENT portal writer found) | dossier.organizationId | keyed by client.id | none | entire dossier | n/a | n/a | ownsClient write today | CLIENT deny write; ADMIN org-scoped |
| 5 | `sync.ts` | `listFirestoreClientIds` | `getDocs` | `clients` | ADMIN (bootstrap/hydrate); theoretically any signed-in | **none in query** | **none** | **unfiltered collection list — HARD INCOMPATIBLE with org-scoped LIST rules** | — | — | — | Incorrectly assumed rules would filter list results | **Must change app** before org-scoped deploy: `query(collection,'clients', where('organizationId','==', tokenOrg))` (or equivalent tenant-scoped architecture). **Security Rules are not filters.** |
| 6 | `sync.ts` | `pullClientDataFromFirestore` | `getDoc` | `clients/{clientId}` | ADMIN (many ids) or CLIENT (own id) | path only | path clientId | by id | — | — | — | ownsClient | + org match on resource |
| 7 | `sync.ts` | `pullClientDataFromFirestore` | `getDocs` | `clients/{clientId}/{sub}` × `CLIENT_SUBCOLLECTIONS` | same | path | path | **collection list under client path** (no where) | — | — | — | ownsClient | path+org; compatible if ownsClient/org OK |
| 8 | `sync.ts` | `pullClientDataFromFirestore` | `getDoc` | `.../profile/data`, `.../dossier/data` | same | path | path | by id | — | — | — | ownsClient | + org |
| 9 | `sync.ts` | `startFirestoreRealtimeSync` → `listen` | `onSnapshot` | `clients/{clientId}/{sub}` for REALTIME_SUBS + `evidence` | ADMIN/CLIENT for hydrated ids | path | path | collection listen, no where | — | — | — | ownsClient | same; **compatible** (path-scoped) |
| 10 | `src/services/auth.ts` | `syncFirestoreSession` | orchestrates hydrate + realtime | via sync | ADMIN all clients / CLIENT `[user.clientId]` | claims org unused in queries today | yes for CLIENT | — | — | — | — | role chooses id list | must not hydrate cross-org clients |
| 11 | `src/services/db.ts` | `hydrateFromRemote` / `bootstrapFirestoreIfEmpty` | calls list + pull + import | via sync | ADMIN | unscoped list today | — | — | seed snapshot write | — | — | first ADMIN bootstraps | bootstrap only same-org; list org-filtered by rules |

**Not found in `src/` production:** `addDoc`, `updateDoc`, `deleteDoc`, `query`+`where`, `collectionGroup`.

### A.2 Cloud Functions / Admin SDK

| # | File | Function | Operation | Path | Actor | Notes | SPEC-009 |
|---|------|----------|-----------|------|-------|-------|----------|
| 12 | `functions/src/index.ts` | `setPosturaClaims` | Auth `setCustomUserClaims` | n/a | callable ADMIN | sets role/org/clientId; default org `org_aurora_01` | keep org required; no PLATFORM_ADMIN |
| 13 | `functions/src/lib/scheduledIngest.ts` | ingest | Admin Firestore writes | `sources`, `signals` (+ increments) | system | Admin SDK bypasses rules | out of rules path; ensure written docs have envelope fields |

### A.3 Scripts

| # | File | Operation | Notes |
|---|------|-----------|-------|
| 14 | `scripts/provision-firebase.mjs` | `createUser` / `updateUser` / `setCustomUserClaims` | Demo users; example SA path **inside repo tree** (`...\AURORA\secrets\...`) — conflicts with SEC-009-012 target |
| 15 | `scripts/firebase-prep-check.mjs` | checks | Mentions SA under `secrets/` |

### A.4 Tests only (not prod)

| # | File | Ops |
|---|------|-----|
| 16 | `tests/firestore.rules.test.ts` | `setDoc` / `getDoc` / `updateDoc` against emulator |

### Call-site counts

| Category | Count |
|----------|-------|
| Production Firestore SDK clusters (`src/services/firestore/sync.ts` + auth/db orchestration) | **11** rows above (1–11); **1 write gateway** + **3 read/list patterns** + realtime |
| Storage SDK ops | **3** (`uploadBytes`, `getDownloadURL`, `deleteObject`) |
| Auth claims writers | **2** (provision script + `setPosturaClaims`) |
| Admin scheduled Firestore | **1** module |
| `collectionGroup` | **0** |
| Client `where(` | **0** |
| Direct `updateDoc` in app | **0** |

---

## B. Firestore queries inventory

| ID | Location | Shape | Constraints | Compatible with org-hardened rules? | Notes |
|----|----------|-------|-------------|-------------------------------------|-------|
| Q1 | `listFirestoreClientIds` | `getDocs(collection(db,'clients'))` | none | **NO — hard-incompatible / must change app** | **Firestore Security Rules are not filters.** An unscoped collection query is rejected (or is unsafe) under tenant LIST rules that require `organizationId` constraints. **Frozen fix:** use `where('organizationId','==', authenticatedOrganizationId)` (or equivalent demonstrably tenant-scoped architecture) **before** deploying org-scoped rules. Do **not** rely on rules to silently return only same-org docs. |
| Q2 | `pullClientDataFromFirestore` sub `getDocs` | `clients/{id}/{sub}` | path clientId | **Yes** | Path-scoped. |
| Q3 | `onSnapshot` realtime | same | path clientId | **Yes** | Path-scoped. |
| Q4 | collectionGroup | — | — | n/a | **None** |
| Q5 | `query`+`where` client SDK | — | — | n/a | **None today** — Q1 fix will introduce first legitimate `where` |

### Incompatible / high-risk query patterns

| Severity | Finding |
|----------|---------|
| **1 hard-incompatible (requires app change before org-scoped deploy)** | **Q1** `listFirestoreClientIds` unscoped `getDocs(clients)` — Rules are not filters |
| **High** | Full-snapshot `batch.set` merge push (actor-unaware) — see SEC-009-020 |
| **Medium** | Realtime does not listen to all subs — OK if pull ids scoped |

**Count of hard-incompatible / high-risk query patterns requiring app change:** **1** (Q1).  
**Additional high-risk write pattern (not a query):** actor-unaware full-snapshot persistence (SEC-009-020).

---

## C. Writes inventory (logical CLIENT mutations → Firestore via merge)

Source of truth: `dbService` methods + `main.ts` ClientPortal bindings (see explore evidence). Actor = CLIENT unless noted.

### C.1 `clients/{clientId}`

| Fields CLIENT may change (call sites) | Timestamps |
|---------------------------------------|------------|
| `userId` (`bindClientUserId`) | `updatedAt` ISO |
| onboarding: `onboardingStatus`, `profileCompleteness`, `status`, display fields via `updateClient` / `applyOnboardingStep` | `updatedAt` ISO |
| `completedTasksCount` (on task complete) | `updatedAt` |

### C.2 `deliveries`

| Fields | Transition | Timestamps |
|--------|------------|------------|
| `status`, `acknowledgedAt`, optional `clientAckNote` | `SENT` → `ACKNOWLEDGED` | `acknowledgedAt` = `new Date().toISOString()` (**client clock**) |

Also: `notifyManager` → notification CREATE under same client.

### C.3 `tasks`

| Fields | Transitions (from call sites + `TASK_TRANSITIONS`) | Timestamps |
|--------|-----------------------------------------------------|------------|
| `status` | ASSIGNED\|DRAFT→VIEWED; ASSIGNED\|VIEWED\|DRAFT→IN_PROGRESS; →COMPLETED | `completedAt` ISO when COMPLETED |
| `clientNotes`, `evidenceUrl` | no status / with complete | — |

### C.4 `contents`

| Fields | Pipeline transitions CLIENT | Timestamps |
|--------|----------------------------|------------|
| `title`, `body`, `clientFeedback`, `clientReviewBaseline`, `pipelineStatus`, `status`, `updatedAt` | article: `sent_to_client`↔`client_in_progress`/`client_submitted`; video submit from `sent_to_client`\|`client_in_progress`\|`client_submitted` → `manager_finalizing` | `updatedAt` (trusted serverTimestamp) |

**F-009-A MODEL B (frozen):** `stateHistory` is **non-authoritative**. Canonical workflow state = `pipelineStatus`; trusted audit clock = `updatedAt`. CLIENT Firestore persist strips `stateHistory`; Rules deny CLIENT mutation. Local `db.transitionContentPipeline` may still append history in-memory for admin/local UX only — not a CLIENT security audit trail. Future server-managed append-only transitions are out of SPEC-009 scope unless product requires them later.

#### stateHistory usage inventory (F-009-A)

| File | Function / site | R/W | UI dep | Business dep | Audit dep |
|------|-----------------|-----|--------|--------------|-----------|
| `src/types/index.ts` | `ContentStateHistoryEntry`, `ContentItem.stateHistory?` | type | no | optional field | schema only |
| `src/services/db.ts` | `transitionContentPipeline` | W (local append) | no | local memory only | local ISO clock (not trusted Firestore) |
| `src/services/db.ts` | `migrateContentPipelineFields` | W (backfill empty) | no | legacy local migrate | no |
| `src/data/juanCampaignSeed.ts` | seed contents | W (fixture) | no | demo seed | demo |
| `src/services/firestore/sync.ts` | CLIENT prepareDoc strip | W deny / strip | no | CLIENT persist | strips before write |
| `firestore.rules` | `clientContentStateHistoryOk` / allowlist | DENY mutate | n/a | security | deny forge |
| `src/main.ts` / UI | — | none found | **no reads** | uses `pipelineStatus` | — |
| `tests/firestore.rules.test.ts` | forged history DENY; transition without history ALLOW | test | n/a | n/a | evidence |

### C.5 `feedbackEvents`

| Op | Fields |
|----|--------|
| CREATE | full `FeedbackEvent` incl. `organizationId`, `clientId`, `createdAt` ISO |

### C.6 `opportunities`

| Fields | Transitions | Timestamps |
|--------|-------------|------------|
| `clientDecision`, `clientNotes`, `status`, `lifecycleStage`, `submissionChecklist`, `submittedAt` | `SENT_TO_CLIENT`\|`RECOMMENDED` → `IN_PROGRESS` (accept) or `REJECTED`; `IN_PROGRESS` → `COMPLETED` on submit | `submittedAt` ISO |

### C.7 `notifications` — **T-009-04 CREATE schema FROZEN**

| Op | Policy |
|----|--------|
| CREATE (CLIENT) | **Only manager-alert flow** (`notifyManager` → `notificationService.push`) |
| UPDATE (CLIENT) | `read: false → true` only |
| DELETE (CLIENT) | **DENY** |

**Exact CREATE allowlist (required keys):**  
`id`, `userId`, `clientId`, `organizationId`, `type`, `title`, `body`, `read`, `createdAt`

**Optional keys:** `href`, `targetId`

**Invariants:**
- `organizationId` == authenticated token org (== client.organizationId)
- `clientId` == path clientId == token.clientId
- `read` initial == `false`
- `createdAt` == `request.time` (serverTimestamp on write)
- `type` ∈ `TASK_ASSIGNED` \| `CONTENT_REVIEW` \| `OPPORTUNITY` \| `ONBOARDING` \| `THESIS` \| `SYSTEM` \| `BRIEFING`
- Arbitrary extra fields → **DENY**

**Type:** `NotificationItem.organizationId` required (Phase 2).

### C.8 `profile/data`

| Fields | Notes |
|--------|-------|
| nested profile + facts + CV text; `updatedAt` | types include org+client on profile |

### C.9 `results` / `evidence`

| Op | Fields | Risk |
|----|--------|------|
| CREATE result | includes hardcoded `organizationId: 'org_aurora_01'` in some UI paths | brittle multi-org |
| CREATE evidence | same hardcoded org in places | same |

### C.10 `theses` (**Spec clarification required**)

| Fields CLIENT writes | Evidence |
|----------------------|----------|
| `clientApprovalStatus`, `clientApprovedAt`, `clientFeedback`, `pendingRevision` clear/apply, `status` (e.g. UNDER_REVIEW→DRAFT on reject), `updatedAt`, `updatedBy` | `approveThesisByClient` / `rejectThesisByClient` + `saveThesis` |

**Conflict:** current `firestore.rules` and draft SEC-009-006 treated theses as manager-only write. **Inventory freezes limited CLIENT UPDATE** (approval fields only). CREATE/DELETE remain ADMIN.

### C.11 Not CLIENT-written (frozen)

`signalOutcomes`, `sources`, `signals`, `curation`, `recommendations`, `campaigns`, `campaignMilestones`, `advices`, `aiRuns`, `proofWallItems` (no portal writer), `dossier` (no CLIENT save).

### C.12 ADMIN / system writes

Entire snapshot bootstrap/import; manager UI mutators; `scheduledIngest` sources/signals; `recordSignalOutcome` (**manager only**, `main.ts` radar).

---

## D. State transition inventory (CLIENT — real domain only)

**Canonical frozen matrices live in `spec.md`.** This section mirrors evidence; deny-by-default for anything not listed.

### Deliveries (`DeliveryPackageStatus` + `DELIVERY_TRANSITIONS`)

| OLD | ALLOWED_NEW (CLIENT) |
|-----|----------------------|
| SENT | ACKNOWLEDGED |
| DRAFT | — |
| ACKNOWLEDGED | — |

### Tasks (`TaskStatus` + UI call sites)

| OLD | ALLOWED_NEW (CLIENT) |
|-----|----------------------|
| DRAFT | VIEWED, IN_PROGRESS |
| ASSIGNED | VIEWED, IN_PROGRESS |
| VIEWED | IN_PROGRESS, COMPLETED |
| IN_PROGRESS | COMPLETED |
| COMPLETED / CANCELLED / REJECTED | — (deny; no CLIENT task-REJECTED call site) |

CANCELLED / DRAFT→ASSIGNED: manager-only.

### Content pipeline + video

| OLD | ALLOWED_NEW (CLIENT) |
|-----|----------------------|
| sent_to_client | client_in_progress, client_submitted |
| client_in_progress | client_submitted (+ keep on save) |
| sent_to_client \| client_in_progress \| client_submitted | → `manager_finalizing` via video submit path only (intermediates on that path) |
| planned / generating / draft_ready / manager_review / qa_check / … | — (deny even if graph has a path) |

Legacy: CLIENT_REVIEW ↔ CHANGES_REQUESTED / CLIENT_APPROVED as in `spec.md`.

### Opportunities

| OLD | ALLOWED_NEW (CLIENT) |
|-----|----------------------|
| SENT_TO_CLIENT | IN_PROGRESS (`clientDecision=ACCEPTED`) or REJECTED |
| RECOMMENDED | IN_PROGRESS (`clientDecision=ACCEPTED`) or REJECTED |
| IN_PROGRESS | COMPLETED (`submitOpportunity`) |
| ACCEPTED | IN_PROGRESS (checklist force) |
| REJECTED / COMPLETED / ARCHIVED / DETECTED / UNDER_REVIEW | — |

### Thesis approval (`ThesisApprovalStatus` / `ThesisStatus`)

| Field/status | CLIENT allowed |
|--------------|----------------|
| `clientApprovalStatus` PENDING → APPROVED | yes (`approveThesisByClient`) |
| PENDING → CHANGES_REQUESTED | yes (`rejectThesisByClient`) |
| `status` UNDER_REVIEW → DRAFT on reject | yes (domain helper) |
| ACTIVE + pendingRevision apply on approve | yes (domain helper) |

### Notifications

| OLD | NEW |
|-----|-----|
| `read: false` | `read: true` |

---

## E. Timestamp inventory

| Field | Entity | Set by CLIENT? | Mechanism today | SPEC-009 freeze |
|-------|--------|----------------|-----------------|-----------------|
| `acknowledgedAt` | deliveries | yes | `toISOString()` | must be `request.time` / serverTimestamp policy; forged deny |
| `completedAt` | tasks | yes | ISO on COMPLETED | same |
| `updatedAt` | contents, client, profile, theses, … | yes | ISO | workflow paths: prefer request.time; document if too broad for all updatedAt |
| `createdAt` | feedbackEvents, notifications, results, evidence | yes on create | ISO | CREATE: allow request.time equality or accept create-time server policy in Phase 2 |
| `submittedAt` | opportunities | yes | ISO | forged deny / request.time |
| `clientApprovedAt` | theses | yes | ISO (`now` in helper) | forged deny / request.time |
| stateHistory[].at | contents | n/a (F-009-A MODEL B) | local ISO only | **non-authoritative**; CLIENT strip + Rules deny mutate |
| `decidedAt` | — | **not found** in types/call sites | — | **n/a** (do not invent) |
| `reviewedAt` / `clientReviewedAt` | — | **not found** as field name | — | **n/a**; content uses `updatedAt` + history |

**No `serverTimestamp()` usage** on client push path today.

---

## F. Security envelope matrix (T-009-00b + T-009-00c)

### Type-level presence

| Collection / doc | organizationId in type | clientId in type | Seed/builders typically set both? |
|------------------|------------------------|------------------|-----------------------------------|
| `organizations/{orgId}` | is the id | n/a | n/a |
| `clients/{id}` | **yes** | n/a | yes |
| `signals` | yes | optional | yes in seed |
| `tasks` | yes | yes | yes |
| `curation` | yes | yes | yes |
| `deliveries` | yes | yes | yes |
| `contents` | yes | yes | yes |
| `opportunities` | yes | yes | yes |
| `results` | yes | yes | yes |
| `theses` | yes | yes | yes |
| `campaigns` / `campaignMilestones` | yes | yes | yes |
| `evidence` | yes | yes | yes |
| `advices` | yes | yes | yes |
| `feedbackEvents` | yes | yes | yes |
| `signalOutcomes` | yes | yes | yes |
| `proofWallItems` | yes | yes | yes |
| `sources` | yes | optional | yes |
| `recommendations` | **NO orgId** | yes | **backfill orgId required** if envelope denormalized |
| `notifications` | **NO orgId** | optional | **backfill orgId (+ ensure clientId) required** |
| `aiRuns` | yes (AIRunRecord) | optional | check writers |
| `profile/data` | yes | yes | yes |
| `dossier/data` | yes | yes | yes |
| `auditLogs` | **verify at write time** | — | admin logs |

### Frozen envelope strategy (T-009-00c)

| Collection | Security envelope | orgId denormalized | clientId denormalized | parent get() | Query requirements | Migration required | Rationale |
|------------|-------------------|--------------------|-----------------------|--------------|--------------------|--------------------|-----------|
| `clients` | `resource.data.organizationId` | yes (on doc) | n/a | no | **Q1 must use `where organizationId == auth org`** (Rules are not filters) | verify existing prod docs | list + ADMIN org scope |
| subcollections with both in type | row envelope | **yes** | **yes** | **no** (prefer) | path already client-scoped | verify missing fields in prod | immutable envelope; enables future collectionGroup; avoids get(parent) |
| `notifications` | add orgId + require clientId | **yes (add)** | **yes (require)** | no | path list | **yes** | type gap; CREATE by CLIENT |
| `recommendations` | add orgId | **yes (add)** | yes | no | path list | **yes** | type gap |
| `profile` / `dossier` | doc envelope | yes | yes | no | get by id | verify | already in types |
| `auditLogs` | org on log or adminOfOrg only | prefer yes | optional | n/a | admin list | if missing | SEC-009-010 |

**Decision frozen:** Prefer **denormalized immutable `organizationId` (+ `clientId` when applicable)** on tenant-scoped docs. **Do not** rely on `get(parent)` as primary envelope for subcollections. Parent get remains emergency fallback only if a collection cannot be backfilled before deploy (document per exception — none accepted at freeze except temporary PARTIAL).

**Phase 1 TEMPORARY exception (resolved T-009-14e):** Former `sameOrgAsClient` / `ownsClient` used `get(/clients/{clientId})` for **all** CRUD. **Removed for normal auth.**

**T-009-14e final model:** Existing-resource auth = denormalized envelope only. **ADMIN CREATE exception:** one `get(clients/{clientId})` via `adminCreateParentClientOrgOk` / `parentClientDoc` to prove path client ∈ token org. CLIENT CREATE = token/path/request only.

Final helpers: `rootClientReadable`, `existingSubEnvelopeValid`, `createSubEnvelopeValid`, `clientCreateSub`, `adminCreateSub` (+ integrity get), `adminWriteSub`, `adminDeleteSub`, `ownsSubResource`.

### T-009-14e final envelope matrix (rules authorization)

| Path | Parent get (before) | Normal auth parent get (after) | ADMIN CREATE integrity get | CREATE rule |
|------|---------------------|-------------------------------|----------------------------|-------------|
| `clients/{clientId}` | yes (all CRUD) | **no** | **no** (no parent client doc) | `createRootClientEnvelopeValid` |
| Subcollections (22) | yes (all CRUD) | **no** on READ/UPDATE/DELETE | **yes** on ADMIN CREATE only | `adminCreateSub` / `clientCreateSub` |
| `profile/data` | same | **no** on READ/UPDATE/DELETE | **yes** on ADMIN CREATE | split create/update |
| `signalOutcomes` | same | **no** on READ/UPDATE/DELETE | **yes** on ADMIN CREATE | admin-only read |
| `auditLogs` | n/a | n/a | **no** | admin org on request |

**Transition safety:** Repo `firestore.rules` = post-backfill final state. Production keeps prior deployed rules until T-009-16 backfill verified + T-009-18 deploy.

| Step | Task | What changes |
|------|------|----------------|
| Finalize rules in repo | **T-009-14e** ✅ | Envelope + ADMIN CREATE integrity get; tests + sync envelope stamp |
| Final security verification | **T-009-14** ✅ | SEC-009 + acceptance audit; 91/286 green |
| CODE_COMPLETE | **T-009-15** | No further rules/app implementation changes |
| Prod backfill | **T-009-16** | Data only (`migration.md`) — **no** rules code change |
| Deploy | **T-009-18** | Deploy finalized rules after verified backfill |

Must not ship `get(parent)` as permanent without Spec exception.

---

## G. Storage asset inventory

| Path pattern | Code | Ops | Roles (call sites) | MIME (observed) | Max size | create | update metadata | delete |
|--------------|------|-----|--------------------|-----------------|----------|--------|-----------------|--------|
| `organizations/{orgId}/clients/{clientId}/recordings/{taskId}.webm` | `storageRecordingPath` + `uploadRecordingToStorage` / `resolveRecordingUrl` / `removeRecording` | uploadBytes, getDownloadURL (+fetch blob), deleteObject | CLIENT upload/read/delete on own recordings; ADMIN may resolve/delete via same helpers if UI calls | MediaRecorder preferred `video/webm` / `video/webm;codecs=vp9,opus`; upload sets `contentType` via `resolveRecordingContentType` | **90_000_000** (1 Mbps × 10 min + 20%) | CLIENT/ADMIN same-tenant | **none** (`updateMetadata` deny; overwrite = delete-then-create) | CLIENT/ADMIN via `removeRecording` when called |

**Only Storage path family found in repo.**

Frozen matrix row (Phase 3):

| path | allowed roles | allowed MIME | max size | create | update | delete |
|------|---------------|--------------|----------|--------|--------|--------|
| `organizations/{orgId}/clients/{clientId}/recordings/{taskId}.webm` | CLIENT (own clientId + org); ADMIN (same org) | `video/webm`, `video/webm;codecs=*` | **90_000_000** (Phase 3: 1 Mbps × 10 min + 20%) | yes | no | yes |

---

## H. Claims / provision inventory

| Source | Claims set |
|--------|------------|
| `scripts/provision-firebase.mjs` | ADMIN: role + **required** organizationId + clientId null; CLIENT: role + **required** organizationId + **required** clientId; validates before `setCustomUserClaims`; SA must be **outside** repo |
| `functions` `setPosturaClaims` | same via `buildPosturaClaimsOrThrow` — **no** `org_aurora_01` default |
| `parsePosturaClaims` (client + functions) | missing org / CLIENT clientId → **null** (session fail-closed) |

**Risks addressed in Phase 4:** default tenant removed; SA examples moved external (SEC-009-012).

### H.2 Admin SDK Firestore writers (T-009-10b / A24)

| Writer | File | Collection / path | organization source | client source | validation | scope | tests |
|--------|------|-------------------|---------------------|---------------|------------|-------|-------|
| `runScheduledIngest` → `pollOneSource` | `functions/src/lib/scheduledIngest.ts` | `clients/{clientId}/signals/{id}` | `source.organizationId` via `requireTenantOrganizationId` | path `clientId` + `requireMatchingClientId` | fail/skip if missing org; no Rules reliance | system/tenant | `tests/adminTenantEnvelope.test.ts` |
| same | same | `clients/{clientId}/sources/{id}` (merge metrics) | n/a (merge metrics only; envelope not rewritten) | path | — | system | — |
| same | same | `clients/{clientId}/sourceRuns` | same resolved `organizationId` | same `clientId` | envelope required before add | system/tenant | envelope helpers |
| `setPosturaClaims` | `functions/src/index.ts` | Auth custom claims only | request `organizationId` | CLIENT only | `buildPosturaClaimsOrThrow` | identity | `tests/posturaClaimsCore.test.ts` |
| `scripts/provision-firebase.mjs` | Auth only | Auth custom claims | explicit demo fixture `DEMO_ORG_ID` | explicit per user | `validateClaims` | bootstrap | claims core tests |

**No other** production `admin.firestore()` / `getFirestore()` writers found under `functions/`, `server/`, or `scripts/` (provision is Auth-only).

---

## I. Required app call-site changes (Phase 1–4)

| Area | Change |
|------|--------|
| `sync.importSnapshotToFirestore` / `scheduleFirestorePush` | Scope push to allowed clientIds; never push other tenants from CLIENT memory |
| `listFirestoreClientIds` | **Required change:** tenant-scoped query (`where organizationId == auth org`) or equivalent; **never** unscoped collection list + hope rules filter |
| `importSnapshotToFirestore` / CLIENT push | **SEC-009-020:** actor-aware persistence — CLIENT batch must not include manager-only resources |
| Notifications | Persist `organizationId` (+ required `clientId`) on create; create allowlist (not arbitrary) |
| Recommendations | Persist `organizationId` on create (ADMIN) |
| Results/evidence UI | **Remove hardcoded `org_aurora_01`**; use session/client org (A22) |
| Timestamps | Prefer `serverTimestamp()` on workflow fields; align with rules `request.time` |
| Thesis rules vs app | Allow CLIENT update allowlist (approval fields only) — deny strategic fields (A23) |
| `setPosturaClaims` / provision | Missing `organizationId` → **validation failure**; no default tenant — **DONE Phase 4** |
| Admin SDK writers | Envelope verification (T-009-10b) — **DONE Phase 4** |
| Storage rules | Per-asset matrix; wire contentType from blob — **DONE Phase 3** |
| Prep/provision docs | External SA path — **DONE Phase 4** |

---

## J. Migration impact

| Item | Backfill? |
|------|-----------|
| Ensure all `clients/*` have `organizationId` | verify; backfill if any missing |
| Subcollections missing org/clientId | verify prod; seed usually OK |
| `notifications` add `organizationId` | **yes** |
| `recommendations` add `organizationId` | **yes** |
| Claims reprovision / re-login | yes at deploy |
| Storage objects | path already org-prefixed; no MIME backfill |
| **Do not execute backfill in Phase 0** | confirmed |

**Collections/docs requiring backfill (known type gaps):** at least **`notifications`**, **`recommendations`**; plus any prod docs missing envelope fields (count TBD at dry-run — **not measured against live Firebase in Phase 0**).

---

## K. Decisions frozen

1. **Envelope:** denormalized immutable `organizationId` (+ `clientId`) on tenant-scoped docs; no primary parent-get.
2. **ADMIN:** always org-scoped; no global admin.
3. **Q1 query strategy:** `listFirestoreClientIds` **must** use rules-compatible tenant query (`where('organizationId','==', authenticatedOrganizationId)` or equivalent). **Security Rules are not filters.** App change required before org-scoped deploy.
4. **SEC-009-020 actor-aware persistence:** CLIENT persistence gateway must only attempt authorized client-write resources; must not batch-write manager-only collections from memory (T-009-06p / A21).
5. **Hardcoded orgId:** production UI write paths must not use `org_aurora_01` literal (T-009-06 / A22).
6. **Claims:** missing `organizationId` → fail validation; **no default tenant** in provision or `setPosturaClaims`.
7. **CLIENT allowlists / state / timestamps:** §C–E.
8. **Notifications CREATE:** CLIENT CREATE **allowed only** for documented manager-alert flow; exact create allowlist frozen in T-009-04/05n; arbitrary CREATE deny.
9. **signalOutcomes:** CLIENT write deny; CLIENT read deny.
10. **Storage:** recordings `.webm` only; size **90_000_000** (1 Mbps × 10 min + 20%).
11. **Theses:** CLIENT UPDATE approval workflow only; deny strategic fields (A23).

---

## L. Remaining blockers

| Blocker | Impact |
|---------|--------|
| Live Firestore envelope audit not run | exact backfill counts unknown |
| Storage Console / emulator for automated storage tests | may force PARTIAL later |
| Recording max size not measured | cannot freeze numeric byte cap |
| Dirty working tree | checkpoint branch created; human commit still pending |
| Current rules deny CLIENT thesis writes | fix in Phase 2 rules+tests |
| SA may still live under `AURORA/secrets/` | SEC-009-012 remediation in Phase 4 |
| Q1 + SEC-009-020 app changes | **must land before / with** org-scoped rules deploy |

---

## Counts summary

| Metric | Value |
|--------|-------|
| Firestore production operation clusters documented | 11 |
| Storage SDK ops | 3 |
| Auth/claims writers | 2 |
| Hard-incompatible / high-risk **query** patterns requiring app change | **1 (Q1)** |
| Actor-unaware persistence risk (write gateway) | **1 (SEC-009-020)** |
| Storage path families | **1** |
| Type-level collections needing orgId backfill design | **2** (notifications, recommendations) + verify-all |
| Phase 0 code/rules/data changes | **0** |
