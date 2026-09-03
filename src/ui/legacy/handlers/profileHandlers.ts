import { authService } from '../../../services/auth';
import { dbService } from '../../../services/db';
import type { ProfileFactSection } from '../../../types';
import type { ProfileHandlerHost } from '../legacyAppHost';

export function bindProfileHandlers(host: ProfileHandlerHost): void  {
  document.getElementById('btn-extract-cv-facts')?.addEventListener('click', (e) => {
    const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id')
      || authService.getCurrentUser()?.clientId
      || host.resolveClientId();
    const pasted = (document.getElementById('input-cv-paste') as HTMLTextAreaElement | null)?.value.trim();
    if (!pasted) {
      host.showToast('Pega el texto del CV o sube un archivo .txt', 'warning');
      return;
    }
    const count = dbService.importCandidateFactsFromCv(clientId, pasted);
    host.showToast(count ? `${count} facts candidatos extraídos` : 'No se encontraron facts nuevos', count ? 'success' : 'info');
    host.render();
  });

  document.querySelectorAll('.input-cv-upload').forEach((input) => {
    input.addEventListener('change', async (e) => {
      const el = e.currentTarget as HTMLInputElement;
      const clientId = el.getAttribute('data-client-id') || authService.getCurrentUser()?.clientId || '';
      const file = el.files?.[0];
      if (!clientId || !file) return;
      const text = await file.text();
      const textarea = document.getElementById('input-cv-paste') as HTMLTextAreaElement | null;
      if (textarea) textarea.value = text;
      const count = dbService.importCandidateFactsFromCv(clientId, text);
      host.showToast(`${count} facts candidatos desde ${file.name}`, 'success');
      el.value = '';
      host.render();
    });
  });

  document.querySelectorAll('.btn-confirm-profile-fact').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const factId = el.getAttribute('data-fact-id');
      const clientId = el.getAttribute('data-client-id') || '';
      if (!factId || !clientId) return;
      dbService.confirmProfileFact(clientId, factId);
      host.showToast('Fact confirmado', 'success');
      host.render();
    });
  });

  document.querySelectorAll('.btn-reject-profile-fact').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const factId = el.getAttribute('data-fact-id');
      const clientId = el.getAttribute('data-client-id') || '';
      if (!factId || !clientId) return;
      dbService.rejectProfileFact(clientId, factId);
      host.showToast('Fact descartado', 'info');
      host.render();
    });
  });

  document.querySelectorAll('.btn-edit-profile-fact').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const factId = el.getAttribute('data-fact-id');
      const clientId = el.getAttribute('data-client-id') || '';
      if (!factId || !clientId) return;
      const profile = dbService.getMasterProfile(clientId);
      const fact = profile?.facts?.find((f) => f.id === factId);
      if (!fact) return;
      const value = prompt('Editar valor del fact:', fact.value);
      if (value === null || !value.trim()) return;
      dbService.updateProfileFact(clientId, factId, { value: value.trim() });
      host.showToast('Fact actualizado', 'success');
      host.render();
    });
  });

  document.querySelectorAll('.btn-add-profile-fact').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const clientId = el.getAttribute('data-client-id') || '';
      const section = el.getAttribute('data-section') as ProfileFactSection;
      if (!clientId || !section) return;
      const label = prompt('Etiqueta del fact:');
      if (!label?.trim()) return;
      const value = prompt('Valor del fact:');
      if (!value?.trim()) return;
      dbService.addProfileFact(clientId, { section, label: label.trim(), value: value.trim(), source: 'manual' });
      host.showToast('Fact añadido', 'success');
      host.render();
    });
  });

  document.querySelectorAll('.btn-toggle-proof-wall').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const itemId = el.getAttribute('data-item-id');
      const next = el.getAttribute('data-next-status') as 'complete' | 'pending';
      if (!itemId || !next) return;
      dbService.updateProofWallItem(itemId, next);
      host.showToast(next === 'complete' ? 'Activo marcado como listo' : 'Activo marcado como pendiente', 'success');
      host.render();
    });
  });
}
