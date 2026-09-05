/**
 * TEMPORARY LEGACY ADAPTER — CR-1 Execution Delivery #33 create content draft.
 */

import type {
  ContentBriefListPort,
  ContentCreationPersistencePort,
  ContentDraftGenerationPort,
  ContentStrategicDownstreamGatePort,
  RecommendationReadPort,
} from '../../application/executionDelivery';
import {
  formatPlannedAuthorizationDenial,
  requirePlannedAuthorization,
} from '../../services/strategicPlanConsumer';
import {
  findApprovedBriefForSignal,
  getStrategicBrief,
  listStrategicBriefs,
} from '../../services/strategicBriefConsumer';
import { aiService } from '../../services/ai';
import { dbService } from '../../services/db';

export function createDbContentDraftGenerationPort(): ContentDraftGenerationPort {
  return {
    generate(thesis, topicTitle, format, extras) {
      return aiService.generateContentDraft(thesis, topicTitle, format, extras);
    },
    reviewDraftClaims(body, thesis) {
      return aiService.reviewDraftClaims(body, thesis);
    },
  };
}

export function createDbContentCreationPersistencePort(): ContentCreationPersistencePort {
  return {
    createContent(content) {
      dbService.saveContent(content);
    },
  };
}

export function createDbContentStrategicDownstreamGatePort(): ContentStrategicDownstreamGatePort {
  return {
    gate(clientId, briefId, action) {
      const planned = requirePlannedAuthorization({ clientId, briefId, requestedAction: action });
      if (!planned.authorized || !planned.planId || !planned.planItemId || !planned.thesisId) {
        return { ok: false, message: formatPlannedAuthorizationDenial(planned) };
      }
      const brief = getStrategicBrief(planned.briefId, clientId);
      if (!brief) {
        return {
          ok: false,
          message: 'Strategic Brief required — create and approve a Brief for this signal first.',
        };
      }
      return {
        ok: true,
        briefId: brief.id,
        version: planned.briefVersion ?? brief.version,
        thesisId: planned.thesisId,
        signalIds: planned.signalIds ?? [...brief.signalIds],
        evidenceIds: planned.evidenceIds ?? [...brief.supportingEvidenceIds],
        planId: planned.planId,
        planItemId: planned.planItemId,
      };
    },
  };
}

export function createDbContentBriefListPort(): ContentBriefListPort {
  return {
    listApprovedBriefs(clientId, authorizedAction) {
      return listStrategicBriefs(clientId).filter(
        (b) =>
          b.status === 'APPROVED' &&
          !b.supersededByBriefId &&
          b.decision.authorizedAction === authorizedAction
      );
    },
    findApprovedBriefForSignal(params) {
      return findApprovedBriefForSignal(params);
    },
  };
}

export function createDbRecommendationReadPort(): RecommendationReadPort {
  return {
    getById(recommendationId) {
      return dbService.getRecommendations().find((r) => r.id === recommendationId);
    },
  };
}
