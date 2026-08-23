# POSTURA / AURORA
## Constitución del Proyecto y Reglas de Evolución Técnica

**Versión:** 1.0  
**Estado:** SOURCE OF TRUTH  
**Tipo:** Project Constitution  
**Objetivo:** Gobernar todas las decisiones funcionales, arquitectónicas y de implementación del proyecto.

---

# 1. PROPÓSITO DE ESTE DOCUMENTO

Este documento establece las reglas fundamentales que cualquier desarrollador, agente de IA, Cursor Agent o proceso automatizado debe respetar al modificar POSTURA/AURORA.

Este documento tiene prioridad sobre:

- prompts improvisados;
- decisiones automáticas del agente;
- refactors oportunistas;
- inferencias del código existente;
- preferencias de implementación;
- cambios visuales no documentados.

Si existe conflicto entre una implementación existente y esta constitución, no modificar silenciosamente el comportamiento.

El conflicto debe documentarse y resolverse mediante una Specification antes de implementar.

---

# 2. VISIÓN DEL PRODUCTO

POSTURA es un sistema de:

**Strategic Positioning & Brand Development Intelligence**

para profesionales cuya actividad profesional o comercial depende de ser reconocidos como una autoridad en un territorio determinado.

No es simplemente:

- un agregador de noticias;
- un generador de contenido;
- un administrador de redes sociales;
- una herramienta de SEO;
- un chatbot;
- un sistema de autopublicación.

POSTURA transforma la construcción de reputación profesional en un proceso estratégico, trazable y administrado.

---

# 3. PRINCIPIO FUNDAMENTAL

La Positioning Thesis es el núcleo del sistema.

Toda decisión estratégica debe responder:

> ¿Esta acción contribuye a que este cliente sea reconocido por la audiencia correcta, sobre el territorio correcto y para el objetivo correcto?

Si la respuesta es NO:

el sistema no debe realizarla.

---

# 4. THESIS-FIRST ARCHITECTURE

Toda decisión estratégica debe estar relacionada con una Thesis.

Una Thesis define:

- expert identity;
- current perception;
- target perception;
- target mental association;
- audiences;
- geographies;
- territories;
- frameworks;
- standards;
- objectives;
- evidence;
- voice;
- hard limits;
- soft limits;
- campaigns.

Ninguna Signal debe convertirse directamente en Content.

Flujo obligatorio:

Signal
→ Thesis Routing
→ Strategic Scoring
→ Decision
→ Strategic Brief
→ Content

---

# 5. MULTI-THESIS NATIVE

POSTURA debe soportar múltiples tesis por cliente.

Nunca asumir que un cliente tiene solamente una tesis.

Está prohibido utilizar patrones de decisión estratégica similares a:

```typescript
activeTheses[0]
```

cuando existan múltiples tesis.

Toda Signal debe ser comparada contra todas las Thesis que tengan un estado elegible para evaluación.

Estados mínimos:

- DRAFT
- UNDER_REVIEW
- ACTIVE
- PAUSED
- ARCHIVED
- LEGACY

Solamente las Thesis ACTIVE participan normalmente en Opportunity Scoring.

UNDER_REVIEW no participa en producción.

ARCHIVED y LEGACY no participan en scoring.

---

# 6. MASTER POSITIONING ≠ THESIS

Separar obligatoriamente:

## Master Positioning

Identidad profesional general del cliente.

Ejemplo:

**Intellectual Property & AI Adoption Attorney**

de:

## Positioning Thesis

Campaña estratégica específica.

Ejemplo:

**Patent Strategy & Intellectual Property**

o:

**Enterprise AI Adoption & Governance**

El Master Positioning puede combinar diferentes capacidades.

Las Thesis deben mantener suficiente foco para construir una asociación mental clara.

---

# 7. HUMAN-IN-THE-LOOP

POSTURA no es un sistema de autopublicación autónoma.

La IA:

- investiga;
- analiza;
- compara;
- recomienda;
- redacta;
- clasifica;
- prioriza.

La persona:

- revisa;
- aprueba;
- modifica;
- rechaza;
- publica o autoriza publicación.

Nada debe publicarse bajo el nombre del cliente sin aprobación conforme al workflow configurado.

---

# 8. AI SUGGESTS — SOFTWARE GOVERNS

Los LLM no controlan directamente estados críticos del dominio.

La IA puede:

- interpretar;
- clasificar;
- proponer;
- resumir;
- redactar;
- encontrar relaciones semánticas.

La lógica determinista debe gobernar:

- permisos;
- estados;
- transiciones;
- thresholds;
- scoring aggregation;
- tenant isolation;
- publication authorization;
- hard limits;
- auditability.

Nunca delegar estas decisiones únicamente a lenguaje natural producido por un LLM.

---

# 9. EVIDENCE BEFORE CLAIM

Toda afirmación que contribuya a la autoridad profesional debe poder rastrearse.

Modelo:

Claim
→ Evidence
→ Verification
→ Source

Un Proof Point no debe aumentar Authority Score solamente porque aparece escrito en un perfil.

Debe existir Evidence relacionada.

Si no existe evidencia:

estado:

EVIDENCE_REQUIRED

o:

RESEARCH_REQUIRED

según corresponda.

---

# 10. EXPLAINABLE INTELLIGENCE

Ningún Opportunity Score debe ser una caja negra.

Debe ser posible explicar:

- qué tesis fue considerada;
- qué audiencia;
- qué evidencia;
- qué objetivos;
- qué territorios;
- qué señales;
- qué reglas;
- qué penalizaciones;
- qué versión del algoritmo;
- qué modelo de IA participó.

Toda decisión estratégica debe ser auditable.

---

# 11. STRATEGIC DECISION ≠ CONTENT FORMAT

Separar obligatoriamente:

## Strategic Disposition

- USE
- WATCH
- DISCARD
- RESEARCH_REQUIRED

de:

## Recommended Output

- NONE
- TOPIC
- SHORT_POST
- ARTICLE
- VIDEO
- OPPORTUNITY
- TASK
- LONG_FORM

Una puntuación alta no determina automáticamente un formato.

Primero se decide si debemos actuar.

Después se decide cómo actuar.

---

# 12. STRATEGIC BRIEF OBLIGATORIO

Todo contenido estratégico debe originarse desde un Strategic Brief o desde un override explícito y auditable.

El Strategic Brief debe contener al menos:

- clientId
- thesisId
- signalIds
- primaryAudience
- geography
- territory
- framework
- whyNow
- strategicAngle
- supportingEvidenceIds
- riskFlags
- recommendedChannel
- recommendedFormat
- CTA
- status
- createdBy
- approvedBy
- version

Flujo:

Signal
→ Decision
→ Strategic Brief
→ Content

No permitir normalmente:

Signal
→ Content

---

# 13. TAXONOMÍAS INDEPENDIENTES

No mezclar:

## Audience

Personas o grupos humanos.

Ejemplos:

- General Counsel
- IP Counsel
- CTO
- CEO

## Geography

Mercados geográficos.

Ejemplos:

- United States
- Mexico
- LATAM
- Global

## Territory

Territorios de conocimiento.

Ejemplos:

- Patent Strategy
- AI Governance
- Freedom-to-Operate

## Framework

Metodologías.

Ejemplo:

- People + Tools + Rules

## Standard

Estándares o marcos técnicos.

Ejemplos:

- NIST AI RMF
- ISO/IEC 42001

## Business Context

Situaciones empresariales.

Ejemplos:

- fundraising
- market entry
- M&A
- product launch

No convertir automáticamente texto separado por comas o paréntesis en entidades de dominio.

---

# 14. DATA PROVENANCE

Todo dato estratégico debe conocer su procedencia.

Estados mínimos:

- DECLARED
- INFERRED
- APPROVED
- REJECTED

Valores iniciales de confianza:

DECLARED = 1.00

APPROVED = 1.00

INFERRED = 0.40

REJECTED = 0

Un valor INFERRED debe mostrarse visualmente como propuesta de IA.

Debe poder:

- aprobarse;
- editarse;
- rechazarse.

No tratar una inferencia como una decisión estratégica aprobada.

---

# 15. AUTHORITY MODEL

No utilizar un único Authority Score para representar conceptos diferentes.

Separar:

## Evidence Authority

Fuerza de las credenciales.

## Thesis Coverage

Porcentaje de la tesis respaldado.

## Public Visibility

Cuánto de esa autoridad está públicamente visible.

## Thesis Readiness

Nivel de preparación general de la tesis.

## Positioning Gap

Diferencia entre percepción actual y percepción objetivo.

---

# 16. OPPORTUNITY INTELLIGENCE

Cada Signal debe ser evaluada contra las Thesis ACTIVE.

Factores iniciales:

- Thesis Fit
- Audience Fit
- Objective Fit
- Evidence Fit
- Why Now
- Differentiation
- Geography Fit

Y de forma independiente:

- Risk Penalty

Los pesos deben ser configurables y versionados.

No utilizar números mágicos enterrados en componentes de interfaz.

---

# 17. RISK & PROFESSIONAL SAFETY

Separar:

## Hard Limits

Pueden bloquear una recomendación o publicación.

## Soft Limits

Penalizan el score pero no bloquean necesariamente.

El Risk Engine debe considerar:

- professional rules;
- confidentiality;
- unsupported claims;
- evidence strength;
- client restrictions;
- regulatory statements;
- reputational exposure;
- political sensitivity;
- source reliability.

Resultado mínimo:

- PASS
- REVIEW_REQUIRED
- BLOCK

---

# 18. SIGNAL LIFECYCLE

Las Signals deben tener lifecycle auditable.

Estados recomendados:

- INGESTED
- NORMALIZED
- ANALYZED
- ROUTED
- SCORED
- USE
- WATCH
- DISCARD
- RESEARCH_REQUIRED
- BRIEF_CREATED
- CONTENT_CREATED
- PUBLISHED
- MEASURED

No sobrescribir silenciosamente el historial.

---

# 19. LEARNING LOOP

POSTURA debe aprender de:

- contenido aprobado;
- contenido modificado;
- contenido rechazado;
- oportunidades aceptadas;
- oportunidades rechazadas;
- audiencia alcanzada;
- authority signals;
- business signals;
- rendimiento.

La IA puede recomendar modificaciones estratégicas.

No debe modificar automáticamente:

- Thesis;
- weights;
- Voice Profile;
- audiences;
- objectives;

sin aprobación humana.

---

# 20. SEGURIDAD

Toda modificación debe respetar:

## Tenant Isolation

Toda información debe estar aislada por:

organizationId

y cuando corresponda:

clientId.

## Least Privilege

No otorgar acceso simplemente por tener rol ADMIN si la organización no coincide.

## Field-Level Security

Los usuarios solamente pueden modificar los campos permitidos.

## Secrets

Nunca almacenar:

- service account credentials;
- private keys;
- production secrets;
- API keys;

dentro del repositorio.

Utilizar Secret Manager o sistema equivalente.

Si se detecta un secreto existente:

detener el trabajo relevante y reportarlo.

---

# 21. AI OUTPUT VALIDATION

Ningún JSON producido por un LLM entra directamente al dominio solamente mediante:

```typescript
JSON.parse()
```

Los outputs deben utilizar validación runtime.

Tecnología objetivo:

Zod o JSON Schema.

Flujo:

LLM
→ Structured Output
→ Runtime Validation
→ Domain Mapping

Si la validación falla:

- retry/repair controlado;
- error;
- audit log.

---

# 22. AI GATEWAY

Centralizar las llamadas de IA.

No dispersar providers y modelos por toda la aplicación.

Arquitectura objetivo:

Application
→ AI Gateway
→ Model Registry
→ Provider Adapter

Cada AI Run debe registrar:

- agent
- provider
- model
- promptVersion
- specVersion
- latency
- inputTokens
- outputTokens
- estimatedCost
- schemaValidation
- status
- error

Los nombres de modelos no deben quedar hardcoded en componentes de UI.

---

# 22A. HEXAGONAL BOUNDARIES

POSTURA adopta arquitectura hexagonal de forma incremental.

El dominio y la capa de aplicación **no deben depender** directamente de:

- Firebase / Firestore / Firebase Admin;
- SDKs de proveedores de IA (OpenAI, Anthropic, etc.);
- transporte HTTP concreto;
- frameworks de UI;
- infraestructura específica del entorno.

Las capacidades externas se acceden mediante **ports** explícitos.

La infraestructura implementa esos ports mediante **adapters**.

**Las dependencias apuntan hacia adentro.**

SPEC-005 (`src/domain/ai`, `src/application/ai`) es el primer módulo completamente alineado.

---

# 22B. DOMAIN PURITY

La capa Domain (`src/domain/**`) debe permanecer libre de:

- imports de Firebase o Firebase Admin;
- SDKs de proveedores de IA;
- frameworks de transporte o UI;
- infraestructura específica del entorno;
- Zod u otros validadores de runtime cuando representen transporte AI, no invariantes intrínsecos.

La validación de salidas AI estructuradas pertenece a Application (`src/application/**`).

Solo Application puede producir salida **confiable** (`ValidatedDomainOutput`) tras validación.

La salida cruda del proveedor es **no confiable** hasta pasar por Application.

---

# 23. TECNOLOGÍA OBJETIVO

La migración debe ser INCREMENTAL.

No realizar un rewrite completo.

## Frontend objetivo

- React
- TypeScript
- Vite
- TanStack Query
- React Hook Form
- Zod

## Backend

Mantener inicialmente:

- Firebase Authentication
- Firestore
- Firebase Storage
- Cloud Functions 2nd Gen
- Cloud Scheduler

Añadir cuando corresponda:

- Cloud Tasks
- Cloud Run Jobs
- Secret Manager

## Runtime

Estandarizar:

Node.js 22

para:

- desarrollo;
- CI;
- funciones;

siempre que la dependencia concreta sea compatible.

## Testing

- Vitest
- Firebase Emulator Suite
- Playwright

## Observability

- Cloud Logging
- Cloud Monitoring
- OpenTelemetry
- Sentry

## CI/CD

- GitHub Actions

## Security

- dependency scanning
- secret scanning
- Gitleaks o equivalente

---

# 24. REGLA DE MIGRACIÓN FRONTEND

No convertir toda la aplicación a React en un único cambio.

Migración incremental.

Orden recomendado:

1. Crear shell React compatible con servicios actuales.
2. Extraer componentes nuevos a React.
3. Mantener temporalmente servicios de dominio existentes.
4. Migrar página por página.
5. Extraer lógica de UI de servicios de dominio.
6. Mantener tests de regresión.
7. Eliminar legacy únicamente después de comprobar equivalencia.

Durante la migración:

Business Logic no debe ser reescrita únicamente para adaptar UI.

Primero preservar comportamiento.

Después mejorar arquitectura.

---

# 25. PROHIBICIÓN DE BIG-BANG REWRITE

Está prohibido:

> "Recrear AURORA completa con la nueva tecnología."

Cualquier propuesta de rewrite global debe ser rechazada salvo aprobación explícita.

La estrategia oficial es:

**Strangler / Incremental Migration.**

---

# 26. SPEC-DRIVEN DEVELOPMENT

Toda nueva feature importante debe tener una Specification antes de implementarse.

Estructura recomendada:

```text
specs/
  001-strategic-signal-routing/
  002-strategic-scoring-v2/
  003-strategic-brief/
  004-strategic-planner/
  005-ai-gateway/
  006-evidence-claim-linking/
  007-opportunity-scout/
  008-learning-loop/
  009-security-hardening/
  010-react-migration/
```

Una Specification debe contener:

- Problem
- Goal
- Non-Goals
- Actors
- Preconditions
- Functional Requirements
- Business Rules
- Data Model
- State Transitions
- Error Cases
- Security Requirements
- Observability Requirements
- Acceptance Criteria
- Tests
- Migration Impact

---

# 27. REQUIREMENT TRACEABILITY

Cada requerimiento debe poder rastrearse.

Ejemplo:

```text
Requirement:
ROUTING-004

Technical Design:
ThesisRoutingService

Task:
TASK-018

Implementation:
src/domain/thesisRoutingCore.ts

Test:
thesisRouting.spec.ts

Status:
PASS
```

Cursor debe incluir los identificadores de requisitos relevantes cuando implemente cambios.

---

# 28. DEFINITION OF DONE

Una funcionalidad no se considera terminada porque:

- compila;
- la pantalla aparece;
- Cursor dice "implemented".

Debe cumplir:

- Specification approved
- Requirements implemented
- Typecheck passes
- Build passes
- Unit tests pass
- Integration tests pass
- Acceptance criteria pass
- Security requirements pass
- No secret detected
- Documentation synchronized
- No unintended regression
- Human review completed

---

# 29. SOURCE OF TRUTH HIERARCHY

Orden de autoridad:

1. Project Constitution
2. Approved Product Specifications
3. Approved Technical Design
4. Acceptance Criteria
5. Current Domain Model
6. Existing implementation
7. Ad-hoc prompts

Si un prompt contradice una especificación aprobada:

Cursor debe informar el conflicto antes de implementar.

---

# 30. REGLAS PARA CURSOR

Antes de modificar código:

1. Inspeccionar el repositorio.
2. Identificar la arquitectura existente.
3. Identificar funcionalidades que ya cumplen la Specification.
4. Identificar conflictos.
5. Presentar el plan.
6. No duplicar servicios existentes.
7. No introducir una segunda arquitectura paralela.
8. No realizar refactors no relacionados.
9. No cambiar tecnología de forma masiva.
10. No eliminar datos históricos.
11. Mantener backward compatibility cuando sea razonable.
12. Añadir tests antes de declarar terminado.

Cuando una Specification requiera un comportamiento incompatible con la implementación existente:

reportar:

```text
SPEC / IMPLEMENTATION CONFLICT
```

y explicar:

- spec;
- comportamiento actual;
- archivos afectados;
- riesgo;
- estrategia propuesta.

---

# 31. PRIMERA FASE DESPUÉS DE ESTA CONSTITUCIÓN

NO IMPLEMENTAR todavía nuevas funcionalidades.

La primera tarea después de adoptar esta constitución será realizar:

**Baseline Architecture & Compliance Audit**

El objetivo será determinar:

- qué principios ya cumple AURORA;
- cuáles viola;
- qué deuda técnica existe;
- qué specs necesitamos;
- qué migración tecnológica es segura.

La auditoría debe preceder cualquier migración mayor.

---

# 32. RESULTADO ESPERADO

POSTURA/AURORA debe evolucionar hacia este circuito:

```text
CLIENT PROFILE
      ↓
POSITIONING THESES
      ↓
WORLD SIGNALS
      ↓
THESIS ROUTING
      ↓
OPPORTUNITY INTELLIGENCE
      ↓
STRATEGIC DECISION
      ↓
STRATEGIC BRIEF
      ↓
PLANNER
      ↓
CONTENT
      ↓
HUMAN APPROVAL
      ↓
PUBLICATION / OPPORTUNITY EXECUTION
      ↓
RESULTS
      ↓
LEARNING
      ↓
STRATEGIC RECOMMENDATION
```

Este circuito constituye el núcleo de POSTURA.

Toda nueva funcionalidad debe poder explicar dónde participa dentro de este flujo.