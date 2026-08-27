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
 * Wave 1 owns the shell and login surfaces, whose commands are session and
 * presentation commands only — it has no strategic command. Strategic command
 * hooks are added by the phase that migrates the module needing them, so that
 * each arrives with its own parity and adversarial evidence. This seam therefore
 * exposes session commands now and is the single place later commands are added.
 *
 * NOT EXPOSED — invitation acceptance (AUDIT010-09). After the auth gate the
 * legacy flow performs `dbService.markInvitationAccepted` and
 * `dbService.updateClient`, business writes with no canonical Application use
 * case. Routing them through this seam would make the UI layer perform a legacy
 * business mutation, so invitation acceptance stays on the legacy path until a
 * canonical use case exists. The ordering itself is sound (gate before effect).
 */

import { authService } from '../../services/auth';

export type CommandResult = { ok: true } | { ok: false; message: string };

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
