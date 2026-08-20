# POSTURA — FASE 3
## Documento 03 de 16 — Roles, Usuarios y Modelo Operativo Detallado

**Código:** POSTURA-F3-D03  
**Versión:** 1.0  
**Estado:** Aprobación funcional inicial  
**Tipo de documento:** Especificación funcional y operativa  
**Proyecto:** Postura — Positioning Intelligence & Management System  
**Formato:** Markdown  
**Ámbito:** MVP web-first con Firebase, GitHub/Electron y proveedores de IA externos

---

## 1. Propósito del documento

Este documento define de manera formal cómo se organizan los usuarios, roles, permisos, relaciones operativas y responsabilidades dentro del MVP de Postura.

Su objetivo es eliminar ambigüedades antes de programar autenticación, autorización, administración de clientes, aislamiento de información, configuración de inteligencia artificial y flujos de trabajo entre el Manager y el Cliente.

Este documento debe ser tratado como una **fuente de verdad funcional** para los componentes de:

- autenticación;
- autorización;
- usuarios;
- clientes;
- Managers;
- sesiones;
- invitaciones;
- permisos;
- aislamiento de datos;
- configuración de IA;
- auditoría;
- relación Manager–Cliente;
- preparación futura para organizaciones.

Ninguna IA de desarrollo deberá ampliar estos roles o introducir permisos nuevos sin identificarlos primero como una propuesta de cambio.

---

# 2. Principio operativo central

Postura no se concibe inicialmente como una red social, una plataforma abierta ni un SaaS completamente autónomo.

El MVP funcionará bajo un modelo **Managed SaaS**:

> Un Manager profesional utiliza Postura para investigar, analizar, filtrar, recomendar, preparar y coordinar acciones de posicionamiento para uno o varios clientes. El Cliente aporta su conocimiento, valida su perfil, revisa los materiales que llevarán su nombre, ejecuta determinadas tareas y aprueba o rechaza oportunidades.

El sistema debe mantener una separación clara entre:

1. **la inteligencia y administración estratégica**, que pertenece principalmente al Manager;
2. **la identidad, opinión y aprobación final**, que pertenecen al Cliente.

La inteligencia artificial es una herramienta de apoyo y no sustituye la responsabilidad de ninguno de los dos.

---

# 3. Roles oficiales del MVP

El MVP tendrá únicamente dos roles de usuario finales:

1. **ADMIN / MANAGER**
2. **CLIENT**

No se crearán inicialmente roles adicionales como editor, investigador, supervisor, analista, community manager, auditor o administrador de organización.

La arquitectura deberá permitir incorporarlos en versiones posteriores sin reestructurar completamente el modelo de seguridad.

---

# 4. Rol ADMIN / MANAGER

## 4.1 Definición

El ADMIN / MANAGER es el usuario encargado de operar Postura y gestionar el posicionamiento de los clientes asignados.

No debe entenderse como un administrador técnico tradicional.

En el MVP, el Manager es el **centro estratégico y operativo** del sistema.

---

## 4.2 Responsabilidades del Manager

El Manager podrá:

- crear clientes;
- invitar clientes;
- activar y desactivar clientes;
- revisar perfiles;
- completar información del Perfil Maestro;
- validar información obtenida automáticamente;
- definir y modificar tesis de posicionamiento;
- crear campañas;
- crear y administrar fuentes;
- insertar señales manualmente;
- activar fuentes automáticas;
- revisar señales detectadas;
- clasificar señales;
- descartar ruido;
- enviar información a análisis de IA;
- revisar scoring;
- aprobar o rechazar recomendaciones;
- crear oportunidades;
- crear tareas;
- generar contenido;
- editar contenido generado;
- enviar contenido al cliente;
- solicitar aprobación;
- recibir observaciones;
- revisar resultados;
- registrar resultados manualmente;
- configurar modos de IA;
- configurar proveedores permitidos;
- utilizar OpenAI;
- utilizar Claude;
- activar análisis comparativo;
- administrar credenciales IA cuando tenga permiso;
- consultar registros de actividad;
- cerrar o archivar campañas;
- administrar el ciclo completo de trabajo.

---

## 4.3 El Manager conserva control humano

En el MVP:

- ninguna recomendación de IA se considera automáticamente aprobada;
- ningún contenido se considera listo para publicación sin revisión;
- ninguna oportunidad se asigna al cliente sin una decisión del Manager;
- ninguna publicación será ejecutada automáticamente por Postura;
- ninguna fuente automática tendrá autoridad para crear tareas finales sin intervención del sistema de reglas y/o del Manager.

El nivel máximo de automatización del MVP será **automático controlado**.

---

# 5. Rol CLIENT

## 5.1 Definición

El CLIENT es el profesional cuya reputación, autoridad, visibilidad o posicionamiento está siendo gestionado mediante Postura.

El sistema debe minimizar su carga operativa.

El Cliente no debe navegar por toda la maquinaria interna del sistema.

---

## 5.2 Responsabilidades del Cliente

El Cliente podrá:

- iniciar sesión;
- completar su onboarding;
- revisar su Perfil Maestro;
- confirmar información detectada;
- modificar información propia;
- cargar documentos;
- cargar CV;
- cargar fotografías;
- cargar publicaciones;
- registrar experiencia;
- registrar estudios;
- registrar proyectos;
- registrar productos o servicios;
- definir preferencias;
- revisar su tesis de posicionamiento;
- comentar una tesis;
- aprobar o solicitar cambios sobre una tesis;
- consultar tareas;
- aceptar tareas;
- marcar tareas como realizadas;
- rechazar tareas;
- cargar evidencia de ejecución;
- revisar contenido;
- editar contenido cuando se habilite;
- aprobar contenido;
- rechazar contenido;
- solicitar modificaciones;
- responder oportunidades;
- aceptar oportunidades;
- rechazar oportunidades;
- registrar comentarios;
- revisar resultados básicos;
- consultar su biblioteca;
- administrar sus propias credenciales IA únicamente si el Manager habilita esta capacidad.

---

## 5.3 Restricciones del Cliente

El Cliente no podrá:

- consultar otros clientes;
- consultar señales internas de otros clientes;
- modificar fuentes globales;
- modificar usuarios ajenos;
- consultar credenciales de otros usuarios;
- modificar reglas de seguridad;
- acceder a configuraciones administrativas;
- modificar los agentes base;
- publicar automáticamente;
- aprobar contenido en nombre de otro cliente;
- modificar scoring interno global;
- consultar información operativa reservada del Manager;
- modificar registros de auditoría.

---

# 6. Modelo Manager–Cliente

## 6.1 Relación básica

En el MVP:

```text
MANAGER
   │
   ├── CLIENTE A
   ├── CLIENTE B
   ├── CLIENTE C
   └── CLIENTE N
```

Un Manager podrá gestionar múltiples clientes.

Cada Cliente tendrá inicialmente un Manager principal.

---

## 6.2 Preparación para evolución futura

Aunque el MVP implemente un Manager principal, el modelo de datos debe evitar suponer que esa relación será siempre uno-a-uno.

La arquitectura deberá poder evolucionar posteriormente a:

```text
ORGANIZATION
   │
   ├── MANAGER A
   ├── MANAGER B
   └── MANAGER C
          │
          ├── CLIENTE 1
          ├── CLIENTE 2
          └── CLIENTE 3
```

y posteriormente incluso a:

```text
CLIENTE
   ├── MANAGER PRINCIPAL
   ├── EDITOR
   ├── INVESTIGADOR
   └── ANALISTA
```

Estas funciones **no forman parte del MVP**.

---

# 7. Entidad de usuario

Cada cuenta autenticada deberá tener un registro lógico de usuario.

## 7.1 Campos mínimos sugeridos

```json
{
  "uid": "firebase-auth-uid",
  "email": "usuario@dominio.com",
  "displayName": "Nombre Apellido",
  "role": "admin | client",
  "status": "invited | active | suspended | archived",
  "clientId": "nullable",
  "organizationId": "default-org",
  "managerId": "nullable",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "lastLoginAt": "timestamp",
  "mustCompleteOnboarding": true,
  "aiKeyManagementAllowed": false
}
```

El código anterior es orientativo y será formalizado en el documento de modelo de datos Firebase.

---

# 8. Estados de usuario

Los usuarios podrán tener los siguientes estados.

## 8.1 INVITED

La invitación fue creada, pero el usuario aún no ha completado el acceso.

Acciones permitidas:

- aceptar invitación;
- crear/configurar cuenta;
- definir contraseña o autenticarse por mecanismo permitido.

---

## 8.2 ACTIVE

Usuario habilitado para operar normalmente.

---

## 8.3 SUSPENDED

La cuenta existe pero el acceso se encuentra temporalmente bloqueado.

No debe eliminarse su información.

---

## 8.4 ARCHIVED

Usuario que ya no opera en Postura.

Su información histórica debe mantenerse cuando sea necesaria para conservar la trazabilidad.

---

# 9. Flujo de creación de Cliente

El Manager podrá iniciar la creación de un cliente.

## 9.1 Flujo básico

```text
Manager
   ↓
Nuevo Cliente
   ↓
Información mínima
   ↓
Crear registro
   ↓
Generar invitación
   ↓
Cliente recibe acceso
   ↓
Primer inicio de sesión
   ↓
Onboarding
   ↓
Perfil Maestro inicial
```

---

## 9.2 Información mínima para crear un cliente

El Manager deberá poder registrar inicialmente:

- nombre;
- apellido;
- correo electrónico;
- profesión o área;
- empresa, si aplica;
- país o mercado principal;
- notas internas opcionales.

No debe exigirse completar el Perfil Maestro desde esta pantalla.

---

# 10. Sistema de invitaciones

## 10.1 Requisitos

La invitación deberá:

- estar vinculada al cliente correcto;
- tener fecha de creación;
- poder caducar;
- poder ser reenviada;
- poder ser revocada;
- evitar reutilización indebida;
- asociar automáticamente la cuenta autenticada con el cliente correspondiente.

---

## 10.2 Estados de invitación

```text
PENDING
ACCEPTED
EXPIRED
REVOKED
```

---

# 11. Primer inicio de sesión del Cliente

En el primer acceso, el Cliente no debe entrar directamente al dashboard normal.

El sistema deberá detectar:

```text
mustCompleteOnboarding = true
```

y dirigirlo al onboarding inicial.

---

## 11.1 Secuencia recomendada

```text
LOGIN
  ↓
¿Primer ingreso?
  ├── NO → Dashboard
  └── SÍ
       ↓
    Bienvenida
       ↓
    Perfil mínimo
       ↓
    Objetivos
       ↓
    Audiencia
       ↓
    URLs / CV / LinkedIn / Web
       ↓
    Confirmación
       ↓
    Perfil inicial creado
       ↓
    Dashboard
```

---

# 12. Onboarding progresivo y responsabilidad compartida

El Cliente no estará obligado a completar todo su perfil de una sola vez.

Postura utilizará un modelo progresivo:

```text
Cliente aporta datos
        +
Manager aporta contexto
        +
IA propone información
        ↓
Perfil Maestro
```

Toda información obtenida automáticamente deberá distinguir entre:

- confirmada;
- pendiente de confirmación;
- rechazada;
- actualizada.

---

# 13. Propiedad y visibilidad de la información

## 13.1 Información visible para el Manager

El Manager podrá consultar toda la información del cliente que administra, salvo secretos que por diseño no deban mostrarse en texto claro.

---

## 13.2 Información visible para el Cliente

El Cliente podrá consultar:

- su Perfil Maestro;
- su tesis;
- campañas visibles;
- tareas;
- contenidos;
- oportunidades;
- documentos propios;
- resultados;
- comentarios dirigidos a él;
- configuración permitida.

---

## 13.3 Información interna del Manager

Podrá existir información de uso exclusivamente administrativo:

- notas internas;
- evaluación estratégica;
- scoring técnico;
- observaciones operativas;
- razones de descarte;
- costos internos;
- diagnósticos de IA;
- registros técnicos.

El Cliente no tendrá acceso automático a estos campos.

---

# 14. Aislamiento entre clientes

Este requisito es crítico.

Un cliente jamás deberá poder acceder mediante interfaz, URL directa, consulta API o manipulación del navegador a información de otro cliente.

La seguridad deberá existir en dos niveles:

1. interfaz;
2. backend/reglas de Firebase.

Ocultar un botón no se considera seguridad.

---

# 15. Matriz principal de permisos

| Función | Manager | Cliente |
|---|---:|---:|
| Crear cliente | Sí | No |
| Editar datos básicos de cliente | Sí | Propios |
| Desactivar cliente | Sí | No |
| Ver Perfil Maestro | Sí | Propio |
| Editar Perfil Maestro | Sí | Propio |
| Validar información IA | Sí | Propia |
| Crear tesis | Sí | No |
| Editar tesis | Sí | Comentarios |
| Aprobar tesis | Sí | Sí, aceptación del cliente |
| Crear campaña | Sí | No |
| Crear fuente | Sí | No |
| Insertar señal manual | Sí | No MVP |
| Activar monitoreo | Sí | No |
| Ver Intelligence Inbox | Sí | No |
| Ejecutar análisis IA | Sí | Según permiso |
| Crear oportunidad | Sí | No |
| Responder oportunidad | Sí | Sí |
| Crear tarea | Sí | No |
| Completar tarea | Sí | Sí |
| Crear contenido | Sí | No |
| Editar contenido | Sí | Sí, si está habilitado |
| Aprobar contenido | Sí | Sí |
| Rechazar contenido | Sí | Sí |
| Publicar automáticamente | No MVP | No MVP |
| Ver resultados | Sí | Propios |
| Registrar resultados | Sí | Propios, limitado |
| Configurar OpenAI/Claude | Sí | Opcional |
| Ver clave completa guardada | No | No |
| Eliminar propia API key | Sí | Sí, si tiene permiso |
| Ver auditoría | Sí | No |
| Editar auditoría | No | No |

---

# 16. Modo de aprobación dual

Para contenidos que llevarán públicamente el nombre del cliente, Postura deberá soportar un proceso de aprobación.

## 16.1 Flujo

```text
IA genera borrador
      ↓
Manager revisa
      ↓
¿Aprobado por Manager?
   ├── NO → edición
   └── SÍ
        ↓
      Cliente
        ↓
¿Cliente aprueba?
   ├── NO → cambios
   └── SÍ
        ↓
     LISTO
```

---

## 16.2 Estado LISTO

El estado `READY` significa:

- contenido revisado;
- contenido aprobado;
- disponible para exportación o publicación asistida.

No implica publicación automática.

---

# 17. Tareas

Las tareas representan acciones concretas solicitadas al Cliente.

Ejemplos:

- grabar video;
- revisar artículo;
- responder pregunta;
- aprobar guion;
- preparar comentario;
- confirmar dato;
- aceptar oportunidad;
- asistir a evento;
- entregar documento.

---

## 17.1 Estados de tarea

```text
DRAFT
ASSIGNED
VIEWED
IN_PROGRESS
COMPLETED
REJECTED
CANCELLED
```

---

## 17.2 Responsabilidad

El Manager crea o autoriza la tarea.

El Cliente ejecuta, acepta, rechaza o comenta la tarea.

---

# 18. Oportunidades

Una oportunidad puede provenir de:

- una señal;
- una recomendación de IA;
- una búsqueda manual;
- una fuente automática;
- una decisión del Manager.

Ejemplos:

- conferencia;
- podcast;
- convocatoria;
- entrevista;
- artículo invitado;
- premio;
- evento;
- foro;
- consulta pública;
- colaboración;
- oportunidad de networking.

---

## 18.1 Estados sugeridos

```text
DETECTED
UNDER_REVIEW
RECOMMENDED
SENT_TO_CLIENT
ACCEPTED
REJECTED
IN_PROGRESS
COMPLETED
ARCHIVED
```

---

# 19. Sesiones

Postura utilizará Firebase Authentication como sistema inicial de autenticación.

La sesión de usuario y la sesión de credenciales de IA deben ser tratadas como conceptos diferentes.

---

## 19.1 Sesión de usuario

Permite acceder a Postura.

---

## 19.2 Sesión IA

Permite usar una credencial temporal de OpenAI o Claude.

Una sesión de usuario puede existir sin que exista una sesión IA.

---

# 20. Gestión de API Keys

El MVP adoptará el modelo **BYOK — Bring Your Own Key** como mecanismo principal.

## 20.1 Comportamiento predeterminado

Las API Keys serán temporales.

El usuario:

1. introduce la clave;
2. la conexión es validada;
3. se habilita su uso durante la sesión;
4. al cerrar sesión o expirar la sesión IA se elimina.

---

# 21. Opción “Guardar clave”

El usuario podrá decidir expresamente conservar una credencial.

La interfaz deberá presentar dos opciones:

```text
(●) Usar solo durante esta sesión
( ) Guardar de forma segura
```

La opción temporal debe ser la predeterminada.

---

## 21.1 Prohibiciones

Las claves no deberán guardarse:

- en GitHub;
- en código fuente;
- en HTML;
- en archivos JavaScript públicos;
- en `localStorage`;
- en Firestore en texto plano;
- en logs;
- en mensajes de error;
- en archivos exportados.

---

## 21.2 Credenciales persistentes

Si posteriormente se habilita almacenamiento persistente, se utilizará un sistema dedicado para secretos.

Firestore solamente almacenará metadatos o referencias, nunca la clave completa.

---

# 22. Permiso para administrar credenciales IA

El Manager podrá definir si el Cliente puede configurar credenciales.

Campo conceptual:

```text
aiKeyManagementAllowed
```

Valores:

```text
true
false
```

Por defecto:

```text
false
```

en clientes gestionados completamente por el Manager.

---

# 23. Modos de proveedor IA

Un usuario autorizado podrá trabajar con:

```text
OPENAI
CLAUDE
AUTOMATIC
COMPARATIVE
```

---

## 23.1 OPENAI

Se utiliza OpenAI como proveedor.

---

## 23.2 CLAUDE

Se utiliza Claude como proveedor.

---

## 23.3 AUTOMATIC

Postura selecciona el proveedor configurado de acuerdo con la tarea y reglas disponibles.

---

## 23.4 COMPARATIVE

OpenAI y Claude realizan análisis separados y Postura genera una síntesis.

Este modo deberá estar reservado para trabajos de mayor valor debido a su mayor consumo.

---

# 24. Auditoría

Las acciones críticas deben generar eventos de auditoría.

## 24.1 Eventos mínimos

- login;
- logout;
- invitación creada;
- invitación aceptada;
- cliente creado;
- cliente suspendido;
- perfil modificado;
- tesis creada;
- tesis modificada;
- fuente creada;
- señal añadida;
- análisis IA ejecutado;
- contenido generado;
- contenido aprobado;
- contenido rechazado;
- tarea creada;
- tarea completada;
- oportunidad aceptada;
- oportunidad rechazada;
- API provider configurado;
- credencial eliminada;
- cambio de permisos.

---

## 24.2 Prohibición

Los registros de auditoría no podrán contener API Keys completas.

---

# 25. Notificaciones del MVP

El sistema deberá soportar notificaciones internas básicas.

Ejemplos:

- nueva tarea;
- contenido pendiente;
- aprobación solicitada;
- oportunidad disponible;
- comentario del Manager;
- onboarding incompleto.

El correo electrónico puede incorporarse como canal básico, pero no deberá convertirse en un sistema complejo de campañas.

---

# 26. Dashboard del Manager

El Manager deberá poder ver:

- clientes activos;
- tareas pendientes;
- contenidos esperando aprobación;
- señales críticas;
- oportunidades;
- clientes con onboarding incompleto;
- actividad reciente;
- problemas de conexión IA;
- fuentes con errores.

---

# 27. Dashboard del Cliente

El Cliente deberá ver principalmente:

- tareas pendientes;
- contenido para revisar;
- oportunidades;
- progreso de perfil;
- acciones recomendadas;
- resultados recientes.

No debe mostrarse al Cliente la complejidad completa del Intelligence Engine.

---

# 28. Manejo de eliminación

Para el MVP se priorizará el **soft delete** sobre el borrado físico en entidades críticas.

Ejemplo:

```text
active = false
archived = true
```

Esto preserva trazabilidad y evita eliminar accidentalmente el historial de posicionamiento.

---

# 29. Cierre de sesión

El cierre de sesión debe ejecutar como mínimo:

```text
1. finalizar sesión Firebase;
2. invalidar sesión IA temporal;
3. eliminar referencias temporales de credenciales;
4. limpiar memoria del navegador relacionada con secretos;
5. limpiar tokens de sesión;
6. regresar a pantalla de acceso.
```

Las credenciales expresamente guardadas de forma segura no se eliminarán automáticamente.

---

# 30. Sesión expirada

Si la sesión de autenticación expira:

- el usuario deberá autenticarse nuevamente;
- las credenciales IA temporales deben considerarse inválidas;
- no deberá reanudarse automáticamente una clave temporal antigua.

---

# 31. Clientes inactivos

Un cliente suspendido:

- no podrá iniciar sesión;
- conservará su información;
- conservará su historial;
- no deberá recibir nuevas tareas;
- el monitoreo automático podrá detenerse;
- sus fuentes podrán pausarse.

---

# 32. Separación entre autenticación y autorización

Firebase Authentication responderá:

> ¿Quién es este usuario?

Las reglas y lógica de Postura responderán:

> ¿Qué puede hacer este usuario?

Nunca debe utilizarse únicamente el hecho de estar autenticado como permiso para acceder a recursos.

---

# 33. Reglas conceptuales de aislamiento Firebase

Las reglas reales se definirán técnicamente más adelante.

Conceptualmente:

```text
ADMIN:
puede acceder únicamente a clientes bajo su alcance organizacional.

CLIENT:
puede acceder únicamente a recursos cuyo clientId corresponde
al clientId asociado a su usuario.
```

---

# 34. Preparación multi-tenant

Aunque inicialmente exista una sola organización operando Postura, toda entidad principal deberá estar preparada para identificar su ámbito.

Campo conceptual:

```text
organizationId
```

Esto permitirá en el futuro separar:

```text
Organización A
Organización B
Organización C
```

sin reconstruir completamente la aplicación.

---

# 35. Organización inicial del MVP

Para el MVP podrá utilizarse:

```text
organizationId = "postura-default"
```

La interfaz no necesitará mostrar aún el concepto de organización al usuario.

---

# 36. Reglas de negocio

## RN-ROL-001

Todo usuario debe tener exactamente un rol principal en el MVP.

## RN-ROL-002

Los únicos roles permitidos en MVP son `admin` y `client`.

## RN-ROL-003

Un Cliente no puede consultar información de otro Cliente.

## RN-ROL-004

Un Manager puede administrar varios Clientes.

## RN-ROL-005

Todo Cliente debe estar asociado a un Manager principal en el MVP.

## RN-ROL-006

Toda cuenta debe tener un estado válido.

## RN-ROL-007

Un usuario suspendido no puede acceder a la plataforma.

## RN-ROL-008

El Cliente debe completar el onboarding inicial antes de acceder al flujo normal.

## RN-ROL-009

Toda acción crítica debe ser auditable.

## RN-ROL-010

La aprobación del Cliente es obligatoria para contenido publicado bajo su identidad.

## RN-ROL-011

Postura no publica automáticamente en el MVP.

## RN-ROL-012

Una API Key temporal debe invalidarse al finalizar la sesión correspondiente.

## RN-ROL-013

Guardar una API Key requiere consentimiento explícito.

## RN-ROL-014

Ninguna API Key completa puede registrarse en logs.

## RN-ROL-015

El modo comparativo requiere tener ambos proveedores disponibles.

## RN-ROL-016

Un Cliente no puede otorgarse a sí mismo permisos administrativos.

## RN-ROL-017

Una invitación revocada o expirada no puede utilizarse.

## RN-ROL-018

El borrado de clientes debe ser lógico por defecto.

## RN-ROL-019

Todo recurso sensible deberá estar asociado a un `clientId` y/o `organizationId`.

## RN-ROL-020

Las reglas del backend prevalecen sobre cualquier control visual del frontend.

---

# 37. Historias de usuario

## HU-ROL-001 — Crear cliente

**Como** Manager  
**quiero** crear un nuevo cliente  
**para** comenzar a gestionar su posicionamiento.

### Criterios

- se genera registro;
- se asocia al Manager;
- queda en estado inicial válido;
- puede generarse invitación.

---

## HU-ROL-002 — Aceptar invitación

**Como** Cliente  
**quiero** aceptar una invitación segura  
**para** activar mi cuenta.

### Criterios

- la invitación debe ser válida;
- no debe estar expirada;
- no debe haber sido utilizada;
- el usuario queda asociado al cliente correcto.

---

## HU-ROL-003 — Completar onboarding

**Como** Cliente  
**quiero** suministrar mi información inicial  
**para** permitir que Postura comprenda mi perfil.

---

## HU-ROL-004 — Administrar varios clientes

**Como** Manager  
**quiero** cambiar entre clientes  
**para** gestionar sus estrategias de manera independiente.

---

## HU-ROL-005 — Aislamiento de información

**Como** Cliente  
**quiero** que mis datos estén aislados  
**para** evitar que otros clientes puedan consultarlos.

---

## HU-ROL-006 — Suspender cliente

**Como** Manager  
**quiero** suspender temporalmente una cuenta  
**para** impedir acceso sin perder historial.

---

## HU-ROL-007 — Usar API temporal

**Como** usuario autorizado  
**quiero** introducir una API Key temporal  
**para** utilizar IA sin almacenarla permanentemente.

---

## HU-ROL-008 — Guardar API Key

**Como** usuario autorizado  
**quiero** optar por almacenar una clave de forma segura  
**para** no introducirla en cada sesión.

---

## HU-ROL-009 — Eliminar credencial

**Como** usuario autorizado  
**quiero** eliminar una credencial guardada  
**para** revocar su uso desde Postura.

---

## HU-ROL-010 — Aprobar contenido

**Como** Cliente  
**quiero** revisar y aprobar contenido  
**para** controlar lo que será publicado bajo mi nombre.

---

# 38. Criterios globales de aceptación de la fase

## CA-ROL-001

El sistema soporta los roles `admin` y `client`.

## CA-ROL-002

Un Manager puede crear al menos un Cliente.

## CA-ROL-003

Un Cliente puede completar el primer acceso y onboarding.

## CA-ROL-004

Un Cliente no puede consultar recursos pertenecientes a otro Cliente.

## CA-ROL-005

Un Manager puede administrar varios clientes sin mezclar información.

## CA-ROL-006

Las cuentas pueden suspenderse sin eliminar historial.

## CA-ROL-007

Las invitaciones tienen estado y control de vigencia.

## CA-ROL-008

El sistema distingue autenticación de autorización.

## CA-ROL-009

Las API Keys temporales desaparecen al finalizar la sesión IA.

## CA-ROL-010

Guardar una clave requiere selección expresa.

## CA-ROL-011

Las claves persistentes no se guardan en texto plano en Firestore.

## CA-ROL-012

El Cliente debe aprobar contenido asociado a su identidad.

## CA-ROL-013

La publicación automática permanece deshabilitada.

## CA-ROL-014

Existe auditoría básica de acciones críticas.

## CA-ROL-015

La arquitectura contiene `organizationId` aunque el MVP utilice una organización por defecto.

---

# 39. Casos límite que deben contemplarse

## 39.1 Cliente intenta abrir URL de otro cliente

Resultado esperado:

```text
403 / acceso denegado
```

No debe mostrarse información parcial.

---

## 39.2 Invitación usada dos veces

Resultado:

```text
INVITATION_ALREADY_USED
```

---

## 39.3 Invitación expirada

Resultado:

```text
INVITATION_EXPIRED
```

---

## 39.4 API Key inválida

Resultado:

- no almacenar;
- mostrar error;
- permitir reintento;
- no registrar la clave.

---

## 39.5 Claude no disponible, OpenAI disponible

Modo automático:

- Postura podrá continuar con OpenAI;
- deberá registrar qué proveedor fue utilizado.

---

## 39.6 OpenAI y Claude no configurados

Las funciones que no requieran IA deberán seguir funcionando.

Las funciones IA deberán mostrar:

```text
Proveedor de IA no disponible
```

---

## 39.7 Cliente suspendido con sesión activa

El backend debe validar estado y negar nuevas operaciones.

---

# 40. Consideraciones de UX

## Manager

La interfaz deberá priorizar:

- velocidad;
- control;
- visibilidad de estados;
- filtros;
- cambio rápido entre clientes;
- alertas;
- aprobación.

## Cliente

La interfaz deberá priorizar:

- simplicidad;
- claridad;
- pocas decisiones por pantalla;
- tareas;
- aprobación;
- progreso.

---

# 41. Lo que NO se implementa en esta fase del MVP

No se desarrollará todavía:

- múltiples roles administrativos;
- jerarquías complejas;
- equipos por cliente;
- delegación granular;
- facturación;
- suscripciones;
- permisos personalizados por campo;
- SSO empresarial;
- LDAP;
- Microsoft Entra ID empresarial;
- Google Workspace empresarial avanzado;
- CRM interno;
- marketplace de Managers;
- portal de agencias;
- sistema de franquicias;
- múltiples organizaciones visibles en UI;
- administración de planes comerciales.

La arquitectura podrá prepararse para parte de estas capacidades, pero no deberán construirse todavía.

---

# 42. Directrices para la IA desarrolladora

La IA utilizada para implementar este documento deberá cumplir las siguientes reglas:

1. No crear roles adicionales.
2. No introducir permisos no documentados.
3. No almacenar API Keys en frontend.
4. No confiar exclusivamente en controles visuales.
5. Aplicar aislamiento de datos desde backend/Firebase Rules.
6. Mantener `organizationId` y `clientId` en las entidades sensibles.
7. No implementar publicación automática.
8. No convertir al Cliente en administrador.
9. No eliminar físicamente historial salvo instrucción expresa.
10. No mostrar secretos completos una vez almacenados.
11. Registrar eventos críticos sin almacenar secretos.
12. Mantener compatibilidad web-first.
13. Mantener compatibilidad futura con Electron.
14. No acoplar permisos a OpenAI o Claude específicamente; utilizar una capa de proveedor.
15. Cualquier función adicional debe presentarse como propuesta antes de implementarse.

---

# 43. Dependencias con otros documentos

Este documento depende de:

- **Documento 01 — Documento Maestro de Definición, Visión y Alcance**
- **Documento 02 — Especificación Funcional del MVP**

Y servirá como base para:

- Documento 04 — Arquitectura Funcional;
- Documento 05 — Arquitectura Técnica;
- Documento 06 — Modelo de Datos Firebase;
- Documento 07 — Perfil Maestro y Onboarding;
- Documento 10 — Arquitectura de Inteligencia Artificial;
- Documento 11 — Seguridad de APIs y Credenciales;
- Documento 13 — UX/UI y Navegación;
- Documento 14 — Flujos y Casos de Uso.

---

# 44. Decisiones cerradas al finalizar esta fase

Al aprobar este documento quedan establecidas las siguientes decisiones:

1. Postura tendrá dos roles MVP: Manager y Cliente.
2. El Manager será el operador estratégico del sistema.
3. Un Manager podrá administrar múltiples clientes.
4. Un Cliente tendrá un Manager principal en el MVP.
5. La arquitectura estará preparada para organizaciones futuras.
6. Firebase Authentication será el mecanismo inicial de autenticación.
7. Autenticación y autorización serán capas diferentes.
8. El aislamiento de datos será obligatorio.
9. El onboarding será obligatorio en el primer acceso.
10. El Cliente podrá validar su propia información.
11. Las API Keys serán temporales por defecto.
12. Guardar una clave será opcional y explícito.
13. Las credenciales no se almacenarán en texto plano en Firestore.
14. OpenAI y Claude funcionarán mediante una capa de proveedor.
15. El Cliente deberá aprobar contenido asociado a su identidad.
16. No habrá publicación autónoma en el MVP.
17. Las acciones críticas tendrán trazabilidad.
18. Se utilizará soft delete en información crítica.
19. La interfaz del Cliente será considerablemente más sencilla que la del Manager.
20. Este modelo operativo servirá como contrato funcional para las siguientes fases.

---

# 45. Resultado esperado

Una vez implementado este documento, Postura deberá poder operar de forma segura con un flujo mínimo como:

```text
Manager crea Cliente
        ↓
Cliente recibe invitación
        ↓
Cliente inicia sesión
        ↓
Onboarding
        ↓
Perfil inicial
        ↓
Manager analiza cliente
        ↓
Manager crea estrategia/tareas
        ↓
Cliente revisa
        ↓
Cliente aprueba o ejecuta
        ↓
Resultado queda registrado
```

Todo ello manteniendo separación de permisos, aislamiento de información y control humano.

---

# 46. Siguiente documento

## FASE 4 — Documento 04 de 16
### Arquitectura Funcional Integral del MVP

El siguiente documento deberá convertir las decisiones estratégicas y operativas de los documentos 01, 02 y 03 en una arquitectura funcional completa.

Deberá especificar:

- módulos;
- submódulos;
- relaciones;
- dependencias;
- entradas;
- salidas;
- eventos;
- componentes;
- interacción Manager–Cliente;
- interacción con IA;
- flujo de señales;
- flujo de contenido;
- flujo de oportunidades;
- flujo de tareas;
- flujo de resultados;
- límites funcionales del MVP.

---

**FIN DEL DOCUMENTO — POSTURA-F3-D03 v1.0**
