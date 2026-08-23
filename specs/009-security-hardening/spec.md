# Spec 009 — Security Hardening

| Campo | Valor |
|-------|--------|
| **Spec ID** | `009-security-hardening` |
| **Status** | **`APPROVED`** (human) · Phase 0 DONE · **stop before T-009-01** until further human go-ahead |
| **Inventory** | `specs/009-security-hardening/inventory.md` |
| **baselineGitBranch** | `main` |
| **baselineGitCommitSHA** | `3d7ea20b5c997d035736abdeb97d30d33a996bfc` |
| **implementationBranch** | `spec/009-security-hardening` |
| **Priority** | P0 |
| **Constitution** | §20 Security / Tenant Isolation / Least Privilege / Field-Level / Secrets |
| **constitutionVersion** | `1.0` (`docs/architecture/POSTURA_CONSTITUTION.md`) |
| **baselineAudit** | `docs/audits/BASELINE_CONSTITUTION_AUDIT.md` |
| **NodeVersion** | `v24.7.0` |
| **npmVersion** | `11.5.1` |
| **FirebaseCLI** | `15.14.0` (local `node_modules` + global) |
| **testBaseline** | `npm run check` → 261 PASS (rules excluded from default); `npm run test:rules` → 7/7 PASS (pre-hardening suite) |
| **repositoryClean/Dirty** | **Dirty** (pre-existing piloto work preserved on implementation branch) |
| **Depends on** | Ninguno (primera Spec de la secuencia recomendada) |
| **Blocks** | `005-ai-gateway` y Specs de dominio multi-tenant seguras |
| **Out of scope here** | AI gateway / Zod LLM (`005`), React (`010`), Brief (`003`), `PLATFORM_ADMIN` |

---

## Spec lifecycle (gobernanza SDD)

Estados recomendados (documentación; no requiere workflow software ahora):

| Estado | Significado |
|--------|-------------|
| `DRAFT` | Spec en redacción |
| `CHANGES_REQUIRED` | Revisión humana pidió correcciones |
| `APPROVED` | Humano autoriza implementación |
| `IMPLEMENTING` | Código/rules en progreso |
| `VERIFYING` | Tests / smoke / review |
| `CODE_COMPLETE` | Código + tests verdes en repo; **aún no** implica prod |
| `DEPLOYED` | Rules/claims desplegados en proyecto Firebase objetivo |
| `DONE` | Acceptance Required + Deployed (o PARTIAL documentado) |
| `PARTIAL` | Subconjunto DONE (p. ej. Firestore sí, Storage no) |
| `BLOCKED` | Impedimento externo (Console, JAR, credenciales) |

Separación obligatoria:

- **`CODE_COMPLETE` ≠ `DEPLOYED`**
- **`DONE`** requiere acceptance + deploy aplicable (o `PARTIAL` explícito)

---

## Problem

El piloto Firebase valida usabilidad operativa, **no** aislamiento constitucional.

Hallazgos actuales (baseline):

1. **Critical** — `ADMIN` puede leer/escribir sin match de `organizationId` (Firestore y Storage).
2. **High** — writes de cliente sin allowlist / sin matriz CREATE·READ·LIST·UPDATE·DELETE.
3. **High** — Storage permisivo; límites MIME/size no inventariados por asset.
4. **High/Medium** — SA JSON bajo árbol del repo (`secrets/`, gitignored) — política insuficiente.
5. Tests de rules: happy-path same-org; faltan list/query cross-org, create/update envelope, timestamps, Storage automated PASS.

## Goal

Endurecer Auth claims + Firestore/Storage rules + higiene de secretos para que POSTURA cumpla:

- aislamiento por `organizationId` (y `clientId` cuando aplique) en **get y list/query**;
- least privilege: **ADMIN siempre org-scoped** (no existe ADMIN global en esta Spec);
- seguridad por operación: CREATE / READ / LIST / UPDATE / DELETE;
- field-level + **state-transition** security para CLIENT;
- timestamps de workflow no falsificables libremente;
- Storage least privilege **por asset** (matriz path/role/MIME/size);
- service account **fuera del repository tree** + secret scanning;
- cero confianza en filtros post-fetch en JavaScript.

## Non-Goals

- Implementar Cloud Functions AI / Secret Manager para API keys de LLM → Spec `005`.
- Migrar a React o reescribir `main.ts`.
- Cambiar modelo de dominio (Brief, scoring, multi-thesis) o rediseñar Learning Engine.
- Introducir `PLATFORM_ADMIN` / ADMIN global → **otra Spec futura**.
- Activar Blaze / App Check (follow-up ops).
- Ejecutar la migración de datos en esta fase documental (ver `migration.md`; ejecución solo post-`APPROVED`).

## Actors

| Actor | Auth claims esperados |
|-------|------------------------|
| Manager (ADMIN) | `role=ADMIN`, `organizationId=<org>` (**required**), `clientId=null` |
| Cliente (CLIENT) | `role=CLIENT`, `organizationId=<org>`, `clientId=<id>` |
| Provisioner (ops) | Credencial SA **fuera del repo tree**; `GOOGLE_APPLICATION_CREDENTIALS` |
| Atacante / token malicioso | Claims inventados, otra org, o unauthenticated |

**Prohibido en 009:** cualquier diseño o regla que trate ADMIN como global cross-org.

## Preconditions

- Proyecto `aurora-postura-app` con Auth Email/Password.
- Claims provisionados vía `npm run firebase:provision` (post-APPROVED).
- `npm run test:rules` operable (JDK ≥21 + emulator JAR).
- Documentos tenant-scoped con envelope de seguridad coherente (ver decisión denormalización en `plan.md`).
- Inventario T-009-00 completado antes de freeze de allowlists / Storage matrix.

## Functional Requirements

| ID | Requirement |
|----|-------------|
| SEC-009-001 | Toda operación Firestore/Storage protegida exige `request.auth != null` (unauthenticated → deny). |
| SEC-009-002 | Acceso a datos tenant-scoped exige `token.organizationId ==` envelope del recurso (`organizationId` denormalizado o parent document — ver decisión en `plan.md`). |
| SEC-009-003 | `role=ADMIN` **nunca** implica acceso cross-org; siempre `token.organizationId` match. No hay ADMIN global en esta Spec. |
| SEC-009-004 | `role=CLIENT` solo accede a `token.clientId` dentro de su org. |
| SEC-009-005 | Updates de CLIENT usan allowlist explícita por colección (`affectedKeys().hasOnly(...)`) **y** no sustituyen la matriz CREATE/READ/LIST/UPDATE/DELETE. |
| SEC-009-006 | Manager-only for CLIENT **CREATE/DELETE** (and full write) on: signals, sources, curation, aiRuns, campaigns, recommendations, signalOutcomes, dossier, … **Theses:** CLIENT **UPDATE allowlist only** (approval fields — see inventory); CREATE/DELETE theses = ADMIN. |
| SEC-009-007 | Deliveries: CLIENT solo transición de dominio `SENT → ACKNOWLEDGED` + keys allowlist; timestamps de workflow vía `request.time` / serverTimestamp policy. |
| SEC-009-008 | Storage paths bajo `organizations/{orgId}/clients/{clientId}/…` exigen org + ownsClient; matriz por asset (no cap MIME/size único genérico). |
| SEC-009-009 | Storage create/update/delete según matriz de asset (roles, MIME, max size). Automated Storage rules tests **PASS** para declarar Storage security DONE; si emulator/Console bloqueado → Spec `PARTIAL` documentado (manual review ≠ DONE). |
| SEC-009-010 | `auditLogs`: solo ADMIN **de la misma org** (envelope org en el log o equivalente); no update/delete. Sin bypass “ADMIN global”. |
| SEC-009-011 | Provision **and** `setPosturaClaims`: validate required claims (`role`, `organizationId`; `clientId` for CLIENT). **Missing `organizationId` → validation failure. NO default tenant** (do not default to `org_aurora_01`). |
| SEC-009-012 | Service account: **fuera del repository tree** y fuera de ZIP/RAR/artifacts distribuibles; `GOOGLE_APPLICATION_CREDENTIALS` a ruta externa; verificar git history / remote / archives; **rotation required** si exposición de credencial válida; secret scanning como criterio. |
| SEC-009-013 | Suite `test:rules` (Firestore + Storage cuando aplique) cubre isolation get/list, field-level, state transitions, timestamps, cross-org, unauthenticated. |
| SEC-009-014 | **Query isolation:** toda query/list tenant-scoped debe ser compatible con Security Rules (constraints en la query). **Security Rules are not filters.** Nunca confiar en list unscoped + rules, ni en filtrar `organizationId`/`clientId` en JS después de recibir datos. **Q1 frozen:** `listFirestoreClientIds` must use `where('organizationId','==', authenticatedOrganizationId)` (or equivalent). Tests: same-org list allow + cross-org list/query deny. |
| SEC-009-015 | Seguridad por verbo: reglas diferenciadas CREATE / READ / LIST / UPDATE / DELETE. CREATE valida `organizationId`/`clientId` en `request.resource.data`. UPDATE preserva `organizationId`/`clientId`. DELETE valida ownership del `resource` existente. |
| SEC-009-016 | Colecciones con status: además de allowlist, matriz **OLD_STATE → ALLOWED_NEW_STATE** para CLIENT usando **solo estados reales del dominio** (inventario T-009-00 + tipos actuales). |
| SEC-009-017 | Timestamps auditables de workflow CLIENT (`acknowledgedAt`, review/decide/complete/`updatedAt` cuando apliquen) deben usar `request.time` / `serverTimestamp` policy; el cliente no puede falsificarlos libremente. Tests: forged timestamp deny cuando la regla lo exija. |
| SEC-009-018 | **Notifications:** CLIENT READ own; UPDATE only `read`. **CREATE policy frozen:** only documented manager-alert flow. **Exact field allowlist frozen at T-009-04 before T-009-05n.** Arbitrary CREATE → DENY. |
| SEC-009-019 | **signalOutcomes:** manager/system writes only. CLIENT write **deny**. CLIENT read **deny** (no ClientPortal usage; least privilege). Client feedback → `feedbackEvents` only. |
| SEC-009-020 | **Actor-aware persistence:** CLIENT persistence (`importSnapshotToFirestore` / merge batch) must only attempt authorized client-write resources. CLIENT must not write manager-only collections merely because they exist in the in-memory snapshot. Minimal safe scoping of the persistence gateway (T-009-06p). |

## Business Rules

1. Una org no ve ni lista datos de otra org, aunque el usuario sea ADMIN.
2. Un cliente no escala privilegios vía campos, status ilegales, IDs, o timestamps falsos.
3. List/query sin constraint de tenant compatible con rules = defecto inseguro → debe corregirse en app + rules.
4. Uploads no escapan prefijo de path ni MIME/size de su fila en la matriz de asset.
5. Secretos de servicio nunca viven en el working tree del repo ni en artifacts compartidos del proyecto.

## Data Model (security-relevant)

### Custom claims (Firebase Auth)

```text
{
  role: "ADMIN" | "CLIENT",
  organizationId: string,   // required always
  clientId: string | null   // required for CLIENT; null for ADMIN
}
```

No claim ni regla de `PLATFORM_ADMIN` en esta Spec.

### Security envelope (tenant-scoped docs)

Dirección preferida (freeze final tras T-009-00 — ver `plan.md`):

- `organizationId` y `clientId` forman parte del **security envelope** de documentos tenant-scoped relevantes.
- Preferir `organizationId` (y `clientId` cuando aplique) **denormalizado e inmutable** cuando mejore queries, `collectionGroup` y rules.
- No duplicar a ciegas: inventario decide qué colecciones lo requieren.

### Storage (conocido pre-inventario)

Path actual de grabaciones (código):

```text
organizations/{orgId}/clients/{clientId}/recordings/{taskId}.webm
```

Matriz completa path/role/MIME/size/create/update/delete → salida de T-009-00 + `plan.md` (no un único 100 MB global).

## Operation matrix (conceptual)

Para cada `match` relevante, documentar e implementar:

| Op | Validación mínima |
|----|-------------------|
| CREATE | auth + org/client en `request.resource.data` + rol |
| READ | auth + org/client ownership |
| LIST | mismas constraints que la query del cliente SDK |
| UPDATE | auth + ownership + allowlist + preserve envelope + state machine + timestamp policy |
| DELETE | auth + ownership sobre `resource` (no solo request) |

## State transitions — CLIENT (frozen from inventory call sites)

Fuente: `inventory.md` + call sites (`main.ts`, `db.ts`, `OpportunityPanel.ts`, `stateMachine.ts`, `contentPipeline.ts`, `articleReviewCore.ts`, `videoSubmitCore.ts`, `thesisRevisionCore.ts`).  
**No inventar estados.** Field allowlists exactas de notification CREATE se congelan en **T-009-04** (antes de T-009-05n).  
**Deny by default** para cualquier transición no listada abajo.

### Deliveries — `DeliveryPackageStatus`

| OLD_STATE | ALLOWED_NEW_STATE (CLIENT) |
|-----------|----------------------------|
| SENT | ACKNOWLEDGED |
| DRAFT | — (deny) |
| ACKNOWLEDGED | — (deny) |

Manager: `DRAFT → SENT`.

### Tasks — `TaskStatus`

Evidence: `main.ts` `openAssignedTask` (ASSIGNED\|DRAFT→VIEWED); teleprompter/article start (ASSIGNED\|VIEWED\|DRAFT→IN_PROGRESS); complete/submit (→COMPLETED).

| OLD_STATE | ALLOWED_NEW_STATE (CLIENT) |
|-----------|----------------------------|
| DRAFT | VIEWED, IN_PROGRESS |
| ASSIGNED | VIEWED, IN_PROGRESS |
| VIEWED | IN_PROGRESS, COMPLETED |
| IN_PROGRESS | COMPLETED |
| COMPLETED | — (deny) |
| CANCELLED | — (deny) |
| REJECTED | — (deny) |

**Unresolved / non-blocking:** domain `TASK_TRANSITIONS` allows `IN_PROGRESS→REJECTED` and `REJECTED→IN_PROGRESS`, but **no CLIENT call site** sets task `REJECTED` → **DENY** until a call site exists.  
`CANCELLED` / `DRAFT→ASSIGNED`: manager-only.

### Content — pipeline `ContentPipelineStatus`

Article flows (evidence): start/save → `client_in_progress`; approve → `client_submitted` (`approveClientArticle` / `ARTICLE_APPROVE_PIPELINE_TARGET`); reject → `client_in_progress` / legacy `CHANGES_REQUESTED`.

| OLD_STATE (pipeline) | ALLOWED_NEW_STATE (CLIENT) |
|----------------------|----------------------------|
| sent_to_client | client_in_progress, client_submitted |
| client_in_progress | client_submitted |
| client_in_progress | client_in_progress *(save edits; may keep status)* |
| *all other pipeline states* | — (deny) |

#### Video submit → `manager_finalizing`

Evidence: `submitClientVideo` → `advanceContentPipelineTarget(..., VIDEO_SUBMIT_PIPELINE_TARGET)` (`manager_finalizing`).

Graph `resolvePipelineStepsToTarget` can walk from many states (including manager-only prefixes). **That is not frozen as CLIENT-allowed.**

**Frozen CLIENT-allowed sources for video submit path only:**

| OLD_STATE | Intermediate steps CLIENT may cause | NEW_STATE |
|-----------|--------------------------------------|-----------|
| sent_to_client | client_in_progress → client_submitted | manager_finalizing |
| client_in_progress | client_submitted | manager_finalizing |
| client_submitted | — | manager_finalizing |

**DENY** CLIENT initiating path to `manager_finalizing` from: `planned`, `generating`, `draft_ready`, `manager_review`, `qa_check`, `ready_to_publish`, `published`, `cancelled`.  
**Follow-up (non-blocking):** clamp `submitClientVideo` / `advanceContentPipelineTarget` so CLIENT cannot traverse manager-only prefixes even if the graph allows it.

Legacy `ContentStatus` (when still written), aligned to same flows:

| OLD (legacy) | ALLOWED_NEW (CLIENT) |
|--------------|----------------------|
| CLIENT_REVIEW | CHANGES_REQUESTED, CLIENT_APPROVED |
| CHANGES_REQUESTED | CLIENT_APPROVED, CHANGES_REQUESTED |
| *otros* | — (deny) |

### Opportunities — `OpportunityStatus` + `clientDecision`

Evidence:
- Seed/manager create uses `SENT_TO_CLIENT` (`db.ts`).
- `mapOpportunityLifecycle`: both `SENT_TO_CLIENT` and `RECOMMENDED` → UI stage `proposed` → Accept/Decline buttons (`OpportunityPanel.ts`).
- `updateOpportunityDecision('ACCEPTED')` sets **`status = IN_PROGRESS`** (not `ACCEPTED`) + `clientDecision = ACCEPTED`.
- `updateOpportunityDecision('REJECTED')` sets `status = REJECTED`.
- Checklist → stays/forces `IN_PROGRESS`; `submitOpportunity` → `COMPLETED`.

| OLD_STATE | ALLOWED_NEW_STATE (CLIENT) |
|-----------|----------------------------|
| SENT_TO_CLIENT | IN_PROGRESS (`clientDecision=ACCEPTED`) **or** REJECTED (`clientDecision=REJECTED`) |
| RECOMMENDED | IN_PROGRESS (`clientDecision=ACCEPTED`) **or** REJECTED (`clientDecision=REJECTED`) |
| IN_PROGRESS | COMPLETED (`submitOpportunity`) |
| ACCEPTED | IN_PROGRESS *(checklist force in `toggleOpportunityChecklistItem`)* |
| REJECTED / COMPLETED / ARCHIVED / DETECTED / UNDER_REVIEW | — (deny) |

### Notifications

Campo: `read: boolean`. CLIENT: `read: false → true`.  
**CREATE policy frozen:** only documented manager-alert flow.  
**Exact field allowlist:** must be frozen at **T-009-04** before **T-009-05n** rule implementation (not invented here).

### Theses (CLIENT update allowlist — frozen)

| Field / status | CLIENT |
|----------------|--------|
| `clientApprovalStatus` PENDING→APPROVED / CHANGES_REQUESTED | allow |
| `clientApprovedAt`, `clientFeedback`, related revision apply/clear per `thesisRevisionCore` | allow |
| `status` changes performed by those helpers (e.g. UNDER_REVIEW→DRAFT on reject) | allow |
| CREATE / DELETE / audiences / territories / objectives / weights / evidence relationships / scoring / other strategic fields | deny |

### signalOutcomes

No CLIENT state machine. CLIENT write **deny**; CLIENT read **deny**. Feedback → `FeedbackEvent`.

## Error Cases

| Caso | Comportamiento |
|------|----------------|
| Unauthenticated | `PERMISSION_DENIED` |
| ADMIN otra org get/list/write | `PERMISSION_DENIED` |
| CLIENT query/list otra org/client | `PERMISSION_DENIED` |
| CREATE con `organizationId`/`clientId` incorrectos | `PERMISSION_DENIED` |
| UPDATE que muta `organizationId` o `clientId` | `PERMISSION_DENIED` |
| UPDATE transición de status ilegal | `PERMISSION_DENIED` |
| Timestamp de workflow forjado (cuando regla lo exija) | `PERMISSION_DENIED` |
| DELETE cross-org / sin ownership | `PERMISSION_DENIED` |
| CLIENT create notification (sin excepción) | `PERMISSION_DENIED` |
| CLIENT write signalOutcomes | `PERMISSION_DENIED` |

## Security Requirements

Alineados a constitución §20 + **SEC-009-001…020**.

## Observability Requirements

- Emulator tests (assertSucceeds / assertFails) como evidencia primaria.
- Documentar en ops cómo ver denegaciones en Console.
- Secret scanning result (pass/fail/pending) en acceptance.
- OTel/Sentry fuera de scope.

## Acceptance Criteria

Ver `acceptance.md`. Incluye tests de query isolation, envelope create/update, state transitions, timestamps, Storage automated PASS vs PARTIAL.

## Tests

| Suite | Qué valida |
|-------|------------|
| `tests/firestore.rules.test.ts` | get/list, cross-org, verbs, allowlists, transitions, timestamps, notifications, signalOutcomes |
| `tests/storage.rules.test.ts` | matriz por asset; **PASS obligatorio** para Storage DONE |
| `npm run check` | no regresión dominio |

## Migration Impact

Ver `migration.md` (inventory → backfill → claims → deploy → rollback). **No ejecutar** hasta `APPROVED` + plan de migración autorizado.

## Traceability

| Requirement | Design | Tasks | Tests / Acceptance |
|-------------|--------|-------|--------------------|
| SEC-009-001 | unauthenticated deny | T-009-01, T-009-14 | A16 |
| SEC-009-002..004 | org-scoped ADMIN/CLIENT | T-009-01..03 | A1–A3 |
| SEC-009-005..007, 016 | allowlist + state matrix | T-009-04..06b | A4–A6, A17 |
| SEC-009-008..009 | Storage matrix | T-009-07..09 | A7–A8, O1 |
| SEC-009-010 | auditLogs org-scoped | T-009-02 | A1 |
| SEC-009-011..012 | provision + setPosturaClaims + SA | T-009-10..13 | A9–A10 |
| SEC-009-013 | rules suite | T-009-14 | A11 |
| SEC-009-014 | query isolation + Q1 fix | T-009-00, T-009-03q, T-009-06 | A14q |
| SEC-009-015 | CREATE/READ/LIST/UPDATE/DELETE | T-009-01..06 | A15 |
| SEC-009-017 | timestamp policy | T-009-05t | A17t |
| SEC-009-018 | notifications LP + create allowlist | T-009-05n | A18 |
| SEC-009-019 | signalOutcomes integrity | T-009-05o | A19 |
| SEC-009-020 | actor-aware persistence | T-009-06p | A21 |
| Thesis CLIENT allowlist | inventory §C.10 | T-009-04..05 | A23 |
| Hardcoded org removal | inventory §I | T-009-06 | A22 |
| Admin SDK envelope | scheduledIngest et al. | T-009-10b | **A24** |
| Governance CODE_COMPLETE vs DEPLOYED | lifecycle | T-009-14e → 14 → 15 → 16..19 | A12–A13, deploy section |
| Finalize denormalized envelope (remove primary get(parent)) | before CODE_COMPLETE | T-009-14e | inventory §F |
