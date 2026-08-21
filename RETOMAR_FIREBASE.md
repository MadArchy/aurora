# Retomar — Firebase producción (aurora-postura-app)

> Guardado el 20 ago 2026. La app ya está en modo **Firebase real** (no emulador).
> Proyecto: `aurora-postura-app` · `.env.local` con `VITE_FIREBASE_USE_EMULATORS=false`

---

## Al abrir el proyecto

```powershell
cd C:\Users\user\Desktop\AURORA
npm install
npm run dev
```

Abrir: **http://127.0.0.1:3000/** (o el puerto que indique Vite)

Debes ver en la barra superior: **`Firebase · aurora-postura-app`**

---

## Checklist si es la primera vez en esta máquina

### 1. Firebase Console (una vez)
- [Auth](https://console.firebase.google.com/project/aurora-postura-app/authentication/providers) → **Email/Password** activado
- Auth → Settings → **Authorized domains** → `127.0.0.1` y `localhost`

### 2. Activar Storage (una vez — requerido para videos)
https://console.firebase.google.com/project/aurora-postura-app/storage → **Get Started**

Luego:
```powershell
firebase deploy --only storage
```

### 3. Reglas Firestore ✅ (ya desplegadas)
```powershell
firebase deploy --only firestore:rules
```

### 4. Service account + usuarios
1. Firebase Console → ⚙ **Project settings** → **Service accounts** → **Generate new private key**
2. Guardar como `secrets/firebase-sa.json` (no subir a git)
3. PowerShell:
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\user\Desktop\AURORA\secrets\firebase-sa.json"
npm run firebase:provision
```
| Email | Rol | Contraseña demo |
|-------|-----|-----------------|
| `manager@postura.internal` | ADMIN | `Postura2026!` |
| `juan.vasquez@lexfirm.com` | CLIENT (Juan) | `Postura2026!` |

### 4. Probar
1. Login **manager** → si Firestore vacío, bootstrap automático del seed Juan
2. Login **Juan** (otra ventana/incógnito) → solo sus datos
3. Editar `localStorage` en DevTools → **no** debe cambiar lo que ves tras recargar

---

## Comportamiento actual (código)

- **Firestore = fuente de verdad** (no localStorage cuando Firebase activo)
- **Login solo Firebase** (sin fallback local)
- **Videos** → Firebase Storage si hay config; si no, IndexedDB
- **Primer ADMIN** en Firestore vacío → sube seed demo automáticamente

---

## Comandos útiles

| Comando | Para qué |
|---------|----------|
| `npm run dev` | Desarrollo local contra Firebase nube |
| `npm run check` | Tests + lint + types |
| `npm run firebase:provision` | Crear/actualizar usuarios + claims |
| `npm run firebase:deploy:rules` | Reglas Firestore + Storage |
| `npm run firebase:deploy:hosting` | Build + deploy web |
| `npm run firebase:deploy:functions` | RSS/Tavily proxy + ingesta programada |
| `npm run emulators` | Solo si quieres volver a emulador local |

---

## Si algo falla

| Error | Solución |
|-------|----------|
| Sin permisos POSTURA (custom claims) | `npm run firebase:provision` |
| Credenciales inválidas | Mismo script; usuario no existe en Auth |
| Permiso denegado Firestore | `npm run firebase:deploy:rules` |
| `Failed to resolve firebase/...` | `npm install` |
| Badge no aparece | Revisar `.env.local` y reiniciar `npm run dev` |

---

## Credenciales demo (local / provision)

- Manager: `manager@postura.internal` / `Postura2026!`
- Cliente Juan: `juan.vasquez@lexfirm.com` / `Postura2026!`

---

## Ingesta programada (Cloud Functions)

### Secretos (obligatorio, una vez)

Ejecuta **tú** estos comandos en PowerShell (el agente no puede subir API keys solo):

```powershell
cd C:\Users\user\Desktop\AURORA

# Pega la key cuando Firebase lo pida (o usa --data-file=ruta_a_archivo_con_la_key)
firebase functions:secrets:set TAVILY_API_KEY
firebase functions:secrets:set YOUTUBE_API_KEY
```

Si ya tienes las keys en `.env.local`:

```powershell
# Tavily (solo si está definida)
($m = Select-String -Path .env.local -Pattern '^TAVILY_API_KEY=(.+)$'); if ($m) { $m.Matches[0].Groups[1].Value | firebase functions:secrets:set TAVILY_API_KEY }

# YouTube
($m = Select-String -Path .env.local -Pattern '^YOUTUBE_API_KEY=(.+)$'); if ($m) { $m.Matches[0].Groups[1].Value | firebase functions:secrets:set YOUTUBE_API_KEY }
```

### Build + deploy

```powershell
cd C:\Users\user\Desktop\AURORA\functions
npm install
cd ..
npm run firebase:deploy:functions
firebase deploy --only firestore:indexes
```

### Frontend producción

En el build de hosting, define:

```text
VITE_POSTURA_FUNCTIONS_BASE=https://us-central1-aurora-postura-app.cloudfunctions.net
```

### Funciones desplegadas

| Función | Rol |
|---------|-----|
| `rssProxy` | Proxy RSS con SSRF |
| `tavilySearch` | Descubrimiento web (secret `TAVILY_API_KEY`) |
| `youtubeApi` | Resolve/search YouTube (secret `YOUTUBE_API_KEY`) |
| `ingestSourcesScheduled` | Ingesta cada 15 min |
| `ingestSourcesManual` | Disparo ADMIN |

Los clientes reciben señales nuevas vía listeners Firestore (`sources` + `signals`) al tener sesión abierta.

---

## Plan general

Oleadas **0–7** + radar (triage, clusters, feedback, gate por canal) en código.
Siguiente hito operativo: **secretos + deploy functions** (arriba) y recorrido piloto Juan.
