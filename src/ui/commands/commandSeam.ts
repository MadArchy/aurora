/**
 * SPEC-010 · UI command seam.
 *
 * AUTHORITY: NONE. A React intent is a request, never a decision.
 *
 * Required shape for every UI-originated command:
 *
 *   React intent → this seam → canonical consumer / Application use case
 *                → Domain → Ports → Infrastructure
 *
 * Forbidden here and in every React module: `dbService` mutation, `Local*Store`
 * write, Firestore write, target-SPEC persistence, AI provider call
 * (threats T-010-01…04).
 *
 * Wave 1 exposed session commands only. Wave 2 (T-010-201…204) adds the
 * commands whose legacy handler already reaches a canonical consumer, so a
 * migrated command is a change of caller, never a change of authority: React and
 * legacy converge on the identical use case.
 *
 * CR-1 Client Lifecycle (#34, #1), Master Profile (#10), Thesis Lifecycle
 * (#11–#13), Signal Intake (#8/#24/#26), and Execution Delivery (#28/#31/#32)
 * are exposed below. Other AUDIT010-09 writes remain unexposed until their
 * Application owners exist
 * (full registry: `specs/010-react-migration/audit010-09-registry.md`):
 *
 *   - profile fact lifecycle     (`addProfileFact`, `confirmProfileFact`,
 *                                 `rejectProfileFact`, `updateProfileFact`,
 *                                 `importCandidateFactsFromCv`)
 *   - proof-wall status toggle   (`updateProofWallItem`)
 *
 * In every remaining case the legacy surface remains served, so no capability is
 * lost by not migrating it yet.
 */

import { authService } from '../../services/auth';
import { auditService } from '../../services/audit';
import {
  acceptClientOpportunity,
  declineClientOpportunity,
  submitClientOpportunity,
  toggleClientOpportunityChecklistItem,
} from '../../services/opportunityScoutConsumer';
import {
  registerResultRecordIntent,
  registerSignalOutcomeIntent,
} from '../../services/learningLoopConsumer';
import { approveStrategicBrief } from '../../services/strategicBriefConsumer';
import {
  acceptClientInvitation,
  createClientWithInvite,
} from '../../services/clientLifecycleConsumer';
import { applyOnboardingStep } from '../../services/masterProfileConsumer';
import {
  activateThesis,
  decideThesisClientReview,
  saveThesis,
} from '../../services/thesisLifecycleConsumer';
import {
  registerManualSignal,
  registerSource,
} from '../../services/signalIntakeConsumer';
import {
  reviewClientArticle,
  saveContentDraft,
  transitionClientTask,
} from '../../services/executionDeliveryConsumer';
import { ClientLifecycleError } from '../../application/clientLifecycle';
import { MasterProfileError } from '../../application/masterProfile';
import { ThesisLifecycleError } from '../../application/thesisLifecycle';
import { SignalIntakeError } from '../../application/signalIntake';
import { ExecutionDeliveryError } from '../../application/executionDelivery';
import type { ContentStatus, ContentType, SourceType, ThesisEditableFields } from '../../types';
import type { ThesisSaveIntent } from '../../domain/thesisRevisionCore';
import { downloadDossierMarkdown, formatDossierMarkdown } from '../../services/dossierExport';
import type { Client, MasterDossier } from '../../types';
import type { TrustedTenantScope } from '../query/tenantScope';

export type CommandResult = { ok: true } | { ok: false; message: string };

/**
 * Wraps a canonical call so a rejection reaches the UI as a message instead of
 * an unhandled throw. The seam never inspects the reason and never retries: the
 * canonical layer's verdict is final, and a failed command leaves no UI state
 * claiming otherwise.
 */
function attempt(run: () => void, fallbackMessage: string): CommandResult {
  try {
    run();
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : fallbackMessage };
  }
}

/**
 * Session commands.
 *
 * These delegate to the trusted auth runtime (SPEC-009), which remains the sole
 * authority over identity. The seam never inspects or asserts a role, and never
 * decides whether a login should succeed — it forwards credentials and returns
 * the runtime's verdict.
 */
export const sessionCommands = {
  async login(email: string, password: string): Promise<CommandResult> {
    const result = await authService.login(email, password);
    return result.ok ? { ok: true } : { ok: false, message: result.message };
  },

  logout(): void {
    authService.logout();
  },

  returnToManager(): void {
    authService.returnToManager();
  },
} as const;

/**
 * SPEC-007 Opportunity commands (wave 2, T-010-202).
 *
 * Every one of these delegates to `opportunityScoutConsumer`, the canonical
 * consumer the legacy controller already calls, so the React and legacy buttons
 * reach the identical Application use case, Domain rules and lifecycle guard.
 *
 * The trusted tenant scope is passed as the claimed identity, which means the
 * consumer's own tenant validation runs against trusted values. Nothing here
 * supplies `actorType`, `role` or a forged snapshot — the consumer ignores those
 * inputs anyway, and the seam must not be the place that starts sending them
 * (threats T-010-09…11).
 *
 * Only ids and user-authored notes cross this boundary. No cached aggregate is
 * ever passed as state, so the canonical layer always loads current state
 * itself (caller snapshot authority 0, threat T-010-07).
 */
export const opportunityCommands = {
  accept(scope: TrustedTenantScope, opportunityId: string, notes?: string): CommandResult {
    if (!scope.clientId) return { ok: false, message: 'Cliente no resuelto' };
    return attempt(
      () =>
        acceptClientOpportunity({
          clientId: scope.clientId!,
          opportunityId,
          notes,
          claimedOrganizationId: scope.organizationId,
          claimedClientId: scope.clientId!,
        }),
      'No se pudo aceptar la oportunidad'
    );
  },

  /**
   * Declining requires notes, matching the legacy feedback modal, which will not
   * submit without them. The check is an input-shape guard, not an authorization
   * decision — the canonical consumer still rules on the transition.
   */
  decline(scope: TrustedTenantScope, opportunityId: string, notes: string): CommandResult {
    if (!scope.clientId) return { ok: false, message: 'Cliente no resuelto' };
    if (!notes.trim()) return { ok: false, message: 'Escribe tus observaciones para declinar' };
    return attempt(
      () =>
        declineClientOpportunity({
          clientId: scope.clientId!,
          opportunityId,
          notes: notes.trim(),
          claimedOrganizationId: scope.organizationId,
          claimedClientId: scope.clientId!,
        }),
      'No se pudo declinar la oportunidad'
    );
  },

  toggleChecklistItem(
    scope: TrustedTenantScope,
    opportunityId: string,
    itemId: string,
    done: boolean
  ): CommandResult {
    if (!scope.clientId) return { ok: false, message: 'Cliente no resuelto' };
    return attempt(
      () =>
        toggleClientOpportunityChecklistItem({
          clientId: scope.clientId!,
          opportunityId,
          itemId,
          done,
          claimedOrganizationId: scope.organizationId,
          claimedClientId: scope.clientId!,
        }),
      'No se pudo actualizar el checklist'
    );
  },

  /**
   * Marking a submission as sent is a canonical lifecycle transition. The React
   * button is enabled only when the projection says the checklist is complete,
   * but that is presentation: the consumer re-validates and may still refuse.
   */
  submit(scope: TrustedTenantScope, opportunityId: string): CommandResult {
    if (!scope.clientId) return { ok: false, message: 'Cliente no resuelto' };
    return attempt(
      () =>
        submitClientOpportunity({
          clientId: scope.clientId!,
          opportunityId,
          claimedOrganizationId: scope.organizationId,
          claimedClientId: scope.clientId!,
        }),
      'No se pudo marcar la postulación'
    );
  },
} as const;

/**
 * SPEC-008 result/KPI intent (wave 2, T-010-203).
 *
 * `registerResultRecordIntent` is the canonical learning-loop consumer the
 * legacy quick form already uses. It resolves the trusted context itself and
 * discards any caller-supplied actor, so the React path cannot become a second
 * way to assert identity.
 */
export const resultCommands = {
  registerConsultation(scope: TrustedTenantScope, note: string): CommandResult {
    if (!scope.clientId) return { ok: false, message: 'Cliente no resuelto' };
    const trimmed = note.trim();
    return attempt(
      () =>
        registerResultRecordIntent({
          clientId: scope.clientId!,
          title: trimmed ? `Consulta: ${trimmed}` : 'Consulta recibida',
          channel: 'LinkedIn / Web',
          metricLabel: 'Consultas recibidas',
          metricValue: 1,
          kpiType: 'consultation_requests',
          notes: trimmed || undefined,
          claimedOrganizationId: scope.organizationId,
          claimedClientId: scope.clientId!,
        }),
      'No se pudo registrar la consulta'
    );
  },
} as const;

/**
 * SPEC-008 signal-outcome intent (wave 3, T-010-305).
 *
 * The radar's "¿sirvió?" Sí/No control is one of the few workspace actions whose
 * legacy handler already reaches a canonical consumer
 * (`registerSignalOutcomeIntent`, `ClientWorkspace` radar → `main.ts:2534`), so
 * migrating it changes the caller and nothing else.
 *
 * `thesisId` is forwarded only when the caller was given one by a canonical
 * projection. React never picks a thesis to attribute an outcome to: an
 * unattributed outcome stays unattributed (threat T-010-15).
 */
export const signalOutcomeCommands = {
  register(
    scope: TrustedTenantScope,
    params: {
      signalId: string;
      kind: 'USEFUL' | 'NOT_USEFUL';
      thesisId?: string | null;
      note?: string;
    }
  ): CommandResult {
    if (!scope.clientId) return { ok: false, message: 'Cliente no resuelto' };
    return attempt(
      () =>
        registerSignalOutcomeIntent({
          clientId: scope.clientId!,
          signalId: params.signalId,
          kind: params.kind,
          source: 'RADAR',
          thesisId: params.thesisId ?? undefined,
          note: params.note?.trim() || undefined,
          claimedOrganizationId: scope.organizationId,
          claimedClientId: scope.clientId!,
        }),
      'No se pudo registrar el resultado de la señal'
    );
  },
} as const;

/**
 * SPEC-003 Strategic Brief approval (wave 3, T-010-305).
 *
 * `approveStrategicBrief` is canonical in the legacy controller too
 * (`main.ts:2757`) and takes ids only, resolving the trusted actor context
 * itself. Approval authority stays entirely inside SPEC-003: the seam forwards
 * the id and returns the consumer's verdict. It never marks a brief approved in
 * the UI, and a refused approval leaves no optimistic state behind (T-010-14).
 *
 * NOT EXPOSED — brief creation. CR-2 (2026-08-28) changed
 * `createBriefFromCurationEntry` to id-based authoritative reload
 * (`curationEntryId` only). The seam still does not expose brief creation until
 * a presentation migration explicitly adopts the consumer; legacy UI invokes it
 * directly from `main.ts`.
 */
export const briefCommands = {
  approve(scope: TrustedTenantScope, briefId: string): CommandResult {
    if (!scope.clientId) return { ok: false, message: 'Cliente no resuelto' };
    return attempt(
      () =>
        approveStrategicBrief({
          clientId: scope.clientId!,
          briefId,
        }),
      'No se pudo aprobar el Strategic Brief'
    );
  },
} as const;

/**
 * CR-1 Client Lifecycle (#34 CreateClientWithInvite, #1 AcceptClientInvitation).
 *
 * Seam authority = 0. Both commands delegate to `clientLifecycleConsumer`, which
 * gates create via `requireAdminActor` and loads invitation state for accept.
 * React and legacy (`main.ts`) must converge on these identical use cases.
 */
export const clientLifecycleCommands = {
  createClientWithInvite(intent: {
    firstName: string;
    lastName: string;
    email: string;
    profession?: string;
    company?: string;
    targetMarket?: string;
    claimedOrganizationId?: string;
  }): CommandResult {
    return attempt(
      () => {
        createClientWithInvite(intent);
      },
      'No se pudo crear el cliente'
    );
  },

  async acceptInvitation(intent: {
    token: string;
    password: string;
    displayName: string;
  }): Promise<CommandResult> {
    try {
      await acceptClientInvitation(intent);
      return { ok: true };
    } catch (err) {
      if (err instanceof ClientLifecycleError) {
        return { ok: false, message: err.message };
      }
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'No se pudo aceptar la invitación',
      };
    }
  },
} as const;

/**
 * CR-1 Master Profile (#10 ApplyOnboardingStep).
 *
 * Seam authority = 0. Delegates to `masterProfileConsumer`, which gates via
 * `requireTenantScope`. React and legacy must converge on this use case.
 */
export const masterProfileCommands = {
  applyOnboardingStep(intent: {
    requestedClientId: string | null | undefined;
    step: number;
    fields: Record<string, string>;
    claimedOrganizationId?: string;
    claimedClientId?: string;
    claimedProfileCompleteness?: number;
    claimedOnboardingStatus?: string;
    claimedClientStatus?: string;
  }): CommandResult {
    try {
      applyOnboardingStep(intent);
      return { ok: true };
    } catch (err) {
      if (err instanceof MasterProfileError) {
        return { ok: false, message: err.message };
      }
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'No se pudo guardar el onboarding',
      };
    }
  },
} as const;

/**
 * CR-1 Thesis Lifecycle (#11 SaveThesis, #12 ActivateThesis, #13 DecideThesisClientReview).
 * Seam authority = 0. Explicit thesisId required — no positional thesis authority.
 */
export const thesisLifecycleCommands = {
  saveThesis(intent: {
    requestedClientId: string | null | undefined;
    thesisId: string;
    intent: ThesisSaveIntent;
    fields: ThesisEditableFields;
  }): CommandResult {
    try {
      saveThesis(intent);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ThesisLifecycleError || err instanceof Error
            ? err.message
            : 'No se pudo guardar la tesis',
      };
    }
  },

  activateThesis(intent: {
    requestedClientId: string | null | undefined;
    thesisId: string;
  }): CommandResult {
    try {
      activateThesis(intent);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ThesisLifecycleError || err instanceof Error
            ? err.message
            : 'No se pudo activar la tesis',
      };
    }
  },

  decideClientReview(intent: {
    requestedClientId: string | null | undefined;
    thesisId: string;
    decision: 'approve' | 'request_changes';
    feedback?: string;
  }): CommandResult {
    try {
      decideThesisClientReview(intent);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ThesisLifecycleError || err instanceof Error
            ? err.message
            : 'No se pudo registrar la decisión',
      };
    }
  },
} as const;

/**
 * CR-1 Signal Intake (#8/#24 RegisterSource, #26 RegisterManualSignal).
 * Seam authority = 0. No routing/scoring/thesis authority.
 */
export const signalIntakeCommands = {
  registerSource(intent: {
    requestedClientId: string | null | undefined;
    name: string;
    type: SourceType;
    url?: string;
    fetchIntervalMinutes?: number;
  }): CommandResult {
    try {
      registerSource(intent);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof SignalIntakeError || err instanceof Error
            ? err.message
            : 'No se pudo registrar la fuente',
      };
    }
  },

  registerManualSignal(intent: {
    requestedClientId: string | null | undefined;
    title: string;
    contentSnippet?: string;
    sourceUrl?: string;
  }): CommandResult {
    try {
      const result = registerManualSignal(intent);
      if (result.isDuplicate) {
        return { ok: false, message: 'Esta señal ya estaba registrada.' };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof SignalIntakeError || err instanceof Error
            ? err.message
            : 'No se pudo registrar la señal',
      };
    }
  },
} as const;

/**
 * CR-1 Execution Delivery (#28 TransitionClientTask, #31 SaveContentDraft, #32 ReviewClientArticle).
 * Seam authority = 0. Claim safety / learning / providers not owned here.
 */
export const executionDeliveryCommands = {
  transitionClientTask(intent: {
    requestedClientId: string | null | undefined;
    taskId: string;
    intent: 'view' | 'start' | 'complete' | 'cancel' | 'request_changes' | 'attach_evidence';
    evidenceUrl?: string;
    clientNotes?: string;
  }): CommandResult {
    try {
      transitionClientTask(intent);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ExecutionDeliveryError || err instanceof Error
            ? err.message
            : 'No se pudo actualizar la tarea',
      };
    }
  },

  saveContentDraft(intent: {
    requestedClientId: string | null | undefined;
    contentId: string;
    fields: {
      title?: string;
      body?: string;
      type?: ContentType;
      targetPlatform?: 'LinkedIn' | 'YouTube' | 'PersonalWebsite' | 'Substack' | 'LegalJournal';
      teleprompterScript?: string;
      managerNotes?: string;
    };
    requestedTargetStatus?: ContentStatus;
  }): CommandResult {
    try {
      saveContentDraft(intent);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ExecutionDeliveryError || err instanceof Error
            ? err.message
            : 'No se pudo guardar el borrador',
      };
    }
  },

  reviewClientArticle(intent: {
    requestedClientId: string | null | undefined;
    contentId: string;
    decision: 'save_revision' | 'approve' | 'request_changes';
    title?: string;
    body?: string;
    reason?: string;
    taskId?: string;
  }): CommandResult {
    try {
      reviewClientArticle(intent);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ExecutionDeliveryError || err instanceof Error
            ? err.message
            : 'No se pudo registrar la revisión',
      };
    }
  },
} as const;

/**
 * Dossier export (wave 2, T-010-201) — PRESENTATION_ONLY.
 *
 * Copying or downloading Markdown formats data the user is already looking at.
 * No business state changes: `dossierExport` is a pure formatter plus a browser
 * download, and the audit entry is observability, written by the same trusted
 * service the legacy handler uses. No `dbService` mutation is involved, which is
 * why this is allowed to cross the seam while a real legacy write is not.
 */
export const dossierPresentationCommands = {
  async copyMarkdown(dossier: MasterDossier, client: Client): Promise<CommandResult> {
    const markdown = formatDossierMarkdown(dossier, client);
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      return { ok: false, message: 'No se pudo copiar al portapapeles' };
    }
    auditService.log(authService.getCurrentUser(), 'COPY_DOSSIER', 'MasterDossier', client.id);
    return { ok: true };
  },

  download(dossier: MasterDossier, client: Client): CommandResult {
    downloadDossierMarkdown(dossier, client);
    auditService.log(authService.getCurrentUser(), 'EXPORT_DOSSIER', 'MasterDossier', client.id);
    return { ok: true };
  },
} as const;
