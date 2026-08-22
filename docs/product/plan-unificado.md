# Plan unificado Postura — Piloto real con Juan Vásquez

**Versión:** 1.0 · **Fecha:** 20 ago 2026  
**Fuentes integradas:** docs Postura (técnico, plain-language, build-requirements), plan de marketing Juan (.docx), estado AURORA (`docs/product/estado-2026-08-19.md`), auditoría de código.

**Regla de oro:** Los agentes proponen; los humanos deciden. Nada llega a `published` sin acción explícita del manager o aprobación del cliente.

---

## 1. Norte estratégico (una sola frase)

**Postura convierte la tesis de posicionamiento de un profesional en un pipeline diario de acciones pequeñas** (grabar, revisar, aprobar, decidir oportunidades) **ejecutado por el cliente y orquestado por el Brand Manager**, con inteligencia (radar, scoring, redacción IA) siempre filtrada por esa tesis.

**Cliente piloto:** Juan J. Vasquez — abogado PI + adopción de IA (People / Tools / Rules), dos vías de práctica complementarias.

---

## 2. Mapa del sistema (dos portales, un pipeline)

```mermaid
flowchart TB
  subgraph inputs [Entradas]
    TH[Tesis + Dossier]
    SRC[Fuentes RSS / News]
    PROF[Perfil / Onboarding]
  end

  subgraph manager [Portal Manager]
    RAD[Radar + Scoring]
    CUR[Curación]
    ENT[Entregas / Briefings]
    PRO[Producción + Plan]
    OPP Scout[Oportunidades]
  end

  subgraph client [Portal Cliente]
    HOME[Inicio semanal]
    TASK[Tareas / Media]
    CONT[Revisión contenido]
    LIB[Biblioteca]
    POS[Posicionamiento]
    RES[Resultados / KPIs]
  end

  subgraph gates [Puertas humanas]
    MGR[Manager revisa / envía]
    CLI[Cliente aprueba / graba]
    PUB[Manager publica]
  end

  TH --> RAD
  SRC --> RAD
  PROF --> PRO
  RAD --> CUR --> ENT --> PRO
  PRO --> MGR --> TASK
  MGR --> CLI
  CLI --> MGR --> PUB
  OPP Scout --> CLI
  PUB --> LIB
  RES --> manager
```

| Rol | Pregunta que responde | No hace |
|-----|----------------------|---------|
| **Manager** | ¿Qué importa hoy? ¿Qué envío al cliente? ¿Qué publico? | Sustituir el juicio del cliente |
| **Cliente** | ¿Qué hago esta semana en 15–30 min? | Ver radar, curar fuentes, publicar solo |

---

## 3. Inventario: qué tenemos hoy (AURORA)

### 3.1 Infraestructura y calidad ✅
| Área | Estado | Ubicación |
|------|--------|-----------|
| Auth Firebase + claims POSTURA | ✅ | `src/firebase/`, `src/services/auth.ts` |
| Aislamiento por `clientId` | ✅ | `src/domain/clientIsolationCore.ts`, `firestore.rules` |
| XSS / escape | ✅ | `src/lib/escape.ts` |
| API SSRF + rate limit IA | ✅ | `server/ssrf.ts`, `postura-api.ts` |
| Tests + CI | ✅ 260+ | `tests/`, `npm run check` |
| Firebase sync + realtime | ✅ | `src/services/firestore/sync.ts` |
| Reglas Firestore + Storage | ✅ | `firestore.rules`, `storage.rules`, `test:rules` |
| Pipeline publicación canónico | ✅ | `contentPublishCore.ts`, Manager Producción |

### 3.2 Portal Manager ✅
| Módulo | Estado |
|--------|--------|
| Cockpit cartera + KPIs semanales | ✅ |
| Workspace completo (Fuentes → Resultados) | ✅ |
| Producción: pipeline QA → Listo → Publicar | ✅ |
| Topic Agent con rationale | ✅ |
| Claim Safety gate en publicación | ✅ |

### 3.3 Portal Cliente ✅ (piloto Juan)
| Pestaña | Estado | Notas |
|---------|--------|-------|
| Inicio | ✅ | Plan 90 días, semana, KPIs, CLE destacada |
| Mis tareas | ✅ | Teleprompter + envío video → manager |
| Contenido | ✅ | Revisión + diff artículos |
| Oportunidades | ✅ | Accept → checklist → submitted + reminder |
| Mi perfil | ✅ | Onboarding v2, cobertura, muro pruebas |
| Posicionamiento | ✅ | Dual tesis + editor por pasos |
| Resultados | ✅ | KPIs alineados plan marketing |
| Biblioteca | ✅ | Preview read-only |

### 3.4 Gaps restantes (post-DoD) 🔶
1. ~~Recorrido manual DoD §7~~ — ✅ cerrado 2026-08-22 (`docs/ops/pilot.md`).
2. **Firebase Storage** — ⏳ bloqueado en Console: hay que pulsar **Get Started** en Storage; luego `firebase deploy --only storage`.
3. **Hosting** — URL pública piloto (`firebase:deploy:hosting`) tras Storage.
4. **Cloud Functions** (ingesta RSS/Tavily) — requiere plan Blaze + secretos.
5. ~~Decisiones producto~~ — ✅ readiness **70**; challenge **opcional** (no bloquea envío).

---

## 4. Requisitos unificados (todos los documentos → una lista)

### 4.1 Del cliente profesional (plain-language + plan Juan)
- [ ] Onboarding que construye perfil rico (historia, credenciales, voz, compliance).
- [ ] Lista de tareas pequeñas con contexto (por qué esta pieza, para qué plataforma).
- [ ] Grabar video en móvil con teleprompter del guion.
- [ ] Revisar/editar artículos en su voz; aprobar o rechazar con razón.
- [ ] Decidir oportunidades (charlas, CLE, podcasts) con deadlines.
- [ ] Nada publicado sin su OK explícito.
- [ ] Ver progreso de campaña (30/90 días, ritmo semanal).
- [ ] Métricas de negocio: consultas, visibilidad, publicaciones.

### 4.2 Del Brand Manager (technical + build-requirements)
- [ ] Tesis como objeto raíz; ThesisContext versionado.
- [ ] Radar → Curación → Plan → Producción → Entrega → Cliente → QA → Publicación.
- [ ] Modo manual vs auto por cliente.
- [ ] Agentes con JSON validado, invocaciones logueadas.
- [ ] Multi-tenant / multi-cliente aislado.
- [ ] Auditoría de acciones sensibles.

### 4.3 De Juan específicamente (plan marketing .docx)
- [ ] Tesis: *IP + AI Adoption Attorney* — People / Tools / Rules.
- [ ] Dos vías: PI/patentes + adopción/gobernanza IA.
- [ ] Cadencia: 3 posts LI/semana, 2 videos/mes, 1 artículo/mes.
- [ ] 6 pilares de contenido + formatos (checklist, marco, mito/realidad…).
- [ ] Plan 30 días (día a día) + expansión 90 días.
- [ ] Sistema operativo semanal (Lun–Vie).
- [ ] KPIs §11.3: vistas perfil, consultas, visitas web, derivaciones.
- [ ] Muro de pruebas (libro, 3ITAL, State Bar, artículos…).

---

## 5. Plan de ejecución único (7 oleadas)

Un solo orden. Cada oleada tiene criterio de salida. **No avanzar sin cumplir el criterio.**

---

### Oleada 0 — Baseline y datos Juan (3–5 días)
**Objetivo:** el piloto tiene un cliente real configurado, no demo genérico.

| # | Entrega |
|---|---------|
| 0.1 | Segunda tesis/campaña Juan: «PI, patentes y opiniones» además de «Adopción IA» |
| 0.2 | Seed plan 30 días (días 1–30 del .docx) como `CampaignMilestone[]` |
| 0.3 | Seed 10 temas video + 5 posts ejemplo (§6.4, §7.1) como borradores en cola manager |
| 0.4 | KPIs §11.3 definidos en schema `ResultRecord` |
| 0.5 | Checklist muro de pruebas §5.3 como `EvidenceVaultItem` seed |

**Criterio de salida:** manager abre Juan → ve 2 campañas, milestones día 14/30, cola de contenido alineada al doc.

**Archivos tocados:** `db.ts` seeds, `juanMasterDossier.ts`, tipos `Campaign`, `CampaignMilestone`.

---

### Oleada 1 — Modelo de estados unificado (1 semana)
**Objetivo:** un solo spine `ContentItem` conectado a lo que ve el cliente.

| # | Entrega |
|---|---------|
| 1.1 | Enum estados canónicos: `sent_to_client` → `client_in_progress` → `client_submitted` → `manager_finalizing` → `qa_check` → `ready_to_publish` → `published` |
| 1.2 | `stateHistory[]` en cada ítem (actor, timestamp, comment) |
| 1.3 | Mapeo Task ↔ ContentItem (unificar o puente explícito) |
| 1.4 | Invariante: ningún path a `published` sin actor humano (test) |
| 1.5 | Campos enriquecidos: `format`, `pillar`, `platform`, `campaignDay` |

**Criterio de salida:** transición completa simulada en tests; UI muestra estado legible en portal cliente.

**Archivos:** `src/types`, `src/domain/stateMachine.ts`, `db.ts`, tests.

---

### Oleada 2 — Portal cliente: centro de ejecución (1 semana)
**Objetivo:** el home responde «¿qué hago esta semana?» (plan Juan §10).

| # | Entrega |
|---|---------|
| 2.1 | Rediseño **Inicio**: semana Lun–Vie + progreso 30 días + urgentes |
| 2.2 | Selector campaña/tesis en header cliente |
| 2.3 | Eliminar duplicación Inicio vs Mis tareas |
| 2.4 | Etiquetas visuales: formato + pilar + plataforma en cada tarea |
| 2.5 | Deep-links notificación → tarea concreta resaltada |

**Criterio de salida:** Juan abre portal en móvil → ve 4–5 acciones de la semana con contexto; cambia campaña PI ↔ Adopción IA.

**Archivos:** `ClientPortal.ts`, `AppShell.ts`, `PageHeader.ts`.

---

### Oleada 3 — Media end-to-end (1–2 semanas) 🔴 CRÍTICA
**Objetivo:** Build Req Phase 5 — grabar en móvil, manager recibe, publica.

| # | Entrega |
|---|---------|
| 3.1 | Upload video a Storage (Firebase) o blob persistente v6 (fallback local) |
| 3.2 | Teleprompter mobile-first: fuente grande, scroll speed, thumb zone |
| 3.3 | Preview + retake antes de enviar |
| 3.4 | Manager: reproducir, descargar, re-subir versión final |
| 3.5 | Transición `client_submitted` → `manager_finalizing` automática al enviar |

**Criterio de salida:** viewport 375px, grabar 30s, manager ve video en workspace tareas.

**Archivos:** `recordings.ts`, `Modals.ts` (teleprompter), `ClientWorkspace.ts`, Storage rules.

---

### Oleada 4 — Artículos y feedback (1 semana)
**Objetivo:** «review and approve this 900-word article» con trazabilidad.

| # | Entrega |
|---|---------|
| 4.1 | Editor cliente (TipTap lite o textarea estructurada) |
| 4.2 | `FeedbackEvent` con diff al guardar |
| 4.3 | Aprobar → `client_submitted`; rechazar → modal razón obligatoria |
| 4.4 | Manager ve diff antes de finalizar |

**Criterio de salida:** test de diff; manager identifica cambios del cliente.

---

### Oleada 5 — Perfil, onboarding y muro de pruebas (1–2 semanas)
**Objetivo:** Build Req Phase 2 adaptado al MVP.

| # | Entrega |
|---|---------|
| 5.1 | Pestaña **Mi perfil** post-onboarding (editar facts confirmados) |
| 5.2 | Subida CV → extracción texto → facts candidatos |
| 5.3 | Onboarding v2: checklist cobertura + pasos adaptativos |
| 5.4 | Posicionamiento: muro de pruebas §5.3 con ✅/pendiente |
| 5.5 | Vista servicios (2 vías §3.1–3.2) solo lectura |

**Criterio de salida:** ≥20 facts en ≥5 secciones; muro de pruebas visible.

---

### Oleada 6 — Oportunidades, KPIs y manager loop (1 semana)
**Objetivo:** cerrar lifecycle oportunidades + métricas de negocio.

| # | Entrega |
|---|---------|
| 6.1 | Oportunidad: `proposed` → accept/decline → checklist → submitted |
| 6.2 | Resultados: KPIs §11.3 (consultas, vistas LI, visitas web…) |
| 6.3 | Gráfico semanal cliente + vista manager |
| 6.4 | Recordatorios deadline (in-app + email stub) |
| 6.5 | Entregas/briefings con rationale expandible |

**Criterio de salida:** una oportunidad recorre lifecycle completo; KPIs registrados y visibles.

---

### Oleada 7 — Backend autoritativo + agentes (2–4 semanas, paralelo posible)
**Objetivo:** Firebase live + primer agente útil (no bloquea oleadas 0–6 en local).

| # | Entrega |
|---|---------|
| 7.1 | Firebase Auth + custom claims (ADMIN/CLIENT) |
| 7.2 | Firestore reglas probadas en Emulator |
| 7.3 | Migración localStorage v5 → Firestore (importador) |
| 7.4 | Storage para media |
| 7.5 | Topic Agent v1: ranked list diaria con rationale (manual trigger) |
| 7.6 | Hosting + CSP |

**Criterio de salida:** 2 clientes simultáneos; editar localStorage no cambia datos remotos.

---

## 6. Calendario sugerido (12 semanas)

| Semanas | Oleada | Hito visible |
|---------|--------|--------------|
| 1 | 0 + 1 | Juan con 2 campañas + estados canónicos |
| 2 | 2 | Home semanal operativo |
| 3–4 | 3 | **Video móvil → manager** (hito piloto) |
| 5 | 4 | Artículos con diff |
| 6–7 | 5 | Perfil + muro de pruebas |
| 8 | 6 | KPIs + oportunidades completas |
| 9–12 | 7 | Firebase + Topic Agent (opcional antes si hay credenciales) |

---

## 7. Definition of Done — Piloto Juan

El piloto está listo cuando **Santiago (manager) y Juan (cliente)** pueden recorrer esto sin workarounds:

1. **Lunes:** Juan abre portal → ve post LinkedIn (checklist) de la semana → lo aprueba o edita.
2. **Jueves:** Juan graba video 60–90s con teleprompter → envía → Santiago lo ve, descarga, edita, re-sube.
3. **Oportunidad:** Scout propone CLE → Juan acepta → checklist visible → reminder antes del deadline.
4. **Métricas:** Juan registra 2 consultas recibidas → aparecen en dashboard semanal.
5. **Campaña:** Cambia entre «Adopción IA» y «PI/Patentes» → tareas y contenido filtrados.
6. **Seguridad:** Cliente B no ve datos de Juan; manipular localStorage no eleva permisos.
7. **Calidad:** `npm run check` verde en CI.

---

## 8. Fuera de alcance (v1 — no construir ahora)

| Item | Razón | Dejar seam |
|------|-------|------------|
| Monorepo Next.js + Prisma + BullMQ | Migración grande; MVP Vite valida loop primero | Repositorios + interfaces ya existen |
| Publicación API LinkedIn/IG/X | Tier B assisted only (docs §4) | PlatformTarget stub |
| Citation Verification Agent | v2 | `draft.citations[]` en schema |
| Performance Agent | v2 | KPIs manuales primero |
| Website auto-generate | Brief generator fast-follow | Export dossier markdown ✅ |
| Producto B2B evaluación IA de Juan | Producto aparte; Postura alimenta contenido | Landing links en muro pruebas |
| RESEARCH_SIGNALS agent | Después de cerrar loop cliente | Radar manual + scoring ✅ |

---

## 9. Stack y comandos (referencia única)

```
Frontend:  Vite + TypeScript vanilla
Datos:     Firebase Firestore (autoritativo) · fallback localStorage sin .env.local
API dev:   server/postura-api.ts (RSS + IA proxy local)
Auth:      Firebase Auth + custom claims · demo local solo sin Firebase
Media:     Firebase Storage · fallback IndexedDB
Calidad:   npm run check | npm run checklist:pilot | npm run firebase:prep
```

**Credenciales demo:** `manager@postura.internal` / `Postura2026!` · `juan.vasquez@lexfirm.com` / `Postura2026!` · `elena.martinez@lexfirm.com` / `Postura2026!`

---

## 10. Documentos de referencia (no duplicar)

| Documento | Uso en este plan |
|-----------|------------------|
| `Postura - Technical-description.md` | Arquitectura, agentes, state machines |
| `Postura - System-overview-plain-language.md` | Promesa al cliente y manager |
| `Postura - Build-requirements-for-coding-agent.md` | Fases 2–8 originales → mapeadas a oleadas 1–7 |
| `Plan Marketing Juan (.docx)` | Seed contenido, cadencia, KPIs, oleada 0 |
| `docs/product/estado-2026-08-19.md` | Inventario técnico post-hardening (histórico) |
| `juanMasterDossier.ts` | Fuente de verdad voz/posicionamiento Juan |

---

## 11. Próxima acción inmediata

**Hecho:** DoD §7 local + Firebase (acta 2026-08-22).

**Orden de ejecución post-piloto:**

1. **P0 Storage** — ⏳ Tú: Console → Storage → Get Started → luego `firebase deploy --only storage`.
2. **P1 Hosting** — `npm run firebase:deploy:hosting` → smoke login URL pública.
3. ~~P2 Producto~~ — ✅ readiness 70 · challenge opcional (`THESIS_CHALLENGE_REQUIRED_BEFORE_SUBMIT=false`).
4. **P3 Operación** — una semana real Juan (3 posts + 1 video + KPIs).
5. **P4 Functions** — solo tras upgrade Blaze + secretos Tavily/YouTube.

**Remediación reciente:** sync Firestore strip `undefined` (toast `clientReviewBaseline`); aislamiento portal sin fallback Juan; editor contenido solo ADMIN.

---

*Este documento reemplaza planes fragmentados anteriores. Actualizar al completar cada oleada.*
