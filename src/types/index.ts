/**
 * POSTURA — Positioning Intelligence & Management System
 * Official Domain & Persistence Contracts (F1 to F9)
 */

export interface TransversalEntity {
  id?: string;
  organizationId: string;
  clientId?: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  status: string;
  archivedAt?: string | null;
  archivedBy?: string | null;
}

export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  defaultLocale: string;
  defaultTimezone: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  archivedAt?: string | null;
  archivedBy?: string | null;
}

export type UserRole = 'ADMIN' | 'CLIENT';
export type UserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export interface User {
  uid: string;
  organizationId: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  clientId?: string | null;
  managerId?: string | null;
  mustCompleteOnboarding: boolean;
  aiKeyManagementAllowed: boolean;
  locale: string;
  timezone: string;
  lastLoginAt?: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  archivedAt?: string | null;
  archivedBy?: string | null;
  avatarUrl?: string;
}

export type ClientOnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type ClientOperationalStatus = 'DRAFT' | 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export interface Client {
  id: string;
  organizationId: string;
  primaryManagerId: string;
  userId?: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  primaryEmail: string;
  profession?: string;
  company?: string;
  country?: string;
  targetMarket?: string;
  onboardingStatus: ClientOnboardingStatus;
  profileCompleteness?: number;
  status: ClientOperationalStatus;
  internalNotes?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  archivedAt?: string | null;
  archivedBy?: string | null;
  avatarUrl?: string;
  activeThesesCount: number;
  completedTasksCount: number;
}

export interface ClientProfile {
  organizationId: string;
  clientId: string;
  identity: {
    professionalHeadline?: string;
    shortBio?: string;
    longBio?: string;
    location?: string;
    languages?: string[];
    selfDescription?: string; // F7-D07
  };
  goals: {
    primaryGoal?: string;      // F7-D07
    secondaryGoals?: string[];
  };
  audience: {
    targetAudienceDescription?: string;
    targetIndustries?: string[];
    targetCountries?: string[];
  };
  career: {
    profession?: string;
    currentRole?: string;
    currentCompany?: string;
    yearsExperience?: number;
    industries?: string[];
  };
  education: Array<{
    institution: string;
    degree: string;
    year?: string;
  }>;
  careerHistory: Array<{
    role: string;
    organization: string;
    period: string;
    highlight: string;
  }>;
  ventures: string[];
  keyPublications: Array<{
    title: string;
    outlet: string;
    url?: string;
  }>;
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    website?: string;
    youtube?: string;
  };
  voicePreferences: {
    tone: 'authoritative' | 'conversational' | 'academic' | 'provocative' | 'approachable';
    preferredPhrases: string[];
    topicsToAvoid: string[];
    complianceGuidelines: string;
  };
  /** Facts estructurados confirmados o candidatos (desde onboarding, CV o edición manual). */
  facts?: ProfileFact[];
  cvExtractedText?: string;
  onboardingCompleted: boolean;
  onboardingCurrentStep?: number;
  updatedAt: string;
}

export type ProfileFactSection =
  | 'identity'
  | 'career'
  | 'education'
  | 'credentials'
  | 'publications'
  | 'institutions'
  | 'digital'
  | 'voice'
  | 'services';

export type ProfileFactStatus = 'confirmed' | 'candidate' | 'rejected';

export interface ProfileFact {
  id: string;
  section: ProfileFactSection;
  label: string;
  value: string;
  status: ProfileFactStatus;
  source?: 'onboarding' | 'cv' | 'manual' | 'manager';
  createdAt: string;
  updatedAt: string;
}

export interface ProofWallItem {
  id: string;
  organizationId: string;
  clientId: string;
  category: string;
  title: string;
  description?: string;
  status: 'complete' | 'pending';
  sourceUrl?: string;
  evidenceId?: string;
  sortOrder: number;
}

export type ThesisStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'ACTIVE'
  | 'PAUSED'
  | 'ARCHIVED'
  | 'LEGACY';
export type ThesisApprovalStatus = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';

/**
 * Nivel de una audiencia: quién compra, quién abre puertas y quién amplifica.
 * El scoring pondera distinto cada nivel.
 */
export type AudienceTier = 'COMMERCIAL' | 'INFLUENCE' | 'AMPLIFICATION';

export interface ThesisAudience {
  id: string;
  name: string;
  tier: AudienceTier;
  /** 0-100. Relevancia relativa dentro de su nivel. */
  weight: number;
  keywords: string[];
}

/** Territorio temático de la tesis, con jerarquía opcional por pilar. */
export interface ThesisTerritory {
  id: string;
  name: string;
  pillar?: string;
  /** 0-100. Un territorio con peso bajo apenas mueve el score. */
  weight: number;
  keywords: string[];
}

export type ThesisObjectiveKind =
  | 'BUSINESS'
  | 'THOUGHT_LEADERSHIP'
  | 'SPEAKING'
  | 'INSTITUTIONAL'
  | 'NETWORK';

export interface ThesisObjective {
  id: string;
  kind: ThesisObjectiveKind;
  /** 0-100. El conjunto debería sumar 100. */
  weight: number;
}

/** Perfil de voz multidimensional. Cada eje es 0-100. */
export interface VoiceProfile {
  authority: number;
  technicalDepth: number;
  academic: number;
  executive: number;
  accessible: number;
  provocative: number;
  commercial: number;
  legalPrecision: number;
  humor: number;
  style?: string;
  avoid?: string[];
}

export interface ThesisLimits {
  /** Bloquean publicación: si aparecen, la acción recomendada es NO_ACTION. */
  hardBlocks: string[];
  /** Restan puntos sin descartar. */
  softAvoid: string[];
}

/** Borrador pendiente de aprobación del cliente; la tesis ACTIVE sigue operativa. */
export interface ThesisPendingRevision {
  proposed: {
    title: string;
    expertIdentity: string;
    targetAudience: string;
    secondaryAudience?: string;
    domain: string;
    objective: string;
    proofPoints: string[];
    differentiator?: string;
    voiceAndTone: string;
    complianceRules: string;
    identityCurrent?: string;
    perceptionTarget?: string;
    audiences?: ThesisAudience[];
    territories?: ThesisTerritory[];
    objectives?: ThesisObjective[];
    voiceProfile?: VoiceProfile;
    limits?: ThesisLimits;
    priority?: number;
  };
  createdAt: string;
  createdBy: string;
  note?: string;
}

export type ThesisEditableFields = ThesisPendingRevision['proposed'];

export interface PositioningThesis {
  id: string;
  organizationId: string;
  clientId: string;
  title: string;
  expertIdentity: string;     // ¿Quién es y qué queremos que recuerden? (F8-D08)
  targetAudience: string;     // Audiencia primaria
  secondaryAudience?: string; // Audiencias secundarias
  domain: string;             // Dominio disciplinar
  objective: string;          // Objetivo de negocio / reputación
  proofPoints: string[];      // Evidencias reales
  differentiator?: string;    // Ángulo único / perspectiva diferenciadora
  voiceAndTone: string;       // Guía de voz
  complianceRules: string;    // Límites deontológicos
  status: ThesisStatus;
  clientApprovalStatus: ThesisApprovalStatus;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  clientFeedback?: string;
  /** Cuando el cliente aprueba (FLOW-17). */
  clientApprovedAt?: string;
  /** Cuando el manager activa (FLOW-18). */
  activatedAt?: string;
  /** Identidad que el mercado ya reconoce hoy (expertIdentity es la objetivo). */
  identityCurrent?: string;
  /** Asociación mental que queremos construir. */
  perceptionTarget?: string;
  audiences?: ThesisAudience[];
  territories?: ThesisTerritory[];
  objectives?: ThesisObjective[];
  voiceProfile?: VoiceProfile;
  limits?: ThesisLimits;
  /** Desempate cuando varias tesis están activas. Mayor gana. */
  priority?: number;
  /** Cambios propuestos que aún no sustituyen la versión ACTIVE. */
  pendingRevision?: ThesisPendingRevision | null;
}

export type SourceType = 'RSS' | 'WEB' | 'API' | 'REGULATORY' | 'ACADEMIC' | 'BLOG' | 'MEDIA' | 'MANUAL' | 'SOCIAL' | 'VIDEO' | 'OTHER';
export type SourceStatus = 'ACTIVE' | 'PAUSED' | 'ERROR' | 'ARCHIVED';

export interface Source {
  id: string;
  organizationId: string;
  clientId?: string | null;
  thesisId?: string | null;
  name: string;
  type: SourceType;
  url?: string;
  fetchIntervalMinutes: number;
  lastFetchedAt?: string;
  status: SourceStatus;
  itemCount: number;
  createdAt: string;
  createdBy: string;
  /** Diagnóstico de la última corrida de ingesta. */
  lastError?: string;
  lastRunFetched?: number;
  lastRunAccepted?: number;
  lastRunRejected?: number;
}

export interface SourceRunOutcome {
  fetched: number;
  accepted: number;
  rejected: number;
  duplicates: number;
  error?: string;
}

export type SignalSourceType = 'MANUAL' | 'RSS' | 'REGULATORY' | 'NEWS_API' | 'CLIENT_INPUT' | 'SOCIAL' | 'VIDEO' | 'ACADEMIC';
export type SignalStatus = 'NEW' | 'ANALYZED' | 'CONVERTED' | 'DISCARDED';
export type SignalAiStatus = 'PENDING_AI' | 'PROCESSING' | 'ANALYZED' | 'FAILED' | 'NOT_REQUIRED';
export type ManagerDecision = 'UNREVIEWED' | 'DISCARDED' | 'SAVED' | 'RESEARCH' | 'CONVERTED';
export type SourceQuality = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNASSESSED';
export type PriorityBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RecommendedAction =
  | 'NO_ACTION'
  | 'MONITOR'
  | 'SAVE'
  | 'RESEARCH_REQUIRED'
  | 'CREATE_TOPIC'
  | 'CREATE_OPPORTUNITY'
  | 'SHORT_POST'
  | 'ARTICLE'
  | 'VIDEO'
  | 'TASK';

/** SPEC-002 — strategic disposition (separate from output format). */
export type StrategicDisposition =
  | 'NO_ACTION'
  | 'MONITOR'
  | 'SAVE'
  | 'RESEARCH_REQUIRED'
  | 'OPPORTUNITY_CANDIDATE'
  | 'LOW_PRIORITY';

/** SPEC-002 — optional content/output format recommendation. */
export type OutputFormatRecommendation =
  | 'NONE'
  | 'VIDEO'
  | 'SHORT_POST'
  | 'ARTICLE'
  | 'LINKEDIN_POST';

export interface Signal {
  id: string;
  organizationId: string;
  clientId?: string | null;
  sourceId?: string;
  title: string;
  sourceType: SignalSourceType;
  sourceName: string;
  sourceUrl?: string;
  contentSnippet: string;
  fingerprint: string;        // F9-D09 deduplication hash
  detectedAt: string;
  status: SignalStatus;
  targetDomain?: string;
  relevanceScore?: number;
  discardReason?: string;
  aiStatus: SignalAiStatus;
  managerDecision: ManagerDecision;
  sourceQuality?: SourceQuality;
  recommendedAction?: RecommendedAction;
  priorityBand?: PriorityBand;
  /** Explicación corta del último score (para triage). */
  scoreRationale?: string;
  /** Desglose de factores/penalizaciones del último score. */
  scoreBreakdown?: {
    totalScore: number;
    factors: Array<{ key: string; label: string; points: number; weight: number }>;
    penalties: Array<{ key: string; label: string; points: number }>;
    summary: string;
  };
  /** Evidencia web encontrada por RESEARCH_SIGNALS (Tavily). */
  researchBrief?: SignalResearchBrief;
  /** Tesis primaria elegida por el router para esta señal. */
  thesisId?: string;
  /** Score de la señal contra cada tesis activa, para justificar el enrutado. */
  thesisScores?: Array<{ thesisId: string; score: number; band: PriorityBand }>;
  /** Por qué hablar de esto ahora, calculado por whyNowCore. */
  whyNow?: { score: number; band: 'NOW' | 'SOON' | 'STALE'; reason: string };
  /** Cómo se resolvió el conflicto entre tesis para esta señal. */
  routingDecision?: {
    contested?: boolean;
    secondaryThesisId?: string;
    source: 'AUTO' | 'MANUAL';
    /** SPEC-001 Phase 2 — authoritative routing classification. */
    routingState?: 'CLEAR' | 'CONTESTED' | 'UNROUTED';
    algorithmVersion?: string;
    rationale?: string;
    actorId?: string;
    routedAt?: string;
  };
}

export interface ResearchEvidenceItem {
  title: string;
  url: string;
  snippet: string;
}

export interface SignalResearchBrief {
  queriedAt: string;
  query: string;
  evidence: ResearchEvidenceItem[];
  summary: string;
  suggestedNextStep: 'SAVE' | 'MONITOR' | 'SHORT_POST';
}

export interface SignalAnalysis {
  id: string;
  organizationId: string;
  signalId: string;
  thesisId: string;
  clientId: string;
  relevanceScore: number;
  urgencyScore: number;
  strategicRationale: string;
  proposedAngle: string;
  risksIdentified: string[];
  providerUsed: AIProvider;
  modelDepth: 'standard' | 'deep_reasoning';
  createdAt: string;
}

export type AIProvider = 'OPENAI' | 'CLAUDE' | 'AUTOMATIC' | 'COMPARATIVE';

export type RecommendationType = 'VIDEO_SHORT' | 'ARTICLE_LONG' | 'LESSON_MODULE' | 'OPPORTUNITY_PITCH';
export type RecommendationStatus = 'GENERATED' | 'MANAGER_APPROVED' | 'REJECTED' | 'CONVERTED_TO_TASK';

export interface Recommendation {
  id: string;
  signalId?: string;
  thesisId: string;
  clientId: string;
  type: RecommendationType;
  proposedAngle: string;
  strategicRationale: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  impactScore: number;
  status: RecommendationStatus;
  createdAt: string;
}

export type TaskType = 'RECORD_VIDEO' | 'REVIEW_ARTICLE' | 'APPROVE_OPPORTUNITY' | 'SUBMIT_INFO';
export type TaskStatus = 'DRAFT' | 'ASSIGNED' | 'VIEWED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';

export interface Task {
  id: string;
  organizationId: string;
  clientId: string;
  thesisId?: string;
  campaignId?: string;
  type: TaskType;
  title: string;
  description: string;
  estimatedMinutes: number;
  deadline?: string;
  status: TaskStatus;
  contentItemId?: string;
  opportunityId?: string;
  /** Procedencia: ítem curado y briefing que originaron la tarea. */
  curationEntryId?: string;
  deliveryPackageId?: string;
  scriptPayload?: string;
  clientNotes?: string;
  evidenceUrl?: string;
  format?: ContentFormat;
  pillar?: ContentPillar;
  campaignDay?: number;
  createdAt: string;
  completedAt?: string;
}

export type ContentType = 'VIDEO_SCRIPT' | 'LINKEDIN_ARTICLE' | 'THOUGHT_LEADERSHIP' | 'NEWSLETTER' | 'ACADEMIC_PAPER';
export type ContentStatus =
  | 'DRAFT'
  | 'AI_GENERATED'
  | 'MANAGER_REVIEW'
  | 'MANAGER_APPROVED'
  | 'CLIENT_REVIEW'
  | 'CLIENT_APPROVED'
  | 'CHANGES_REQUESTED'
  | 'READY'
  | 'PUBLISHED';

/** Spine canónico del documento técnico §4.1 (ContentItem lifecycle). */
export type ContentPipelineStatus =
  | 'planned'
  | 'generating'
  | 'draft_ready'
  | 'manager_review'
  | 'sent_to_client'
  | 'client_in_progress'
  | 'client_submitted'
  | 'manager_finalizing'
  | 'qa_check'
  | 'ready_to_publish'
  | 'published'
  | 'cancelled';

export type ContentFormat =
  | 'viewpoint'
  | 'checklist'
  | 'myth_reality'
  | 'mini_case'
  | 'framework'
  | 'legal_update'
  | 'patent_lesson'
  | 'contrarian'
  | 'builder_lesson'
  | 'offer'
  | 'video_long'
  | 'video_short'
  | 'article';

export type ContentPillar =
  | 'ai_adoption'
  | 'ai_governance'
  | 'ai_ip'
  | 'patents_opinion'
  | 'legal_ai_practice'
  | 'security_technical'
  | 'builder_operator';

export interface ContentStateHistoryEntry {
  state: ContentPipelineStatus;
  actorUid: string;
  actorRole: 'ADMIN' | 'CLIENT' | 'SYSTEM';
  at: string;
  comment?: string;
}

/**
 * ContentItem.stateHistory is **non-authoritative** (SPEC-009 F-009-A MODEL B).
 * Canonical workflow = pipelineStatus; trusted clock = updatedAt.
 * Optional local/admin memory only; CLIENT Firestore writes strip it.
 */
export interface ContentItem {
  id: string;
  organizationId: string;
  clientId: string;
  thesisId: string;
  campaignId?: string;
  type: ContentType;
  title: string;
  body: string;
  teleprompterScript?: string;
  targetPlatform: 'LinkedIn' | 'YouTube' | 'PersonalWebsite' | 'Substack' | 'LegalJournal';
  status: ContentStatus;
  pipelineStatus?: ContentPipelineStatus;
  stateHistory?: ContentStateHistoryEntry[];
  format?: ContentFormat;
  pillar?: ContentPillar;
  campaignDay?: number;
  managerNotes?: string;
  clientFeedback?: string;
  /** Texto original enviado al cliente; base para calcular diffs de revisión. */
  clientReviewBaseline?: string;
  createdAt: string;
  updatedAt: string;
  readyAt?: string;
  /** Veredicto del Claim Safety Engine sobre el cuerpo del contenido. */
  claimSafety?: ClaimSafetyVerdictRecord;
}

/** Resultado persistido de `reviewClaims`, para no re-evaluar en cada render. */
export interface ClaimSafetyVerdictRecord {
  verdict: 'PASS' | 'REVIEW' | 'BLOCK';
  summary: string;
  reviewedAt: string;
  /** Huella del texto revisado; si cambia el body, el veredicto queda obsoleto. */
  contentHash?: string;
  findings: Array<{
    kind: string;
    severity: 'REVIEW' | 'BLOCK';
    claim: string;
    detail: string;
    action: string;
    supportingEvidenceIds?: string[];
  }>;
}

export type FeedbackEventKind = 'CLIENT_EDIT' | 'CLIENT_APPROVE' | 'CLIENT_REJECT';

export type SignalOutcomeKind = 'USEFUL' | 'NOT_USEFUL';

/** Feedback del manager sobre si una señal sirvió para posicionamiento. */
export interface SignalOutcome {
  id: string;
  organizationId: string;
  clientId: string;
  signalId: string;
  kind: SignalOutcomeKind;
  note?: string;
  source: 'RADAR' | 'CURATION' | 'DELIVERY';
  actorUid: string;
  createdAt: string;
}

export interface FeedbackEvent {
  id: string;
  organizationId: string;
  clientId: string;
  contentId: string;
  taskId?: string;
  kind: FeedbackEventKind;
  actorUid: string;
  actorRole: 'ADMIN' | 'CLIENT';
  reason?: string;
  beforeText?: string;
  afterText?: string;
  diffHtml?: string;
  diffSummary?: { added: number; removed: number; unchanged: number };
  createdAt: string;
}

export type OpportunityType = 'CONFERENCE_KEYNOTE' | 'PANEL' | 'PODCAST_GUEST' | 'JOURNAL_CALL' | 'AWARD_NOMINATION' | 'PUBLIC_COMMENT';
export type OpportunityStatus = 'DETECTED' | 'UNDER_REVIEW' | 'RECOMMENDED' | 'SENT_TO_CLIENT' | 'ACCEPTED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';

export type OpportunityLifecycleStage = 'proposed' | 'accepted' | 'declined' | 'checklist' | 'submitted';

export interface OpportunityChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Opportunity {
  id: string;
  organizationId: string;
  clientId: string;
  thesisId: string;
  title: string;
  organization: string;
  type: OpportunityType;
  deadline: string;
  description: string;
  fitRationale: string;
  status: OpportunityStatus;
  lifecycleStage?: OpportunityLifecycleStage;
  submissionChecklist?: OpportunityChecklistItem[];
  submittedAt?: string;
  clientDecision?: 'ACCEPTED' | 'REJECTED';
  clientNotes?: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorUid: string;
  actorEmail: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

// ==========================================
// FASE 10: ARQUITECTURA IA, AGENTES Y AI ROUTER
// ==========================================

export type AgentType =
  | 'PROFILE'
  | 'RESEARCH_SIGNALS'
  | 'POSITIONING_STRATEGIST'
  | 'CONTENT_TASKS'
  | 'TOPIC_AGENT';

export interface AIRunRecord {
  id: string;
  organizationId: string;
  clientId?: string | null;
  agent: AgentType;
  provider: AIProvider;
  modelName: string;
  promptTemplateId: string;
  inputContextSummary: string;
  outputPayload: string;
  rawResponse?: string;
  promptTokens: number;
  completionTokens: number;
  totalCostUsd: number;
  latencyMs: number;
  validationPassed: boolean;
  hallucinationCheckScore?: number; // 0 to 100
  securityCheckPassed: boolean;
  status: 'SUCCESS' | 'VALIDATION_FAILED' | 'PROVIDER_ERROR' | 'RATE_LIMITED';
  errorMessage?: string;
  createdAt: string;
}

export interface AIComparativeResult {
  signalId: string;
  thesisId: string;
  openaiOutput: string;
  claudeOutput: string;
  consensusScore: number; // 0 - 100
  divergenceSummary: string;
  synthesizedRecommendation: string;
  winnerProvider?: 'OPENAI' | 'CLAUDE' | 'SYNTHESIS';
}

// ==========================================
// FASE 11: SEGURIDAD, CREDENCIALES Y CUOTAS
// ==========================================

export type ApiKeyStorageType = 'SESSION_MEMORY' | 'PERSISTENT_ENCRYPTED';

export interface TokenBudgetQuota {
  organizationId: string;
  monthlyTokenBudget: number;
  usedTokensMonth: number;
  hardCapLimitTokens: number;
  alertThresholdPercent: number; // e.g. 80%
  isLocked: boolean;
  lastResetAt: string;
}

export interface RateLimitStatus {
  maxRequestsPerMinute: number;
  currentWindowRequests: number;
  windowResetInSeconds: number;
  isThrottled: boolean;
}

// ==========================================
// FASE 12: MOTOR DE SCORING Y PRIORIZACIÓN
// ==========================================

export interface StrategicScoreFactors {
  thesisMatch: number;
  audienceMatch: number;
  timeliness: number;
  authorityFit: number;
  differentiation: number;
  strategicPotential: number;
  commercialPotential: number;
  sourceQuality: number;
}

export interface StrategicScorePenalties {
  evidenceGap: number;
  risk: number;
  staleness: number;
  conflict: number;
}

export interface StrategicScoreResult {
  totalScore: number;
  priorityBand: PriorityBand;
  factors: StrategicScoreFactors;
  penalties: StrategicScorePenalties;
  strategicRationale: string;
  /** @deprecated Compatibility-only — prefer recommendedDisposition + recommendedOutputFormat. */
  recommendedAction: RecommendedAction;
  /** SPEC-002 canonical strategic disposition recommendation. */
  recommendedDisposition?: StrategicDisposition;
  /** SPEC-002 optional output/content format recommendation. */
  recommendedOutputFormat?: OutputFormatRecommendation;
  /** SPEC-002 scoring algorithm version identity (e.g. scoring-v1). */
  scoringVersion?: string;
  scoringStatus: 'NOT_SCORED' | 'LIMITED_CONTEXT' | 'SCORED' | 'FAILED';
  calculatedAt: string;
  /** Territorio de la tesis que disparó el match, cuando la tesis está estructurada. */
  matchedTerritory?: string;
  /** Audiencia de la tesis a la que apunta la señal. */
  matchedAudience?: string;
  /** true cuando un límite duro de la tesis fuerza NO_ACTION. */
  blockedByLimit?: string;
}

export interface PrioritizationQuadrant {
  signalId: string;
  urgency: number; // 0 - 100 (Eje Y)
  impact: number;  // 0 - 100 (Eje X)
  quadrant: 'QUICK_WIN' | 'STRATEGIC_PRIORITY' | 'LOW_PRIORITY' | 'TIME_SINK';
}

// ==========================================
// FASE 7 & 8: CAMPAÑAS Y EVIDENCE VAULT
// ==========================================

export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

export interface Campaign {
  id: string;
  organizationId: string;
  clientId: string;
  thesisId: string;
  name: string;
  description: string;
  status: CampaignStatus;
  startDate: string;
  endDate?: string;
  targetDeliverables: number;
  completedDeliverables: number;
  tags: string[];
  planDays?: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export type CampaignMilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface CampaignMilestone {
  id: string;
  organizationId: string;
  clientId: string;
  campaignId: string;
  dayNumber: number;
  title: string;
  description: string;
  weekdayHint?: string;
  status: CampaignMilestoneStatus;
  linkedTaskId?: string;
  completedAt?: string;
}

/** KPIs alineados al plan de marketing §11.3 */
export type BusinessKpiType =
  | 'linkedin_profile_views'
  | 'target_connection_requests'
  | 'decision_maker_comments'
  | 'website_visits_from_linkedin'
  | 'consultation_requests'
  | 'referral_conversations'
  | 'service_specific_inquiries'
  | 'publications_completed'
  | 'custom';

export type EvidenceType =
  | 'EXPERIENCE'
  | 'EDUCATION'
  | 'CERTIFICATION'
  | 'PUBLICATION'
  | 'PROJECT'
  | 'PATENT'
  | 'AWARD'
  | 'CONFERENCE'
  | 'MEDIA'
  | 'DOCUMENT'
  | 'OTHER'
  | 'CITATION'
  | 'METRIC'
  | 'CASE_STUDY'
  | 'ACADEMIC_PAPER'
  | 'MEDIA_MENTION';

export interface EvidenceVaultItem {
  id: string;
  organizationId: string;
  clientId: string;
  title: string;
  type: EvidenceType;
  sourceUrl?: string;
  snippet: string;
  confidenceScore: number; // 0 - 100
  verified: boolean;
  verifiedAt?: string;
  associatedThesesIds: string[];
  createdAt: string;
  /** Qué demuestra esta evidencia, en términos del posicionamiento. */
  supports?: string[];
  /** 0-100. Cuánta autoridad aporta, distinto de confidenceScore que es confianza en el dato. */
  authorityWeight?: number;
}

// ==========================================
// FASE 17: MODELO COMERCIAL, PLANES Y PRICING
// ==========================================

export type SubscriptionPlanTier = 'FOUNDING_PILOT' | 'PROFESSIONAL' | 'AUTHORITY' | 'ENTERPRISE';

export interface PlanQuotas {
  tier: SubscriptionPlanTier;
  maxClients: number;
  maxThesesPerClient: number;
  maxMonthlyAiRuns: number;
  maxSources: number;
  maxAnalyzedSignalsMonthly: number;
  maxStrategicActionsMonthly: number;
  supportLevel: 'STANDARD' | 'PRIORITY' | 'DEDICATED';
  allowComparativeAi: boolean;
  allowCustomRss: boolean;
}

export interface OrganizationSubscription {
  organizationId: string;
  tier: SubscriptionPlanTier;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIAL';
  quotas: PlanQuotas;
  monthlyUsage: {
    aiRuns: number;
    tokensUsed: number;
    activeClientsCount: number;
    sourcesCount: number;
  };
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export interface Invitation {
  id: string;
  organizationId: string;
  clientId: string;
  email: string;
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  /** Tenant envelope — required for SPEC-009 notification CREATE. */
  organizationId: string;
  clientId?: string;
  type: 'TASK_ASSIGNED' | 'CONTENT_REVIEW' | 'OPPORTUNITY' | 'ONBOARDING' | 'THESIS' | 'SYSTEM' | 'BRIEFING';
  title: string;
  body: string;
  href?: string;
  /** Tarea, contenido u oportunidad para deep-link desde la bandeja. */
  targetId?: string;
  read: boolean;
  createdAt: string;
}

export interface ResultRecord {
  id: string;
  organizationId: string;
  clientId: string;
  contentId?: string;
  opportunityId?: string;
  taskId?: string;
  title: string;
  channel: string;
  metricLabel: string;
  metricValue: number;
  kpiType?: BusinessKpiType;
  notes?: string;
  addedToEvidence: boolean;
  createdAt: string;
  createdBy: string;
}

export interface AuthAccount {
  uid: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  role: UserRole;
  /** Required for local + Firebase parity (SPEC-009 Phase 4 — no silent default). */
  organizationId: string;
  clientId?: string | null;
  status: UserStatus;
}

// ==========================================
// TEMAS Y TENDENCIAS (clustering de señales)
// ==========================================

export type TopicMomentum = 'EMERGING' | 'RISING' | 'STEADY' | 'FADING';

/**
 * Los temas se derivan de las señales en cada render; solo los pines persisten.
 */
export interface Topic {
  key: string;
  label: string;
  keywords: string[];
  clientId: string;
  signalIds: string[];
  signalCount: number;
  avgScore: number;
  topScore: number;
  topSignalId: string;
  priorityBand: PriorityBand;
  firstSeenAt: string;
  lastSeenAt: string;
  recentCount: number;
  previousCount: number;
  momentum: TopicMomentum;
  pinned: boolean;
}

// ==========================================
// MESA DE CURACIÓN (decisión del manager)
// ==========================================

export type CurationDestination =
  | 'TASK_VIDEO'
  | 'TASK_ARTICLE'
  | 'OPPORTUNITY'
  | 'REFERENCE_READING'
  | 'EVIDENCE'
  | 'DISCARD';

export interface CurationEntry {
  id: string;
  organizationId: string;
  clientId: string;
  signalId?: string;
  /** Tesis que reclamó la señal; se propaga a contenido/tareas. */
  thesisId?: string;
  topicKey?: string;
  title: string;
  sourceName?: string;
  sourceUrl?: string;
  snippet: string;
  score?: number;
  priorityBand?: PriorityBand;
  suggestedAction?: RecommendedAction;
  /** null mientras el manager no ha decidido el destino */
  destination: CurationDestination | null;
  managerRationale: string;
  aiAngle?: string;
  decidedAt?: string;
  decidedBy?: string;
  deliveryPackageId?: string | null;
  createdAt: string;
  createdBy: string;
}

// ==========================================
// ASESOR DE POSICIONAMIENTO (imagen profesional)
// ==========================================

export type AdviceCategory =
  | 'CONTENT'
  | 'CREDENTIAL'
  | 'VISIBILITY'
  | 'EVIDENCE'
  | 'NETWORK'
  | 'RISK';

export type AdviceHorizon = 'DAYS_30' | 'DAYS_60' | 'DAYS_90';

export interface AdviceAction {
  id: string;
  category: AdviceCategory;
  horizon: AdviceHorizon;
  title: string;
  why: string;
  how: string;
  effortMinutes: number;
  impact: number;
}

export interface ImageDiagnosis {
  authorityScore: number;
  consistencyScore: number;
  evidenceScore: number;
  visibilityScore: number;
  strengths: string[];
  gaps: string[];
  risks: string[];
}

export interface PositioningAdvice {
  id: string;
  organizationId: string;
  clientId: string;
  thesisId?: string;
  summary: string;
  diagnosis: ImageDiagnosis;
  actions: AdviceAction[];
  usedLiveModel: boolean;
  generatedAt: string;
  generatedBy: string;
}

// ==========================================
// DOSSIER MAESTRO DE POSICIONAMIENTO
// ==========================================

export type DossierChannel = 'LINKEDIN' | 'WEBSITE' | 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK';

export interface DossierIdentityDimension {
  label: string;
  value: string;
}

export interface DossierServiceLine {
  name: string;
  description: string;
  offerings: string[];
}

export interface DossierChannelGuide {
  channel: DossierChannel;
  headline: string;
  bio: string;
  dos: string[];
  donts: string[];
}

export interface MasterDossier {
  id: string;
  organizationId: string;
  clientId: string;
  version: string;
  updatedAt: string;
  /** Frase de posicionamiento principal (EN) */
  taglineEn: string;
  /** Subtítulo / segunda línea (EN) */
  subtitleEn: string;
  /** Resumen ejecutivo en español */
  executiveSummary: string;
  /** Arco narrativo de carrera */
  narrativeArc: string;
  /** Dimensiones de identidad (tabla resumida) */
  identityDimensions: DossierIdentityDimension[];
  /** Líneas de servicio / negocio */
  serviceLines: DossierServiceLine[];
  /** Público objetivo */
  targetAudiences: string[];
  /** Diferenciadores clave */
  differentiators: string[];
  /** Temas que debe dominar en contenido */
  topicsToOwn: string[];
  /** Temas / framing a evitar */
  topicsToAvoid: string[];
  /** Preguntas de negocio que resuelve */
  clientQuestions: string[];
  /** Pendiente de verificación documental */
  pendingVerification: string[];
  /** Guías por canal */
  channelGuides: DossierChannelGuide[];
  /** Regla editorial: cómo usar noticias */
  newsEditorialRule: string;
}

// ==========================================
// PAQUETE DE ENTREGA AL CLIENTE
// ==========================================

export type DeliveryItemKind = 'TASK' | 'CONTENT' | 'OPPORTUNITY' | 'READING' | 'FILE' | 'ADVICE';
export type DeliveryPackageStatus = 'DRAFT' | 'SENT' | 'ACKNOWLEDGED';

export interface DeliveryItem {
  id: string;
  kind: DeliveryItemKind;
  refId?: string;
  title: string;
  note?: string;
  url?: string;
  /** Justificación del manager: queda visible para el cliente y en auditoría */
  rationale?: string;
}

export interface DeliveryPackage {
  id: string;
  organizationId: string;
  clientId: string;
  title: string;
  strategicNote: string;
  periodLabel: string;
  items: DeliveryItem[];
  status: DeliveryPackageStatus;
  createdAt: string;
  createdBy: string;
  sentAt?: string;
  acknowledgedAt?: string;
  /** Nota opcional del cliente al marcar como leído. */
  clientAckNote?: string;
}

export interface AttachedFile {
  id: string;
  organizationId: string;
  clientId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  createdBy: string;
}

// ==========================================
// AGREGADOS DE CARTERA (dashboard nivel 1)
// ==========================================

export interface ClientPortfolioSummary {
  client: Client;
  unreviewedSignals: number;
  savedSignals: number;
  openTasks: number;
  overdueTasks: number;
  contentAwaitingClient: number;
  contentAwaitingManager: number;
  thesisPendingApproval: number;
  opportunitiesPending: number;
  pendingCuration: number;
  draftDeliveries: number;
  lastDeliveryAt?: string;
  attentionScore: number;
  attentionReasons: string[];
  /** Fuentes y radar (Fase 4 cartera). */
  activeSources: number;
  sourcesInError: number;
  signalsLast7Days: number;
  researchPending: number;
  industryPresetLabel?: string;
  /** Señales convertidas sin feedback útil/no útil. */
  outcomePending: number;
  /** % útiles entre outcomes registrados (null si no hay). */
  usefulRate: number | null;
}

