import type {
  AIRunRecord,
  AttachedFile,
  Campaign,
  CampaignMilestone,
  Client,
  ClientProfile,
  ContentItem,
  CurationEntry,
  DeliveryPackage,
  EvidenceVaultItem,
  FeedbackEvent,
  Invitation,
  MasterDossier,
  Opportunity,
  OrganizationSubscription,
  PositioningAdvice,
  PositioningThesis,
  ProofWallItem,
  Recommendation,
  ResultRecord,
  Signal,
  Source,
  Task,
} from '../../types';

/** Snapshot completo localStorage v5 para import/export Firestore. */
export interface LocalV5Snapshot {
  clients: Client[];
  theses: PositioningThesis[];
  profiles: Record<string, ClientProfile>;
  sources: Source[];
  signals: Signal[];
  recommendations: Recommendation[];
  tasks: Task[];
  contents: ContentItem[];
  opportunities: Opportunity[];
  campaigns: Campaign[];
  campaignMilestones: CampaignMilestone[];
  evidenceVault: EvidenceVaultItem[];
  aiRuns: AIRunRecord[];
  subscription: OrganizationSubscription | null;
  invitations: Invitation[];
  results: ResultRecord[];
  curation: CurationEntry[];
  deliveries: DeliveryPackage[];
  advices: PositioningAdvice[];
  files: AttachedFile[];
  topicPins: string[];
  dossiers: Record<string, MasterDossier>;
  feedbackEvents: FeedbackEvent[];
  proofWallItems: ProofWallItem[];
}

export const LOCAL_V5_KEYS = [
  'postura_clients_v5',
  'postura_theses_v5',
  'postura_profiles_v5',
  'postura_sources_v5',
  'postura_signals_v5',
  'postura_recommendations_v5',
  'postura_tasks_v5',
  'postura_contents_v5',
  'postura_opportunities_v5',
  'postura_campaigns_v5',
  'postura_milestones_v5',
  'postura_evidence_v5',
  'postura_ai_runs_v5',
  'postura_subscription_v5',
  'postura_invitations_v5',
  'postura_results_v5',
  'postura_curation_v5',
  'postura_deliveries_v5',
  'postura_advices_v5',
  'postura_files_v5',
  'postura_topic_pins_v5',
  'postura_dossiers_v5',
  'postura_feedback_v1',
  'postura_proof_wall_v1',
] as const;
