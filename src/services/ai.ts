import {
  PositioningThesis,
  Signal,
  Recommendation,
  ContentItem,
  StrategicScoreResult,
  AIComparativeResult,
  ClaimSafetyVerdictRecord,
  ThesisEditableFields,
} from '../types';
import { auditService } from './audit';
import { authService } from './auth';
import { dbService } from './db';
import { calculateStrategicScore, type ScoringContext } from './scoring';
import { assertAiQuota, assertComparativeAllowed } from './entitlements';
import { academicDraftSkeleton } from '../domain/scientificFocusCore';
import { reviewClaims } from '../domain/claimSafetyCore';
import { FIREBASE_ENABLED } from '../firebase/config';
import {
  executeContentDraftViaGateway,
  isContentDraftGatewayAvailable,
  mapGatewayErrorToUserMessage,
} from './contentDraftGateway';
import { parseContentDraftFormat } from './mapContentDraftGatewayInput';
import {
  executeThesisProposalViaGateway,
  executeSignalThesisEvalViaGateway,
  executeThesisChallengeViaGateway,
  isThesisSignalGatewayAvailable,
} from './thesisSignalGateway';
import {
  executeComparativeAnalysisViaGateway,
  isComparativeGatewayAvailable,
} from './comparativeGateway';
import {
  mapClientToThesisProposalGatewayInput,
} from './mapThesisProposalGatewayInput';
import { buildThesisProposalFromProfile } from '../domain/thesisProposalCore';
import {
  evaluateThesisChallenge,
  mergeChallengeWithAi,
  type ThesisChallengeResult,
} from '../domain/thesisChallengeCore';

/** Hash síncrono liviano para invalidar claim safety cuando cambia el texto. */
function simpleContentHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return `h${hash.toString(16)}`;
}

/**
 * Browser AI facade — all structured LLM ops route through the server Gateway.
 * Legacy browser session-key provider proxy paths were removed in Phase 5D.
 */
class AIService {
  /** True when ADMIN + Firebase can call aiComplete / gateway-complete. */
  public isServerGatewayAvailable(): boolean {
    if (!FIREBASE_ENABLED) return false;
    const user = authService.getCurrentUser();
    return Boolean(user && user.role === 'ADMIN');
  }

  public calculateStrategicScore(
    signal: Signal,
    thesis: PositioningThesis,
    context?: ScoringContext
  ): StrategicScoreResult {
    return calculateStrategicScore(signal, thesis, context);
  }

  public async analyzeSignalAgainstThesis(
    signal: Signal,
    thesis: PositioningThesis,
    scoringContext?: ScoringContext
  ): Promise<Omit<Recommendation, 'id' | 'createdAt'> & { usedLiveModel: boolean }> {
    const scoring = calculateStrategicScore(signal, thesis, scoringContext);
    let usedLiveModel = false;
    let proposedAngle = `Impacto: "${signal.title}" para ${thesis.targetAudience}.`;
    let rationale = scoring.strategicRationale;

    if (isThesisSignalGatewayAvailable()) {
      try {
        const { output } = await executeSignalThesisEvalViaGateway({ signal, thesis });
        usedLiveModel = true;
        proposedAngle = output.proposedAngle || proposedAngle;
        rationale = output.strategicRationale || rationale;
      } catch (error) {
        auditService.log(authService.getCurrentUser(), 'AI_ANALYSIS_FAILED', 'Signal', signal.id, {
          message: error instanceof Error ? error.message : 'error',
        });
        throw new Error(mapGatewayErrorToUserMessage(error));
      }
    }

    // Domain mutation only after gateway success (or non-AI degraded path).
    dbService.updateSignalStatus(signal.id, 'ANALYZED');
    const full = dbService.getSignals().find((s) => s.id === signal.id);
    if (full) {
      full.aiStatus = 'ANALYZED';
      full.recommendedAction = scoring.recommendedAction;
      full.priorityBand = scoring.priorityBand;
      full.relevanceScore = scoring.totalScore;
    }

    auditService.log(authService.getCurrentUser(), 'AI_ANALYSIS_RUN', 'Signal', signal.id, {
      thesisId: thesis.id,
      score: scoring.totalScore,
      live: usedLiveModel,
    });

    const type: Recommendation['type'] =
      scoring.recommendedAction === 'CREATE_OPPORTUNITY' ? 'OPPORTUNITY_PITCH' :
      scoring.recommendedAction === 'ARTICLE' ? 'ARTICLE_LONG' : 'VIDEO_SHORT';

    return {
      signalId: signal.id,
      thesisId: thesis.id,
      clientId: thesis.clientId,
      type,
      proposedAngle,
      strategicRationale: usedLiveModel ? rationale : `${rationale} (modo degradado: scoring-v1.0 sin modelo conectado)`,
      urgency: scoring.totalScore >= 85 ? 'HIGH' : scoring.totalScore >= 70 ? 'MEDIUM' : 'LOW',
      impactScore: scoring.totalScore,
      status: 'GENERATED',
      usedLiveModel,
    };
  }

  public async runComparativeAnalysis(signal: Signal, thesis: PositioningThesis): Promise<AIComparativeResult> {
    const allowed = assertComparativeAllowed(dbService.getSubscription());
    if (!allowed.ok) throw new Error(allowed.message);

    if (!isComparativeGatewayAvailable()) {
      throw new Error(
        'El análisis comparativo requiere Gateway de IA (ADMIN + Firebase).'
      );
    }

    try {
      const { result } = await executeComparativeAnalysisViaGateway({ signal, thesis });
      return result;
    } catch (error) {
      throw new Error(mapGatewayErrorToUserMessage(error));
    }
  }

  public async generateThesisProposal(clientId: string): Promise<ThesisEditableFields> {
    const mapped = mapClientToThesisProposalGatewayInput(clientId);
    const client = dbService.getClientById(clientId);
    const profile = dbService.getMasterProfile(clientId);
    const dossier = dbService.getMasterDossier(clientId);
    const evidence = dbService.getEvidenceVaultByClient(clientId);
    const fallback =
      mapped?.fallback ?? buildThesisProposalFromProfile({ client, profile, dossier, evidence });

    if (!client) return fallback;

    if (isThesisSignalGatewayAvailable()) {
      try {
        const { editable } = await executeThesisProposalViaGateway({ clientId });
        return editable;
      } catch (error) {
        throw new Error(mapGatewayErrorToUserMessage(error));
      }
    }

    // NON_AI_LOCAL_FALLBACK — heuristic proposal; not Gateway-generated.
    return fallback;
  }

  public async challengeThesis(thesis: PositioningThesis): Promise<ThesisChallengeResult> {
    const evidence = dbService.getEvidenceVaultByClient(thesis.clientId);
    const heuristic = evaluateThesisChallenge(thesis, evidence);

    if (isThesisSignalGatewayAvailable()) {
      try {
        const { output } = await executeThesisChallengeViaGateway({ thesis });
        return mergeChallengeWithAi(heuristic, {
          outcome: output.outcome,
          recommendations: output.recommendations,
          riskScore: output.riskScore,
        });
      } catch (error) {
        throw new Error(mapGatewayErrorToUserMessage(error));
      }
    }

    // NON_AI_LOCAL_FALLBACK — heuristic challenge; not Gateway-generated.
    return heuristic;
  }

  /**
   * Pasa el borrador por el Claim Safety Engine. Un cargo o premio sin respaldo
   * no debería llegar a revisión del cliente sin aviso explícito.
   */
  public reviewDraftClaims(body: string, thesis: PositioningThesis): ClaimSafetyVerdictRecord {
    const review = reviewClaims(body, thesis, dbService.getEvidenceVaultByClient(thesis.clientId));
    return {
      verdict: review.verdict,
      summary: review.summary,
      reviewedAt: new Date().toISOString(),
      contentHash: simpleContentHash(body),
      findings: review.findings.map((finding) => ({
        kind: finding.kind,
        severity: finding.severity,
        claim: finding.claim,
        detail: finding.detail,
        action: finding.action,
        supportingEvidenceIds: finding.supportingEvidenceIds,
      })),
    };
  }

  public async generateContentDraft(
    thesis: PositioningThesis,
    topicTitle: string,
    format: 'VIDEO_SCRIPT' | 'LINKEDIN_ARTICLE' | 'ACADEMIC_PAPER' | 'THOUGHT_LEADERSHIP',
    extras?: { roleAngle?: string; venueLabel?: string; why?: string; angle?: string }
  ): Promise<Omit<ContentItem, 'id' | 'createdAt' | 'updatedAt'>> {
    const quota = assertAiQuota(dbService.getSubscription());
    if (!quota.ok) throw new Error(quota.message);

    const parsedFormat = parseContentDraftFormat(format);

    if (isContentDraftGatewayAvailable()) {
      try {
        const { output } = await executeContentDraftViaGateway({
          thesis,
          topicTitle,
          format: parsedFormat,
          extras,
        });
        const body = output.body;
        const claimSafety = this.reviewDraftClaims(body, thesis);
        return {
          organizationId: thesis.organizationId,
          clientId: thesis.clientId,
          thesisId: thesis.id,
          type: format,
          title: output.title || topicTitle,
          body,
          teleprompterScript: format === 'VIDEO_SCRIPT' ? body : undefined,
          targetPlatform: format === 'ACADEMIC_PAPER' ? 'LegalJournal' : 'LinkedIn',
          status: 'AI_GENERATED',
          managerNotes: claimSafety.verdict === 'PASS'
            ? 'Generado vía AI Gateway. Revisión humana obligatoria.'
            : `Generado vía AI Gateway. Claim safety ${claimSafety.verdict}: ${claimSafety.summary}`,
          claimSafety,
        };
      } catch (error) {
        throw new Error(mapGatewayErrorToUserMessage(error));
      }
    }

    const body =
      format === 'VIDEO_SCRIPT'
        ? `[GANCHO]\n${topicTitle}\n\n[NÚCLEO]\nDesde la práctica en ${thesis.domain}, tres puntos no negociables para ${thesis.targetAudience}.\n\n[CIERRE]\n${thesis.expertIdentity}.`
        : format === 'ACADEMIC_PAPER'
          ? academicDraftSkeleton({
              title: topicTitle,
              roleAngle: extras?.roleAngle || thesis.expertIdentity,
              venueLabel: extras?.venueLabel || 'Working paper',
              why: extras?.why || thesis.objective,
              proofPoints: thesis.proofPoints,
              voice: thesis.voiceAndTone,
            })
        : `# ${topicTitle}\n\nPor ${thesis.expertIdentity}\n\nBorrador manual (IA no conectada). Completa con evidencia confirmada de la tesis.`;

    return {
      organizationId: thesis.organizationId,
      clientId: thesis.clientId,
      thesisId: thesis.id,
      type: format,
      title: topicTitle,
      body,
      teleprompterScript: format === 'VIDEO_SCRIPT' ? body : undefined,
      targetPlatform: format === 'ACADEMIC_PAPER' ? 'LegalJournal' : 'LinkedIn',
      status: 'DRAFT',
      managerNotes: format === 'ACADEMIC_PAPER'
        ? `Borrador científico (${extras?.venueLabel || 'working paper'}). Revisión humana; no cites fuentes no verificadas.`
        : 'Borrador en modo degradado. Conecta Firebase ADMIN para generación vía Gateway.',
      claimSafety: this.reviewDraftClaims(body, thesis),
    };
  }
}

export const aiService = new AIService();
