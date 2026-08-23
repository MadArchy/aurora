/** Contrato mínimo que los controladores necesitan del shell de la app. */
export interface AppHost {
  render(): void;
  closeModal(): void;
  setTab(tab: string): void;
  showToast(message: string, type?: 'success' | 'warning' | 'info' | 'error'): void;
  openModal(id: string): void;
  navigateFromNotification?(tab: string, targetId?: string | null): void;
}

export interface SessionControllerDeps {
  authLogout(): Promise<void>;
  markAllRead(uid: string): void;
  markRead(id: string): void;
  getCurrentUser(): { uid: string; clientId?: string | null } | null;
}

export function bindSessionUi(host: AppHost, deps: SessionControllerDeps): void {
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await deps.authLogout();
    host.closeModal();
    host.showToast('Sesión cerrada.', 'warning');
  });

  document.getElementById('btn-open-notifications')?.addEventListener('click', () => {
    host.openModal('notifications');
  });

  ['btn-close-notifications', 'btn-close-notifications-bottom'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => host.closeModal());
  });

  document.getElementById('btn-mark-all-read')?.addEventListener('click', () => {
    const user = deps.getCurrentUser();
    if (user) deps.markAllRead(user.uid);
    host.render();
  });

  document.querySelectorAll('.notification-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const id = el.getAttribute('data-notification-id');
      const tab = el.getAttribute('data-tab-link');
      const targetId = el.getAttribute('data-target-id');
      if (id) deps.markRead(id);
      host.closeModal();
      if (tab && host.navigateFromNotification) {
        host.navigateFromNotification(tab, targetId);
      } else if (tab) {
        host.setTab(tab);
      }
    });
  });
}
