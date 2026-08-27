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
 * NOT EXPOSED — commands whose legacy implementation writes business state with
 * no canonical Application use case (AUDIT010-09). Routing one through this seam
 * would make the UI layer perform a legacy business mutation, so each stays on
 * the legacy path until a canonical use case exists, which is other-SPEC work
 * outside SPEC-010's authority. The complete registry lives in
 * `specs/010-react-migration/audit010-09-registry.md`; in summary:
 *
 *   - invitation acceptance      (`markInvitationAccepted`, `updateClient`)
 *   - profile fact lifecycle     (`addProfileFact`, `confirmProfileFact`,
 *                                 `rejectProfileFact`, `updateProfileFact`,
 *                                 `importCandidateFactsFromCv`)
 *   - proof-wall status toggle   (`updateProofWallItem`)
 *   - source registration        (`addSource`) and ingestion polling
 *   - onboarding step apply      (`applyOnboardingStep`)
 *
 * In every case the legacy ordering is sound (gate before effect) and the legacy
 * surface remains served, so no capability is lost by not migrating it.
 */

import { authService } from '../../services/auth';
import { auditService } from '../../services/audit';
import {
  acceptClientOpportunity,
  declineClientOpportunity,
  submitClientOpportunity,
  toggleClientOpportunityChecklistItem,
} from '../../services/opportunityScoutConsumer';
import { registerResultRecordIntent } from '../../services/learningLoopConsumer';
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
