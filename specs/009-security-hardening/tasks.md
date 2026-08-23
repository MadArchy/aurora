# Tasks 009 — Security Hardening

Status legend: `TODO` · `DOING` · `DONE` · `BLOCKED`  
Spec gate: **`APPROVED`**. Phase 0 **DONE**. Phase 1 **PASS**. Phase 2 **PASS**. Phase 3 **PASS**. Phase 4 **PASS** (claims/SA/docs/scan). **Do not start T-009-14e / Phase 5** until new human go-ahead.

Requirement IDs: `SEC-009-001` … `SEC-009-020`.  
Inventory: `specs/009-security-hardening/inventory.md`.  
Branch: `spec/009-security-hardening`.

**Frozen (Phase 0 final correction):** Q1 query strategy · actor-aware persistence (SEC-009-020).

---

## Phase 0 — Inventory (ampliado)

- [x] **T-009-00** `DONE` — Inventario completo en `inventory.md` (§A–E, G–H). Firestore ops centralizadas en `sync.ts`; Storage en `storageMedia.ts`; **Q1 hard-incompatible** (Rules are not filters).
- [x] **T-009-00b** `DONE` — Envelope presence matrix in `inventory.md` §F (type + seed; live prod counts pending dry-run).
- [x] **T-009-00c** `DONE` — Envelope freeze in `plan.md` + `inventory.md` §F/K (denormalized; no primary parent get).

## Phase 1 — Firestore helpers + org + verbs + query isolation

- [x] **T-009-01** `DONE` — Helpers: `signedIn`, `tokenOrg`, `isAdmin`, `isClient`, `adminOfOrg`, `envelopeMatches`, `createEnvelopeValid`, `preservesEnvelope`, `ownsClient`/`sameOrgAsClient` (no PLATFORM_ADMIN).
- [x] **T-009-02** `DONE` — Verbos CREATE/READ/LIST/UPDATE/DELETE + org-scoped ADMIN en todos los `match`; `auditLogs` solo ADMIN misma org.
- [x] **T-009-03** `DONE` — Emulator tests: unauth deny; ADMIN same/cross-org; CLIENT own/other/cross-org; envelope create/update/delete denies (**21** tests).
- [x] **T-009-03q** `DONE` — `listFirestoreClientIds` → auth-org `where`; arg must match auth org; unscoped list DENY tests.

**Phase 1 note:** `sameOrgAsClient` uses **TEMPORARY** `get(parent)` through Phases 2–4. **Final rules switch** (denormalized envelope; no primary parent get) = **T-009-14e**, **before** T-009-14 / T-009-15 `CODE_COMPLETE`. **T-009-16** = prod backup/backfill/verify only — must **not** change rules implementation after CODE_COMPLETE.

## Phase 2 — Field-level, state transitions, timestamps, notifications, outcomes

- [x] **T-009-04** `DONE` — Allowlists + matrices frozen; **notification CREATE schema frozen** in `inventory.md` §C.7.
- [x] **T-009-05** `DONE` — CLIENT UPDATE: allowlist + state transition + `preservesEnvelope`.
- [x] **T-009-05t** `DONE` — Trusted timestamps via `serverTimestamp`/`request.time`; forged deny tests.
- [x] **T-009-05n** `DONE` — Notifications: CLIENT read; UPDATE `read` only; CREATE manager-alert allowlist only; DELETE deny.
- [x] **T-009-05o** `DONE` — signalOutcomes: CLIENT deny read+write; ADMIN same-org only.
- [x] **T-009-06** `DONE` — Callers: remove hardcoded `org_aurora_01` UI writes; notification `organizationId` from client context (A22).
- [x] **T-009-06p** `DONE` — Actor-aware CLIENT `importSnapshotToFirestore` (SEC-009-020 / A21).
- [x] **T-009-06b** `DONE` — Emulator + unit tests for field/state/timestamp/notification/outcomes/persistence.

## Phase 3 — Storage

- [x] **T-009-07** `DONE` — Storage matrix frozen (numeric size); `storage.rules`; upload contentType + delete-then-create; product max duration 10m.
- [x] **T-009-08** `DONE` — `tests/storage.rules.test.ts`; `npm run test:rules` runs Firestore + Storage emulators.
- [x] **T-009-09** `N/A` — Storage emulator available; not BLOCKED.

### Pre–CODE_COMPLETE follow-ups (mandatory — do not skip before T-009-14/15)

- [ ] **F-009-A** `TODO` — **Trusted content history:** decide before CODE_COMPLETE whether (1) a trusted server/system writer persists `stateHistory`, or (2) `stateHistory` is formally not required for CLIENT transitions and `updatedAt` is the canonical audit clock. No silent history loss (Phase 2 stripped CLIENT `stateHistory` writes).
- [ ] **F-009-B** `TODO` — **Firestore rule complexity:** simplify Thesis rule helpers before CODE_COMPLETE so DENY/ALLOW paths stay under evaluation limits; add regression tests (Phase 2 hit ~1000-expression cap on some DENY paths).
- [x] **F-009-C** `DONE` (Phase 4 / T-009-10) — No default tenant: `parsePosturaClaims` / `auth.toUser` / provision / `setPosturaClaims` fail closed when `organizationId` missing.

## Phase 4 — Claims, secrets, scanning, docs

- [x] **T-009-10** `DONE` — Provision + `setPosturaClaims` + parse/auth fail-closed; no `org_aurora_01` default; CLIENT requires clientId; ADMIN clientId forced null.
- [x] **T-009-10b** `DONE` — Admin SDK writer inventory; `scheduledIngest` requires explicit org envelope; A24 unit tests.
- [x] **T-009-11** `DONE` — Prep-check + provision reject in-repo SA paths; **Phase 4.1:** active SA moved to `%USERPROFILE%\.firebase-credentials\`, in-repo copy removed, `firebase:prep` PASS with external `GOOGLE_APPLICATION_CREDENTIALS`.
- [x] **T-009-12** `DONE` — `docs/ops/firebase.md`: claims, refresh/re-login, CODE_COMPLETE vs DEPLOYED, migration order.
- [x] **T-009-13** `DONE` — `npm run secret:scan` (+ gitleaks if available); exposure classification documented (no secret values in report).
- [x] **T-009-13b** `DONE` — `migration.md` aligned with Phase-4 findings; migration **not** executed.

## Phase 5 — Finalize envelope rules, verify, code complete, migrate, deploy

**SDD gate:** Do **not** change rules/app implementation after declaring **`CODE_COMPLETE`**. Prod backfill (**T-009-16**) and deploy (**T-009-18**) operate on already-finalized repo artifacts.

- [ ] **T-009-14e** `TODO` — **Finalize denormalized security envelope rules:** replace TEMPORARY `get(parent)` in `sameOrgAsClient` / `ownsClient` with primary checks on denormalized `resource.data.organizationId` (+ `clientId` where applicable). Emulator fixtures/tests must use envelope docs. Spec freeze: no primary parent get. **Required before T-009-14 / T-009-15.**
- [ ] **T-009-14** `TODO` — `npm run test:rules` PASS against **final** envelope rules (Firestore; Storage si no PARTIAL) (SEC-009-013).
- [ ] **T-009-15** `TODO` — `npm run check` PASS → candidacy **`CODE_COMPLETE`** (only after T-009-14e + T-009-14).
- [ ] **T-009-16** `TODO` — Ejecutar `migration.md` **data path only** (backup → dry-run → backfill → verify) según autorización. **No rules code change here.**
- [ ] **T-009-17** `TODO` — Claims reprovision + obligatoriedad re-login / token refresh.
- [ ] **T-009-18** `TODO` — `firebase deploy --only firestore:rules` (rules already finalized at T-009-14e) → progreso **`DEPLOYED`** (Firestore).
- [ ] **T-009-18s** `TODO` / `BLOCKED` — `firebase deploy --only storage` cuando Console lo permita.
- [ ] **T-009-19** `TODO` — Post-deploy verification + smoke; marcar Spec `DONE` o `PARTIAL`; actualizar audit Spec Gaps.

---

## Suggested order

```text
T-009-00 → 00b → 00c
 → 01 → 02 → 03 → 03q
 → 04 → 05 → 05t → 05n → 05o → 06 → 06p → 06b
 → 07 → 08 → 09
 → 10 → 10b → 11 → 12 → 13 → 13b
 → 14e → 14 → 15 → 16 → 17 → 18 → 18s → 19
```

### Envelope / get(parent) lifecycle (governance)

```text
TEMPORARY get(parent)  (Phases 1–4)
        ↓
T-009-14e  Finalize denormalized envelope rules + fixture tests
        ↓
T-009-14   test:rules PASS
        ↓
T-009-15   CODE_COMPLETE
        ↓
T-009-16   Backup → backfill prod → verify backfill   (data only)
        ↓
T-009-17   Claims reprovision
        ↓
T-009-18   Deploy final rules (already in repo at CODE_COMPLETE)
```

## Out of this Spec

- `005-ai-gateway`, App Check, Blaze, OTel, React (`010`)
- `PLATFORM_ADMIN` / ADMIN global
- Rediseño Learning Engine (solo integridad de outcomes)
