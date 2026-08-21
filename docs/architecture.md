# Arquitectura (mapa del código)

POSTURA es una SPA TypeScript. El orquestador de UI está en `src/main.ts`; las reglas de negocio van a `src/domain/` y se cubren con tests.

```
src/
  components/     UI (manager, portal cliente, modales)
  controllers/    Bindings de sesión / notificaciones
  data/           Seeds piloto (Juan)
  domain/         Lógica pura (entrega, ingesta, scoring, aislamiento)
  firebase/       App, Auth, claims
  lib/            Utilidades (escape, ids, iconos)
  services/       db, auth, APIs de fuentes, Firestore sync
  styles/
  types/

server/           Plugin Vite: /api/rss, /api/tavily, /api/youtube, /api/ai
functions/        Proxies cloud (Bearer ADMIN) + ingesta programada
tests/            Vitest (dominio + auth + SSRF)
```

## Flujos críticos

1. **Fuentes** — `sourceApi` → proxy local o Cloud Functions → `ingestFilter` / `ingestGateCore` → señales.
2. **Entrega** — curación → `DeliveryPackage` DRAFT → preview → materializar → SENT → ack cliente.
3. **Auth** — Firebase custom claims `ADMIN` \| `CLIENT` + `clientId`; modo local sin `VITE_FIREBASE_*`.

## Persistencia

- Sin Firebase: `localStorage` v5 (`db.ts`).
- Con Firebase: hidratación + push debounce + listeners por cliente (`services/firestore/`).

## No hacer en producción estática

GitHub Pages y Firebase Hosting **no** incluyen el proxy Vite. Ingesta RSS/Tavily/YouTube requiere `npm run dev` o `VITE_POSTURA_FUNCTIONS_BASE` + Functions desplegadas.
