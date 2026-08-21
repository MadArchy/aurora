# Contribuir

## Antes de un PR

```bash
npm run check
```

## Convenciones

- **Dominio** en `src/domain/` + test en `tests/*.test.ts`.
- **UI** en `src/components/`; no duplicar reglas de negocio en el HTML.
- **Secretos** solo en `.env.local` / Secret Manager; nunca `VITE_` para Tavily/YouTube.
- Documentación nueva en `docs/`, no en la raíz.

## Commits

Mensajes cortos en inglés o español, tipo `feat:`, `fix:`, `docs:`, `chore:`.
