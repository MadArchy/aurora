import { dbService } from '../../../services/db';
import type { FiltersHandlerHost } from '../legacyAppHost';

export function bindFiltersHandlers(host: FiltersHandlerHost): void  {
  const portfolioSearch = document.getElementById('input-search-portfolio') as HTMLInputElement | null;
  portfolioSearch?.addEventListener('input', () => {
    host.filterState.portfolioSearch = portfolioSearch.value;
    host.refreshMain();
  });

  const signalSearch = document.getElementById('input-search-signals') as HTMLInputElement | null;
  signalSearch?.addEventListener('input', () => {
    host.filterState.searchQuery = signalSearch.value;
    host.refreshMain();
  });

  const contentSearch = document.getElementById('input-search-content') as HTMLInputElement | null;
  contentSearch?.addEventListener('input', () => {
    host.filterState.contentSearch = contentSearch.value;
    host.refreshMain();
  });

  document.querySelectorAll('[data-source-filter]').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      host.filterState.sourceType = (e.currentTarget as HTMLElement).getAttribute('data-source-filter') || 'ALL';
      host.refreshMain();
    });
  });

  document.querySelectorAll('[data-band-filter]').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      host.filterState.priorityBand = (e.currentTarget as HTMLElement).getAttribute('data-band-filter') || 'ALL';
      host.refreshMain();
    });
  });

  document.querySelectorAll('[data-radar-view]').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      const view = (e.currentTarget as HTMLElement).getAttribute('data-radar-view');
      host.filterState.radarView = view === 'list' ? 'list' : 'triage';
      host.refreshMain();
    });
  });

  document.querySelectorAll('[data-content-filter]').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      host.filterState.contentStatus = (e.currentTarget as HTMLElement).getAttribute('data-content-filter') || 'ALL';
      host.refreshMain();
    });
  });

  document.querySelectorAll('.btn-filter-topic').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      host.filterState.topicKey = (e.currentTarget as HTMLElement).getAttribute('data-topic-key') || '';
      host.refreshMain();
    });
  });

  document.querySelector('.btn-clear-topic-filter')?.addEventListener('click', () => {
    host.filterState.topicKey = '';
    host.refreshMain();
  });

  document.querySelectorAll('.btn-toggle-topic-pin').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const key = (e.currentTarget as HTMLElement).getAttribute('data-topic-key');
      if (!key) return;
      const pinned = dbService.toggleTopicPin(key);
      host.showToast(pinned ? 'Tema fijado' : 'Pin retirado', 'info');
      host.refreshMain();
    });
  });
}
