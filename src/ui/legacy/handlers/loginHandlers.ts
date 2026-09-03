import { authService } from '../../../services/auth';
import { acceptClientInvitation } from '../../../services/clientLifecycleConsumer';
import { ClientLifecycleError } from '../../../application/clientLifecycle';
import type { LoginHandlerHost } from '../legacyAppHost';

export function bindLoginHandlers(host: LoginHandlerHost): void  {
  const form = document.getElementById('form-login');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('login-email') as HTMLInputElement).value;
    const password = (document.getElementById('login-password') as HTMLInputElement).value;
    const result = await authService.login(email, password);
    if (!result.ok) {
      host.loginError = result.message;
      host.render();
    } else {
      host.loginError = '';
    }
  });

  const inviteForm = document.getElementById('form-accept-invite');
  inviteForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = (document.getElementById('invite-token') as HTMLInputElement).value.trim();
    const name = (document.getElementById('invite-name') as HTMLInputElement).value.trim();
    const password = (document.getElementById('invite-password') as HTMLInputElement).value;
    try {
      // CR-1 #1 — business authority is AcceptClientInvitation (Application).
      await acceptClientInvitation({ token, password, displayName: name });
    } catch (err) {
      host.loginError =
        err instanceof ClientLifecycleError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo aceptar la invitación.';
      host.render();
    }
  });
}
