# POSTURA — FASE 11
## Documento 11 de 16 — Seguridad de APIs, Credenciales, Sesiones y Protección del MVP

**Código:** POSTURA-F11-D11  
**Versión:** 1.0  
**Estado:** Especificación de seguridad para implementación  
**Tipo de documento:** Arquitectura de Seguridad, Identidad, Credenciales, Aplicación Web, Firebase, IA y Electron  
**Proyecto:** Postura — Positioning Intelligence & Management System  
**Formato:** Markdown  
**Ámbito:** MVP web-first + Electron, Firebase, Cloud Functions, Secret Manager, OpenAI, Anthropic/Claude  
**Fecha de referencia técnica:** 18 de agosto de 2026

---

# 1. Propósito del documento

Este documento define la arquitectura de seguridad del MVP de Postura.

Su objetivo es establecer controles concretos para proteger:

- cuentas;
- sesiones;
- Clientes;
- Managers;
- datos de Perfil Maestro;
- documentos;
- Sources;
- Signals;
- Tesis;
- contenido;
- tareas;
- resultados;
- API Keys;
- credenciales de proveedores externos;
- Cloud Functions;
- Firestore;
- Cloud Storage;
- Electron;
- GitHub;
- procesos automáticos;
- operaciones de IA.

Este documento debe utilizarse como contrato obligatorio antes de considerar el MVP apto para un piloto real.

---

# 2. Principio rector

La seguridad de Postura no dependerá de:

```text
"ocultar botones"
```

ni de:

```text
"confiar en el navegador"
```

ni de:

```text
"confiar en que el usuario no manipulará requests"
```

La arquitectura seguirá:

```text
IDENTIDAD
   ↓
AUTORIZACIÓN
   ↓
AISLAMIENTO
   ↓
VALIDACIÓN
   ↓
MÍNIMO PRIVILEGIO
   ↓
PROTECCIÓN DE SECRETOS
   ↓
TRAZABILIDAD
   ↓
DETECCIÓN
   ↓
RESPUESTA
```

---

# 3. Objetivos de seguridad

Postura deberá minimizar:

1. acceso no autorizado;
2. escalamiento de privilegios;
3. fuga entre Clientes;
4. exposición de API Keys;
5. exposición de documentos;
6. robo de sesión;
7. XSS;
8. CSRF cuando aplique;
9. SSRF;
10. abuso de Cloud Functions;
11. gasto no autorizado de IA;
12. prompt injection;
13. ejecución insegura en Electron;
14. publicación accidental de secretos en GitHub;
15. logging de información sensible;
16. dependencia vulnerable;
17. operaciones irreversibles no autorizadas;
18. pérdida de trazabilidad.

---

# 4. Modelo de amenazas

Actores de amenaza considerados:

```text
ATTACKER EXTERNO
USUARIO NO AUTORIZADO
CLIENTE MALICIOSO
CUENTA COMPROMETIDA
DEPENDENCIA COMPROMETIDA
SOURCE MALICIOSA
SCRIPT INYECTADO
EXTENSIÓN DE NAVEGADOR MALICIOSA
ERROR DE DESARROLLO
CONFIGURACIÓN FIREBASE INCORRECTA
CREDENCIAL FILTRADA
```

---

# 5. Activos críticos

Clasificación:

## Nivel S0 — Público

- assets web públicos;
- configuración pública normal de Firebase;
- documentación pública.

## Nivel S1 — Interno

- configuración no secreta;
- estados;
- IDs;
- métricas técnicas no sensibles.

## Nivel S2 — Confidencial

- Perfiles de Clientes;
- Tesis;
- Signals privadas;
- documentos;
- notas;
- contenido en revisión;
- oportunidades.

## Nivel S3 — Secreto

- API Keys;
- tokens;
- credenciales de APIs;
- claves de cifrado;
- secretos de servicio.

---

# 6. Regla absoluta

Los activos `S3` nunca deberán almacenarse en:

```text
GitHub
HTML
JavaScript público
Firestore en texto plano
localStorage
IndexedDB
logs
URLs
query strings
analytics
crash reports
```

---

# 7. Defensa en profundidad

No habrá una única barrera.

```mermaid
flowchart TD

    A[User] --> B[Firebase Authentication]
    B --> C[Account Status]
    C --> D[Authorization]
    D --> E[Firestore / Storage Rules]
    D --> F[Cloud Function Authorization]
    E --> G[Tenant Isolation]
    F --> G
    G --> H[App Check]
    H --> I[Rate Limits]
    I --> J[Input Validation]
    J --> K[Domain Operation]
    K --> L[Audit]
```

---

# 8. Identidad — Firebase Authentication

Firebase Authentication será responsable de establecer:

```text
¿QUIÉN ES EL USUARIO?
```

El documento:

```text
users/{uid}
```

será responsable de aportar:

- role;
- organizationId;
- clientId;
- status;
- permisos adicionales.

---

# 9. Métodos de autenticación MVP

Inicial:

```text
Email + Password
```

Futuro compatible:

```text
Google Sign-In
MFA
Enterprise Identity
```

---

# 10. Contraseñas

Postura no almacenará contraseñas.

Firebase Authentication será responsable de su manejo.

---

# 11. Account Status

Estados:

```text
INVITED
ACTIVE
SUSPENDED
ARCHIVED
```

Solo:

```text
ACTIVE
```

puede ejecutar operaciones normales.

---

# 12. Usuario suspendido

Un usuario suspendido con token previamente válido debe ser bloqueado por autorización de backend.

No confiar únicamente en la expiración natural del token.

---

# 13. Autenticación vs autorización

Authentication:

```text
WHO?
```

Authorization:

```text
CAN THIS USER DO THIS?
```

Son controles diferentes.

---

# 14. Roles MVP

```text
ADMIN
CLIENT
```

---

# 15. No confiar en role del frontend

Nunca aceptar:

```json
{
  "role": "ADMIN"
}
```

como prueba.

El backend carga datos autorizados desde servidor.

---

# 16. Tenant Isolation

Cada recurso sensible debe relacionarse con:

```text
organizationId
clientId
```

cuando aplique.

---

# 17. Regla de Client isolation

Un Cliente:

```text
Client A
```

jamás podrá leer o modificar:

```text
Client B
```

aunque conozca:

```text
document ID
URL
Firebase path
```

---

# 18. Enforcement layers

El aislamiento se aplicará en:

```text
UI
Firestore Rules
Storage Rules
Cloud Functions
Context Builder IA
```

---

# 19. Firestore Security Rules

Las Rules deberán seguir:

```text
DENY BY DEFAULT
```

---

# 20. Base rule principle

No usar en producción:

```text
allow read, write: if true;
```

---

# 21. Rules Version

Se recomienda utilizar:

```text
rules_version = '2';
```

para la implementación moderna y compatibilidad con patrones actuales de Firestore.

---

# 22. Firestore Rules — Helper Functions

Crear helpers conceptuales:

```text
isSignedIn()
isActiveUser()
isAdmin()
isClient()
sameOrganization()
ownsClientResource()
```

---

# 23. Ejemplo conceptual

```text
allow read: if
  isSignedIn()
  && isActiveUser()
  && sameOrganization(resource.data)
  && (
      isAdmin()
      || ownsClientResource(resource.data)
  );
```

No copiar literalmente sin validar la colección.

---

# 24. Field Restrictions

Las Rules deben impedir que Client modifique:

```text
role
organizationId
clientId
primaryManagerId
aiKeyManagementAllowed
createdBy
```

---

# 25. Update allowlists

Para writes directos:

comparar:

```text
request.resource.data
```

vs:

```text
resource.data
```

y permitir únicamente campos autorizados.

---

# 26. Server SDK Warning

Las bibliotecas de servidor/Admin SDK omiten Firestore Security Rules.

Por tanto:

```text
Admin SDK ≠ permission granted
```

---

# 27. Cloud Function Authorization

Toda Function que use Admin SDK deberá ejecutar:

```text
1. Require authenticated user.
2. Load user server-side.
3. Check ACTIVE.
4. Check role.
5. Check organizationId.
6. Check client scope.
7. Validate operation.
8. Execute.
```

---

# 28. Backend authorization helper

Se recomienda:

```typescript
authorizeRequest({
  uid,
  requiredRole,
  organizationId,
  clientId,
  permission
});
```

---

# 29. Never trust requested organizationId

Si request contiene:

```text
organizationId
```

backend debe contrastarlo con la identidad autorizada.

---

# 30. Never trust requested clientId

Misma regla.

---

# 31. Cloud Storage Rules

Archivos se almacenan bajo:

```text
organizations/{organizationId}/clients/{clientId}/...
```

---

# 32. Storage authorization

Debe validar:

- usuario autenticado;
- estado activo;
- mismo tenant;
- Client ownership;
- tipo de operación.

---

# 33. File Type Validation

Validar:

```text
MIME
extension
size
```

MIME declarado por el navegador no es prueba suficiente para contenido sensible.

---

# 34. Upload Limits

El MVP deberá establecer límites por categoría.

Ejemplo inicial configurable:

```text
CV/PDF: 15–25 MB
Image: 10 MB
Other docs: 15–25 MB
```

Los valores definitivos se ajustan durante implementación.

---

# 35. Dangerous files

No permitir por defecto:

```text
.exe
.dll
.bat
.cmd
.ps1
.sh executable
.apk
.dmg
```

ni archivos ejecutables arbitrarios.

---

# 36. SVG

Tratar SVG como contenido potencialmente activo.

Para imágenes de perfil se recomienda:

```text
PNG / JPG / WEBP
```

antes que SVG no confiable.

---

# 37. File Processing

Un archivo cargado se considera:

```text
UNTRUSTED
```

hasta validación/procesamiento.

---

# 38. File names

No utilizar el nombre original para construir rutas sensibles.

Utilizar:

```text
fileId
```

y conservar nombre original como metadata sanitizada.

---

# 39. Malware scanning

No es requisito obligatorio del primer prototipo local.

Antes de abrir el sistema a archivos de usuarios externos a escala, deberá evaluarse escaneo antimalware.

---

# 40. Firebase App Check

App Check se utilizará como capa de protección adicional.

Objetivo:

reducir solicitudes que no provienen de instancias legítimas de la aplicación.

---

# 41. App Check no reemplaza Authentication

Postura necesita ambos:

```text
App Check → ¿la request parece venir de nuestra app?
Auth → ¿quién es el usuario?
Authorization → ¿qué puede hacer?
```

---

# 42. Web App Check

Para una integración web nueva se recomienda evaluar:

```text
reCAPTCHA Enterprise
```

como proveedor inicial.

---

# 43. Enforcement strategy

No activar enforcement ciegamente.

Proceso:

```text
1. Integrate App Check.
2. Observe metrics.
3. Validate legitimate traffic.
4. Enable enforcement service by service.
```

---

# 44. Servicios prioritarios

Evaluar enforcement en:

```text
Firestore
Cloud Storage
Cloud Functions
Authentication cuando aplique
```

---

# 45. Development

Entornos locales/CI utilizarán mecanismo debug autorizado.

El debug token nunca deberá publicarse.

---

# 46. GitHub Pages

La configuración pública de Firebase puede existir en el frontend.

Eso no convierte a Firestore en público.

La protección depende de:

```text
Auth
Rules
App Check
Backend authorization
```

---

# 47. API Keys de OpenAI y Claude

OpenAI y Anthropic son secretos S3.

---

# 48. BYOK

El MVP seguirá:

```text
BRING YOUR OWN KEY
```

como modelo inicial.

---

# 49. Opciones de credencial

```text
TEMPORARY
PERSISTENT
```

---

# 50. Default

```text
TEMPORARY
```

---

# 51. Mejora respecto al diseño inicial

No se recomienda conservar la API Key en texto claro en memoria del navegador durante toda la sesión si puede evitarse.

La arquitectura recomendada será:

```text
PASTE KEY ONCE
   ↓
HTTPS
   ↓
SECURE BACKEND
   ↓
VALIDATE KEY
   ↓
CREATE TEMPORARY AI SESSION CAPSULE
   ↓
RETURN OPAQUE SESSION CREDENTIAL
   ↓
BROWSER DISCARDS PLAINTEXT KEY
```

---

# 52. AI Session Capsule

Será una credencial temporal:

- opaca para el frontend;
- cifrada;
- con expiración;
- ligada al UID;
- ligada a organizationId;
- ligada al provider;
- con session ID;
- no reutilizable fuera de su contexto autorizado.

---

# 53. Arquitectura conceptual

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web
    participant B as Secure Backend
    participant C as Crypto Service
    participant P as AI Provider

    U->>W: Paste API Key
    W->>B: HTTPS key + Firebase Auth + App Check
    B->>P: Minimal validation request
    P-->>B: Valid
    B->>C: Encrypt session credential
    C-->>B: Opaque capsule
    B-->>W: Capsule + expiry
    W->>W: Erase plaintext key

    W->>B: Analysis + capsule
    B->>C: Validate/decrypt capsule
    C-->>B: Provider credential
    B->>P: API request
    P-->>B: Result
    B-->>W: Result
```

---

# 54. Why Capsule

Reduce el tiempo durante el cual la key en texto claro existe en JavaScript del navegador.

---

# 55. Important limitation

Una aplicación web ejecuta código en el dispositivo del usuario.

Durante el instante de captura inicial, una API Key ingresada por el usuario existe en el navegador.

Por eso son críticos:

- CSP;
- prevención XSS;
- dependencias limitadas;
- scripts confiables;
- no analytics sobre el campo;
- no browser persistence.

---

# 56. Capsule cryptography

La cápsula deberá utilizar cifrado autenticado.

Recomendación:

```text
AES-GCM / equivalent authenticated encryption
```

mediante infraestructura segura del backend.

---

# 57. Master key

La clave de cifrado de la cápsula no vive en el código.

Debe residir en:

```text
Cloud KMS / Secret Manager-managed architecture
```

según implementación final.

---

# 58. Capsule claims

Contenido protegido conceptual:

```json
{
  "sessionId": "...",
  "uid": "...",
  "organizationId": "...",
  "provider": "OPENAI",
  "credential": "...",
  "issuedAt": "...",
  "expiresAt": "..."
}
```

---

# 59. Capsule TTL

Recomendación MVP:

```text
30–60 minutes
```

configurable.

---

# 60. Session revocation metadata

Para poder invalidar antes del expiry se podrá mantener:

```text
aiSessions/{sessionId}
```

sin guardar la API Key.

---

# 61. aiSessions metadata

```typescript
interface AiSession {
  organizationId: string;
  userId: string;
  provider: "OPENAI" | "ANTHROPIC";

  status:
    | "ACTIVE"
    | "REVOKED"
    | "EXPIRED";

  createdAt: Timestamp;
  expiresAt: Timestamp;
  revokedAt?: Timestamp;

  credentialMode: "TEMPORARY";
}
```

---

# 62. No secret in aiSessions

Nunca guardar:

```text
apiKey
encryptedApiKey
```

en Firestore.

---

# 63. Capsule storage in browser

Preferencia:

```text
memory
```

No:

```text
localStorage
IndexedDB
```

---

# 64. sessionStorage

También se evitará para credenciales IA si es posible.

---

# 65. Reload behavior

Una recarga puede invalidar/perder la sesión temporal.

Esto es aceptable para MVP.

---

# 66. Logout

Debe:

```text
1. revoke active AI session metadata
2. clear capsule from memory
3. clear application state
4. Firebase signOut()
5. redirect to login
```

---

# 67. Browser close

TTL protege aunque no exista logout explícito.

---

# 68. Temporary credential no background

Una session capsule temporal no habilitará procesamiento IA 24/7.

---

# 69. Persistent Mode

Cuando el usuario elige:

```text
Guardar de forma segura
```

se utilizará:

```text
Google Cloud Secret Manager
```

---

# 70. Consent

Persistencia requiere acción explícita.

Default continúa temporal.

---

# 71. Secret Manager principles

Aplicar:

- least privilege;
- proyectos separados por entorno;
- IAM mínimo;
- versiones;
- rotación;
- auditoría.

---

# 72. Secret name

No usar:

```text
user@email.com-openai-key
```

Preferir:

```text
opaque identifier
```

---

# 73. Secret metadata

Firestore:

```text
provider
ownerType
ownerId
secretRef
lastFour optional
configured
timestamps
```

---

# 74. Secret value

Secret Manager únicamente.

---

# 75. Secret access

Solo Functions/servicios que realmente necesiten la key.

---

# 76. Least privilege

No dar a todas las Functions:

```text
Secret Manager Admin
```

si solo necesitan:

```text
Secret Accessor
```

para un conjunto específico.

---

# 77. Secret creation/delete service

Operaciones de administración separadas de operaciones normales de IA cuando sea práctico.

---

# 78. Secret rotation

Postura podrá ofrecer:

```text
Replace Key
```

Proceso:

```text
validate new
create new version/value
switch active metadata
disable/delete old according to policy
audit
```

---

# 79. Revocation

Botón:

```text
Delete Credential
```

debe:

```text
revoke metadata
remove/disable secret
invalidate dependent background use
create audit event
```

---

# 80. Provider-side rotation

Si se sospecha filtración, el usuario deberá rotar/revocar también en la consola del proveedor.

Eliminar una copia de Postura no invalida automáticamente una key en OpenAI/Anthropic si sigue activa allí.

---

# 81. Key display

Nunca volver a mostrar la key completa.

Mostrar:

```text
Configured
••••A72F
```

---

# 82. Test Connection

Debe:

- validar sin loggear key;
- aplicar rate limit;
- devolver provider status;
- no persistir temporal key.

---

# 83. OpenAI security rule

Las requests a OpenAI se enrutarán por backend seguro.

La API Key no se incluirá en código cliente ni repositorio.

---

# 84. Anthropic security rule

Misma regla.

---

# 85. Environment variables

Para credenciales propias de infraestructura/dev:

utilizar variables de entorno/secret store apropiado.

No `.env` versionado.

---

# 86. GitHub Secrets

Solo para CI/CD cuando sean necesarios.

---

# 87. Secret scanning

Activar herramientas de detección de secretos disponibles en GitHub cuando el repositorio/plan lo permita.

---

# 88. Pre-commit secret scan

Recomendado usar una herramienta de secret scanning en CI o pre-commit.

---

# 89. `.gitignore`

Debe excluir:

```text
.env
.env.*
service-account*.json
*.pem
*.key
credentials*
```

con excepciones controladas para ejemplos sin secretos.

---

# 90. No service account JSON in repo

Preferir identidad federada para CI/CD cuando sea posible.

---

# 91. Web Security — XSS

XSS es uno de los riesgos más importantes debido a:

- claves temporales;
- documentos;
- Signals;
- contenido externo;
- HTML dinámico.

---

# 92. XSS prevention

Aplicar:

```text
escape output
sanitize HTML
avoid unsafe innerHTML
no eval
no Function constructor
no inline scripts where possible
CSP
dependency review
```

---

# 93. `innerHTML`

No usar con contenido no confiable.

Preferir:

```text
textContent
DOM APIs seguras
```

---

# 94. Rich content

Si se necesita Markdown/HTML:

utilizar sanitizer probado con allowlist.

---

# 95. Source content rendering

Noticias y páginas no se renderizan como HTML original dentro de Postura.

Mostrar:

```text
sanitized text
metadata
safe link
```

---

# 96. CSP

El frontend deberá implementar Content Security Policy restrictiva.

Objetivo conceptual:

```text
default-src 'self'
script-src 'self'
object-src 'none'
base-uri 'self'
frame-ancestors 'none'
```

y `connect-src` limitado a dominios realmente requeridos.

---

# 97. GitHub Pages CSP

Puede aplicarse mediante meta tag cuando headers no estén disponibles, entendiendo sus limitaciones.

Firebase Hosting permite control de headers más robusto.

---

# 98. Production hosting recommendation

Para producción con mayores exigencias de seguridad se recomienda favorecer:

```text
Firebase Hosting / hosting con headers configurables
```

sobre depender exclusivamente de GitHub Pages.

---

# 99. CSP no debe romper Firebase

Los dominios requeridos se definirán explícitamente.

No utilizar:

```text
*
```

innecesariamente.

---

# 100. CSRF

Las Callable Functions de Firebase usan mecanismos propios de autenticación de SDK.

Aun así, toda operación crítica debe validar:

- Firebase Auth;
- App Check;
- permisos;
- input.

---

# 101. Custom HTTP endpoints

Si se crean endpoints basados en cookies/sesiones:

se deberá evaluar protección CSRF explícita.

---

# 102. Bearer token requests

No confiar en CORS como mecanismo de autenticación.

---

# 103. CORS

Solo permitir origins requeridos en endpoints HTTP personalizados.

---

# 104. Allowed origins

Ejemplos:

```text
localhost dev
GitHub Pages production path/domain
Firebase Hosting domain
custom domain
```

---

# 105. SSRF

Todo Source URL fetch es un riesgo SSRF.

---

# 106. SSRF controls

Backend deberá:

1. parsear URL;
2. permitir protocolos aprobados;
3. resolver host;
4. bloquear IPs privadas/reservadas;
5. bloquear metadata services;
6. restringir redirects;
7. revalidar destino después de redirect;
8. limitar tamaño;
9. limitar tiempo;
10. registrar error sin contenido sensible.

---

# 107. Block ranges conceptually

Bloquear:

```text
localhost
loopback
link-local
RFC1918/private
cloud metadata IPs
```

y equivalentes IPv6.

---

# 108. DNS rebinding

Revalidar IP resuelta al realizar request cuando la implementación lo permita.

---

# 109. Redirects

Limitar cantidad.

Ejemplo:

```text
max 3
```

---

# 110. Redirect validation

Cada nuevo destino se vuelve a validar.

---

# 111. URL credentials

Rechazar URLs tipo:

```text
https://user:password@example.com
```

para Sources normales.

---

# 112. Response size

Definir límites.

No descargar gigabytes.

---

# 113. Timeout

Todo fetch externo tiene timeout.

---

# 114. Prompt Injection

Las medidas de Fase 10 son obligatorias.

---

# 115. External content designation

Todo texto de Source:

```text
UNTRUSTED_EXTERNAL_CONTENT
```

---

# 116. Model cannot grant permissions

Nunca interpretar una salida IA como autorización.

---

# 117. Model cannot select unrestricted URL/tool

Toda acción de herramienta debe ser controlada por aplicación.

---

# 118. Secret isolation from AI

Ningún prompt incluirá:

- API Key;
- session capsule plaintext;
- Firebase token;
- service credential.

---

# 119. Prompt leakage

No considerar prompt del sistema como secreto crítico.

La seguridad debe mantenerse aunque un usuario conozca reglas generales.

---

# 120. Cross-tenant Prompt Injection

Una Source de Client A nunca puede provocar recuperación de Client B porque el Context Builder ya debe estar tenant-scoped.

---

# 121. Rate Limiting

Se requiere protección en funciones costosas.

---

# 122. Targets

Aplicar límites a:

```text
AI analysis
batch analysis
test API key
test Source
run Source now
document processing
invitation send
```

---

# 123. Rate Limit dimensions

Según operación:

```text
per user
per organization
per IP when appropriate
per provider
```

---

# 124. Example limits

No fijados definitivamente.

Configurable.

---

# 125. Denial of Wallet

Un atacante no debe poder disparar miles de requests IA aunque tenga acceso limitado.

---

# 126. Budget Guard + Rate Limit

Ambos son necesarios.

---

# 127. Idempotency

Operaciones críticas costosas podrán aceptar:

```text
idempotencyKey
```

o fingerprints internos.

---

# 128. Batch size limit

Backend impone tamaño.

No confiar en UI.

---

# 129. Request body limit

Todo endpoint debe limitar tamaño.

---

# 130. Input Validation

Utilizar:

```text
Zod
```

u otra validación server-side equivalente.

---

# 131. Unknown fields

Operaciones sensibles deben rechazar o ignorar campos no permitidos.

---

# 132. Mass Assignment

Evitar:

```typescript
updateDoc(ref, request.data)
```

---

# 133. Explicit mapping

Construir:

```typescript
const safeUpdate = {
  fieldA: parsed.fieldA,
  fieldB: parsed.fieldB
};
```

---

# 134. Injection in strings

Firestore no tiene SQL injection tradicional, pero contenido puede afectar:

- HTML;
- prompts;
- logs;
- filenames;
- exports.

Debe escaparse según contexto.

---

# 135. Logging Security

Logs deben seguir:

```text
MINIMUM NECESSARY
```

---

# 136. Never log

```text
passwords
API keys
auth tokens
session capsules
private document bodies
full prompts with sensitive data
authorization headers
```

---

# 137. Redaction

Crear utilidad:

```text
redactSecrets()
```

antes de logs de errores externos.

---

# 138. Structured logs

Campos seguros:

```text
event
uid
clientId
correlationId
operation
provider
status
latency
errorCode
```

---

# 139. Email in logs

Minimizar.

Preferir UID.

---

# 140. Audit vs Debug Log

## Audit

Quién hizo qué.

## Debug

Qué ocurrió técnicamente.

Separar.

---

# 141. Audit events

No editables por usuarios finales.

---

# 142. Audit minimum events

```text
LOGIN
LOGOUT
CLIENT_CREATED
CLIENT_SUSPENDED
ROLE_CHANGE
PERMISSION_CHANGE
THESIS_ACTIVATED
CONTENT_APPROVED
AI_SESSION_CREATED
AI_SESSION_REVOKED
AI_CREDENTIAL_SAVED
AI_CREDENTIAL_REVOKED
AI_RUN_FAILED
SOURCE_CREATED
SOURCE_FETCH_FAILED
```

---

# 143. Session Security

Firebase session y AI session son diferentes.

---

# 144. Firebase Session

Administra acceso de usuario.

---

# 145. AI Session

Administra uso temporal de provider.

---

# 146. Revoking AI session

No necesariamente revoca Firebase session.

---

# 147. Logout

Revoca ambas localmente y metadata temporal según diseño.

---

# 148. Inactivity

Postura podrá implementar timeout UI adicional para entornos sensibles.

No obligatorio para primer prototipo.

---

# 149. Token storage

Seguir prácticas oficiales del SDK Firebase.

No copiar manualmente ID Tokens a localStorage propio.

---

# 150. Reauthentication

Operaciones especialmente sensibles pueden exigir reautenticación futura.

Ejemplos:

```text
change role
delete persistent credential
export all client data
```

No obligatorio para todo el MVP inicial, pero arquitectura compatible.

---

# 151. MFA

Recomendado para Manager cuando el producto pase a producción.

Puede no ser requisito bloqueante del piloto inicial.

---

# 152. Account recovery

Debe depender de mecanismos confiables del proveedor Auth.

---

# 153. Invitation Security

Los tokens de invitación deberán ser:

- aleatorios;
- suficientemente largos;
- single-use;
- con expiry.

---

# 154. Invitation storage

Guardar:

```text
tokenHash
```

no token plano.

---

# 155. Invitation acceptance

Debe validar:

```text
hash
expiry
status
email/identity rules
```

---

# 156. Replay

Una invitación aceptada no vuelve a funcionar.

---

# 157. Enumeration

Mensajes de login/recovery no deben revelar innecesariamente si una cuenta existe.

---

# 158. Email security

Links de invitación/recovery siempre HTTPS.

---

# 159. Open Redirect

No aceptar `returnUrl` arbitrario.

Usar allowlist.

---

# 160. Electron Security

Electron amplifica el impacto de XSS.

---

# 161. Mandatory Electron configuration

```text
nodeIntegration: false
contextIsolation: true
sandbox: true
```

---

# 162. Web Security

Nunca:

```text
webSecurity: false
```

---

# 163. Insecure content

Nunca:

```text
allowRunningInsecureContent: true
```

---

# 164. Remote code

No ejecutar código remoto con privilegios Node.

---

# 165. Preferred content

Electron empaqueta:

```text
local web build
```

---

# 166. Remote links

Abrir fuera de la app solo tras:

- validar protocolo;
- validar URL;
- confirmar allowlist/rule.

---

# 167. `shell.openExternal`

Nunca pasar URL no confiable directamente.

---

# 168. Navigation

Bloquear o limitar navegación desde BrowserWindow principal.

---

# 169. New windows

Bloquear por defecto.

---

# 170. IPC

Cada IPC channel debe ser allowlisted.

---

# 171. IPC Sender Validation

Validar origen/sender de mensajes IPC.

---

# 172. Preload

Exponer API mínima.

---

# 173. Incorrect preload

No:

```typescript
contextBridge.exposeInMainWorld("electron", ipcRenderer);
```

---

# 174. Correct principle

```text
one explicit safe method per capability
```

---

# 175. Filesystem

Renderer no tendrá acceso general al filesystem.

---

# 176. Electron updates

Mantener Electron actualizado porque incluye Chromium y Node.

---

# 177. Dependencies

La seguridad depende también de npm packages.

---

# 178. Dependency Policy

Antes de añadir dependencia:

- necesidad;
- mantenimiento;
- popularidad no es suficiente;
- vulnerabilidades;
- tamaño;
- permisos.

---

# 179. `npm audit` / tooling

CI deberá ejecutar herramienta de auditoría de dependencias compatible con pnpm/npm.

---

# 180. Dependabot

Recomendado en GitHub.

---

# 181. Lockfile

Debe versionarse:

```text
pnpm-lock.yaml
```

---

# 182. Supply Chain

No ejecutar scripts de paquetes desconocidos sin revisión.

---

# 183. CI Security

Pull Request workflow no debe exponer secretos a código no confiable.

---

# 184. Fork PRs

No entregar secrets de producción a workflows de forks.

---

# 185. GitHub Actions permissions

Utilizar:

```text
permissions: read-all
```

o permisos mínimos, ampliando solo lo necesario.

---

# 186. Pinning actions

Recomendado fijar versiones confiables de Actions y revisar dependencias CI.

---

# 187. Environments

Separar:

```text
DEV
PRODUCTION
```

como mínimo.

---

# 188. Separate Firebase projects

Recomendado:

```text
postura-dev
postura-prod
```

---

# 189. Secret separation

Nunca reutilizar credenciales de producción en desarrollo.

---

# 190. Test Data

No usar datos reales sensibles en unit/e2e tests.

---

# 191. Emulator

Firebase Emulator Suite será obligatorio para probar Rules antes de despliegue.

---

# 192. Security Rules tests

Casos obligatorios:

```text
unauthenticated denied
Client A cannot read Client B
Client cannot promote self
Client cannot change tenant
suspended user denied
Admin scoped to organization
private file denied cross-client
audit write denied from client
AI credential metadata protected
```

---

# 193. App Check tests

Verificar:

```text
valid app accepted
missing token behavior
invalid token behavior
debug token only in dev
```

---

# 194. Function authorization tests

Mock/test:

```text
wrong role
wrong client
wrong organization
suspended user
missing auth
```

---

# 195. SSRF tests

URLs:

```text
localhost
127.0.0.1
private IPv4
private IPv6
metadata IP
redirect to private IP
oversized response
redirect loop
```

deben ser rechazadas/controladas.

---

# 196. XSS tests

Inputs con:

```html
<script>alert(1)</script>
<img src=x onerror=alert(1)>
javascript:...
```

deben renderizarse de forma segura.

---

# 197. Markdown XSS

Si se renderiza Markdown, sanitizar HTML resultante.

---

# 198. Prompt Injection tests

Source con comandos maliciosos no obtiene:

- secretos;
- tools;
- datos cruzados;
- cambios de rol.

---

# 199. Secret leak tests

Automated scans on:

```text
repository
build output
source maps when published
logs
```

---

# 200. Source Maps

Evaluar si publicar source maps en producción.

No deben contener secretos, pero pueden facilitar análisis del código.

---

# 201. API Abuse Tests

Simular:

- batch excesivo;
- repeated test connection;
- repeated run source;
- invalid payload spam.

---

# 202. Security Headers

Para hosting que permita headers:

```text
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
Strict-Transport-Security
```

y frame protection mediante CSP.

---

# 203. HSTS

Solo cuando el dominio está correctamente preparado para HTTPS.

---

# 204. Permissions Policy

Deshabilitar capacidades web no utilizadas.

Ejemplo:

```text
camera
microphone
geolocation
```

salvo features futuras que las necesiten.

---

# 205. Referrer Policy

Evitar enviar paths/datos innecesarios a sitios externos.

---

# 206. Sensitive data in URLs

Nunca poner:

```text
API keys
tokens
private document content
```

en URL/query.

---

# 207. Client IDs in URLs

`clientId` puede existir como identificador de ruta interna, siempre que autorización real exista.

No se considera secreto por sí solo.

---

# 208. Browser caching

Respuestas sensibles de endpoints personalizados podrán usar headers de cache restrictivos.

---

# 209. Clipboard

Si Postura permite copiar API Key durante input, no implementará copia automática innecesaria.

---

# 210. Password manager compatibility

Los campos de API Key deberán marcarse apropiadamente sin romper gestores de contraseñas/secretos.

---

# 211. API Key input field

Características:

```text
type=password
no analytics capture
no telemetry
paste allowed
show temporarily optional before submit
clear after successful session creation
```

---

# 212. No paste prevention

No impedir pegar claves; hacerlo empeora uso con password managers.

---

# 213. Reveal key

Solo antes de enviar y por acción del usuario.

Una key persistida nunca se vuelve a recuperar para mostrar.

---

# 214. Credential scope

Si los proveedores permiten permisos por key/proyecto:

recomendar al usuario crear credenciales con el mínimo acceso necesario.

---

# 215. Separate keys

Recomendado:

```text
Postura-specific API key/project
```

en vez de reutilizar una key maestra amplia.

---

# 216. Spend Controls

Recomendar configurar presupuestos/alertas directamente en el proveedor.

---

# 217. Postura Budget Guard

Complementa, no sustituye límites del proveedor.

---

# 218. OpenAI leak response

Si se sospecha fuga:

```text
revoke/rotate provider key immediately
```

y revisar usage.

---

# 219. Anthropic leak response

Misma política general:

```text
revoke/replace provider credential
review usage
```

usando las herramientas de la consola correspondiente.

---

# 220. Incident Response

Postura deberá tener procedimiento mínimo.

---

# 221. Incident categories

```text
ACCOUNT_COMPROMISE
API_KEY_LEAK
CROSS_TENANT_ACCESS
MALICIOUS_FILE
SOURCE_ABUSE
AI_COST_ABUSE
DEPENDENCY_VULNERABILITY
DATA_EXPOSURE
```

---

# 222. Incident severity

```text
SEV-1 CRITICAL
SEV-2 HIGH
SEV-3 MEDIUM
SEV-4 LOW
```

---

# 223. SEV-1 examples

- cross-client data exposure;
- API Keys public;
- admin account compromise;
- arbitrary code execution Electron;
- unrestricted Firestore public access.

---

# 224. Immediate response SEV-1

```text
1. Contain.
2. Disable affected feature/access.
3. Revoke credentials.
4. Preserve logs.
5. Identify scope.
6. Fix root cause.
7. Rotate secrets.
8. Validate before re-enable.
9. Document incident.
```

---

# 225. Kill Switches

Feature Flags should allow disabling:

```text
automatic AI
persistent credentials
source ingestion
comparative AI
file uploads
```

without full redeploy when possible.

---

# 226. User suspension

Manager/technical administrator can suspend compromised account.

---

# 227. Global emergency action

Future technical admin capability may disable:

```text
AI operations
```

globally.

Not necessarily exposed in normal UI.

---

# 228. Secret compromise procedure

```text
revoke provider key
revoke Postura metadata
invalidate AI sessions
inspect AI Runs
review Git history/build/logs
replace credential
```

---

# 229. Git leak

Deleting from latest commit is insufficient if secret existed historically.

Treat as compromised and rotate.

---

# 230. Audit preservation

Security incident logs must not be casually deleted.

---

# 231. Alerting

MVP recommended alerts:

```text
repeated AI auth failures
unusual AI spend
repeated authorization failures
source fetch anomalies
critical Function errors
```

---

# 232. No full SIEM requirement

Enterprise SIEM is out of MVP.

---

# 233. Firebase / Cloud Monitoring

Use available logging/monitoring.

---

# 234. Data Backup

Security includes availability.

Production shall define:

- Firestore backup/export;
- Storage retention/backup strategy;
- recovery test.

---

# 235. Backup access

Backups are sensitive and need IAM controls.

---

# 236. Backup does not equal archive

Different purpose.

---

# 237. Data Deletion

Hard deletion workflow must include:

- authorization;
- scope confirmation;
- related files;
- audit;
- retention obligations.

---

# 238. Export Security

Client data export:

- authenticated;
- authorized;
- generated server-side;
- expires;
- no cross-client data.

---

# 239. Download URLs

Prefer time-limited/authorized access patterns where applicable.

---

# 240. Signed URLs

If used, short expiry.

---

# 241. Cloud Storage download tokens

Review exposure model before using long-lived public-style links for private files.

---

# 242. Public files

No Client files public by default.

---

# 243. Data Classification in UI

Internal labels may indicate:

```text
Private
Internal
Public Source
```

---

# 244. Privacy by design

Collect only what Postura needs.

---

# 245. AI Provider Data Minimization

Send only context necessary for the operation.

---

# 246. Sensitive Evidence

Private Evidence can be excluded from AI context unless needed.

---

# 247. Manager Notes

Do not automatically send all internal Manager notes to provider.

---

# 248. PII

Minimize email, phone, address in model requests.

---

# 249. Data retention of providers

Before production deployment, review current provider-specific retention/privacy controls and contractual requirements for the target Clients.

---

# 250. No assumption of zero retention

Do not state internally that providers retain nothing unless verified for the actual configuration/account.

---

# 251. Security Review before production

Checklist:

```text
Auth configured
Rules tested
Storage Rules tested
App Check enforced
CSP active
no secrets in build
secret scanning clean
rate limits active
Budget Guard active
SSRF tests pass
XSS tests pass
Electron hardening pass
audit events working
incident procedure documented
backup strategy documented
```

---

# 252. Security Definition of Done

Una feature sensible no está terminada hasta tener:

```text
✅ authorization
✅ validation
✅ tenant isolation
✅ secret handling
✅ abuse protection
✅ audit
✅ error redaction
✅ tests
```

---

# 253. Security Code Review

Toda PR que modifique:

- Auth;
- Rules;
- Storage;
- AI credentials;
- Electron IPC;
- URL fetching;

requiere revisión especial.

---

# 254. Automated checks

CI:

```text
typecheck
lint
tests
rules tests
dependency audit
secret scan
build
```

---

# 255. Production Build Inspection

Antes de release:

buscar patrones:

```text
sk-
API_KEY
PRIVATE_KEY
BEGIN PRIVATE KEY
service_account
```

y equivalentes.

---

# 256. False positives

Revisar; no desactivar scanning por comodidad.

---

# 257. Firebase Rules Deployment

Rules deben versionarse en Git.

No depender de cambios manuales en consola.

---

# 258. Rules rollback

Mantener historial Git para revertir.

---

# 259. IAM

Aplicar mínimo privilegio a:

```text
Functions service accounts
deploy identities
Secret Manager
Storage
Firestore
```

---

# 260. No Owner role for runtime

Runtime no necesita rol Owner.

---

# 261. Separate service accounts

Cuando el MVP madure, separar funciones con privilegios especiales.

---

# 262. Secret-specific permissions

Preferible otorgar acceso a secretos requeridos y no acceso global.

---

# 263. Cloud Functions public access

Callable Functions deben validar Auth/App Check.

HTTP Functions públicas deberán justificarlo.

---

# 264. Health endpoint

Si existe público:

no revelar:

- config;
- project IDs internos innecesarios;
- secrets;
- dependency versions sensibles.

---

# 265. Error messages

Usuario:

```text
No fue posible completar la operación.
Reference: correlationId
```

Logs internos:

detalle sanitizado.

---

# 266. Stack traces

No mostrar al usuario final en producción.

---

# 267. Debug flags

Nunca habilitar debug extenso en Production por defecto.

---

# 268. Electron DevTools

Puede estar disponible en desarrollo.

En release se controla según necesidad.

No confiar en ocultar DevTools como barrera de seguridad.

---

# 269. Local Electron storage

No guardar persistent API keys localmente en Electron en MVP.

Persistencia segura continúa server-side Secret Manager.

---

# 270. Electron temporary key

Usar el mismo AI Session Capsule.

---

# 271. Electron renderer

No conoce plaintext key después de intercambio inicial.

---

# 272. Native secure storage future

OS keychain podría evaluarse en versión desktop futura.

No necesario MVP.

---

# 273. Offline mode

No almacenar secretos offline.

---

# 274. Content Security in Electron

CSP también aplica.

---

# 275. Custom protocol

Para app empaquetada, evaluar protocolo personalizado seguro en lugar de `file://` cuando se implemente hardening final.

---

# 276. Permissions

Electron no concederá:

- camera;
- microphone;
- notifications;
- geolocation;

sin feature explícita y handler.

---

# 277. External web content

No cargar páginas arbitrarias dentro del renderer privilegiado principal.

Abrir browser externo seguro cuando corresponda.

---

# 278. Source preview

Mostrar contenido sanitizado dentro de app.

---

# 279. Data leakage via referrer

Usar política adecuada y enlaces externos seguros.

---

# 280. Security Headers Electron

Aplicar CSP desde HTML/meta o response headers/protocol según empaquetado.

---

# 281. Threat: malicious dependency

Mitigation:

- lockfile;
- audit;
- minimal packages;
- update policy;
- review install scripts.

---

# 282. Threat: compromised Manager

Mitigation:

- MFA future/recommended production;
- audit;
- least privilege;
- session controls;
- ability to suspend;
- no plaintext secrets.

---

# 283. Threat: compromised Client

Impact constrained by:

```text
own client scope only
```

---

# 284. Threat: leaked temporary capsule

Mitigation:

- short TTL;
- UID binding;
- App Check;
- revocation metadata;
- memory-only browser storage;
- operation validation.

---

# 285. Threat: leaked persistent secretRef

SecretRef alone is not credential.

Backend IAM remains required.

---

# 286. Threat: leaked Firebase web config

Not treated as a secret.

Security still enforced by backend/Rules/App Check.

---

# 287. Threat: public GitHub repo

Safe only if:

```text
no secrets
no private data
no service account files
```

---

# 288. Threat: Source prompt injection

Mitigated by:

- untrusted content marking;
- no secrets in model context;
- no autonomous tools;
- context scoping;
- schema validation.

---

# 289. Threat: SSRF via Source URL

Mitigated by dedicated fetch validation.

---

# 290. Threat: AI cost abuse

Mitigated by:

- Auth;
- App Check;
- rate limit;
- budget guard;
- max batch;
- provider spend controls.

---

# 291. Threat: Firestore misconfiguration

Mitigated by:

- deny by default;
- Rules tests;
- Emulator;
- CI;
- versioned deployment.

---

# 292. Threat: Admin SDK bypass

Mitigated by mandatory Function authorization helper.

---

# 293. Security matrix

| Threat | Primary Control | Secondary Control |
|---|---|---|
| Cross-client access | Rules/authorization | Tests/audit |
| API key leak | Capsule/Secret Manager | CSP/redaction |
| XSS | Safe rendering | CSP |
| SSRF | URL validator | Network restrictions |
| Prompt injection | Untrusted context policy | No autonomous tools |
| AI abuse | Rate limit | Budget Guard |
| Account compromise | Auth | MFA/audit |
| Bad dependency | Dependency review | CI audit |
| Electron RCE | Sandbox/isolation | CSP/navigation controls |
| Git leak | Secret scan | Rotation procedure |

---

# 294. Security acceptance criteria

## SEC-CA-001

Firestore is deny-by-default.

## SEC-CA-002

Storage is deny-by-default.

## SEC-CA-003

Client A cannot access Client B.

## SEC-CA-004

Suspended users are blocked.

## SEC-CA-005

Client cannot change role.

## SEC-CA-006

Cloud Functions independently authorize Admin SDK operations.

## SEC-CA-007

App Check is integrated.

## SEC-CA-008

App Check enforcement is validated before production.

## SEC-CA-009

OpenAI key is never committed to frontend/repository.

## SEC-CA-010

Anthropic key is never committed to frontend/repository.

## SEC-CA-011

Temporary API Key is discarded from browser plaintext after secure session creation.

## SEC-CA-012

Temporary AI session has TTL.

## SEC-CA-013

Temporary AI session can be revoked.

## SEC-CA-014

Temporary AI session metadata stores no key.

## SEC-CA-015

Persistent key uses Secret Manager.

## SEC-CA-016

Firestore contains metadata only.

## SEC-CA-017

Full stored key is never displayed.

## SEC-CA-018

Logout clears/revokes temporary AI session.

## SEC-CA-019

XSS payloads render safely.

## SEC-CA-020

CSP is defined.

## SEC-CA-021

Source HTML is not injected directly.

## SEC-CA-022

SSRF private ranges are blocked.

## SEC-CA-023

Redirect SSRF is blocked.

## SEC-CA-024

Fetch size and timeout limits exist.

## SEC-CA-025

Prompt injection cannot invoke unauthorized actions.

## SEC-CA-026

Secrets never enter prompts.

## SEC-CA-027

Rate limiting exists on costly Functions.

## SEC-CA-028

Budget Guard exists.

## SEC-CA-029

Logs redact secrets.

## SEC-CA-030

Audit events exist for credential operations.

## SEC-CA-031

Invitation tokens are single-use and expiring.

## SEC-CA-032

Invitation token is hashed at rest where applicable.

## SEC-CA-033

Electron has nodeIntegration false.

## SEC-CA-034

Electron has contextIsolation true.

## SEC-CA-035

Electron has sandbox true.

## SEC-CA-036

Electron validates IPC sender.

## SEC-CA-037

External navigation is restricted.

## SEC-CA-038

CI includes dependency audit.

## SEC-CA-039

CI includes secret scan.

## SEC-CA-040

Rules security tests run automatically.

## SEC-CA-041

No production secrets are used in tests.

## SEC-CA-042

Incident response procedure exists.

## SEC-CA-043

Provider credential can be revoked.

## SEC-CA-044

Security feature kill switches exist.

## SEC-CA-045

Production release passes security checklist.

---

# 295. Reglas obligatorias

## SEC-RN-001

No confiar en frontend para autorización.

## SEC-RN-002

No almacenar API Keys en Firestore plaintext.

## SEC-RN-003

No almacenar API Keys en localStorage.

## SEC-RN-004

No almacenar API Keys en Git.

## SEC-RN-005

No registrar API Keys.

## SEC-RN-006

Temporary is default credential mode.

## SEC-RN-007

Persistent requires explicit consent.

## SEC-RN-008

Persistent uses Secret Manager.

## SEC-RN-009

Temporary AI session expires.

## SEC-RN-010

All client resources remain tenant-scoped.

## SEC-RN-011

Admin SDK calls require explicit authorization.

## SEC-RN-012

Source URLs are server-validated.

## SEC-RN-013

External content is untrusted.

## SEC-RN-014

AI output never grants permissions.

## SEC-RN-015

No autonomous external action in MVP.

## SEC-RN-016

Rate limits are server-side.

## SEC-RN-017

Batch limits are server-side.

## SEC-RN-018

Logs use redaction.

## SEC-RN-019

Security Rules are version controlled.

## SEC-RN-020

Production must not use open test rules.

## SEC-RN-021

Electron renderer has no unrestricted Node access.

## SEC-RN-022

IPC is allowlisted.

## SEC-RN-023

User-supplied HTML is sanitized/not directly rendered.

## SEC-RN-024

Sensitive operations require audit.

## SEC-RN-025

Known leaked credentials are rotated, not merely deleted from code.

---

# 296. User Stories

## SEC-HU-001 — Temporary AI Key

**Como** usuario autorizado  
**quiero** utilizar una API Key sin guardarla permanentemente  
**para** reducir exposición.

---

## SEC-HU-002 — Save Key

**Como** usuario autorizado  
**quiero** elegir explícitamente guardar una key  
**para** habilitar uso futuro y automatización.

---

## SEC-HU-003 — Revoke Key

**Como** usuario autorizado  
**quiero** eliminar una credencial almacenada  
**para** impedir que Postura continúe usándola.

---

## SEC-HU-004 — Tenant Isolation

**Como** Cliente  
**quiero** que otros Clientes no puedan acceder a mi información  
**para** preservar confidencialidad.

---

## SEC-HU-005 — Secure Source

**Como** Manager  
**quiero** introducir una URL sin permitir acceso a infraestructura interna  
**para** evitar SSRF.

---

## SEC-HU-006 — Audit

**Como** Manager  
**quiero** conocer cambios críticos  
**para** investigar incidentes.

---

## SEC-HU-007 — App Authenticity

**Como** operador  
**quiero** reducir requests automatizadas que no provienen de Postura  
**para** disminuir abuso.

---

## SEC-HU-008 — Safe Electron

**Como** usuario desktop  
**quiero** que una página o Signal maliciosa no obtenga acceso al sistema operativo  
**para** proteger mi equipo.

---

# 297. Orden recomendado de implementación

```text
S1 — Security helpers / authorization
S2 — Firestore Rules
S3 — Storage Rules
S4 — Rules tests
S5 — App Check integration
S6 — App Check staged enforcement
S7 — AI Session Capsule design
S8 — Temporary AI session create/revoke
S9 — Persistent Secret Manager path
S10 — Credential rotation/revocation
S11 — CSP
S12 — Safe rendering / sanitizer
S13 — SSRF-safe fetcher
S14 — Rate limiter
S15 — Budget Guard integration
S16 — Logging redaction
S17 — Audit security events
S18 — Invitation hardening
S19 — Electron hardening
S20 — Dependency/secret scanning
S21 — Incident kill switches
S22 — Security regression suite
S23 — Production security review
```

---

# 298. Security Gate before pilot

El piloto no debe iniciar con datos profesionales reales hasta aprobar como mínimo:

```text
PASS Firestore isolation tests
PASS Storage isolation tests
PASS Function authorization tests
PASS temporary credential test
PASS secret persistence test
PASS XSS tests
PASS SSRF tests
PASS logout/revocation tests
PASS secret scan
PASS Electron security config
```

---

# 299. Security Gate before production

Además:

```text
App Check enforcement
CSP/headers
rate limits
Budget Guard
backups
incident response
dependency review
MFA strategy for Managers
production IAM review
provider privacy review
```

---

# 300. Referencias oficiales verificadas

Las decisiones de esta fase fueron contrastadas con documentación oficial vigente al 18 de agosto de 2026.

## Firebase / Google Cloud

### Firestore Security Rules

Firebase confirma que las Rules proporcionan control de acceso y validación para clientes web/mobile y que deben combinarse con Firebase Authentication para sistemas basados en usuarios y roles.

También indica que las librerías de servidor omiten Firestore Security Rules, por lo que los accesos server-side deben protegerse mediante IAM y controles propios.

Referencia:

https://firebase.google.com/docs/firestore/security/get-started

### Firebase App Check

Firebase recomienda para nuevas integraciones web evaluar reCAPTCHA Enterprise y permite observar métricas antes de activar enforcement.

App Check puede proteger servicios como Firestore, Storage y Cloud Functions.

Referencia:

https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider

### Secret Manager

Google Cloud recomienda:

- principio de mínimo privilegio;
- separación de entornos/proyectos;
- IAM limitado;
- administración de versiones;
- políticas de rotación.

Referencia:

https://cloud.google.com/secret-manager/docs/best-practices

---

## OpenAI

OpenAI recomienda:

- no desplegar API Keys en navegadores o apps cliente;
- enrutar requests mediante backend;
- no incluir keys en repositorios;
- utilizar sistemas de gestión de secretos para producción;
- monitorear uso;
- rotar una key si existe sospecha de filtración;
- utilizar credenciales individuales/proyectos y controles disponibles en la cuenta.

Referencia:

https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety

---

## Electron

Electron recomienda explícitamente:

- cargar únicamente contenido seguro;
- no habilitar Node integration para contenido remoto;
- habilitar context isolation;
- habilitar sandbox;
- no desactivar webSecurity;
- implementar CSP restrictiva;
- limitar navegación y nuevas ventanas;
- validar IPC senders;
- mantener Electron actualizado;
- no exponer APIs de Electron a contenido no confiable.

Referencia:

https://www.electronjs.org/docs/latest/tutorial/security

---

# 301. Nota sobre el modo temporal BYOK

La documentación de OpenAI recomienda que las API Keys no se desplieguen en entornos cliente.

Postura utilizará BYOK porque es una decisión funcional del MVP, pero aplicará una arquitectura donde:

```text
1. El usuario introduce la key explícitamente.
2. La key viaja por HTTPS al backend.
3. No se persiste en el navegador.
4. El backend crea una credencial temporal opaca/cifrada.
5. El navegador elimina el plaintext.
6. Las llamadas reales al proveedor ocurren desde backend.
7. La sesión temporal tiene expiración y revocación.
```

Esto reduce considerablemente la exposición frente a conservar la key directamente en JavaScript durante todo el uso.

Para entornos empresariales futuros, una credencial persistente en Secret Manager o una cuenta de IA administrada por Postura será arquitectónicamente superior para automatizaciones de larga duración.

---

# 302. Resultado esperado de la Fase 11

Una vez implementada esta fase, Postura deberá poder:

```text
1. Autenticar Manager/Cliente.
2. Autorizar por rol.
3. Aislar organizaciones.
4. Aislar Clientes.
5. Proteger Firestore.
6. Proteger Storage.
7. Proteger Functions.
8. Validar App Check.
9. Crear sesión IA temporal segura.
10. Eliminar plaintext key del frontend tras intercambio.
11. Expirar/revocar sesión temporal.
12. Guardar key opcional en Secret Manager.
13. Reemplazar/revocar credencial.
14. Bloquear SSRF.
15. Bloquear XSS en rendering.
16. Aplicar CSP.
17. Limitar abuso.
18. Controlar gasto IA.
19. Redactar logs.
20. Auditar acciones críticas.
21. Operar Electron con sandbox/isolación.
22. Detectar secretos en CI.
23. Responder a incidentes.
```

---

# 303. Decisiones cerradas al finalizar la Fase 11

1. Firebase Authentication gestiona identidad.
2. Postura gestiona autorización.
3. Firestore Rules serán deny-by-default.
4. Storage Rules serán deny-by-default.
5. Admin SDK no implica autorización.
6. Todas las Functions sensibles autorizan explícitamente.
7. App Check se incorporará.
8. reCAPTCHA Enterprise será la opción web preferida a evaluar.
9. App Check enforcement se habilitará progresivamente.
10. BYOK temporal sigue siendo el default.
11. La key temporal no permanecerá en plaintext durante toda la sesión.
12. Se introduce AI Session Capsule.
13. Capsule tendrá TTL.
14. Capsule estará ligada a usuario/organización/provider.
15. Browser guardará capsule en memoria.
16. Firestore podrá guardar metadata de sesión, nunca secret.
17. Logout revoca/limpia la sesión temporal.
18. Persistent mode requiere consentimiento.
19. Persistent mode usa Secret Manager.
20. Secret Manager usa mínimo privilegio.
21. Keys persistentes no se vuelven a mostrar.
22. Revocación de Postura y revocación del proveedor son conceptos diferentes.
23. XSS tendrá controles explícitos.
24. CSP será obligatoria.
25. Source HTML no se renderiza directamente.
26. SSRF-safe fetcher será obligatorio.
27. Redirects serán revalidados.
28. Prompt injection no puede cambiar permisos.
29. Modelos no reciben secretos.
30. Rate Limiting será server-side.
31. Budget Guard será obligatorio para IA.
32. Logging aplicará redaction.
33. Audit y debug logs estarán separados.
34. Invitations serán single-use, expiring y token-hashed.
35. Electron mantendrá nodeIntegration false.
36. Electron mantendrá contextIsolation true.
37. Electron mantendrá sandbox true.
38. IPC será allowlisted.
39. Dependencias serán auditadas.
40. CI incluirá secret scanning.
41. Rules estarán en Git.
42. Entornos dev/prod estarán separados.
43. Incidentes tendrán procedimiento mínimo.
44. Kill switches estarán previstos.
45. Piloto y producción tendrán Security Gates diferentes.
46. La siguiente fase definirá Scoring y Recomendaciones de forma profunda.

---

# 304. Siguiente fase

## FASE 12 — Documento 12 de 16
### Sistema de Scoring, Priorización y Recomendaciones Estratégicas

El siguiente documento deberá definir:

- scoring model;
- Thesis Match;
- Audience Match;
- Timeliness;
- Authority Fit;
- Differentiation;
- Strategic Potential;
- Commercial Potential;
- Source Quality;
- Risk Penalty;
- evidence gap;
- explainability;
- thresholds;
- Manager override;
- ranking;
- Intelligence Inbox prioritization;
- confidence;
- NO_ACTION;
- RESEARCH_REQUIRED;
- opportunity conversion;
- scoring evaluation;
- calibration;
- feedback capture;
- criteria for high-priority Signals;
- quality tests;
- acceptance criteria.

---

# 305. Estado de documentación

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
⬜ Documento 12 — Sistema de Scoring, Priorización y Recomendaciones Estratégicas
```

---

**FIN DEL DOCUMENTO — POSTURA-F11-D11 v1.0**
