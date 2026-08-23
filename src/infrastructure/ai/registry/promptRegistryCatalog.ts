import type { AiOperation } from '../../../domain/ai/operations';
import type { PromptIdentity } from '../../../domain/ai/promptIdentity';
import {
  ContentDraftGatewayInputSchema,
  renderContentDraftUserMessage,
} from '../../../application/ai/schemas/contentDraftInput';
import {
  ThesisProposalGatewayInputSchema,
  renderThesisProposalUserMessage,
} from '../../../application/ai/schemas/thesisProposalInput';
import {
  SignalThesisEvalGatewayInputSchema,
  renderSignalThesisEvalUserMessage,
} from '../../../application/ai/schemas/signalThesisEvalInput';
import {
  ThesisChallengeGatewayInputSchema,
  renderThesisChallengeUserMessage,
} from '../../../application/ai/schemas/thesisChallengeInput';

export interface PromptCatalogEntry {
  operation: AiOperation;
  identity: PromptIdentity;
  systemMessage: string;
  /** Canonical user template with stable placeholders — hashed as promptHash identity. */
  userTemplateCanonical: string;
  renderUserMessage: (input: unknown) => string;
}

const JSON_SYSTEM =
  'Eres un analista estratégico de posicionamiento profesional. Responde solo JSON válido sin markdown.';

function inputJson(input: unknown): string {
  try {
    return JSON.stringify(input ?? {}, null, 0);
  } catch {
    return '{}';
  }
}

/** Static versioned prompts — semantics aligned with Phase-0 inventory IDs. */
export const PROMPT_CATALOG: PromptCatalogEntry[] = [
  {
    operation: 'CONTENT_DRAFT',
    identity: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    systemMessage: JSON_SYSTEM,
    userTemplateCanonical: 'Redacta {{FORMAT}} en voz {{VOICE_HINT}}.\nPercepción objetivo: {{PERCEPTION_TARGET}}.\nNo inventes credenciales fuera de: {{EVIDENCE_HINT}}.\nLímites duros (nunca violar): {{HARD_BLOCKS}}.\nEvitar en voz: {{VOICE_AVOID}}.\nTema: {{TOPIC_TITLE}}\nIdentidad: {{EXPERT_IDENTITY}}\nJSON { "title": string, "body": string }',
    renderUserMessage: (input) => renderContentDraftUserMessage(ContentDraftGatewayInputSchema.parse(input)),
  },
  {
    operation: 'THESIS_PROPOSAL',
    identity: { promptId: 'tmpl_thesis_proposal_v1', promptVersion: '1' },
    systemMessage: JSON_SYSTEM,
    userTemplateCanonical:
      'Genera una propuesta de tesis de posicionamiento. Usa SOLO credenciales del contexto.\nContexto confirmado: {{CONTEXT_JSON}}\nJSON { title, expertIdentity, identityCurrent, perceptionTarget, targetAudience, domain, objective, differentiator, proofPoints, audiences, territories, objectives, voiceAndTone, voiceAvoid, hardBlocks, softAvoid, complianceRules }',
    renderUserMessage: (input) =>
      renderThesisProposalUserMessage(ThesisProposalGatewayInputSchema.parse(input)),
  },
  {
    operation: 'SIGNAL_THESIS_EVAL',
    identity: { promptId: 'tmpl_strategist_signal_eval_v2', promptVersion: '2' },
    systemMessage: JSON_SYSTEM,
    userTemplateCanonical:
      'Tesis: {{THESIS_TITLE}}\nIdentidad: {{EXPERT_IDENTITY}}\nAudiencia: {{TARGET_AUDIENCE}}\nDominio: {{DOMAIN}}\nLímites: {{COMPLIANCE}}\n<UNTRUSTED_SOURCE>\nTítulo: {{SIGNAL_TITLE}}\nFuente: {{SIGNAL_SOURCE}}\n{{SIGNAL_SNIPPET}}\n</UNTRUSTED_SOURCE>\nDevuelve JSON { "proposedAngle": string, "strategicRationale": string, "recommendedAction": string }',
    renderUserMessage: (input) =>
      renderSignalThesisEvalUserMessage(SignalThesisEvalGatewayInputSchema.parse(input)),
  },
  {
    operation: 'THESIS_CHALLENGE',
    identity: { promptId: 'tmpl_thesis_challenge_v1', promptVersion: '1' },
    systemMessage: JSON_SYSTEM,
    userTemplateCanonical:
      'Critica esta tesis de posicionamiento. Responde JSON { outcome, recommendations, riskScore }.\nBusca vaguedad, falta de evidencia, audiencia incorrecta, contradicciones y riesgo de saturación.\n{{THESIS_JSON}}',
    renderUserMessage: (input) =>
      renderThesisChallengeUserMessage(ThesisChallengeGatewayInputSchema.parse(input)),
  },
  {
    operation: 'ADVISOR_POSITIONING',
    identity: { promptId: 'tmpl_positioning_advisor_v1', promptVersion: '1' },
    systemMessage: JSON_SYSTEM,
    userTemplateCanonical: 'Genera consejo de posicionamiento en JSON.\nInput:\n{{INPUT_JSON}}',
    renderUserMessage: (input) => `Genera consejo de posicionamiento en JSON.\nInput:\n${inputJson(input)}`,
  },
  {
    operation: 'ADVISOR_CURATION_ANGLE',
    identity: { promptId: 'tmpl_curation_angle_v1', promptVersion: '1' },
    systemMessage: JSON_SYSTEM,
    userTemplateCanonical: 'Propón un ángulo de curación en JSON con campo angle.\nInput:\n{{INPUT_JSON}}',
    renderUserMessage: (input) => `Propón un ángulo de curación en JSON con campo angle.\nInput:\n${inputJson(input)}`,
  },
  {
    operation: 'ANALYSIS_COMPARATIVE',
    identity: { promptId: 'tmpl_comparative_analysis_v1', promptVersion: '1' },
    systemMessage: JSON_SYSTEM,
    userTemplateCanonical: 'Análisis comparativo en JSON.\nInput:\n{{INPUT_JSON}}',
    renderUserMessage: (input) => `Análisis comparativo en JSON.\nInput:\n${inputJson(input)}`,
  },
];

export function findPromptCatalogEntry(operation: AiOperation, identity: PromptIdentity): PromptCatalogEntry | null {
  return (
    PROMPT_CATALOG.find(
      (entry) =>
        entry.operation === operation &&
        entry.identity.promptId === identity.promptId &&
        entry.identity.promptVersion === identity.promptVersion
    ) ?? null
  );
}
