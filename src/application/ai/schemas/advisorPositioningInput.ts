import { z } from 'zod';

const RadarTopicSchema = z
  .object({
    label: z.string().min(1).max(200),
    signalCount: z.number().int().min(0).max(1000),
    topScore: z.number().min(0).max(100),
    momentum: z.enum(['RISING', 'EMERGING', 'STABLE', 'FALLING']),
  })
  .strict();

/** Structured gateway input — preserves legacy generatePositioningAdvice context. */
export const AdvisorPositioningGatewayInputSchema = z
  .object({
    client: z
      .object({
        profession: z.string().min(1).max(200),
        targetMarket: z.string().max(200).optional(),
        profileCompleteness: z.number().min(0).max(100).optional(),
        onboardingStatus: z.string().max(50).optional(),
      })
      .strict(),
    thesis: z
      .object({
        title: z.string().min(1).max(500),
        expertIdentity: z.string().max(500).optional(),
        targetAudience: z.string().max(500).optional(),
        domain: z.string().max(500).optional(),
        objective: z.string().max(1000).optional(),
        proofPoints: z.array(z.string().max(500)).max(20),
        differentiator: z.string().max(1000).optional(),
        complianceRules: z.string().max(2000).optional(),
        clientApprovalStatus: z.string().max(50).optional(),
      })
      .strict()
      .nullable(),
    profile: z
      .object({
        headline: z.string().max(500).optional(),
        primaryGoal: z.string().max(1000).optional(),
        yearsExperience: z.number().min(0).max(80).optional(),
        education: z.array(z.string().max(500)).max(20).optional(),
        publications: z.array(z.string().max(500)).max(20).optional(),
        tone: z.string().max(200).optional(),
        topicsToAvoid: z.array(z.string().max(200)).max(20).optional(),
      })
      .strict()
      .nullable(),
    evidence: z
      .object({
        total: z.number().int().min(0).max(1000),
        verified: z.number().int().min(0).max(1000),
        types: z.array(z.string().max(100)).max(20),
      })
      .strict(),
    results: z.array(z.string().max(500)).max(8),
    radarTopics: z.array(RadarTopicSchema).max(6),
    localDiagnosis: z
      .object({
        authorityScore: z.number().min(0).max(100),
        consistencyScore: z.number().min(0).max(100),
        evidenceScore: z.number().min(0).max(100),
        visibilityScore: z.number().min(0).max(100),
      })
      .strict(),
  })
  .strict();

export type AdvisorPositioningGatewayInput = z.infer<typeof AdvisorPositioningGatewayInputSchema>;

export const ADVISOR_POSITIONING_PROMPT_ID = 'tmpl_positioning_advisor_v1';
export const ADVISOR_POSITIONING_PROMPT_VERSION = '1';

export function renderAdvisorPositioningUserMessage(input: AdvisorPositioningGatewayInput): string {
  return [
    'Actúas como asesor senior de posicionamiento profesional para un Brand Manager.',
    'Tu tarea: auditar la imagen profesional del cliente y proponer acciones concretas de mejora.',
    'Reglas estrictas: no inventes credenciales, publicaciones ni logros que no estén en el contexto.',
    'Cada acción debe ser ejecutable por el manager o el cliente, con un porqué basado en los datos entregados.',
    '',
    `Contexto: ${JSON.stringify({
      cliente: {
        profesion: input.client.profession,
        mercadoObjetivo: input.client.targetMarket,
        completitudPerfil: input.client.profileCompleteness,
        onboarding: input.client.onboardingStatus,
      },
      tesis: input.thesis
        ? {
            titulo: input.thesis.title,
            identidadExperta: input.thesis.expertIdentity,
            audiencia: input.thesis.targetAudience,
            dominio: input.thesis.domain,
            objetivo: input.thesis.objective,
            proofPoints: input.thesis.proofPoints,
            diferenciador: input.thesis.differentiator,
            limites: input.thesis.complianceRules,
            aprobacion: input.thesis.clientApprovalStatus,
          }
        : null,
      perfil: input.profile,
      evidencia: input.evidence,
      resultados: input.results,
      temasRadar: input.radarTopics,
      diagnosticoLocal: {
        autoridad: input.localDiagnosis.authorityScore,
        consistencia: input.localDiagnosis.consistencyScore,
        evidencia: input.localDiagnosis.evidenceScore,
        visibilidad: input.localDiagnosis.visibilityScore,
      },
    })}`,
    '',
    'Responde SOLO con JSON válido con esta forma estricta:',
    '{',
    '  "summary": string,',
    '  "diagnosis": { "strengths": string[], "gaps": string[], "risks": string[] },',
    '  "actions": [{ "category": "CONTENT"|"CREDENTIAL"|"VISIBILITY"|"EVIDENCE"|"NETWORK"|"RISK",',
    '                "horizon": "DAYS_30"|"DAYS_60"|"DAYS_90",',
    '                "title": string, "description": string,',
    '                "priority": number }]',
    '}',
  ].join('\n');
}
