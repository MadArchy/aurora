import type { NavigationHandlerHost } from '../legacyAppHost';

export function bindNavigationHandlers(host: NavigationHandlerHost): void  {
  document.getElementById('client-campaign-filter')?.addEventListener('change', (e) => {
    const campaignId = (e.currentTarget as HTMLSelectElement).value;
    if (campaignId) host.setActiveCampaign(campaignId);
  });

  document.getElementById('client-thesis-filter')?.addEventListener('change', (e) => {
    host.filterState.thesisId = (e.currentTarget as HTMLSelectElement).value;
    host.refreshMain();
  });

  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const tab = target.getAttribute('data-tab');
      const topicKey = target.getAttribute('data-topic-key');
      if (topicKey) host.filterState.topicKey = topicKey;
      if (tab) {
        if (target.closest('.modal-overlay')) {
          host.activeModal = null;
          host.modalData = null;
        }
        host.setTab(tab);
      }
    });
  });

  document.querySelectorAll('[data-go-portfolio]').forEach((btn) => {
    btn.addEventListener('click', () => host.backToPortfolio());
  });

  document.querySelectorAll('.btn-enter-client').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const clientId = el.getAttribute('data-client-id');
      const tab = el.getAttribute('data-tab') || undefined;
      if (clientId) host.enterClient(clientId, tab);
    });
  });
}
