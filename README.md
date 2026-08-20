# POSTURA

Sistema de inteligencia y gestión de posicionamiento (primera versión operativa).

## Arranque

```bash
npm install
npm run dev
```

Abre la URL que imprima Vite (por defecto `http://localhost:3000`).

## Cuentas iniciales

| Rol | Correo | Contraseña |
|---|---|---|
| Brand Manager | `manager@postura.internal` | `Postura2026!` |
| Cliente (Juan Vásquez) | `juan.vasquez@lexfirm.com` | `Postura2026!` |

Al crear un cliente, la app genera un **token de invitación**. En la pantalla de login, el cliente lo usa para crear su cuenta.

## Qué funciona en esta versión

- Login / logout real (contraseñas con PBKDF2). Impersonar cliente es una acción de manager, no un “demo switch”.
- Onboarding de 6 pasos **que persiste** el perfil.
- Tesis con aprobación del cliente (no se auto-activa).
- Señales manuales y **RSS real** vía proxy local (`/api/rss`) con bloqueo SSRF.
- Scoring **v1.0** (8 factores + penalties del Doc 12).
- Análisis de IA: si conectas API keys en **IA**, las llamadas salen del servidor de desarrollo (no se guardan en localStorage). Sin keys, el producto sigue usable en modo manual/heurístico.
- Contenido con estados de aprobación, tareas, teleprompter con **grabación de cámara** (IndexedDB).
- Resultados → Evidence Vault.
- Cuotas de plan aplicadas al crear clientes/fuentes/tesis/IA.

Los datos viven en `localStorage` (versión v4) hasta migrar a Firestore. Limpia el almacenamiento del sitio si vienes de la demo anterior.

## IA (BYOK)

1. Entra como manager → **IA**.
2. Pega keys de OpenAI y/o Anthropic.
3. Activar sesión. Las claves van a memoria del proceso `vite` (TTL 60 min) y se destruyen al salir.

Sin `npm run dev` el proxy `/api/*` no existe.
