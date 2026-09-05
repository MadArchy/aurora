import type { ContentItem, ContentStatus, Recommendation } from '../../types';
import { assertClaimSafeTransition } from '../../domain/claimSafetyGateCore';
import {
  mapLegacyContentStatus,
  resolvePipelineStepsToTarget,
} from '../../domain/contentPipeline';
import { createId } from '../../lib/id';
import { ExecutionDeliveryError } from './errors';
import type { ContentBriefListPort } from './ports/ContentBriefListPort';
import type { ContentCreationPersistencePort } from './ports/ContentCreationPersistencePort';
import type {
  ContentDraftFormat,
  ContentDraftGenerationPort,
} from './ports/ContentDraftGenerationPort';
import type { ContentPublicationGatePort, ContentRepository } from './ports/ContentRepository';
import type { ContentStrategicDownstreamGatePort } from './ports/ContentStrategicDownstreamGatePort';
import type { CurationThesisReadPort } from './ports/CurationThesisReadPort';
import type { RecommendationReadPort } from './ports/RecommendationReadPort';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireAdminRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export type CreateContentDraftIntent =
  | {
      kind: 'FORM_GENERATE';
      strategicBriefId: string;
      topic: string;
      format: ContentDraftFormat;
      angle?: string;
    }
  | {
      kind: 'SCIENTIFIC_ARTICLE';
      thesisScopeId?: string;
      title: string;
      why: string;
      venue: string;
      roleAngle: string;
    }
  | {
      kind: 'RECOMMENDATION_TASK_SCRIPT';
      recommendationId: string;
    };

export interface CreateContentDraftInput {
  trusted: TrustedExecutionDeliveryContext;
  intent: CreateContentDraftIntent;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStrategicBriefId?: string;
  claimedThesisId?: string;
  claimedStatus?: string;
  claimedContentId?: string;
}

export interface CreateContentDraftGateSnapshot {
  briefId: string;
  version?: number;
  thesisId: string;
  signalIds: string[];
  evidenceIds: string[];
}

export interface CreateContentDraftResult {
  content: ContentItem;
  gate: CreateContentDraftGateSnapshot;
  pipelineSynced: boolean;
  /** RECOMMENDATION_TASK_SCRIPT only — claim/publication gate advance outcome. */
  advanced?: boolean;
  /** RECOMMENDATION_TASK_SCRIPT only — downstream #27 presentation compatibility. */
  recommendation?: Pick<Recommendation, 'id' | 'proposedAngle' | 'signalId'>;
}

export interface CreateContentDraftDeps {
  generation: ContentDraftGenerationPort;
  creation: ContentCreationPersistencePort;
  downstreamGate: ContentStrategicDownstreamGatePort;
  briefs: ContentBriefListPort;
  theses: CurationThesisReadPort;
  recommendations: RecommendationReadPort;
  contents: ContentRepository;
  publicationGate: ContentPublicationGatePort;
}

function gateSnapshot(
  gate: Extract<
    ReturnType<ContentStrategicDownstreamGatePort['gate']>,
    { ok: true }
  >
): CreateContentDraftGateSnapshot {
  return {
    briefId: gate.briefId,
    version: gate.version,
    thesisId: gate.thesisId,
    signalIds: gate.signalIds,
    evidenceIds: gate.evidenceIds,
  };
}

function syncPipelineAfterCreate(
  deps: CreateContentDraftDeps,
  input: CreateContentDraftInput,
  contentId: string,
  legacyStatus: ContentStatus,
  comment?: string,
  claimSafetyOverride?: ContentItem['claimSafety']
): boolean {
  const content = deps.contents.getById(contentId);
  if (!content) return false;

  void claimSafetyOverride;
  void content.claimSafety;

  const canonical = deps.publicationGate.authorize({
    contentId: content.id,
    organizationId: content.organizationId,
    clientId: content.clientId,
    targetStatus: legacyStatus,
    actorId: input.trusted.actorId,
    actorRole: input.trusted.actorRole === 'CLIENT' ? 'CLIENT' : 'ADMIN',
    now: input.trusted.now,
  });

  const gate = assertClaimSafeTransition(content.status, legacyStatus, content.claimSafety, {
    canonical: {
      allowed: canonical.allowed,
      reason: canonical.reason,
      reasonCode: canonical.reasonCode,
    },
  });
  if (!gate.allowed) return false;

  const current = content.pipelineStatus || mapLegacyContentStatus(content.status);
  const target = mapLegacyContentStatus(legacyStatus);
  if (current === target) return true;

  const steps = resolvePipelineStepsToTarget(current, target);
  const actor = {
    uid: input.trusted.actorId,
    role: input.trusted.actorRole === 'CLIENT' ? ('CLIENT' as const) : ('ADMIN' as const),
  };
  for (const step of steps) {
    deps.contents.transitionPipeline({
      contentId,
      next: step,
      actor,
      comment,
    });
  }
  return true;
}

function persistWithClaimGate(
  deps: CreateContentDraftDeps,
  input: CreateContentDraftInput,
  content: ContentItem,
  thesis: NonNullable<ReturnType<CurationThesisReadPort['getById']>>,
  targetStatus: ContentStatus,
  comment?: string
): boolean {
  const claimSafety = deps.generation.reviewDraftClaims(content.body, thesis);
  deps.creation.createContent({
    ...content,
    claimSafety,
    status: 'AI_GENERATED',
    createdAt: content.createdAt || input.trusted.now,
    updatedAt: input.trusted.now,
    strategicBriefId: content.strategicBriefId,
    strategicBriefVersion: content.strategicBriefVersion,
    signalIds: content.signalIds,
    supportingEvidenceIds: content.supportingEvidenceIds,
  });
  return syncPipelineAfterCreate(deps, input, content.id, targetStatus, comment, claimSafety);
}

function resolveScientificBriefId(
  deps: CreateContentDraftDeps,
  clientId: string,
  thesisScopeId?: string
): string {
  const approved = deps.briefs.listApprovedBriefs(clientId, 'CREATE_CONTENT');
  const scoped = thesisScopeId
    ? approved.filter((b) => b.thesisId === thesisScopeId)
    : approved;
  if (scoped.length !== 1) {
    throw new ExecutionDeliveryError(
      'STRATEGIC_BRIEF_GATE_DENIED',
      scoped.length === 0
        ? 'No approved CREATE_CONTENT Strategic Brief for this context.'
        : 'Multiple approved Briefs match — select an explicit thesis/Brief before generating.'
    );
  }
  return scoped[0].id;
}

function resolveRecommendationBriefId(
  deps: CreateContentDraftDeps,
  rec: Recommendation
): string | undefined {
  if (rec.signalId) {
    const bySignal = deps.briefs.findApprovedBriefForSignal({
      clientId: rec.clientId,
      signalId: rec.signalId,
      action: 'CREATE_TASK',
    });
    if (bySignal) return bySignal.id;
  }
  const matches = deps.briefs.listApprovedBriefs(rec.clientId, 'CREATE_TASK').filter(
    (b) => b.thesisId === rec.thesisId
  );
  return matches.length === 1 ? matches[0].id : undefined;
}

/**
 * CR-1 #33 — CreateContentDraft.
 * INITIAL ContentItem creation only — distinct from #31 SaveContentDraft (edit-existing).
 */
export function createCreateContentDraft(deps: CreateContentDraftDeps) {
  return async function createContentDraft(
    input: CreateContentDraftInput
  ): Promise<CreateContentDraftResult> {
    assertTrustedExecutionContext(input.trusted);
    requireAdminRole(input.trusted);
    assertNoExecutionSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
    });
    if (
      input.claimedStrategicBriefId !== undefined ||
      input.claimedThesisId !== undefined ||
      input.claimedStatus !== undefined ||
      input.claimedContentId !== undefined
    ) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Caller-supplied strategic refs, status, or content id are not accepted as authority.'
      );
    }

    const clientId = input.trusted.clientId;
    let gateAction: 'CREATE_CONTENT' | 'CREATE_TASK';
    let briefId: string | undefined;
    let generationParams: {
      topic: string;
      format: ContentDraftFormat;
      extras?: Parameters<ContentDraftGenerationPort['generate']>[3];
    };
    let recommendation: Recommendation | undefined;
    let claimGateTarget: ContentStatus | undefined;
    let claimGateComment: string | undefined;
    let forceAiGeneratedStatus = false;

    switch (input.intent.kind) {
      case 'FORM_GENERATE': {
        gateAction = 'CREATE_CONTENT';
        briefId = input.intent.strategicBriefId?.trim();
        if (!briefId) {
          throw new ExecutionDeliveryError('INVALID_INPUT', 'Strategic Brief id is required.');
        }
        const topic = input.intent.topic?.trim();
        if (!topic) {
          throw new ExecutionDeliveryError('INVALID_INPUT', 'Indica el tema del borrador.');
        }
        generationParams = {
          topic,
          format: input.intent.format,
          extras: input.intent.angle?.trim() ? { angle: input.intent.angle.trim() } : undefined,
        };
        break;
      }
      case 'SCIENTIFIC_ARTICLE': {
        gateAction = 'CREATE_CONTENT';
        const title = input.intent.title?.trim();
        if (!title) {
          throw new ExecutionDeliveryError('INVALID_INPUT', 'Scientific title is required.');
        }
        briefId = resolveScientificBriefId(deps, clientId, input.intent.thesisScopeId?.trim() || undefined);
        generationParams = {
          topic: title,
          format: 'ACADEMIC_PAPER',
          extras: {
            roleAngle: input.intent.roleAngle,
            venueLabel: input.intent.venue,
            why: input.intent.why,
          },
        };
        break;
      }
      case 'RECOMMENDATION_TASK_SCRIPT': {
        gateAction = 'CREATE_TASK';
        const recId = input.intent.recommendationId?.trim();
        if (!recId) {
          throw new ExecutionDeliveryError('INVALID_INPUT', 'Recommendation id is required.');
        }
        recommendation = deps.recommendations.getById(recId);
        if (!recommendation) {
          throw new ExecutionDeliveryError('INVALID_INPUT', 'Recommendation not found.');
        }
        if (recommendation.clientId !== clientId) {
          throw new ExecutionDeliveryError(
            'TENANT_CONTEXT_INVALID',
            'Recommendation does not belong to the trusted client.'
          );
        }
        briefId = resolveRecommendationBriefId(deps, recommendation);
        generationParams = {
          topic: recommendation.proposedAngle,
          format: 'VIDEO_SCRIPT',
        };
        claimGateTarget = 'CLIENT_REVIEW';
        claimGateComment = 'Tarea desde recomendación';
        forceAiGeneratedStatus = true;
        break;
      }
      default: {
        const _exhaustive: never = input.intent;
        throw new ExecutionDeliveryError('INVALID_INPUT', `Unknown intent: ${String(_exhaustive)}`);
      }
    }

    const gateResult = deps.downstreamGate.gate(clientId, briefId, gateAction);
    if (!gateResult.ok) {
      throw new ExecutionDeliveryError('STRATEGIC_BRIEF_GATE_DENIED', gateResult.message);
    }
    const gate = gateSnapshot(gateResult);

    const thesis = deps.theses.getById(clientId, gate.thesisId);
    if (!thesis) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'Approved Brief thesis not found.');
    }

    const draft = await deps.generation.generate(
      thesis,
      generationParams.topic,
      generationParams.format,
      generationParams.extras
    );

    const contentId = createId('cnt');
    const content: ContentItem = {
      ...draft,
      id: contentId,
      status: forceAiGeneratedStatus ? 'AI_GENERATED' : draft.status,
      createdAt: input.trusted.now,
      updatedAt: input.trusted.now,
      strategicBriefId: gate.briefId,
      strategicBriefVersion: gate.version,
      signalIds: gate.signalIds,
      supportingEvidenceIds: gate.evidenceIds,
    };

    if (input.intent.kind === 'RECOMMENDATION_TASK_SCRIPT') {
      const advanced = persistWithClaimGate(
        deps,
        input,
        content,
        thesis,
        claimGateTarget!,
        claimGateComment
      );
      const persisted = deps.contents.getById(contentId);
      if (!persisted) {
        throw new ExecutionDeliveryError('PERSISTENCE_ERROR', 'Failed to persist generated content.');
      }
      return {
        content: persisted,
        gate,
        pipelineSynced: advanced,
        advanced,
        recommendation: {
          id: recommendation!.id,
          proposedAngle: recommendation!.proposedAngle,
          signalId: gate.signalIds[0] ?? recommendation!.signalId,
        },
      };
    }

    try {
      deps.creation.createContent(content);
    } catch (err) {
      throw new ExecutionDeliveryError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to persist generated content.'
      );
    }

    const pipelineSynced = syncPipelineAfterCreate(deps, input, contentId, draft.status);
    const persisted = deps.contents.getById(contentId);
    if (!persisted) {
      throw new ExecutionDeliveryError('PERSISTENCE_ERROR', 'Failed to persist generated content.');
    }

    return {
      content: persisted,
      gate,
      pipelineSynced,
    };
  };
}
