import { authService } from '../../../services/auth';
import { notificationService } from '../../../services/notifications';
import { esc } from '../../../lib/escape';

export function renderNotificationsPanel(): string {
  const user = authService.getCurrentUser();
  if (!user) return '';
  const items = notificationService.forUser(user.uid, user.clientId).slice(0, 20);

  return `
    <div id="notifications-modal" class="modal-overlay">
      <div class="modal-content" style="max-width: 560px;">
        <div class="card-header">
          <div>
            <h3>Bandeja de avisos</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Briefings, tareas y actualizaciones recientes.</p>
          </div>
          <button id="btn-close-notifications" class="btn btn-secondary btn-sm" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;">✕</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 420px; overflow-y: auto;">
          ${items.length
            ? items.map((item) => {
                const tab = item.href || (item.type === 'TASK_ASSIGNED' || item.type === 'CONTENT_REVIEW'
                  ? 'client-home'
                  : item.type === 'BRIEFING'
                    ? 'client-home'
                    : item.type === 'OPPORTUNITY'
                      ? 'client-opps'
                      : item.type === 'THESIS'
                        ? 'client-thesis'
                        : 'client-home');
                return `
                <article class="notification-row ${item.read ? 'read' : 'unread'}"
                         data-notification-id="${esc(item.id)}"
                         data-tab-link="${esc(tab)}"
                         ${item.targetId ? `data-target-id="${esc(item.targetId)}"` : ''}>
                  <strong>${esc(item.title)}</strong>
                  <p class="muted small">${esc(item.body)}</p>
                  <span class="muted small">${new Date(item.createdAt).toLocaleString('es')}</span>
                </article>
              `;
              }).join('')
            : '<p class="empty-state">No tienes avisos todavía.</p>'}
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
          <button id="btn-mark-all-read" class="btn btn-secondary btn-sm">Marcar todas leídas</button>
          <button id="btn-close-notifications-bottom" class="btn btn-primary btn-sm">Cerrar</button>
        </div>
      </div>
    </div>
  `;
}
