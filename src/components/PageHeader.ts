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
    title: 'Inicio',
    subtitle: 'Qué requiere tu atención hoy, cliente por cliente.',
  },
  clients: {
    title: 'Clientes',
    subtitle: 'Cartera completa. Entra a un cliente para trabajar su posicionamiento.',
  },
  'ai-center': {
    title: 'Centro de IA',
    subtitle: 'Sesión de claves, proveedor y observabilidad de corridas.',
  },
};

/** Nivel 2: espacio de trabajo de un cliente */
export const WORKSPACE_TABS: Record<string, TabMeta> = {
  'ws-briefing': {
    title: 'Resumen',
    subtitle: 'Lo que el sistema trae hoy para este cliente y el diagnóstico de su imagen.',
  },
  'ws-sources': {
    title: 'Fuentes',
    subtitle: 'Orígenes de información para este cliente: ingesta automática y señales manuales según su perfil.',
  },
  'ws-tasks': {
    title: 'Tareas',
    subtitle: 'Asigna acciones concretas al cliente. Aparecen en su portal al instante.',
  },
  'ws-radar': {
    title: 'Radar',
    subtitle: 'Noticias, tendencias y señales puntuadas contra la tesis del cliente.',
  },
  'ws-deliver': {
    title: 'Entregar',
    subtitle: 'Decide el destino de cada señal y ármale el briefing al cliente en un solo paso.',
  },
  'ws-positioning': {
    title: 'Posicionamiento',
    subtitle: 'Tesis, perfil maestro, campañas y evidence vault.',
  },
  'ws-production': {
    title: 'Producción',
    subtitle: 'Pipeline editorial y estados de aprobación.',
  },
  'ws-results': {
    title: 'Resultados',
    subtitle: 'Métricas de lo publicado y evidencia generada.',
  },
};

/** Portal del cliente */
export const CLIENT_TABS: Record<string, TabMeta> = {
  'client-home': { title: 'Inicio', subtitle: 'Tu briefing más reciente y próximas acciones.' },
  'client-feed': { title: 'Mis tareas', subtitle: 'Acciones preparadas por tu Brand Manager.' },
  'client-content': { title: 'Contenido', subtitle: 'Borradores y material en revisión.' },
  'client-opps': { title: 'Oportunidades', subtitle: 'Convocatorias alineadas a tu tesis.' },
  'client-profile': { title: 'Mi perfil', subtitle: 'Facts confirmados, CV y cobertura del perfil.' },
  'client-thesis': { title: 'Posicionamiento', subtitle: 'Tu tesis activa, muro de pruebas y servicios.' },
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

/** Sección a la que pertenece cada pestaña, para el eyebrow del encabezado. */
function sectionLabel(tab: string): string {
  if (CLIENT_TAB_IDS.includes(tab)) return 'Mi espacio';
  if (WORKSPACE_TAB_IDS.includes(tab)) return 'Espacio de cliente';
  return 'Cartera';
}

/** Envuelve el cuerpo de una vista con su encabezado de página. */
export function renderPage(tab: string, body: string, actionsHtml = ''): string {
  const meta = TAB_META[tab] || { title: 'POSTURA', subtitle: '' };
  return `
    <div class="page-content">
      ${renderPageHeader(meta.title, meta.subtitle, actionsHtml, sectionLabel(tab))}
      ${body}
    </div>
  `;
}
