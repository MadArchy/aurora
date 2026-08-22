import type { ContentFormat, ContentPillar, BusinessKpiType } from '../types';

export const FORMAT_LABELS: Record<ContentFormat, string> = {
  viewpoint: 'Punto de vista',
  checklist: 'Checklist',
  myth_reality: 'Mito / realidad',
  mini_case: 'Mini-caso',
  framework: 'Marco',
  legal_update: 'Actualización legal',
  patent_lesson: 'Lección PI',
  contrarian: 'Contrarian',
  builder_lesson: 'Lección builder',
  offer: 'Oferta',
  video_long: 'Video largo',
  video_short: 'Clip corto',
  article: 'Artículo',
};

export const PILLAR_LABELS: Record<ContentPillar, string> = {
  ai_adoption: 'Adopción IA',
  ai_governance: 'Gobernanza IA',
  ai_ip: 'IA + PI',
  patents_opinion: 'Patentes / opinión',
  legal_ai_practice: 'IA en práctica legal',
  security_technical: 'Seguridad técnica',
  builder_operator: 'Builder / operador',
};

/** KPIs alineados al plan de marketing §11.3 */
export const KPI_LABELS: Record<BusinessKpiType, string> = {
  linkedin_profile_views: 'Visitas perfil LinkedIn',
  target_connection_requests: 'Solicitudes conexión (target)',
  decision_maker_comments: 'Comentarios decision makers',
  website_visits_from_linkedin: 'Visitas web desde LinkedIn',
  consultation_requests: 'Solicitudes de consulta',
  referral_conversations: 'Conversaciones por referido',
  service_specific_inquiries: 'Consultas por servicio',
  publications_completed: 'Publicaciones completadas',
  custom: 'Personalizado',
};

export function kpiLabel(kpiType?: BusinessKpiType): string {
  if (!kpiType) return '';
  return KPI_LABELS[kpiType] || kpiType;
}

export function renderTaskMetaBadges(task: {
  type?: import('../types').TaskType;
  format?: ContentFormat;
  pillar?: ContentPillar;
  campaignDay?: number;
}): string {
  const parts: string[] = [];
  if (task.type === 'RECORD_VIDEO') {
    parts.push('<span class="badge badge-accent">YouTube / LinkedIn</span>');
  } else if (task.type === 'REVIEW_ARTICLE') {
    parts.push('<span class="badge badge-accent">LinkedIn / Web</span>');
  }
  if (task.format) parts.push(`<span class="badge badge-progress">${FORMAT_LABELS[task.format]}</span>`);
  if (task.pillar) parts.push(`<span class="badge badge-neutral">${PILLAR_LABELS[task.pillar]}</span>`);
  if (task.campaignDay) parts.push(`<span class="badge badge-ready">Día ${task.campaignDay}</span>`);
  if (!parts.length) return '';
  return `<div class="task-meta-badges">${parts.join('')}</div>`;
}
