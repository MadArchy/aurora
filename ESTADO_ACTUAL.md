# Estado actual del proyecto — 19 ago 2026

Nota de continuidad. **Plan piloto multiusuario implementado** (Fases 1–6).

---

## Resumen ejecutivo

El MVP local quedó endurecido para piloto: autorización segura, XSS mitigado, aislamiento
por `clientId`, API con SSRF/DNS/rate-limit, red de tests + CI, coherencia UX del portal
cliente, scaffolding Firebase y primer refactor de controladores/observabilidad.

**Verificación:** `npm run check` y `npm run build` pasan (typecheck frontend + server, ESLint, 12 tests Vitest).

---

## Fase 1 — Seguridad crítica ✅

- **Auth** (`src/services/auth.ts`): sesión reconstruida desde cuenta; impersonación con contexto explícito; `returnToManager()` solo si impersonando; no eleva rol desde localStorage.
- **AppShell**: botón “Volver al cockpit” solo con `isImpersonating()`.
- **XSS**: `esc` / `escAttr` / `nl2br` / `safeHref` en portal, modales, onboarding y editor de tesis.
- **DB**: `getSignalsByClient` igualdad estricta; `addSignal` exige `clientId`; migración de señales huérfanas.
- **Notificaciones**: `notifyClient()` sin fallback a Juan; bandeja con deep-links (`renderNotificationsPanel`).
- **Editor**: clientes ven vista solo lectura (`content-preview`); managers usan `content-editor`.

---

## Fase 2 — API / SSRF ✅

- **`server/ssrf.ts`**: hostname normalizado, IPv4/IPv6 privadas, `.localhost`, DNS pre-conexión.
- **`server/postura-api.ts`**: límite de cuerpo RSS en streaming; revalidación por redirect; origin loopback en `/api/ai/*`; rate limit por sesión; allowlist de modelos; validación JSON de respuesta IA.
- **`vite.config.ts`**: servidor atado a `127.0.0.1`.
- **`tsconfig.server.json`**: typecheck del servidor incluido en `npm run typecheck`.

---

## Fase 3 — Tests y CI ✅

- Vitest + ESLint + scripts `test`, `lint`, `typecheck`, `check`.
- Tests: auth (restauración de rol), scoring bilingüe, `gateItem`, SSRF, máquina de estados.
- **CI:** `.github/workflows/ci.yml` ejecuta `npm run check` + build.

---

## Fase 4 — Coherencia producto / UX ✅

- Scoring centralizado en `scoreSignal()` con contexto bilingüe del dossier.
- **ClientPortal**: tesis ausente sin crash, tareas/deadlines reales, Contenido vs Biblioteca, empty states.
- **Onboarding**: persiste `displayName` en paso 1; flag `mustCompleteOnboarding` limpiado al completar/saltar.
- **Inbox** de notificaciones operativo.
- **Google News**: `gateItem` exige match mínimo de perfil aun en feeds de consulta.
- **Estados canónicos**: `src/domain/stateMachine.ts` + validación en `db.ts` (señales, tareas, entregas vacías bloqueadas).

---

## Fase 5 — Firebase (scaffolding piloto) ✅

- `firebase.json`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`
- `src/firebase/config.ts` — config vía `VITE_FIREBASE_*`
- Repositorios: `src/services/repositories/*` (adaptador local + punto de extensión Firestore)
- Importador: `src/services/firebase/importLocalV5.ts`
- **Cloud Functions** skeleton: `functions/src/index.ts` (`aiComplete`, `rssProxy`) — listo para Auth + Secret Manager en despliegue

---

## Fase 6 — Refactor y observabilidad ✅ (inicio)

- **`src/controllers/sessionController.ts`**: sesión, logout, bandeja de avisos extraídos de `main.ts`.
- **`src/services/metrics.ts`**: eventos de ingesta (`ingest_source_poll`) sin datos sensibles.
- Pendiente evolutivo (post-piloto inmediato): extraer radar/curación/entrega a controladores dedicados; parser RSS XML con fixtures; import Firestore en caliente.

---

## Cómo retomar

```bash
npm run dev
```

Abrir `http://127.0.0.1:3000/`

Credenciales demo: `manager@postura.internal` / `Postura2026!`

Comandos de calidad:

```bash
npm run check    # typecheck + lint + tests
npm run build    # producción
```

---

## Archivos clave añadidos o modificados (plan piloto)

| Área | Archivos |
|------|----------|
| Seguridad | `src/services/auth.ts`, `src/lib/escape.ts`, componentes UI |
| API | `server/ssrf.ts`, `server/postura-api.ts`, `vite.config.ts` |
| Tests | `tests/*.test.ts`, `vitest.config.ts`, `eslint.config.js` |
| Dominio | `src/domain/stateMachine.ts`, `src/services/ingestFilter.ts` |
| Firebase | `firebase.json`, reglas, `src/firebase/config.ts`, `functions/` |
| Refactor | `src/controllers/sessionController.ts`, `src/services/metrics.ts` |
