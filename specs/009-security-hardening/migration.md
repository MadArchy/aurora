# Migration 009 — Security Hardening

**Do not execute until Spec status is `APPROVED` and a human authorizes the migration window.**

This document is the runbook. Implementation of rules/app may proceed to `CODE_COMPLETE` only after `APPROVED`; data/claims/deploy steps follow this sequence.

---

## Purpose

Habilitar rules org-scoped + envelope denormalizado (si el freeze lo exige) sin dejar el piloto en estado inconsistente.

## Preconditions

- Spec `APPROVED`
- T-009-00 / T-009-00c freeze (envelope strategy) complete
- Backup completed
- SA credential usable vía path **externo** al repo (`GOOGLE_APPLICATION_CREDENTIALS`)
- JDK + `npm run test:rules` verdes contra rules candidatas (emulator)

---

## 1. Inventory

**Status: COMPLETE** (Phase 0 — see `inventory.md`).  
**Envelope freeze: COMPLETE** (T-009-00c — denormalized; Q1 query strategy frozen; SEC-009-020 frozen).

Inputs (available):

- Salida T-009-00 (ops Firestore/Storage + status + timestamps) — `inventory.md`
- Tabla colección → envelope strategy (`plan.md` / `inventory.md` §F)
- Type gaps requiring backfill design: `notifications`, `recommendations` (+ verify prod)

Deliverable for migration window: checklist de paths a backfillear + Firestore index needs for Q1 `where('organizationId','==', …)`.

---

## 2. Backup

- Export Firestore (Console export o `gcloud firestore export`) del proyecto `aurora-postura-app`
- Anotar timestamp + GCS/local path del export
- Confirmar que **no** se empaqueta la SA dentro del archive de backup del código

---

## 3. Dry run

- En emulator o proyecto staging (si existe): aplicar backfill script en dry-run / read-only report
- Contar docs missing envelope vs expected
- Ejecutar rules tests contra datos de muestra post-backfill simulado
- **Stop** si counts ≠ expected sin plan de remediación

---

## 4. organizationId (envelope) backfill

- Escribir `organizationId` (y `clientId` cuando aplique) en documentos tenant-scoped según freeze
- Preservar valores existentes correctos; no overwrite cross-org
- Idempotente: re-run seguro
- Registrar métricas: scanned / updated / skipped / errors

*(Script concreto se añade en IMPLEMENTING; este runbook no lo ejecuta ahora.)*

---

## 5. Verification (pre-deploy rules)

- Spot-check docs Juan/Elena/manager seed
- Queries inventariadas siguen retornando filas expected en same-org
- Ningún doc requerido con envelope `null` en colecciones “denormalized required”

---

## 6. Claims reprovision

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="<PATH_EXTERNO_AL_REPO>\firebase-sa.json"
npm run firebase:provision
```

Validar claims: `role`, `organizationId`, `clientId` (CLIENT).

---

## 7. Token refresh / re-login

- Usuarios demo (manager, Juan, Elena) deben **cerrar sesión y volver a entrar** (o forzar refresh de ID token) para recibir claims nuevos
- Documentar en ops: tokens viejos pueden fallar o comportarse distinto tras deploy

---

## 8. Rules deployment

Orden recomendado:

1. Confirmar `CODE_COMPLETE` (tests verdes)
2. `firebase deploy --only firestore:rules`
3. Si Storage Console activo y tests Storage PASS: `firebase deploy --only storage`
4. Marcar Spec `DEPLOYED` (o `PARTIAL` si Storage pendiente)

---

## 9. Post-deploy verification

- Login manager: lee solo su org
- Login Juan: lee solo su client; update allowlisted OK; update ilegal deny
- Intento cross-org (segundo org de prueba o token de test): deny
- Query/list cross-org: deny
- Storage recording upload/read si DEPLOYED Storage
- `npm run test:rules` sigue PASS en CI/local

---

## 10. Rollback

Si falla post-deploy:

1. Redeploy **previous** `firestore.rules` / `storage.rules` from git tag/commit conocido
2. No revertir backfill a ciegas si las rules viejas toleran envelope extra (campos adicionales suelen ser safe)
3. Si claims breaking: re-provision al esquema anterior **solo** si se revierten rules que lo exijan
4. Restaurar export Firestore **solo** ante corrupción de datos (último recurso)
5. Comunicar a usuarios: re-login

---

## Status of this runbook

| Step | Status |
|------|--------|
| Inventory | **COMPLETE** (`inventory.md`) |
| Envelope freeze | **COMPLETE** (T-009-00c) |
| Q1 query strategy | **FROZEN** (app change required; not executed) |
| Actor-aware persistence | **FROZEN** (SEC-009-020 / T-009-06p; not executed) |
| Backup | NOT EXECUTED |
| Dry run | NOT EXECUTED |
| Backfill | NOT EXECUTED |
| Verification | NOT EXECUTED |
| Claims reprovision | NOT EXECUTED |
| Token refresh | NOT EXECUTED |
| Rules deployment | NOT EXECUTED |
| Post-deploy verification | NOT EXECUTED |
| Rollback | N/A |

**NO MIGRATION EXECUTED as part of Spec documentation revision.**
