import type {
  Campaign,
  CampaignMilestone,
  ContentItem,
  EvidenceVaultItem,
  PositioningThesis,
  ResultRecord,
  Task,
} from '../types';

export const JUAN_ID = 'client_juan_001';
export const ORG_ID = 'org_aurora_01';
export const THESIS_ADOPTION = 'thesis_juan_ip_ai_adoption';
export const THESIS_PATENTS = 'thesis_juan_ip_patents';
export const CAMP_ADOPTION = 'camp_juan_adoption_30d';
export const CAMP_PATENTS = 'camp_juan_patents_q3';

const PLAN_30_DAYS: Array<{ day: number; title: string; description: string; weekday?: string }> = [
  { day: 1, title: 'Frase de posicionamiento + titular LinkedIn', description: 'Finalizar positioning line y headline.', weekday: 'Lun' },
  { day: 2, title: 'Reescribir sección Acerca de LinkedIn', description: 'About con marco People/Tools/Rules.', weekday: 'Mar' },
  { day: 3, title: 'Actualizar Destacados LinkedIn', description: 'Libro, 3ITAL, evaluación IA, artículos.', weekday: 'Mié' },
  { day: 4, title: 'Reescribir Experience en LinkedIn', description: 'Whitaker Chalk, 3ITAL, BAIRD con valor al cliente.', weekday: 'Jue' },
  { day: 5, title: 'Borrador hero web + página Adopción IA', description: 'Copy de conversión para sitio.', weekday: 'Vie' },
  { day: 6, title: 'Borrador página Evaluación Postura IA', description: 'Landing principal de conversión.', weekday: 'Lun' },
  { day: 7, title: 'Borrador páginas Patentes/PI y Opiniones', description: 'Vía de práctica A.', weekday: 'Mar' },
  { day: 8, title: 'Recopilar assets muro de pruebas', description: 'Fotos, logos, enlaces §5.3.', weekday: 'Mié' },
  { day: 9, title: 'Esquema artículo estrella', description: 'La gobernanza de IA no es suficiente.', weekday: 'Jue' },
  { day: 10, title: 'Borrador artículo estrella', description: 'Artículo largo LinkedIn/web.', weekday: 'Vie' },
  { day: 11, title: 'Editar artículo + 3 posts de apoyo', description: 'Publicaciones derivadas.', weekday: 'Lun' },
  { day: 12, title: 'Publicar post LinkedIn #1', description: 'Posicionamiento — gobernanza insuficiente.', weekday: 'Mar' },
  { day: 13, title: 'Publicar post LinkedIn #2', description: 'Checklist GC antes de aprobar herramientas IA.', weekday: 'Mié' },
  { day: 14, title: 'Publicar post LinkedIn #3', description: 'Adopción IA como problema de PI.', weekday: 'Jue' },
  { day: 15, title: 'Guion primer video 8–10 min', description: 'Los tres pilares de adopción IA.', weekday: 'Vie' },
  { day: 16, title: 'Grabar primer video', description: 'Teleprompter — video educativo.', weekday: 'Lun' },
  { day: 17, title: 'Editar primer video', description: 'Limpieza ligera.', weekday: 'Mar' },
  { day: 18, title: 'Crear clips y captions', description: '3–5 clips cortos.', weekday: 'Mié' },
  { day: 19, title: 'Publicar video en YouTube', description: 'Biblioteca de autoridad.', weekday: 'Jue' },
  { day: 20, title: 'Publicar clip #1 en LinkedIn', description: 'Fragmento 60–120s.', weekday: 'Vie' },
  { day: 21, title: 'Publicar clip en Instagram/Facebook', description: 'Reutilización.', weekday: 'Lun' },
  { day: 22, title: 'Borrador oferta preparación IA', description: 'Post + landing evaluación.', weekday: 'Mar' },
  { day: 23, title: 'Borrador post patentes/FTO', description: 'Opinion work angle.', weekday: 'Mié' },
  { day: 24, title: 'Publicar post preparación IA', description: 'Oferta producto evaluación.', weekday: 'Jue' },
  { day: 25, title: 'Publicar post patentes/FTO', description: 'Vía PI.', weekday: 'Vie' },
  { day: 26, title: 'PDF Servicios Adopción IA', description: 'One-pager descargable.', weekday: 'Lun' },
  { day: 27, title: 'PDF Servicios Patentes y Opinión', description: 'One-pager descargable.', weekday: 'Mar' },
  { day: 28, title: 'Revisar analíticas y engagement', description: 'KPIs semana 4.', weekday: 'Mié' },
  { day: 29, title: 'Identificar 20 contactos objetivo', description: 'Outreach no comercial.', weekday: 'Jue' },
  { day: 30, title: 'Mensaje de reconexión reflexivo', description: 'Nuevo posicionamiento.', weekday: 'Vie' },
];

const VIDEO_TOPICS = [
  'La gobernanza de IA no es suficiente: por qué las organizaciones necesitan adopción de IA',
  'Los tres pilares de la adopción de IA: educación, tecnología y gobernanza',
  '¿Qué debería preguntar el GC antes de aprobar herramientas de IA?',
  'El riesgo legal de la IA en la sombra en el lugar de trabajo',
  'Las políticas de IA fallan cuando no están conectadas a flujos de trabajo reales',
  'Cómo la adopción de IA cambia la estrategia de patentes y propiedad intelectual',
  'Lo que las startups de IA deben saber sobre patentes antes de lanzarse',
  'NIST AI RMF e ISO/IEC 42001 en lenguaje sencillo',
  'Secreto profesional, confidencialidad y herramientas de IA',
  'Por qué importan los controles técnicos en la gobernanza de IA',
];

const LINKEDIN_POSTS = [
  {
    title: 'Post: La gobernanza de IA no es suficiente',
    format: 'viewpoint' as const,
    pillar: 'ai_adoption' as const,
    body: 'Una póliza no dice qué herramientas usan realmente las personas. La adopción de IA requiere People, Tools y Rules.',
  },
  {
    title: 'Post: Checklist del General Counsel',
    format: 'checklist' as const,
    pillar: 'ai_governance' as const,
    body: 'Siete preguntas antes de aprobar una herramienta de IA: datos, entrenamiento, propiedad del output, confidencialidad…',
  },
  {
    title: 'Post: Adopción IA y propiedad intelectual',
    format: 'viewpoint' as const,
    pillar: 'ai_ip' as const,
    body: 'Cuando una empresa usa IA en I+D, afecta propiedad, invención, secretos comerciales y estrategia de patentes.',
  },
  {
    title: 'Post: Libertad para operar en empresas de IA',
    format: 'patent_lesson' as const,
    pillar: 'patents_opinion' as const,
    body: 'Lanzar sin entender riesgo de patente crea problemas evitables. Una opinión FTO es herramienta de decisión.',
  },
  {
    title: 'Post: Preparación IA basada en evidencia',
    format: 'offer' as const,
    pillar: 'ai_governance' as const,
    body: 'La mejor pregunta del liderazgo: ¿podemos mostrar cómo se adopta, gestiona y mejora la IA realmente?',
  },
];

export function buildJuanSecondThesis(): PositioningThesis {
  return {
    id: THESIS_PATENTS,
    organizationId: ORG_ID,
    clientId: JUAN_ID,
    title: 'Estrategia de Patentes, PI y Opiniones Técnicas',
    expertIdentity:
      'Registered Patent Attorney e ingeniero eléctrico — estrategia de patentes, FTO, patentabilidad y portafolios para software, IA, dispositivos médicos y tecnología emergente',
    targetAudience: 'Fundadores, CTOs, equipos de I+D, IP counsel y startups en fase de producto o fundraising',
    secondaryAudience: 'General Counsel evaluando riesgo de infracción antes de lanzamiento o inversión',
    domain:
      'Patent strategy, prosecution, patentability opinions, freedom-to-operate, non-infringement, invalidity, carteras de PI para startups, IA en I+D',
    objective:
      'Desarrollar práctica de patentes y opiniones técnicas vinculada a hojas de ruta de producto, fundraising y diseño-around',
    proofPoints: [
      'Registered Patent Attorney — Whitaker Chalk (desde may 2022)',
      'B.S.E.E. UT Austin — credibilidad técnica en software, IA y dispositivos médicos',
      'Experiencia DoD/USAF ciberseguridad — riesgo operativo real',
      'Coautor AI in Patent Practice (2024)',
    ],
    differentiator:
      'Combina ingeniería, ciberseguridad y derecho de patentes: no solo redacta, entiende el sistema técnico.',
    voiceAndTone: 'Preciso, orientado a decisión de negocio, sin hype.',
    complianceRules: 'No prometer resultados de patentes; USPTO + State Bar Texas.',
    status: 'ACTIVE',
    clientApprovalStatus: 'APPROVED',
    createdAt: '2026-08-02T10:00:00Z',
    createdBy: 'user_admin_01',
    updatedAt: '2026-08-18T10:00:00Z',
    updatedBy: 'user_admin_01',
  };
}

export function buildJuanCampaigns(): Campaign[] {
  return [
    {
      id: CAMP_ADOPTION,
      organizationId: ORG_ID,
      clientId: JUAN_ID,
      thesisId: THESIS_ADOPTION,
      name: 'Plan 30 días: Adopción IA + Liderazgo de pensamiento',
      description: 'Ejecución del plan de marketing — reposicionamiento, contenido y primer video.',
      status: 'ACTIVE',
      startDate: '2026-08-01',
      endDate: '2026-08-30',
      targetDeliverables: 30,
      completedDeliverables: 13,
      tags: ['30-day-plan', 'AI Adoption', 'LinkedIn', 'YouTube'],
      planDays: 30,
      createdAt: '2026-08-01T10:00:00Z',
      createdBy: 'user_admin_01',
      updatedAt: '2026-08-20T12:00:00Z',
    },
    {
      id: CAMP_PATENTS,
      organizationId: ORG_ID,
      clientId: JUAN_ID,
      thesisId: THESIS_PATENTS,
      name: 'Q3: PI, patentes y opiniones técnicas',
      description: 'Contenido y oportunidades para la vía de práctica de patentes y FTO.',
      status: 'ACTIVE',
      startDate: '2026-08-01',
      endDate: '2026-10-31',
      targetDeliverables: 12,
      completedDeliverables: 2,
      tags: ['Patentes', 'FTO', 'Startups'],
      createdAt: '2026-08-01T10:00:00Z',
      createdBy: 'user_admin_01',
      updatedAt: '2026-08-18T14:00:00Z',
    },
  ];
}

export function buildJuanMilestones(campaignId: string = CAMP_ADOPTION): CampaignMilestone[] {
  const today = new Date('2026-08-20T12:00:00Z');
  return PLAN_30_DAYS.map((entry) => {
    let status: CampaignMilestone['status'] = 'pending';
    if (entry.day < 14) status = 'completed';
    else if (entry.day <= 20) status = 'in_progress';
    if (entry.day === 20 && today.getDate() >= 20) status = 'in_progress';

    return {
      id: `ms_${campaignId}_d${entry.day}`,
      organizationId: ORG_ID,
      clientId: JUAN_ID,
      campaignId,
      dayNumber: entry.day,
      title: entry.title,
      description: entry.description,
      weekdayHint: entry.weekday,
      status,
      completedAt: status === 'completed' ? '2026-08-14T18:00:00Z' : undefined,
    };
  });
}

export function buildJuanProofWallExtras(): EvidenceVaultItem[] {
  return [
    {
      id: 'ev_juan_speaker',
      organizationId: ORG_ID,
      clientId: JUAN_ID,
      title: 'Hoja de ponente / oratoria',
      type: 'MEDIA',
      snippet: 'Bio corta, temas: adopción IA, PI, NIST AI RMF, patentes en startups. Pendiente: foto evento reciente.',
      confidenceScore: 70,
      verified: false,
      associatedThesesIds: [THESIS_ADOPTION, THESIS_PATENTS],
      createdAt: '2026-08-20T10:00:00Z',
    },
    {
      id: 'ev_juan_3ital_logo',
      organizationId: ORG_ID,
      clientId: JUAN_ID,
      title: '3ITAL — logo y descripción para Destacados',
      type: 'MEDIA',
      sourceUrl: 'https://3ital.org',
      snippet: 'International Institute for Intelligent Technology Adoption in the Law. President of the Board.',
      confidenceScore: 90,
      verified: true,
      verifiedAt: '2026-08-20T10:00:00Z',
      associatedThesesIds: [THESIS_ADOPTION],
      createdAt: '2026-08-20T10:00:00Z',
    },
    {
      id: 'ev_juan_services_ai',
      organizationId: ORG_ID,
      clientId: JUAN_ID,
      title: 'One-pager Servicios Adopción IA (borrador)',
      type: 'DOCUMENT',
      snippet: 'Evaluación postura/preparación, gobernanza, políticas, asesoría continua. PDF pendiente día 26.',
      confidenceScore: 60,
      verified: false,
      associatedThesesIds: [THESIS_ADOPTION],
      createdAt: '2026-08-20T10:00:00Z',
    },
    {
      id: 'ev_juan_services_ip',
      organizationId: ORG_ID,
      clientId: JUAN_ID,
      title: 'One-pager Servicios Patentes y Opinión (borrador)',
      type: 'DOCUMENT',
      snippet: 'Patent strategy, FTO, patentability, carteras startup. PDF pendiente día 27.',
      confidenceScore: 60,
      verified: false,
      associatedThesesIds: [THESIS_PATENTS],
      createdAt: '2026-08-20T10:00:00Z',
    },
  ];
}

export function buildJuanKpiSeeds(): ResultRecord[] {
  return [
    {
      id: 'res_kpi_li_w1',
      organizationId: ORG_ID,
      clientId: JUAN_ID,
      title: 'Vistas de perfil LinkedIn',
      channel: 'LinkedIn',
      metricLabel: 'Vistas semanales',
      metricValue: 620,
      kpiType: 'linkedin_profile_views',
      notes: 'Semana del 2026-08-04',
      addedToEvidence: false,
      createdAt: '2026-08-10T09:00:00Z',
      createdBy: 'user_client_juan_01',
    },
    {
      id: 'res_kpi_li_w2',
      organizationId: ORG_ID,
      clientId: JUAN_ID,
      title: 'Vistas de perfil LinkedIn',
      channel: 'LinkedIn',
      metricLabel: 'Vistas semanales',
      metricValue: 710,
      kpiType: 'linkedin_profile_views',
      notes: 'Semana del 2026-08-11',
      addedToEvidence: false,
      createdAt: '2026-08-17T09:00:00Z',
      createdBy: 'user_client_juan_01',
    },
    {
      id: 'res_kpi_li_views',
      organizationId: ORG_ID,
      clientId: JUAN_ID,
      title: 'Vistas de perfil LinkedIn',
      channel: 'LinkedIn',
      metricLabel: 'Vistas semanales',
      metricValue: 842,
      kpiType: 'linkedin_profile_views',
      notes: 'Semana del 2026-08-18',
      addedToEvidence: false,
      createdAt: '2026-08-20T09:00:00Z',
      createdBy: 'user_client_juan_01',
    },
    {
      id: 'res_kpi_web',
      organizationId: ORG_ID,
      clientId: JUAN_ID,
      title: 'Visitas web desde LinkedIn',
      channel: 'Website',
      metricLabel: 'Sesiones',
      metricValue: 48,
      kpiType: 'website_visits_from_linkedin',
      notes: 'Semana del 2026-08-18',
      addedToEvidence: false,
      createdAt: '2026-08-20T10:00:00Z',
      createdBy: 'user_client_juan_01',
    },
    {
      id: 'res_kpi_consult_1',
      organizationId: ORG_ID,
      clientId: JUAN_ID,
      title: 'Consulta: evaluación AI Posture',
      channel: 'LinkedIn',
      metricLabel: 'Consultas recibidas',
      metricValue: 1,
      kpiType: 'consultation_requests',
      notes: 'Evaluación IA para GC',
      addedToEvidence: false,
      createdAt: '2026-08-19T09:00:00Z',
      createdBy: 'user_client_juan_01',
    },
    {
      id: 'res_kpi_consult_2',
      organizationId: ORG_ID,
      clientId: JUAN_ID,
      title: 'Consulta: estrategia patentes startup',
      channel: 'Web',
      metricLabel: 'Consultas recibidas',
      metricValue: 1,
      kpiType: 'consultation_requests',
      notes: 'Estrategia PI pre-seed',
      addedToEvidence: false,
      createdAt: '2026-08-20T11:00:00Z',
      createdBy: 'user_client_juan_01',
    },
  ];
}

export function buildJuanContentQueue(): { contents: ContentItem[]; tasks: Task[] } {
  const contents: ContentItem[] = [];
  const tasks: Task[] = [];
  const base = '2026-08-20T10:00:00Z';

  LINKEDIN_POSTS.forEach((post, i) => {
    const id = `cnt_seed_post_${i + 1}`;
    contents.push({
      id,
      organizationId: ORG_ID,
      clientId: JUAN_ID,
      thesisId: post.pillar === 'patents_opinion' ? THESIS_PATENTS : THESIS_ADOPTION,
      campaignId: post.pillar === 'patents_opinion' ? CAMP_PATENTS : CAMP_ADOPTION,
      type: 'LINKEDIN_ARTICLE',
      title: post.title,
      body: post.body,
      targetPlatform: 'LinkedIn',
      status: i < 2 ? 'CLIENT_REVIEW' : 'MANAGER_APPROVED',
      pipelineStatus: i < 2 ? 'sent_to_client' : 'manager_review',
      clientReviewBaseline: i < 2 ? post.body : undefined,
      stateHistory: [
        { state: 'draft_ready', actorUid: 'user_admin_01', actorRole: 'ADMIN', at: base },
        { state: i < 2 ? 'sent_to_client' : 'manager_review', actorUid: 'user_admin_01', actorRole: 'ADMIN', at: base },
      ],
      format: post.format,
      pillar: post.pillar,
      campaignDay: 12 + i,
      createdAt: base,
      updatedAt: base,
    });
    if (i < 2) {
      tasks.push({
        id: `task_seed_post_${i + 1}`,
        organizationId: ORG_ID,
        clientId: JUAN_ID,
        thesisId: THESIS_ADOPTION,
        campaignId: CAMP_ADOPTION,
        type: 'REVIEW_ARTICLE',
        title: `Revisar: ${post.title}`,
        description: post.body,
        estimatedMinutes: 10,
        deadline: '2026-08-21T18:00:00Z',
        status: 'ASSIGNED',
        contentItemId: id,
        format: post.format,
        pillar: post.pillar,
        campaignDay: 12 + i,
        createdAt: base,
      });
    }
  });

  VIDEO_TOPICS.forEach((topic, i) => {
    const id = `cnt_seed_vid_${i + 1}`;
    const isActive = i === 0 || i === 5;
    contents.push({
      id,
      organizationId: ORG_ID,
      clientId: JUAN_ID,
      thesisId: i >= 5 ? THESIS_PATENTS : THESIS_ADOPTION,
      campaignId: i >= 5 ? CAMP_PATENTS : CAMP_ADOPTION,
      type: 'VIDEO_SCRIPT',
      title: `Video: ${topic}`,
      body: `Guion borrador para video educativo (8–15 min).\n\nTema: ${topic}`,
      teleprompterScript: `[GANCHO]\n${topic}\n\n[DESARROLLO]\nMarco People + Tools + Rules.\n\n[CIERRE]\nCTA suave: consulta de preparación IA.`,
      targetPlatform: i === 0 ? 'LinkedIn' : 'YouTube',
      status: isActive ? 'CLIENT_REVIEW' : 'DRAFT',
      pipelineStatus: isActive ? 'sent_to_client' : 'draft_ready',
      format: 'video_long',
      pillar: i >= 5 ? 'patents_opinion' : 'ai_adoption',
      campaignDay: 15 + i,
      createdAt: base,
      updatedAt: base,
    });
    if (isActive) {
      tasks.push({
        id: `task_seed_vid_${i + 1}`,
        organizationId: ORG_ID,
        clientId: JUAN_ID,
        thesisId: i >= 5 ? THESIS_PATENTS : THESIS_ADOPTION,
        campaignId: i >= 5 ? CAMP_PATENTS : CAMP_ADOPTION,
        type: 'RECORD_VIDEO',
        title: `Grabar: ${topic.slice(0, 60)}…`,
        description: 'Video educativo 8–15 min con teleprompter.',
        estimatedMinutes: 20,
        deadline: '2026-08-22T18:00:00Z',
        status: 'ASSIGNED',
        contentItemId: id,
        scriptPayload: `[GANCHO]\n${topic}\n\n[DESARROLLO]\nMarco People + Tools + Rules.`,
        format: 'video_long',
        pillar: i >= 5 ? 'patents_opinion' : 'ai_adoption',
        campaignDay: 15 + i,
        createdAt: base,
      });
    }
  });

  return { contents, tasks };
}

/** Indica si el seed de campaña Juan ya fue aplicado. */
export function isJuanCampaignSeedApplied(milestones: CampaignMilestone[]): boolean {
  return milestones.some((m) => m.id === `ms_${CAMP_ADOPTION}_d30`);
}
