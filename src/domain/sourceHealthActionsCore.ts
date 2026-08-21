import type { Source } from '../types';
import type { SourceHealthSummary } from '../services/sourceHealth';

export type SourceRemediationAction = 'probe' | 'ingest' | 'pause' | 'resume' | 'archive';

export function sourceRemediationActions(
  source: Source,
  health: SourceHealthSummary
): SourceRemediationAction[] {
  const actions: SourceRemediationAction[] = [];
  if (source.url) actions.push('probe', 'ingest');
  if (source.status === 'PAUSED' || source.status === 'ERROR') {
    actions.push('resume');
  } else if (source.status === 'ACTIVE') {
    actions.push('pause');
  }
  if (source.status !== 'ARCHIVED') actions.push('archive');
  if (health.status === 'EMPTY' && !actions.includes('archive')) actions.push('archive');
  return actions;
}

export function sourceHealthTip(source: Source, health: SourceHealthSummary): string | null {
  if (source.status === 'PAUSED') {
    return 'Fuente pausada — no entra en ingesta automática hasta reactivarla.';
  }
  if (health.status === 'ERROR' || source.lastError) {
    return 'Prueba el feed; si responde bien, reactiva. Si no, pausa o archiva.';
  }
  if (health.status === 'EMPTY') {
    return 'Feed vacío o ilegible — revisa la URL o archiva la fuente.';
  }
  if (health.status === 'DEGRADED' && health.acceptRate === 0) {
    return 'Genera ruido (0% útil) — pausa para limpiar el radar.';
  }
  return null;
}

export function countUnhealthySources(
  sources: Source[],
  summarize: (source: Source) => SourceHealthSummary
): { errors: number; degraded: number; paused: number } {
  let errors = 0;
  let degraded = 0;
  let paused = 0;
  for (const source of sources) {
    if (source.status === 'PAUSED') paused += 1;
    const health = summarize(source);
    if (health.status === 'ERROR' || source.status === 'ERROR') errors += 1;
    else if (health.status === 'DEGRADED' || health.status === 'EMPTY') degraded += 1;
  }
  return { errors, degraded, paused };
}
