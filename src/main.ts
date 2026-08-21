import './styles/index.css';
import { authService } from './services/auth';
import { dbService } from './services/db';
import { aiService } from './services/ai';
import { auditService } from './services/audit';
import { notificationService, notifyClient } from './services/notifications';
import { processDeadlineReminders } from './services/reminders';
import {
  downloadRecording,
  downloadRecordingFromEvidence,
  persistRecording,
  resolveRecordingUrl,
  RECORDING_REF_PREFIX,
} from './services/recordings';
import { pushCurrentLocalToFirestore } from './services/firebase/importLocalV5';
import { runTopicAgent } from './services/topicAgent';
import { formatDossierMarkdown, downloadDossierMarkdown } from './services/dossierExport';
import { generatePositioningAdvice, proposeAngle } from './services/advisor';
import { calculateStrategicScore, ScoringContext } from './services/scoring';
import {
  buildProfileKeywords,
  discoverSources,
  normalizeSourceUrl,
  ProfileKeywords,
} from './services/sourceDiscovery';
import { assessSourceQuality, gateItem, FeedItem } from './services/ingestFilter';
import { renderAppShell, renderBriefingBar } from './components/AppShell';
import { renderManagerCockpit } from './components/ManagerCockpit';
import { renderClientWorkspace } from './components/ClientWorkspace';
import { renderClientPortal } from './components/ClientPortal';
import { renderLogin } from './components/Login';
import {
  renderTeleprompterModal,
  renderArticleReviewModal,
  renderContentDiffModal,
  renderCreateClientModal,
  renderComparativeModal,
  renderChallengeModal,
  renderAddEvidenceModal,
  renderContentEditorModal,
  renderContentPreviewModal,
  renderFeedbackModal,
  renderAddTaskModal,
} from './components/Modals';
import { renderOnboardingWizard } from './components/OnboardingWizard';
import { renderThesisEditorModal } from './components/ThesisEditorModal';
import { renderSourceRegistryModal } from './components/SourceRegistryModal';
import { PORTFOLIO_TAB_IDS, WORKSPACE_TAB_IDS, CLIENT_TAB_IDS, isWorkspaceTab, normalizeTab } from './components/PageHeader';
import { CurationDestination, DeliveryItemKind, Source, TaskType, ContentStatus, BusinessKpiType, ContentPipelineStatus } from './types';
import { createId } from './lib/id';
import { CAMP_ADOPTION } from './data/juanCampaignSeed';
import { bindSessionUi } from './controllers/sessionController';
import { themeService } from './services/theme';
import { mapLegacyContentStatus, resolvePipelineStepsToTarget } from './domain/contentPipeline';
import { nextIncompleteOnboardingStep } from './domain/profileCoverage';
import type { ProfileFactSection } from './types';
import { metricsService } from './services/metrics';
import { fetchSourceItems } from './services/sourceApi';
import { esc } from './lib/escape';
import {
  loadLastAgentRun,
  profileChangedSinceLastRun,
  resolveDiscoveryCandidate,
  runSourceDiscoveryAgent,
  runSourceDiscoveryAgentAsync,
  saveAgentRun,
  sourcesDueForIngest,
} from './services/sourceDiscoveryAgent';
import { buildCuratedPresetsForProfile } from './services/industryPresets';
import { discoverExtendedSources } from './services/extendedSourceDiscovery';
import { enrichYoutubeDiscoverySources } from './services/youtubeDiscovery';
import { runResearchSignalsAgent } from './services/researchSignalsAgent';
import { shouldAutoResearchSignal } from './domain/radarTriageCore';
import { feedbackScoringHints } from './domain/radarFeedbackCore';

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}

const DESTINATION_TO_KIND: Record<Exclude<CurationDestination, 'DISCARD'>, DeliveryItemKind> = {
  TASK_VIDEO: 'TASK',
  TASK_ARTICLE: 'TASK',
  OPPORTUNITY: 'OPPORTUNITY',
  REFERENCE_READING: 'READING',
  EVIDENCE: 'FILE',
};

class App {
  private activeTab: string = 'dashboard';
  /** 'all' = nivel cartera. Cualquier otro valor = dentro del espacio de trabajo de ese cliente. */
  private activeClientId: string = 'all';
  private activeCampaignId: string | null = null;
  private activeModal: string | null = null;
  private modalData: any = null;
  private isTeleprompterPlaying: boolean = false;
  private teleprompterInterval: number | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private cameraStream: MediaStream | null = null;
  private previewBlob: Blob | null = null;
  private previewBlobUrl: string | null = null;
  private toasts: ToastItem[] = [];
  private filterState = {
    searchQuery: '',
    contentSearch: '',
    portfolioSearch: '',
    sourceType: 'ALL',
    priorityBand: 'ALL',
    contentStatus: 'ALL',
    topicKey: '' as string,
    radarView: 'triage' as 'list' | 'triage',
  };
  private loginError = '';
  private sourceAgentTimer: number | null = null;
  private sourceIngestTimer: number | null = null;
  private lastDiscoveryScanAt = 0;

  /** Intervalo entre escaneos del agente de fuentes (1 h). */
  private static readonly DISCOVERY_SCAN_MS = 60 * 60 * 1000;
  /** Revisa ingesta programada cada 5 min. */
  private static readonly INGEST_TICK_MS = 5 * 60 * 1000;

  constructor() {
    void this.boot();
  }

  private async boot() {
    themeService.init();
    await authService.ready;
    authService.subscribe((user) => {
      if (!user) {
        this.stopSourceAutomation();
        this.activeTab = 'dashboard';
        this.activeClientId = 'all';
        this.render();
        return;
      }
      if (user.role === 'ADMIN') {
        const valid = [...PORTFOLIO_TAB_IDS, ...WORKSPACE_TAB_IDS];
        if (!valid.includes(this.activeTab)) this.activeTab = 'dashboard';
        if (isWorkspaceTab(this.activeTab) && this.activeClientId === 'all') this.activeTab = 'dashboard';
        this.startSourceAutomation();
      } else {
        this.stopSourceAutomation();
        if (user.mustCompleteOnboarding) {
          this.activeModal = 'onboarding';
          this.modalData = { clientId: user.clientId, step: 1 };
        }
        if (!CLIENT_TAB_IDS.includes(this.activeTab)) this.activeTab = 'client-home';
        this.activeCampaignId = this.resolveCampaignId(user.clientId || undefined);
      }
      this.render();
    });

    dbService.onChange(() => {
      if (authService.getCurrentUser()) this.render();
    });
  }

  public showToast(message: string, type: 'success' | 'info' | 'warning' = 'info') {
    const id = 'toast_' + Math.random().toString(36).substring(2, 9);
    this.toasts.push({ id, message, type });
    this.renderToasts();

    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== id);
      this.renderToasts();
    }, 3500);
  }

  private renderToasts() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    container.innerHTML = this.toasts.map(t => `
      <div class="toast toast-${t.type}">
        <div>${esc(t.message)}</div>
      </div>
    `).join('');
  }

  private resolveCampaignId(clientId?: string): string | null {
    const id = clientId || authService.getCurrentUser()?.clientId;
    if (!id) return null;
    const campaigns = dbService.getCampaignsByClient(id);
    const stored = localStorage.getItem(`postura_active_campaign_${id}`);
    if (stored && campaigns.some((c) => c.id === stored)) return stored;
    return campaigns[0]?.id || CAMP_ADOPTION;
  }

  private setActiveCampaign(campaignId: string) {
    const user = authService.getCurrentUser();
    const clientId = user?.clientId;
    if (clientId) localStorage.setItem(`postura_active_campaign_${clientId}`, campaignId);
    this.activeCampaignId = campaignId;
    this.render();
  }

  /** Cliente sobre el que se está trabajando, o null si estamos en la cartera. */
  private currentClientId(): string | null {
    return this.activeClientId !== 'all' ? this.activeClientId : null;
  }

  /** Cliente objetivo de una acción: el del workspace, el de la sesión, o el del elemento pulsado. */
  private resolveClientId(fallback?: string | null): string {
    const user = authService.getCurrentUser();
    return (
      fallback ||
      this.currentClientId() ||
      user?.clientId ||
      dbService.getClients()[0]?.id ||
      ''
    );
  }

  private enterClient(clientId: string, tab?: string) {
    this.activeClientId = clientId;
    this.activeTab = tab && tab.startsWith('ws-') ? tab : 'ws-briefing';
    this.filterState.topicKey = '';
    this.filterState.searchQuery = '';
    this.filterState.priorityBand = 'ALL';
    this.filterState.sourceType = 'ALL';
    const client = dbService.getClientById(clientId);
    auditService.log(authService.getCurrentUser(), 'OPEN_CLIENT_WORKSPACE', 'Client', clientId);
    this.showToast(`Trabajando con ${client?.displayName || clientId}`, 'info');
    this.render();
  }

  private backToPortfolio() {
    this.activeClientId = 'all';
    this.activeTab = 'dashboard';
    this.render();
  }

  public render() {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    const user = authService.getCurrentUser();
    if (!user) {
      appEl.innerHTML = renderLogin(this.loginError, new URLSearchParams(location.search).get('invite') || '');
      this.bindLogin();
      this.renderToasts();
      return;
    }

    const workspaceClientId = user.role === 'ADMIN' ? this.currentClientId() : null;

    appEl.innerHTML = `
      <div class="app-container">
        ${renderAppShell(this.activeTab, this.activeClientId, this.activeCampaignId)}
        <main class="main-wrapper">
          ${this.renderMainView()}
        </main>
        ${workspaceClientId ? renderBriefingBar(this.activeTab, workspaceClientId) : ''}
        ${this.renderActiveModal()}
      </div>
    `;

    this.bindEvents();
    this.renderToasts();
    if (user) processDeadlineReminders();
  }

  private renderMainView(): string {
    const user = authService.getCurrentUser();
    if (!user) return '';

    if (user.role !== 'ADMIN') {
      return renderClientPortal(
        this.activeTab,
        user.clientId || dbService.getClients()[0]?.id || '',
        this.activeCampaignId
      );
    }

    const clientId = this.currentClientId();
    if (clientId && isWorkspaceTab(this.activeTab)) {
      return renderClientWorkspace(this.activeTab, clientId, {
        searchQuery: this.activeTab === 'ws-production' ? this.filterState.contentSearch : this.filterState.searchQuery,
        sourceType: this.filterState.sourceType,
        priorityBand: this.filterState.priorityBand,
        contentStatus: this.filterState.contentStatus,
        topicKey: this.filterState.topicKey || undefined,
        radarView: this.filterState.radarView,
      });
    }

    return renderManagerCockpit(this.activeTab, {
      searchQuery: this.activeTab === 'dashboard' ? this.filterState.portfolioSearch : this.filterState.searchQuery,
      sourceType: this.filterState.sourceType,
      contentStatus: this.filterState.contentStatus,
    });
  }

  /** Redibuja y devuelve el foco al campo que lo tenía, para no interrumpir la escritura. */
  private refreshMain() {
    const active = document.activeElement as HTMLInputElement | null;
    const focusId = active?.id || '';
    const caret = active?.selectionStart ?? null;

    this.render();

    if (!focusId) return;
    const restored = document.getElementById(focusId) as HTMLInputElement | null;
    if (!restored) return;
    restored.focus();
    if (caret !== null && typeof restored.setSelectionRange === 'function') {
      restored.setSelectionRange(caret, caret);
    }
  }

  private bindLogin() {
    const form = document.getElementById('form-login');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('login-email') as HTMLInputElement).value;
      const password = (document.getElementById('login-password') as HTMLInputElement).value;
      const result = await authService.login(email, password);
      if (!result.ok) {
        this.loginError = result.message;
        this.render();
      } else {
        this.loginError = '';
      }
    });

    const inviteForm = document.getElementById('form-accept-invite');
    inviteForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = (document.getElementById('invite-token') as HTMLInputElement).value.trim();
      const name = (document.getElementById('invite-name') as HTMLInputElement).value.trim();
      const password = (document.getElementById('invite-password') as HTMLInputElement).value;
      const invite = dbService.getInvitationByToken(token);
      if (!invite) {
        this.loginError = 'Token de invitación inválido.';
        this.render();
        return;
      }
      const result = await authService.registerFromInvite(invite, password, name);
      if (!result.ok) {
        this.loginError = result.message;
        this.render();
        return;
      }
      dbService.markInvitationAccepted(invite.id);
      dbService.updateClient(invite.clientId, {
        userId: authService.getCurrentUser()?.uid,
        status: 'ACTIVE',
        onboardingStatus: 'IN_PROGRESS',
      });
    });
  }

  openModal(id: string) {
    this.activeModal = id;
    this.render();
  }

  setTab(tab: string) {
    const target = normalizeTab(tab);
    if (isWorkspaceTab(target) && !this.currentClientId()) {
      this.showToast('Entra primero a un cliente desde la cartera.', 'warning');
      return;
    }
    this.activeTab = target;
    this.render();
  }

  private renderActiveModal(): string {
    const fallbackClient = this.resolveClientId();

    if (this.activeModal === 'teleprompter' && this.modalData?.taskId) {
      return renderTeleprompterModal(this.modalData.taskId);
    }
    if (this.activeModal === 'create-client') {
      return renderCreateClientModal();
    }
    if (this.activeModal === 'onboarding') {
      return renderOnboardingWizard(this.modalData?.clientId || fallbackClient, this.modalData?.step || 1);
    }
    if (this.activeModal === 'thesis-editor') {
      return renderThesisEditorModal(this.modalData?.clientId || fallbackClient, this.modalData?.thesisId);
    }
    if (this.activeModal === 'source-registry') {
      return renderSourceRegistryModal(this.modalData?.clientId || this.currentClientId() || undefined);
    }
    if (this.activeModal === 'add-task' && this.modalData?.clientId) {
      return renderAddTaskModal(this.modalData.clientId);
    }
    if (this.activeModal === 'comparative' && this.modalData?.result) {
      return renderComparativeModal(this.modalData.result);
    }
    if (this.activeModal === 'challenge' && this.modalData) {
      return renderChallengeModal(this.modalData.title, this.modalData.challenge);
    }
    if (this.activeModal === 'add-evidence' && this.modalData?.clientId) {
      return renderAddEvidenceModal(this.modalData.clientId);
    }
    if (this.activeModal === 'content-editor' && this.modalData?.contentId) {
      return renderContentEditorModal(this.modalData.contentId);
    }
    if (this.activeModal === 'content-preview' && this.modalData?.contentId) {
      return renderContentPreviewModal(this.modalData.contentId);
    }
    if (this.activeModal === 'article-review' && this.modalData?.contentId) {
      return renderArticleReviewModal(this.modalData.contentId, this.modalData.taskId);
    }
    if (this.activeModal === 'content-diff' && this.modalData?.contentId) {
      return renderContentDiffModal(this.modalData.contentId);
    }
    if (this.activeModal === 'notifications') {
      return this.renderNotificationsPanel();
    }
    if (this.activeModal === 'feedback' && this.modalData) {
      return renderFeedbackModal(this.modalData.targetId, this.modalData.type, this.modalData.taskId);
    }
    return '';
  }

  closeModal(): void {
    if (this.activeModal === 'teleprompter') {
      this.stopRecordingSession();
      this.stopTeleprompter();
    }
    this.activeModal = null;
    this.modalData = null;
    this.render();
  }

  private renderNotificationsPanel(): string {
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
              ? items.map((item) => `
                  <article class="notification-row ${item.read ? 'read' : 'unread'}" data-notification-id="${esc(item.id)}" data-tab-link="${item.type === 'TASK_ASSIGNED' ? 'client-feed' : item.type === 'OPPORTUNITY' ? 'client-opps' : item.type === 'THESIS' ? 'client-thesis' : 'client-home'}">
                    <strong>${esc(item.title)}</strong>
                    <p class="muted small">${esc(item.body)}</p>
                    <span class="muted small">${new Date(item.createdAt).toLocaleString('es')}</span>
                  </article>
                `).join('')
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

  private bindEvents() {
    this.bindNavigation();
    this.bindFilters();
    this.bindSession();
    this.bindClientAdmin();
    this.bindOnboarding();
    this.bindThesis();
    this.bindDossier();
    this.bindSources();
    this.bindTasks();
    this.bindRadar();
    this.bindCuration();
    this.bindAdvisor();
    this.bindDelivery();
    this.bindContent();
    this.bindClientPortalActions();
    this.bindProfileActions();
    this.bindAiCenter();
  }

  // ==========================================
  // Navegación de dos niveles
  // ==========================================

  private bindNavigation() {
    document.getElementById('client-campaign-filter')?.addEventListener('change', (e) => {
      const campaignId = (e.currentTarget as HTMLSelectElement).value;
      if (campaignId) this.setActiveCampaign(campaignId);
    });

    document.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tab = target.getAttribute('data-tab');
        const topicKey = target.getAttribute('data-topic-key');
        if (topicKey) this.filterState.topicKey = topicKey;
        if (tab) {
          if (target.closest('.modal-overlay')) {
            this.activeModal = null;
            this.modalData = null;
          }
          this.setTab(tab);
        }
      });
    });

    document.querySelectorAll('[data-go-portfolio]').forEach((btn) => {
      btn.addEventListener('click', () => this.backToPortfolio());
    });

    document.querySelectorAll('.btn-enter-client').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const clientId = el.getAttribute('data-client-id');
        const tab = el.getAttribute('data-tab') || undefined;
        if (clientId) this.enterClient(clientId, tab);
      });
    });
  }

  // ==========================================
  // Filtros y búsqueda
  // ==========================================

  private bindFilters() {
    const portfolioSearch = document.getElementById('input-search-portfolio') as HTMLInputElement | null;
    portfolioSearch?.addEventListener('input', () => {
      this.filterState.portfolioSearch = portfolioSearch.value;
      this.refreshMain();
    });

    const signalSearch = document.getElementById('input-search-signals') as HTMLInputElement | null;
    signalSearch?.addEventListener('input', () => {
      this.filterState.searchQuery = signalSearch.value;
      this.refreshMain();
    });

    const contentSearch = document.getElementById('input-search-content') as HTMLInputElement | null;
    contentSearch?.addEventListener('input', () => {
      this.filterState.contentSearch = contentSearch.value;
      this.refreshMain();
    });

    document.querySelectorAll('[data-source-filter]').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        this.filterState.sourceType = (e.currentTarget as HTMLElement).getAttribute('data-source-filter') || 'ALL';
        this.refreshMain();
      });
    });

    document.querySelectorAll('[data-band-filter]').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        this.filterState.priorityBand = (e.currentTarget as HTMLElement).getAttribute('data-band-filter') || 'ALL';
        this.refreshMain();
      });
    });

    document.querySelectorAll('[data-radar-view]').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        const view = (e.currentTarget as HTMLElement).getAttribute('data-radar-view');
        this.filterState.radarView = view === 'list' ? 'list' : 'triage';
        this.refreshMain();
      });
    });

    document.querySelectorAll('[data-content-filter]').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        this.filterState.contentStatus = (e.currentTarget as HTMLElement).getAttribute('data-content-filter') || 'ALL';
        this.refreshMain();
      });
    });

    document.querySelectorAll('.btn-filter-topic').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.filterState.topicKey = (e.currentTarget as HTMLElement).getAttribute('data-topic-key') || '';
        this.refreshMain();
      });
    });

    document.querySelector('.btn-clear-topic-filter')?.addEventListener('click', () => {
      this.filterState.topicKey = '';
      this.refreshMain();
    });

    document.querySelectorAll('.btn-toggle-topic-pin').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const key = (e.currentTarget as HTMLElement).getAttribute('data-topic-key');
        if (!key) return;
        const pinned = dbService.toggleTopicPin(key);
        this.showToast(pinned ? 'Tema fijado' : 'Pin retirado', 'info');
        this.refreshMain();
      });
    });
  }

  // ==========================================
  // Sesión, impersonación y salida
  // ==========================================

  private bindSession() {
    document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
      const next = themeService.toggle();
      this.showToast(next === 'light' ? 'Tema claro activado' : 'Tema oscuro activado', 'info');
      this.render();
    });

    document.getElementById('btn-toggle-role')?.addEventListener('click', () => {
      const targetClientId = this.currentClientId();
      if (!targetClientId) {
        this.showToast('Entra a un cliente para ver su portal.', 'warning');
        return;
      }
      const client = dbService.getClientById(targetClientId);
      authService.impersonateClient(targetClientId, client?.displayName || 'Cliente');
      this.showToast(`Viendo el portal de ${client?.displayName || 'cliente'}`, 'info');
    });

    document.getElementById('btn-return-manager')?.addEventListener('click', () => {
      if (!authService.isImpersonating()) {
        this.showToast('No hay sesión de manager activa.', 'warning');
        return;
      }
      authService.returnToManager();
      this.showToast('De vuelta al cockpit', 'info');
    });

    bindSessionUi(this, {
      authLogout: async () => {
        await aiService.clearSessionKeys();
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
        this.showToast(`Sesión de cliente: ${client?.displayName || clientId}`, 'info');
      });
    });
  }

  // ==========================================
  // Alta de clientes
  // ==========================================

  private bindClientAdmin() {
    document.getElementById('btn-firebase-push-local')?.addEventListener('click', async () => {
      const result = await pushCurrentLocalToFirestore();
      this.showToast(result.message, result.ok ? 'success' : 'warning');
    });

    document.getElementById('btn-open-create-client')?.addEventListener('click', () => {
      this.activeModal = 'create-client';
      this.render();
    });

    ['btn-close-create-client', 'btn-cancel-create-client'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => this.closeModal());
    });

    document.getElementById('form-create-client')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
      const firstName = val('new-client-firstname');
      const lastName = val('new-client-lastname');
      const email = val('new-client-email');

      try {
        const newClient = dbService.createClient({
          organizationId: 'org_aurora_01',
          primaryManagerId: authService.getCurrentUser()?.uid || 'user_admin_01',
          firstName,
          lastName,
          displayName: `${firstName} ${lastName}`,
          primaryEmail: email,
          profession: val('new-client-profession'),
          company: val('new-client-company'),
          targetMarket: val('new-client-target'),
          onboardingStatus: 'NOT_STARTED',
          profileCompleteness: 15,
          status: 'INVITED',
          avatarUrl: ''
        });
        const invite = dbService.createInvitation(newClient.id, email);
        authService.createPendingAccount(email, newClient.id);
        notificationService.push({
          userId: authService.getCurrentUser()?.uid || 'user_admin_01',
          clientId: newClient.id,
          type: 'ONBOARDING',
          title: 'Cliente invitado',
          body: `${newClient.displayName} · token ${invite.token}`,
        });
        auditService.log(authService.getCurrentUser(), 'CREATE_CLIENT', 'Client', newClient.id, { email });
        this.showToast(`Cliente creado. Token de invitación: ${invite.token}`, 'success');
        this.activeModal = null;
        this.render();
      } catch (error) {
        this.showToast(error instanceof Error ? error.message : 'No se pudo crear el cliente', 'warning');
      }
    });
  }

  // ==========================================
  // Onboarding
  // ==========================================

  private bindOnboarding() {
    document.querySelectorAll('#btn-open-onboarding, .btn-open-onboarding').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id')
          || authService.getCurrentUser()?.clientId
          || this.resolveClientId();
        const profile = dbService.getMasterProfile(clientId);
        const step = nextIncompleteOnboardingStep(profile);
        this.activeModal = 'onboarding';
        this.modalData = { clientId, step };
        this.render();
      });
    });

    document.querySelectorAll('[data-onboarding-jump]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const step = parseInt((e.currentTarget as HTMLElement).getAttribute('data-onboarding-jump') || '1', 10);
        this.modalData = { clientId: this.modalData?.clientId || this.resolveClientId(), step };
        this.render();
      });
    });

    ['btn-close-onboarding', 'btn-onboarding-skip'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => {
        if (id === 'btn-onboarding-skip') {
          const clientId = this.modalData?.clientId || authService.getCurrentUser()?.clientId;
          if (clientId) {
            dbService.updateClient(clientId, { onboardingStatus: 'IN_PROGRESS' });
          }
          authService.clearOnboardingFlag();
        }
        this.closeModal();
      });
    });

    const formOnboardingStep = document.getElementById('form-onboarding-step');
    formOnboardingStep?.addEventListener('submit', (e) => {
      e.preventDefault();
      const step = parseInt(formOnboardingStep.getAttribute('data-step') || '1', 10);
      const clientId = formOnboardingStep.getAttribute('data-client-id') || this.resolveClientId();

      const val = (id: string) =>
        (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null)?.value || '';

      const fields: Record<string, string> = {};
      if (step === 1) {
        fields.displayName = val('onb-name');
        fields.selfDescription = val('onb-self-desc');
        fields.profession = val('onb-profession');
        fields.role = val('onb-role');
        fields.company = val('onb-company');
      }
      if (step === 2) {
        fields.primaryGoal = val('onb-primary-goal');
        fields.secondaryGoals = val('onb-sec-goals');
      }
      if (step === 3) {
        fields.targetAudience = val('onb-target-audience');
        fields.industries = val('onb-industries');
        fields.countries = val('onb-countries');
      }
      if (step === 4) {
        fields.education = val('onb-education');
        fields.highlights = val('onb-highlights');
      }
      if (step === 5) {
        fields.linkedin = val('onb-linkedin');
        fields.website = val('onb-website');
      }
      if (step === 6) {
        fields.tone = val('onb-tone');
        fields.avoid = val('onb-avoid');
        fields.compliance = val('onb-compliance');
      }

      dbService.applyOnboardingStep(clientId, step, fields);
      auditService.log(authService.getCurrentUser(), 'ONBOARDING_STEP_COMPLETED', 'Client', clientId, { step });

      if (step < 6) {
        this.modalData = { clientId, step: step + 1 };
        this.render();
        return;
      }

      auditService.log(authService.getCurrentUser(), 'COMPLETE_ONBOARDING', 'Client', clientId);
      notifyClient(clientId, {
        type: 'ONBOARDING',
        title: 'Perfil listo para revisión',
        body: 'El cliente completó el onboarding.',
      });
      authService.clearOnboardingFlag();
      this.showToast('Onboarding guardado. Perfil listo para revisión.', 'success');
      this.closeModal();
    });

    document.getElementById('btn-onboarding-prev')?.addEventListener('click', (e) => {
      const prev = parseInt((e.currentTarget as HTMLElement).getAttribute('data-prev') || '1', 10);
      this.modalData = { clientId: this.modalData?.clientId || this.resolveClientId(), step: prev };
      this.render();
    });
  }

  private bindProfileActions() {
    document.getElementById('btn-extract-cv-facts')?.addEventListener('click', (e) => {
      const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id')
        || authService.getCurrentUser()?.clientId
        || this.resolveClientId();
      const pasted = (document.getElementById('input-cv-paste') as HTMLTextAreaElement | null)?.value.trim();
      if (!pasted) {
        this.showToast('Pega el texto del CV o sube un archivo .txt', 'warning');
        return;
      }
      const count = dbService.importCandidateFactsFromCv(clientId, pasted);
      this.showToast(count ? `${count} facts candidatos extraídos` : 'No se encontraron facts nuevos', count ? 'success' : 'info');
      this.render();
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
        this.showToast(`${count} facts candidatos desde ${file.name}`, 'success');
        el.value = '';
        this.render();
      });
    });

    document.querySelectorAll('.btn-confirm-profile-fact').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const factId = el.getAttribute('data-fact-id');
        const clientId = el.getAttribute('data-client-id') || '';
        if (!factId || !clientId) return;
        dbService.confirmProfileFact(clientId, factId);
        this.showToast('Fact confirmado', 'success');
        this.render();
      });
    });

    document.querySelectorAll('.btn-reject-profile-fact').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const factId = el.getAttribute('data-fact-id');
        const clientId = el.getAttribute('data-client-id') || '';
        if (!factId || !clientId) return;
        dbService.rejectProfileFact(clientId, factId);
        this.showToast('Fact descartado', 'info');
        this.render();
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
        this.showToast('Fact actualizado', 'success');
        this.render();
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
        this.showToast('Fact añadido', 'success');
        this.render();
      });
    });

    document.querySelectorAll('.btn-toggle-proof-wall').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const itemId = el.getAttribute('data-item-id');
        const next = el.getAttribute('data-next-status') as 'complete' | 'pending';
        if (!itemId || !next) return;
        dbService.updateProofWallItem(itemId, next);
        this.showToast(next === 'complete' ? 'Activo marcado como listo' : 'Activo marcado como pendiente', 'success');
        this.render();
      });
    });
  }

  // ==========================================
  // Tesis
  // ==========================================

  private bindThesis() {
    document.querySelectorAll('.btn-open-thesis-editor, .btn-edit-thesis').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        this.activeModal = 'thesis-editor';
        this.modalData = {
          clientId: target.getAttribute('data-client-id') || this.resolveClientId(),
          thesisId: target.getAttribute('data-thesis-id') || undefined,
        };
        this.render();
      });
    });

    ['btn-close-thesis-editor', 'btn-cancel-thesis-editor'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => this.closeModal());
    });

    const formSaveThesis = document.getElementById('form-save-thesis');
    formSaveThesis?.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const clientId = formSaveThesis.getAttribute('data-client-id') || this.resolveClientId();
        const thesisId = formSaveThesis.getAttribute('data-thesis-id') || createId('thesis');
        const client = dbService.getClientById(clientId);

        const val = (id: string) =>
          (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement).value;

        const title = val('thesis-title');
        dbService.saveThesis({
          id: thesisId,
          organizationId: client?.organizationId || 'org_aurora_01',
          clientId,
          title,
          expertIdentity: val('thesis-expert-identity'),
          targetAudience: val('thesis-target-audience'),
          domain: val('thesis-domain'),
          objective: val('thesis-objective'),
          proofPoints: val('thesis-proof-points').split('\n').filter((p) => p.trim()),
          differentiator: val('thesis-differentiator') || undefined,
          voiceAndTone: 'Autoritativo, claro, orientado a mitigación de riesgos',
          complianceRules: val('thesis-compliance') || '',
          status: 'UNDER_REVIEW',
          clientApprovalStatus: 'PENDING',
          createdAt: new Date().toISOString(),
          createdBy: authService.getCurrentUser()?.uid || 'user_admin_01',
          updatedAt: new Date().toISOString(),
          updatedBy: authService.getCurrentUser()?.uid || 'user_admin_01'
        });

        auditService.log(authService.getCurrentUser(), 'SAVE_THESIS', 'PositioningThesis', thesisId, { title });
        const notified = notifyClient(clientId, {
          type: 'THESIS',
          title: 'Tesis lista para tu aprobación',
          body: title,
        });
        if (!notified) {
          this.showToast('Tesis guardada. El cliente aún no tiene cuenta para recibir aviso.', 'info');
        }
        this.showToast('Tesis enviada a revisión del cliente. No se activa sola.', 'success');
        this.closeModal();
      } catch (error) {
        this.showToast(error instanceof Error ? error.message : 'No se pudo guardar la tesis', 'warning');
      }
    });

    document.querySelectorAll('.btn-challenge-thesis').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const clientId = target.getAttribute('data-client-id') || this.resolveClientId();
        const thesis = dbService.getThesesByClient(clientId)[0];
        if (!thesis) {
          this.showToast('Este cliente no tiene tesis que someter a prueba.', 'warning');
          return;
        }
        target.disabled = true;
        target.textContent = 'Diagnosticando…';
        try {
          const challenge = await aiService.challengeThesis(thesis);
          this.activeModal = 'challenge';
          this.modalData = { title: thesis.title, challenge };
          this.render();
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'No se pudo evaluar la tesis', 'warning');
          this.render();
        }
      });
    });

    ['btn-close-challenge', 'btn-close-challenge-bottom'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => this.closeModal());
    });
  }

  private bindDossier() {
    document.querySelectorAll('.btn-export-dossier').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id') || this.resolveClientId();
        const client = dbService.getClientById(clientId);
        const dossier = dbService.getMasterDossier(clientId);
        if (!client || !dossier) {
          this.showToast('No hay dossier maestro para este cliente.', 'warning');
          return;
        }
        downloadDossierMarkdown(dossier, client);
        auditService.log(authService.getCurrentUser(), 'EXPORT_DOSSIER', 'MasterDossier', clientId);
        this.showToast('Dossier descargado en Markdown.', 'success');
      });
    });

    document.querySelectorAll('.btn-copy-dossier').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id') || this.resolveClientId();
        const client = dbService.getClientById(clientId);
        const dossier = dbService.getMasterDossier(clientId);
        if (!client || !dossier) {
          this.showToast('No hay dossier maestro para este cliente.', 'warning');
          return;
        }
        const markdown = formatDossierMarkdown(dossier, client);
        try {
          await navigator.clipboard.writeText(markdown);
          auditService.log(authService.getCurrentUser(), 'COPY_DOSSIER', 'MasterDossier', clientId);
          this.showToast('Dossier copiado al portapapeles.', 'success');
        } catch {
          this.showToast('No se pudo copiar. Usa Descargar .md', 'warning');
        }
      });
    });
  }

  // ==========================================
  // Fuentes e ingesta
  // ==========================================

  private bindSources() {
    document.getElementById('btn-open-source-registry')?.addEventListener('click', (e) => {
      const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id') || this.resolveClientId();
      this.activeModal = 'source-registry';
      this.modalData = { clientId };
      this.render();
    });

    document.getElementById('btn-close-source-registry')?.addEventListener('click', () => this.closeModal());

    document.getElementById('form-add-source')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const clientId = form.getAttribute('data-client-id') || this.resolveClientId();
      const name = (document.getElementById('src-name') as HTMLInputElement).value;
      const type = (document.getElementById('src-type') as HTMLSelectElement).value as Source['type'];
      const url = (document.getElementById('src-url') as HTMLInputElement).value;
      const thesis = dbService.getThesesByClient(clientId).find((t) => t.status === 'ACTIVE');

      try {
        dbService.addSource({
          organizationId: 'org_aurora_01',
          clientId,
          thesisId: thesis?.id,
          name,
          type,
          url: url || undefined,
          fetchIntervalMinutes: 360,
          status: 'ACTIVE',
          createdBy: authService.getCurrentUser()?.uid || 'user_admin_01'
        });
        auditService.log(authService.getCurrentUser(), 'ADD_SOURCE', 'Source', name, { type, clientId });
        this.showToast(`Fuente "${name}" registrada para el cliente`, 'success');
        this.activeModal = null;
        this.setTab('ws-sources');
      } catch (error) {
        this.showToast(error instanceof Error ? error.message : 'No se pudo añadir la fuente', 'warning');
      }
    });

    const pollAllBtn = document.getElementById('btn-poll-all-sources');
    pollAllBtn?.addEventListener('click', async () => {
      pollAllBtn.textContent = 'Buscando…';
      const { created, failed, rejected } = await this.pollSources();
      const parts: string[] = [];
      parts.push(created ? `${created} señal(es) nueva(s)` : 'Sin novedades');
      if (rejected) parts.push(`${rejected} descartada(s) por ruido`);
      if (failed) parts.push(`${failed} fuente(s) con error`);
      this.showToast(parts.join(' · '), created ? 'success' : failed ? 'warning' : 'info');
      this.activeModal = null;
      if (this.currentClientId()) {
        this.setTab(this.activeTab === 'ws-sources' ? 'ws-sources' : 'ws-radar');
      } else {
        this.render();
      }
    });

    document.querySelectorAll('.btn-probe-source').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const sourceId = (e.currentTarget as HTMLElement).getAttribute('data-source-id');
        const source = dbService.getSources().find((s) => s.id === sourceId);
        if (!source?.url) return;

        const el = e.currentTarget as HTMLButtonElement;
        el.textContent = 'Probando…';
        el.disabled = true;
        try {
          const { items, error } = await fetchSourceItems(source.url);
          if (error) {
            dbService.recordSourceRun(source.id, {
              fetched: 0,
              accepted: 0,
              rejected: 0,
              duplicates: 0,
              error,
            });
            this.showToast(`${source.name}: ${error}`, 'warning');
          } else {
            if (source.status === 'ERROR' || source.lastError) {
              dbService.updateSourceStatus(source.id, 'ACTIVE', { clearError: true });
            }
            this.showToast(`${source.name}: feed OK · ${items.length} item(s) legibles`, 'success');
          }
          this.render();
        } catch {
          this.showToast(`${source.name}: no se pudo probar el feed`, 'warning');
        } finally {
          el.textContent = 'Probar feed';
          el.disabled = false;
        }
      });
    });

    document.querySelectorAll('.btn-pause-source').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const sourceId = (e.currentTarget as HTMLElement).getAttribute('data-source-id');
        if (!sourceId) return;
        const source = dbService.updateSourceStatus(sourceId, 'PAUSED');
        if (!source) return;
        auditService.log(authService.getCurrentUser(), 'SOURCE_PAUSED', 'Source', sourceId);
        this.showToast(`Fuente «${source.name}» pausada`, 'info');
        this.render();
      });
    });

    document.querySelectorAll('.btn-resume-source').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const sourceId = (e.currentTarget as HTMLElement).getAttribute('data-source-id');
        if (!sourceId) return;
        const source = dbService.updateSourceStatus(sourceId, 'ACTIVE', { clearError: true });
        if (!source) return;
        auditService.log(authService.getCurrentUser(), 'SOURCE_RESUMED', 'Source', sourceId);
        this.showToast(`Fuente «${source.name}» reactivada`, 'success');
        this.render();
      });
    });

    document.querySelectorAll('.btn-archive-source').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const sourceId = (e.currentTarget as HTMLElement).getAttribute('data-source-id');
        if (!sourceId) return;
        const existing = dbService.getSources().find((s) => s.id === sourceId);
        if (!existing) return;
        if (!window.confirm(`¿Archivar «${existing.name}»? Dejará de aparecer en ingesta.`)) return;
        const source = dbService.updateSourceStatus(sourceId, 'ARCHIVED');
        if (!source) return;
        auditService.log(authService.getCurrentUser(), 'SOURCE_ARCHIVED', 'Source', sourceId);
        this.showToast(`Fuente «${source.name}» archivada`, 'info');
        this.render();
      });
    });

    document.querySelectorAll('.btn-poll-one-source').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const sourceId = (e.currentTarget as HTMLElement).getAttribute('data-source-id');
        const source = dbService.getSources().find((s) => s.id === sourceId);
        if (!source?.url) return;
        try {
          const { created, rejected } = await this.pollOneSource(source);
          this.showToast(
            `${source.name}: ${created} nueva(s)${rejected ? `, ${rejected} filtrada(s)` : ''}`,
            created ? 'success' : 'info'
          );
          this.render();
        } catch (error) {
          this.showToast(`${source.name}: ${error instanceof Error ? error.message : 'fallo RSS'}`, 'warning');
          this.render();
        }
      });
    });

    document.querySelectorAll('.btn-add-discovered-source').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const clientId = el.getAttribute('data-client-id') || this.resolveClientId();
        const key = el.getAttribute('data-discovery-key');
        const client = dbService.getClientById(clientId);
        if (!client || !key) return;

        const theses = dbService.getThesesByClient(clientId);
        const thesis = theses.find((t) => t.status === 'ACTIVE') || theses[0];
        const candidate = resolveDiscoveryCandidate(client, thesis, key);
        if (!candidate) return;

        try {
          dbService.addSource({
            organizationId: client.organizationId,
            clientId,
            thesisId: thesis?.id,
            name: candidate.name,
            type: candidate.type,
            url: candidate.url,
            fetchIntervalMinutes: fetchIntervalForKind(candidate.kind),
            status: 'ACTIVE',
            createdBy: authService.getCurrentUser()?.uid || 'user_admin_01',
          });
          auditService.log(authService.getCurrentUser(), 'ADD_DISCOVERED_SOURCE', 'Source', candidate.key, { clientId });
          this.showToast(`Fuente añadida: ${candidate.name}`, 'success');
          this.setTab('ws-sources');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'No se pudo añadir la fuente', 'warning');
        }
      });
    });

    const fetchIntervalForKind = (kind: string): number => {
      if (kind === 'QUERY' || kind === 'SOCIAL') return 180;
      if (kind === 'YOUTUBE') return 240;
      if (kind === 'ACADEMIC') return 360;
      return 360;
    };

    const addAllBtn = document.getElementById('btn-add-all-discovered');
    addAllBtn?.addEventListener('click', async () => {
      const clientId = addAllBtn.getAttribute('data-client-id') || this.resolveClientId();
      const client = dbService.getClientById(clientId);
      if (!client) return;

      const theses = dbService.getThesesByClient(clientId);
      const thesis = theses.find((t) => t.status === 'ACTIVE') || theses[0];
      const lastRun = loadLastAgentRun(clientId);
      const existing = new Set(
        dbService.getSourcesByClient(clientId).map((s) => normalizeSourceUrl(s.url || ''))
      );
      const candidates = (
        lastRun?.recommendations.length
          ? lastRun.recommendations
          : discoverSources(client, thesis)
      ).filter((d) => !existing.has(normalizeSourceUrl(d.url)));

      let added = 0;
      for (const candidate of candidates) {
        try {
          dbService.addSource({
            organizationId: client.organizationId,
            clientId,
            thesisId: thesis?.id,
            name: candidate.name,
            type: candidate.type,
            url: candidate.url,
            fetchIntervalMinutes: fetchIntervalForKind(candidate.kind),
            status: 'ACTIVE',
            createdBy: authService.getCurrentUser()?.uid || 'user_admin_01',
          });
          added += 1;
        } catch {
          continue;
        }
      }

      auditService.log(authService.getCurrentUser(), 'ADD_DISCOVERED_SOURCES_BULK', 'Client', clientId, { added });
      addAllBtn.textContent = 'Ingiriendo…';
      const { created, failed } = await this.pollSources();
      this.showToast(
        `${added} fuente(s) activada(s) · ${created} señal(es)${failed ? ` · ${failed} con error` : ''}`,
        created ? 'success' : 'info'
      );
      this.setTab('ws-sources');
    });

    const extendedBtn = document.getElementById('btn-add-extended-sources');
    extendedBtn?.addEventListener('click', async () => {
      const clientId = extendedBtn.getAttribute('data-client-id') || this.resolveClientId();
      const client = dbService.getClientById(clientId);
      if (!client) return;

      const theses = dbService.getThesesByClient(clientId);
      const thesis = theses.find((t) => t.status === 'ACTIVE') || theses[0];
      const keywords = buildProfileKeywords(client, thesis);
      const profile = dbService.getMasterProfile(clientId);
      const extendedBase = discoverExtendedSources(client, thesis);
      const enriched = await enrichYoutubeDiscoverySources(extendedBase, keywords, profile || undefined);
      const existing = new Set(
        dbService.getSourcesByClient(clientId).map((s) => normalizeSourceUrl(s.url || ''))
      );
      const candidates = enriched.sources.filter((d) => !existing.has(normalizeSourceUrl(d.url)));

      if (!candidates.length) {
        this.showToast('Social, YouTube y académico ya están activos', 'info');
        return;
      }

      let added = 0;
      for (const candidate of candidates) {
        try {
          dbService.addSource({
            organizationId: client.organizationId,
            clientId,
            thesisId: thesis?.id,
            name: candidate.name,
            type: candidate.type,
            url: candidate.url,
            fetchIntervalMinutes: fetchIntervalForKind(candidate.kind),
            status: 'ACTIVE',
            createdBy: authService.getCurrentUser()?.uid || 'user_admin_01',
          });
          added += 1;
        } catch {
          continue;
        }
      }

      auditService.log(authService.getCurrentUser(), 'ADD_EXTENDED_SOURCES', 'Client', clientId, { added });
      extendedBtn.textContent = 'Ingiriendo…';
      const { created, failed } = await this.pollSources();
      this.showToast(
        `Social/YouTube/académico: ${added} fuente(s) · ${created} señal(es)${failed ? ` · ${failed} con error` : ''}`,
        created ? 'success' : 'info'
      );
      this.setTab('ws-sources');
    });

    const curatedTopBtn = document.getElementById('btn-add-curated-top3');
    curatedTopBtn?.addEventListener('click', async () => {
      const clientId = curatedTopBtn.getAttribute('data-client-id') || this.resolveClientId();
      const client = dbService.getClientById(clientId);
      if (!client) return;

      const theses = dbService.getThesesByClient(clientId);
      const thesis = theses.find((t) => t.status === 'ACTIVE') || theses[0];
      if (!thesis) return;

      const keywords = buildProfileKeywords(client, thesis);
      const existing = new Set(
        dbService.getSourcesByClient(clientId).map((s) => normalizeSourceUrl(s.url || ''))
      );
      const candidates = buildCuratedPresetsForProfile(client, thesis, keywords).filter(
        (d) => !existing.has(normalizeSourceUrl(d.url))
      );

      if (!candidates.length) {
        this.showToast('Las 3 fuentes top ya están activas', 'info');
        return;
      }

      let added = 0;
      for (const candidate of candidates) {
        try {
          dbService.addSource({
            organizationId: client.organizationId,
            clientId,
            thesisId: thesis?.id,
            name: candidate.name,
            type: candidate.type,
            url: candidate.url,
            fetchIntervalMinutes: 240,
            status: 'ACTIVE',
            createdBy: authService.getCurrentUser()?.uid || 'user_admin_01',
          });
          added += 1;
        } catch {
          continue;
        }
      }

      auditService.log(authService.getCurrentUser(), 'ADD_CURATED_TOP3_SOURCES', 'Client', clientId, { added });
      curatedTopBtn.textContent = 'Ingiriendo…';
      const { created, failed } = await this.pollSources();
      this.showToast(
        `Top 3 activado(s): ${added} fuente(s) · ${created} señal(es)${failed ? ` · ${failed} con error` : ''}`,
        created ? 'success' : 'info'
      );
      this.setTab('ws-radar');
    });

    const bindManualSignal = (el: Element) => {
      el.addEventListener('click', (e) => {
        const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id') || this.resolveClientId();
        this.promptManualSignal(clientId);
      });
    };

    const manualBtn = document.getElementById('btn-add-manual-signal');
    if (manualBtn) bindManualSignal(manualBtn);
    const manualInlineBtn = document.getElementById('btn-add-manual-signal-inline');
    if (manualInlineBtn) bindManualSignal(manualInlineBtn);

    document.querySelectorAll('.btn-apply-source-suggestion').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const type = el.getAttribute('data-suggestion-type');
        const nameHint = el.getAttribute('data-suggestion-name');
        const typeSelect = document.getElementById('src-type') as HTMLSelectElement | null;
        const nameInput = document.getElementById('src-name') as HTMLInputElement | null;

        if (type && typeSelect) typeSelect.value = type;
        if (nameHint && nameInput && !nameInput.value.trim()) nameInput.value = nameHint;
        nameInput?.focus();
      });
    });

    document.querySelectorAll('.btn-open-agent-sources').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeModal = null;
        this.setTab('ws-sources');
      });
    });

    const tavilyRescanBtn = document.getElementById('btn-tavily-rescan');
    tavilyRescanBtn?.addEventListener('click', async () => {
      const clientId = tavilyRescanBtn.getAttribute('data-client-id') || this.resolveClientId();
      const client = dbService.getClientById(clientId);
      if (!client) return;

      const theses = dbService.getThesesByClient(clientId);
      const thesis = theses.find((t) => t.status === 'ACTIVE') || theses[0];
      tavilyRescanBtn.textContent = 'Buscando…';
      tavilyRescanBtn.setAttribute('disabled', 'true');

      try {
        const run = await runSourceDiscoveryAgentAsync(client, thesis, { forceTavily: true });
        saveAgentRun(run);
        const tavilyCount = run.recommendations.filter((r) => r.kind === 'TAVILY').length;
        if (run.tavilyError === 'TAVILY_KEY_MISSING') {
          this.showToast('Configura TAVILY_API_KEY en .env.local y reinicia el servidor', 'warning');
        } else if (tavilyCount) {
          this.showToast(
            `Tavily: ${tavilyCount} fuente(s) web nueva(s) para ${client.displayName}`,
            'success'
          );
        } else {
          this.showToast('Tavily: sin fuentes nuevas para este perfil', 'info');
        }
        this.setTab('ws-sources');
      } catch (error) {
        this.showToast(error instanceof Error ? error.message : 'Fallo búsqueda Tavily', 'warning');
      } finally {
        tavilyRescanBtn.textContent = 'Buscar con Tavily';
        tavilyRescanBtn.removeAttribute('disabled');
      }
    });
  }

  private promptManualSignal(clientId: string) {
    const title = prompt('Título de la noticia o acontecimiento:');
    if (!title?.trim()) return;

    const result = dbService.addSignal({
      organizationId: 'org_aurora_01',
      clientId,
      title: title.trim(),
      sourceType: 'MANUAL',
      sourceName: 'Ingesta manual del manager',
      contentSnippet: 'Acontecimiento ingresado manualmente para evaluación estratégica.',
      status: 'NEW',
    });

    if (result.isDuplicate) {
      this.showToast('Esta señal ya estaba registrada.', 'warning');
      return;
    }
    this.scoreSignal(result.signal.id, clientId);
    auditService.log(authService.getCurrentUser(), 'INGEST_SIGNAL_MANUAL', 'Signal', result.signal.id);
    this.showToast('Señal añadida. Revisa el radar.', 'success');
    this.setTab('ws-radar');
  }

  // ==========================================
  // Tareas del cliente
  // ==========================================

  private bindTasks() {
    document.getElementById('btn-open-add-task')?.addEventListener('click', (e) => {
      const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id') || this.resolveClientId();
      this.activeModal = 'add-task';
      this.modalData = { clientId };
      this.render();
    });

    ['btn-close-add-task', 'btn-cancel-add-task'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => this.closeModal());
    });

    document.getElementById('form-add-task')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const clientId = form.getAttribute('data-client-id') || this.resolveClientId();
      const thesisId = form.getAttribute('data-thesis-id') || undefined;
      const client = dbService.getClientById(clientId);

      const title = (document.getElementById('task-title') as HTMLInputElement).value.trim();
      const description = (document.getElementById('task-description') as HTMLTextAreaElement).value.trim();
      const type = (document.getElementById('task-type') as HTMLSelectElement).value as TaskType;
      const estimatedMinutes = parseInt((document.getElementById('task-minutes') as HTMLInputElement).value || '15', 10);
      const deadlineRaw = (document.getElementById('task-deadline') as HTMLInputElement).value;

      dbService.addTask({
        organizationId: client?.organizationId || 'org_aurora_01',
        clientId,
        thesisId,
        type,
        title,
        description,
        estimatedMinutes,
        deadline: deadlineRaw ? new Date(deadlineRaw).toISOString() : undefined,
        status: 'ASSIGNED',
      });

      const notified = notifyClient(clientId, {
        type: 'TASK_ASSIGNED',
        title: 'Nueva tarea asignada',
        body: title,
      });
      if (!notified) {
        this.showToast('Tarea guardada. El cliente no tiene cuenta vinculada para avisos.', 'info');
      }

      auditService.log(authService.getCurrentUser(), 'ASSIGN_TASK', 'Task', clientId, { title, type });
      this.showToast('Tarea asignada. El cliente la verá en su portal.', 'success');
      this.activeModal = null;
      this.setTab('ws-tasks');
    });

    document.querySelectorAll('.btn-cancel-task').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const taskId = (e.currentTarget as HTMLElement).getAttribute('data-task-id');
        if (!taskId) return;
        if (!confirm('¿Cancelar esta tarea? El cliente dejará de verla como pendiente.')) return;
        dbService.updateTaskStatus(taskId, 'CANCELLED');
        auditService.log(authService.getCurrentUser(), 'CANCEL_TASK', 'Task', taskId);
        this.showToast('Tarea cancelada', 'info');
        this.render();
      });
    });
  }

  // ==========================================
  // Radar
  // ==========================================

  /** Calcula y persiste el score de una señal contra la tesis activa del cliente. */
  /** Términos del perfil y del dossier que permiten puntuar contenido bilingüe. */
  private scoringContext(clientId: string): ScoringContext {
    const client = dbService.getClientById(clientId);
    if (!client) return {};
    const theses = dbService.getThesesByClient(clientId);
    const thesis = theses.find((t) => t.status === 'ACTIVE') || theses[0];
    const keywords = buildProfileKeywords(client, thesis);
    const dossier = dbService.getMasterDossier(clientId);
    const hints = feedbackScoringHints(
      dbService.getSignalsByClient(clientId),
      dbService.getSignalOutcomes(clientId)
    );
    return {
      bilingualTerms: [...keywords.coreEn, ...keywords.coreEs, ...hints.boostTerms],
      ownedTopics: dossier?.topicsToOwn,
      avoidedFramings: [...(dossier?.topicsToAvoid || []), ...hints.avoidTerms],
    };
  }

  private scoreSignal(signalId: string, clientId: string): number | null {
    const signal = dbService.getSignalById(signalId);
    const theses = dbService.getThesesByClient(clientId);
    const thesis = theses.find((t) => t.status === 'ACTIVE') || theses[0];
    if (!signal || !thesis) return null;
    const score = calculateStrategicScore(signal, thesis, this.scoringContext(clientId));
    dbService.applyScoreToSignal(signalId, score);
    return score.totalScore;
  }

  private bindRadar() {
    document.getElementById('btn-score-all-signals')?.addEventListener('click', (e) => {
      const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id') || this.resolveClientId();
      const pending = dbService.getSignalsByClient(clientId).filter((s) => s.relevanceScore === undefined && s.status !== 'DISCARDED');
      let scored = 0;
      pending.forEach((s) => {
        if (this.scoreSignal(s.id, clientId) !== null) scored += 1;
      });
      auditService.log(authService.getCurrentUser(), 'SCORE_SIGNALS_BULK', 'Client', clientId, { scored });
      this.showToast(scored ? `${scored} señal(es) puntuada(s)` : 'No hay tesis activa para puntuar', scored ? 'success' : 'warning');
      this.render();
    });

    document.getElementById('btn-research-all-signals')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      const clientId = btn.getAttribute('data-client-id') || this.resolveClientId();
      btn.disabled = true;
      btn.textContent = 'Investigando…';
      try {
        const result = await runResearchSignalsAgent(clientId, { maxSignals: 3 });
        const ok = result.briefs.length;
        const err = result.errors.length;
        if (result.errors.some((x) => x.error === 'TAVILY_KEY_MISSING')) {
          this.showToast('Configura TAVILY_API_KEY en .env.local', 'warning');
        } else {
          this.showToast(
            ok ? `${ok} señal(es) investigada(s)${err ? ` · ${err} error(es)` : ''}` : 'Sin señales pendientes o Tavily falló',
            ok ? 'success' : 'warning'
          );
        }
        auditService.log(authService.getCurrentUser(), 'RESEARCH_SIGNALS_RUN', 'Client', clientId, { ok, err });
        metricsService.track('research_signals_run', { ok, err }, clientId);
      } catch (error) {
        this.showToast(error instanceof Error ? error.message : 'Investigación fallida', 'warning');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Investigar pendientes';
        this.render();
      }
    });

    document.querySelectorAll('.btn-research-signal').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const signalId = target.getAttribute('data-signal-id');
        if (!signalId) return;
        const signal = dbService.getSignalById(signalId);
        const clientId = this.resolveClientId(signal?.clientId);
        target.disabled = true;
        target.textContent = '…';
        try {
          const result = await runResearchSignalsAgent(clientId, { signalId, maxSignals: 1 });
          if (result.briefs.length) {
            this.showToast('Evidencia Tavily adjunta a la señal', 'success');
          } else if (result.errors.some((x) => x.error === 'TAVILY_KEY_MISSING')) {
            this.showToast('Configura TAVILY_API_KEY en .env.local', 'warning');
          } else {
            this.showToast(result.errors[0]?.error || 'Sin resultados', 'warning');
          }
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Error', 'warning');
        }
        this.render();
      });
    });

    document.querySelectorAll('.btn-analyze-signal').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const signalId = target.getAttribute('data-signal-id');
        if (!signalId) return;

        const signal = dbService.getSignalById(signalId);
        const clientId = this.resolveClientId(signal?.clientId);
        const theses = dbService.getThesesByClient(clientId);
        const thesis = theses.find((t) => t.status === 'ACTIVE') || theses[0];

        if (!signal || !thesis) {
          this.showToast('Define una tesis activa para poder puntuar señales.', 'warning');
          return;
        }

        target.disabled = true;
        target.textContent = 'Analizando…';
        try {
          const rec = await aiService.analyzeSignalAgainstThesis(signal, thesis);
          const { usedLiveModel, ...payload } = rec as typeof rec & { usedLiveModel?: boolean };
          dbService.addRecommendation(payload);
          dbService.applyScoreToSignal(signalId, calculateStrategicScore(signal, thesis, this.scoringContext(clientId)));
          this.showToast(
            `Score ${payload.impactScore}/100${usedLiveModel ? ' · con modelo' : ' · scoring local'}`,
            'success'
          );
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'No se pudo analizar', 'warning');
        }
        this.render();
      });
    });

    document.querySelectorAll('.btn-discard-signal').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-signal-id');
        if (!id) return;
        dbService.decideSignal(id, 'DISCARDED', 'Descartado por el manager en el radar.');
        auditService.log(authService.getCurrentUser(), 'SIGNAL_DISCARDED', 'Signal', id);
        this.showToast('Señal descartada', 'info');
        this.refreshMain();
      });
    });

    document.querySelectorAll('.btn-signal-outcome').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const signalId = el.getAttribute('data-signal-id');
        const kind = el.getAttribute('data-outcome') as 'USEFUL' | 'NOT_USEFUL' | null;
        if (!signalId || (kind !== 'USEFUL' && kind !== 'NOT_USEFUL')) return;
        const signal = dbService.getSignalById(signalId);
        const clientId = this.resolveClientId(signal?.clientId);
        if (!signal || !clientId) return;
        dbService.recordSignalOutcome({
          organizationId: signal.organizationId,
          clientId,
          signalId,
          kind,
          source: 'RADAR',
          actorUid: authService.getCurrentUser()?.uid || 'user_admin_01',
        });
        auditService.log(authService.getCurrentUser(), 'SIGNAL_OUTCOME', 'Signal', signalId, { kind });
        metricsService.track('signal_outcome', { kind }, clientId);
        const open = dbService
          .getSignalsByClient(clientId)
          .filter((s) => s.status !== 'DISCARDED' && s.relevanceScore !== undefined)
          .slice(0, 40);
        for (const s of open) this.scoreSignal(s.id, clientId);
        this.showToast(
          kind === 'USEFUL'
            ? `Marcada como útil — recalibradas ${open.length} señal(es)`
            : `Marcada como no útil — recalibradas ${open.length} señal(es)`,
          'success'
        );
        this.refreshMain();
      });
    });

    document.querySelectorAll('.btn-send-to-curation').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const signalId = (e.currentTarget as HTMLElement).getAttribute('data-signal-id');
        if (!signalId) return;

        const signal = dbService.getSignalById(signalId);
        const clientId = this.resolveClientId(signal?.clientId);
        if (!signal) return;

        if (dbService.isSignalInCuration(clientId, signalId)) {
          this.showToast('Esta señal ya está en la mesa de curación.', 'info');
          return;
        }

        if (signal.relevanceScore === undefined) this.scoreSignal(signalId, clientId);
        const scored = dbService.getSignalById(signalId);

        dbService.addToCuration({
          organizationId: signal.organizationId,
          clientId,
          signalId,
          title: signal.title,
          sourceName: signal.sourceName,
          sourceUrl: signal.sourceUrl,
          snippet: signal.contentSnippet,
          score: scored?.relevanceScore,
          priorityBand: scored?.priorityBand,
          suggestedAction: scored?.recommendedAction,
          createdBy: authService.getCurrentUser()?.uid || 'user_admin_01',
        });

        dbService.decideSignal(signalId, 'SAVED');
        auditService.log(authService.getCurrentUser(), 'SIGNAL_TO_CURATION', 'Signal', signalId, { clientId });
        this.showToast('Enviada a curación', 'success');
        this.refreshMain();
      });
    });
  }

  // ==========================================
  // Mesa de curación
  // ==========================================

  /** Mete un ítem curado en el briefing borrador del cliente (creándolo si hace falta). */
  private queueCurationInBriefing(curationId: string): boolean {
    const entry = dbService.getCurationById(curationId);
    if (!entry || !entry.destination || entry.destination === 'DISCARD' || entry.deliveryPackageId) {
      return false;
    }

    const pkg = dbService.ensureDraftDelivery(
      entry.clientId,
      authService.getCurrentUser()?.uid || 'user_admin_01'
    );
    dbService.addDeliveryItem(pkg.id, {
      kind: DESTINATION_TO_KIND[entry.destination],
      refId: entry.id,
      title: entry.aiAngle || entry.title,
      note: entry.snippet,
      url: entry.sourceUrl,
      rationale: entry.managerRationale,
    });
    dbService.attachCurationToDelivery(curationId, pkg.id);
    return true;
  }

  private bindCuration() {
    document.querySelectorAll('.curation-form').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const el = form as HTMLFormElement;
        const curationId = el.getAttribute('data-curation-id');
        if (!curationId) return;

        const destination = (el.querySelector('[name="destination"]') as HTMLSelectElement).value as CurationDestination;
        const rationale = (el.querySelector('[name="rationale"]') as HTMLTextAreaElement).value.trim();

        if (!destination) {
          this.showToast('Elige un destino para este ítem.', 'warning');
          return;
        }
        if (rationale.length < 10) {
          this.showToast('Escribe una justificación de al menos 10 caracteres.', 'warning');
          return;
        }

        const entry = dbService.decideCuration(
          curationId,
          destination,
          rationale,
          authService.getCurrentUser()?.uid || 'user_admin_01'
        );

        if (entry?.signalId && destination === 'DISCARD') {
          dbService.decideSignal(entry.signalId, 'DISCARDED', rationale);
        }

        auditService.log(authService.getCurrentUser(), 'CURATION_DECIDED', 'CurationEntry', curationId, {
          destination,
          rationale,
        });

        // Curación y entrega son una sola sesión: al decidir, el ítem entra al briefing.
        const queued = entry && destination !== 'DISCARD'
          ? this.queueCurationInBriefing(curationId)
          : false;

        this.showToast(
          destination === 'DISCARD'
            ? 'Ítem descartado con justificación'
            : queued
              ? 'Destino confirmado y añadido al briefing'
              : 'Destino confirmado. Añádelo al briefing cuando quieras.',
          'success'
        );
        this.render();
      });
    });

    document.querySelectorAll('.btn-suggest-angle').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const curationId = target.getAttribute('data-curation-id');
        if (!curationId) return;

        const entry = dbService.getCurationById(curationId);
        if (!entry) return;

        target.disabled = true;
        target.textContent = 'Pensando…';
        try {
          const { angle, usedLiveModel } = await proposeAngle({
            clientId: entry.clientId,
            title: entry.title,
            snippet: entry.snippet,
          });
          dbService.setCurationAngle(curationId, angle);
          this.showToast(usedLiveModel ? 'Ángulo propuesto con modelo' : 'Ángulo propuesto con reglas locales', 'success');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'No se pudo proponer el ángulo', 'warning');
        }
        this.render();
      });
    });

    document.querySelectorAll('.btn-remove-curation').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-curation-id');
        if (!id) return;
        dbService.removeCuration(id);
        auditService.log(authService.getCurrentUser(), 'CURATION_REMOVED', 'CurationEntry', id);
        this.showToast('Ítem retirado de la mesa', 'info');
        this.render();
      });
    });

    document.querySelectorAll('.btn-reopen-curation').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-curation-id');
        if (!id) return;
        dbService.reopenCuration(id);
        this.showToast('Ítem reabierto para volver a decidir', 'info');
        this.render();
      });
    });
  }

  // ==========================================
  // Asesor de posicionamiento
  // ==========================================

  private bindAdvisor() {
    const adviceBtn = document.getElementById('btn-generate-advice');
    adviceBtn?.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const clientId = target.getAttribute('data-client-id') || this.resolveClientId();
      target.disabled = true;
      target.textContent = 'Analizando…';
      try {
        const advice = await generatePositioningAdvice(clientId);
        this.showToast(
          `${advice.actions.length} acción(es) propuesta(s)${advice.usedLiveModel ? ' con modelo' : ' con reglas locales'}`,
          'success'
        );
      } catch (error) {
        this.showToast(error instanceof Error ? error.message : 'No se pudo generar el diagnóstico', 'warning');
      }
      this.render();
    });

    document.getElementById('btn-run-topic-agent')?.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const clientId = target.getAttribute('data-client-id') || this.resolveClientId();
      target.disabled = true;
      const result = runTopicAgent(clientId);
      this.showToast(`Ranking generado: ${result.items.length} temas`, 'success');
      this.render();
    });

    document.querySelectorAll('.btn-advice-to-curation').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const clientId = target.getAttribute('data-client-id') || this.resolveClientId();
        const actionId = target.getAttribute('data-action-id');
        const advice = dbService.getLatestAdvice(clientId);
        const action = advice?.actions.find((a) => a.id === actionId);
        if (!action) return;

        const client = dbService.getClientById(clientId);
        dbService.addToCuration({
          organizationId: client?.organizationId || 'org_aurora_01',
          clientId,
          title: action.title,
          snippet: `${action.why} ${action.how}`,
          score: action.impact,
          aiAngle: action.how,
          createdBy: authService.getCurrentUser()?.uid || 'user_admin_01',
        });

        auditService.log(authService.getCurrentUser(), 'ADVICE_TO_CURATION', 'Client', clientId, { actionId });
        this.showToast('Acción enviada a la mesa de curación', 'success');
        this.setTab('ws-curation');
      });
    });
  }

  // ==========================================
  // Entregas
  // ==========================================

  private bindDelivery() {
    document.getElementById('btn-create-delivery')?.addEventListener('click', (e) => {
      const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id') || this.resolveClientId();
      dbService.ensureDraftDelivery(clientId, authService.getCurrentUser()?.uid || 'user_admin_01');
      this.showToast('Briefing creado. Añade los ítems curados.', 'success');
      this.render();
    });

    const metaForm = document.getElementById('form-delivery-meta');
    metaForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const packageId = metaForm.getAttribute('data-package-id');
      if (!packageId) return;
      dbService.updateDelivery(packageId, {
        title: (document.getElementById('delivery-title') as HTMLInputElement).value,
        strategicNote: (document.getElementById('delivery-note') as HTMLTextAreaElement).value,
      });
      this.showToast('Nota estratégica guardada', 'success');
      this.render();
    });

    document.querySelectorAll('.btn-add-to-delivery').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const curationId = (e.currentTarget as HTMLElement).getAttribute('data-curation-id');
        if (!curationId) return;
        if (!this.queueCurationInBriefing(curationId)) {
          this.showToast('Ese ítem ya está en un briefing.', 'info');
          return;
        }
        this.showToast('Añadido al briefing', 'success');
        this.render();
      });
    });

    document.querySelectorAll('.btn-remove-delivery-item').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const packageId = target.getAttribute('data-package-id');
        const itemId = target.getAttribute('data-item-id');
        if (!packageId || !itemId) return;

        const pkg = dbService.getDeliveryById(packageId);
        const item = pkg?.items.find((i) => i.id === itemId);
        if (item?.refId) dbService.attachCurationToDelivery(item.refId, '');
        dbService.removeDeliveryItem(packageId, itemId);
        this.showToast('Ítem retirado del briefing', 'info');
        this.render();
      });
    });

    ['btn-send-delivery', 'btn-send-delivery-bar'].forEach((id) => {
      const sendBtn = document.getElementById(id) as HTMLButtonElement | null;
      sendBtn?.addEventListener('click', async () => {
        const packageId = sendBtn.getAttribute('data-package-id');
        if (!packageId) return;
        sendBtn.disabled = true;
        sendBtn.textContent = 'Enviando…';
        try {
          await this.sendDelivery(packageId);
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'No se pudo enviar el briefing', 'warning');
          this.render();
        }
      });
    });

    document.querySelectorAll('.btn-acknowledge-delivery').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-package-id');
        if (!id) return;
        dbService.acknowledgeDelivery(id);
        this.showToast('Briefing marcado como visto', 'success');
        this.render();
      });
    });
  }

  /** Materializa el briefing: crea tareas, oportunidades y evidencias, y notifica al cliente. */
  private async sendDelivery(packageId: string) {
    const pkg = dbService.getDeliveryById(packageId);
    if (!pkg) return;

    const clientId = pkg.clientId;
    const client = dbService.getClientById(clientId);
    const theses = dbService.getThesesByClient(clientId);
    const thesis = theses.find((t) => t.status === 'ACTIVE') || theses[0];
    let createdTasks = 0;

    for (const item of pkg.items) {
      const entry = item.refId ? dbService.getCurationById(item.refId) : undefined;
      const destination = entry?.destination;

      if ((destination === 'TASK_VIDEO' || destination === 'TASK_ARTICLE') && thesis) {
        const format = destination === 'TASK_VIDEO' ? 'VIDEO_SCRIPT' : 'LINKEDIN_ARTICLE';
        const draft = await aiService.generateContentDraft(thesis, item.title, format);
        const contentId = createId('cnt');
        dbService.saveContent({
          ...draft,
          id: contentId,
          status: 'CLIENT_REVIEW',
          managerNotes: `${draft.managerNotes || ''} Justificación: ${item.rationale || 'sin nota'}`.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        this.syncContentToPipelineStatus(contentId, 'CLIENT_REVIEW', 'Enviado con briefing');

        dbService.addTask({
          organizationId: thesis.organizationId,
          clientId,
          thesisId: thesis.id,
          type: destination === 'TASK_VIDEO' ? 'RECORD_VIDEO' : 'REVIEW_ARTICLE',
          title: item.title.slice(0, 90),
          description: item.rationale || 'Preparado por tu Brand Manager.',
          estimatedMinutes: destination === 'TASK_VIDEO' ? 15 : 20,
          status: 'ASSIGNED',
          contentItemId: contentId,
          curationEntryId: entry?.id,
          deliveryPackageId: packageId,
          scriptPayload: draft.teleprompterScript,
        });
        createdTasks += 1;
      }

      if (destination === 'OPPORTUNITY' && thesis) {
        dbService.addOpportunity({
          organizationId: thesis.organizationId,
          clientId,
          thesisId: thesis.id,
          title: item.title.slice(0, 120),
          organization: entry?.sourceName || 'Por confirmar',
          type: 'PANEL',
          deadline: new Date(Date.now() + 21 * 86400000).toISOString(),
          description: item.note || item.title,
          fitRationale: item.rationale || 'Alineado con la tesis activa.',
          status: 'SENT_TO_CLIENT',
        });
      }

      if (destination === 'EVIDENCE') {
        dbService.addEvidenceItem({
          organizationId: client?.organizationId || 'org_aurora_01',
          clientId,
          title: item.title.slice(0, 120),
          type: 'DOCUMENT',
          sourceUrl: item.url,
          snippet: item.note || item.title,
          confidenceScore: 70,
          verified: false,
          associatedThesesIds: thesis ? [thesis.id] : [],
        });
      }
    }

    dbService.markDeliverySent(packageId);
    const notified = notifyClient(clientId, {
      type: 'TASK_ASSIGNED',
      title: 'Nuevo briefing de tu Brand Manager',
      body: `${pkg.title} · ${pkg.items.length} ítem(s)`,
    });
    if (!notified) {
      this.showToast('Briefing enviado. El cliente no tiene cuenta vinculada para avisos.', 'info');
    }
    auditService.log(authService.getCurrentUser(), 'DELIVERY_SENT', 'DeliveryPackage', packageId, {
      clientId,
      items: pkg.items.length,
      createdTasks,
    });

    this.showToast(
      `Briefing enviado. ${createdTasks ? `${createdTasks} tarea(s) creada(s).` : 'Sin tareas nuevas.'}`,
      'success'
    );
    this.render();
  }

  // ==========================================
  // Contenido
  // ==========================================

  private pipelineActor(): { uid: string; role: 'ADMIN' | 'CLIENT' | 'SYSTEM' } {
    const user = authService.getCurrentUser();
    return {
      uid: user?.uid || 'system',
      role: user?.role === 'CLIENT' ? 'CLIENT' : user?.role === 'ADMIN' ? 'ADMIN' : 'SYSTEM',
    };
  }

  /** Avanza el pipeline de contenido hasta una etapa concreta. */
  private advanceContentPipelineTarget(contentId: string, target: ContentPipelineStatus, comment?: string): boolean {
    const content = dbService.getContentById(contentId);
    if (!content) return false;
    const current = content.pipelineStatus || mapLegacyContentStatus(content.status);
    if (current === target) return true;
    try {
      const steps = resolvePipelineStepsToTarget(current, target);
      const actor = this.pipelineActor();
      for (const step of steps) {
        dbService.transitionContentPipeline(contentId, step, actor, comment);
      }
      return true;
    } catch (err) {
      this.showToast(err instanceof Error ? err.message : 'Transición de contenido no permitida', 'warning');
      return false;
    }
  }

  /** Sincroniza pipelineStatus + legacy status mediante transiciones válidas. */
  private syncContentToPipelineStatus(contentId: string, legacyStatus: ContentStatus, comment?: string): boolean {
    const content = dbService.getContentById(contentId);
    if (!content) return false;
    const current = content.pipelineStatus || mapLegacyContentStatus(content.status);
    const target = mapLegacyContentStatus(legacyStatus);
    if (current === target) return true;
    try {
      const steps = resolvePipelineStepsToTarget(current, target);
      const actor = this.pipelineActor();
      for (const step of steps) {
        dbService.transitionContentPipeline(contentId, step, actor, comment);
      }
      return true;
    } catch (err) {
      this.showToast(err instanceof Error ? err.message : 'Transición de contenido no permitida', 'warning');
      return false;
    }
  }

  /** Aprueba un artículo del cliente y completa la tarea vinculada. */
  private approveClientArticle(contentId: string, taskId?: string): boolean {
    const content = dbService.getContentById(contentId);
    const user = authService.getCurrentUser();
    if (!content || !user) return false;

    if (!this.syncContentToPipelineStatus(contentId, 'CLIENT_APPROVED', 'Aprobado por cliente')) {
      return false;
    }

    dbService.addFeedbackEvent({
      organizationId: content.organizationId,
      clientId: content.clientId,
      contentId,
      taskId,
      kind: 'CLIENT_APPROVE',
      actorUid: user.uid,
      actorRole: 'CLIENT',
    });

    this.completeLinkedArticleTask(contentId, taskId);

    notificationService.push({
      userId: 'user_admin_01',
      clientId: content.clientId,
      type: 'CONTENT_REVIEW',
      title: 'Artículo aprobado por el cliente',
      body: `«${content.title}» está listo para finalizar.`,
      href: 'ws-production',
    });

    this.showToast('Artículo aprobado y enviado al manager', 'success');
    this.render();
    return true;
  }

  private rejectClientArticle(contentId: string, reason: string, taskId?: string): boolean {
    const content = dbService.getContentById(contentId);
    const user = authService.getCurrentUser();
    if (!content || !user || !reason.trim()) return false;

    if (!this.syncContentToPipelineStatus(contentId, 'CHANGES_REQUESTED', reason.trim())) {
      return false;
    }

    dbService.addFeedbackEvent({
      organizationId: content.organizationId,
      clientId: content.clientId,
      contentId,
      taskId,
      kind: 'CLIENT_REJECT',
      actorUid: user.uid,
      actorRole: 'CLIENT',
      reason: reason.trim(),
    });

    dbService.saveContent({
      ...content,
      clientFeedback: reason.trim(),
      updatedAt: new Date().toISOString(),
    });

    notificationService.push({
      userId: 'user_admin_01',
      clientId: content.clientId,
      type: 'CONTENT_REVIEW',
      title: 'Artículo rechazado por el cliente',
      body: reason.trim(),
      href: 'ws-production',
    });

    this.showToast('Rechazo enviado con tu motivo', 'info');
    this.render();
    return true;
  }

  private completeLinkedArticleTask(contentId: string, taskId?: string): void {
    const task = taskId
      ? dbService.getAllTasks().find((t) => t.id === taskId)
      : dbService.getAllTasks().find(
          (t) => t.contentItemId === contentId && t.type === 'REVIEW_ARTICLE' && t.status !== 'COMPLETED'
        );
    if (task && task.status !== 'COMPLETED' && task.status !== 'CANCELLED') {
      dbService.updateTaskStatus(task.id, 'COMPLETED', undefined, 'Artículo aprobado por el cliente.');
    }
  }

  private bindContent() {
    document.getElementById('btn-generate-article')?.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const clientId = target.getAttribute('data-client-id') || this.resolveClientId();
      const theses = dbService.getThesesByClient(clientId);
      const thesis = theses.find((t) => t.status === 'ACTIVE') || theses[0];

      if (!thesis) {
        this.showToast('Define una tesis antes de generar contenido.', 'warning');
        return;
      }

      const topic = prompt('¿Sobre qué tema quieres el borrador?');
      if (!topic?.trim()) return;

      target.disabled = true;
      target.textContent = 'Redactando…';
      try {
        const draft = await aiService.generateContentDraft(thesis, topic.trim(), 'LINKEDIN_ARTICLE');
        const contentId = createId('cnt');
        dbService.saveContent({
          ...draft,
          id: contentId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        this.syncContentToPipelineStatus(contentId, draft.status);
        this.showToast('Borrador creado. Revísalo antes de enviarlo al cliente.', 'success');
      } catch (error) {
        this.showToast(error instanceof Error ? error.message : 'No se pudo generar el borrador', 'warning');
      }
      this.render();
    });

    document.querySelectorAll('.btn-open-content-editor').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const contentId = (e.currentTarget as HTMLElement).getAttribute('data-content-id');
        if (!contentId) return;
        this.activeModal = 'content-editor';
        this.modalData = { contentId };
        this.render();
      });
    });

    document.querySelectorAll('.btn-preview-content').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const contentId = (e.currentTarget as HTMLElement).getAttribute('data-content-id');
        if (!contentId) return;
        this.activeModal = 'content-preview';
        this.modalData = { contentId };
        this.render();
      });
    });

    ['btn-close-content-preview', 'btn-close-content-preview-bottom'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => this.closeModal());
    });

    ['btn-close-content-editor', 'btn-cancel-content-editor'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => this.closeModal());
    });

    ['btn-close-content-diff', 'btn-close-content-diff-bottom'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => this.closeModal());
    });

    document.querySelectorAll('.btn-view-content-diff').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const contentId = (e.currentTarget as HTMLElement).getAttribute('data-content-id');
        if (!contentId) return;
        this.activeModal = 'content-diff';
        this.modalData = { contentId };
        this.render();
      });
    });

    document.querySelectorAll('.btn-open-article-review').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const contentId = el.getAttribute('data-content-id');
        const taskId = el.getAttribute('data-task-id') || undefined;
        if (!contentId) return;
        this.activeModal = 'article-review';
        this.modalData = { contentId, taskId };
        this.render();
      });
    });

    ['btn-close-article-review'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => this.closeModal());
    });

    const formArticleReview = document.getElementById('form-article-review');
    formArticleReview?.addEventListener('submit', (e) => {
      e.preventDefault();
      const contentId = formArticleReview.getAttribute('data-content-id');
      const taskId = formArticleReview.getAttribute('data-task-id') || undefined;
      if (!contentId) return;
      const title = (document.getElementById('article-review-title') as HTMLInputElement).value.trim();
      const body = (document.getElementById('article-review-body') as HTMLTextAreaElement).value.trim();
      const user = authService.getCurrentUser();
      if (!user) return;

      const event = dbService.saveClientArticleRevision(contentId, {
        title,
        body,
        actorUid: user.uid,
        taskId: taskId || undefined,
      });

      const content = dbService.getContentById(contentId);
      if (content) {
        const pipeline = content.pipelineStatus || mapLegacyContentStatus(content.status);
        if (pipeline === 'sent_to_client') {
          this.advanceContentPipelineTarget(contentId, 'client_in_progress', 'Cliente editando borrador');
        }
      }

      this.showToast(
        event ? 'Cambios guardados. Tu manager verá el diff.' : 'Sin cambios respecto al borrador original.',
        event ? 'success' : 'info'
      );
      this.render();
    });

    document.getElementById('btn-article-approve')?.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const contentId = el.getAttribute('data-content-id');
      const taskId = el.getAttribute('data-task-id') || undefined;
      if (!contentId) return;

      const title = (document.getElementById('article-review-title') as HTMLInputElement)?.value.trim();
      const body = (document.getElementById('article-review-body') as HTMLTextAreaElement)?.value.trim();
      const user = authService.getCurrentUser();
      if (user && title && body) {
        dbService.saveClientArticleRevision(contentId, {
          title,
          body,
          actorUid: user.uid,
          taskId: taskId || undefined,
        });
      }

      void this.approveClientArticle(contentId, taskId);
      this.closeModal();
    });

    document.getElementById('btn-article-reject')?.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const contentId = el.getAttribute('data-content-id');
      const taskId = el.getAttribute('data-task-id') || undefined;
      if (!contentId) return;
      this.activeModal = 'feedback';
      this.modalData = { targetId: contentId, type: 'CONTENT', taskId };
      this.render();
    });

    const formEditContent = document.getElementById('form-edit-content');
    formEditContent?.addEventListener('submit', (e) => {
      e.preventDefault();
      const contentId = formEditContent.getAttribute('data-content-id');
      const content = contentId ? dbService.getContentById(contentId) : null;
      if (!content) return;

      const body = (document.getElementById('edit-content-body') as HTMLTextAreaElement).value;
      const type = (document.getElementById('edit-content-type') as HTMLSelectElement).value as typeof content.type;
      const status = (document.getElementById('edit-content-status') as HTMLSelectElement).value as typeof content.status;

      if (status !== content.status && !this.syncContentToPipelineStatus(content.id, status)) {
        return;
      }

      const refreshed = dbService.getContentById(content.id) || content;

      dbService.saveContent({
        ...refreshed,
        title: (document.getElementById('edit-content-title') as HTMLInputElement).value,
        targetPlatform: (document.getElementById('edit-content-platform') as HTMLSelectElement).value as typeof content.targetPlatform,
        type,
        body,
        teleprompterScript: type === 'VIDEO_SCRIPT' ? body : refreshed.teleprompterScript,
        managerNotes: (document.getElementById('edit-content-notes') as HTMLInputElement).value,
        updatedAt: new Date().toISOString(),
      });

      auditService.log(authService.getCurrentUser(), 'EDIT_CONTENT', 'ContentItem', content.id, { status });
      this.showToast('Cambios guardados', 'success');
      this.closeModal();
    });

    document.querySelectorAll('.btn-comparative-signal').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const signalId = target.getAttribute('data-signal-id');
        const signal = signalId ? dbService.getSignalById(signalId) : null;
        const clientId = this.resolveClientId(signal?.clientId);
        const theses = dbService.getThesesByClient(clientId);
        const thesis = theses.find((t) => t.status === 'ACTIVE') || theses[0];
        if (!signal || !thesis) return;

        target.disabled = true;
        target.textContent = 'Sintetizando…';
        try {
          const result = await aiService.runComparativeAnalysis(signal, thesis);
          this.activeModal = 'comparative';
          this.modalData = { result };
          this.render();
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'No se pudo comparar', 'warning');
          this.render();
        }
      });
    });

    ['btn-close-comparative', 'btn-close-comparative-bottom'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => this.closeModal());
    });

    document.querySelectorAll('.btn-create-task-from-rec').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const recId = (e.currentTarget as HTMLElement).getAttribute('data-rec-id');
        const rec = dbService.getRecommendations().find((r) => r.id === recId);
        if (!rec) return;

        const theses = dbService.getThesesByClient(rec.clientId);
        const thesis = theses.find((t) => t.id === rec.thesisId) || theses[0];
        if (!thesis) return;

        const draft = await aiService.generateContentDraft(thesis, rec.proposedAngle, 'VIDEO_SCRIPT');
        const contentId = createId('cnt');
        dbService.saveContent({
          ...draft,
          id: contentId,
          status: 'CLIENT_REVIEW',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        this.syncContentToPipelineStatus(contentId, 'CLIENT_REVIEW', 'Tarea desde recomendación');
        dbService.addTask({
          organizationId: thesis.organizationId,
          clientId: thesis.clientId,
          thesisId: thesis.id,
          type: 'RECORD_VIDEO',
          title: `Grabar: ${rec.proposedAngle.substring(0, 60)}`,
          description: 'Guion redactado según tu tesis. Usa el teleprompter.',
          estimatedMinutes: 15,
          status: 'ASSIGNED',
          contentItemId: contentId,
          scriptPayload: draft.teleprompterScript,
        });
        dbService.updateRecommendationStatus(rec.id, 'CONVERTED_TO_TASK');
        this.showToast('Guion y tarea generados', 'success');
        this.setTab('ws-production');
      });
    });

    document.getElementById('btn-add-evidence-vault')?.addEventListener('click', (e) => {
      const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id') || this.resolveClientId();
      this.activeModal = 'add-evidence';
      this.modalData = { clientId };
      this.render();
    });

    ['btn-close-evidence', 'btn-cancel-evidence'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => this.closeModal());
    });

    const formAddEvidence = document.getElementById('form-add-evidence');
    formAddEvidence?.addEventListener('submit', (e) => {
      e.preventDefault();
      const clientId = formAddEvidence.getAttribute('data-client-id') || this.resolveClientId();
      const title = (document.getElementById('evidence-title') as HTMLInputElement).value;

      dbService.addEvidenceItem({
        organizationId: 'org_aurora_01',
        clientId,
        title,
        type: (document.getElementById('evidence-type') as HTMLSelectElement).value as never,
        confidenceScore: parseInt((document.getElementById('evidence-confidence') as HTMLInputElement).value || '95', 10),
        sourceUrl: (document.getElementById('evidence-url') as HTMLInputElement).value || undefined,
        snippet: (document.getElementById('evidence-snippet') as HTMLTextAreaElement).value,
        verified: true,
        verifiedAt: new Date().toISOString(),
        associatedThesesIds: []
      });

      auditService.log(authService.getCurrentUser(), 'ADD_EVIDENCE_ITEM', 'EvidenceVault', title);
      this.showToast('Evidencia registrada', 'success');
      this.closeModal();
    });
  }

  // ==========================================
  // Acciones del portal del cliente
  // ==========================================

  private bindClientPortalActions() {
    document.querySelectorAll('.btn-request-task-changes').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const taskId = (e.currentTarget as HTMLElement).getAttribute('data-task-id');
        if (!taskId) return;
        this.activeModal = 'feedback';
        this.modalData = { targetId: taskId, type: 'TASK' };
        this.render();
      });
    });

    document.querySelectorAll('.btn-reject-opp').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const oppId = (e.currentTarget as HTMLElement).getAttribute('data-opp-id');
        if (!oppId) return;
        this.activeModal = 'feedback';
        this.modalData = { targetId: oppId, type: 'OPPORTUNITY' };
        this.render();
      });
    });

    ['btn-close-feedback', 'btn-cancel-feedback'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => this.closeModal());
    });

    const formFeedback = document.getElementById('form-submit-feedback');
    formFeedback?.addEventListener('submit', (e) => {
      e.preventDefault();
      const targetId = formFeedback.getAttribute('data-target-id');
      const type = formFeedback.getAttribute('data-type');
      const taskId = formFeedback.getAttribute('data-task-id') || undefined;
      const notes = (document.getElementById('feedback-notes') as HTMLTextAreaElement).value.trim();
      if (!targetId || !notes) return;

      if (type === 'TASK') {
        dbService.updateTaskStatus(targetId, 'IN_PROGRESS', undefined, notes);
        this.showToast('Observaciones enviadas a tu Brand Manager', 'info');
      } else if (type === 'OPPORTUNITY') {
        dbService.updateOpportunityDecision(targetId, 'REJECTED', notes);
        this.showToast('Oportunidad descartada con tus observaciones', 'info');
      } else if (type === 'CONTENT') {
        this.rejectClientArticle(targetId, notes, taskId);
      }
      this.closeModal();
    });

    document.querySelectorAll('.btn-approve-article-task').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const contentId = el.getAttribute('data-content-id');
        const taskId = el.getAttribute('data-task-id') || undefined;
        if (!contentId) return;
        this.approveClientArticle(contentId, taskId);
      });
    });

    document.querySelectorAll('.btn-open-teleprompter').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const taskId = (e.currentTarget as HTMLElement).getAttribute('data-task-id');
        if (!taskId) return;
        this.activeModal = 'teleprompter';
        this.modalData = { taskId };
        this.render();
      });
    });

    document.getElementById('btn-close-teleprompter')?.addEventListener('click', () => {
      this.closeModal();
    });

    const playBtn = document.getElementById('btn-teleprompter-play');
    playBtn?.addEventListener('click', () => {
      if (this.isTeleprompterPlaying) {
        this.stopTeleprompter();
        if (playBtn) playBtn.textContent = 'Iniciar desplazamiento';
      } else {
        this.startTeleprompter();
        if (playBtn) playBtn.textContent = 'Pausar desplazamiento';
      }
    });

    document.getElementById('btn-start-recording')?.addEventListener('click', () => {
      void this.startRecording();
    });

    document.getElementById('btn-stop-recording')?.addEventListener('click', () => {
      void this.stopRecordingToPreview();
    });

    document.getElementById('btn-retake-recording')?.addEventListener('click', () => {
      this.retakeRecording();
    });

    document.getElementById('btn-confirm-send-recording')?.addEventListener('click', (e) => {
      const taskId = (e.currentTarget as HTMLElement).getAttribute('data-task-id');
      if (!taskId) return;
      void this.confirmSendRecording(taskId);
    });

    if (this.activeModal === 'teleprompter') {
      void this.initTeleprompterCamera();
    }

    document.querySelectorAll('.btn-download-recording').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const taskId = (e.currentTarget as HTMLElement).getAttribute('data-task-id');
        if (!taskId) return;
        const task = dbService.getAllTasks().find((t) => t.id === taskId);
        const filename = task ? `${task.title}.webm` : undefined;
        const ok = task?.evidenceUrl
          ? await downloadRecordingFromEvidence(task.evidenceUrl, filename)
          : await downloadRecording(taskId, filename);
        if (!ok) this.showToast('No hay video guardado para esta tarea', 'warning');
      });
    });

    document.querySelectorAll('.input-reupload-recording').forEach((input) => {
      input.addEventListener('change', async (e) => {
        const el = e.currentTarget as HTMLInputElement;
        const taskId = el.getAttribute('data-task-id');
        const file = el.files?.[0];
        if (!taskId || !file) return;
        const task = dbService.getAllTasks().find((t) => t.id === taskId);
        const ref = await persistRecording(
          task ? dbService.getClientById(task.clientId)?.organizationId || 'org_aurora_01' : 'org_aurora_01',
          task?.clientId || '',
          taskId,
          file
        );
        dbService.updateTaskEvidence(taskId, ref, 'Versión re-subida por el manager.');
        this.showToast('Video actualizado', 'success');
        el.value = '';
        this.render();
      });
    });

    void this.hydrateRecordingVideos();

    document.querySelectorAll('.btn-complete-task').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const taskId = (e.currentTarget as HTMLElement).getAttribute('data-task-id');
        if (!taskId) return;
        dbService.updateTaskStatus(taskId, 'COMPLETED');
        this.showToast('Tarea completada', 'success');
        this.render();
      });
    });

    document.querySelectorAll('.btn-accept-opp').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const oppId = (e.currentTarget as HTMLElement).getAttribute('data-opp-id');
        if (!oppId) return;
        const opp = dbService.getOpportunityById(oppId);
        dbService.updateOpportunityDecision(oppId, 'ACCEPTED', 'Aceptado con disponibilidad completa.');
        notificationService.push({
          userId: 'user_admin_01',
          clientId: opp?.clientId,
          type: 'OPPORTUNITY',
          title: 'Oportunidad aceptada',
          body: opp ? `«${opp.title}» — el cliente completará el checklist de postulación.` : 'El cliente aceptó una oportunidad.',
          href: 'ws-briefing',
        });
        this.showToast('Oportunidad aceptada. Completa el checklist de postulación.', 'success');
        this.render();
      });
    });

    document.querySelectorAll('.input-opp-checklist').forEach((input) => {
      input.addEventListener('change', (e) => {
        const el = e.currentTarget as HTMLInputElement;
        const oppId = el.getAttribute('data-opp-id');
        const itemId = el.getAttribute('data-item-id');
        if (!oppId || !itemId) return;
        dbService.toggleOpportunityChecklistItem(oppId, itemId, el.checked);
        this.render();
      });
    });

    document.querySelectorAll('.btn-submit-opportunity').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const oppId = (e.currentTarget as HTMLElement).getAttribute('data-opp-id');
        if (!oppId) return;
        const opp = dbService.getOpportunityById(oppId);
        if (!dbService.submitOpportunity(oppId)) {
          this.showToast('Completa todos los ítems del checklist antes de enviar.', 'warning');
          return;
        }
        notificationService.push({
          userId: 'user_admin_01',
          clientId: opp?.clientId,
          type: 'OPPORTUNITY',
          title: 'Postulación enviada',
          body: opp ? `«${opp.title}» — el cliente marcó la postulación como enviada.` : 'Postulación de oportunidad completada.',
          href: 'ws-briefing',
        });
        this.showToast('Postulación marcada como enviada. Tu Brand Manager fue notificado.', 'success');
        this.render();
      });
    });

    document.querySelectorAll('.btn-approve-thesis').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const thesisId = (e.currentTarget as HTMLElement).getAttribute('data-thesis-id');
        const clientId = authService.getCurrentUser()?.clientId || this.resolveClientId();
        const thesis = dbService.getThesesByClient(clientId).find((t) => t.id === thesisId);
        if (!thesis) return;
        dbService.saveThesis({ ...thesis, clientApprovalStatus: 'APPROVED', status: 'ACTIVE' });
        this.showToast('Tesis aprobada y activada', 'success');
        this.render();
      });
    });

    document.querySelectorAll('.btn-request-thesis-changes').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const thesisId = (e.currentTarget as HTMLElement).getAttribute('data-thesis-id');
        const clientId = authService.getCurrentUser()?.clientId || this.resolveClientId();
        const thesis = dbService.getThesesByClient(clientId).find((t) => t.id === thesisId);
        if (!thesis) return;
        dbService.saveThesis({ ...thesis, clientApprovalStatus: 'CHANGES_REQUESTED', status: 'DRAFT' });
        this.showToast('Cambios solicitados al manager', 'info');
        this.render();
      });
    });

    document.querySelectorAll('.btn-client-approve-content').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-content-id');
        if (!id) return;
        this.approveClientArticle(id);
      });
    });

    document.querySelectorAll('.btn-request-content-changes').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-content-id');
        if (!id) return;
        this.activeModal = 'feedback';
        this.modalData = { targetId: id, type: 'CONTENT' };
        this.render();
      });
    });

    const formAddResult = document.getElementById('form-add-result');
    formAddResult?.addEventListener('submit', (e) => {
      e.preventDefault();
      const clientId = formAddResult.getAttribute('data-client-id') || authService.getCurrentUser()?.clientId || '';
      dbService.addResult({
        organizationId: 'org_aurora_01',
        clientId,
        title: (document.getElementById('result-title') as HTMLInputElement).value,
        channel: (document.getElementById('result-channel') as HTMLInputElement).value,
        metricLabel: (document.getElementById('result-metric-label') as HTMLInputElement).value,
        metricValue: Number((document.getElementById('result-metric-value') as HTMLInputElement).value || 0),
        kpiType: (document.getElementById('result-kpi-type') as HTMLSelectElement).value as BusinessKpiType,
        addedToEvidence: false,
        createdBy: authService.getCurrentUser()?.uid || 'client',
      });
      this.showToast('Resultado registrado', 'success');
      this.render();
    });

    document.querySelectorAll('.btn-result-to-evidence').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-result-id');
        const clientId = authService.getCurrentUser()?.clientId || this.resolveClientId();
        const result = dbService.getResultsByClient(clientId).find((r) => r.id === id);
        if (!result) return;
        dbService.addEvidenceItem({
          organizationId: result.organizationId,
          clientId: result.clientId,
          title: result.title,
          type: 'MEDIA',
          snippet: `${result.channel}: ${result.metricLabel} ${result.metricValue}`,
          confidenceScore: 80,
          verified: true,
          verifiedAt: new Date().toISOString(),
          associatedThesesIds: [],
        });
        result.addedToEvidence = true;
        this.showToast('Resultado copiado al evidence vault', 'success');
        this.render();
      });
    });
  }

  // ==========================================
  // Centro de IA
  // ==========================================

  private bindAiCenter() {
    document.getElementById('btn-save-ai-keys')?.addEventListener('click', async () => {
      const res = await aiService.setSessionKeys({
        provider: (document.getElementById('ai-provider-select') as HTMLSelectElement).value as never,
        modelDepth: (document.getElementById('ai-depth-select') as HTMLSelectElement).value as never,
        openAIKey: (document.getElementById('openai-key-input') as HTMLInputElement).value,
        claudeKey: (document.getElementById('claude-key-input') as HTMLInputElement).value,
        isTemporary: true
      });
      this.showToast(res.message, res.success ? 'success' : 'warning');
      this.render();
    });

    document.getElementById('btn-clear-ai-keys')?.addEventListener('click', async () => {
      await aiService.clearSessionKeys();
      this.showToast('Claves de IA eliminadas de memoria', 'warning');
      this.render();
    });
  }

  // ==========================================
  // Teleprompter y grabación
  // ==========================================

  private setTeleprompterPhase(phase: 'record' | 'preview') {
    document.getElementById('teleprompter-phase-record')?.classList.toggle('hidden', phase === 'preview');
    document.getElementById('teleprompter-phase-preview')?.classList.toggle('hidden', phase !== 'preview');

    const camera = document.getElementById('teleprompter-camera') as HTMLVideoElement | null;
    const preview = document.getElementById('teleprompter-preview') as HTMLVideoElement | null;
    if (camera) camera.classList.toggle('hidden', phase === 'preview');
    if (preview) preview.classList.toggle('hidden', phase !== 'preview');
  }

  private revokePreviewUrl() {
    if (this.previewBlobUrl) {
      URL.revokeObjectURL(this.previewBlobUrl);
      this.previewBlobUrl = null;
    }
  }

  private stopRecordingSession() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        /* noop */
      }
    }
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.previewBlob = null;
    this.revokePreviewUrl();

    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }

    const camera = document.getElementById('teleprompter-camera') as HTMLVideoElement | null;
    if (camera) camera.srcObject = null;
  }

  private async initTeleprompterCamera() {
    const camera = document.getElementById('teleprompter-camera') as HTMLVideoElement | null;
    const hint = document.getElementById('teleprompter-camera-hint');
    if (!camera) return;

    try {
      if (!this.cameraStream) {
        this.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: true,
        });
      }
      camera.srcObject = this.cameraStream;
      await camera.play();
      if (hint) hint.textContent = 'Cámara activa. Pulsa Grabar cuando estés listo.';
    } catch {
      if (hint) {
        hint.textContent = 'No se pudo acceder a la cámara. Revisa permisos del navegador.';
      }
      this.showToast('No se pudo acceder a la cámara o micrófono', 'warning');
    }
  }

  private async startRecording() {
    if (!this.cameraStream) {
      await this.initTeleprompterCamera();
    }
    if (!this.cameraStream) return;

    this.recordedChunks = [];
    this.previewBlob = null;
    this.revokePreviewUrl();

    try {
      this.mediaRecorder = new MediaRecorder(this.cameraStream);
    } catch {
      this.showToast('Tu navegador no soporta grabación de video aquí', 'warning');
      return;
    }

    this.mediaRecorder.ondataavailable = (ev) => {
      if (ev.data.size) this.recordedChunks.push(ev.data);
    };

    this.mediaRecorder.start();
    document.getElementById('btn-start-recording')?.classList.add('hidden');
    document.getElementById('btn-stop-recording')?.classList.remove('hidden');
    document.getElementById('teleprompter-recording-indicator')?.classList.remove('hidden');
    this.showToast('Grabando…', 'info');
  }

  private async stopRecordingToPreview() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      this.showToast('No hay una grabación activa', 'warning');
      return;
    }

    await new Promise<void>((resolve) => {
      const recorder = this.mediaRecorder!;
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    document.getElementById('btn-start-recording')?.classList.remove('hidden');
    document.getElementById('btn-stop-recording')?.classList.add('hidden');
    document.getElementById('teleprompter-recording-indicator')?.classList.add('hidden');

    const blob = this.recordedChunks.length
      ? new Blob(this.recordedChunks, { type: this.recordedChunks[0]?.type || 'video/webm' })
      : null;

    if (!blob || blob.size === 0) {
      this.showToast('La grabación quedó vacía. Intenta de nuevo.', 'warning');
      return;
    }

    this.previewBlob = blob;
    this.revokePreviewUrl();
    this.previewBlobUrl = URL.createObjectURL(blob);

    const preview = document.getElementById('teleprompter-preview') as HTMLVideoElement | null;
    if (preview) {
      preview.src = this.previewBlobUrl;
      await preview.play().catch(() => undefined);
    }

    this.setTeleprompterPhase('preview');
    this.stopTeleprompter();
    const playBtn = document.getElementById('btn-teleprompter-play');
    if (playBtn) playBtn.textContent = 'Iniciar desplazamiento';
  }

  private retakeRecording() {
    this.previewBlob = null;
    this.revokePreviewUrl();
    this.recordedChunks = [];
    this.setTeleprompterPhase('record');

    const preview = document.getElementById('teleprompter-preview') as HTMLVideoElement | null;
    if (preview) {
      preview.pause();
      preview.removeAttribute('src');
      preview.load();
    }

    void this.initTeleprompterCamera();
  }

  private async confirmSendRecording(taskId: string) {
    if (!this.previewBlob) {
      this.showToast('Graba un video antes de enviar', 'warning');
      return;
    }
    await this.submitClientVideo(taskId, this.previewBlob);
    this.stopTeleprompter();
    this.closeModal();
  }

  private async submitClientVideo(taskId: string, blob: Blob) {
    const task = dbService.getAllTasks().find((t) => t.id === taskId);
    const client = task ? dbService.getClientById(task.clientId) : undefined;
    const ref = await persistRecording(
      client?.organizationId || 'org_aurora_01',
      task?.clientId || '',
      taskId,
      blob
    );
    dbService.updateTaskStatus(taskId, 'COMPLETED', ref, 'Video enviado desde el teleprompter.');
    if (task?.contentItemId) {
      this.advanceContentPipelineTarget(
        task.contentItemId,
        'manager_finalizing',
        'Video enviado por cliente'
      );
    }

    notificationService.push({
      userId: 'user_admin_01',
      clientId: task?.clientId,
      type: 'CONTENT_REVIEW',
      title: 'Video recibido del cliente',
      body: client
        ? `${client.displayName} envió la grabación «${task?.title || 'sin título'}».`
        : 'El cliente envió una nueva grabación de video.',
      href: 'ws-tasks',
    });

    this.showToast('Video enviado al manager', 'success');
  }

  private async hydrateRecordingVideos() {
    const videos = document.querySelectorAll<HTMLVideoElement>('.task-recording-video[data-task-id]');
    await Promise.all(
      Array.from(videos).map(async (video) => {
        const taskId = video.getAttribute('data-task-id');
        if (!taskId || video.dataset.loaded === '1') return;
        const task = dbService.getAllTasks().find((t) => t.id === taskId);
        const evidenceUrl = task?.evidenceUrl || `${RECORDING_REF_PREFIX}${taskId}`;
        const url = await resolveRecordingUrl(evidenceUrl);
        if (!url) return;
        video.src = url;
        video.dataset.loaded = '1';
      })
    );
  }

  private startTeleprompter() {
    this.isTeleprompterPlaying = true;
    const scrollArea = document.getElementById('teleprompter-scroll-area');
    const speedInput = document.getElementById('teleprompter-speed') as HTMLInputElement;
    const speed = speedInput ? parseInt(speedInput.value, 10) : 2;

    this.teleprompterInterval = window.setInterval(() => {
      if (!scrollArea) return;
      scrollArea.scrollTop += speed;
      if (scrollArea.scrollTop + scrollArea.clientHeight >= scrollArea.scrollHeight) {
        this.stopTeleprompter();
      }
    }, 40);
  }

  private stopTeleprompter() {
    this.isTeleprompterPlaying = false;
    if (this.teleprompterInterval) {
      clearInterval(this.teleprompterInterval);
      this.teleprompterInterval = null;
    }
  }

  // ==========================================
  // Ingesta RSS
  // ==========================================

  private startSourceAutomation() {
    this.stopSourceAutomation();
    void this.tickSourceDiscovery();
    void this.tickScheduledIngest();
    this.sourceIngestTimer = window.setInterval(() => {
      void this.tickScheduledIngest();
    }, App.INGEST_TICK_MS);
    this.sourceAgentTimer = window.setInterval(() => {
      void this.tickSourceDiscovery();
    }, App.DISCOVERY_SCAN_MS);
  }

  private stopSourceAutomation() {
    if (this.sourceIngestTimer !== null) {
      window.clearInterval(this.sourceIngestTimer);
      this.sourceIngestTimer = null;
    }
    if (this.sourceAgentTimer !== null) {
      window.clearInterval(this.sourceAgentTimer);
      this.sourceAgentTimer = null;
    }
  }

  /** Agente de fuentes: escanea perfiles y notifica recomendaciones nuevas. */
  private async tickSourceDiscovery() {
    const now = Date.now();
    if (now - this.lastDiscoveryScanAt < App.DISCOVERY_SCAN_MS - 30_000) return;
    this.lastDiscoveryScanAt = now;

    for (const client of dbService.getClients()) {
      const thesis = dbService.getThesesByClient(client.id).find((t) => t.status === 'ACTIVE');
      const lastRun = loadLastAgentRun(client.id);
      const profileChanged = profileChangedSinceLastRun(client, thesis, lastRun);
      const run = profileChanged
        ? await runSourceDiscoveryAgentAsync(client, thesis)
        : runSourceDiscoveryAgent(client, thesis);
      const previousKeys = new Set(lastRun?.recommendations.map((r) => r.key) || []);
      const freshHigh = run.recommendations.filter(
        (r) => r.priority === 'HIGH' && !previousKeys.has(r.key)
      );

      saveAgentRun(run);

      if (run.pendingCount > 0 && (profileChanged || freshHigh.length)) {
        const viewingClient = this.activeClientId === client.id && this.activeTab === 'ws-sources';
        if (viewingClient || freshHigh.length) {
          const tavilyHint = run.tavilyUsed ? ' · Tavily' : '';
          this.showToast(
            `Agente de fuentes · ${client.displayName}: ${run.pendingCount} fuente(s) recomendada(s)${freshHigh.length ? ` (${freshHigh.length} prioritarias)` : ''}${tavilyHint}`,
            'info'
          );
        }
      }
    }

    if (this.activeTab === 'ws-sources' && this.activeClientId !== 'all') {
      this.render();
    }
  }

  /** Tras ingesta: investiga automáticamente HIGH/CRITICAL con RESEARCH_REQUIRED. */
  private async autoResearchPrioritySignals(clientId: string): Promise<number> {
    const candidates = dbService
      .getSignalsByClient(clientId)
      .filter(shouldAutoResearchSignal)
      .slice(0, 2);
    if (!candidates.length) return 0;

    let done = 0;
    for (const signal of candidates) {
      try {
        const result = await runResearchSignalsAgent(clientId, { signalId: signal.id, maxSignals: 1 });
        if (result.briefs.length) done += 1;
      } catch {
        // no bloquear ingesta si Tavily falla
      }
    }
    return done;
  }

  /** Ingesta automática según fetchIntervalMinutes del cliente activo. */
  private async tickScheduledIngest() {
    const clientId =
      isWorkspaceTab(this.activeTab) && this.activeClientId !== 'all'
        ? this.activeClientId
        : dbService.getClients()[0]?.id;
    if (!clientId) return;

    const due = sourcesDueForIngest(clientId).slice(0, 4);
    if (!due.length) return;

    let created = 0;
    for (const source of due) {
      try {
        const outcome = await this.pollOneSource(source);
        created += outcome.created;
      } catch {
        // error ya registrado en recordSourceRun
      }
    }

    if (created > 0) {
      const researched = await this.autoResearchPrioritySignals(clientId);
      auditService.log(authService.getCurrentUser(), 'SOURCE_AUTO_INGEST', 'Client', clientId, {
        created,
        polled: due.length,
        researched,
      });
      if (this.activeTab === 'ws-radar' || this.activeTab === 'ws-sources') {
        this.render();
      }
    }
  }

  /** Corre todas las fuentes activas sin que un fallo aislado detenga el resto. */
  private async pollSources(): Promise<{ created: number; failed: number; rejected: number }> {
    const clientId = this.currentClientId();
    const sources = (clientId ? dbService.getSourcesByClient(clientId) : dbService.getSources()).filter(
      (s) => s.url && s.status !== 'ARCHIVED' && s.status !== 'PAUSED' && s.status !== 'ERROR'
    );

    let created = 0;
    let failed = 0;
    let rejected = 0;

    for (const source of sources) {
      try {
        const outcome = await this.pollOneSource(source);
        created += outcome.created;
        rejected += outcome.rejected;
      } catch {
        failed += 1;
      }
    }

    if (created > 0 && clientId) {
      await this.autoResearchPrioritySignals(clientId);
    }

    return { created, failed, rejected };
  }

  private profileKeywordsFor(clientId?: string): ProfileKeywords {
    const client = clientId ? dbService.getClientById(clientId) : null;
    if (!client) return { coreEn: [], coreEs: [], strong: [], context: [], negative: [] };
    const theses = dbService.getThesesByClient(client.id);
    const thesis = theses.find((t) => t.status === 'ACTIVE') || theses[0];
    return buildProfileKeywords(client, thesis);
  }

  private async pollOneSource(source: Source): Promise<{ created: number; rejected: number }> {
    if (!source.url) return { created: 0, rejected: 0 };

    const clientId = source.clientId || this.currentClientId();
    if (!clientId) {
      dbService.recordSourceRun(source.id, {
        fetched: 0,
        accepted: 0,
        rejected: 0,
        duplicates: 0,
        error: 'SOURCE_CLIENT_REQUIRED',
      });
      throw new Error('SOURCE_CLIENT_REQUIRED');
    }
    const keywords = this.profileKeywordsFor(clientId);

    let items: FeedItem[] = [];
    try {
      const { items: fetched, error } = await fetchSourceItems(source.url);
      if (error) throw new Error(error);
      items = fetched as FeedItem[];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'RSS_FAILED';
      dbService.recordSourceRun(source.id, { fetched: 0, accepted: 0, rejected: 0, duplicates: 0, error: message });
      throw error;
    }

    let accepted = 0;
    let rejected = 0;
    let duplicates = 0;

    for (const item of items) {
      const gate = gateItem(item, keywords, source);
      if (!gate.accepted) {
        rejected += 1;
        continue;
      }

      const result = dbService.addSignal({
        organizationId: source.organizationId || 'org_aurora_01',
        clientId,
        sourceId: source.id,
        title: item.title,
        sourceType:
          source.type === 'REGULATORY'
            ? 'REGULATORY'
            : source.type === 'ACADEMIC'
              ? 'ACADEMIC'
              : source.type === 'VIDEO'
                ? 'VIDEO'
                : source.type === 'SOCIAL'
                  ? 'SOCIAL'
                  : 'RSS',
        sourceName: source.name,
        sourceUrl: item.link,
        contentSnippet: item.snippet || item.title,
        status: 'NEW',
        aiStatus: 'PENDING_AI',
        managerDecision: 'UNREVIEWED',
        sourceQuality: assessSourceQuality(source, item),
      });

      if (result.isDuplicate) {
        duplicates += 1;
        continue;
      }
      this.scoreSignal(result.signal.id, clientId);
      const scored = dbService.getSignalById(result.signal.id);
      if (scored?.status === 'DISCARDED') {
        rejected += 1;
      } else {
        accepted += 1;
      }
    }

    dbService.recordSourceRun(source.id, { fetched: items.length, accepted, rejected, duplicates });
    metricsService.track('ingest_source_poll', { accepted, rejected, duplicates, fetched: items.length }, clientId);
    auditService.log(authService.getCurrentUser(), 'SOURCE_RUN_COMPLETED', 'Source', source.id, {
      fetched: items.length,
      accepted,
      rejected,
      duplicates,
    });
    return { created: accepted, rejected };
  }
}

new App();
