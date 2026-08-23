# Tasks 009 — Security Hardening

Status legend: `TODO` · `DOING` · `DONE` · `BLOCKED`  
Spec gate: **`APPROVED`**. Phase 0 **DONE**. Phase 1 **PASS**. Phase 2 **DONE** (T-009-04…06b). **Do not start Phase 3 (T-009-07+)** until new human go-ahead.

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

- [ ] **T-009-07** `TODO` — Completar matriz Storage en `plan.md`; implementar `storage.rules` por asset (SEC-009-008/009). **No** cap MIME/size único genérico.
- [ ] **T-009-08** `TODO` — `tests/storage.rules.test.ts` + `test:rules` incluye Storage emulator. **Automated PASS requerido** para Storage security DONE.
- [ ] **T-009-09** `TODO` / `BLOCKED` — Si emulator o Console bloqueado: documentar Spec `PARTIAL`; manual review **≠** DONE Storage.

## Phase 4 — Claims, secrets, scanning, docs

- [ ] **T-009-10** `TODO` — Provision **`scripts/provision-firebase.mjs` AND** `functions` `setPosturaClaims`: fail si falta `organizationId`; **NO default tenant**; ADMIN sin clientId; CLIENT con clientId (SEC-009-011).
- [ ] **T-009-10b** `TODO` — Inventory/verify all Admin SDK Firestore writers (incl. `scheduledIngest`) write valid `organizationId`/`clientId` envelope where required. Unit test where viable. **Acceptance A24.** No IAM redesign in this Spec beyond necessary docs.
- [ ] **T-009-11** `TODO` — Prep-check: SA path **fuera del repo tree**; warn/fail si path dentro del clone (SEC-009-012).
- [ ] **T-009-12** `TODO` — Docs ops: claims, token refresh/re-login, SA externa, CODE_COMPLETE vs DEPLOYED.
- [ ] **T-009-13** `TODO` — Secret scanning (gitleaks u equiv.); verificar git history / remote / archives; **rotation required** si exposición de credencial válida.
- [ ] **T-009-13b** `TODO` — Mantener `migration.md` alineado; **no ejecutar** migración hasta autorización de ventana de migración.

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
