# Tasks 009 — Security Hardening

Status legend: `TODO` · `DOING` · `DONE` · `BLOCKED`  
Spec gate: **`APPROVED`**. Phase 0 **DONE**. **Do not start T-009-01** until new human go-ahead.

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

- [ ] **T-009-01** `TODO` — Helpers rules: org-scoped ADMIN/CLIENT; `createEnvelopeValid` / `preservesEnvelope` / delete-on-resource (SEC-009-001…004, SEC-009-015). **Sin ADMIN global.**
- [ ] **T-009-02** `TODO` — Aplicar verbos CREATE/READ/LIST/UPDATE/DELETE a todos los `match`; `auditLogs` solo ADMIN misma org (SEC-009-010).
- [ ] **T-009-03** `TODO` — Tests get: ADMIN cross-org FAIL; CLIENT cross-client FAIL; same-org PASS; unauthenticated FAIL.
- [ ] **T-009-03q** `TODO` — Tests **list/query**: same-org allow; cross-org deny (SEC-009-014). **Implement Q1 fix:** `listFirestoreClientIds` → `where('organizationId','==', authenticatedOrganizationId)` (or equivalent). Rules are not filters.

## Phase 2 — Field-level, state transitions, timestamps, notifications, outcomes

- [ ] **T-009-04** `TODO` — Implementar allowlists + matrices **frozen** en `spec.md` / `inventory.md` §C–D (SEC-009-005, SEC-009-016). **Freeze exact notification CREATE field allowlist here before T-009-05n.**
- [ ] **T-009-05** `TODO` — Implementar UPDATE CLIENT: allowlist + state transition + `preservesEnvelope`.
- [ ] **T-009-05t** `TODO` — Timestamp policy: `acknowledgedAt` / review / `completedAt` / `submittedAt` / `clientApprovedAt` / `updatedAt` vía `request.time` o serverTimestamp; tests forged deny (SEC-009-017).
- [ ] **T-009-05n** `TODO` — Notifications (SEC-009-018): CLIENT read + update `read` only; CREATE **only** manager-alert flow with exact create allowlist; arbitrary CREATE deny.
- [ ] **T-009-05o** `TODO` — signalOutcomes: manager/system only writes; CLIENT deny read+write; feedback vía `feedbackEvents` (SEC-009-019).
- [ ] **T-009-06** `TODO` — Ajustar callers app al menor cambio necesario (Q1 query, notifications envelope, outcomes). **Remove hardcoded `organizationId: 'org_aurora_01'`** from production UI write paths (results/evidence); org from authenticated/session/client context (A22).
- [ ] **T-009-06p** `TODO` — **Actor-aware persistence (SEC-009-020):** scope CLIENT `importSnapshotToFirestore` / merge batch so it only attempts authorized client-write resources; must not include manager-only collections from memory. Minimal safe change (A21).
- [ ] **T-009-06b** `TODO` — Tests: field deny; invalid state transition deny; create wrong org deny; update org/clientId deny; delete cross-org deny; thesis strategic-field deny (A23).

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

## Phase 5 — Verify, code complete, deploy

- [ ] **T-009-14** `TODO` — `npm run test:rules` PASS (Firestore; Storage si no PARTIAL) (SEC-009-013).
- [ ] **T-009-15** `TODO` — `npm run check` PASS → candidacy **`CODE_COMPLETE`**.
- [ ] **T-009-16** `TODO` — Ejecutar `migration.md` (dry-run → backfill → verify) según autorización.
- [ ] **T-009-17** `TODO` — Claims reprovision + obligatoriedad re-login / token refresh.
- [ ] **T-009-18** `TODO` — `firebase deploy --only firestore:rules` → progreso **`DEPLOYED`** (Firestore).
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
 → 14 → 15 → 16 → 17 → 18 → 18s → 19
```

## Out of this Spec

- `005-ai-gateway`, App Check, Blaze, OTel, React (`010`)
- `PLATFORM_ADMIN` / ADMIN global
- Rediseño Learning Engine (solo integridad de outcomes)
