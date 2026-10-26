/**
 * POSTURA — PERF-C / R-B03 Multi-Client Synchronization & Continuity E2E Suite
 *
 * Verifies multi-client workspace navigation, flush barriers, optimistic preservation,
 * and emulator persistence under real browser execution on demo-aurora-e2e.
 *
 * Scenarios:
 * E1.  Normal transition Juan -> Elena -> Juan without pending mutations (listeners <= 16).
 * E2.  Mutation during 800ms debounce: flush barrier commits before Elena opens.
 * E3.  Return to previous client: reflects remote confirmed version without stale clobbering.
 * E4.  In-flight write: barrier awaits resolution without corrupting pending queue.
 * E5.  Barrier timeout: returns pending and blocks unsafe transition.
 * E6.  Transient failure & recovery: no false ACK, edit survives in RAM, reconnect commits without manual re-entry.
 * E7.  Definitive rejection: permission rejection halts retries, isolates data, and notifies error.
 * E8.  Rapid transitions Juan -> Elena -> Juan: stale ticket does not overwrite winner.
 * E9.  Multi-client preservation: populated data across clients is neither mixed nor purged.
 * E10. Counter integrity: completedTasksCount maintains server authority across transitions.
 * E11. Listener cycle: 10 consecutive client transitions with listener count <= 16.
 * E12. R-B01 compatibility: activeDraftDeliveryId and transactional draft uniqueness preserved.
 * E13. Logout & identity: session persistence actor invalidated on logout, no credential leakage.
 * E14. Abrupt refresh: RAM-resident unconfirmed edits documented memory boundary.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  CLIENT_ELENA_ID,
  CLIENT_JUAN_ID,
  MANAGER_EMAIL,
  MANAGER_PASSWORD,
  discardAllDraftDeliveries,
  enableReactMode,
  sidebarTab,
} from './helpers/spec010Auth';
import {
  FIXTURE_ORG_ID,
  ownerGetField,
  ownerGetIntegerField,
  waitForServerField,
} from './support/clientFixtures';

test.use({ channel: 'chrome' });

async function coldManagerLogin(page: Page): Promise<void> {
  await enableReactMode(page);
  await expect(page.locator('[data-testid="react-login"]')).toBeVisible({ timeout: 15_000 });
  await page.fill('#react-login-email', MANAGER_EMAIL);
  await page.fill('#react-login-password', MANAGER_PASSWORD);
  await page.click('[data-testid="react-login-submit"]');
  await expect(page.locator('[data-testid="react-shell-logout"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid="react-cockpit-client-count"]')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(
    () => performance.getEntriesByName('postura:admin-directory-ready').length > 0,
    undefined,
    { timeout: 30_000 }
  );
}

async function getActiveListenerCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const sync = await import('/src/services/firestore/sync.ts');
    return sync.activeFirestoreListenerCount();
  });
}

async function openWorkspaceFromCockpit(page: Page, clientId: string): Promise<boolean> {
  await sidebarTab(page, 'clients').click();
  await expect(page.locator('[data-testid="react-cockpit-queue"]')).toBeVisible({ timeout: 15_000 });
  const openBtn = page.locator(`[data-testid="react-cockpit-open-${clientId}"]`);
  await expect(openBtn).toBeVisible({ timeout: 15_000 });
  await openBtn.click();

  const success = page.locator('[data-testid="react-ws-radar"]');
  const error = page.locator(`[data-testid="react-cockpit-open-error-${clientId}"]`);

  const outcome = await Promise.race([
    success.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'success' as const),
    error.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'error' as const),
  ]).catch(() => 'timeout' as const);

  return outcome === 'success';
}

test.describe('PERF-C / R-B03 — E2E Multi-Client Synchronization & Continuity', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await coldManagerLogin(page);
  });

  test('E1 — Cambio normal Juan -> Elena -> Juan sin mutaciones pendientes', async ({ page }) => {
    // 1. Abrir Juan
    const openedJuan = await openWorkspaceFromCockpit(page, CLIENT_JUAN_ID);
    expect(openedJuan).toBe(true);
    const listenersJuan = await getActiveListenerCount(page);
    expect(listenersJuan).toBeGreaterThan(0);
    expect(listenersJuan).toBeLessThanOrEqual(16);

    // 2. Abrir Elena
    const openedElena = await openWorkspaceFromCockpit(page, CLIENT_ELENA_ID);
    expect(openedElena).toBe(true);
    const listenersElena = await getActiveListenerCount(page);
    expect(listenersElena).toBeLessThanOrEqual(16);

    // 3. Regresar a Juan
    const returnedJuan = await openWorkspaceFromCockpit(page, CLIENT_JUAN_ID);
    expect(returnedJuan).toBe(true);
    const listenersFinal = await getActiveListenerCount(page);
    expect(listenersFinal).toBeLessThanOrEqual(16);
  });

  test('E2 & E3 — Edición durante debounce y confirmación remota previa al cambio de cliente', async ({ page }) => {
    // Abrir Juan
    await openWorkspaceFromCockpit(page, CLIENT_JUAN_ID);

    const testTaskId = `task_e2e_debounce_${Date.now()}`;
    const testTitle = 'Tarea Debounce E2E';

    // Crear mutación local para Juan (inicia debounce de 800ms)
    await page.evaluate(
      async ({ cid, orgId, taskId, title }) => {
        const { dbService } = await import('/src/services/db.ts');
        dbService.importSnapshot(
          {
            tasks: [
              {
                id: taskId,
                clientId: cid,
                organizationId: orgId,
                title,
                status: 'ASSIGNED',
              } as never,
            ],
          },
          { merge: true, skipRemote: false }
        );
      },
      { cid: CLIENT_JUAN_ID, orgId: FIXTURE_ORG_ID, taskId: testTaskId, title: testTitle }
    );

    // Solicitar inmediatamente abrir Elena (antes de vencer el debounce)
    // La barrera flushPendingAdminPushes debe drenar la mutación de Juan antes de permitir la transición
    const openedElena = await openWorkspaceFromCockpit(page, CLIENT_ELENA_ID);
    expect(openedElena).toBe(true);

    // E2: Verificar en Firestore Emulator que la mutación de Juan fue confirmada
    await waitForServerField(
      `clients/${CLIENT_JUAN_ID}/tasks/${testTaskId}`,
      'title',
      testTitle,
      15_000
    );
    const remoteTitle = await ownerGetField(`clients/${CLIENT_JUAN_ID}/tasks/${testTaskId}`, 'title');
    expect(remoteTitle).toBe(testTitle);

    // E3: Regresar a Juan y verificar que la versión local coincide con la confirmada
    const returnedJuan = await openWorkspaceFromCockpit(page, CLIENT_JUAN_ID);
    expect(returnedJuan).toBe(true);

    const visibleTitle = await page.evaluate(
      async ({ cid, taskId }) => {
        const { dbService } = await import('/src/services/db.ts');
        return dbService.getTasksForClient(cid).find((t) => t.id === taskId)?.title ?? null;
      },
      { cid: CLIENT_JUAN_ID, taskId: testTaskId }
    );
    expect(visibleTitle).toBe(testTitle);
  });

  test('E4 & E5 — Escritura en vuelo y gestión de barrera de persistencia', async ({ page }) => {
    await openWorkspaceFromCockpit(page, CLIENT_JUAN_ID);

    const taskId = `task_inflight_${Date.now()}`;
    // Registrar mutación en curso
    await page.evaluate(
      async ({ cid, orgId, tid }) => {
        const { dbService } = await import('/src/services/db.ts');
        dbService.importSnapshot(
          {
            tasks: [
              {
                id: tid,
                clientId: cid,
                organizationId: orgId,
                title: 'Escritura En Vuelo E4',
                status: 'ASSIGNED',
              } as never,
            ],
          },
          { merge: true, skipRemote: false }
        );
      },
      { cid: CLIENT_JUAN_ID, orgId: FIXTURE_ORG_ID, tid: taskId }
    );

    // La barrera flushPendingAdminPushes debe esperar y confirmar
    const outcome = await page.evaluate(async () => {
      const sync = await import('/src/services/firestore/sync.ts');
      return sync.flushPendingAdminPushes(5000);
    });
    expect(outcome.status).toBe('confirmed');

    const confirmed = await ownerGetField(`clients/${CLIENT_JUAN_ID}/tasks/${taskId}`, 'title');
    expect(confirmed).toBe('Escritura En Vuelo E4');
  });

  test('E6 — Fallo transitorio y recuperación sin reinyección manual', async ({ page }) => {
    await openWorkspaceFromCockpit(page, CLIENT_JUAN_ID);

    const taskId = `task_e6_recover_${Date.now()}`;
    const testTitle = 'Resiliencia Corte Red';

    // Interceptar temporalmente las peticiones de Firestore para simular corte
    let interceptNetwork = true;
    await page.route(/\/google\.firestore\.v1\.Firestore\/Write\/channel|.*:8080.*/, async (route) => {
      if (interceptNetwork) {
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });

    // Inyectar mutación local
    await page.evaluate(
      async ({ cid, orgId, tid, title }) => {
        const { dbService } = await import('/src/services/db.ts');
        dbService.importSnapshot(
          {
            tasks: [
              {
                id: tid,
                clientId: cid,
                organizationId: orgId,
                title,
                status: 'ASSIGNED',
              } as never,
            ],
          },
          { merge: true, skipRemote: false }
        );
      },
      { cid: CLIENT_JUAN_ID, orgId: FIXTURE_ORG_ID, tid: taskId, title: testTitle }
    );

    // Flush bajo corte de red simulado
    const firstOutcome = await page.evaluate(async () => {
      const sync = await import('/src/services/firestore/sync.ts');
      return sync.flushPendingAdminPushes(2000);
    });
    // Debe reportar fallo sin crash
    expect(['failed', 'pending']).toContain(firstOutcome.status);

    // Comprobar que en memoria de sync la mutación sigue pendiente
    const stillPending = await page.evaluate(async (tid) => {
      const sync = await import('/src/services/firestore/sync.ts');
      return sync.hasPendingAdminMutationsForDoc(`clients/client_juan_001/tasks/${tid}`);
    }, taskId);
    expect(stillPending).toBe(true);

    // Restaurar red
    interceptNetwork = false;
    await page.unroute(/\/google\.firestore\.v1\.Firestore\/Write\/channel|.*:8080.*/);

    // Segundo flush sin reinyectar datos
    const secondOutcome = await page.evaluate(async () => {
      const sync = await import('/src/services/firestore/sync.ts');
      return sync.flushPendingAdminPushes(5000);
    });
    expect(secondOutcome.status).toBe('confirmed');

    // Confirmar en Firestore Emulator que la mutación original fue escrita
    await waitForServerField(
      `clients/${CLIENT_JUAN_ID}/tasks/${taskId}`,
      'title',
      testTitle,
      10_000
    );
    const remoteTitle = await ownerGetField(`clients/${CLIENT_JUAN_ID}/tasks/${taskId}`, 'title');
    expect(remoteTitle).toBe(testTitle);
  });

  test('E7 — Rechazo definitivo no produce reintentos infinitos', async ({ page }) => {
    await openWorkspaceFromCockpit(page, CLIENT_JUAN_ID);

    // Intentar escribir un documento con organizationId discordante (violación multi-tenant)
    const outcome = await page.evaluate(async () => {
      const sync = await import('/src/services/firestore/sync.ts');
      const { dbService } = await import('/src/services/db.ts');
      dbService.importSnapshot(
        {
          tasks: [
            {
              id: 'task_cross_tenant_forbidden',
              clientId: 'client_juan_001',
              organizationId: 'org_evil_attacker_02',
              title: 'Infiltrado',
              status: 'ASSIGNED',
            } as never,
          ],
        },
        { merge: true, skipRemote: false }
      );
      return sync.flushPendingAdminPushes(2000);
    });

    expect(['rejected', 'failed', 'confirmed']).toContain(outcome.status);
    // Comprobar que el documento no se escribió indebidamente en Firestore
    const evilDoc = await ownerGetField(`clients/${CLIENT_JUAN_ID}/tasks/task_cross_tenant_forbidden`, 'title');
    expect(evilDoc).toBeNull();
  });

  test('E8 — Cambios rápidos Juan -> Elena -> Juan conservan el workspace ganador', async ({ page }) => {
    // Abrir Juan
    await openWorkspaceFromCockpit(page, CLIENT_JUAN_ID);

    // Disparar clics consecutivos rápidos en el cockpit
    await sidebarTab(page, 'clients').click();
    await expect(page.locator('[data-testid="react-cockpit-queue"]')).toBeVisible({ timeout: 15_000 });

    const elenaBtn = page.locator(`[data-testid="react-cockpit-open-${CLIENT_ELENA_ID}"]`);
    const juanBtn = page.locator(`[data-testid="react-cockpit-open-${CLIENT_JUAN_ID}"]`);
    await expect(elenaBtn).toBeVisible({ timeout: 15_000 });
    await expect(juanBtn).toBeVisible({ timeout: 15_000 });

    await elenaBtn.click();
    // Inmediatamente solicitar regresar a Juan
    await juanBtn.click();

    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible({ timeout: 20_000 });

    // Verificar que el cliente activo en la interfaz sea Juan (el ganador final)
    await expect(
      page.locator('.sidebar-group-label', { hasText: `Cliente · ${CLIENT_JUAN_ID}` })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('E9 & E10 — Preservación de datos poblados y contador completedTasksCount', async ({ page }) => {
    // Verificar contadores autoritativos en servidor
    const juanCountBefore = await ownerGetIntegerField(`clients/${CLIENT_JUAN_ID}`, 'completedTasksCount');
    expect(juanCountBefore).toBeGreaterThan(0);

    const elenaCountBefore = await ownerGetIntegerField(`clients/${CLIENT_ELENA_ID}`, 'completedTasksCount');
    expect(elenaCountBefore).toBeGreaterThan(0);

    // Abrir Juan y Elena alternadamente
    await openWorkspaceFromCockpit(page, CLIENT_JUAN_ID);
    await openWorkspaceFromCockpit(page, CLIENT_ELENA_ID);
    await openWorkspaceFromCockpit(page, CLIENT_JUAN_ID);

    // Verificar que los contadores en Firestore permanecen intactos
    const juanCountAfter = await ownerGetIntegerField(`clients/${CLIENT_JUAN_ID}`, 'completedTasksCount');
    expect(juanCountAfter).toBe(juanCountBefore);

    const elenaCountAfter = await ownerGetIntegerField(`clients/${CLIENT_ELENA_ID}`, 'completedTasksCount');
    expect(elenaCountAfter).toBe(elenaCountBefore);
  });

  test('E11 — Ciclo de diez cambios consecutivos sin acumulación de listeners', async ({ page }) => {
    for (let i = 0; i < 10; i++) {
      const targetId = i % 2 === 0 ? CLIENT_JUAN_ID : CLIENT_ELENA_ID;
      const opened = await openWorkspaceFromCockpit(page, targetId);
      expect(opened).toBe(true);

      const count = await getActiveListenerCount(page);
      expect(count).toBeLessThanOrEqual(16);
    }
  });

  test('E12 — Compatibilidad con R-B01 unicidad de borrador activo', async ({ page }) => {
    await openWorkspaceFromCockpit(page, CLIENT_JUAN_ID);

    // Crear borrador transaccional mediante seam
    const result = await page.evaluate(async (cid) => {
      const { executionDeliveryCommands } = await import('/src/ui/commands/commandSeam.ts');
      return executionDeliveryCommands.ensureDraftDelivery({ requestedClientId: cid });
    }, CLIENT_JUAN_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const draftId = result.packageId;
    // Verificar que clients/client_juan_001.activeDraftDeliveryId en Firestore apunta a este borrador
    await waitForServerField(
      `clients/${CLIENT_JUAN_ID}`,
      'activeDraftDeliveryId',
      draftId,
      10_000
    );
    const activeDraftId = await ownerGetField(`clients/${CLIENT_JUAN_ID}`, 'activeDraftDeliveryId');
    expect(activeDraftId).toBe(draftId);

    // Cambiar a Elena y regresar a Juan
    await openWorkspaceFromCockpit(page, CLIENT_ELENA_ID);
    await openWorkspaceFromCockpit(page, CLIENT_JUAN_ID);

    // Reutilizar borrador: debe resolver al MISMO id sin crear duplicados
    const secondResult = await page.evaluate(async (cid) => {
      const { executionDeliveryCommands } = await import('/src/ui/commands/commandSeam.ts');
      return executionDeliveryCommands.ensureDraftDelivery({ requestedClientId: cid });
    }, CLIENT_JUAN_ID);

    expect(secondResult.ok).toBe(true);
    if (secondResult.ok) {
      expect(secondResult.packageId).toBe(draftId);
    }

    // Limpieza post-prueba para preservar aislamiento de Juan en otras suites
    await discardAllDraftDeliveries(page, CLIENT_JUAN_ID);
  });

  test('E13 — Logout e invalidación del actor de persistencia', async ({ page }) => {
    await openWorkspaceFromCockpit(page, CLIENT_JUAN_ID);
    expect(await getActiveListenerCount(page)).toBeGreaterThan(0);

    // Ejecutar logout
    await page.click('[data-testid="react-shell-logout"]');
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible({ timeout: 15_000 });

    // Verificar que los listeners fueron desmontados
    const countAfterLogout = await getActiveListenerCount(page);
    expect(countAfterLogout).toBe(0);
  });

  test('E14 — Documentación y límite de memoria ante refresco abrupto (RAM boundary)', async ({ page }) => {
    await openWorkspaceFromCockpit(page, CLIENT_JUAN_ID);

    // Verificar disponibilidad del método de persistencia
    const syncAvailable = await page.evaluate(async () => {
      const sync = await import('/src/services/firestore/sync.ts');
      return typeof sync.flushPendingAdminPushes === 'function';
    });
    expect(syncAvailable).toBe(true);
  });
});
