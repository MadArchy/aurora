# BASELINE CONSTITUTION AUDIT

| Campo | Valor |
|-------|--------|
| **Git commit SHA** | `3d7ea20b5c997d035736abdeb97d30d33a996bfc` |
| **Git branch** | `main` (tracking `origin/main`) |
| **Node version** | `v24.7.0` |
| **npm version** | `11.5.1` |
| **Firebase CLI version** | `15.14.0` |
| **Audit tool/agent** | Cursor Agent (Composer) + explore subagent `d9a49e53-1d43-4392-bcf9-c181ef8bd09e` |
| **Constitution version** | `1.0` (`docs/architecture/POSTURA_CONSTITUTION.md`; espejo `specify/memory/constitution.md`) |
| **Repository state** | **dirty** (~81 paths: modified + untracked, incl. este audit y trabajo piloto no commiteado) |
| **Audit date (local)** | 2026-08-22 |
| **Mode** | Read-only analysis — no code changes in this audit task |

## BASELINE — Quality gates (verified 2026-08-22)

| Gate | Result | Notes |
|------|--------|--------|
| `npm run check` | **PASS** | typecheck + lint + `vitest run` |
| tests | **261 PASS** | 54 files (rules test excluded from default suite) |
| TypeScript | **PASS** | `tsc` `tsconfig.json` + `tsconfig.server.json` |
| Build | **PASS** | `npm run build` → Vite dist OK (chunk size warnings only) |
| Firebase rules tests | **PASS** | `npm run test:rules` → 7/7 (`tests/firestore.rules.test.ts`); JDK 21 + JAR `cloud-firestore-emulator-v1.20.4.jar` (~136 MB); config aislada `vitest.rules.config.ts` |
| E2E | **NOT IMPLEMENTED** | No Playwright/Cypress suite in repo |

**Re-run rules:**
```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
npm run test:rules
```

**Proyecto:** POSTURA / AURORA  
**Constitución SoT:** `docs/architecture/POSTURA_CONSTITUTION.md`  
**Contexto al auditar:** DoD piloto local+Firebase cerrado; oleadas 0–7 en código; quality gates arriba sobre working tree **dirty**.

---

## Por qué este documento no existía antes

La instrucción de primera tarea post-Constitución (`docs/audits/BASELINE_CONSTITUTION_AUDIT.md`) **no se ejecutó** en la sesión de piloto (DoD, Firebase, Storage, toasts). El trabajo se orientó a `plan-unificado.md` y ops, no a Spec Kit / constitución. Este archivo cierra esa deuda de gobernanza.

---

## Executive Summary

El sistema es un **MVP operativo fuerte** (dual tesis en datos, pipeline de contenido con humanos, Claim Safety, scoring con breakdown, Auth/Firestore piloto) pero **no es constitution-native**.

| Dimensión | Veredicto |
|-----------|-----------|
| Thesis-first / multi-thesis | **PARTIAL / NON_COMPLIANT** — router multi-tesis existe; UI y muchos servicios usan `getPrimaryThesis` / `[0]` |
| Strategic Brief | **NOT_IMPLEMENTED** |
| Disposition ≠ Format | **NON_COMPLIANT** — `RecommendedAction` mezcla ambos |
| Explainable scoring | **PARTIAL** — `buildScoreBreakdown` existe; falta versión de algoritmo y pesos versionados |
| Evidence → Claim | **PARTIAL** — Claim Safety; no grafo Claim formal |
| AI suggests / software governs | **PARTIAL** — gates deterministas; JSON de LLM sin validación runtime |
| AI Gateway | **PARTIAL** — proxy Vite; `aiComplete` Cloud Function = 501 |
| Security / tenant | **NON_COMPLIANT** — ADMIN sin match de `organizationId`; updates cliente sin field-level allowlist |
| Spec-driven / React | **NOT_IMPLEMENTED** — sin árbol `specs/`; 0 React |

**Ningún principio de producto §3–22 se marca COMPLIANT de extremo a extremo** sin evidencia incompleta. Solo la *política* de no big-bang React (§24–25) se considera COMPLIANT por ausencia de reescritura masiva.

---

## Cumplimiento por principio

Leyenda: `COMPLIANT` · `PARTIAL` · `NON_COMPLIANT` · `NOT_IMPLEMENTED` · `NEEDS_REVIEW`

| § | Principio | Estado | Evidencia concreta |
|---|----------|--------|-------------------|
| 2 | Visión producto | PARTIAL | Portales manager/cliente alineados a autoridad; aún hay caminos “generar contenido desde rec” sin brief |
| 3 | Thesis núcleo | PARTIAL | Scoring/routing usan tesis; muchos flujos caen a tesis primaria |
| 4 | Thesis-first architecture | PARTIAL | Signal→route→score→curation en `main.ts`; **sin Strategic Brief**; content desde draft/IA |
| 5 | Multi-thesis native | NON_COMPLIANT | `db.getPrimaryThesis` = `getActiveTheses()[0]`; `ClientWorkspace` `activeTheses[0]`; falta estado `LEGACY` en tipos |
| 6 | Master Positioning ≠ Thesis | PARTIAL | `ClientProfile` vs `PositioningThesis` separados; sin entidad Master Positioning explícita |
| 7 | Human-in-the-loop | PARTIAL | Pipeline publicación + claim gate; auto-discard low-score en `db.applyScoreToSignal` |
| 8 | AI suggests — software governs | PARTIAL | `claimSafetyGateCore`, `contentPublishCore`, scoring determinista; IA parsea JSON sin schema |
| 9 | Evidence before claim | PARTIAL | `claimSafetyCore.reviewClaims` + evidence IDs; sin Claim lifecycle / `EVIDENCE_REQUIRED` |
| 10 | Explainable intelligence | PARTIAL | `scoreExplainCore.buildScoreBreakdown`; falta algorithmVersion / model en score |
| 11 | Disposition ≠ Format | NON_COMPLIANT | `RecommendedAction` une MONITOR/SAVE con VIDEO/ARTICLE; umbrales en `scoring.ts` |
| 12 | Strategic Brief obligatorio | NOT_IMPLEMENTED | Cero símbolos `StrategicBrief` en `src/` |
| 13 | Taxonomías independientes | PARTIAL | `ThesisAudience` / `ThesisTerritory`; Geography/Framework incompletos |
| 14 | Data provenance | PARTIAL | `ProfileFactStatus` confirmed/candidate/rejected ≠ modelo DECLARED/INFERRED… |
| 15 | Authority multi-score | PARTIAL | `thesisStrengthCore` / advisor; no los 5 scores nombrados en constitución |
| 16 | Opportunity intelligence | PARTIAL | Oportunidades + lifecycle CLE; no paquete completo de inteligencia |
| 17 | Risk & professional safety | PARTIAL | Limits + Claim Safety; Risk Engine incompleto |
| 18 | Signal lifecycle | PARTIAL | `NEW/ANALYZED/CONVERTED/DISCARDED` — más corto que constitución |
| 19 | Learning loop | PARTIAL | `radarFeedbackCore` / outcomes; sin mutación automática de tesis (bien) ni loop formal |
| 20 | Security | NON_COMPLIANT | Ver Security Findings |
| 21 | AI output validation | NON_COMPLIANT | `JSON.parse` en `ai.ts`; sin Zod en `package.json` root |
| 22 | AI Gateway | PARTIAL | `server/postura-api.ts`; CF `aiComplete` stub 501; modelos hardcodeados |
| 23 | Target technology | PARTIAL | Vite+TS+Vitest+Firebase; Node 20 en CI/functions vs constitución Node 22; sin React |
| 24–25 | Incremental / no big-bang | COMPLIANT | No hay rewrite React; 0 `.tsx` de producto |
| 26–28 | Spec-driven / DoD / IDs | NOT_IMPLEMENTED | Sin `specs/001-…` |
| 29–30 | SoT / Cursor rules | NEEDS_REVIEW | Documentos existen; enforcement es proceso |
| 31 | Baseline audit | PARTIAL | Este documento cumple la intención; circuito E2E constitución incompleto |
| 32 | Target circuit | NOT_IMPLEMENTED | Brief → Planner → Content gobernado incompleto |

---

## Hallazgos detallados (incumplimientos)

### F-01 — Single-thesis / `getPrimaryThesis` / `[0]`

| Campo | Valor |
|-------|--------|
| Principio | §5 Multi-thesis native |
| Esperado | Nunca asumir una sola tesis activa para decisiones estratégicas |
| Actual | `getPrimaryThesis` → `[0]`; UI radar/advisor/topic/research usan primaria |
| Archivos | `src/services/db.ts` (`getPrimaryThesis`), `src/components/ClientWorkspace.ts` (~902), `src/main.ts` (múltiples), `src/services/advisor.ts`, `src/services/topicAgent.ts`, `src/services/researchSignalsAgent.ts`, `src/components/SourceRegistryModal.ts`, `src/components/ManagerCockpit.ts` |
| Severidad | **P1 High** |
| Riesgo de cambio | Medio-Alto — muchos call sites; requiere ThesisContext explícito en UI |
| Solución | Spec `001`: banear primaria en paths estratégicos; selector thesisId obligatorio; scoring solo vía `routeSignalAcrossTheses` |
| Migration | Sí (datos OK; contrato API UI) |
| Tests | Multi-thesis scoring siempre; UI no llama `getPrimaryThesis` en ingest/radar |

**Nota:** `src/domain/thesisRoutingCore.ts` `routeSignalAcrossTheses` **sí** compara múltiples tesis — evidencia de PARTIAL positivo.

### F-02 — Disposition mezclado con Content Format

| Campo | Valor |
|-------|--------|
| Principio | §11 |
| Esperado | Strategic Disposition separado de Recommended Output |
| Actual | Un solo `RecommendedAction`; score ≥70 → VIDEO, ≥50 → SHORT_POST |
| Archivos | `src/types/index.ts`, `src/services/scoring.ts` (~214–221), `src/domain/radarTriageCore.ts` |
| Severidad | **P1** |
| Riesgo | Medio — cambia semántica de radar/KPI |
| Solución | Spec `002`: tipos `Disposition` + `RecommendedOutput`; scoring en dos pasos |
| Migration | Sí (mapear acciones legacy) |
| Tests | Score alto no fuerza formato; disposition USE + output NONE válido |

### F-03 — Strategic Brief ausente

| Campo | Valor |
|-------|--------|
| Principio | §4, §12 |
| Esperado | Todo content estratégico desde Brief o override auditable |
| Actual | Curation + DeliveryPackage sustituyen; draft desde recomendación/IA |
| Archivos | (ausencia) `src/types`, `src/main.ts` `queueCurationInBriefing` / `generateContentDraft` |
| Severidad | **P1** |
| Riesgo | Alto — nuevo agregado de dominio |
| Solución | Spec `003` + gate Signal↛Content |
| Migration | Sí |
| Tests | Crear content sin brief falla salvo override auditado |

### F-04 — AI JSON sin validación runtime

| Campo | Valor |
|-------|--------|
| Principio | §8, §21 |
| Esperado | Schema validation (Zod/JSON Schema) antes de mutar dominio |
| Actual | `JSON.parse(live.text) as T` en `ai.ts` y agentes |
| Archivos | `src/services/ai.ts`, `topicAgent.ts`, `researchSignalsAgent.ts` |
| Severidad | **P1** |
| Riesgo | Medio |
| Solución | Spec `005`: Zod compartido server/functions/front |
| Migration | No de datos |
| Tests | Payload inválido → fail closed |

### F-05 — Modelos IA hardcodeados

| Campo | Valor |
|-------|--------|
| Principio | §22 |
| Esperado | Model registry / config |
| Actual | `gpt-4o-mini`, `claude-3-5-haiku-…` en `ai.ts`; allowlist en `postura-api.ts` |
| Severidad | **P2** |
| Solución | Registry + env; sin strings sueltos en dominio |
| Tests | Router elige clase, no string mágico en UI |

### F-06 — Claves IA vía UI del navegador

| Campo | Valor |
|-------|--------|
| Principio | §20, §22 |
| Esperado | Secret Manager / gateway; no claves de proveedor en browser en prod |
| Actual | Inputs OpenAI/Claude en Manager → `/api/ai/session` (mitigado en local); CF `aiComplete` = 501 |
| Archivos | `ManagerCockpit.ts`, `ai.ts`, `functions/src/index.ts` |
| Severidad | **P1** (prod) / **P2** (dev loopback) |
| Solución | Completar gateway; deshabilitar session keys en builds hosting |
| Tests | Prod build no acepta setSessionKeys |

### F-07 — Firestore / Storage sin org isolation real

| Campo | Valor |
|-------|--------|
| Principio | §20 |
| Esperado | `organizationId` en token == recurso; field-level security |
| Actual | `sameOrg()` casi unused; ADMIN escribe cualquier clientId; client `update` amplio en contents/tasks/opportunities; Storage `read,write` si ownsClient |
| Archivos | `firestore.rules`, `storage.rules` |
| Severidad | **P0 Critical** |
| Riesgo | Alto — puede romper clientes demo si mal desplegado |
| Solución | Spec `009`; tests `@firebase/rules-unit-testing` ampliar org mismatch |
| Migration | Claims + backfill org en docs |
| Tests | Elena no lee Juan; ADMIN de otra org denegado |

### F-08 — Service account en disco

| Campo | Valor |
|-------|--------|
| Principio | §20 |
| Esperado | Secretos fuera del tree o solo CI |
| Actual | `secrets/firebase-sa.json` presente, gitignored |
| Severidad | **P1** (higiene) / **P0** si se commitea |
| Solución | Verificar git history; rotar si expuesto; documentar en ops |
| Migration | N/A |

### F-09 — Evidence / Claim incompleto

| Campo | Valor |
|-------|--------|
| Principio | §9 |
| Esperado | Claim → Evidence → Verification → Source |
| Actual | Heurística Claim Safety + vault/proof wall |
| Archivos | `claimSafetyCore.ts`, `ProofWallPanel.ts`, evidence vault |
| Severidad | **P2** |
| Solución | Spec `006` |
| Tests | Affirmación sin evidence → EVIDENCE_REQUIRED |

### F-10 — Monolitos UI + lógica de negocio

| Campo | Valor |
|-------|--------|
| Principio | §23–24, deuda |
| Esperado | Domain puro; UI delgada |
| Actual | `main.ts` ~4.2k; `ClientWorkspace.ts` ~2.3k; `db.ts` ~2.3k orquestan estrategia |
| Severidad | **P2** |
| Solución | Extraer controllers; React strangler después de specs de dominio |
| Tests | Domain tests ya existen; aumentar cobertura de orquestación |

### F-11 — Node 20 vs constitución 22

| Campo | Valor |
|-------|--------|
| Principio | §23 |
| Actual | CI + functions engines node 20; sin `.nvmrc`; root sin engines |
| Severidad | **P2** |
| Solución | Alinear a 22 **o** enmendar constitución vía Spec |
| Tests | CI matrix |

### F-12 — Spec Kit / IDs de requisito

| Campo | Valor |
|-------|--------|
| Principio | §26–28 |
| Actual | Solo `specify/memory/constitution.md` |
| Severidad | **P2** |
| Solución | Crear `specs/001-…` según secuencia abajo |

### F-13 — Signal → Content sin Brief

| Campo | Valor |
|-------|--------|
| Principio | §4, §12 |
| Actual | Tras score, curation/delivery/content draft sin Brief |
| Severidad | **P1** (ligado a F-03) |
| Solución | Misma Spec `003` |

### F-14 — Scoring no 100% explicable

| Campo | Valor |
|-------|--------|
| Principio | §10 |
| Actual | Breakdown sí; falta versión algoritmo, modelo IA en score, pesos versionados |
| Severidad | **P2** |
| Solución | Spec `002` |

---

## P0 Findings

1. **Firestore/Storage rules:** ADMIN no acotado por `organizationId`; updates de cliente sin field allowlist (`firestore.rules`, `storage.rules`).
2. **Riesgo de filtración de SA:** `secrets/firebase-sa.json` en máquina local (gitignored — verificar historial).

## P1 Findings

1. Multi-thesis: `getPrimaryThesis` / `activeTheses[0]` en paths estratégicos.  
2. Disposition ≠ Format incumplido.  
3. Strategic Brief no implementado.  
4. AI JSON sin Zod.  
5. Gateway IA incompleto + claves vía UI.  
6. Signal↛Content sin brief gate.

## P2 Findings

1. Node 20 vs 22; sin `.nvmrc`.  
2. Claim/Evidence model incompleto.  
3. Score weights no versionados.  
4. Monolitos `main.ts` / `ClientWorkspace.ts` / `db.ts`.  
5. Sin árbol `specs/`.  
6. Modelos IA hardcodeados.  
7. Ciclo de vida Signal demasiado corto.

## P3 Findings

1. React migration no iniciada (esperado por §24).  
2. Taxonomías string + structured mezcladas.  
3. Observabilidad (OTel/Sentry) no evidenciada.

---

## Technical Debt Map

| Área | Deuda | Prioridad |
|------|-------|-----------|
| Seguridad reglas | Org + field-level | P0 |
| Dominio estratégico | Brief + Disposition split | P1 |
| Multi-thesis UX/API | Eliminar primaria estratégica | P1 |
| AI | Zod + gateway + registry | P1 |
| Frontend | Modularizar `main.ts` | P2 |
| Platform | Node align | P2 |
| UI stack | React strangler | P3 (después dominio) |

---

## Spec Gaps

| Spec (constitución / recomendada) | Estado en repo |
|-----------------------------------|----------------|
| 001-strategic-signal-routing | Parcial (core routing sí; call sites no) |
| 002-strategic-scoring-v2 | Parcial (explainability; sin split disposition) |
| 003-strategic-brief | **Ausente** |
| 004-strategic-planner | Solo curation/delivery |
| 005-ai-gateway | Proxy local; CF stub |
| 006-evidence-claim-linking | Claim Safety parcial |
| 007-opportunity-scout | Oportunidades básicas |
| 008-learning-loop | Outcomes parcial |
| 009-security-hardening | **Spec abierta (DRAFT)** en `specs/009-security-hardening/` — rules aún insuficientes hasta implementar |
| 010-react-migration | No iniciado |

---

## Proposed Spec Sequence

Orden exacto recomendado (alineado a constitución §31–32 y dependencia de riesgo):

1. **`009-security-hardening`** — org-scoped rules, field-level updates, Storage least privilege, higiene de secretos  
2. **`005-ai-gateway`** — `aiComplete` real, Zod, model registry, sin keys en browser en prod  
3. **`001-strategic-signal-routing`** — eliminar `[0]`/primary en estrategia; estados LEGACY; contrato ACTIVE-only scoring  
4. **`002-strategic-scoring-v2`** — Disposition vs Output; pesos versionados; explainability completa  
5. **`003-strategic-brief`** — entidad Brief + gate obligatorio  
6. **`006-evidence-claim-linking`** — grafo Claim/Evidence  
7. **`004-strategic-planner`** — Brief → plan → content  
8. **`007-opportunity-scout`**  
9. **`008-learning-loop`**  
10. **`010-react-migration`** — strangler por módulo UI  

---

## React Migration Candidates

Orden de strangler (después de estabilizar dominio):

1. `src/main.ts` (~4200) — controlador / event bus  
2. `src/components/ClientWorkspace.ts` (~2300)  
3. `src/components/ClientPortal.ts` (~870)  
4. `src/components/Modals.ts` (~740)  
5. `src/components/ManagerCockpit.ts` (~580)  
6. `ThesisEditorModal.ts`, `AppShell.ts`, `OnboardingWizard.ts`, `OpportunityPanel.ts`  

**Conservar y no reescribir primero:** `src/domain/*`, tests Vitest, contratos Firestore.

---

## Backend Hardening Candidates

- Implementar `aiComplete` con Secret Manager  
- Reglas Firestore: `token.organizationId == resource.data.organizationId`  
- Allowlists `diff()` en updates de cliente  
- Storage: org + contentType + size + role  
- Functions: AI runs auditables, research programado  
- Alinear Node 22 (o Spec que enmiende constitución)  
- Zod compartido `server/` + `functions/` + client validation helpers  

---

## Security Findings

| Finding | Severidad |
|---------|-----------|
| ADMIN cross-tenant sin match org (Firestore/Storage) | **Critical** |
| Client `update` amplio sin field allowlist | **High** |
| Storage write permisivo por ownsClient | **High** |
| `secrets/firebase-sa.json` en disco | **High** si leak / **Medium** si solo local+ignored |
| Claves proveedor vía UI → proxy; CF AI no prod | **Medium–High** |
| LLM JSON sin schema → dominio | **Medium** |
| `VITE_FIREBASE_*` (esperado Firebase) | **Info** |

---

## Estimated Migration Dependency Graph

```text
009-security-hardening
        │
        ▼
005-ai-gateway ──────────────┐
        │                    │
        ▼                    │
001-routing ──► 002-scoring ─┼──► 003-brief ──► 004-planner
        │                    │         │
        │                    │         ▼
        │                    └──► 006-claims
        │                              │
        └──────────► 007-scout ◄───────┘
                           │
                           ▼
                     008-learning
                           │
                           ▼
                  010-react-migration
```

**Dependencias duras:** Brief (`003`) no debe implementarse sin scoring/disposition claros (`002`) y routing multi-tesis (`001`). React (`010`) no antes de contratos de dominio estables.

---

## Búsqueda específica (checklist instrucción)

| Búsqueda | Resultado |
|----------|-----------|
| `activeTheses[0]` | **Sí** — `ClientWorkspace.ts` |
| Lógica una sola tesis | **Sí** — `getPrimaryThesis` + call sites |
| Signal → Content directo | **Riesgo** — sin Brief; sí hay score previo en muchos paths |
| Disposition vs Format mezclados | **Sí** — `RecommendedAction` + umbrales |
| Scoring no explicable | **Parcial** — breakdown existe |
| Evidence no vinculada a Claims | **Parcial** — IDs en findings; sin grafo |
| IA JSON sin validation | **Sí** |
| Modelos hardcodeados | **Sí** |
| IA desde navegador (keys) | **Parcial** — UI keys → proxy; no VITE_OPENAI |
| Cloud functions incompletas | **Sí** — `aiComplete` 501 |
| Secretos en proyecto | **SA JSON local** gitignored |
| Firestore sin org validation | **Sí** |
| Falta field-level security | **Sí** |
| Storage demasiado permisivo | **Sí** |
| Node inconsistente | **Sí** (20 vs 22) |
| Build/typecheck errors | **No** al momento del audit (`npm run check` verde) |
| Archivos frontend grandes | **Sí** |
| UI + business logic mezclados | **Sí** |
| Duplicación services/domain/UI | **Sí** (orquestación en `main`) |
| Deuda React | **Sí** — strangler pendiente |

---

## Conclusión operativa

1. **No declarar cumplimiento constitucional** del producto hasta Specs 009 → 005 → 001 → 002 → 003.  
2. El piloto DoD Firebase **no contradice** este audit: valida usabilidad operativa, no la constitución completa.  
3. Siguiente acción de gobernanza: abrir **Spec `009-security-hardening`** (o activar Storage Console como ops, en paralelo y fuera de Spec).

---

*Generado como baseline §31. No modifica código. Evidencia referida a paths del repo AURORA a 2026-08-22.*
