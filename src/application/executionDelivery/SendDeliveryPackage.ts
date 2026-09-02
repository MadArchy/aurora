import type { DeliveryItem, PositioningThesis } from '../../types';
import { curationDestinationToDownstreamAction } from '../../domain/briefConsumerCore';
import { readingTaskDescription, validateDeliveryForSend } from '../../domain/deliveryCore';
import { ExecutionDeliveryError } from './errors';
import type { DeliverySendPort } from './ports/DeliverySendPort';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireAdminRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export interface SendDeliveryPackageInput {
  trusted: TrustedExecutionDeliveryContext;
  /** Caller identifies package intent only — Application reloads authoritative package. */
  packageId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export interface SendDeliveryPackageResult {
  packageId: string;
  clientId: string;
  itemCount: number;
  createdTasks: number;
  convertedSignalIds: string[];
}

export interface SendDeliveryPackageDeps {
  delivery: DeliverySendPort;
}

/**
 * CR-1 #18 — SendDeliveryPackage orchestration.
 * Coordinates governed downstream materialization; owns no strategic authority.
 */
export function createSendDeliveryPackage(deps: SendDeliveryPackageDeps) {
  return async function sendDeliveryPackage(
    input: SendDeliveryPackageInput
  ): Promise<SendDeliveryPackageResult> {
    assertTrustedExecutionContext(input.trusted);
    requireAdminRole(input.trusted);
    assertNoExecutionSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
    });

    const pkg = deps.delivery.getPackageById(input.packageId);
    if (!pkg || pkg.clientId !== input.trusted.clientId) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'Briefing no encontrado.');
    }
    if (pkg.organizationId !== input.trusted.organizationId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Delivery package does not belong to the trusted organization.'
      );
    }

    const clientId = input.trusted.clientId;
    const validation = validateDeliveryForSend(
      pkg,
      (item) =>
        item.refId ? deps.delivery.getCurationById(item.refId)?.destination : undefined,
      undefined,
      (item, destination) => deps.delivery.authorizeDeliveryItem(clientId, item, destination)
    );
    if (!validation.ok) {
      throw new ExecutionDeliveryError('STRATEGIC_BRIEF_GATE_DENIED', validation.message);
    }

    type CurationEntry = ReturnType<DeliverySendPort['getCurationById']>;
    type DraftPlan =
      | {
          kind: 'task_content';
          item: DeliveryItem;
          entry?: CurationEntry;
          destination: 'TASK_VIDEO' | 'TASK_ARTICLE';
          draft: Awaited<ReturnType<DeliverySendPort['generateContentDraft']>>;
          thesis: PositioningThesis;
          gate: {
            briefId: string;
            version?: number;
            signalIds: string[];
            evidenceIds: string[];
            planId: string;
            planItemId: string;
          };
        }
      | {
          kind: 'opportunity';
          item: DeliveryItem;
          entry?: CurationEntry;
          thesis: PositioningThesis;
          gate: {
            briefId: string;
            version?: number;
            signalIds: string[];
            evidenceIds: string[];
            planId: string;
            planItemId: string;
          };
        }
      | { kind: 'evidence'; item: DeliveryItem; entry?: CurationEntry; thesis: PositioningThesis }
      | {
          kind: 'reading';
          item: DeliveryItem;
          entry?: CurationEntry;
          thesis: PositioningThesis;
          gate: {
            briefId: string;
            version?: number;
            signalIds: string[];
            evidenceIds: string[];
            planId: string;
            planItemId: string;
          };
        };

    const plans: DraftPlan[] = [];

    for (const item of pkg.items) {
      const entry = item.refId ? deps.delivery.getCurationById(item.refId) : undefined;
      const destination = entry?.destination;

      if (destination === 'EVIDENCE') {
        const thesis = entry?.thesisId
          ? deps.delivery.getThesisById(clientId, entry.thesisId)
          : undefined;
        if (!thesis) {
          throw new ExecutionDeliveryError(
            'INVALID_INPUT',
            'El ítem de evidencia requiere contexto de tesis válido.'
          );
        }
        plans.push({ kind: 'evidence', item, entry, thesis });
        continue;
      }

      const action = destination ? curationDestinationToDownstreamAction(destination) : undefined;
      if (!action) {
        if (item.kind === 'READING') {
          const gate = deps.delivery.gateStrategicDownstream(
            clientId,
            item.strategicBriefId || entry?.strategicBriefId,
            'CREATE_TASK'
          );
          if (!gate.ok) {
            throw new ExecutionDeliveryError('STRATEGIC_BRIEF_GATE_DENIED', gate.message);
          }
          const thesis = deps.delivery.getThesisById(clientId, gate.thesisId);
          if (!thesis) {
            throw new ExecutionDeliveryError('INVALID_INPUT', 'Approved Brief thesis not found.');
          }
          plans.push({ kind: 'reading', item, entry, thesis, gate });
        }
        continue;
      }

      const gate = deps.delivery.gateStrategicDownstream(
        clientId,
        item.strategicBriefId || entry?.strategicBriefId,
        action
      );
      if (!gate.ok) {
        throw new ExecutionDeliveryError('STRATEGIC_BRIEF_GATE_DENIED', gate.message);
      }

      const thesis = deps.delivery.getThesisById(clientId, gate.thesisId);
      if (!thesis) {
        throw new ExecutionDeliveryError('INVALID_INPUT', 'Approved Brief thesis not found.');
      }

      if (destination === 'TASK_VIDEO' || destination === 'TASK_ARTICLE') {
        const format = destination === 'TASK_VIDEO' ? 'VIDEO_SCRIPT' : 'LINKEDIN_ARTICLE';
        const draft = await deps.delivery.generateContentDraft(thesis, item.title, format);
        plans.push({ kind: 'task_content', item, entry, destination, draft, thesis, gate });
      } else if (destination === 'OPPORTUNITY') {
        plans.push({ kind: 'opportunity', item, entry, thesis, gate });
      } else if (destination === 'REFERENCE_READING') {
        plans.push({ kind: 'reading', item, entry, thesis, gate });
      }
    }

    let createdTasks = 0;
    const convertedSignalIds: string[] = [];

    deps.delivery.runInBatch(() => {
      for (const plan of plans) {
        if (plan.kind === 'task_content') {
          const contentId = deps.delivery.createContentId();
          deps.delivery.saveGeneratedContent(
            {
              ...plan.draft,
              id: contentId,
              status: 'AI_GENERATED',
              managerNotes: `${plan.draft.managerNotes || ''} Justificación: ${plan.item.rationale || 'sin nota'}`.trim(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              strategicBriefId: plan.gate.briefId,
              strategicBriefVersion: plan.gate.version,
              signalIds: plan.gate.signalIds,
              supportingEvidenceIds: plan.gate.evidenceIds,
            },
            'CLIENT_REVIEW',
            'Enviado con briefing'
          );

          deps.delivery.addTask({
            organizationId: plan.thesis.organizationId,
            clientId,
            thesisId: plan.thesis.id,
            type: plan.destination === 'TASK_VIDEO' ? 'RECORD_VIDEO' : 'REVIEW_ARTICLE',
            title: plan.item.title.slice(0, 90),
            description: plan.item.rationale || 'Preparado por tu Brand Manager.',
            estimatedMinutes: plan.destination === 'TASK_VIDEO' ? 15 : 20,
            status: 'ASSIGNED',
            contentItemId: contentId,
            curationEntryId: plan.entry?.id,
            deliveryPackageId: input.packageId,
            scriptPayload: plan.draft.teleprompterScript,
            strategicBriefId: plan.gate.briefId,
            strategicBriefVersion: plan.gate.version,
            signalId: plan.gate.signalIds[0],
          });
          createdTasks += 1;
          for (const sid of plan.gate.signalIds) convertedSignalIds.push(sid);
        } else if (plan.kind === 'opportunity') {
          deps.delivery.materializeOpportunity({
            clientId,
            planId: plan.gate.planId,
            planItemId: plan.gate.planItemId,
            thesisId: plan.thesis.id,
            title: plan.item.title.slice(0, 120),
            organization: plan.entry?.sourceName || 'Por confirmar',
            type: 'PANEL',
            deadline: new Date(Date.now() + 21 * 86400000).toISOString(),
            description: plan.item.note || plan.item.title,
            fitRationale: plan.item.rationale || 'Alineado con la tesis activa.',
            strategicBriefId: plan.gate.briefId,
            strategicBriefVersion: plan.gate.version,
            signalId: plan.gate.signalIds[0],
            intentKey: `delivery:${input.packageId}:opp:${plan.item.id || plan.item.title}`,
          });
          for (const sid of plan.gate.signalIds) convertedSignalIds.push(sid);
        } else if (plan.kind === 'evidence') {
          deps.delivery.addEvidenceItem({
            organizationId: plan.thesis.organizationId,
            clientId,
            title: plan.item.title.slice(0, 120),
            type: 'DOCUMENT',
            sourceUrl: plan.item.url,
            snippet: plan.item.note || plan.item.title,
            confidenceScore: 70,
            verified: false,
            associatedThesesIds: [plan.thesis.id],
          });
        } else if (plan.kind === 'reading') {
          deps.delivery.addTask({
            organizationId: plan.thesis.organizationId,
            clientId,
            thesisId: plan.thesis.id,
            type: 'SUBMIT_INFO',
            title: `Leer: ${plan.item.title.slice(0, 80)}`,
            description: readingTaskDescription(plan.item),
            estimatedMinutes: 10,
            status: 'ASSIGNED',
            curationEntryId: plan.entry?.id,
            deliveryPackageId: input.packageId,
            strategicBriefId: plan.gate.briefId,
            strategicBriefVersion: plan.gate.version,
            signalId: plan.gate.signalIds[0],
          });
          createdTasks += 1;
          for (const sid of plan.gate.signalIds) convertedSignalIds.push(sid);
        }
      }
      deps.delivery.markDeliverySent(input.packageId, [...new Set(convertedSignalIds)]);
    });

    return {
      packageId: input.packageId,
      clientId,
      itemCount: pkg.items.length,
      createdTasks,
      convertedSignalIds: [...new Set(convertedSignalIds)],
    };
  };
}
