import './styles/index.css';
import { exposeStranglerControls, initReactStrangler } from './ui/mount';
import { authService } from './services/auth';
import { dbService } from './services/db';
import { aiService } from './services/ai';
import { auditService } from './services/audit';
import { notificationService, notifyClient, notifyManager } from './services/notifications';
import {
  acceptClientInvitation,
  createClientWithInvite,
} from './services/clientLifecycleConsumer';
import { ClientLifecycleError } from './application/clientLifecycle';
import { processDeadlineReminders } from './services/reminders';
import {
  downloadRecording,
  downloadRecordingFromEvidence,
  persistRecording,
  resolveRecordingUrl,
  RECORDING_REF_PREFIX,
} from './services/recordings';
import { pushCurrentLocalToFirestore } from './services/firebase/importLocalV5';
import { FIREBASE_ENABLED } from './firebase/config';
import { runTopicAgent } from './services/topicAgent';
import { formatDossierMarkdown, downloadDossierMarkdown } from './services/dossierExport';
import { generatePositioningAdvice, proposeAngle } from './services/advisor';
import { ScoringContext } from './services/scoring';
import { createStrategicSignalRoutingUseCases } from './composition/strategicSignalRouting/composeStrategicSignalRouting';
import { authorizeContentPublicationGate } from './composition/claimEvidence/contentClaimPublicationGate';
import { StrategicRoutingError } from './application/strategicSignalRouting';
import {
  buildMergedProfileKeywords,
  discoverSources,
  normalizeSourceUrl,
  ProfileKeywords,
} from './services/sourceDiscovery';
import { resolveThesisForSignalOperation } from './domain/routedThesisContext';
import { assessSourceQuality, gateItem, FeedItem } from './services/ingestFilter';
import { renderAppShell, renderBriefingBar } from './components/AppShell';
import { renderManagerCockpit } from './components/ManagerCockpit';
import { renderClientWorkspace } from './components/ClientWorkspace';
import { renderClientPortal } from './components/ClientPortal';
import { renderLogin } from './components/Login';
import { renderClaimSafetyPanel } from './components/ClaimSafetyPanel';
import { PORTFOLIO_TAB_IDS, WORKSPACE_TAB_IDS, CLIENT_TAB_IDS, isWorkspaceTab } from './components/PageHeader';
import { CurationDestination, DeliveryItemKind, Source, TaskType, ContentStatus, BusinessKpiType, ContentPipelineStatus, DeliveryItem } from './types';
import { createId } from './lib/id';
import { CAMP_ADOPTION } from './data/juanCampaignSeed';
import { bindSessionUi } from './controllers/sessionController';
import {
  requireAdminActor,
  requireTenantScope,
  type TenantDecision,
} from './controllers/trustedTenant';
import { themeService } from './services/theme';
import { mapLegacyContentStatus, resolvePipelineStepsToTarget, syncLegacyStatusFromPipeline } from './domain/contentPipeline';
import {
  MAX_RECORDING_DURATION_MS,
  RECORDING_VIDEO_BITS_PER_SECOND,
} from './domain/recordingLimits';
import {
  pipelineActionTarget,
  PIPELINE_ACTION_LABELS,
  type ContentPipelineAction,
} from './domain/contentPublishCore';
import { assertClaimSafeTransition } from './domain/claimSafetyGateCore';
import { nextIncompleteOnboardingStep } from './domain/profileCoverage';
import {
  VOICE_DIMENSION_LABELS,
  parseAudienceLines,
  parseTerritoryLines,
  validateWeights,
  assertThesisReadyForReview,
  formatAudienceLines,
  formatTerritoryLines,
} from './domain/thesisModelCore';
import {
  evaluateThesisEditorProgress,
  nextThesisEditorStep,
  prevThesisEditorStep,
  validateThesisEditorStep,
  type ThesisEditorFormSnapshot,
  type ThesisEditorStep,
} from './domain/thesisEditorCore';
import {
  activateThesisByManager,
  approveThesisByClient,
  planThesisSave,
  rejectThesisByClient,
  type ThesisSaveIntent,
} from './domain/thesisRevisionCore';
import { resolveArticleSavePipelineSteps } from './domain/articleReviewCore';
import { VIDEO_SUBMIT_PIPELINE_TARGET } from './domain/videoSubmitCore';
import type {
  PositioningThesis,
  ProfileFactSection,
  ThesisObjective,
  ThesisObjectiveKind,
  VoiceProfile,
  ThesisEditableFields,
} from './types';
import { metricsService } from './services/metrics';
import { readingTaskDescription, validateDeliveryForSend } from './domain/deliveryCore';
import { curationDestinationToDownstreamAction } from './domain/briefConsumerCore';
import type { StrategicDownstreamAction } from './domain/strategicBriefCore';
import {
  approveStrategicBrief,
  createBriefFromCurationEntry,
  findApprovedBriefForSignal,
  getStrategicBrief,
  listStrategicBriefs,
} from './services/strategicBriefConsumer';
import {
  assertCurationNotPlanAuthority,
  formatPlannedAuthorizationDenial,
  requirePlannedAuthorization,
} from './services/strategicPlanConsumer';
import {
  acceptClientOpportunity,
  declineClientOpportunity,
  materializeOpportunityForDelivery,
  OpportunityApplicationError,
  submitClientOpportunity,
  toggleClientOpportunityChecklistItem,
} from './services/opportunityScoutConsumer';
import { fetchSourceItems } from './services/sourceApi';
import { labelSourceRunError } from './domain/sourceIngestCore';
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
import {
  registerResultRecordIntent,
  registerSignalOutcomeIntent,
} from './services/learningLoopConsumer';
// SPEC-010 T-010-402: presentation state, toasts, modal dispatch and navigation
// rules now live outside this controller. See specs/010-react-migration.
import { AppUiState } from './controllers/appUiState';
import { ToastController, type ToastType } from './controllers/toastController';
import { presentActiveModal } from './controllers/modalPresenter';
import { createRenderScheduler } from './controllers/renderScheduler';
import {
  findNotificationTarget,
  resolveTabTransition,
  NOTIFICATION_HIGHLIGHT_MS,
  NOTIFICATION_SCROLL_DELAY_MS,
} from './controllers/navigationController';

const DESTINATION_TO_KIND: Record<Exclude<CurationDestination, 'DISCARD'>, DeliveryItemKind> = {
  TASK_VIDEO: 'TASK',
  TASK_ARTICLE: 'TASK',
  OPPORTUNITY: 'OPPORTUNITY',
  REFERENCE_READING: 'READING',
  EVIDENCE: 'FILE',
};

class App {
  /**
   * SPEC-010 T-010-402: presentation state is owned by `AppUiState`, not by this
   * controller. The accessors below keep the existing call sites working while
   * the ownership — and the ability to test navigation without a DOM — moves out.
   */
  private readonly ui = new AppUiState();
  private readonly toastController = new ToastController();

  private get activeTab(): string { return this.ui.activeTab; }
  private set activeTab(value: string) { this.ui.activeTab = value; }
  private get activeClientId(): string { return this.ui.activeClientId; }
  private set activeClientId(value: string) { this.ui.activeClientId = value; }
  private get activeCampaignId(): string | null { return this.ui.activeCampaignId; }
  private set activeCampaignId(value: string | null) { this.ui.activeCampaignId = value; }
  private get activeModal(): string | null { return this.ui.activeModal; }
  private set activeModal(value: string | null) { this.ui.activeModal = value; }
  private get modalData(): any { return this.ui.modalData; }
  private set modalData(value: any) { this.ui.modalData = value; }
  private get filterState() { return this.ui.filterState; }
  private get loginError(): string { return this.ui.loginError; }
  private set loginError(value: string) { this.ui.loginError = value; }

  private isTeleprompterPlaying: boolean = false;
  private teleprompterInterval: number | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingLimitTimer: number | null = null;
  private cameraStream: MediaStream | null = null;
  private previewBlob: Blob | null = null;
  private previewBlobUrl: string | null = null;
  private readonly strategicRouting = createStrategicSignalRoutingUseCases(dbService);
  private sourceAgentTimer: number | null = null;
  private sourceIngestTimer: number | null = null;
  private claimLiveTimer: number | null = null;
  private lastDiscoveryScanAt = 0;
  private readonly renderScheduler = createRenderScheduler(() => this.render());

  /** Intervalo entre escaneos del agente de fuentes (1 h). */
  private static readonly DISCOVERY_SCAN_MS = 60 * 60 * 1000;
  /** Revisa ingesta programada cada 5 min. */
  private static readonly INGEST_TICK_MS = 5 * 60 * 1000;

  constructor() {
    void this.boot();
  }

  private async boot() {
    themeService.init();
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.activeModal) {
        event.preventDefault();
        this.closeModal();
      }
    });
    const { onFirestorePushError } = await import('./services/firestore/sync');
    onFirestorePushError((message) => this.showToast(message, 'warning'));
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
      if (authService.getCurrentUser()) this.renderScheduler.schedule();
    });
  }

  public showToast(message: string, type: ToastType = 'info') {
    this.toastController.show(message, type);
  }

  private renderToasts() {
    this.toastController.render();
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
    const camp = dbService.getCampaignById(campaignId);
    if (camp) this.showToast(`Campaña: ${camp.name}`, 'info');
    this.render();
  }

  /** Cliente sobre el que se está trabajando, o null si estamos en la cartera. */
  private currentClientId(): string | null {
    return this.ui.currentClientId();
  }

  /** Tenant organization for writes: client record, else session — never a hardcoded id. */
  private resolveOrganizationId(clientId?: string | null): string | null {
    if (clientId) {
      const fromClient = dbService.getClientById(clientId)?.organizationId?.trim();
      if (fromClient) return fromClient;
    }
    const fromSession = authService.getCurrentUser()?.organizationId?.trim();
    return fromSession || null;
  }

  /**
   * Cliente *candidato* de una acción. NO es autoridad de tenant.
   *
   * AUDIT010-11: antes terminaba en `dbService.getClients()[0]?.id`, es decir
   * elegía un tenant por posición cuando no había ninguno resuelto. Ese tramo
   * se eliminó: ahora devuelve '' y quien ejecute un efecto debe pasar el
   * candidato por `requireTenantScope`, que falla cerrado.
   */
  private resolveClientId(fallback?: string | null): string {
    const user = authService.getCurrentUser();
    return fallback || this.currentClientId() || user?.clientId || '';
  }

  /**
   * Default puramente visual para pintar una pantalla sin cliente activo.
   * DISPLAY DEFAULT ≠ AUTORIDAD DE CLIENTE: no debe alimentar ningún efecto.
   */
  private displayClientId(): string {
    return this.resolveClientId() || dbService.getClients()[0]?.id || '';
  }

  /** Gate de tenant de confianza para efectos. Falla cerrado. */
  private requireTenant(requested?: string | null): TenantDecision {
    return requireTenantScope(requested, {
      getCurrentUser: () => authService.getCurrentUser(),
      getClientById: (id) => dbService.getClientById(id),
    });
  }

  /** Gate de actor de confianza para utilidades sin tenant propio. */
  private requireAdmin(): TenantDecision {
    return requireAdminActor({ getCurrentUser: () => authService.getCurrentUser() });
  }

  private enterClient(clientId: string, tab?: string) {
    this.ui.enterClient(clientId, tab);
    const client = dbService.getClientById(clientId);
    auditService.log(authService.getCurrentUser(), 'OPEN_CLIENT_WORKSPACE', 'Client', clientId);
    this.showToast(`Trabajando con ${client?.displayName || clientId}`, 'info');
    this.render();
  }

  private backToPortfolio() {
    this.ui.backToPortfolio();
    this.render();
  }

  public render() {
    this.renderScheduler.cancel();
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
        ${renderAppShell(this.activeTab, this.activeClientId, this.activeCampaignId, this.filterState.thesisId || null)}
        <main class="main-wrapper">
          ${this.renderMainView()}
        </main>
        ${workspaceClientId ? renderBriefingBar(this.activeTab, workspaceClientId) : ''}
        ${this.renderActiveModal()}
      </div>
    `;

    this.bindEvents();
    this.renderToasts();
    if (this.activeModal) {
      requestAnimationFrame(() => {
        const firstControl = document.querySelector<HTMLElement>(
          '.modal-overlay .modal-content button, .modal-overlay .modal-content input, .modal-overlay .modal-content select, .modal-overlay .modal-content textarea'
        );
        firstControl?.focus();
      });
    }
    if (user) processDeadlineReminders();
  }

  private renderMainView(): string {
    const user = authService.getCurrentUser();
    if (!user) return '';

    if (user.role !== 'ADMIN') {
      // AUDIT010-11: este tramo caía en `getClients()[0]` cuando la sesión de
      // cliente no traía clientId, es decir pintaba el portal de OTRO tenant.
      // Falla cerrado: sin clientId de confianza no se pinta portal alguno.
      const trustedClientId = user.clientId?.trim();
      if (!trustedClientId) {
        return `<div class="empty-state"><h3>Sesión sin cliente asignado</h3><p>Contacta a tu manager para completar el alta.</p></div>`;
      }
      return renderClientPortal(
        this.activeTab,
        trustedClientId,
        this.activeCampaignId,
        this.filterState.thesisId || undefined,
        this.filterState.highlightTaskId || undefined
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
        thesisId: this.filterState.thesisId || undefined,
      });
    }

    return renderManagerCockpit(this.activeTab, {
      searchQuery:
        this.activeTab === 'dashboard' || this.activeTab === 'clients'
          ? this.filterState.portfolioSearch
          : this.filterState.searchQuery,
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
      try {
        // CR-1 #1 — business authority is AcceptClientInvitation (Application).
        await acceptClientInvitation({ token, password, displayName: name });
      } catch (err) {
        this.loginError =
          err instanceof ClientLifecycleError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'No se pudo aceptar la invitación.';
        this.render();
      }
    });
  }

  openModal(id: string) {
    this.ui.openModal(id);
    this.render();
  }

  setTab(tab: string) {
    const transition = resolveTabTransition(tab, this.currentClientId());
    if (!transition.ok) {
      this.showToast(transition.message, 'warning');
      return;
    }
    this.activeTab = transition.tab;
    this.render();
  }

  navigateFromNotification(tab: string, targetId?: string | null) {
    if (targetId) this.filterState.highlightTaskId = targetId;
    this.setTab(tab);
    if (targetId) {
      window.setTimeout(() => {
        findNotificationTarget(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => {
          this.filterState.highlightTaskId = '';
        }, NOTIFICATION_HIGHLIGHT_MS);
      }, NOTIFICATION_SCROLL_DELAY_MS);
    }
  }

  private renderActiveModal(): string {
    const presentation = presentActiveModal({
      activeModal: this.activeModal,
      modalData: this.modalData,
      fallbackClientId: this.displayClientId(),
      currentClientId: this.currentClientId(),
      isAdmin: authService.getCurrentUser()?.role === 'ADMIN',
      renderNotificationsPanel: () => this.renderNotificationsPanel(),
    });
    if (presentation.forceClose) this.activeModal = null;
    return presentation.html;
  }

  closeModal(): void {
    if (this.activeModal === 'teleprompter') {
      this.stopRecordingSession();
      this.stopTeleprompter();
    }
    this.ui.closeModal();
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
  }

  // ==========================================
  // Navegación de dos niveles
  // ==========================================

  private bindNavigation() {
    document.getElementById('client-campaign-filter')?.addEventListener('change', (e) => {
      const campaignId = (e.currentTarget as HTMLSelectElement).value;
      if (campaignId) this.setActiveCampaign(campaignId);
    });

    document.getElementById('client-thesis-filter')?.addEventListener('change', (e) => {
      this.filterState.thesisId = (e.currentTarget as HTMLSelectElement).value;
      this.refreshMain();
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
      if (FIREBASE_ENABLED) {
        this.showToast('Con Firebase activo, inicia sesión con la cuenta del cliente.', 'info');
        return;
      }
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
      const grant = this.requireAdmin();
      if (!grant.ok) {
        this.showToast(grant.message, 'warning');
        return;
      }
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
        // CR-1 #34 — business authority is CreateClientWithInvite (Application).
        // Organization/actor come from requireAdminActor inside the consumer.
        const { invitation } = createClientWithInvite({
          firstName,
          lastName,
          email,
          profession: val('new-client-profession'),
          company: val('new-client-company'),
          targetMarket: val('new-client-target'),
        });
        this.showToast(`Cliente creado. Token de invitación: ${invitation.token}`, 'success');
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
          // `if (clientId)` era una comprobación de presencia, no de
          // titularidad. El gate valida tenant de confianza antes del write.
          const grant = this.requireTenant(this.modalData?.clientId);
          if (grant.ok) {
            dbService.updateClient(grant.clientId, { onboardingStatus: 'IN_PROGRESS' });
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
      const grant = this.requireTenant(
        formOnboardingStep.getAttribute('data-client-id') || this.resolveClientId(),
      );
      if (!grant.ok) {
        this.showToast(grant.message, 'warning');
        return;
      }
      const clientId = grant.clientId;

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
      notifyManager(clientId, {
        type: 'ONBOARDING',
        title: 'Perfil listo para revisión',
        body: 'El cliente completó el onboarding.',
      });
      authService.clearOnboardingFlag();
      this.showToast('Onboarding completado. Abriendo propuesta de tesis…', 'success');
      this.activeModal = 'thesis-editor';
      this.modalData = { clientId, generateProposal: true };
      this.render();
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

  private thesisProgressTimer: number | null = null;

  private collectThesisFormSnapshot(): ThesisEditorFormSnapshot | null {
    const form = document.getElementById('form-save-thesis');
    if (!form) return null;

    const val = (id: string) =>
      (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '';
    const lines = (id: string) => val(id).split('\n').map((l) => l.trim()).filter(Boolean);
    const num = (id: string, fallback: number) => {
      const parsed = Number.parseInt(val(id), 10);
      return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : fallback;
    };

    const objectives: ThesisObjective[] = Array.from(
      document.querySelectorAll<HTMLInputElement>('[data-objective-kind]')
    )
      .map((input) => ({
        id: `obj_${(input.getAttribute('data-objective-kind') || '').toLowerCase()}`,
        kind: input.getAttribute('data-objective-kind') as ThesisObjectiveKind,
        weight: Math.max(0, Math.min(100, Number.parseInt(input.value, 10) || 0)),
      }))
      .filter((o) => o.weight > 0);

    const voiceDimensions = Object.keys(VOICE_DIMENSION_LABELS) as Array<
      keyof Omit<VoiceProfile, 'style' | 'avoid'>
    >;
    const voiceProfile = voiceDimensions.reduce(
      (acc, key) => ({ ...acc, [key]: num(`thesis-voice-${key}`, 50) }),
      {} as VoiceProfile
    );
    voiceProfile.style = val('thesis-voice-style').trim() || undefined;

    return {
      title: val('thesis-title'),
      identityCurrent: val('thesis-identity-current'),
      expertIdentity: val('thesis-expert-identity'),
      perceptionTarget: val('thesis-perception-target'),
      differentiator: val('thesis-differentiator'),
      audiencesText: val('thesis-audiences'),
      targetAudience: val('thesis-target-audience'),
      territoriesText: val('thesis-territories'),
      domain: val('thesis-domain'),
      objective: val('thesis-objective'),
      objectives,
      voiceProfile,
      voiceAvoidText: val('thesis-voice-avoid'),
      proofPoints: lines('thesis-proof-points'),
      hardBlocks: lines('thesis-limits-hard'),
      softAvoid: lines('thesis-limits-soft'),
      compliance: val('thesis-compliance'),
      priority: num('thesis-priority', 50),
    };
  }

  private showThesisEditorStep(step: ThesisEditorStep) {
    const form = document.getElementById('form-save-thesis');
    form?.setAttribute('data-thesis-current-step', step);

    document.querySelectorAll('[data-thesis-step]').forEach((chip) => {
      chip.classList.toggle('thesis-step-chip-active', chip.getAttribute('data-thesis-step') === step);
    });
    document.querySelectorAll('[data-thesis-panel]').forEach((panel) => {
      panel.classList.toggle('thesis-fieldset-active', panel.getAttribute('data-thesis-panel') === step);
    });

    const prev = document.getElementById('btn-thesis-prev') as HTMLButtonElement | null;
    const next = document.getElementById('btn-thesis-next') as HTMLButtonElement | null;
    if (prev) prev.disabled = step === 'identity';
    if (next) next.disabled = step === 'review';
  }

  private refreshThesisEditorProgress() {
    const form = document.getElementById('form-save-thesis');
    const snapshot = this.collectThesisFormSnapshot();
    if (!form || !snapshot) return;

    const clientId = form.getAttribute('data-client-id') || this.resolveClientId();
    const thesisId = form.getAttribute('data-thesis-id') || 'draft';
    const client = dbService.getClientById(clientId);
    const { completeness, readiness } = evaluateThesisEditorProgress(
      snapshot,
      thesisId,
      clientId,
      client?.organizationId || this.resolveOrganizationId(clientId) || ''
    );

    const valueEl = document.getElementById('thesis-editor-progress-value');
    const fillEl = document.getElementById('thesis-editor-progress-fill');
    if (valueEl) valueEl.innerHTML = `${completeness.score}<span>/100</span>`;
    if (fillEl) {
      fillEl.style.width = `${completeness.score}%`;
      fillEl.classList.toggle('progress-green', completeness.score >= 70);
      fillEl.classList.toggle('progress-red', completeness.score < 40);
    }

    const reviewHost = document.getElementById('thesis-review-live');
    if (reviewHost) {
      reviewHost.innerHTML = `
        <div class="completeness-head">
          <strong class="completeness-value">${completeness.score}<span>/100</span></strong>
          <div class="progress-track">
            <div class="progress-fill ${completeness.score >= 70 ? 'progress-green' : completeness.score >= 40 ? '' : 'progress-red'}" style="width: ${completeness.score}%"></div>
          </div>
        </div>
        ${readiness.ready
          ? '<p class="info-strip">Lista para enviar al cliente.</p>'
          : `<p class="warn-strip">Pendiente: ${esc(readiness.blockers.slice(0, 5).join(' · '))}</p>`}
      `;
    }
  }

  private applyThesisProposalToForm(proposal: ThesisEditableFields) {
    const set = (id: string, value: string) => {
      const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el) el.value = value;
    };

    set('thesis-title', proposal.title);
    set('thesis-identity-current', proposal.identityCurrent || '');
    set('thesis-expert-identity', proposal.expertIdentity);
    set('thesis-perception-target', proposal.perceptionTarget || '');
    set('thesis-differentiator', proposal.differentiator || '');
    set('thesis-target-audience', proposal.targetAudience);
    set('thesis-domain', proposal.domain);
    set('thesis-objective', proposal.objective);
    set('thesis-voice-style', proposal.voiceAndTone);
    set('thesis-compliance', proposal.complianceRules);
    set('thesis-proof-points', (proposal.proofPoints || []).join('\n'));
    set('thesis-limits-hard', (proposal.limits?.hardBlocks || []).join('\n'));
    set('thesis-limits-soft', (proposal.limits?.softAvoid || []).join('\n'));
    set('thesis-voice-avoid', (proposal.voiceProfile?.avoid || []).join('\n'));

    if (proposal.audiences?.length) {
      set('thesis-audiences', formatAudienceLines(proposal.audiences));
    }
    if (proposal.territories?.length) {
      set('thesis-territories', formatTerritoryLines(proposal.territories));
    }

    if (proposal.objectives?.length) {
      for (const obj of proposal.objectives) {
        const input = document.getElementById(`thesis-objective-${obj.kind}`) as HTMLInputElement | null;
        if (input) input.value = String(obj.weight);
      }
    }

    if (proposal.voiceProfile) {
      for (const key of Object.keys(VOICE_DIMENSION_LABELS) as Array<keyof Omit<VoiceProfile, 'style' | 'avoid'>>) {
        const input = document.getElementById(`thesis-voice-${key}`) as HTMLInputElement | null;
        if (input && typeof proposal.voiceProfile![key] === 'number') {
          input.value = String(proposal.voiceProfile![key]);
        }
      }
    }

    if (proposal.priority != null) {
      set('thesis-priority', String(proposal.priority));
    }

    this.refreshThesisEditorProgress();
  }

  private bindThesis() {
    document.querySelectorAll('.btn-open-thesis-editor, .btn-edit-thesis, .btn-focus-thesis-block').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        this.activeModal = 'thesis-editor';
        this.modalData = {
          clientId: target.getAttribute('data-client-id') || this.resolveClientId(),
          thesisId: target.getAttribute('data-thesis-id') || undefined,
          focusBlock: target.getAttribute('data-focus-block') || undefined,
        };
        this.render();
      });
    });

    document.querySelectorAll('[data-thesis-step]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const step = (e.currentTarget as HTMLElement).getAttribute('data-thesis-step') as ThesisEditorStep | null;
        if (!step) return;
        this.showThesisEditorStep(step);
      });
    });

    document.getElementById('btn-thesis-next')?.addEventListener('click', () => {
      const form = document.getElementById('form-save-thesis');
      const current = (form?.getAttribute('data-thesis-current-step') || 'identity') as ThesisEditorStep;
      const snapshot = this.collectThesisFormSnapshot();
      if (!snapshot) return;
      const check = validateThesisEditorStep(current, snapshot);
      if (!check.ok) {
        this.showToast(check.message || 'Completa este paso antes de continuar.', 'warning');
        return;
      }
      const next = nextThesisEditorStep(current);
      if (next) {
        this.showThesisEditorStep(next);
        if (next === 'review') this.refreshThesisEditorProgress();
      }
    });

    document.getElementById('btn-thesis-prev')?.addEventListener('click', () => {
      const form = document.getElementById('form-save-thesis');
      const current = (form?.getAttribute('data-thesis-current-step') || 'identity') as ThesisEditorStep;
      const prev = prevThesisEditorStep(current);
      if (prev) this.showThesisEditorStep(prev);
    });

    document.getElementById('btn-generate-thesis-proposal')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      const grant = this.requireTenant(btn.getAttribute('data-client-id') || this.resolveClientId());
      if (!grant.ok) {
        this.showToast(grant.message, 'warning');
        return;
      }
      const clientId = grant.clientId;
      btn.disabled = true;
      btn.textContent = 'Generando…';
      try {
        const proposal = await aiService.generateThesisProposal(clientId);
        this.applyThesisProposalToForm(proposal);
        this.showToast('Propuesta cargada. Revísala y ajusta antes de guardar.', 'success');
      } catch (error) {
        this.showToast(error instanceof Error ? error.message : 'No se pudo generar la propuesta', 'warning');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Generar propuesta desde perfil';
      }
    });

    const thesisForm = document.getElementById('form-save-thesis');
    thesisForm?.addEventListener('input', () => {
      if (this.thesisProgressTimer) window.clearTimeout(this.thesisProgressTimer);
      this.thesisProgressTimer = window.setTimeout(() => this.refreshThesisEditorProgress(), 400);
    });

    if (this.modalData?.generateProposal && thesisForm) {
      void (async () => {
        const grant = this.requireTenant(
          thesisForm.getAttribute('data-client-id') || this.resolveClientId(),
        );
        if (!grant.ok) {
          this.showToast(grant.message, 'warning');
          return;
        }
        const clientId = grant.clientId;
        try {
          const proposal = await aiService.generateThesisProposal(clientId);
          this.applyThesisProposalToForm(proposal);
          const hint = this.modalData?.splitHint;
          this.showToast(
            hint
              ? `Propuesta generada. ${hint}`
              : 'Propuesta generada desde el perfil. Revisa cada bloque.',
            'info'
          );
        } catch {
          this.showToast('No se pudo generar la propuesta automática.', 'warning');
        } finally {
          this.modalData = { ...this.modalData, generateProposal: false, splitHint: undefined };
        }
      })();
    }

    ['btn-close-thesis-editor', 'btn-cancel-thesis-editor'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => this.closeModal());
    });

    const formSaveThesis = document.getElementById('form-save-thesis');
    formSaveThesis?.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;
        const intent = (submitter?.getAttribute('data-thesis-intent') || 'draft') as ThesisSaveIntent;
        const clientId = formSaveThesis.getAttribute('data-client-id') || this.resolveClientId();
        const thesisId = formSaveThesis.getAttribute('data-thesis-id') || createId('thesis');

        const val = (id: string) =>
          (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '';
        const lines = (id: string) => val(id).split('\n').map((l) => l.trim()).filter(Boolean);
        const num = (id: string, fallback: number) => {
          const parsed = Number.parseInt(val(id), 10);
          return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : fallback;
        };

        const objectives: ThesisObjective[] = Array.from(
          document.querySelectorAll<HTMLInputElement>('[data-objective-kind]')
        )
          .map((input) => ({
            id: `obj_${(input.getAttribute('data-objective-kind') || '').toLowerCase()}`,
            kind: input.getAttribute('data-objective-kind') as ThesisObjectiveKind,
            weight: Math.max(0, Math.min(100, Number.parseInt(input.value, 10) || 0)),
          }))
          .filter((o) => o.weight > 0);

        const voiceDimensions = Object.keys(VOICE_DIMENSION_LABELS) as Array<
          keyof Omit<VoiceProfile, 'style' | 'avoid'>
        >;
        const voiceProfile = voiceDimensions.reduce(
          (acc, key) => ({ ...acc, [key]: num(`thesis-voice-${key}`, 50) }),
          {} as VoiceProfile
        );
        voiceProfile.style = val('thesis-voice-style').trim() || undefined;
        const voiceAvoid = lines('thesis-voice-avoid');
        voiceProfile.avoid = voiceAvoid.length ? voiceAvoid : undefined;

        const audiences = parseAudienceLines(val('thesis-audiences'));
        const territories = parseTerritoryLines(val('thesis-territories'));
        const hardBlocks = lines('thesis-limits-hard');
        const softAvoid = lines('thesis-limits-soft');

        const existing = dbService.getThesesByClient(clientId).find((t) => t.id === thesisId);
        const now = new Date().toISOString();
        const actor = authService.getCurrentUser()?.uid || 'user_admin_01';

        const title = val('thesis-title').trim();
        if (!title || !val('thesis-expert-identity').trim()) {
          this.showToast('Título e identidad objetivo son obligatorios.', 'warning');
          return;
        }
        const weightCheck = validateWeights(objectives);
        if (!weightCheck.ok && objectives.length) {
          this.showToast(weightCheck.message || 'Los objetivos deben sumar 100.', 'warning');
          return;
        }

        const editable = {
          title,
          expertIdentity: val('thesis-expert-identity'),
          targetAudience: val('thesis-target-audience'),
          secondaryAudience: existing?.secondaryAudience,
          domain: val('thesis-domain'),
          objective: val('thesis-objective'),
          proofPoints: lines('thesis-proof-points'),
          differentiator: val('thesis-differentiator') || undefined,
          voiceAndTone: val('thesis-voice-style').trim() || 'Autoritativo, claro, orientado a mitigación de riesgos',
          complianceRules: val('thesis-compliance') || '',
          identityCurrent: val('thesis-identity-current').trim() || undefined,
          perceptionTarget: val('thesis-perception-target').trim() || undefined,
          audiences: audiences.length ? audiences : undefined,
          territories: territories.length ? territories : undefined,
          objectives: objectives.length ? objectives : undefined,
          voiceProfile,
          limits: hardBlocks.length || softAvoid.length ? { hardBlocks, softAvoid } : undefined,
          priority: num('thesis-priority', 50),
        };

        const organizationId = this.resolveOrganizationId(clientId);
        if (!organizationId) {
          this.showToast('Cliente sin organizationId', 'warning');
          return;
        }

        if (intent === 'submit_review') {
          const candidate: PositioningThesis = {
            id: thesisId,
            organizationId,
            clientId,
            ...editable,
            status: existing?.status || 'DRAFT',
            clientApprovalStatus: existing?.clientApprovalStatus || 'PENDING',
            createdAt: existing?.createdAt || now,
            createdBy: existing?.createdBy || actor,
            updatedAt: now,
            updatedBy: actor,
          };
          const readiness = assertThesisReadyForReview(candidate);
          if (!readiness.ready) {
            const preview = readiness.blockers.slice(0, 4).join(' · ');
            this.showToast(
              `Estructura ${readiness.score}/100. Completa: ${preview}`,
              'warning'
            );
            return;
          }
        }

        const plan = planThesisSave(existing, editable, actor, now, intent);

        dbService.saveThesis({
          id: thesisId,
          organizationId,
          clientId,
          ...(plan.keepActive && existing
            ? {
                ...existing,
                pendingRevision: plan.pendingRevision,
                clientApprovalStatus: plan.clientApprovalStatus,
                status: plan.status,
                updatedAt: now,
                updatedBy: actor,
              }
            : {
                ...editable,
                status: plan.status,
                clientApprovalStatus: plan.clientApprovalStatus,
                pendingRevision: plan.pendingRevision,
                createdAt: existing?.createdAt || now,
                createdBy: existing?.createdBy || actor,
                updatedAt: now,
                updatedBy: actor,
              }),
        });

        auditService.log(authService.getCurrentUser(), 'SAVE_THESIS', 'PositioningThesis', thesisId, {
          title,
          keepActive: plan.keepActive,
          intent,
        });

        if (plan.notifyClient) {
          const notified = notifyClient(clientId, {
            type: 'THESIS',
            title: plan.keepActive ? 'Revisión de tesis pendiente' : 'Tesis lista para tu aprobación',
            body: title,
          });
          if (!notified) {
            this.showToast('Tesis guardada. El cliente aún no tiene cuenta para recibir aviso.', 'info');
          }
        }

        this.showToast(plan.toast, 'success');
        this.closeModal();
      } catch (error) {
        this.showToast(error instanceof Error ? error.message : 'No se pudo guardar la tesis', 'warning');
      }
    });

    document.querySelectorAll('[data-thesis-select]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.filterState.thesisId = (e.currentTarget as HTMLElement).getAttribute('data-thesis-select') || '';
        this.refreshMain();
      });
    });

    document.querySelectorAll('[data-thesis-override]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const signalId = target.getAttribute('data-signal-id') || '';
        const thesisId = target.getAttribute('data-thesis-override') || '';
        const signal = dbService.getSignalById(signalId);
        if (!signal || !thesisId) return;

        const clientId = this.resolveClientId(signal.clientId);
        const organizationId = this.resolveOrganizationId(clientId);
        const user = authService.getCurrentUser();
        if (!organizationId || !user) {
          this.showToast('Sesión sin organizationId — no se puede asignar tesis', 'warning');
          return;
        }

        try {
          const result = this.strategicRouting.overrideSignalThesis({
            signalId,
            clientId,
            organizationId,
            selectedThesisId: thesisId,
            actorId: user.uid,
            actorRole: user.role,
          });
          const title =
            dbService.getThesisById(clientId, result.routing.selectedThesisId || thesisId)?.title ||
            thesisId;
          auditService.log(user, 'THESIS_OVERRIDE', 'Signal', signalId, { thesisId });
          this.showToast(`Señal asignada a «${title}»`, 'success');
          this.refreshMain();
        } catch (error) {
          const message =
            error instanceof StrategicRoutingError
              ? error.message
              : error instanceof Error
                ? error.message
                : 'No se pudo asignar la tesis';
          this.showToast(message, 'warning');
        }
      });
    });

    document.querySelectorAll('[data-evidence-thesis-toggle]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const evidenceId = target.getAttribute('data-evidence-thesis-toggle') || '';
        const thesisId = target.getAttribute('data-thesis-id') || '';
        const linked = dbService.toggleEvidenceThesis(evidenceId, thesisId);
        auditService.log(
          authService.getCurrentUser(),
          linked ? 'LINK_EVIDENCE_THESIS' : 'UNLINK_EVIDENCE_THESIS',
          'EvidenceVaultItem',
          evidenceId,
          { thesisId }
        );
        this.showToast(
          linked ? 'Evidencia asignada. El Authority Score se recalcula.' : 'Evidencia desvinculada de la tesis.',
          'success'
        );
        this.refreshMain();
      });
    });

    document.querySelectorAll('.btn-challenge-thesis').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const clientId = target.getAttribute('data-client-id') || this.resolveClientId();
        const theses = dbService.getThesesByClient(clientId);
        const requestedId = target.getAttribute('data-thesis-id');
        const thesis = requestedId ? theses.find((t) => t.id === requestedId) : undefined;
        if (!thesis) {
          this.showToast('Selecciona una tesis válida para someterla a prueba.', 'warning');
          return;
        }
        target.disabled = true;
        target.textContent = 'Diagnosticando…';
        try {
          const challenge = await aiService.challengeThesis(thesis);
          this.activeModal = 'challenge';
          this.modalData = {
            title: thesis.title,
            challenge,
            clientId,
            thesisId: thesis.id,
            thesisStatus: thesis.status,
          };
          this.render();
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'No se pudo evaluar la tesis', 'warning');
          this.render();
        } finally {
          target.disabled = false;
          target.textContent = 'Stress-test';
        }
      });
    });

    document.querySelectorAll('.btn-activate-thesis').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const clientId = target.getAttribute('data-client-id') || this.resolveClientId();
        const thesisId = target.getAttribute('data-thesis-id');
        const thesis = dbService.getThesesByClient(clientId).find((t) => t.id === thesisId);
        if (!thesis) return;
        try {
          const actor = authService.getCurrentUser()?.uid || thesis.updatedBy;
          const activated = activateThesisByManager(
            { ...thesis, updatedAt: new Date().toISOString(), updatedBy: actor },
            actor
          );
          dbService.saveThesis(activated);
          auditService.log(authService.getCurrentUser(), 'THESIS_ACTIVATED', 'PositioningThesis', thesis.id, {
            clientId,
          });
          this.showToast('Tesis activada. El radar y el scoring ya la usan.', 'success');
          this.refreshMain();
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'No se pudo activar la tesis', 'warning');
        }
      });
    });

    ['btn-close-challenge', 'btn-close-challenge-bottom'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => this.closeModal());
    });

    document.getElementById('btn-challenge-edit-thesis')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      this.closeModal();
      this.activeModal = 'thesis-editor';
      this.modalData = {
        clientId: btn.getAttribute('data-client-id') || this.resolveClientId(),
        thesisId: btn.getAttribute('data-thesis-id') || undefined,
      };
      this.render();
    });

    document.getElementById('btn-challenge-split-thesis')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      this.closeModal();
      this.activeModal = 'thesis-editor';
      this.modalData = {
        clientId: btn.getAttribute('data-client-id') || this.resolveClientId(),
        generateProposal: true,
        splitHint: btn.getAttribute('data-split-hint') || '',
      };
      this.render();
    });

    document.getElementById('btn-challenge-open-vault')?.addEventListener('click', () => {
      this.closeModal();
      this.setTab('ws-positioning');
      window.setTimeout(() => {
        const panel = document.getElementById('proof-wall-section');
        if (panel instanceof HTMLDetailsElement) panel.open = true;
        panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    });

    document.getElementById('btn-challenge-submit-thesis')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      this.closeModal();
      this.activeModal = 'thesis-editor';
      this.modalData = {
        clientId: btn.getAttribute('data-client-id') || this.resolveClientId(),
        thesisId: btn.getAttribute('data-thesis-id') || undefined,
        focusBlock: 'review',
      };
      this.render();
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
      // Client-wide source — no silent thesisId attribution to primary/[0].

      try {
        const organizationId = this.resolveOrganizationId(clientId);
        if (!organizationId) {
          this.showToast('Cliente sin organizationId — no se puede registrar la fuente', 'warning');
          return;
        }
        dbService.addSource({
          organizationId,
          clientId,
          thesisId: undefined,
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
            this.showToast(`${source.name}: ${labelSourceRunError(error)}`, 'warning');
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

        const candidate = resolveDiscoveryCandidate(client, undefined, key);
        if (!candidate) return;

        try {
          dbService.addSource({
            organizationId: client.organizationId,
            clientId,
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

      const lastRun = loadLastAgentRun(clientId);
      const existing = new Set(
        dbService.getSourcesByClient(clientId).map((s) => normalizeSourceUrl(s.url || ''))
      );
      const candidates = (
        lastRun?.recommendations.length
          ? lastRun.recommendations
          : discoverSources(client, undefined)
      ).filter((d) => !existing.has(normalizeSourceUrl(d.url)));

      let added = 0;
      for (const candidate of candidates) {
        try {
          dbService.addSource({
            organizationId: client.organizationId,
            clientId,
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

      const active = dbService.getActiveTheses(clientId);
      const keywords = buildMergedProfileKeywords(client, active);
      const profile = dbService.getMasterProfile(clientId);
      const extendedBase = discoverExtendedSources(client, undefined);
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

      const active = dbService.getActiveTheses(clientId);
      const keywords = buildMergedProfileKeywords(client, active);
      const existing = new Set(
        dbService.getSourcesByClient(clientId).map((s) => normalizeSourceUrl(s.url || ''))
      );
      const candidates = buildCuratedPresetsForProfile(client, undefined, keywords).filter(
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

      tavilyRescanBtn.textContent = 'Buscando…';
      tavilyRescanBtn.setAttribute('disabled', 'true');

      try {
        const run = await runSourceDiscoveryAgentAsync(client, undefined, { forceTavily: true });
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

    const organizationId = this.resolveOrganizationId(clientId);
    if (!organizationId) {
      this.showToast('Cliente sin organizationId — no se puede crear la señal', 'warning');
      return;
    }

    const result = dbService.addSignal({
      organizationId,
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
      const thesisId = (document.getElementById('task-thesis') as HTMLSelectElement | null)?.value || undefined;
      if (!thesisId) {
        this.showToast('Selecciona una tesis ACTIVE para la tarea.', 'warning');
        return;
      }

      const title = (document.getElementById('task-title') as HTMLInputElement).value.trim();
      const description = (document.getElementById('task-description') as HTMLTextAreaElement).value.trim();
      const type = (document.getElementById('task-type') as HTMLSelectElement).value as TaskType;
      const estimatedMinutes = parseInt((document.getElementById('task-minutes') as HTMLInputElement).value || '15', 10);
      const deadlineRaw = (document.getElementById('task-deadline') as HTMLInputElement).value;

      const organizationId = this.resolveOrganizationId(clientId);
      if (!organizationId) {
        this.showToast('Cliente sin organizationId — no se puede crear la tarea', 'warning');
        return;
      }

      const created = dbService.addTask({
        organizationId,
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
        href: 'client-home',
        targetId: created.id,
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
        e.stopPropagation();
        const taskId = (e.currentTarget as HTMLElement).getAttribute('data-task-id');
        if (!taskId) return;
        if (!confirm('¿Cancelar esta tarea? El cliente dejará de verla como pendiente.')) return;
        dbService.updateTaskStatus(taskId, 'CANCELLED');
        auditService.log(authService.getCurrentUser(), 'CANCEL_TASK', 'Task', taskId);
        this.showToast('Tarea cancelada', 'info');
        this.render();
      });
    });

    document.querySelectorAll('.btn-open-task-action').forEach((btn) => {
      const open = (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.closest('a, video, .btn-download-recording, .btn-reupload-recording, .input-reupload-recording')) {
          e.stopPropagation();
          return;
        }
        const taskId = (e.currentTarget as HTMLElement).getAttribute('data-task-id');
        if (taskId) this.openAssignedTask(taskId);
      };
      btn.addEventListener('click', open);
      btn.addEventListener('keydown', (e) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          e.preventDefault();
          open(e);
        }
      });
    });
  }

  /** Abre la herramienta que corresponde al tipo de tarea. */
  private openAssignedTask(taskId: string): void {
    const task = dbService.getAllTasks().find((t) => t.id === taskId);
    if (!task) {
      this.showToast('Tarea no encontrada', 'warning');
      return;
    }

    if (task.status === 'ASSIGNED' || task.status === 'DRAFT') {
      try {
        dbService.updateTaskStatus(taskId, 'VIEWED');
      } catch {
        /* transiciones ya avanzadas */
      }
    }

    if (task.type === 'RECORD_VIDEO') {
      this.markVideoCaptureStarted(task);
      this.activeModal = 'teleprompter';
      this.modalData = { taskId };
      this.render();
      return;
    }

    if (task.type === 'REVIEW_ARTICLE') {
      if (task.contentItemId) {
        const user = authService.getCurrentUser();
        if (user?.role === 'CLIENT') {
          this.markArticleReviewStarted(task, task.contentItemId);
          this.activeModal = 'article-review';
          this.modalData = { contentId: task.contentItemId, taskId };
        } else {
          this.activeModal = 'content-preview';
          this.modalData = { contentId: task.contentItemId, taskId };
        }
        this.render();
        return;
      }
      this.setTab('ws-production');
      this.showToast('No hay borrador vinculado. Revisa Producción.', 'info');
      return;
    }

    if (task.type === 'APPROVE_OPPORTUNITY') {
      this.setTab('ws-briefing');
      return;
    }

    if (task.type === 'SUBMIT_INFO') {
      const urlMatch = task.description.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        window.open(urlMatch[0], '_blank', 'noopener,noreferrer');
      }
      this.showToast(
        urlMatch ? 'Se abrió la lectura en una pestaña.' : 'Lectura asignada: revisa la descripción de la tarea.',
        'info'
      );
      return;
    }

    this.showToast('Esta tarea no tiene una acción automática.', 'info');
  }

  // ==========================================
  // Radar
  // ==========================================

  /** Términos del perfil y del dossier — multi-tesis ACTIVE (no primary). */
  private scoringContext(clientId: string): ScoringContext {
    const client = dbService.getClientById(clientId);
    if (!client) return {};
    const keywords = buildMergedProfileKeywords(client, dbService.getActiveTheses(clientId));
    const dossier = dbService.getMasterDossier(clientId);
    return {
      bilingualTerms: [...keywords.coreEn, ...keywords.coreEs],
      ownedTopics: dossier?.topicsToOwn,
      avoidedFramings: dossier?.topicsToAvoid || [],
    };
  }

  /**
   * SPEC-001 Phase 2 — central strategic routing via ScoreAndRouteSignal.
   * No getPrimaryThesis / candidates[0] attribution.
   */
  private scoreSignal(signalId: string, clientId: string): number | null {
    const organizationId = this.resolveOrganizationId(clientId);
    if (!organizationId) return null;

    try {
      const result = this.strategicRouting.scoreAndRouteSignal({
        signalId,
        clientId,
        organizationId,
      });
      if (result.routing.routingState === 'UNROUTED' && result.routing.eligibleThesisCount === 0) {
        return null;
      }
      return result.scoreResult.totalScore;
    } catch (error) {
      if (error instanceof StrategicRoutingError && error.code === 'SIGNAL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
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
      const grant = this.requireTenant(btn.getAttribute('data-client-id') || this.resolveClientId());
      if (!grant.ok) {
        this.showToast(grant.message, 'warning');
        return;
      }
      const clientId = grant.clientId;
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
        const grant = this.requireTenant(this.resolveClientId(signal?.clientId));
        if (!grant.ok) {
          this.showToast(grant.message, 'warning');
          return;
        }
        const clientId = grant.clientId;
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
        if (!signal) {
          this.showToast('Señal no encontrada.', 'warning');
          return;
        }

        // Deterministic routing first; advisory AI only on CLEAR routed thesis.
        this.scoreSignal(signalId, clientId);
        const routedSignal = dbService.getSignalById(signalId) || signal;
        const resolved = resolveThesisForSignalOperation(
          routedSignal,
          dbService.getThesesByClient(clientId)
        );
        if (!resolved.ok) {
          const msg =
            resolved.error === 'CONTESTED'
              ? 'Conflicto entre tesis — resuelve manualmente antes del análisis AI.'
              : resolved.error === 'UNROUTED'
                ? 'Señal sin tesis enrutada — no se puede analizar.'
                : 'No hay tesis válida para analizar esta señal.';
          this.showToast(msg, 'warning');
          this.render();
          return;
        }
        const thesis = resolved.thesis;

        target.disabled = true;
        target.textContent = 'Analizando…';
        try {
          const rec = await aiService.analyzeSignalAgainstThesis(
            routedSignal,
            thesis,
            this.scoringContext(clientId)
          );
          const { usedLiveModel, ...payload } = rec as typeof rec & { usedLiveModel?: boolean };
          dbService.addRecommendation(payload);
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
        try {
          registerSignalOutcomeIntent({
            clientId,
            signalId,
            kind,
            source: 'RADAR',
            thesisId: signal.thesisId,
          });
        } catch (error) {
          this.showToast(
            error instanceof Error ? error.message : 'No se pudo registrar el outcome',
            'warning'
          );
          return;
        }
        auditService.log(authService.getCurrentUser(), 'SIGNAL_OUTCOME', 'Signal', signalId, { kind });
        metricsService.track('signal_outcome', { kind }, clientId);
        this.showToast(
          kind === 'USEFUL' ? 'Marcada como útil' : 'Marcada como no útil',
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
          thesisId: scored?.thesisId || signal.thesisId,
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
      strategicBriefId: entry.strategicBriefId,
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
          const brief = entry.strategicBriefId
            ? getStrategicBrief(entry.strategicBriefId, entry.clientId)
            : undefined;
          const signal = entry.signalId ? dbService.getSignalById(entry.signalId) : undefined;
          const thesisId =
            brief?.thesisId ?? signal?.routingDecision?.selectedThesisId;
          if (!thesisId) {
            this.showToast(
              'Routing must be resolved first — create a Strategic Brief or ensure CLEAR governed routing.',
              'warning'
            );
            return;
          }
          const { angle, usedLiveModel } = await proposeAngle({
            clientId: entry.clientId,
            title: entry.title,
            snippet: entry.snippet,
            thesisId,
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

    document.querySelectorAll('.btn-create-strategic-brief').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const curationId = (e.currentTarget as HTMLElement).getAttribute('data-curation-id');
        const destination = (e.currentTarget as HTMLElement).getAttribute('data-destination') as CurationDestination;
        if (!curationId || !destination) return;
        const entry = dbService.getCurationById(curationId);
        if (!entry) return;
        try {
          const { brief } = createBriefFromCurationEntry({ entry, destination });
          this.showToast(`Strategic Brief DRAFT created (${brief.id}).`, 'success');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Could not create Strategic Brief.', 'warning');
        }
        this.render();
      });
    });

    document.querySelectorAll('.btn-approve-strategic-brief').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const briefId = (e.currentTarget as HTMLElement).getAttribute('data-brief-id');
        const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id');
        if (!briefId || !clientId) return;
        try {
          approveStrategicBrief({ clientId, briefId });
          this.showToast('Strategic Brief approved.', 'success');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Could not approve Strategic Brief.', 'warning');
        }
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
      const grant = this.requireTenant(
        target.getAttribute('data-client-id') || this.resolveClientId(),
      );
      if (!grant.ok) {
        this.showToast(grant.message, 'warning');
        return;
      }
      const clientId = grant.clientId;
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
      const grant = this.requireTenant(
        target.getAttribute('data-client-id') || this.resolveClientId(),
      );
      if (!grant.ok) {
        this.showToast(grant.message, 'warning');
        return;
      }
      const clientId = grant.clientId;
      target.disabled = true;
      try {
        const result = runTopicAgent(clientId);
        this.showToast(`Ranking generado: ${result.items.length} temas`, 'success');
      } finally {
        target.disabled = false;
      }
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

        const organizationId = this.resolveOrganizationId(clientId);
        if (!organizationId) {
          this.showToast('Cliente sin organizationId', 'warning');
          return;
        }
        dbService.addToCuration({
          organizationId,
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
        if (item?.refId) dbService.attachCurationToDelivery(item.refId, null);
        dbService.removeDeliveryItem(packageId, itemId);
        this.showToast('Ítem retirado del briefing', 'info');
        this.render();
      });
    });

    document.getElementById('btn-preview-delivery')?.addEventListener('click', (e) => {
      const packageId = (e.currentTarget as HTMLElement).getAttribute('data-package-id');
      if (!packageId) return;
      this.activeModal = 'delivery-preview';
      this.modalData = { packageId };
      this.render();
    });

    document.querySelectorAll('.btn-discard-delivery').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const packageId = (e.currentTarget as HTMLElement).getAttribute('data-package-id');
        if (!packageId) return;
        const pkg = dbService.getDeliveryById(packageId);
        if (!pkg) return;
        if (!window.confirm(`¿Descartar el borrador «${pkg.title}»? Los ítems vuelven a la bandeja de listos.`)) return;
        dbService.discardDraftDelivery(packageId);
        this.showToast('Borrador descartado', 'info');
        this.render();
      });
    });

    document.querySelectorAll('.btn-close-delivery-preview').forEach((btn) => {
      btn.addEventListener('click', () => this.closeModal());
    });

    document.querySelectorAll('.btn-confirm-send-delivery').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const packageId = (e.currentTarget as HTMLElement).getAttribute('data-package-id');
        if (!packageId) return;
        const el = e.currentTarget as HTMLButtonElement;
        el.disabled = true;
        el.textContent = 'Enviando…';
        try {
          await this.sendDelivery(packageId);
          this.closeModal();
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'No se pudo enviar el briefing', 'warning');
          this.render();
        }
      });
    });

    ['btn-send-delivery', 'btn-send-delivery-bar'].forEach((id) => {
      const sendBtn = document.getElementById(id) as HTMLButtonElement | null;
      sendBtn?.addEventListener('click', () => {
        const packageId = sendBtn.getAttribute('data-package-id');
        if (!packageId) return;
        this.activeModal = 'delivery-preview';
        this.modalData = { packageId };
        this.render();
      });
    });

    document.querySelectorAll('.btn-acknowledge-delivery').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-package-id');
        if (!id) return;
        const noteEl = document.querySelector(`.input-ack-note[data-package-id="${id}"]`) as HTMLTextAreaElement | null;
        const note = noteEl?.value.trim();
        const pkg = dbService.acknowledgeDelivery(id, note);
        if (!pkg) {
          this.showToast('No se pudo marcar el briefing', 'warning');
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
        this.showToast('Briefing marcado como visto', 'success');
        this.render();
      });
    });
  }

  /**
   * Strategic downstream gate: SPEC-003 Brief + SPEC-004 StrategicPlan.
   * CurationEntry / DeliveryPackage / caller snapshots are not Plan authority.
   */
  private gateStrategicDownstream(
    clientId: string,
    briefId: string | undefined,
    action: StrategicDownstreamAction
  ):
    | {
        ok: true;
        briefId: string;
        version?: number;
        thesisId: string;
        signalIds: string[];
        evidenceIds: string[];
        planId: string;
        planItemId: string;
      }
    | { ok: false; message: string } {
    const planned = requirePlannedAuthorization({
      clientId,
      briefId,
      requestedAction: action,
    });
    if (!planned.authorized || !planned.planId || !planned.planItemId || !planned.thesisId) {
      return { ok: false, message: formatPlannedAuthorizationDenial(planned) };
    }
    const brief = getStrategicBrief(planned.briefId, clientId);
    if (!brief) {
      return {
        ok: false,
        message: 'Strategic Brief required — create and approve a Brief for this signal first.',
      };
    }
    return {
      ok: true,
      briefId: brief.id,
      version: planned.briefVersion ?? brief.version,
      thesisId: planned.thesisId,
      signalIds: planned.signalIds ?? [...brief.signalIds],
      evidenceIds: planned.evidenceIds ?? [...brief.supportingEvidenceIds],
      planId: planned.planId,
      planItemId: planned.planItemId,
    };
  }

  private async sendDelivery(packageId: string) {
    const pkg = dbService.getDeliveryById(packageId);
    const clientId = pkg?.clientId;
    if (!pkg || !clientId) {
      throw new Error('Briefing no encontrado.');
    }

    const validation = validateDeliveryForSend(
      pkg,
      (item) => (item.refId ? dbService.getCurationById(item.refId)?.destination : undefined),
      undefined,
      (item, destination) => {
        const action = destination ? curationDestinationToDownstreamAction(destination) : undefined;
        if (!action) {
          return { ok: false, message: 'Strategic destination requires Brief authorization.' };
        }
        const entry = item.refId ? dbService.getCurationById(item.refId) : undefined;
        // CurationEntry is intake/COMPATIBILITY only — never Plan authority.
        assertCurationNotPlanAuthority(entry);
        const briefId = item.strategicBriefId || entry?.strategicBriefId;
        const planned = requirePlannedAuthorization({
          clientId,
          briefId,
          requestedAction: action,
        });
        if (!planned.authorized) {
          return { ok: false, message: formatPlannedAuthorizationDenial(planned) };
        }
        return {
          ok: true,
          briefId: planned.briefId,
          action,
          version: planned.briefVersion,
        };
      }
    );
    if (!validation.ok) {
      throw new Error(validation.message);
    }

    type CurationEntry = ReturnType<typeof dbService.getCurationById>;
    type DraftPlan =
      | {
          kind: 'task_content';
          item: DeliveryItem;
          entry?: CurationEntry;
          destination: 'TASK_VIDEO' | 'TASK_ARTICLE';
          draft: Awaited<ReturnType<typeof aiService.generateContentDraft>>;
          thesis: PositioningThesis;
          gate: {
            briefId: string;
            version?: number;
            signalIds: string[];
            evidenceIds: string[];
            planId: string;
            planItemId: string;
          };
        }
      | {
          kind: 'opportunity';
          item: DeliveryItem;
          entry?: CurationEntry;
          thesis: PositioningThesis;
          gate: {
            briefId: string;
            version?: number;
            signalIds: string[];
            evidenceIds: string[];
            planId: string;
            planItemId: string;
          };
        }
      | { kind: 'evidence'; item: DeliveryItem; entry?: CurationEntry; thesis: PositioningThesis }
      | {
          kind: 'reading';
          item: DeliveryItem;
          entry?: CurationEntry;
          thesis: PositioningThesis;
          gate: {
            briefId: string;
            version?: number;
            signalIds: string[];
            evidenceIds: string[];
            planId: string;
            planItemId: string;
          };
        };

    const plans: DraftPlan[] = [];
    const briefingItems = pkg.items;

    for (const item of briefingItems) {
      const entry = item.refId ? dbService.getCurationById(item.refId) : undefined;
      const destination = entry?.destination;

      if (destination === 'EVIDENCE') {
        const thesis = entry?.thesisId
          ? dbService.getThesisById(clientId, entry.thesisId)
          : undefined;
        if (!thesis) {
          throw new Error('El ítem de evidencia requiere contexto de tesis válido.');
        }
        plans.push({ kind: 'evidence', item, entry, thesis });
        continue;
      }

      const action = destination ? curationDestinationToDownstreamAction(destination) : undefined;
      if (!action) {
        if (item.kind === 'READING') {
          const gate = this.gateStrategicDownstream(
            clientId,
            item.strategicBriefId || entry?.strategicBriefId,
            'CREATE_TASK'
          );
          if (!gate.ok) throw new Error(gate.message);
          const thesis = dbService.getThesisById(clientId, gate.thesisId);
          if (!thesis) throw new Error('Approved Brief thesis not found.');
          plans.push({ kind: 'reading', item, entry, thesis, gate });
        }
        continue;
      }

      const gate = this.gateStrategicDownstream(
        clientId,
        item.strategicBriefId || entry?.strategicBriefId,
        action
      );
      if (!gate.ok) throw new Error(gate.message);

      const thesis = dbService.getThesisById(clientId, gate.thesisId);
      if (!thesis) {
        throw new Error('Approved Brief thesis not found.');
      }

      if (destination === 'TASK_VIDEO' || destination === 'TASK_ARTICLE') {
        const format = destination === 'TASK_VIDEO' ? 'VIDEO_SCRIPT' : 'LINKEDIN_ARTICLE';
        const draft = await aiService.generateContentDraft(thesis, item.title, format);
        plans.push({ kind: 'task_content', item, entry, destination, draft, thesis, gate });
      } else if (destination === 'OPPORTUNITY') {
        plans.push({ kind: 'opportunity', item, entry, thesis, gate });
      } else if (destination === 'REFERENCE_READING') {
        plans.push({ kind: 'reading', item, entry, thesis, gate });
      }
    }

    let createdTasks = 0;
    const convertedSignalIds: string[] = [];
    dbService.runInSaveBatch(() => {
      for (const plan of plans) {
        if (plan.kind === 'task_content') {
          const contentId = createId('cnt');
          const advanced = this.saveContentWithClaimGate(
            {
              ...plan.draft,
              id: contentId,
              status: 'AI_GENERATED',
              managerNotes: `${plan.draft.managerNotes || ''} Justificación: ${plan.item.rationale || 'sin nota'}`.trim(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              strategicBriefId: plan.gate.briefId,
              strategicBriefVersion: plan.gate.version,
              signalIds: plan.gate.signalIds,
              supportingEvidenceIds: plan.gate.evidenceIds,
            },
            'CLIENT_REVIEW',
            'Enviado con briefing'
          );
          if (!advanced) {
            // El contenido queda en AI_GENERATED con el veredicto; se sigue creando la tarea.
          }

          dbService.addTask({
            organizationId: plan.thesis.organizationId,
            clientId,
            thesisId: plan.thesis.id,
            type: plan.destination === 'TASK_VIDEO' ? 'RECORD_VIDEO' : 'REVIEW_ARTICLE',
            title: plan.item.title.slice(0, 90),
            description: plan.item.rationale || 'Preparado por tu Brand Manager.',
            estimatedMinutes: plan.destination === 'TASK_VIDEO' ? 15 : 20,
            status: 'ASSIGNED',
            contentItemId: contentId,
            curationEntryId: plan.entry?.id,
            deliveryPackageId: packageId,
            scriptPayload: plan.draft.teleprompterScript,
            strategicBriefId: plan.gate.briefId,
            strategicBriefVersion: plan.gate.version,
            signalId: plan.gate.signalIds[0],
          });
          createdTasks += 1;
          for (const sid of plan.gate.signalIds) convertedSignalIds.push(sid);
        } else if (plan.kind === 'opportunity') {
          // SPEC-007 Phase 4: canonical MaterializeOpportunity after SPEC-004 gate.
          // No dbService.addOpportunity authority; no legacy fallback on deny.
          materializeOpportunityForDelivery({
            clientId,
            planId: plan.gate.planId,
            planItemId: plan.gate.planItemId,
            thesisId: plan.thesis.id,
            title: plan.item.title.slice(0, 120),
            organization: plan.entry?.sourceName || 'Por confirmar',
            type: 'PANEL',
            deadline: new Date(Date.now() + 21 * 86400000).toISOString(),
            description: plan.item.note || plan.item.title,
            fitRationale: plan.item.rationale || 'Alineado con la tesis activa.',
            strategicBriefId: plan.gate.briefId,
            strategicBriefVersion: plan.gate.version,
            signalId: plan.gate.signalIds[0],
            intentKey: `delivery:${packageId}:opp:${plan.item.id || plan.item.title}`,
          });
          for (const sid of plan.gate.signalIds) convertedSignalIds.push(sid);
        } else if (plan.kind === 'evidence') {
          dbService.addEvidenceItem({
            organizationId: plan.thesis.organizationId,
            clientId,
            title: plan.item.title.slice(0, 120),
            type: 'DOCUMENT',
            sourceUrl: plan.item.url,
            snippet: plan.item.note || plan.item.title,
            confidenceScore: 70,
            verified: false,
            associatedThesesIds: [plan.thesis.id],
          });
        } else if (plan.kind === 'reading') {
          dbService.addTask({
            organizationId: plan.thesis.organizationId,
            clientId,
            thesisId: plan.thesis.id,
            type: 'SUBMIT_INFO',
            title: `Leer: ${plan.item.title.slice(0, 80)}`,
            description: readingTaskDescription(plan.item),
            estimatedMinutes: 10,
            status: 'ASSIGNED',
            curationEntryId: plan.entry?.id,
            deliveryPackageId: packageId,
            strategicBriefId: plan.gate.briefId,
            strategicBriefVersion: plan.gate.version,
            signalId: plan.gate.signalIds[0],
          });
          createdTasks += 1;
          for (const sid of plan.gate.signalIds) convertedSignalIds.push(sid);
        }
      }
      dbService.markDeliverySent(packageId, [...new Set(convertedSignalIds)]);
    });

    const notified = notifyClient(clientId!, {
      type: 'BRIEFING',
      title: 'Nuevo briefing de tu Brand Manager',
      body: `${pkg!.title} · ${pkg!.items.length} ítem(s)`,
      href: 'client-home',
    });
    if (!notified) {
      this.showToast('Briefing enviado. El cliente no tiene cuenta vinculada para avisos.', 'info');
    }
    auditService.log(authService.getCurrentUser(), 'DELIVERY_SENT', 'DeliveryPackage', packageId, {
      clientId: clientId!,
      items: pkg!.items.length,
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
  private syncContentToPipelineStatus(
    contentId: string,
    legacyStatus: ContentStatus,
    comment?: string,
    options?: {
      reviewAcknowledged?: boolean;
      requireReviewAck?: boolean;
      claimSafetyOverride?: import('./types').ClaimSafetyVerdictRecord;
    }
  ): boolean {
    const content = dbService.getContentById(contentId);
    if (!content) return false;

    const user = authService.getCurrentUser();
    if (!user) {
      this.showToast('Sesión requerida para avanzar contenido.', 'warning');
      return false;
    }

    // Compatibility projection may be refreshed by callers; never used as authority.
    void options?.claimSafetyOverride;
    void options?.reviewAcknowledged;
    void options?.requireReviewAck;
    void content.claimSafety;

    const canonical = authorizeContentPublicationGate({
      contentId: content.id,
      organizationId: content.organizationId,
      clientId: content.clientId,
      targetStatus: legacyStatus,
      actorId: user.uid,
      actorRole: user.role,
      now: new Date().toISOString(),
    });

    const gate = assertClaimSafeTransition(content.status, legacyStatus, content.claimSafety, {
      canonical: {
        allowed: canonical.allowed,
        reason: canonical.reason,
        reasonCode: canonical.reasonCode,
      },
    });
    if (!gate.allowed) {
      this.showToast(gate.reason || 'Claim publication gate blocks advancement', 'warning');
      return false;
    }

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

  /**
   * Persists draft (non-gated) then advances only if AuthorizePublication allows.
   * ContentItem.claimSafety is COMPATIBILITY_ONLY advisory projection.
   * SPEC-003 strategicBriefId / version / evidence refs on content are preserved.
   */
  private saveContentWithClaimGate(
    content: import('./types').ContentItem,
    targetStatus: ContentStatus,
    comment?: string
  ): boolean {
    const thesis = dbService.getThesesByClient(content.clientId).find((t) => t.id === content.thesisId);
    if (!thesis) {
      this.showToast('No se encontró la tesis asociada al contenido.', 'warning');
      return false;
    }
    // Advisory projection for UI — not publication authority.
    const claimSafety = aiService.reviewDraftClaims(content.body, thesis);
    const now = new Date().toISOString();

    // Non-gated draft persist first (preserves Brief traceability fields on content).
    dbService.saveContent({
      ...content,
      claimSafety,
      status: 'AI_GENERATED',
      createdAt: content.createdAt || now,
      updatedAt: now,
      strategicBriefId: content.strategicBriefId,
      strategicBriefVersion: content.strategicBriefVersion,
      signalIds: content.signalIds,
      supportingEvidenceIds: content.supportingEvidenceIds,
    });

    // Authorize BEFORE gated side effect.
    return this.syncContentToPipelineStatus(content.id, targetStatus, comment, {
      claimSafetyOverride: claimSafety,
    });
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

    notifyManager(content.clientId, {
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

    notifyManager(content.clientId, {
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

  private bindClaimLocate(root: ParentNode = document) {
    root.querySelectorAll('[data-claim-locate]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const claim = (e.currentTarget as HTMLElement).getAttribute('data-claim-locate') || '';
        const body = document.getElementById('edit-content-body') as HTMLTextAreaElement | null;
        if (!body || !claim) return;
        const idx = body.value.indexOf(claim);
        if (idx < 0) {
          this.showToast('No se encontró la frase en el borrador actual', 'info');
          return;
        }
        body.focus();
        body.setSelectionRange(idx, idx + claim.length);
      });
    });
  }

  private refreshClaimSafetyLive() {
    const form = document.getElementById('form-edit-content');
    const host = document.getElementById('claim-safety-live');
    const body = document.getElementById('edit-content-body') as HTMLTextAreaElement | null;
    if (!form || !host || !body) return;

    const clientId = form.getAttribute('data-client-id') || this.resolveClientId();
    const thesisId = form.getAttribute('data-thesis-id') || '';
    const thesis = dbService.resolveThesisFor({
      clientId,
      selectedThesisId: thesisId || this.filterState.thesisId,
    });
    if (!thesis) return;

    const record = aiService.reviewDraftClaims(body.value, thesis);
    host.innerHTML = renderClaimSafetyPanel(record);
    this.bindClaimLocate(host);

    const ackRow = document.getElementById('claim-review-ack-row');
    ackRow?.classList.toggle('hidden', record.verdict !== 'REVIEW');
    if (record.verdict !== 'REVIEW') {
      const ack = document.getElementById('claim-review-ack') as HTMLInputElement | null;
      if (ack) ack.checked = false;
    }
  }

  private bindClaimSafetyLive() {
    const body = document.getElementById('edit-content-body') as HTMLTextAreaElement | null;
    if (!body) return;
    body.addEventListener('input', () => {
      if (this.claimLiveTimer) window.clearTimeout(this.claimLiveTimer);
      this.claimLiveTimer = window.setTimeout(() => this.refreshClaimSafetyLive(), 500);
    });
  }

  /** Ejecuta una acción del pipeline canónico (finalizar → QA → listo → publicar). */
  private runContentPipelineAction(contentId: string, action: ContentPipelineAction): boolean {
    const content = dbService.getContentById(contentId);
    if (!content) return false;

    const targetPipeline = pipelineActionTarget(action);
    const targetLegacy = syncLegacyStatusFromPipeline(targetPipeline);

    if (action === 'mark_ready' || action === 'publish') {
      const user = authService.getCurrentUser();
      if (!user) {
        this.showToast('Sesión requerida para avanzar contenido.', 'warning');
        return false;
      }
      const canonical = authorizeContentPublicationGate({
        contentId: content.id,
        organizationId: content.organizationId,
        clientId: content.clientId,
        targetStatus: targetLegacy,
        actorId: user.uid,
        actorRole: user.role,
        now: new Date().toISOString(),
      });
      const gate = assertClaimSafeTransition(content.status, targetLegacy, content.claimSafety, {
        canonical: {
          allowed: canonical.allowed,
          reason: canonical.reason,
          reasonCode: canonical.reasonCode,
        },
      });
      if (!gate.allowed) {
        this.showToast(gate.reason || 'Claim publication gate blocks advancement', 'warning');
        return false;
      }
    }

    const comment = PIPELINE_ACTION_LABELS[action];
    if (!this.advanceContentPipelineTarget(contentId, targetPipeline, comment)) {
      return false;
    }

    const user = authService.getCurrentUser();
    if (action === 'publish') {
      auditService.log(user, 'CONTENT_PUBLISHED', 'ContentItem', contentId, { title: content.title });
      notifyClient(content.clientId, {
        type: 'CONTENT_REVIEW',
        title: 'Contenido publicado',
        body: `«${content.title}» ya está en tu biblioteca.`,
        href: 'client-content',
        targetId: contentId,
      });
      this.showToast('Contenido publicado', 'success');
    } else {
      this.showToast(comment, 'success');
    }
    this.render();
    return true;
  }

  private bindContent() {
    document.querySelectorAll('.btn-open-generate-content').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const clientId = target.getAttribute('data-client-id') || this.resolveClientId();
        this.activeModal = 'generate-content';
        this.modalData = {
          clientId,
          thesisId: target.getAttribute('data-thesis-id') || this.filterState.thesisId || undefined,
          topic: target.getAttribute('data-topic') || undefined,
        };
        this.render();
      });
    });

    ['btn-close-generate-content', 'btn-cancel-generate-content'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => this.closeModal());
    });

    const formGenerate = document.getElementById('form-generate-content');
    formGenerate?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const clientId = formGenerate.getAttribute('data-client-id') || this.resolveClientId();
      const briefId = (document.getElementById('generate-strategic-brief') as HTMLSelectElement | null)?.value;
      const gate = this.gateStrategicDownstream(clientId, briefId, 'CREATE_CONTENT');
      if (!gate.ok) {
        this.showToast(gate.message, 'warning');
        return;
      }
      const thesis = dbService.getThesisById(clientId, gate.thesisId);
      if (!thesis) {
        this.showToast('Approved Brief thesis not found.', 'warning');
        return;
      }

      const topic = (document.getElementById('generate-topic') as HTMLTextAreaElement | null)?.value.trim() || '';
      if (!topic) {
        this.showToast('Indica el tema del borrador.', 'warning');
        return;
      }

      const format = ((document.getElementById('generate-format') as HTMLSelectElement | null)?.value ||
        'LINKEDIN_ARTICLE') as 'VIDEO_SCRIPT' | 'LINKEDIN_ARTICLE' | 'ACADEMIC_PAPER' | 'THOUGHT_LEADERSHIP';
      const angle = (document.getElementById('generate-angle') as HTMLInputElement | null)?.value.trim();
      const submit = formGenerate.querySelector('button[type="submit"]') as HTMLButtonElement | null;
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Redactando…';
      }
      try {
        const draft = await aiService.generateContentDraft(thesis, topic, format, angle ? { angle } : undefined);
        const contentId = createId('cnt');
        dbService.saveContent({
          ...draft,
          id: contentId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          strategicBriefId: gate.briefId,
          strategicBriefVersion: gate.version,
          signalIds: gate.signalIds,
          supportingEvidenceIds: gate.evidenceIds,
        });
        this.syncContentToPipelineStatus(contentId, draft.status);
        this.showToast('Borrador creado. Revísalo antes de enviarlo al cliente.', 'success');
        this.closeModal();
      } catch (error) {
        this.showToast(error instanceof Error ? error.message : 'No se pudo generar el borrador', 'warning');
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'Redactar borrador';
        }
      }
    });

    document.querySelectorAll('.btn-generate-scientific-article').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const clientId = target.getAttribute('data-client-id') || this.resolveClientId();
        const topic = target.getAttribute('data-sci-title') || '';
        const why = target.getAttribute('data-sci-why') || '';
        const venue = target.getAttribute('data-sci-venue') || 'Working paper';
        const role = target.getAttribute('data-sci-role') || '';
        const approved = listStrategicBriefs(clientId).filter(
          (b) =>
            b.status === 'APPROVED' &&
            !b.supersededByBriefId &&
            b.decision.authorizedAction === 'CREATE_CONTENT'
        );
        const thesisFilter = this.filterState.thesisId;
        const scoped = thesisFilter
          ? approved.filter((b) => b.thesisId === thesisFilter)
          : approved;
        // No first-match planner authority — require explicit unique Brief.
        if (scoped.length !== 1) {
          this.showToast(
            scoped.length === 0
              ? 'No approved CREATE_CONTENT Strategic Brief for this context.'
              : 'Multiple approved Briefs match — select an explicit thesis/Brief before generating.',
            'warning'
          );
          return;
        }
        const brief = scoped[0];
        const gate = this.gateStrategicDownstream(clientId, brief.id, 'CREATE_CONTENT');
        if (!gate.ok) {
          this.showToast(gate.message, 'warning');
          return;
        }
        const thesis = dbService.getThesisById(clientId, gate.thesisId);
        if (!thesis) {
          this.showToast('Approved Brief thesis not found.', 'warning');
          return;
        }
        if (!topic.trim()) return;
        target.disabled = true;
        target.textContent = 'Redactando…';
        try {
          const draft = await aiService.generateContentDraft(thesis, topic.trim(), 'ACADEMIC_PAPER', {
            roleAngle: role,
            venueLabel: venue,
            why,
          });
          const contentId = createId('cnt');
          dbService.saveContent({
            ...draft,
            id: contentId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            strategicBriefId: gate.briefId,
            strategicBriefVersion: gate.version,
            signalIds: gate.signalIds,
            supportingEvidenceIds: gate.evidenceIds,
          });
          this.syncContentToPipelineStatus(contentId, draft.status);
          this.showToast('Borrador científico creado. Revísalo: no publiques citas no verificadas.', 'success');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'No se pudo generar el paper', 'warning');
        }
        this.render();
      });
    });

    document.querySelectorAll('.btn-open-content-editor').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (authService.getCurrentUser()?.role !== 'ADMIN') {
          this.showToast('Solo el Brand Manager puede abrir el editor de producción.', 'warning');
          return;
        }
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

    document.querySelectorAll('.btn-content-pipeline-action').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const contentId = el.getAttribute('data-content-id');
        const action = el.getAttribute('data-pipeline-action') as ContentPipelineAction | null;
        if (!contentId || !action) return;
        this.runContentPipelineAction(contentId, action);
      });
    });

    document.querySelectorAll('.btn-open-article-review').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const contentId = el.getAttribute('data-content-id');
        const taskId = el.getAttribute('data-task-id') || undefined;
        if (!contentId) return;
        if (taskId) {
          const task = dbService.getAllTasks().find((t) => t.id === taskId);
          if (task) this.markArticleReviewStarted(task, contentId);
        }
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
      if (content && event) {
        const steps = resolveArticleSavePipelineSteps(content);
        const actor = this.pipelineActor();
        for (const step of steps) {
          dbService.transitionContentPipeline(contentId, step, actor, 'Cliente editando borrador');
        }
        notifyManager(content.clientId, {
          type: 'CONTENT_REVIEW',
          title: 'Cliente editó borrador',
          body: `«${content.title}»: +${event.diffSummary?.added ?? 0}/−${event.diffSummary?.removed ?? 0} líneas`,
          href: 'ws-production',
          targetId: contentId,
        });
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
      const targetStatus = (document.getElementById('edit-content-status') as HTMLSelectElement).value as typeof content.status;

      // El texto pudo cambiar en este mismo formulario, así que se re-evalúa antes de avanzar.
      const thesis = dbService.getThesesByClient(content.clientId).find((t) => t.id === content.thesisId);
      if (!thesis) {
        this.showToast('No se encontró la tesis asociada al contenido.', 'warning');
        return;
      }
      const claimSafety = aiService.reviewDraftClaims(body, thesis);

      // Guarda el trabajo del manager aunque el avance se frene.
      dbService.saveContent({
        ...content,
        title: (document.getElementById('edit-content-title') as HTMLInputElement).value,
        targetPlatform: (document.getElementById('edit-content-platform') as HTMLSelectElement).value as typeof content.targetPlatform,
        type,
        body,
        teleprompterScript: type === 'VIDEO_SCRIPT' ? body : content.teleprompterScript,
        managerNotes: (document.getElementById('edit-content-notes') as HTMLInputElement).value,
        claimSafety,
        updatedAt: new Date().toISOString(),
      });

      if (targetStatus !== content.status) {
        const advanced = this.syncContentToPipelineStatus(content.id, targetStatus, undefined, {
          claimSafetyOverride: claimSafety,
          requireReviewAck: true,
          reviewAcknowledged: (document.getElementById('claim-review-ack') as HTMLInputElement | null)?.checked,
        });
        if (!advanced) {
          this.render();
          return;
        }
      }

      auditService.log(authService.getCurrentUser(), 'EDIT_CONTENT', 'ContentItem', content.id, {
        status: targetStatus,
      });
      this.showToast('Cambios guardados', 'success');
      this.closeModal();
    });

    document.querySelectorAll('.btn-comparative-signal').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const signalId = target.getAttribute('data-signal-id');
        const signal = signalId ? dbService.getSignalById(signalId) : null;
        const clientId = this.resolveClientId(signal?.clientId);
        const thesis = signal
          ? dbService.resolveThesisFor({
              clientId,
              selectedThesisId: this.filterState.thesisId,
              entityThesisId: signal.thesisId,
            })
          : undefined;
        if (!signal || !thesis) {
          this.showToast('Selecciona una tesis válida antes del análisis comparativo.', 'warning');
          return;
        }

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

        const brief =
          (rec.signalId
            ? findApprovedBriefForSignal({
                clientId: rec.clientId,
                signalId: rec.signalId,
                action: 'CREATE_TASK',
              })
            : undefined) ??
          (() => {
            const matches = listStrategicBriefs(rec.clientId).filter(
              (b) =>
                b.status === 'APPROVED' &&
                !b.supersededByBriefId &&
                b.decision.authorizedAction === 'CREATE_TASK' &&
                b.thesisId === rec.thesisId
            );
            // Fail closed on multi-Brief ambiguity — no first-match authority.
            return matches.length === 1 ? matches[0] : undefined;
          })();
        const gate = this.gateStrategicDownstream(rec.clientId, brief?.id, 'CREATE_TASK');
        if (!gate.ok) {
          this.showToast(gate.message, 'warning');
          return;
        }
        const thesis = dbService.getThesisById(rec.clientId, gate.thesisId);
        if (!thesis) {
          this.showToast('Approved Brief thesis not found.', 'warning');
          return;
        }

        const draft = await aiService.generateContentDraft(thesis, rec.proposedAngle, 'VIDEO_SCRIPT');
        const contentId = createId('cnt');
        const advanced = this.saveContentWithClaimGate(
          {
            ...draft,
            id: contentId,
            status: 'AI_GENERATED',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            strategicBriefId: gate.briefId,
            strategicBriefVersion: gate.version,
            signalIds: gate.signalIds,
            supportingEvidenceIds: gate.evidenceIds,
          },
          'CLIENT_REVIEW',
          'Tarea desde recomendación'
        );
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
          strategicBriefId: gate.briefId,
          strategicBriefVersion: gate.version,
          signalId: gate.signalIds[0] ?? rec.signalId,
        });
        dbService.updateRecommendationStatus(rec.id, 'CONVERTED_TO_TASK');
        this.showToast(
          advanced
            ? 'Guion y tarea generados'
            : 'Tarea creada; el guion quedó en borrador por Claim Safety',
          advanced ? 'success' : 'warning'
        );
        this.setTab('ws-production');
      });
    });

    document.querySelectorAll('.btn-add-evidence-vault').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id') || this.resolveClientId();
        this.activeModal = 'add-evidence';
        this.modalData = { clientId };
        this.render();
      });
    });

    ['btn-close-evidence', 'btn-cancel-evidence'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => this.closeModal());
    });

    const formAddEvidence = document.getElementById('form-add-evidence');
    formAddEvidence?.addEventListener('submit', (e) => {
      e.preventDefault();
      const clientId = formAddEvidence.getAttribute('data-client-id') || this.resolveClientId();
      const title = (document.getElementById('evidence-title') as HTMLInputElement).value;
      const supports = (document.getElementById('evidence-supports') as HTMLTextAreaElement | null)
        ?.value.split('\n').map((line) => line.trim()).filter(Boolean) || [];
      const authorityRaw = Number.parseInt(
        (document.getElementById('evidence-authority-weight') as HTMLInputElement | null)?.value || '70',
        10
      );
      const associatedThesesIds = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[name="evidence-thesis"]:checked')
      ).map((input) => input.value);
      if (!associatedThesesIds.length && this.filterState.thesisId) {
        associatedThesesIds.push(this.filterState.thesisId);
      }

      const organizationId = this.resolveOrganizationId(clientId);
      if (!organizationId) {
        this.showToast('Cliente sin organizationId — no se puede registrar evidencia', 'warning');
        return;
      }

      dbService.addEvidenceItem({
        organizationId,
        clientId,
        title,
        type: (document.getElementById('evidence-type') as HTMLSelectElement).value as never,
        confidenceScore: parseInt((document.getElementById('evidence-confidence') as HTMLInputElement).value || '95', 10),
        sourceUrl: (document.getElementById('evidence-url') as HTMLInputElement).value || undefined,
        snippet: (document.getElementById('evidence-snippet') as HTMLTextAreaElement).value,
        verified: true,
        verifiedAt: new Date().toISOString(),
        associatedThesesIds,
        supports: supports.length ? supports : undefined,
        authorityWeight: Number.isFinite(authorityRaw) ? Math.max(0, Math.min(100, authorityRaw)) : undefined,
      });

      auditService.log(authService.getCurrentUser(), 'ADD_EVIDENCE_ITEM', 'EvidenceVault', title);
      this.showToast('Evidencia registrada', 'success');
      this.closeModal();
    });

    this.bindClaimLocate();
    this.bindClaimSafetyLive();
  }

  // ==========================================
  // Acciones del portal del cliente
  // ==========================================

  private bindClientPortalActions() {
    document.querySelectorAll('[data-client-thesis-select]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.filterState.thesisId = (e.currentTarget as HTMLElement).getAttribute('data-client-thesis-select') || '';
        this.setTab('client-thesis');
      });
    });

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
        const clientId = authService.getCurrentUser()?.clientId || this.resolveClientId();
        if (!clientId) {
          this.showToast('Cliente no resuelto — no se puede declinar la oportunidad', 'warning');
          return;
        }
        try {
          declineClientOpportunity({
            clientId,
            opportunityId: targetId,
            notes,
          });
          this.showToast('Oportunidad descartada con tus observaciones', 'info');
        } catch (err) {
          const message =
            err instanceof OpportunityApplicationError
              ? err.message
              : 'No se pudo declinar la oportunidad';
          this.showToast(message, 'warning');
          return;
        }
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
        const organizationId = this.resolveOrganizationId(task?.clientId);
        if (!organizationId || !task?.clientId) {
          this.showToast('Cliente sin organizationId — no se puede subir el video', 'warning');
          return;
        }
        const ref = await persistRecording(
          organizationId,
          task.clientId,
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
        const clientId = authService.getCurrentUser()?.clientId || this.resolveClientId();
        if (!clientId) {
          this.showToast('Cliente no resuelto — no se puede aceptar la oportunidad', 'warning');
          return;
        }
        try {
          const opp = acceptClientOpportunity({
            clientId,
            opportunityId: oppId,
            notes: 'Aceptado con disponibilidad completa.',
          });
          notifyManager(opp.clientId, {
            type: 'OPPORTUNITY',
            title: 'Oportunidad aceptada',
            body: `«${opp.title}» — el cliente completará el checklist de postulación.`,
            href: 'ws-briefing',
          });
          this.showToast('Oportunidad aceptada. Completa el checklist de postulación.', 'success');
          this.render();
        } catch (err) {
          const message =
            err instanceof OpportunityApplicationError
              ? err.message
              : 'No se pudo aceptar la oportunidad';
          this.showToast(message, 'warning');
        }
      });
    });

    document.querySelectorAll('.input-opp-checklist').forEach((input) => {
      input.addEventListener('change', (e) => {
        const el = e.currentTarget as HTMLInputElement;
        const oppId = el.getAttribute('data-opp-id');
        const itemId = el.getAttribute('data-item-id');
        if (!oppId || !itemId) return;
        const clientId = authService.getCurrentUser()?.clientId || this.resolveClientId();
        if (!clientId) {
          this.showToast('Cliente no resuelto', 'warning');
          return;
        }
        try {
          toggleClientOpportunityChecklistItem({
            clientId,
            opportunityId: oppId,
            itemId,
            done: el.checked,
          });
          this.render();
        } catch (err) {
          const message =
            err instanceof OpportunityApplicationError
              ? err.message
              : 'No se pudo actualizar el checklist';
          this.showToast(message, 'warning');
        }
      });
    });

    document.querySelectorAll('.btn-submit-opportunity').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const oppId = (e.currentTarget as HTMLElement).getAttribute('data-opp-id');
        if (!oppId) return;
        const clientId = authService.getCurrentUser()?.clientId || this.resolveClientId();
        if (!clientId) {
          this.showToast('Cliente no resuelto', 'warning');
          return;
        }
        try {
          const opp = submitClientOpportunity({
            clientId,
            opportunityId: oppId,
          });
          notifyManager(opp.clientId, {
            type: 'OPPORTUNITY',
            title: 'Postulación enviada',
            body: `«${opp.title}» — el cliente marcó la postulación como enviada.`,
            href: 'ws-briefing',
          });
          this.showToast('Postulación marcada como enviada. Tu Brand Manager fue notificado.', 'success');
          this.render();
        } catch (err) {
          const message =
            err instanceof OpportunityApplicationError
              ? err.message
              : 'Completa todos los ítems del checklist antes de enviar.';
          this.showToast(message, 'warning');
        }
      });
    });

    document.querySelectorAll('.btn-approve-thesis').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const thesisId = (e.currentTarget as HTMLElement).getAttribute('data-thesis-id');
        const clientId = authService.getCurrentUser()?.clientId || this.resolveClientId();
        const thesis = dbService.getThesesByClient(clientId).find((t) => t.id === thesisId);
        if (!thesis) return;
        const actor = authService.getCurrentUser()?.uid || thesis.updatedBy;
        const result = approveThesisByClient(
          { ...thesis, updatedAt: new Date().toISOString(), updatedBy: actor },
          actor
        );
        dbService.saveThesis(result.thesis);
        auditService.log(authService.getCurrentUser(), 'THESIS_CLIENT_APPROVED', 'PositioningThesis', thesis.id, {
          clientId,
        });
        if (result.awaitsManagerActivation) {
          notifyManager(clientId, {
            type: 'THESIS',
            title: 'Tesis aprobada por el cliente',
            body: `«${thesis.title}» — puedes activarla en Identidad.`,
            href: 'ws-positioning',
          });
          this.showToast('Tesis aprobada. Tu Brand Manager la activará.', 'success');
        } else {
          this.showToast(
            result.appliedRevision
              ? 'Revisión aplicada. La tesis activa queda actualizada.'
              : 'Tesis aprobada.',
            'success'
          );
        }
        this.render();
      });
    });

    document.querySelectorAll('.btn-request-thesis-changes').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const thesisId = (e.currentTarget as HTMLElement).getAttribute('data-thesis-id');
        const clientId = authService.getCurrentUser()?.clientId || this.resolveClientId();
        const thesis = dbService.getThesesByClient(clientId).find((t) => t.id === thesisId);
        if (!thesis) return;
        const feedback =
          (document.getElementById('thesis-change-notes') as HTMLTextAreaElement | null)?.value.trim() || undefined;
        const actor = authService.getCurrentUser()?.uid || thesis.updatedBy;
        dbService.saveThesis(
          rejectThesisByClient(
            { ...thesis, updatedAt: new Date().toISOString(), updatedBy: actor },
            feedback,
            actor
          )
        );
        notifyManager(clientId, {
          type: 'THESIS',
          title: 'Cambios solicitados en la tesis',
          body: feedback
            ? `«${thesis.title}»: ${feedback.slice(0, 120)}`
            : `El cliente pidió ajustes en «${thesis.title}».`,
          href: 'ws-positioning',
        });
        auditService.log(authService.getCurrentUser(), 'THESIS_CHANGES_REQUESTED', 'PositioningThesis', thesis.id, {
          clientId,
        });
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
      const organizationId = this.resolveOrganizationId(clientId);
      if (!organizationId) {
        this.showToast('Cliente sin organizationId — no se puede registrar el resultado', 'warning');
        return;
      }
      try {
        registerResultRecordIntent({
          clientId,
          title: (document.getElementById('result-title') as HTMLInputElement).value,
          channel: (document.getElementById('result-channel') as HTMLInputElement).value,
          metricLabel: (document.getElementById('result-metric-label') as HTMLInputElement).value,
          metricValue: Number((document.getElementById('result-metric-value') as HTMLInputElement).value || 0),
          kpiType: (document.getElementById('result-kpi-type') as HTMLSelectElement).value as BusinessKpiType,
        });
      } catch (error) {
        this.showToast(
          error instanceof Error ? error.message : 'No se pudo registrar el resultado',
          'warning'
        );
        return;
      }
      this.showToast('Resultado registrado', 'success');
      this.render();
    });

    document.getElementById('form-quick-kpi-consultation')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const clientId = form.getAttribute('data-client-id') || authService.getCurrentUser()?.clientId || '';
      const organizationId = this.resolveOrganizationId(clientId);
      if (!organizationId) {
        this.showToast('Cliente sin organizationId — no se puede registrar la consulta', 'warning');
        return;
      }
      const note = (document.getElementById('quick-kpi-note') as HTMLInputElement).value.trim();
      try {
        registerResultRecordIntent({
          clientId,
          title: note ? `Consulta: ${note}` : 'Consulta recibida',
          channel: 'LinkedIn / Web',
          metricLabel: 'Consultas recibidas',
          metricValue: 1,
          kpiType: 'consultation_requests',
          notes: note || undefined,
        });
      } catch (error) {
        this.showToast(
          error instanceof Error ? error.message : 'No se pudo registrar la consulta',
          'warning'
        );
        return;
      }
      this.showToast('Consulta registrada — dashboard actualizado', 'success');
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

  private markVideoCaptureStarted(task: import('./types').Task) {
    if (task.status === 'ASSIGNED' || task.status === 'VIEWED' || task.status === 'DRAFT') {
      try {
        dbService.updateTaskStatus(task.id, 'IN_PROGRESS');
      } catch {
        /* ya avanzada */
      }
    }
    if (task.contentItemId) {
      this.advanceContentPipelineTarget(task.contentItemId, 'client_in_progress', 'Cliente en teleprompter');
    }
  }

  private markArticleReviewStarted(task: import('./types').Task, contentId: string): void {
    if (task.status === 'ASSIGNED' || task.status === 'VIEWED' || task.status === 'DRAFT') {
      try {
        dbService.updateTaskStatus(task.id, 'IN_PROGRESS');
      } catch {
        /* ya avanzada */
      }
    }
    const content = dbService.getContentById(contentId);
    if (!content) return;
    const steps = resolveArticleSavePipelineSteps(content);
    const actor = this.pipelineActor();
    for (const step of steps) {
      dbService.transitionContentPipeline(contentId, step, actor, 'Cliente revisando borrador');
    }
  }

  private async startRecording() {
    const taskId = this.modalData?.taskId as string | undefined;
    if (taskId) {
      const task = dbService.getAllTasks().find((t) => t.id === taskId);
      if (task) this.markVideoCaptureStarted(task);
    }

    if (!this.cameraStream) {
      await this.initTeleprompterCamera();
    }
    if (!this.cameraStream) return;

    this.recordedChunks = [];
    this.previewBlob = null;
    this.revokePreviewUrl();

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : undefined;
      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: RECORDING_VIDEO_BITS_PER_SECOND,
      };
      if (mimeType) recorderOptions.mimeType = mimeType;
      this.mediaRecorder = new MediaRecorder(this.cameraStream, recorderOptions);
    } catch {
      this.showToast('Tu navegador no soporta grabación de video aquí', 'warning');
      return;
    }

    this.mediaRecorder.ondataavailable = (ev) => {
      if (ev.data.size) this.recordedChunks.push(ev.data);
    };

    this.mediaRecorder.start(1000);
    if (this.recordingLimitTimer) window.clearTimeout(this.recordingLimitTimer);
    this.recordingLimitTimer = window.setTimeout(() => {
      void this.stopRecordingToPreview();
      this.showToast('Grabación detenida: máximo 10 minutos', 'warning');
    }, MAX_RECORDING_DURATION_MS);

    document.getElementById('btn-start-recording')?.classList.add('hidden');
    document.getElementById('btn-stop-recording')?.classList.remove('hidden');
    document.getElementById('teleprompter-recording-indicator')?.classList.remove('hidden');
    this.showToast('Grabando… (máx. 10 min)', 'info');
  }

  private async stopRecordingToPreview() {
    if (this.recordingLimitTimer) {
      window.clearTimeout(this.recordingLimitTimer);
      this.recordingLimitTimer = null;
    }

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
    const sendBtn = document.getElementById('btn-confirm-send-recording') as HTMLButtonElement | null;
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Enviando…';
    }
    try {
      await this.submitClientVideo(taskId, this.previewBlob);
      this.stopTeleprompter();
      this.closeModal();
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : 'No se pudo enviar el video', 'warning');
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Enviar video al manager';
      }
    }
  }

  private async submitClientVideo(taskId: string, blob: Blob) {
    const task = dbService.getAllTasks().find((t) => t.id === taskId);
    const client = task ? dbService.getClientById(task.clientId) : undefined;
    const organizationId = this.resolveOrganizationId(task?.clientId);
    if (!organizationId || !task?.clientId) {
      throw new Error('Cliente sin organizationId — no se puede enviar el video');
    }
    const ref = await persistRecording(
      organizationId,
      task.clientId,
      taskId,
      blob
    );
    dbService.updateTaskStatus(taskId, 'COMPLETED', ref, 'Video enviado desde el teleprompter.');
    if (task?.contentItemId) {
      this.advanceContentPipelineTarget(
        task.contentItemId,
        VIDEO_SUBMIT_PIPELINE_TARGET,
        'Video enviado por cliente'
      );
    }

    if (task?.clientId) {
      notifyManager(task.clientId, {
        type: 'CONTENT_REVIEW',
        title: 'Video recibido del cliente',
        body: client
          ? `${client.displayName} envió la grabación «${task.title || 'sin título'}».`
          : 'El cliente envió una nueva grabación de video.',
        href: 'ws-production',
        targetId: taskId,
      });
    }

    auditService.log(authService.getCurrentUser(), 'VIDEO_SUBMITTED', 'Task', taskId, {
      bytes: blob.size,
      contentId: task?.contentItemId,
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
      const lastRun = loadLastAgentRun(client.id);
      const profileChanged = profileChangedSinceLastRun(client, undefined, lastRun);
      const run = profileChanged
        ? await runSourceDiscoveryAgentAsync(client, undefined)
        : runSourceDiscoveryAgent(client, undefined);
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
    // AUDIT010-11: el scheduler caía en `getClients()[0]` cuando no había
    // workspace activo, ingiriendo para un tenant elegido por posición. Sin
    // scope explícito no se ingiere: el tick espera al siguiente ciclo.
    const scoped =
      isWorkspaceTab(this.activeTab) && this.activeClientId !== 'all'
        ? this.activeClientId
        : '';
    const grant = this.requireTenant(scoped);
    if (!grant.ok) return;
    const clientId = grant.clientId;

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
      (s) => s.url && s.status !== 'ARCHIVED' && s.status !== 'PAUSED'
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
    return buildMergedProfileKeywords(client, dbService.getActiveTheses(client.id));
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

      const organizationId =
        source.organizationId?.trim() || this.resolveOrganizationId(clientId) || '';
      if (!organizationId) {
        rejected += 1;
        continue;
      }
      const result = dbService.addSignal({
        organizationId,
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
      accepted += 1;
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

if (import.meta.env.DEV) {
  (window as unknown as { posturaReseedLocal?: () => void }).posturaReseedLocal = () => {
    dbService.resetLocalDemoAndReload();
  };
}

new App();

// SPEC-010 strangler mount seam. Owns #react-root only; never touches #app.
// Defaults to the legacy presentation, so React is not loaded unless requested.
exposeStranglerControls();
void initReactStrangler();
