/**
 * TEMPORARY LEGACY ADAPTER — CR-1 Execution Delivery #18 send orchestration.
 */

import type { DeliverySendPort } from '../../application/executionDelivery/ports/DeliverySendPort';
import { curationDestinationToDownstreamAction } from '../../domain/briefConsumerCore';
import { createId } from '../../lib/id';
import { aiService } from '../../services/ai';
import { saveDeliveryGeneratedContent } from '../../services/deliveryContentMaterialization';
import { dbService } from '../../services/db';
import { materializeOpportunityForDelivery } from '../../services/opportunityScoutConsumer';
import {
  assertCurationNotPlanAuthority,
  formatPlannedAuthorizationDenial,
  requirePlannedAuthorization,
} from '../../services/strategicPlanConsumer';
import { getStrategicBrief } from '../../services/strategicBriefConsumer';
import { authService } from '../../services/auth';

export function createDbDeliverySendPort(): DeliverySendPort {
  return {
    getPackageById(packageId) {
      return dbService.getDeliveryById(packageId);
    },
    getCurationById(refId) {
      return dbService.getCurationById(refId);
    },
    getThesisById(clientId, thesisId) {
      return dbService.getThesisById(clientId, thesisId);
    },
    gateStrategicDownstream(clientId, briefId, action) {
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
    authorizeDeliveryItem(clientId, item, destination) {
      const action = destination ? curationDestinationToDownstreamAction(destination) : undefined;
      if (!action) {
        return { ok: false, message: 'Strategic destination requires Brief authorization.' };
      }
      const entry = item.refId ? dbService.getCurationById(item.refId) : undefined;
      assertCurationNotPlanAuthority(entry);
      const briefId = item.strategicBriefId || entry?.strategicBriefId;
      const planned = requirePlannedAuthorization({ clientId, briefId, requestedAction: action });
      if (!planned.authorized) {
        return { ok: false, message: formatPlannedAuthorizationDenial(planned) };
      }
      return {
        ok: true,
        briefId: planned.briefId,
        action,
        version: planned.briefVersion,
      };
    },
    generateContentDraft(thesis, title, format) {
      return aiService.generateContentDraft(
        thesis,
        title,
        format as 'VIDEO_SCRIPT' | 'LINKEDIN_ARTICLE' | 'ACADEMIC_PAPER' | 'THOUGHT_LEADERSHIP'
      );
    },
    saveGeneratedContent(content, targetStatus, comment) {
      const user = authService.getCurrentUser();
      if (!user) return false;
      return saveDeliveryGeneratedContent(
        content,
        targetStatus,
        { uid: user.uid, role: user.role },
        comment
      );
    },
    addTask(task) {
      dbService.addTask(task);
    },
    addEvidenceItem(item) {
      dbService.addEvidenceItem(item);
    },
    materializeOpportunity(input) {
      materializeOpportunityForDelivery(input);
    },
    markDeliverySent(packageId, convertedSignalIds) {
      dbService.markDeliverySent(packageId, convertedSignalIds);
    },
    runInBatch(fn) {
      dbService.runInSaveBatch(fn);
    },
    createContentId() {
      return createId('cnt');
    },
  };
}
