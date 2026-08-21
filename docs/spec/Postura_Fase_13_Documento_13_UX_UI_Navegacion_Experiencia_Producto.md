# POSTURA — FASE 13
## Documento 13 de 16 — UX/UI, Navegación y Sistema de Experiencia del Producto

**Código:** POSTURA-F13-D13  
**Versión:** 1.0  
**Estado:** Especificación UX/UI para implementación  
**Tipo de documento:** Arquitectura de experiencia, navegación, vistas, componentes y reglas de interacción  
**Proyecto:** Postura — Positioning Intelligence & Management System  
**Formato:** Markdown  
**Ámbito:** MVP web-first + Electron, Manager Cockpit + Client Portal  
**Fecha de referencia:** 18 de agosto de 2026

---

# 1. Propósito del documento

Este documento define cómo debe verse, organizarse y comportarse Postura en el MVP.

Su función es convertir la arquitectura funcional, técnica, de datos, IA, seguridad y scoring en una experiencia de producto coherente.

Debe responder:

> ¿Qué ve cada usuario, en qué orden, qué puede hacer, qué información necesita en cada momento y cómo evitamos que Postura se convierta en una interfaz saturada de datos e IA?

---

# 2. Principio rector de experiencia

Postura no debe sentirse como:

```text
panel técnico
+
chat con IA
+
feed de noticias
```

Debe sentirse como:

```text
MANAGER DIGITAL DE POSICIONAMIENTO
```

Por tanto, la interfaz deberá priorizar:

```text
DECISIONES
ACCIONES
PRIORIDAD
CONTEXTO
CONTROL
```

sobre:

```text
DATOS CRUDOS
CONFIGURACIÓN TÉCNICA
VOLUMEN DE INFORMACIÓN
```

---

# 3. Dos experiencias, un mismo sistema

Postura tendrá dos superficies principales:

```text
MANAGER COCKPIT
CLIENT PORTAL
```

---

# 4. Manager Cockpit

Pensado para:

- revisar Clientes;
- analizar Signals;
- priorizar;
- construir Tesis;
- crear Oportunidades;
- generar Contenido;
- asignar Tareas;
- revisar Resultados;
- controlar IA;
- gestionar Sources.

Debe ser:

```text
denso pero claro
```

---

# 5. Client Portal

Pensado para:

- completar Perfil;
- revisar Tesis;
- aprobar Contenido;
- ejecutar Tareas;
- revisar Oportunidades;
- entregar materiales;
- consultar Resultados.

Debe ser:

```text
simple
directo
orientado a acción
```

---

# 6. Regla UX principal

El Cliente no debe ver el mismo nivel de complejidad que el Manager.

---

# 7. Arquitectura de navegación — Manager

```text
Dashboard
│
├── Intelligence Inbox
│
├── Clients
│   └── Client Workspace
│       ├── Overview
│       ├── Profile
│       ├── Thesis
│       ├── Campaigns
│       ├── Sources
│       ├── Signals
│       ├── Topics
│       ├── Opportunities
│       ├── Content
│       ├── Tasks
│       ├── Results
│       └── Library
│
├── Sources
├── AI Control Center
├── Library
├── Audit
└── Settings
```

---

# 8. Arquitectura de navegación — Cliente

```text
Home
│
├── My Tasks
├── Content
├── Opportunities
├── My Profile
├── My Positioning
├── Results
└── Library
```

---

# 9. Layout Manager

Recomendado:

```text
┌──────────────────────────────────────────────┐
│ Top Bar                                      │
├──────────────┬───────────────────────────────┤
│ Sidebar      │ Main Content                  │
│              │                               │
│              │                               │
└──────────────┴───────────────────────────────┘
```

---

# 10. Sidebar Manager

Debe contener:

```text
Logo / Postura
Dashboard
Intelligence
Clients
Sources
Library
AI
Audit
Settings
```

---

# 11. Top Bar Manager

Debe contener:

```text
Active Client selector
Search
Notifications
AI status
User menu
```

---

# 12. Client Switcher

Elemento central.

Debe permitir:

```text
All Clients
Client A
Client B
Client C
```

---

# 13. Regla de contexto

Cuando existe un Cliente activo:

todas las vistas deben mostrar claramente:

```text
Working with: [Client Name]
```

para reducir errores operativos.

---

# 14. Context Color / Indicator

Se puede utilizar un indicador sutil, no depender solo del color.

Ejemplo:

```text
Client: Juan Vasquez
Campaign: AI Governance
```

---

# 15. No silent context change

Cambiar de Cliente debe ser explícito.

---

# 16. Dashboard Manager

Debe responder:

```text
¿Qué requiere mi atención hoy?
```

No:

```text
¿Cuántos registros existen?
```

---

# 17. Dashboard Manager — bloques

Recomendados:

```text
Needs Attention
High Priority Signals
Pending Client Approvals
Active Opportunities
Tasks Overdue
AI / Source Errors
Recent Results
```

---

# 18. Dashboard Manager — KPI cards

Máximo recomendado:

```text
4–6 cards principales
```

Ejemplos:

```text
High Priority Signals
Pending Reviews
Open Opportunities
Tasks Due
```

---

# 19. No dashboard overloaded

Evitar 20 métricas pequeñas.

---

# 20. Needs Attention

Debe ser el bloque principal.

Orden:

```text
urgent deadline
client approval
critical/high signal
system issue
task overdue
```

---

# 21. Intelligence Inbox

Será una de las vistas centrales.

Objetivo:

```text
convertir Signals en decisiones
```

---

# 22. Layout Intelligence Inbox

```text
Filters
↓
Priority summary
↓
Signal list/cards
↓
Detail drawer/panel
```

---

# 23. Filters

```text
Client
Thesis
Campaign
Priority
Risk
Type
Source
AI Status
Date
Decision
```

---

# 24. Quick Filters

```text
Very High
High
Pending AI
Research Required
Urgent
Unreviewed
```

---

# 25. Signal Card

Debe mostrar como mínimo:

```text
Title
Source
Date
Type
Strategic Score
Priority
Risk
Thesis
Why it matters
Recommended action
```

---

# 26. Signal Card — hierarchy

Visual priority:

```text
1. Title
2. Priority / Score
3. Why it matters
4. Recommended action
5. Source metadata
```

---

# 27. Signal Card example

```text
────────────────────────────────────────
[VERY HIGH]  89/100     Risk: Medium

EU releases new enterprise AI governance guidance

Why it matters
Directly affects legal and executive teams
implementing AI governance programs.

Recommended
Create strategic article

Thesis
AI Governance

Source
Official regulator · Aug 18
────────────────────────────────────────
```

---

# 28. Signal actions

Quick actions:

```text
Analyze
Save
Research
Discard
Create Topic
Create Opportunity
Generate Content
```

---

# 29. Destructive hierarchy

`Discard` no debe ser el botón visual principal.

---

# 30. Signal Detail

Al abrir:

```text
Source
Original URL
Summary
Facts
Strategic Score
Factor breakdown
Evidence Gap
Risk
Recommended Action
Related Signals
Analysis history
Manager Decision
```

---

# 31. Score visualization

No usar un velocímetro decorativo.

Preferir:

```text
Score 88
Very High
```

más breakdown.

---

# 32. Factor breakdown

Ejemplo:

```text
Thesis Match         94
Audience Match       90
Timeliness           85
Authority Fit        72
Differentiation      83
Strategic Potential  90
Commercial Potential 60
Source Quality       100
```

---

# 33. Explainability

Cada factor podrá desplegar:

```text
Why
Evidence
Constraint
```

---

# 34. Risk separate from priority

Nunca combinar visualmente:

```text
High priority
```

con:

```text
High risk
```

como si fueran lo mismo.

---

# 35. Suggested visual labels

```text
Priority: Very High
Risk: Medium
Confidence: High
```

---

# 36. PENDING_AI state

Debe mostrarse claramente:

```text
Awaiting AI analysis
```

Acciones:

```text
Analyze now
Review manually
Discard
```

---

# 37. RESEARCH_REQUIRED state

Mostrar:

```text
Promising signal, insufficient evidence
```

---

# 38. NO_ACTION state

No ocultar.

Mostrar:

```text
Recommended: No action
Reason: Low differentiation and recent similar content.
```

---

# 39. Multi-select Signals

Manager puede seleccionar varias Signals.

Acciones:

```text
Create Topic
Analyze
Save
Discard
```

---

# 40. Topic creation UX

Al crear Topic desde varias Signals:

mostrar:

```text
Selected Sources
Common theme
Strategic question
Suggested angle
Thesis
```

---

# 41. Topics View

Cada Topic debe mostrar:

```text
Title
Strategic question
Related Signals
Thesis
Status
Opportunity count
Content count
```

---

# 42. Topic Detail

Debe funcionar como workspace.

```text
Overview
Signals
Analysis
Opportunities
Content
Notes
```

---

# 43. Clients View

Lista de Clientes.

Mostrar:

```text
Name
Profession
Company
Profile completeness
Active thesis
Pending tasks
High priority signals
Status
```

---

# 44. Client card/list action

```text
Open Workspace
```

---

# 45. Client Workspace

Header:

```text
Client Name
Profession
Company
Status
Profile completeness
Primary Thesis
```

---

# 46. Client Workspace tabs

```text
Overview
Profile
Thesis
Campaigns
Sources
Intelligence
Opportunities
Content
Tasks
Results
Library
```

---

# 47. Client Overview

Debe responder:

```text
¿Dónde estamos?
¿Qué falta?
¿Qué está funcionando?
¿Qué necesita atención?
```

---

# 48. Client Overview blocks

```text
Positioning Summary
Active Thesis
Profile Readiness
Current Campaigns
Top Signals
Pending Opportunities
Pending Client Actions
Recent Results
```

---

# 49. Profile View

Secciones:

```text
Identity
Career
Education
Expertise
Evidence
Services
Audience
Markets
Goals
Voice
Boundaries
Digital Presence
```

---

# 50. Profile completeness

Mostrar:

```text
72%
Strategy Readiness: READY
```

---

# 51. Missing profile actions

Ejemplo:

```text
Add certification evidence
Confirm secondary audience
Review voice profile
```

---

# 52. Profile Review Queue

Debe separar:

```text
Pending
Conflicts
Confirmed
Rejected
```

---

# 53. Review Item

Mostrar:

```text
Proposed field
Proposed value
Source
Confidence
Evidence
```

Acciones:

```text
Confirm
Edit
Reject
```

---

# 54. Evidence Vault UI

Lista/filter:

```text
Type
Title
Status
Source
Evidence strength
Public/Private/Internal
```

---

# 55. Evidence detail

Debe mostrar:

```text
Claim supported
Source
Document/link
Validation status
Usage restrictions
```

---

# 56. Thesis View

Debe mostrar:

```text
Positioning Statement
Expert Identity
Primary Audience
Domain
Objective
Differentiators
Evidence
Evidence Gaps
Boundaries
Markets
Status
Approval
```

---

# 57. Thesis Status banner

Ejemplo:

```text
ACTIVE
Last reviewed: ...
```

---

# 58. Thesis actions

```text
Edit
Challenge Thesis
Request Client Review
Activate
Pause
Archive
```

según estado.

---

# 59. Thesis Builder

Wizard:

```text
1 Identity
2 Audience
3 Domain
4 Objective
5 Evidence
6 Differentiation
7 Boundaries
```

---

# 60. Thesis AI assistance

Botones:

```text
Generate Proposal
Refine
Challenge
```

No:

```text
Auto Activate
```

---

# 61. Client Thesis Review

Simplified screen:

```text
How we plan to position you
Who should recognize you
What topics
Why
What we will avoid
```

Acciones:

```text
Approve
Request Changes
```

---

# 62. Campaigns View

Mostrar:

```text
Name
Thesis
Status
Dates
Themes
Signals
Opportunities
Content
Results
```

---

# 63. Campaign detail

```text
Overview
Themes
Sources
Signals
Opportunities
Content
Tasks
Results
```

---

# 64. Sources View

Manager-only.

---

# 65. Sources table

Mostrar:

```text
Name
Type
Scope
Client/Campaign
Trust
Frequency
Status
Last Success
Last Error
Signals Created
```

---

# 66. Source actions

```text
Test
Run now
Pause
Edit
Archive
```

---

# 67. Add Source flow

```text
Type
URL
Name
Scope
Client/Campaign
Frequency
Trust
Visibility
Test
Activate
```

---

# 68. Source health

Badges:

```text
Healthy
Warning
Error
Paused
```

---

# 69. Source Test result

Mostrar:

```text
Connection
Items found
Latest date
Warnings
```

---

# 70. Opportunities View

Debe priorizar:

```text
deadline
fit
client decision
status
```

---

# 71. Opportunity Card

```text
Type
Title
Why it fits
Deadline
Thesis
Risk
Status
```

---

# 72. Opportunity actions Manager

```text
Recommend to Client
Create Task
Create Content
Research
Archive
```

---

# 73. Opportunity actions Client

```text
Accept
Decline
Ask Question
```

---

# 74. Content View

Debe ser workflow-oriented.

Filters:

```text
Draft
Manager Review
Client Review
Approved
Ready
Published
Archived
```

---

# 75. Content Card

```text
Title
Type
Thesis/Campaign
Status
Created from
Last updated
Approvals
```

---

# 76. Content Editor

Layout recomendado:

```text
Left: content
Right: context/review
```

---

# 77. Content context panel

Mostrar:

```text
Source Signals
Thesis
Audience
Voice
Evidence
Warnings
Risk
```

---

# 78. AI Content actions

```text
Generate
Rewrite section
Shorten
Strengthen argument
Add counterargument
Adapt format
Check evidence
```

---

# 79. No unconstrained magic button

Evitar:

```text
Make better
```

sin contexto.

---

# 80. Content versioning

Mostrar:

```text
Version 3
```

y posibilidad de revisar versiones importantes.

---

# 81. Approval bar

Estado visible:

```text
Manager Approved
Client Pending
```

---

# 82. Client Review mode

Debe reducir complejidad.

Mostrar:

```text
Final draft
Key message
Why this matters
```

Acciones:

```text
Approve
Request Changes
```

---

# 83. Request Changes

Debe permitir:

```text
comment
specific section optional
```

---

# 84. Tasks View

Cliente:

principal superficie operativa.

---

# 85. Task Card

```text
Title
What you need to do
Priority
Due date
Related content/opportunity
Status
```

---

# 86. Client Task CTA

Un único CTA principal.

Ejemplo:

```text
Start
Review
Upload
Approve
Complete
```

---

# 87. Task Detail

Mostrar:

```text
Instructions
Why it matters
Attachments
Related content
Deadline
Comments
Completion
```

---

# 88. Manager Tasks

Puede ver:

```text
All
Overdue
Pending
Completed
```

---

# 89. Results View

Debe evitar vanity dashboard.

---

# 90. Results blocks

```text
Actions completed
Content published
Opportunities accepted
Authority assets
Leads/opportunities
Manual outcomes
```

---

# 91. Result entry

Manager puede registrar:

```text
Type
Channel
Date
URL
Metrics
Qualitative outcome
```

---

# 92. Result detail

Debe mostrar:

```text
Related Thesis
Campaign
Opportunity
Content
Task
Outcome
```

---

# 93. Evidence feedback

CTA:

```text
Add result to Evidence Vault
```

cuando aplique.

---

# 94. Library

No debe convertirse en file explorer genérico.

---

# 95. Library filters

```text
Content
Evidence
Documents
Opportunities
Results
```

---

# 96. AI Control Center

Manager-only.

---

# 97. AI Control Center blocks

```text
Provider Status
Credential Mode
Default Mode
Recent Runs
Usage Estimate
Errors
Feature Flags
```

---

# 98. Provider Card

Ejemplo:

```text
OpenAI
Connected
Temporary session
Expires in 42 min
```

---

# 99. Claude Card

Igual.

---

# 100. Credential actions

```text
Connect
Replace
Save Securely
Revoke
```

---

# 101. Security UX

Nunca mostrar full key.

---

# 102. Temporary key message

```text
This key is temporary and will not be stored permanently.
```

---

# 103. Persistent key message

```text
This key will be stored securely for future use and background analysis.
```

Debe requerir confirmación explícita.

---

# 104. Comparative mode warning

Mostrar:

```text
Uses both providers and may increase cost and response time.
```

---

# 105. AI Run table

```text
Date
Agent
Operation
Provider
Model
Status
Latency
Usage
Estimated Cost
```

---

# 106. No chain-of-thought UI

No mostrar razonamiento interno.

---

# 107. Show concise reasoning

Sí mostrar:

```text
Why
Factors
Evidence
Warnings
```

---

# 108. Audit View

Manager-only.

---

# 109. Audit table

```text
Date
Actor
Event
Entity
Client
Status
Correlation ID
```

---

# 110. No raw secrets in Audit UI

---

# 111. Settings

Secciones:

```text
Organization
Users
AI
Security
Notifications
Display
```

MVP puede limitar según implementación.

---

# 112. Notifications

Manager:

```text
High priority signal
Client approval
Task overdue
Source error
AI error
Onboarding completed
```

---

# 113. Client notifications

```text
Task assigned
Content review
Opportunity
Profile confirmation
```

---

# 114. Notification severity

```text
Info
Action Required
Urgent
System
```

---

# 115. No notification spam

Agrupar eventos repetitivos.

---

# 116. Search

Manager search debe poder localizar:

```text
Clients
Content
Tasks
Opportunities
Topics
```

MVP no requiere full-text global avanzado.

---

# 117. Command Palette future-compatible

No obligatorio.

---

# 118. Empty States

Cada vista vacía debe explicar:

```text
qué es
por qué está vacía
qué hacer
```

---

# 119. Example — no Sources

```text
No sources configured yet.

Add sources to begin collecting Signals
for this Client or Campaign.

[Add Source]
```

---

# 120. Example — no Signals

```text
No signals yet.

You can add information manually
or activate automatic Sources.

[Add Signal] [Manage Sources]
```

---

# 121. Example — no Thesis

```text
This Client does not have an active Positioning Thesis.

Create one before relying on strategic scoring.

[Create Thesis]
```

---

# 122. Loading states

No blank screens.

Use:

```text
skeletons
progress
stage labels
```

---

# 123. AI loading

Ejemplo:

```text
Preparing context
Analyzing
Checking evidence
Finalizing
```

---

# 124. Do not fake exact progress

No usar:

```text
73%
```

si no existe medición real.

---

# 125. Error states

Debe incluir:

```text
What happened
What user can do
Reference ID
```

---

# 126. Example AI error

```text
The AI provider did not complete the analysis.

You can retry or review the Signal manually.

Reference: AI-4F92
```

---

# 127. Offline / degraded mode

Si IA no está disponible:

la UI debe seguir permitiendo:

- Perfil;
- Tesis manual;
- Sources;
- Signals;
- Tasks;
- Content existente;
- Results.

---

# 128. Security error

No revelar detalles técnicos sensibles.

---

# 129. Permission denied

```text
You do not have access to this resource.
```

No:

```text
Client B exists but you cannot access it.
```

---

# 130. Confirmation dialogs

Reservar para acciones con impacto:

```text
Archive Client
Revoke credential
Pause Thesis
Delete persistent key
```

---

# 131. No confirmation fatigue

No confirmar acciones triviales.

---

# 132. Undo

Cuando sea posible:

```text
Archive
Discard
```

puede tener undo temporal o reversible.

---

# 133. Destructive actions

Visualmente diferenciadas.

---

# 134. Design system principles

Postura debe comunicar:

```text
intelligence
clarity
authority
precision
control
```

---

# 135. Visual style

Recomendado:

```text
executive
minimal
light-first
high readability
professional
data-rich but calm
```

---

# 136. Avoid

```text
neon AI aesthetic
excess gradients
futuristic sci-fi dashboards
overuse of purple
too many illustrations
```

---

# 137. Color system

No fijar valores hex definitivos en este documento.

Definir roles:

```text
Primary
Neutral
Success
Warning
Danger
Information
Priority
Risk
```

---

# 138. Priority vs Risk colors

No deben compartir exactamente la misma semántica.

---

# 139. Accessibility

No depender únicamente del color.

Siempre añadir:

```text
label
icon
text
```

---

# 140. Typography

Priorizar:

```text
system sans / professional sans
```

con alta legibilidad.

---

# 141. Type scale

Mínimo:

```text
Display
H1
H2
H3
Body
Small
Caption
```

---

# 142. Density

Manager interface:

```text
medium density
```

Client interface:

```text
low-medium density
```

---

# 143. Spacing

Utilizar sistema consistente.

Ejemplo conceptual:

```text
4 / 8 / 12 / 16 / 24 / 32 / 48
```

---

# 144. Radius

Moderado.

No convertir todo en tarjetas flotantes excesivamente redondeadas.

---

# 145. Shadows

Sutiles.

Jerarquía mediante spacing/borders antes que sombras fuertes.

---

# 146. Icons

Consistentes y simples.

No depender de icono sin label en acciones críticas.

---

# 147. Buttons

Tipos:

```text
Primary
Secondary
Tertiary
Danger
Icon
```

---

# 148. One primary CTA per context

Important.

---

# 149. Form controls

Consistentes:

```text
Input
Textarea
Select
Multi-select
Date
Toggle
Checkbox
Upload
```

---

# 150. Form validation

Inline, clara.

---

# 151. Save behavior

Para formularios largos:

```text
autosave
```

o guardado por sección.

---

# 152. Success feedback

No mostrar modal por cada guardado.

Usar:

```text
Saved
```

sutil.

---

# 153. Tables

Usar para:

- Sources;
- Audit;
- AI Runs;
- Clients si muchos.

---

# 154. Cards

Usar para:

- Signals;
- Opportunities;
- Tasks;
- Content;
- Results summaries.

---

# 155. Drawers

Útiles para detalle rápido sin perder contexto.

---

# 156. Modals

Solo para tareas cortas.

No construir workflows complejos dentro de modal.

---

# 157. Responsive strategy

Prioridad:

```text
Desktop
Tablet
Mobile responsive
```

No app móvil nativa.

---

# 158. Manager Mobile

Debe ser utilizable para:

- revisar;
- aprobar;
- ver alertas.

No necesita ofrecer la misma eficiencia de gestión masiva.

---

# 159. Client Mobile

Debe funcionar muy bien.

Porque tareas y aprobaciones probablemente ocurran desde móvil.

---

# 160. Breakpoint philosophy

No fijar valores arbitrarios aquí.

Implementar:

```text
mobile
tablet
desktop
wide
```

---

# 161. Sidebar responsive

Desktop:

```text
fixed
```

Tablet:

```text
collapsible
```

Mobile:

```text
drawer
```

---

# 162. Tables mobile

Convertir a:

```text
cards
```

o scroll horizontal controlado.

---

# 163. Signal cards mobile

Mantener:

```text
Priority
Title
Why
Action
```

ocultar metadata secundaria tras expandir.

---

# 164. Accessibility baseline

Objetivo:

```text
WCAG 2.2 AA-oriented implementation
```

sin afirmar certificación automática.

---

# 165. Keyboard navigation

Manager interface debe soportar:

- Tab;
- Enter;
- Escape;
- focus visible.

---

# 166. Focus management

Modals/drawers deben devolver foco correctamente.

---

# 167. Labels

Inputs tienen labels reales.

No placeholder-only.

---

# 168. Contrast

Verificar con tooling.

---

# 169. Motion

Respetar:

```text
prefers-reduced-motion
```

---

# 170. Screen readers

Estados importantes deben estar accesibles.

---

# 171. ARIA

Usar solo cuando HTML semántico no sea suficiente.

---

# 172. Status text

No comunicar solo con iconos.

---

# 173. Electron UX

Debe verse prácticamente igual que Web.

---

# 174. Electron differences

Puede añadir:

```text
desktop title bar integration
native file picker
version info
desktop notifications future
```

sin cambiar lógica funcional.

---

# 175. Electron window

Tamaño mínimo razonable.

No diseñar solo para pantalla grande.

---

# 176. Electron offline message

Si Firebase no está disponible:

mostrar estado claro.

---

# 177. Electron no separate navigation

Same routes and modules.

---

# 178. URL / Deep link

Web puede soportar rutas directas.

Electron puede mapear internamente.

---

# 179. Role-based navigation

Manager no debe ver Client-only navigation redundante.

Client no debe ver:

- Sources;
- AI Control;
- Audit;
- raw Intelligence.

---

# 180. Permission-aware UI

Ocultar acciones no disponibles.

Pero backend sigue siendo autoridad.

---

# 181. Disabled vs hidden

Si el usuario podría necesitar entender la feature:

disabled + explanation.

Si nunca tiene permiso:

hidden.

---

# 182. Onboarding UX

6-step flow as defined.

---

# 183. Onboarding header

```text
Step X of 6
Save & continue later
```

---

# 184. Onboarding step 1

Identity.

---

# 185. Step 2

Goal.

---

# 186. Step 3

Audience/Market.

---

# 187. Step 4

Experience/Evidence.

---

# 188. Step 5

Digital presence.

---

# 189. Step 6

Voice/Boundaries.

---

# 190. Upload CV

Must be optional.

---

# 191. AI enrichment state

```text
Analyzing your document...
You can continue.
```

---

# 192. Review after onboarding

Show:

```text
We found 12 profile details for review.
```

---

# 193. Client Portal Home

Pregunta central:

```text
¿Qué necesito hacer?
```

---

# 194. Client Home blocks

```text
My Next Actions
Content to Review
Opportunities
Profile Items to Confirm
Recent Results
```

---

# 195. No raw analytics overload Client

---

# 196. Client Task-first design

The most important card is:

```text
Next action
```

---

# 197. Client Content review

Should be easy on mobile.

---

# 198. Client Opportunity review

Must explain:

```text
Why this matters for you
Deadline
What we need from you
```

---

# 199. Client Profile

Editable categories.

---

# 200. Client Positioning

Simplified Thesis.

---

# 201. Client Results

Show progress without inflated claims.

---

# 202. Notifications center

Bell icon + dedicated page optional.

---

# 203. Notification grouping

Example:

```text
3 tasks need attention
```

---

# 204. Toasts

For transient confirmations/errors.

---

# 205. No critical info only in toast

Important messages remain accessible.

---

# 206. Global Search

MVP optional but recommended for Manager.

---

# 207. Breadcrumbs

Use within Client Workspace.

Example:

```text
Clients > Juan > Thesis
```

---

# 208. Page titles

Clear.

No generic:

```text
Overview
```

without context.

---

# 209. Context header example

```text
Juan Vasquez
AI Governance
Intelligence Inbox
```

---

# 210. AI labels

Do not over-brand every feature with “AI”.

Example:

Use:

```text
Strategic Analysis
```

not:

```text
AI Strategic Analysis Powered by AI
```

---

# 211. Trust UX

Show AI only where relevant:

```text
Generated by Claude
Analyzed with OpenAI
Comparative analysis
```

in detail/audit areas.

---

# 212. AI disclosure

Client can see content was AI-assisted if product policy decides.

MVP internal management can record it.

---

# 213. Human control UX

Every public content screen should show approval state prominently.

---

# 214. Approval timeline

Example:

```text
Draft
Manager Approved
Client Approved
Ready
```

---

# 215. State machines in UI

Never allow invalid transitions through UI.

---

# 216. Content transition example

Cannot jump:

```text
AI_GENERATED → READY
```

if Manager/Client approval required.

---

# 217. Task transition example

Cannot complete another Client's Task.

Backend enforced.

---

# 218. Thesis activation

Button only when readiness and approval requirements are satisfied.

---

# 219. Preconditions UX

If blocked:

```text
Cannot activate yet:
- Client approval pending
- Evidence gap review pending
```

---

# 220. Source activation

If test fails:

allow save as paused/draft-like state, but warn before active.

---

# 221. Credential UX

Before persistent save:

show:

```text
This allows background AI analysis while you are offline.
```

---

# 222. Privacy labels

For Evidence:

```text
Public
Private
Internal
```

---

# 223. Private source label

Visible in Signal Detail.

---

# 224. Content source warnings

If Source private:

```text
Do not cite publicly without authorization.
```

---

# 225. Error recovery UX

Always try to provide:

```text
Retry
Edit
Review manually
Go back
```

appropriate options.

---

# 226. AI failure should not delete draft

---

# 227. Autosave failure

Show persistent warning.

---

# 228. Connectivity

If offline/unstable:

prevent false “saved” confirmation.

---

# 229. Optimistic UI

Use carefully.

Not for:

- approvals;
- credential deletion;
- role changes.

---

# 230. Loading buttons

Disable repeated submit while processing.

---

# 231. Idempotent actions

UI can attach operation ID for critical calls.

---

# 232. Command consistency

Use consistent verbs:

```text
Create
Generate
Analyze
Review
Approve
Archive
Pause
Save
```

---

# 233. Avoid synonym chaos

Do not alternate:

```text
Delete / Remove / Erase / Dismiss
```

for same behavior.

---

# 234. Language

Initial UI:

```text
Spanish
```

Code remains English.

---

# 235. Localization

All visible strings should be centralizable.

---

# 236. Date display

Localized.

Store UTC.

---

# 237. Relative dates

Can show:

```text
2 hours ago
```

with absolute date accessible.

---

# 238. Data tables timezone

Use user timezone.

---

# 239. Design tokens

Recommend:

```text
colors
spacing
radius
shadow
typography
z-index
breakpoints
motion
```

centralized.

---

# 240. CSS architecture

For Vanilla TS MVP:

```text
styles/
├── tokens.css
├── reset.css
├── base.css
├── layout.css
├── components/
└── utilities.css
```

---

# 241. Component architecture

Reusable UI primitives:

```text
Button
Input
Select
Badge
Card
Table
Drawer
Modal
Tabs
Toast
EmptyState
Skeleton
Progress
Avatar
Dropdown
Tooltip
```

---

# 242. Domain components

```text
SignalCard
ScoreBreakdown
ClientCard
ThesisCard
OpportunityCard
ContentCard
TaskCard
EvidenceItem
SourceHealth
AiProviderCard
ApprovalTimeline
```

---

# 243. No mega-components

Avoid one 2,000-line component per screen.

---

# 244. View composition

Each page composes reusable modules.

---

# 245. State handling

Every async component must handle:

```text
loading
success
empty
error
unauthorized
```

when applicable.

---

# 246. Skeleton vs spinner

Use skeleton for page/list.

Spinner for button/action.

---

# 247. Tooltips

Use for secondary explanation.

Not essential information.

---

# 248. Help text

Complex concepts like:

```text
Evidence Gap
Strategic Score
AI Session
```

need concise help.

---

# 249. Glossary access

Optional:

```text
? What does this mean?
```

---

# 250. First-run Manager

Show guided empty dashboard.

Not a full product tour overlay.

---

# 251. Progressive disclosure

Advanced controls hidden until needed.

---

# 252. AI advanced settings

Not on main workflow.

---

# 253. Scoring config

Not exposed to ordinary Manager in MVP unless technical admin role added later.

---

# 254. Client metrics

Only meaningful outcomes.

---

# 255. Confirmation copy style

Direct.

Example:

```text
Archive this Source?
It will stop automatic ingestion. Existing Signals will remain.
```

---

# 256. Security copy

Clear, not alarming.

---

# 257. Accessibility of AI status

Use text.

---

# 258. Keyboard shortcuts future

Optional.

---

# 259. Drag-and-drop

Can be used for upload.

Always provide file picker alternative.

---

# 260. File upload state

```text
Uploading
Processing
Ready for Review
Failed
```

---

# 261. File upload errors

Specify:

```text
unsupported type
too large
processing failed
```

---

# 262. Notifications priority

Do not use red for ordinary reminders.

---

# 263. Audit visualization

Technical but readable.

---

# 264. Manager Daily Workflow

Ideal flow:

```text
Login
↓
Needs Attention
↓
Review High Priority Signals
↓
Convert selected Signals
↓
Review pending Content/Opportunities
↓
Assign/confirm Client actions
↓
Check Results
```

---

# 265. Client Daily Workflow

Ideal:

```text
Login
↓
See next actions
↓
Review/complete
↓
Upload/respond
↓
Done
```

---

# 266. Time-to-action KPI

UX should minimize:

```text
clicks from Signal → decision
```

---

# 267. Recommended Signal workflow

From Inbox:

```text
Open Signal
↓
Read Why
↓
Review score
↓
Choose action
```

No need to navigate five pages.

---

# 268. Recommended Content workflow

```text
Opportunity
↓
Generate
↓
Manager review
↓
Client review
↓
Ready
```

---

# 269. Recommended Client workflow

Task links directly to required content/action.

---

# 270. Avoid dead ends

Every detail page should offer next logical action.

---

# 271. Breadcrumb + context

Important for Manager.

---

# 272. URL state

Filters can be reflected in URL where practical.

---

# 273. Deep-linking

Manager should be able to open a Signal/Content from notification.

---

# 274. Security deep-link

Backend still validates permissions.

---

# 275. Global banners

For:

```text
AI unavailable
System maintenance
Security issue
```

---

# 276. Avoid banner overload

---

# 277. AI Connection banner

If no provider:

```text
AI analysis unavailable.
You can continue working manually.
[Connect AI]
```

---

# 278. Persistent AI warning

If background analysis disabled:

```text
Automatic ingestion is active.
AI analysis will wait until an AI session is available.
```

---

# 279. Source errors

Show in Manager Dashboard if meaningful.

---

# 280. Empty result states

If campaign has no results yet:

explain this is normal before execution.

---

# 281. Data visualization

MVP should use simple:

```text
bars
counts
trend lines
```

only where informative.

---

# 282. No decorative charts

---

# 283. Result charts

Future if enough data.

---

# 284. KPI cards should link to detail

---

# 285. Client avatar/photo

Optional.

Do not make required.

---

# 286. Branding

Postura visual identity should be independent of any specific Client.

---

# 287. White-label

Not MVP.

---

# 288. Theme

Light-first.

Dark mode optional future.

---

# 289. Electron theme

Same as web.

---

# 290. Print/export

Not primary UX.

---

# 291. PDF export future

Not needed.

---

# 292. UX analytics

Recommended internal events:

```text
SIGNAL_OPENED
SIGNAL_ACTION_SELECTED
THESIS_APPROVAL_REQUESTED
CONTENT_APPROVED
TASK_COMPLETED
SOURCE_TESTED
AI_CONNECT_STARTED
AI_CONNECT_COMPLETED
```

---

# 293. Privacy analytics

Do not capture:

- content body;
- API key;
- private documents.

---

# 294. Funnel measurement

Manager:

```text
Signal → Decision → Action → Result
```

Client:

```text
Task assigned → opened → completed
```

---

# 295. UX KPI Manager

```text
time to review high-priority Signal
```

---

# 296. UX KPI Client

```text
task completion rate
```

---

# 297. Error KPI

```text
failed AI actions
failed uploads
source errors
```

---

# 298. No dark patterns

Client can:

- reject;
- request changes;
- decline opportunity.

---

# 299. No forced approval

---

# 300. No hidden publishing

---

# 301. Approval transparency

Show:

```text
Nothing will be published automatically.
```

where appropriate.

---

# 302. Security UX — cross-client

Manager header always shows active Client.

Critical action modal repeats Client name.

---

# 303. Example

```text
Archive Source for Juan Vasquez?
```

not:

```text
Archive Source?
```

---

# 304. Multi-client bulk actions

MVP should avoid bulk operations across multiple Clients for sensitive entities.

---

# 305. Global Inbox

Can show multiple Clients but each card clearly labels Client.

---

# 306. Color-coded clients

Not sufficient alone.

Always text label.

---

# 307. Client Portal navigation mobile

Bottom navigation possible:

```text
Home
Tasks
Content
Profile
More
```

---

# 308. Manager mobile navigation

Drawer.

---

# 309. Desktop max-width

Data-heavy pages may use full width.

Content editor can constrain reading width.

---

# 310. Long-form editor

Text column:

```text
comfortable reading width
```

---

# 311. Signal details

Can use side panel on desktop.

Full page on mobile.

---

# 312. Drawer width

Enough for scoring breakdown without crowding.

---

# 313. Accessibility of drawers

Focus trap + close button + Escape.

---

# 314. Table sorting

Show active sort.

---

# 315. Filter chips

Allow clear.

---

# 316. Filter persistence

Can retain per session.

Not permanent complexity required.

---

# 317. Saved views

Future.

---

# 318. Client Home no empty clutter

If no Opportunities, hide/reduce block instead of showing 10 empty cards.

---

# 319. Manager Home may show empty setup checklist initially.

---

# 320. Setup checklist

```text
Create Client
Complete Profile
Create Thesis
Add Sources
Connect AI
```

---

# 321. AI optionality

Checklist should not imply AI is mandatory to use basic product.

---

# 322. First pilot onboarding

Manager can create first Client manually.

---

# 323. Demo data

Development only.

---

# 324. UX copy style

Professional, concise, plain language.

Avoid:

```text
AI magic
revolutionary
game-changing
```

---

# 325. Terminology

Use consistent product terms:

```text
Client
Profile
Thesis
Campaign
Source
Signal
Topic
Opportunity
Content
Task
Result
Evidence
```

---

# 326. Translation to Spanish UI

Recommended visible terms:

```text
Cliente
Perfil
Tesis
Campaña
Fuente
Señal
Tema
Oportunidad
Contenido
Tarea
Resultado
Evidencia
```

---

# 327. Do not rename concepts casually

Other AIs/developers must preserve domain terminology.

---

# 328. Navigation labels Spanish MVP

Manager:

```text
Inicio
Inteligencia
Clientes
Fuentes
Biblioteca
IA
Auditoría
Configuración
```

Client:

```text
Inicio
Mis tareas
Contenido
Oportunidades
Mi perfil
Mi posicionamiento
Resultados
Biblioteca
```

---

# 329. Manager Cockpit primary screen recommendation

Default after login:

```text
Dashboard / Needs Attention
```

not raw Intelligence Inbox.

---

# 330. Client Portal primary screen

```text
My Next Actions
```

---

# 331. UX Quality Checklist

Every major screen should answer:

```text
Where am I?
Which Client?
What is important?
What can I do?
What happens next?
What state is this in?
```

---

# 332. Functional screen matrix

| Screen | Manager | Client |
|---|---:|---:|
| Dashboard | Full | Simplified |
| Intelligence Inbox | Yes | No |
| Clients | Yes | No |
| Profile | Full | Own |
| Thesis | Full | Review |
| Campaigns | Full | Limited/optional |
| Sources | Yes | No |
| Signals | Yes | No |
| Topics | Yes | No |
| Opportunities | Full | Own |
| Content | Full | Own review |
| Tasks | Full | Own |
| Results | Full | Own |
| Library | Full | Own |
| AI Control | Yes | Optional restricted |
| Audit | Yes | No |
| Settings | Full | Account only |

---

# 333. Route proposal

```text
/login
/onboarding

/manager
/manager/intelligence
/manager/clients
/manager/clients/:clientId
/manager/clients/:clientId/profile
/manager/clients/:clientId/theses
/manager/clients/:clientId/campaigns
/manager/clients/:clientId/sources
/manager/clients/:clientId/intelligence
/manager/clients/:clientId/topics
/manager/clients/:clientId/opportunities
/manager/clients/:clientId/content
/manager/clients/:clientId/tasks
/manager/clients/:clientId/results
/manager/clients/:clientId/library

/manager/sources
/manager/ai
/manager/library
/manager/audit
/manager/settings

/client
/client/tasks
/client/content
/client/opportunities
/client/profile
/client/positioning
/client/results
/client/library
```

---

# 334. Route Guards

Manager routes:

```text
ADMIN
```

Client routes:

```text
CLIENT
```

Backend still validates.

---

# 335. Unsaved changes

For manual editors, warn before leaving only when truly unsaved.

Autosave reduces this problem.

---

# 336. Browser back behavior

Must remain predictable.

---

# 337. Pagination UX

Use:

```text
Load more
Next/Previous
```

according to context.

---

# 338. Infinite scroll

Not recommended for Intelligence Inbox MVP.

Manager needs orientation.

---

# 339. Bulk selection state

Clear visible count:

```text
3 selected
```

---

# 340. AI generation review

Generated content should not replace current draft without preserving version.

---

# 341. Destructive AI rewrite

Use:

```text
Create new version
```

---

# 342. Content diff

Future optional.

---

# 343. Comment UX

Simple thread by entity.

Not chat product.

---

# 344. Client comments

Visible to Manager.

---

# 345. Internal notes

Clearly labeled:

```text
Internal — Client cannot see
```

---

# 346. Tooltip is insufficient for internal/private labels

Use persistent tag.

---

# 347. Privacy iconography

Optional, but text required.

---

# 348. Status badges

Standardize.

Examples:

```text
Draft
Active
Paused
Ready
Pending
Approved
Rejected
Archived
```

---

# 349. Status mapping

Do not invent different visible status terms per screen.

---

# 350. Priority badges

```text
Low
Medium
High
Very High
```

UI mapping from internal enum.

---

# 351. Risk badges

```text
Low Risk
Medium Risk
High Risk
Critical Risk
```

---

# 352. Confidence

```text
Low Confidence
Moderate Confidence
High Confidence
```

only in Manager views.

---

# 353. AI provider badges

Only where useful.

---

# 354. Accessibility labels for badges

Text included.

---

# 355. Notifications count

Cap display:

```text
9+
```

optional.

---

# 356. Search no-results

Offer clear reset.

---

# 357. Filter no-results

Show:

```text
No Signals match these filters.
[Clear filters]
```

---

# 358. Session expiry

If Auth expires:

preserve safe local UI state where possible, redirect to login.

Never preserve secrets.

---

# 359. AI capsule expiry

Show:

```text
AI session expired.
Reconnect to continue AI analysis.
```

Manual features remain available.

---

# 360. Persistent credential status

Show if background processing available.

---

# 361. Background analysis status

```text
Automatic analysis: On
```

only if persistent credential + feature enabled.

---

# 362. Source ingestion status

Independent from AI status.

---

# 363. Important UX distinction

```text
Source ingestion: Active
AI analysis: Waiting for connection
```

This prevents confusion.

---

# 364. Job progress

Batch analysis:

```text
8 of 20 completed
2 failed
10 pending
```

when actual state exists.

---

# 365. Retry failed items

Available.

---

# 366. Batch partial success

Must not show generic failure if most succeeded.

---

# 367. Manager approval queue

Could be consolidated:

```text
Needs Attention
```

instead of another top-level nav.

---

# 368. Client approvals

Shown under Tasks/Content.

---

# 369. Results attribution UI

Avoid claiming:

```text
This article caused this lead
```

unless manually confirmed.

Use:

```text
Related result
```

---

# 370. Future analytics readiness

UI can later expand without changing main nav.

---

# 371. Design debt rule

Do not overbuild visualizations before enough data exists.

---

# 372. MVP design target

A polished professional operational tool, not a concept dashboard.

---

# 373. Acceptance Criteria

## UX-CA-001

Manager and Client have distinct navigation.

## UX-CA-002

Manager sees active Client context clearly.

## UX-CA-003

Dashboard prioritizes Needs Attention.

## UX-CA-004

Intelligence Inbox is filterable.

## UX-CA-005

Signal Cards show priority and why it matters.

## UX-CA-006

Risk is separate from priority.

## UX-CA-007

Score details are explainable.

## UX-CA-008

PENDING_AI is visible.

## UX-CA-009

RESEARCH_REQUIRED is visible.

## UX-CA-010

NO_ACTION can be displayed.

## UX-CA-011

Manager can convert Signal from Inbox.

## UX-CA-012

Multi-select can create Topic.

## UX-CA-013

Client Workspace centralizes modules.

## UX-CA-014

Profile includes Review Queue.

## UX-CA-015

Evidence Vault has privacy/status labels.

## UX-CA-016

Thesis Builder exists.

## UX-CA-017

Client Thesis review is simplified.

## UX-CA-018

Campaign views preserve Thesis context.

## UX-CA-019

Sources show health state.

## UX-CA-020

Source can be tested before activation.

## UX-CA-021

Opportunity cards show deadline and why-fit.

## UX-CA-022

Content workflow shows approvals.

## UX-CA-023

Content editor shows strategic context.

## UX-CA-024

Client can request changes.

## UX-CA-025

Tasks are action-first.

## UX-CA-026

Results are linked to actions.

## UX-CA-027

AI Control Center shows provider/session status.

## UX-CA-028

Full secrets are never displayed.

## UX-CA-029

Temporary vs persistent credential is explained.

## UX-CA-030

Audit view exists for Manager.

## UX-CA-031

Empty states contain next action.

## UX-CA-032

Loading/error states are defined.

## UX-CA-033

App remains usable without AI.

## UX-CA-034

Responsive behavior exists.

## UX-CA-035

Client Portal works well on mobile.

## UX-CA-036

Electron reuses web UX.

## UX-CA-037

Accessibility baseline is considered.

## UX-CA-038

No critical action depends only on color.

## UX-CA-039

One primary CTA is used per context.

## UX-CA-040

All domain terminology remains consistent.

---

# 374. UX Rules

## UX-RN-001

Client must not receive raw Manager complexity.

## UX-RN-002

Manager must always know active Client.

## UX-RN-003

Dashboard shows attention, not vanity.

## UX-RN-004

Intelligence is not chronological-only.

## UX-RN-005

Priority and risk are separate.

## UX-RN-006

AI state must be visible when relevant.

## UX-RN-007

No AI feature blocks manual work.

## UX-RN-008

No automatic public action.

## UX-RN-009

Approval state is always visible for public content.

## UX-RN-010

Private/Internal labels are persistent.

## UX-RN-011

No secrets in UI after credential storage.

## UX-RN-012

Destructive actions require appropriate confirmation.

## UX-RN-013

No modal-based long workflows.

## UX-RN-014

No raw HTML rendering from Sources.

## UX-RN-015

No inaccessible color-only statuses.

## UX-RN-016

Client mobile experience is first-class.

## UX-RN-017

Electron does not diverge functionally.

## UX-RN-018

Status naming remains consistent.

## UX-RN-019

Empty states teach the next step.

## UX-RN-020

Every detail screen should support a logical next action.

---

# 375. Historias de usuario UX

## UX-HU-001 — Manager Daily View

**Como** Manager  
**quiero** ver qué requiere atención  
**para** comenzar el día sin revisar todas las áreas.

## UX-HU-002 — Signal Decision

**Como** Manager  
**quiero** entender una Signal en una sola vista  
**para** decidir rápidamente qué hacer.

## UX-HU-003 — Client Context

**Como** Manager  
**quiero** ver siempre con qué Cliente estoy trabajando  
**para** evitar errores.

## UX-HU-004 — Client Tasks

**Como** Cliente  
**quiero** ver mis próximas acciones  
**para** saber exactamente qué debo hacer.

## UX-HU-005 — Content Review

**Como** Cliente  
**quiero** revisar contenido sin ver complejidad técnica  
**para** aprobarlo o pedir cambios fácilmente.

## UX-HU-006 — Score Explainability

**Como** Manager  
**quiero** entender por qué una Signal tiene Score alto  
**para** confiar críticamente en la recomendación.

## UX-HU-007 — Degraded Mode

**Como** Manager  
**quiero** seguir trabajando sin IA  
**para** no depender completamente de un proveedor externo.

## UX-HU-008 — Secure Credential UX

**Como** usuario autorizado  
**quiero** entender si una API Key es temporal o persistente  
**para** tomar una decisión informada.

---

# 376. Orden recomendado de implementación UX

```text
U1 — Design tokens
U2 — App shell
U3 — Role-based navigation
U4 — Manager Dashboard
U5 — Client Switcher
U6 — Client Workspace
U7 — Client Portal Home
U8 — Onboarding
U9 — Profile
U10 — Thesis
U11 — Sources
U12 — Intelligence Inbox
U13 — Signal Detail
U14 — Score Breakdown
U15 — Topics
U16 — Opportunities
U17 — Content workflow/editor
U18 — Tasks
U19 — Results
U20 — Library
U21 — AI Control Center
U22 — Audit
U23 — Settings
U24 — Responsive
U25 — Accessibility
U26 — Electron adaptations
U27 — Empty/loading/error states
U28 — UX regression tests
```

---

# 377. Suggested frontend structure

```text
apps/web/src/
│
├── app/
│   ├── router.ts
│   ├── shell.ts
│   └── guards.ts
│
├── components/
│   ├── primitives/
│   └── domain/
│
├── manager/
│   ├── dashboard/
│   ├── intelligence/
│   ├── clients/
│   ├── sources/
│   ├── ai/
│   ├── library/
│   ├── audit/
│   └── settings/
│
├── client/
│   ├── home/
│   ├── tasks/
│   ├── content/
│   ├── opportunities/
│   ├── profile/
│   ├── positioning/
│   ├── results/
│   └── library/
│
├── onboarding/
├── services/
├── state/
├── types/
├── i18n/
└── styles/
```

---

# 378. Design system structure

```text
styles/
├── tokens.css
├── reset.css
├── base.css
├── layout.css
├── utilities.css
└── components/
```

---

# 379. Resultado esperado de la Fase 13

Una vez implementada esta fase, Postura deberá contar con una experiencia donde:

```text
1. Manager entra y ve Needs Attention.
2. Puede seleccionar Cliente.
3. Revisa Intelligence Inbox.
4. Entiende Score/Risk/Why.
5. Convierte Signal en acción.
6. Gestiona Profile y Thesis.
7. Controla Sources.
8. Genera y revisa Content.
9. Asigna Tasks.
10. Cliente recibe una experiencia simplificada.
11. Cliente aprueba/ejecuta.
12. Manager registra Result.
13. AI Control muestra estado sin exponer secretos.
14. App sigue operando sin IA.
15. Web y Electron comparten experiencia.
16. Mobile permite acciones esenciales.
```

---

# 380. Decisiones cerradas al finalizar Fase 13

1. Postura tendrá Manager Cockpit y Client Portal diferenciados.
2. El Manager Dashboard estará centrado en Needs Attention.
3. El Client Portal estará centrado en Next Actions.
4. Intelligence Inbox será una vista principal.
5. Signal Card mostrará Score, Risk, Why y Action.
6. Priority y Risk estarán separados.
7. Score Breakdown estará disponible para Manager.
8. Cliente no verá scoring técnico completo.
9. Active Client será visible siempre.
10. Client Workspace centralizará módulos.
11. Profile tendrá Review Queue.
12. Evidence Vault tendrá privacidad visible.
13. Thesis Builder será wizard.
14. Cliente aprobará Thesis en vista simplificada.
15. Sources tendrán Health/Test.
16. Opportunities serán deadline-aware.
17. Content será workflow-oriented.
18. Content Editor mostrará contexto estratégico.
19. Approval state será visible.
20. Tasks serán action-first.
21. Results no serán vanity dashboard.
22. AI Control Center mostrará provider/session/usage.
23. Credenciales temporales y persistentes tendrán UX distinta.
24. No se mostrará full key.
25. Audit será Manager-only.
26. Empty states tendrán CTA.
27. Loading states mostrarán etapa real, no progreso falso.
28. Degraded mode sin IA será explícito.
29. El diseño será executive/minimal/light-first.
30. Se evitará estética sci-fi.
31. Client mobile será prioridad alta.
32. Manager mobile soportará revisión/aprobación.
33. Electron reutilizará la misma UX.
34. Accessibility será baseline de implementación.
35. Domain terminology será consistente.
36. La siguiente fase definirá Flujos y Casos de Uso end-to-end.

---

# 381. Siguiente fase

## FASE 14 — Documento 14 de 16
### Flujos, Casos de Uso y Estados End-to-End

El siguiente documento deberá definir:

- login;
- invitation;
- onboarding;
- Profile review;
- Thesis creation;
- Thesis approval;
- Source creation;
- manual Signal;
- automatic Signal;
- AI analysis;
- scoring;
- Intelligence Inbox decision;
- Topic creation;
- Opportunity creation;
- Content generation;
- Manager approval;
- Client approval;
- Task execution;
- result capture;
- Evidence feedback loop;
- credential connect/save/revoke;
- failure/retry flows;
- authorization failures;
- state transitions;
- sequence diagrams;
- acceptance criteria.

---

# 382. Estado de documentación

```text
FASE 1
✅ Documento 01 — Documento Maestro

FASE 2
✅ Documento 02 — Especificación Funcional del MVP

FASE 3
✅ Documento 03 — Roles, Usuarios y Modelo Operativo

FASE 4
✅ Documento 04 — Arquitectura Funcional Integral

FASE 5
✅ Documento 05 — Arquitectura Técnica del MVP

FASE 6
✅ Documento 06 — Modelo de Datos Firebase

FASE 7
✅ Documento 07 — Perfil Maestro y Onboarding Inteligente

FASE 8
✅ Documento 08 — Tesis de Posicionamiento y Campañas

FASE 9
✅ Documento 09 — Fuentes, Señales e Inteligencia de Ingesta

FASE 10
✅ Documento 10 — Arquitectura de Inteligencia Artificial, Agentes y AI Router

FASE 11
✅ Documento 11 — Seguridad de APIs, Credenciales, Sesiones y Protección del MVP

FASE 12
✅ Documento 12 — Sistema de Scoring, Priorización y Recomendaciones Estratégicas

FASE 13
✅ Documento 13 — UX/UI, Navegación y Sistema de Experiencia del Producto

FASE 14
⬜ Documento 14 — Flujos, Casos de Uso y Estados End-to-End
```

---

**FIN DEL DOCUMENTO — POSTURA-F13-D13 v1.0**
