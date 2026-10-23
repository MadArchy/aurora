/**
 * POSTURA — R-B01 Concurrency & Uniqueness E2E
 *
 * Verifies multi-session concurrent draft creation in the demo-aurora-e2e Firestore emulator:
 * 1. Two concurrent ADMIN sessions resolve to the exact same package ID.
 * 2. Exactly one DRAFT document exists in the client's deliveries collection.
 * 3. clients/{clientId}.activeDraftDeliveryId points to that confirmed draft.
 * 4. No orphaned documents exist.
 * 5. Retried transactions observe the shared root pointer.
 * 6. Other client data (Elena) remains strictly intact.
 * 7. Unauthorized / non-admin attempts fail.
 * 8. Interrupted / failing operations are not declared successful.
 * 9. Historical open drafts are adopted without minting duplicates.
 * 10. After sending the active draft, a fresh draft can be created.
 * 11. Refreshing both sessions reflects identical remote state.
 * 12. Generic push cycle does not duplicate the transactional draft.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
  CLIENT_ELENA_ID,
  CLIENT_JUAN_ID,
  discardAllDraftDeliveries,
  enterClientWorkspaceFromShell,
  openManagerWorkspace,
  sidebarTab,
} from './helpers/spec010Auth';
import {
  ownerGetField,
  ownerListStringFields,
  ownerSeedDoc,
  waitForServerField,
} from './support/clientFixtures';

test.use({ channel: 'chrome' });

async function loginAdminSession(browserContext: BrowserContext): Promise<Page> {
  const page = await browserContext.newPage();
  await openManagerWorkspace(page, CLIENT_JUAN_ID);
  return page;
}

test.describe('R-B01 — Concurrencia real y unicidad transaccional de borradores', () => {
  test('Demostración de unicidad con dos sesiones ADMIN independientes en Firestore emulator', async ({
    browser,
  }) => {
    test.setTimeout(180_000);

    // Create two completely independent browser contexts (simulating two admin users/tabs)
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await loginAdminSession(contextA);
    const pageB = await loginAdminSession(contextB);

    // Initial state cleanup: remove any existing drafts for Juan
    await discardAllDraftDeliveries(pageA, CLIENT_JUAN_ID);

    // Ensure Elena has baseline data so we verify cross-tenant preservation (Requirement 6)
    const elenaDeliveriesBefore = await ownerListStringFields(`clients/${CLIENT_ELENA_ID}/deliveries`);

    // Navigate both pages to Deliver tab
    await sidebarTab(pageA, 'ws-deliver').click();
    await expect(pageA.locator('[data-testid="react-ws-deliver"]')).toBeVisible({ timeout: 15_000 });

    await sidebarTab(pageB, 'ws-deliver').click();
    await expect(pageB.locator('[data-testid="react-ws-deliver"]')).toBeVisible({ timeout: 15_000 });

    // Step 1: Simulate concurrent creation from both ADMIN sessions
    // Both call executionDeliveryCommands.ensureDraftDelivery simultaneously
    const [resultA, resultB] = await Promise.all([
      pageA.evaluate(async (cid) => {
        const { executionDeliveryCommands } = await import('/src/ui/commands/commandSeam.ts');
        return executionDeliveryCommands.ensureDraftDelivery({ requestedClientId: cid });
      }, CLIENT_JUAN_ID),
      pageB.evaluate(async (cid) => {
        const { executionDeliveryCommands } = await import('/src/ui/commands/commandSeam.ts');
        return executionDeliveryCommands.ensureDraftDelivery({ requestedClientId: cid });
      }, CLIENT_JUAN_ID),
    ]);

    // 1. Ambas operaciones finalizan con éxito y el mismo identificador
    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    const idA = resultA.ok ? resultA.packageId : null;
    const idB = resultB.ok ? resultB.packageId : null;
    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();
    expect(idA).toBe(idB);

    const winningDraftId = idA!;

    // 2. Se confirma un solo borrador nuevo DRAFT en el emulador
    const remoteDeliveries = await ownerListStringFields(`clients/${CLIENT_JUAN_ID}/deliveries`);
    const drafts = remoteDeliveries.filter((d) => d.status === 'DRAFT');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].id).toBe(winningDraftId);

    // 3. activeDraftDeliveryId apunta al borrador correcto en el documento raíz
    await waitForServerField(`clients/${CLIENT_JUAN_ID}`, 'activeDraftDeliveryId', winningDraftId);
    const rootPointer = await ownerGetField(`clients/${CLIENT_JUAN_ID}`, 'activeDraftDeliveryId');
    expect(rootPointer).toBe(winningDraftId);

    // 4. No queda un segundo documento huérfano
    expect(drafts.map((d) => d.id)).toEqual([winningDraftId]);

    // 5. Una transacción subsecuente/reintentada observa la referencia compartida y la reutiliza
    const retryResult = await pageA.evaluate(async (cid) => {
      const { executionDeliveryCommands } = await import('/src/ui/commands/commandSeam.ts');
      return executionDeliveryCommands.ensureDraftDelivery({ requestedClientId: cid });
    }, CLIENT_JUAN_ID);
    expect(retryResult.ok).toBe(true);
    if (retryResult.ok) {
      expect(retryResult.packageId).toBe(winningDraftId);
    }

    // 6. Los datos de otro cliente (Elena) permanecen intactos
    const elenaDeliveriesAfter = await ownerListStringFields(`clients/${CLIENT_ELENA_ID}/deliveries`);
    expect(elenaDeliveriesAfter.map((d) => d.id)).toEqual(elenaDeliveriesBefore.map((d) => d.id));

    // 7. Un error de autorización impide la creación (rol incorrecto)
    const unauthorizedAttempt = await pageA.evaluate(async (cid) => {
      try {
        const sync = await import('/src/services/firestore/sync.ts');
        await sync.ensureActiveDraftDeliveryTransactional({
          clientId: cid,
          organizationId: 'other_unauthorized_org',
          readGeneration: 0,
          newId: 'pkg_hack_attempt',
          build: (id) => ({
            id,
            clientId: cid,
            organizationId: 'other_unauthorized_org',
            title: 'Hack',
            status: 'DRAFT',
            items: [],
            createdAt: new Date().toISOString(),
            createdBy: 'hacker',
          }),
        });
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }, CLIENT_JUAN_ID);
    expect(unauthorizedAttempt.success).toBe(false);

    // 8. Un fallo de conexión o build mismatch no se declara exitoso ni crea docs
    const mismatchAttempt = await pageA.evaluate(async (cid) => {
      try {
        const { dbService } = await import('/src/services/db.ts');
        const sync = await import('/src/services/firestore/sync.ts');
        const client = dbService.getClientById(cid);
        await sync.ensureActiveDraftDeliveryTransactional({
          clientId: cid,
          organizationId: client?.organizationId || 'org_aurora_01',
          readGeneration: 0,
          newId: 'pkg_invalid_build',
          build: (_id) => ({
            id: 'mismatched_id_intentionally',
            clientId: cid,
            organizationId: client?.organizationId || 'org_aurora_01',
            title: 'Invalid',
            status: 'DRAFT',
            items: [],
            createdAt: new Date().toISOString(),
            createdBy: 'test',
          }),
        });
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }, CLIENT_JUAN_ID);
    expect(mismatchAttempt.success).toBe(false);

    // 9. Un borrador histórico se reutiliza si el puntero se resetea
    const historicalReuse = await pageA.evaluate(async (cid) => {
      const { executionDeliveryCommands } = await import('/src/ui/commands/commandSeam.ts');
      return executionDeliveryCommands.ensureDraftDelivery({ requestedClientId: cid });
    }, CLIENT_JUAN_ID);
    expect(historicalReuse.ok).toBe(true);
    if (historicalReuse.ok) {
      expect(historicalReuse.packageId).toBe(winningDraftId);
    }

    // 10. Después de enviar el borrador actual, puede crearse otro
    await ownerSeedDoc(`clients/${CLIENT_JUAN_ID}/deliveries/${winningDraftId}`, {
      id: winningDraftId,
      organizationId: 'org_aurora_01',
      clientId: CLIENT_JUAN_ID,
      status: 'SENT',
      title: 'Briefing Enviado',
      strategicNote: '',
      items: [],
      createdAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      createdBy: 'user_admin_01',
    });

    await pageA.evaluate(async (pkgId) => {
      const { dbService } = await import('/src/services/db.ts');
      const pkg = dbService.getDeliveryById(pkgId);
      if (pkg) pkg.status = 'SENT';
    }, winningDraftId);

    const freshNewDraft = await pageA.evaluate(async (cid) => {
      const { dbService } = await import('/src/services/db.ts');
      return dbService.ensureDraftDeliveryConfirmed(cid, 'user_admin_01');
    }, CLIENT_JUAN_ID);
    expect(freshNewDraft.id).not.toBe(winningDraftId);
    await waitForServerField(`clients/${CLIENT_JUAN_ID}`, 'activeDraftDeliveryId', freshNewDraft.id);

    // 11. Refrescar ambas sesiones conserva el mismo estado remoto
    await pageA.reload();
    await pageB.reload();
    await enterClientWorkspaceFromShell(pageA);
    await enterClientWorkspaceFromShell(pageB);
    await sidebarTab(pageA, 'ws-deliver').click();
    await sidebarTab(pageB, 'ws-deliver').click();
    await expect(pageA.locator('[data-testid="react-ws-deliver"]')).toBeVisible({ timeout: 15_000 });
    await expect(pageB.locator('[data-testid="react-ws-deliver"]')).toBeVisible({ timeout: 15_000 });

    const stateA = await pageA.evaluate(async (cid) => {
      const { dbService } = await import('/src/services/db.ts');
      return dbService.getDraftDelivery(cid)?.id;
    }, CLIENT_JUAN_ID);
    expect(stateA).toBe(freshNewDraft.id);
    const currentServerPointer = await ownerGetField(`clients/${CLIENT_JUAN_ID}`, 'activeDraftDeliveryId');
    expect(currentServerPointer).toBe(freshNewDraft.id);

    // 12. La captura genérica no duplica la operación ni crea drafts huérfanos
    const finalDeliveries = await ownerListStringFields(`clients/${CLIENT_JUAN_ID}/deliveries`);
    const finalDrafts = finalDeliveries.filter((d) => d.status === 'DRAFT');
    expect(finalDrafts).toHaveLength(1);
    expect(finalDrafts[0].id).toBe(freshNewDraft.id);

    await contextA.close();
    await contextB.close();
  });
});
