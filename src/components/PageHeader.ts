import { esc } from '../lib/escape';
import { icon } from '../lib/icons';
import { TAB_META } from '../ui/presentation/pageTabMeta';

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
