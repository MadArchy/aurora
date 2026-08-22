# Acceptance 009 — Security Hardening

Spec **DONE** solo con Required PASS + deploy aplicable.  
**Manual review ≠ Storage DONE.**  
**`CODE_COMPLETE` ≠ `DEPLOYED` ≠ `DONE`.**

Estados Spec: ver `spec.md` (DRAFT → … → DONE / PARTIAL / BLOCKED).

**Governance:** Spec status **`APPROVED`** (human). Phase 0 inventory + final correction **complete**. Implementation criteria below remain ☐ until Phase 1+ execution — **do not** mark implementation PASS here.

---

## Required (CODE_COMPLETE → toward DONE)

| # | Criterion | Maps to | Status |
|---|-----------|---------|--------|
| A1 | Helpers Firestore exigen `organizationId` match; ADMIN org-scoped only (no global) | SEC-009-002, SEC-009-003 | ☐ |
| A2 | ADMIN otra org: get/list/write deny | SEC-009-003 | ☐ |
| A3 | CLIENT otro clientId: deny | SEC-009-004 | ☐ |
| A4 | CLIENT no crea signals/aiRuns/sources (manager-only); theses CREATE/DELETE deny | SEC-009-006 | ☐ |
| A5 | CLIENT update fuera de allowlist fail | SEC-009-005 | ☐ |
| A6 | Deliveries CLIENT solo `SENT → ACKNOWLEDGED` (+ keys) | SEC-009-007, SEC-009-016 | ☐ |
| A7 | Storage path exige org + ownsClient; matriz por asset aplicada | SEC-009-008 | ☐ |
| A8 | **Automated** Storage rules tests PASS (si Storage en scope DONE) | SEC-009-009, SEC-009-013 | ☐ |
| A9 | Provision **and** `setPosturaClaims` validate `organizationId` (no default tenant); + `clientId` for CLIENT | SEC-009-011 | ☐ |
| A10 | SA fuera del repo tree; scanning ejecutado; rotation si exposición válida | SEC-009-012 | ☐ |
| A11 | `npm run test:rules` PASS (Firestore; + Storage si no PARTIAL storage) | SEC-009-013 | ☐ |
| A12 | `npm run check` PASS → **`CODE_COMPLETE`** elegible | governance | ☐ |
| A13 | Firestore rules **`DEPLOYED`** en proyecto objetivo | governance | ☐ |
| A14 | Call sites piloto no rotos (writes/queries allowlisted) | SEC-009-014/015 | ☐ |
| A14q | **same-org query/list allow** + **cross-org query/list deny**; `listFirestoreClientIds` uses tenant `where` (or equiv.) — **Rules are not filters** | SEC-009-014 | ☐ |
| A15 | Verbos: create wrong `organizationId` deny; update `organizationId` deny; update `clientId` deny; delete cross-org deny | SEC-009-015 | ☐ |
| A16 | **unauthenticated deny** | SEC-009-001 | ☐ |
| A17 | **invalid state transition deny** (CLIENT) en colecciones con status en scope | SEC-009-016 | ☐ |
| A17t | **forged workflow timestamp deny** cuando la regla aplique | SEC-009-017 | ☐ |
| A18 | Notifications: CLIENT CREATE **only** manager-alert flow with exact create allowlist; arbitrary CREATE deny; UPDATE only `read` | SEC-009-018 | ☐ |
| A19 | signalOutcomes: CLIENT write deny (and read deny per freeze) | SEC-009-019 | ☐ |
| A20 | Spec docs/metadata aligned; Phase 0 complete | governance | ☐ |
| A21 | CLIENT modifies one allowed task/content/opportunity and the Firestore write batch **does not** include unauthorized manager-only resources | SEC-009-020, T-009-06p | ☐ |
| A22 | No production UI write path uses a hardcoded tenant `organizationId` | T-009-06 | ☐ |
| A23 | CLIENT may only execute documented Thesis approval/revision workflow; DENY modify of `organizationId`, `clientId`, audiences, territories, objectives, weights, evidence relationships, authority/scoring, manager-only strategic fields | SEC-009-006, inventory §C.10 | ☐ |
| A24 | All tenant-scoped Admin SDK Firestore writers persist a valid `organizationId` and `clientId` where required. Server/Admin SDK code must not rely on Firestore Security Rules for tenant isolation | T-009-10b | ☐ |

## Deploy gates (separados)

| # | Criterion | Status |
|---|-----------|--------|
| D1 | `CODE_COMPLETE` declarado (A11–A12 + Required code items) | ☐ |
| D2 | Migration dry-run + backfill + verification (`migration.md`) | ☐ |
| D3 | Claims reprovision + users re-login / token refresh | ☐ |
| D4 | Firestore rules deployed (A13) | ☐ |
| D5 | Post-deploy verification | ☐ |
| D6 | Spec `DEPLOYED` / `DONE` / `PARTIAL` explícito | ☐ |

## Ops-gated / PARTIAL

| # | Criterion | Notes | Status |
|---|-----------|-------|--------|
| O1 | Storage rules deployed | Console Get Started | ☐ / BLOCKED |
| O2 | Storage automated tests PASS | Si bloqueado → Spec **PARTIAL**; **no** DONE Storage por review manual | ☐ / BLOCKED |
| O3 | SA rotation | Solo si exposición de credencial válida | ☐ / N/A |

## Explicit non-acceptance

- AI Secret Manager / `aiComplete` → `005`
- `PLATFORM_ADMIN` / ADMIN global
- App Check, OTel, React migration
- Learning Engine redesign

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Spec author (docs) | | 2026-08-22 | Phase 0 + final correction complete |
| Human approver | | 2026-08-22 | Spec **`APPROVED`**; Phase 0 authorized/completed |
| Implementer | | | *(pending T-009-01 authorization)* |
| Reviewer | | | |

**Result options (implementation):** `PASS` · `PARTIAL` · `FAIL` · `BLOCKED`  
**Current:** Spec APPROVED / Phase 0 DONE — **implementation not started** (no PASS).

### PARTIAL allowed when

- Firestore Required PASS + DEPLOYED, y Storage O1/O2 BLOCKED por Console/emulator.
- Nota obligatoria en `docs/ops/firebase.md`: Storage rules/tests pending; Spec status `PARTIAL`.

---

## Quick verification commands

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
npm run test:rules
npm run check
# post-implementation authorization only:
firebase deploy --only firestore:rules
firebase deploy --only storage
```

## Traceability matrix (acceptance ↔ requirements)

| Acceptance | Requirements / Tasks |
|------------|----------------------|
| A16 | SEC-009-001 |
| A1–A3 | SEC-009-002, SEC-009-003, SEC-009-004 |
| A5 | SEC-009-005 |
| A4, A23 | SEC-009-006 |
| A6 | SEC-009-007, SEC-009-016 |
| A7–A8, O1–O2 | SEC-009-008, SEC-009-009 |
| A1 (auditLogs) | SEC-009-010 |
| A9 | SEC-009-011 · T-009-10 |
| A10 | SEC-009-012 |
| A11 | SEC-009-013 |
| A14q | SEC-009-014 · T-009-03q · T-009-06 (Q1) |
| A15 | SEC-009-015 |
| A17 | SEC-009-016 |
| A17t | SEC-009-017 |
| A18 | SEC-009-018 · T-009-04 (allowlist freeze) · T-009-05n |
| A19 | SEC-009-019 |
| A21 | SEC-009-020 · T-009-06p |
| A22 | T-009-06 |
| A23 | SEC-009-006 · T-009-04..06b |
| A24 | T-009-10b |
| A12–A13, D1–D6 | governance CODE_COMPLETE / DEPLOYED / DONE |
