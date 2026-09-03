import { authService } from '../../../services/auth';
import { dbService } from '../../../services/db';
import { notificationService } from '../../../services/notifications';
import { bindSessionUi } from '../../../controllers/sessionController';
import { themeService } from '../../../services/theme';
import { FIREBASE_ENABLED } from '../../../firebase/config';
import type { SessionHandlerHost } from '../legacyAppHost';

export function bindSessionHandlers(host: SessionHandlerHost): void  {
  document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
    const next = themeService.toggle();
    host.showToast(next === 'light' ? 'Tema claro activado' : 'Tema oscuro activado', 'info');
    host.render();
  });

  document.getElementById('btn-toggle-role')?.addEventListener('click', () => {
    if (FIREBASE_ENABLED) {
      host.showToast('Con Firebase activo, inicia sesión con la cuenta del cliente.', 'info');
      return;
    }
    const targetClientId = host.currentClientId();
    if (!targetClientId) {
      host.showToast('Entra a un cliente para ver su portal.', 'warning');
      return;
    }
    const client = dbService.getClientById(targetClientId);
    authService.impersonateClient(targetClientId, client?.displayName || 'Cliente');
    host.showToast(`Viendo el portal de ${client?.displayName || 'cliente'}`, 'info');
  });

  document.getElementById('btn-return-manager')?.addEventListener('click', () => {
    if (!authService.isImpersonating()) {
      host.showToast('No hay sesión de manager activa.', 'warning');
      return;
    }
    authService.returnToManager();
    host.showToast('De vuelta al cockpit', 'info');
  });

  bindSessionUi(host, {
    authLogout: async () => {
      authService.logout();
    },
    markAllRead: (uid) => notificationService.markAllRead(uid),
    markRead: (id) => notificationService.markRead(id),
    getCurrentUser: () => authService.getCurrentUser(),
  });

  document.querySelectorAll('.btn-login-as-client').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id');
      if (!clientId) return;
      const client = dbService.getClientById(clientId);
      authService.impersonateClient(clientId, client?.displayName || clientId);
      host.showToast(`Sesión de cliente: ${client?.displayName || clientId}`, 'info');
    });
  });
}
