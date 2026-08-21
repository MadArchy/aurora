import { esc } from '../lib/escape';
import { icon } from '../lib/icons';

export function renderPageHeader(
  title: string,
  subtitle?: string,
  actionsHtml = '',
  eyebrow?: string
): string {
  return `
    <header class="page-header">
      <div class="page-header-text">
        ${eyebrow ? `<p class="page-eyebrow">${icon('zap', 12)}<span>${esc(eyebrow)}</span></p>` : ''}
        <h1 class="page-title">${esc(title)}</h1>
        ${subtitle ? `<p class="page-subtitle">${esc(subtitle)}</p>` : ''}
      </div>
      ${actionsHtml ? `<div class="page-header-actions">${actionsHtml}</div>` : ''}
    </header>
  `;
}

export interface TabMeta {
  title: string;
  subtitle: string;
}

/** Nivel 1: cartera del manager */
export const PORTFOLIO_TABS: Record<string, TabMeta> = {
  dashboard: {
    title: 'Hoy',
    subtitle: 'Tu cola de atención. El resto vive en Clientes o en el detalle plegable.',
  },
  clients: {
    title: 'Clientes',
    subtitle: 'Directorio de la cartera. Métricas calculadas en vivo desde señales, tareas y entregas.',
  },
  'ai-center': {
    title: 'IA y operación',
    subtitle: 'Sesión de claves, proveedor y observabilidad de corridas.',
  },
};

/** Nivel 2: espacio de trabajo de un cliente */
export const WORKSPACE_TABS: Record<string, TabMeta> = {
  'ws-briefing': {
    title: 'Resumen',
    subtitle: 'Una acción principal, contexto al lado y señales del dominio abajo.',
  },
  'ws-sources': {
    title: 'Fuentes',
    subtitle: 'Mantenimiento de orígenes, salud de ingesta y señales manuales.',
  },
  'ws-tasks': {
    title: 'Producción',
    subtitle: 'Trabajo editorial, tareas y estados de aprobación.',
  },
  'ws-radar': {
    title: 'Radar',
    subtitle: 'Decide qué información merece avanzar hacia una entrega.',
  },
  'ws-deliver': {
    title: 'Entregar',
    subtitle: 'Decide el destino de cada señal y ármale el briefing al cliente en un solo paso.',
  },
  'ws-positioning': {
    title: 'Identidad',
    subtitle: 'Tesis, dossier, perfil, evidencia y campañas del cliente.',
  },
  'ws-production': {
    title: 'Producción',
    subtitle: 'Contenido, papers y tareas en un único flujo editorial.',
  },
  'ws-results': {
    title: 'Resultados',
    subtitle: 'Métricas de lo publicado y evidencia generada.',
  },
};

/** Portal del cliente */
export const CLIENT_TABS: Record<string, TabMeta> = {
  'client-home': { title: 'Esta semana', subtitle: 'Tus próximas acciones, briefing y prioridades en un solo lugar.' },
  'client-feed': { title: 'Mis tareas', subtitle: 'Acciones preparadas por tu Brand Manager.' },
  'client-content': { title: 'Revisar', subtitle: 'Borradores pendientes y contenido aprobado.' },
  'client-opps': { title: 'Oportunidades', subtitle: 'Convocatorias alineadas a tu tesis.' },
  'client-profile': { title: 'Mi perfil', subtitle: 'Facts confirmados, CV y cobertura del perfil.' },
  'client-thesis': { title: 'Mi posicionamiento', subtitle: 'Tu perfil, tesis, evidencia y servicios en un solo lugar.' },
  'client-results': { title: 'Resultados', subtitle: 'Métricas de publicaciones y apariciones.' },
  'client-library': { title: 'Biblioteca', subtitle: 'Contenido aprobado listo para usar.' },
};

export const TAB_META: Record<string, TabMeta> = {
  ...PORTFOLIO_TABS,
  ...WORKSPACE_TABS,
  ...CLIENT_TABS,
};

export const PORTFOLIO_TAB_IDS = Object.keys(PORTFOLIO_TABS);
export const WORKSPACE_TAB_IDS = Object.keys(WORKSPACE_TABS);
export const CLIENT_TAB_IDS = Object.keys(CLIENT_TABS);

/** Pestañas retiradas que ahora viven fusionadas en otra vista. */
export const TAB_ALIASES: Record<string, string> = {
  'ws-curation': 'ws-deliver',
  'ws-delivery': 'ws-deliver',
  'ws-results': 'ws-briefing',
  'ws-tasks': 'ws-production',
  'client-feed': 'client-home',
  'client-profile': 'client-thesis',
  'client-library': 'client-content',
};

export function normalizeTab(tab: string): string {
  return TAB_ALIASES[tab] || tab;
}

export function isWorkspaceTab(tab: string): boolean {
  return WORKSPACE_TAB_IDS.includes(normalizeTab(tab));
}

export function isPortfolioTab(tab: string): boolean {
  return PORTFOLIO_TAB_IDS.includes(tab);
}

/** Envuelve el cuerpo de una vista con su encabezado de página. */
export function renderPage(tab: string, body: string, actionsHtml = ''): string {
  const meta = TAB_META[tab] || { title: 'POSTURA', subtitle: '' };
  return `
    <div class="page-content">
      ${renderPageHeader(meta.title, meta.subtitle, actionsHtml)}
      ${body}
    </div>
  `;
}
