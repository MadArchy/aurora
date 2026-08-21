/**
 * Recorrido piloto Juan — DoD §7 (docs/product/plan-unificado.md).
 * Uso: node scripts/pilot-juan-walkthrough.mjs
 *      npm run checklist:pilot
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

function fileHas(path, pattern) {
  if (!existsSync(resolve(root, path))) return false;
  const text = readFileSync(resolve(root, path), 'utf8');
  return pattern.test(text);
}

const autoChecks = [
  { ok: existsSync(resolve(root, 'src/components/ClientPortal.ts')), label: 'Portal cliente' },
  { ok: fileHas('src/data/juanCampaignSeed.ts', /CAMP_ADOPTION/), label: 'Seed campaña Adopción IA' },
  { ok: fileHas('src/data/juanCampaignSeed.ts', /CAMP_PATENTS/), label: 'Seed campaña PI/Patentes' },
  { ok: fileHas('src/data/juanCampaignSeed.ts', /consultation_requests/), label: 'Seed KPI consultas' },
  { ok: fileHas('src/services/db.ts', /opp_cle_001/), label: 'Seed oportunidad CLE' },
  { ok: fileHas('src/components/KpiWeeklyChart.ts', /renderKpiHomeDashboard/), label: 'Dashboard KPI en home' },
  { ok: fileHas('src/domain/clientIsolationCore.ts', /canAccessClientResource/), label: 'Reglas aislamiento clientId' },
  { ok: fileHas('firestore.rules', /ownsClient/), label: 'Reglas Firestore ownsClient' },
  { ok: fileHas('tests/auth.test.ts', /tampered session/), label: 'Test anti-elevación sesión' },
];

console.log('\nPOSTURA — Recorrido piloto Juan (DoD §7)\n');
console.log('Comprobaciones automáticas en código:\n');
for (const c of autoChecks) {
  console.log(`${c.ok ? '[OK]' : '[ ]'} ${c.label}`);
}

const allAuto = autoChecks.every((c) => c.ok);

console.log(`
Manual — ejecutar con npm run dev → http://127.0.0.1:3000/

Credenciales:
  Manager: manager@postura.internal / Postura2026!
  Juan:    juan.vasquez@lexfirm.com / Postura2026!

1. LUNES — LinkedIn
   [ ] Login Juan → Inicio → tarjeta «Post LinkedIn de la semana»
   [ ] Editar borrador o Aprobar sin cambios

2. JUEVES — Video
   [ ] Juan → Mis tareas → Teleprompter → grabar → enviar
   [ ] Manager → Juan → Tareas → ver / descargar / re-subir video (storage:)

3. OPORTUNIDAD CLE
   [ ] Juan → Inicio → CLE destacada → Aceptar
   [ ] Completar checklist → Marcar postulación enviada
   [ ] (Opcional) Recargar → recordatorio si deadline ≤3 días

4. KPIs
   [ ] Juan → Inicio → dashboard semanal visible
   [ ] Registrar +1 consulta → gráfico actualizado

5. CAMPAÑA
   [ ] Selector topbar: Adopción IA ↔ PI/Patentes
   [ ] Tareas y contenido cambian al alternar

6. SEGURIDAD
   [ ] Ventana incógnito: otro cliente no existe en demo local
   [ ] DevTools: postura_session_v4 role=ADMIN no eleva a Juan tras reload
   [ ] Firebase: reglas ownsClient desplegadas (npm run firebase:deploy:rules)

7. CALIDAD
   [ ] npm run check — verde

Bloqueado (requiere Blaze):
   [ ] firebase functions:secrets:set TAVILY_API_KEY / YOUTUBE_API_KEY
   [ ] npm run firebase:deploy:functions

${allAuto ? 'Auto-checks: OK — listo para recorrido manual.' : 'Auto-checks: faltan ítems — revisar código antes del piloto.'}
`);

process.exit(allAuto ? 0 : 1);
