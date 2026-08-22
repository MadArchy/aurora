import {
  AdviceAction,
  AdviceCategory,
  AdviceHorizon,
  Client,
  ClientProfile,
  EvidenceVaultItem,
  ImageDiagnosis,
  PositioningAdvice,
  PositioningThesis,
  ResultRecord,
  Topic,
} from '../types';
import { aiService } from './ai';
import { auditService } from './audit';
import { authService } from './auth';
import { dbService } from './db';
import { buildTopics } from './topics';
import { createId } from '../lib/id';

interface AdvisorInput {
  client: Client;
  thesis?: PositioningThesis;
  profile: ClientProfile | null;
  evidence: EvidenceVaultItem[];
  results: ResultRecord[];
  topics: Topic[];
}

interface LiveAdvicePayload {
  summary?: string;
  diagnosis?: Partial<ImageDiagnosis>;
  actions?: Array<Partial<AdviceAction>>;
}

const VALID_CATEGORIES: AdviceCategory[] = ['CONTENT', 'CREDENTIAL', 'VISIBILITY', 'EVIDENCE', 'NETWORK', 'RISK'];
const VALID_HORIZONS: AdviceHorizon[] = ['DAYS_30', 'DAYS_60', 'DAYS_90'];

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function daysSince(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

/** Puntuación de las cuatro dimensiones de imagen a partir de datos duros del cliente. */
function computeDiagnosis(input: AdvisorInput): ImageDiagnosis {
  const { client, thesis, profile, evidence, results } = input;

  const verifiedEvidence = evidence.filter((e) => e.verified);
  const proofPoints = thesis?.proofPoints.length || 0;

  const authorityScore = clampScore(
    30 +
      proofPoints * 8 +
      verifiedEvidence.length * 5 +
      (profile?.career.yearsExperience ? Math.min(20, profile.career.yearsExperience) : 0)
  );

  const consistencyScore = clampScore(
    (thesis ? 40 : 10) +
      (thesis?.clientApprovalStatus === 'APPROVED' ? 20 : 0) +
      (thesis?.differentiator ? 15 : 0) +
      (client.profileCompleteness || 0) * 0.25
  );

  const evidenceScore = clampScore(evidence.length * 9 + verifiedEvidence.length * 6);

  const lastResult = results
    .map((r) => Date.parse(r.createdAt))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a)[0];
  const daysSinceResult = lastResult ? Math.floor((Date.now() - lastResult) / 86400000) : null;
  const recencyPenalty = daysSinceResult === null ? 30 : daysSinceResult > 60 ? 25 : daysSinceResult > 30 ? 12 : 0;

  const visibilityScore = clampScore(
    25 + results.length * 8 + (profile?.socialLinks.linkedin ? 10 : 0) + (profile?.socialLinks.website ? 8 : 0) - recencyPenalty
  );

  const strengths: string[] = [];
  const gaps: string[] = [];
  const risks: string[] = [];

  if (proofPoints >= 3) strengths.push(`Tesis respaldada por ${proofPoints} proof points declarados.`);
  if (verifiedEvidence.length >= 3) strengths.push(`${verifiedEvidence.length} evidencias verificadas en el vault.`);
  if (thesis?.differentiator) strengths.push('Tiene un diferenciador explícito frente a pares del sector.');
  if (profile?.career.yearsExperience && profile.career.yearsExperience >= 10) {
    strengths.push(`${profile.career.yearsExperience} años de trayectoria como base de autoridad.`);
  }
  if (results.length >= 3) strengths.push('Historial de resultados medidos en canal propio.');
  if (!strengths.length) strengths.push('Perfil en construcción: aún no hay señales fuertes de autoridad consolidada.');

  if (!thesis) gaps.push('No hay tesis de posicionamiento activa: el contenido no tiene filtro estratégico.');
  if (proofPoints < 3) gaps.push('Menos de 3 proof points: la promesa de la tesis excede la evidencia disponible.');
  if (evidence.length < 5) gaps.push(`Evidence vault con ${evidence.length} ítem(s): insuficiente para sostener afirmaciones públicas.`);
  if (!profile?.socialLinks.linkedin) gaps.push('Sin LinkedIn registrado: canal principal de la audiencia sin cubrir.');
  if ((client.profileCompleteness || 0) < 85) gaps.push(`Perfil maestro al ${client.profileCompleteness || 0}%: falta contexto para personalizar contenido.`);
  if (daysSinceResult === null) gaps.push('No hay resultados registrados: no se puede demostrar tracción.');
  else if (daysSinceResult > 30) gaps.push(`${daysSinceResult} días sin registrar un resultado nuevo.`);
  if (!gaps.length) gaps.push('Sin brechas críticas detectadas con los datos actuales.');

  if (thesis && thesis.clientApprovalStatus === 'PENDING') risks.push('La tesis no está aprobada por el cliente: riesgo de desalineación en la voz.');
  if (thesis && thesis.clientApprovalStatus === 'CHANGES_REQUESTED') risks.push('El cliente pidió cambios en la tesis y siguen sin resolverse.');
  if (proofPoints > 0 && verifiedEvidence.length === 0) risks.push('Proof points sin evidencia verificada: exposición a cuestionamiento público.');
  if (client.onboardingStatus !== 'COMPLETED') risks.push('Onboarding incompleto: decisiones basadas en información parcial.');
  if (!thesis?.complianceRules) risks.push('Sin límites deontológicos declarados en la tesis.');
  if (!risks.length) risks.push('Sin riesgos reputacionales evidentes en los datos registrados.');

  return { authorityScore, consistencyScore, evidenceScore, visibilityScore, strengths, gaps, risks };
}

/** Acciones derivadas por reglas: es el modo degradado y también el piso mínimo del modo con IA. */
function computeHeuristicActions(input: AdvisorInput, diagnosis: ImageDiagnosis): AdviceAction[] {
  const { client, thesis, profile, evidence, results, topics } = input;
  const actions: AdviceAction[] = [];

  const push = (a: Omit<AdviceAction, 'id'>) => actions.push({ ...a, id: createId('adv') });

  if (!thesis) {
    push({
      category: 'CONTENT',
      horizon: 'DAYS_30',
      title: 'Definir la tesis de posicionamiento',
      why: 'Sin tesis no hay criterio para aceptar o descartar temas, y el contenido se vuelve reactivo.',
      how: 'Abre el editor de tesis y completa identidad experta, audiencia primaria, dominio y proof points.',
      effortMinutes: 60,
      impact: 95,
    });
  }

  const proofPoints = thesis?.proofPoints.length || 0;
  if (proofPoints < 3) {
    push({
      category: 'EVIDENCE',
      horizon: 'DAYS_30',
      title: `Sumar ${3 - proofPoints} proof point(s) a la tesis`,
      why: 'La autoridad se sostiene en evidencia verificable, no en afirmaciones. Hoy la promesa supera el respaldo.',
      how: 'Revisa publicaciones, casos y certificaciones del cliente y registra cada una en el evidence vault antes de citarla.',
      effortMinutes: 45,
      impact: 88,
    });
  }

  if (evidence.filter((e) => e.verified).length === 0 && evidence.length > 0) {
    push({
      category: 'EVIDENCE',
      horizon: 'DAYS_30',
      title: 'Verificar la evidencia ya cargada',
      why: 'Hay evidencia registrada pero ninguna marcada como verificada: es un riesgo si se cita públicamente.',
      how: 'Contrasta cada ítem con su fuente original y márcalo como verificado con la URL de respaldo.',
      effortMinutes: 30,
      impact: 72,
    });
  }

  if ((client.profileCompleteness || 0) < 85) {
    push({
      category: 'CREDENTIAL',
      horizon: 'DAYS_30',
      title: 'Completar el perfil maestro',
      why: 'El perfil alimenta la voz y el contexto de todo el contenido generado; incompleto produce material genérico.',
      how: 'Envía al cliente el asistente de onboarding y cubre trayectoria, formación y preferencias de voz.',
      effortMinutes: 25,
      impact: 70,
    });
  }

  const hotTopics = topics.filter((t) => t.momentum === 'RISING' || t.momentum === 'EMERGING').slice(0, 2);
  for (const topic of hotTopics) {
    push({
      category: 'CONTENT',
      horizon: 'DAYS_30',
      title: `Tomar posición sobre "${topic.label}"`,
      why: `Tema ${topic.momentum === 'EMERGING' ? 'emergente' : 'al alza'} con ${topic.signalCount} señal(es) y score máximo ${topic.topScore}. Llegar temprano da ventaja de encuadre.`,
      how: 'Selecciona la señal de mayor score en el radar, llévala a la mesa de curación y genera un guion de video corto.',
      effortMinutes: 40,
      impact: Math.min(92, 55 + topic.topScore / 3),
    });
  }

  if (!profile?.socialLinks.linkedin) {
    push({
      category: 'VISIBILITY',
      horizon: 'DAYS_30',
      title: 'Registrar y activar el perfil de LinkedIn',
      why: 'Es el canal donde vive la audiencia profesional del cliente; sin él la distribución queda incompleta.',
      how: 'Pide la URL al cliente, regístrala en el perfil maestro y define cadencia de publicación.',
      effortMinutes: 20,
      impact: 68,
    });
  }

  const dSinceResult = results.length
    ? daysSince(results.map((r) => r.createdAt).sort().reverse()[0])
    : null;
  if (dSinceResult === null || dSinceResult > 30) {
    push({
      category: 'VISIBILITY',
      horizon: 'DAYS_60',
      title: 'Reactivar cadencia de publicación y medirla',
      why: 'Sin resultados recientes no hay forma de demostrar tracción ni de justificar el plan ante el cliente.',
      how: 'Fija dos entregables al mes y registra métricas de cada publicación en la sección de resultados.',
      effortMinutes: 50,
      impact: 74,
    });
  }

  if (diagnosis.authorityScore < 60) {
    push({
      category: 'CREDENTIAL',
      horizon: 'DAYS_90',
      title: 'Buscar una credencial o escenario de terceros',
      why: 'La autoridad prestada por instituciones reconocidas acelera la percepción de experticia más rápido que el contenido propio.',
      how: 'Identifica una conferencia, panel o revista del dominio y prepara una propuesta con la tesis como eje.',
      effortMinutes: 90,
      impact: 82,
    });
  }

  if (diagnosis.visibilityScore < 50) {
    push({
      category: 'NETWORK',
      horizon: 'DAYS_60',
      title: 'Construir alianzas con pares del dominio',
      why: 'La visibilidad crece más rápido por asociación con perfiles ya establecidos que por alcance orgánico propio.',
      how: 'Lista cinco referentes del sector y propone una colaboración concreta: panel conjunto, artículo a dos manos o podcast.',
      effortMinutes: 60,
      impact: 64,
    });
  }

  if (thesis && thesis.clientApprovalStatus !== 'APPROVED') {
    push({
      category: 'RISK',
      horizon: 'DAYS_30',
      title: 'Cerrar la aprobación de la tesis con el cliente',
      why: 'Publicar bajo una tesis no aprobada expone a correcciones tardías y a fricción con el cliente.',
      how: 'Agenda una revisión, recoge el feedback pendiente y actualiza la tesis hasta obtener aprobación explícita.',
      effortMinutes: 35,
      impact: 78,
    });
  }

  if (!thesis?.complianceRules) {
    push({
      category: 'RISK',
      horizon: 'DAYS_30',
      title: 'Declarar límites deontológicos en la tesis',
      why: 'Sin reglas de cumplimiento el scoring no puede bloquear temas sensibles automáticamente.',
      how: 'Define qué temas, afirmaciones y clientes no se pueden mencionar, y guárdalos en el campo de compliance.',
      effortMinutes: 25,
      impact: 66,
    });
  }

  return actions.sort((a, b) => b.impact - a.impact).slice(0, 8);
}

function normalizeLiveActions(raw: Array<Partial<AdviceAction>>): AdviceAction[] {
  return raw
    .filter((a) => a && a.title)
    .slice(0, 8)
    .map((a) => ({
      id: createId('adv'),
      category: VALID_CATEGORIES.includes(a.category as AdviceCategory) ? (a.category as AdviceCategory) : 'CONTENT',
      horizon: VALID_HORIZONS.includes(a.horizon as AdviceHorizon) ? (a.horizon as AdviceHorizon) : 'DAYS_30',
      title: String(a.title),
      why: String(a.why || 'Sin justificación devuelta por el modelo.'),
      how: String(a.how || 'Definir pasos con el manager.'),
      effortMinutes: Number.isFinite(Number(a.effortMinutes)) ? Math.max(5, Number(a.effortMinutes)) : 45,
      impact: Number.isFinite(Number(a.impact)) ? clampScore(Number(a.impact)) : 60,
    }));
}

function buildPrompt(input: AdvisorInput, diagnosis: ImageDiagnosis): string {
  const { client, thesis, profile, evidence, results, topics } = input;

  const context = {
    cliente: {
      profesion: client.profession,
      mercadoObjetivo: client.targetMarket,
      completitudPerfil: client.profileCompleteness,
      onboarding: client.onboardingStatus,
    },
    tesis: thesis
      ? {
          titulo: thesis.title,
          identidadExperta: thesis.expertIdentity,
          audiencia: thesis.targetAudience,
          dominio: thesis.domain,
          objetivo: thesis.objective,
          proofPoints: thesis.proofPoints,
          diferenciador: thesis.differentiator,
          limites: thesis.complianceRules,
          aprobacion: thesis.clientApprovalStatus,
        }
      : null,
    perfil: profile
      ? {
          headline: profile.identity.professionalHeadline,
          objetivoPrincipal: profile.goals.primaryGoal,
          aniosExperiencia: profile.career.yearsExperience,
          formacion: profile.education.map((e) => `${e.degree} — ${e.institution}`),
          publicaciones: profile.keyPublications.map((p) => p.title),
          tono: profile.voicePreferences.tone,
          temasAEvitar: profile.voicePreferences.topicsToAvoid,
        }
      : null,
    evidencia: {
      total: evidence.length,
      verificadas: evidence.filter((e) => e.verified).length,
      tipos: Array.from(new Set(evidence.map((e) => e.type))),
    },
    resultados: results.slice(0, 8).map((r) => `${r.title}: ${r.metricLabel} ${r.metricValue}`),
    temasRadar: topics.slice(0, 6).map((t) => ({
      tema: t.label,
      senales: t.signalCount,
      scoreMaximo: t.topScore,
      momentum: t.momentum,
    })),
    diagnosticoLocal: {
      autoridad: diagnosis.authorityScore,
      consistencia: diagnosis.consistencyScore,
      evidencia: diagnosis.evidenceScore,
      visibilidad: diagnosis.visibilityScore,
    },
  };

  return [
    'Actúas como asesor senior de posicionamiento profesional para un Brand Manager.',
    'Tu tarea: auditar la imagen profesional del cliente y proponer acciones concretas de mejora.',
    'Reglas estrictas: no inventes credenciales, publicaciones ni logros que no estén en el contexto.',
    'Cada acción debe ser ejecutable por el manager o el cliente, con un porqué basado en los datos entregados.',
    '',
    `Contexto: ${JSON.stringify(context)}`,
    '',
    'Responde SOLO con JSON válido con esta forma:',
    '{',
    '  "summary": string,',
    '  "diagnosis": { "strengths": string[], "gaps": string[], "risks": string[] },',
    '  "actions": [{ "category": "CONTENT"|"CREDENTIAL"|"VISIBILITY"|"EVIDENCE"|"NETWORK"|"RISK",',
    '                "horizon": "DAYS_30"|"DAYS_60"|"DAYS_90",',
    '                "title": string, "why": string, "how": string,',
    '                "effortMinutes": number, "impact": number }]',
    '}',
  ].join('\n');
}

/**
 * Genera el diagnóstico de imagen y el plan de mejora del cliente.
 * Con sesión de IA activa enriquece el resultado; sin ella devuelve el análisis heurístico.
 */
export async function generatePositioningAdvice(clientId: string): Promise<PositioningAdvice> {
  const client = dbService.getClientById(clientId);
  if (!client) throw new Error('Cliente no encontrado.');

  const thesis = dbService.getPrimaryThesis(clientId);
  const input: AdvisorInput = {
    client,
    thesis,
    profile: dbService.getMasterProfile(clientId),
    evidence: dbService.getEvidenceVaultByClient(clientId),
    results: dbService.getResultsByClient(clientId),
    topics: buildTopics(clientId, dbService.getSignalsByClient(clientId)),
  };

  const diagnosis = computeDiagnosis(input);
  let actions = computeHeuristicActions(input, diagnosis);
  let summary = thesis
    ? `Autoridad ${diagnosis.authorityScore}/100 y visibilidad ${diagnosis.visibilityScore}/100 frente a la tesis "${thesis.title}". ${actions.length} acción(es) priorizada(s).`
    : `Sin tesis activa. Autoridad estimada ${diagnosis.authorityScore}/100. Definir el posicionamiento es el primer paso.`;
  let usedLiveModel = false;

  try {
    const live = await aiService.runAgentJson<LiveAdvicePayload>({
      agent: 'POSITIONING_STRATEGIST',
      prompt: buildPrompt(input, diagnosis),
      promptTemplateId: 'tmpl_positioning_advisor_v1',
      organizationId: client.organizationId,
      clientId,
      contextSummary: `Asesoría de imagen para ${client.displayName}`,
    });

    if (live) {
      usedLiveModel = true;
      if (live.summary) summary = live.summary;
      if (live.diagnosis?.strengths?.length) diagnosis.strengths = live.diagnosis.strengths;
      if (live.diagnosis?.gaps?.length) diagnosis.gaps = live.diagnosis.gaps;
      if (live.diagnosis?.risks?.length) diagnosis.risks = live.diagnosis.risks;
      const liveActions = normalizeLiveActions(live.actions || []);
      if (liveActions.length) actions = liveActions;
    }
  } catch (error) {
    auditService.log(authService.getCurrentUser(), 'ADVISOR_LIVE_FAILED', 'Client', clientId, {
      message: error instanceof Error ? error.message : 'error',
    });
  }

  const advice: PositioningAdvice = {
    id: createId('advice'),
    organizationId: client.organizationId,
    clientId,
    thesisId: thesis?.id,
    summary: usedLiveModel ? summary : `${summary} Análisis heurístico: conecta la IA para un diagnóstico más profundo.`,
    diagnosis,
    actions,
    usedLiveModel,
    generatedAt: new Date().toISOString(),
    generatedBy: authService.getCurrentUser()?.uid || 'system',
  };

  dbService.saveAdvice(advice);
  auditService.log(authService.getCurrentUser(), 'ADVISOR_GENERATED', 'Client', clientId, {
    live: usedLiveModel,
    actions: actions.length,
    authorityScore: diagnosis.authorityScore,
  });

  return advice;
}

/** Propone el ángulo editorial de un ítem en la mesa de curación. */
export async function proposeAngle(params: {
  clientId: string;
  title: string;
  snippet: string;
}): Promise<{ angle: string; usedLiveModel: boolean }> {
  const client = dbService.getClientById(params.clientId);
  const thesis = dbService.getPrimaryThesis(params.clientId);

  if (client && thesis) {
    try {
      const live = await aiService.runAgentJson<{ angle?: string }>({
        agent: 'POSITIONING_STRATEGIST',
        prompt: [
          `Tesis: ${thesis.title}`,
          `Identidad experta: ${thesis.expertIdentity}`,
          `Audiencia: ${thesis.targetAudience}`,
          `Límites deontológicos: ${thesis.complianceRules}`,
          'Propone un ángulo editorial en una frase que el cliente pueda defender con su evidencia.',
          '<UNTRUSTED_SOURCE>',
          `Título: ${params.title}`,
          params.snippet,
          '</UNTRUSTED_SOURCE>',
          'Responde SOLO JSON: { "angle": string }',
        ].join('\n'),
        promptTemplateId: 'tmpl_curation_angle_v1',
        organizationId: client.organizationId,
        clientId: params.clientId,
        contextSummary: `Ángulo de curación: ${params.title}`,
      });
      if (live?.angle) return { angle: live.angle, usedLiveModel: true };
    } catch {
      /* cae al modo heurístico */
    }
  }

  const audience = thesis?.targetAudience || 'tu audiencia';
  const domain = thesis?.domain || 'el dominio del cliente';
  return {
    angle: `Qué implica "${params.title}" para ${audience}: lectura desde ${domain} con las tres decisiones que deberían tomar esta semana.`,
    usedLiveModel: false,
  };
}
