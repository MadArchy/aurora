/**
 * Iconos SVG inline (trazo, 24x24, heredan currentColor).
 * Se inyectan como string en las plantillas para no añadir dependencias.
 */

const PATHS: Record<string, string> = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  users: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7" r="3.5"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.87"/><path d="M16 3.6a3.5 3.5 0 0 1 0 6.8"/>',
  sparkles: '<path d="M12 3l1.7 4.8L18.5 9.5l-4.8 1.7L12 16l-1.7-4.8L5.5 9.5l4.8-1.7z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3h6v1"/><path d="M9 10h6"/><path d="M9 14h6"/><path d="M9 18h3"/>',
  rss: '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 5a15 15 0 0 1 15 15"/><circle cx="5" cy="19" r="1.6"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l6.4-6.4"/><circle cx="12" cy="12" r="1"/>',
  filter: '<path d="M4 5h16l-6.2 7.6V20l-3.6-2.2v-5.2z"/>',
  send: '<path d="M21 4 3 11l7 2.6L12.6 21z"/><path d="M21 4 10 13.6"/>',
  check: '<path d="M4.5 12.5l4.5 4.5L19.5 6.5"/>',
  checkSquare: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 12.2l2.8 2.8L16.4 9.4"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  film: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M8 4.5v15"/><path d="M16 4.5v15"/><path d="M3 12h18"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7.5" y="12" width="3" height="5" rx="1"/><rect x="13" y="8" width="3" height="9" rx="1"/>',
  fileText: '<path d="M14 3.5H7.5A2 2 0 0 0 5.5 5.5v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z"/><path d="M14 3.5V8h4.5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12.5" rx="2.5"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5z"/><path d="M4 17h15"/>',
  bell: '<path d="M18 15.5V11a6 6 0 0 0-12 0v4.5L4.5 18h15z"/><path d="M10 21h4"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
  logout: '<path d="M15 4.5h2.5A2 2 0 0 1 19.5 6.5v11a2 2 0 0 1-2 2H15"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h9"/>',
  arrowLeft: '<path d="M11 6l-6 6 6 6"/><path d="M5 12h14"/>',
  chevronDown: '<path d="M6 9.5l6 6 6-6"/>',
  menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  x: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="2.5"/><path d="M8 3.5v4M16 3.5v4"/><path d="M3.5 10.5h17"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  zap: '<path d="M13.5 3 5.5 13.5H11l-.5 7.5 8-10.5H13z"/>',
  trend: '<path d="M3.5 17 9 11l3.5 3.5L20.5 6"/><path d="M15.5 6h5v5"/>',
  inbox: '<path d="M3.5 12.5 6 5.5h12l2.5 7"/><path d="M3.5 12.5h5l1.2 2.5h4.6l1.2-2.5h5v5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  shield: '<path d="M12 3.5 5 6v6c0 4.2 2.9 7.4 7 8.5 4.1-1.1 7-4.3 7-8.5V6z"/><path d="M9.2 12.2l2 2 3.6-3.8"/>',
};

export type IconName = keyof typeof PATHS | string;

export function icon(name: IconName, size = 18, className = ''): string {
  const body = PATHS[name as string];
  if (!body) return '';
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
