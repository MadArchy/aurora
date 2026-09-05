import { dbService } from '../../../services/db';
import { notifyManager } from '../../../services/notifications';
import { acknowledgeDelivery as acknowledgeDeliveryCmd } from '../../../services/executionDeliveryConsumer';
import { sendDelivery as sendDeliveryCmd } from '../../../controllers/contentPipelineCommands';
import {
  discardDraftDelivery,
  ensureDraftDelivery,
  removeDeliveryItemFromDelivery,
  updateDeliveryPackageMetadata,
} from '../../../services/executionDeliveryConsumer';
import { queueCurationInBriefing } from './radarHandlers';
import type { DeliveryHandlerHost } from '../legacyAppHost';

export function bindDeliveryHandlers(host: DeliveryHandlerHost): void  {
  document.getElementById('btn-create-delivery')?.addEventListener('click', (e) => {
    const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id') || host.resolveClientId();
    ensureDraftDelivery({ requestedClientId: clientId });
    host.showToast('Briefing creado. Añade los ítems curados.', 'success');
    host.render();
  });

  const metaForm = document.getElementById('form-delivery-meta');
  metaForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const packageId = metaForm.getAttribute('data-package-id');
    if (!packageId) return;
    updateDeliveryPackageMetadata({
      requestedClientId: host.resolveClientId(),
      packageId,
      title: (document.getElementById('delivery-title') as HTMLInputElement).value,
      strategicNote: (document.getElementById('delivery-note') as HTMLTextAreaElement).value,
    });
    host.showToast('Nota estratégica guardada', 'success');
    host.render();
  });

  document.querySelectorAll('.btn-add-to-delivery').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const curationId = target.getAttribute('data-curation-id');
      if (!curationId) return;
      const clientId = target.getAttribute('data-client-id') || host.resolveClientId();
      if (!queueCurationInBriefing(curationId, clientId)) {
        host.showToast('Ese ítem ya está en un briefing.', 'info');
        return;
      }
      host.showToast('Añadido al briefing', 'success');
      host.render();
    });
  });

  document.querySelectorAll('.btn-remove-delivery-item').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const packageId = target.getAttribute('data-package-id');
      const itemId = target.getAttribute('data-item-id');
      if (!packageId || !itemId) return;

      removeDeliveryItemFromDelivery({
        requestedClientId: host.resolveClientId(),
        packageId,
        itemId,
      });
      host.showToast('Ítem retirado del briefing', 'info');
      host.render();
    });
  });

  document.getElementById('btn-preview-delivery')?.addEventListener('click', (e) => {
    const packageId = (e.currentTarget as HTMLElement).getAttribute('data-package-id');
    if (!packageId) return;
    host.activeModal = 'delivery-preview';
    host.modalData = { packageId };
    host.render();
  });

  document.querySelectorAll('.btn-discard-delivery').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const packageId = (e.currentTarget as HTMLElement).getAttribute('data-package-id');
      if (!packageId) return;
      const pkg = dbService.getDeliveryById(packageId);
      if (!pkg) return;
      if (!window.confirm(`¿Descartar el borrador «${pkg.title}»? Los ítems vuelven a la bandeja de listos.`)) return;
      discardDraftDelivery({ requestedClientId: host.resolveClientId(), packageId });
      host.showToast('Borrador descartado', 'info');
      host.render();
    });
  });

  document.querySelectorAll('.btn-close-delivery-preview').forEach((btn) => {
    btn.addEventListener('click', () => host.closeModal());
  });

  document.querySelectorAll('.btn-confirm-send-delivery').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const packageId = (e.currentTarget as HTMLElement).getAttribute('data-package-id');
      if (!packageId) return;
      const el = e.currentTarget as HTMLButtonElement;
      el.disabled = true;
      el.textContent = 'Enviando…';
      try {
        await sendDeliveryCmd(host, packageId);
        host.closeModal();
      } catch (error) {
        host.showToast(error instanceof Error ? error.message : 'No se pudo enviar el briefing', 'warning');
        host.render();
      }
    });
  });

  ['btn-send-delivery', 'btn-send-delivery-bar'].forEach((id) => {
    const sendBtn = document.getElementById(id) as HTMLButtonElement | null;
    sendBtn?.addEventListener('click', () => {
      const packageId = sendBtn.getAttribute('data-package-id');
      if (!packageId) return;
      host.activeModal = 'delivery-preview';
      host.modalData = { packageId };
      host.render();
    });
  });

  document.querySelectorAll('.btn-acknowledge-delivery').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-package-id');
      if (!id) return;
      const noteEl = document.querySelector(`.input-ack-note[data-package-id="${id}"]`) as HTMLTextAreaElement | null;
      const note = noteEl?.value.trim();
      const result = acknowledgeDeliveryCmd({
        requestedClientId: host.resolveClientId(),
        packageId: id,
        clientAckNote: note || undefined,
      });
      if (!result.ok) {
        host.showToast('No se pudo marcar el briefing', 'warning');
        return;
      }
      const pkg = dbService.getDeliveryById(result.packageId);
      if (!pkg) {
        host.showToast('No se pudo marcar el briefing', 'warning');
        return;
      }
      const client = dbService.getClientById(pkg.clientId);
      notifyManager(pkg.clientId, {
        type: 'BRIEFING',
        title: 'Briefing visto por el cliente',
        body: note
          ? `«${pkg.title}» — ${client?.displayName || 'Cliente'}: ${note}`
          : `«${pkg.title}» marcado como leído por ${client?.displayName || 'el cliente'}.`,
        href: 'ws-deliver',
      });
      host.showToast('Briefing marcado como visto', 'success');
      host.render();
    });
  });
}
