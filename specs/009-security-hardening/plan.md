# Plan 009 — Security Hardening

## Spec metadata (reproducible)

| Campo | Valor |
|-------|--------|
| constitutionVersion | `1.0` |
| baselineAudit | `docs/audits/BASELINE_CONSTITUTION_AUDIT.md` |
| baselineGitCommitSHA | `3d7ea20b5c997d035736abdeb97d30d33a996bfc` |
| baselineGitBranch | `main` |
| implementationBranch | `spec/009-security-hardening` |
| NodeVersion | `v24.7.0` |
| FirebaseCLI | `15.14.0` |
| testBaseline | check 261 PASS; test:rules 7/7 pre-hardening |
| repositoryClean/Dirty | Dirty |
| Spec status | **`APPROVED`** · Phase 0 DONE · **do not start T-009-01** without new human go-ahead |
| Requirement IDs | `SEC-009-001` … `SEC-009-020` |

## Approach

Endurecimiento **incremental y testeable** de Auth claims + Firestore/Storage rules + secret policy, sin AI gateway ni rediseño de Learning Engine.

Orden:

1. **T-009-00 inventory completo** (Firestore ops + Storage ops + status machines reales).
2. **Decisión freeze:** parent `get()` vs denormalized envelope (sección abajo).
3. Helpers + verbos CREATE/READ/LIST/UPDATE/DELETE + org-scoped ADMIN.
4. Field allowlists + **CLIENT state transition matrices** (solo estados reales).
5. Timestamp policy (`request.time` / serverTimestamp).
6. Notifications LP + signalOutcomes manager-only.
7. Storage **matriz por asset** + automated tests.
8. SA fuera del tree + secret scanning.
9. `CODE_COMPLETE` → deploy (`DEPLOYED`) → `DONE` / `PARTIAL`.

## Decision: parent `get()` vs denormalized `organizationId`

### Frozen (T-009-00c)

> **Denormalized immutable `organizationId` (+ `clientId` when applicable)** on tenant-scoped docs.  
> **No primary `get(parent)`.** See `inventory.md` §F and Envelope freeze table below.

Historical preference text retained as rationale; freeze supersedes “pending”.

### Criterios de decisión (salida obligatoria de T-009-00)

Para cada subcolección en `CLIENT_SUBCOLLECTIONS` + `clients` + `organizations` + `auditLogs`:

| Pregunta | Si sí → |
|----------|---------|
| ¿Hay `query` / `onSnapshot` / posible `collectionGroup`? | Envelope denormalizado en el doc |
| ¿Rules LIST deben constrainear sin `get(parent)` frágil? | Denormalizado |
| ¿Doc siempre se crea con parent client conocido y solo get-by-id? | `get(parent)` puede bastar |
| ¿Costo de backfill aceptable? (ver `migration.md`) | Denormalizado viable |

### Tentative target helpers (ajustar tras inventario)

```javascript
function signedIn() {
  return request.auth != null;
}

function tokenOrg() {
  return request.auth.token.organizationId;
}

function isAdmin() {
  return signedIn() && request.auth.token.role == 'ADMIN';
}

function isClient() {
  return signedIn() && request.auth.token.role == 'CLIENT';
}

function adminOfOrg(orgId) {
  return isAdmin() && tokenOrg() != null && tokenOrg() == orgId;
}

// Preferido cuando envelope denormalizado:
function envelopeMatches(data) {
  return data.organizationId == tokenOrg()
    && (
      isAdmin()
      || (isClient() && data.clientId == request.auth.token.clientId)
    );
}

function createEnvelopeValid() {
  return request.resource.data.organizationId == tokenOrg()
    && (
      isAdmin()
      || (
        isClient()
        && request.resource.data.clientId == request.auth.token.clientId
      )
    );
}

function preservesEnvelope() {
  return request.resource.data.organizationId == resource.data.organizationId
    && request.resource.data.clientId == resource.data.clientId;
}
```

**Freeze:** completar tabla “colección → envelope strategy” en Decision log **antes** de IMPLEMENTING. Sin freeze → no merge de rules.

## Query isolation (SEC-009-014) — Q1 frozen

**Security Rules are not filters.**

`listFirestoreClientIds` today: `getDocs(collection(db, 'clients'))` — **hard-incompatible** with org-scoped LIST.

**Required app change (before org-scoped rules deploy):**

```text
query(collection(db, 'clients'), where('organizationId', '==', authenticatedOrganizationId))
```

(or equivalent demonstrably tenant-scoped architecture).

Do **not** rely on rules to return only same-org documents from an unscoped list.

## Actor-aware persistence (SEC-009-020) — frozen

`importSnapshotToFirestore` → `batch.set(..., { merge: true })` can attempt to persist the full in-memory snapshot.

**Frozen:** CLIENT persistence must only attempt authorized client-write resources. CLIENT must not write manager-only collections merely because they exist in memory.

**Task:** T-009-06p — minimal safe scoping of the CLIENT persistence gateway (not a full architecture rewrite).

**Acceptance:** A21.

## Operation design (SEC-009-015)

No diseñar seguridad solo con `update`/`diff()`.

| Op | Regla |
|----|-------|
| CREATE | Validar envelope en `request.resource.data`; rol; campos iniciales |
| READ | Envelope / ownsClient |
| LIST | Compatible con query del SDK |
| UPDATE | `preservesEnvelope()` + allowlist + state transition + timestamp policy |
| DELETE | Ownership sobre `resource`; ADMIN org-scoped o policy explícita |

## Field allowlists + state machines

Allowlists de campos se congelan tras T-009-00 (inventario de writes reales).

State matrices CLIENT: ver `spec.md` (estados reales). Confirmación UI en inventory.

### Timestamp policy (SEC-009-017)

Campos a revisar (nombres reales según tipos/usos):

| Campo | Entidad típica | Policy objetivo |
|-------|----------------|-----------------|
| `acknowledgedAt` | deliveries | set solo a `request.time` (o equivalencia rules); deny client-supplied arbitrary |
| review timestamps (`clientReviewedAt` / similares si existen en código) | contents | idem |
| `decidedAt` | — | **n/a** — field not present in codebase; do not invent |
| `completedAt` | tasks / opportunities | idem |
| `updatedAt` | varios | preferir server/`request.time` en paths de workflow; documentar excepciones |

Implementación rules típica: campo ausente en allowlist de strings libres **o** `request.resource.data.acknowledgedAt == request.time`.

App: preferir `serverTimestamp()` en writes CLIENT de workflow.

## Notifications (SEC-009-018) — frozen

CLIENT:

- READ: own notifications under `clients/{clientId}/notifications`.
- UPDATE: only `read` (boolean).
- CREATE: **policy frozen** — allowed **only** for documented manager-alert flow (`notifyManager` / `notificationService.push`).
- **Arbitrary notification CREATE → DENY.**
- **Exact field allowlist** (`organizationId`, `clientId`, `type`, recipient/target semantics, `read` initial, `createdAt`/`request.time`, allowed message fields) **must be frozen at T-009-04 before T-009-05n** rule implementation.
- DELETE: ADMIN org-scoped (CLIENT deny).

## signalOutcomes (SEC-009-019) — frozen

- CREATE/UPDATE/DELETE: **ADMIN (org) / system only** (`recordSignalOutcome` = manager radar).
- CLIENT write: **deny**.
- CLIENT read: **deny** (no ClientPortal usage; least privilege).
- Client feedback: `feedbackEvents` only.

## Envelope freeze (T-009-00c)

**Accepted:** denormalized immutable `organizationId` (+ `clientId` when applicable); **no** primary `get(parent)`. Full table: `inventory.md` §F.

| Collection | orgId denorm | clientId denorm | parent get | migration |
|------------|--------------|-----------------|------------|-----------|
| `clients` | yes | n/a | no | verify |
| typed subs with both | yes | yes | no | verify |
| `notifications` | **add** | require | no | **yes** |
| `recommendations` | **add** | yes | no | **yes** |
| `profile`/`dossier` | yes | yes | no | verify |

## Storage plan (SEC-009-008/009)

**No** usar un único 100 MB / MIME genérico como decisión final.

### Pre-inventory known asset

| path pattern | notes |
|--------------|-------|
| `organizations/{orgId}/clients/{clientId}/recordings/{taskId}.webm` | `storageRecordingPath`; upload/read/delete en `src/firebase/storageMedia.ts` |

### Matriz obligatoria (frozen from inventory — size numeric TBD)

| path | allowed roles | allowed MIME | max size | create | update | delete |
|------|---------------|--------------|----------|--------|--------|--------|
| `organizations/{orgId}/clients/{clientId}/recordings/{taskId}.webm` | CLIENT (own org+client); ADMIN (same org) | `video/webm` (+ `video/webm;*`) | **TBD_MEASURE** (Phase 3; no universal 100MB) | yes | no | yes |

Only Storage path family in repo (`storageRecordingPath`). No `updateMetadata` call sites.

DONE de Storage security = **automated** `tests/storage.rules.test.ts` PASS.  
Si Storage emulator o Console bloqueado → Spec **`PARTIAL`**, no “DONE por review manual”.

## Secrets / service account (SEC-009-012)

Objetivo:

1. Credencial **fuera del repository tree** (no `AURORA/secrets/...` como destino recomendado).
2. Fuera de ZIP/RAR/artifacts compartidos del proyecto.
3. Dev/ops: `GOOGLE_APPLICATION_CREDENTIALS` → ruta externa (p. ej. perfil usuario fuera del clone).
4. Verificaciones: git history, remote repo, archives/artifacts.
5. Si evidencia de exposición de credencial **válida** → **rotation required** antes de DONE.
6. Secret scanning (gitleaks u equivalente) como task/criterio de acceptance.

`.gitignore` de `secrets/` es **mínimo necesario**, no suficiente.

## Deploy vs code complete

| Gate | Significa |
|------|-----------|
| `CODE_COMPLETE` | Rules + callers + tests en repo verdes — **incluye T-009-14e** (final denormalized envelope rules; no primary `get(parent)`) |
| `DEPLOYED` | After T-009-16 backfill verify: `firebase deploy` rules (+ storage si aplica) + claims reprovision en proyecto |
| `DONE` | Acceptance Required PASS + DEPLOYED (o `PARTIAL` documentado) |

**SDD:** Do not modify rules/app after `CODE_COMPLETE`. Sequence: **14e → 14 → 15 → 16 (data) → 17 → 18 (deploy)**.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Full-snapshot merge push | Scope CLIENT push to own clientId (inventory risk) |
| Queries rotas tras org rules | Path-scoped lists OK; harden `clients` list + envelope |
| App updates anchos | allowlist + ajustar callers |
| Envelope backfill incompleto | `migration.md` dry-run + verification |
| Storage Console bloqueado | `PARTIAL`; automated tests still required for Storage DONE later |
| SA en tree / zip | política externa + scanning + rotation |
| Thesis CLIENT writes vs current rules | Allowlist approval fields in Phase 2 |
## Effort (estimate)

| Phase | Estimate |
|-------|----------|
| Inventory T-009-00 + envelope decision | 0.5–1 d |
| Firestore verbs + transitions + timestamps | 1–1.5 d |
| Storage matrix + automated tests | 0.5–1 d |
| SA policy + scanning + docs + migration dry-run prep | 0.5 d |
| Deploy + verify | 0.25–0.5 d |
| **Total** | **~3–4.5 días** |

## Decision log

| Date | Decision | Status |
|------|----------|--------|
| 2026-08-22 | ADMIN siempre org-scoped; no ADMIN global / PLATFORM_ADMIN en 009 | **Accepted** |
| 2026-08-22 | Denormalized envelope; no primary parent get | **Frozen (T-009-00c)** |
| 2026-08-22 | Notifications CLIENT CREATE exception (manager alerts) | **Frozen** |
| 2026-08-22 | signalOutcomes CLIENT read deny + write deny | **Frozen** |
| 2026-08-22 | Storage matrix: recordings `.webm` only; size TBD_MEASURE | **Frozen (size pending measure)** |
| 2026-08-22 | CLIENT allowlists / state / timestamps | **Frozen in `inventory.md` §C–E** |
| 2026-08-22 | Theses: CLIENT UPDATE approval allowlist only | **Frozen** |
| 2026-08-22 | Q1: Rules are not filters; `listFirestoreClientIds` must use tenant `where` (or equiv.) | **Frozen** |
| 2026-08-22 | SEC-009-020 actor-aware CLIENT persistence (T-009-06p / A21) | **Frozen** |
| 2026-08-22 | No hardcoded `org_aurora_01` in production UI writes (A22) | **Frozen** |
| 2026-08-22 | setPosturaClaims/provision: missing organizationId → fail; no default tenant | **Frozen** |
| 2026-08-22 | Notifications CREATE only manager-alert flow; arbitrary DENY; allowlist in T-009-04/05n | **Frozen** |
| 2026-08-22 | Thesis CLIENT approval only; deny strategic fields (A23) | **Frozen** |
| 2026-08-22 | Admin SDK writers must write valid envelopes (T-009-10b) | **Frozen** |
| 2026-08-22 | Phase 1: `get(parent)` for `sameOrgAsClient` = **TEMPORARY** through Phases 2–4 | **Accepted temporary** |
| 2026-08-22 | **T-009-14e** finalizes denormalized envelope rules **before** T-009-15 CODE_COMPLETE; T-009-16 = prod backfill only; T-009-18 = deploy | **Governance frozen** |
| | Recording byte cap numeric | **PENDING measure (Phase 3)** |
| | Live prod missing-envelope doc counts | **PENDING dry-run** |
