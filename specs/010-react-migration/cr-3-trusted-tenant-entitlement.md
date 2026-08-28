# CR-3 — Trusted Tenant Entitlement Security Fix

**Class:** `SECURITY_FIX`  
**Status:** `RESOLVED`  
**Historical severity:** **P2** (browser-local runtime) · would escalate to **P1** if shared/server persistence went live while unfixed  
**Authorized owners:** SPEC-003 · SPEC-004 · SPEC-007 · SPEC-008  
**Authorized base checkpoint:** `e0c483f30f5dc2a31ffee64c05e801036ff10640`  
**Implementation SHA:** `af49c59c9c8042b925e29c8a71ac1cd585d2f941`  
**Governance / re-freeze SHA:** `079ab9a8be05e4de76b6029e9da6851a12dfb88d`  
**Timezone:** America/Bogota

---

## Human authorization (verbatim)

> Apruebo formalmente CR-3 — Trusted Tenant Entitlement Security Fix contra el checkpoint `e0c483f30f5dc2a31ffee64c05e801036ff10640`.
>
> Autorizo primero la sincronización de ese checkpoint existente con `origin/spec/010-react-migration`, sin modificar archivos ni crear commits adicionales, y únicamente si después se verifica:
>
> * `HEAD = e0c483f30f5dc2a31ffee64c05e801036ff10640`
> * `origin/spec/010-react-migration = e0c483f30f5dc2a31ffee64c05e801036ff10640`
> * `WORKING TREE = CLEAN`
>
> Una vez verificado ese estado, autorizo la modificación controlada exclusivamente de los consumers y fronteras de seguridad necesarias de:
>
> * SPEC-003 — Strategic Brief
> * SPEC-004 — Strategic Planner
> * SPEC-007 — Opportunity Scout
> * SPEC-008 — Learning Loop
>
> El alcance autorizado es únicamente corregir CR-3 — Trusted Tenant Entitlement Security Fix: […]
>
> Esta autorización NO incluye: CR-1; CR-2; nuevos Application use cases; Domain; lifecycle; scoring; routing; producto; esquema; migración; Firestore remoto; SPEC-009 production; T-010-403/404; Phase 5; eliminación de legacy; deployment.
>
> La autorización humana anterior de CR-3 permanece válida como antecedente. Esta declaración sustituye únicamente el checkpoint técnico autorizado y fija como nueva base: `e0c483f30f5dc2a31ffee64c05e801036ff10640`

Original antecedent authorization (2026-08-27 America/Bogota) remains valid as historical evidence; checkpoint scope was superseded then re-authorized against `e0c483f`.

---

## Defect

`buildTrustedBriefContext` / `buildTrustedPlanContext` / `buildTrustedOpportunityContext` / `buildTrustedLearningContext` derived `organizationId` from `dbService.getClientById(clientId)?.organizationId`, establishing consistency without proving the authenticated actor was entitled to the requested client.

## Remediation

All four builders call `requireTenantScope` from `src/controllers/trustedTenant.ts`:

- trusted `organizationId` = session / claims (`user.organizationId`)
- requested `clientId` validated against entitlement (CLIENT pinned to own client; ADMIN same-org explicit client only)
- fail closed: no session, no trusted org, unknown client, cross-org, CLIENT sibling substitution

Client record may validate existence / org match; it does **not** establish trusted organization.

## Previous frozen checkpoints (historical, preserved)

| SPEC | Previous frozen checkpoint |
|------|----------------------------|
| SPEC-003 | `e16280607fa078941078d2cb4c233025a1bd66a1` |
| SPEC-004 | `aa5e2afdbbad4c7b600e30069d6cee3fcbb2ee63` (FINAL CODE_COMPLETE; tip pin also `8661e4a2c272372e4d851bdb01d10f85b447e27c`) |
| SPEC-007 | `5d084ea9274909fb3f1d1eb2f51a084ec3a1f4c0` |
| SPEC-008 | `642ae9390700a254fa390ba09a959bab3c37d616` |

## Evidence

- Focused: `tests/cr3TrustedTenantEntitlement.test.ts` (17/17) including ATTACK-CR3-01…08
- Reuse of Phase 4C gate: `tests/reactMigrationPhase4cSecurity.test.ts`
- SPEC-003/004/007/008 consumer + security regression batch: 346/346 PASS
- Full check / rules / build recorded in the governance freeze commit message

## Out of scope (unchanged)

CR-1 · CR-2 · Domain · lifecycle · scoring · routing · SPEC-009 production · schema/data migration · Phase 5 · T-010-403/404 · deployment

**DEPLOYED = NO · DONE = NO** for all amended SPECs.
