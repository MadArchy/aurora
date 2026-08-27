/**
 * SPEC-010 T-010-402 — presentation state extracted from the `main.ts` controller.
 *
 * This module owns *only* what the user is currently looking at: which tab, which
 * client workspace, which modal, and how lists are filtered. None of that is
 * business truth, so nothing here may read persistence, resolve identity or
 * decide a lifecycle. It imports no service, no `dbService` and no DOM.
 *
 * The distinction that matters: `activeClientId` is a **view selection**, not a
 * tenant grant. Authorization still happens in the Application/Domain layers on
 * every command, exactly as before this extraction.
 */

export interface UiFilterState {
  searchQuery: string;
  contentSearch: string;
  portfolioSearch: string;
  sourceType: string;
  priorityBand: string;
  contentStatus: string;
  topicKey: string;
  radarView: 'list' | 'triage';
  thesisId: string;
  highlightTaskId: string;
}

/** Sentinel for "portfolio level" — no client workspace is open. */
export const PORTFOLIO_SCOPE = 'all';

const initialFilterState = (): UiFilterState => ({
  searchQuery: '',
  contentSearch: '',
  portfolioSearch: '',
  sourceType: 'ALL',
  priorityBand: 'ALL',
  contentStatus: 'ALL',
  topicKey: '',
  radarView: 'triage',
  thesisId: '',
  highlightTaskId: '',
});

export class AppUiState {
  activeTab: string = 'dashboard';
  /** `PORTFOLIO_SCOPE` = portfolio level. Any other value = that client's workspace. */
  activeClientId: string = PORTFOLIO_SCOPE;
  activeCampaignId: string | null = null;
  activeModal: string | null = null;
  modalData: any = null;
  loginError = '';
  readonly filterState: UiFilterState = initialFilterState();

  /** The client being worked on, or null at portfolio level. */
  currentClientId(): string | null {
    return this.activeClientId !== PORTFOLIO_SCOPE ? this.activeClientId : null;
  }

  /**
   * Opening a client workspace clears the filters that belong to the previous
   * client, so one client's search never silently narrows another's lists.
   */
  enterClient(clientId: string, tab?: string): void {
    this.activeClientId = clientId;
    this.activeTab = tab && tab.startsWith('ws-') ? tab : 'ws-briefing';
    this.filterState.topicKey = '';
    this.filterState.searchQuery = '';
    this.filterState.priorityBand = 'ALL';
    this.filterState.sourceType = 'ALL';
  }

  backToPortfolio(): void {
    this.activeClientId = PORTFOLIO_SCOPE;
    this.activeTab = 'dashboard';
  }

  openModal(id: string, data: unknown = null): void {
    this.activeModal = id;
    if (data !== null) this.modalData = data;
  }

  closeModal(): void {
    this.activeModal = null;
    this.modalData = null;
  }
}
