import type {
  ContentItem,
  CurationDestination,
  CurationEntry,
  DeliveryItem,
  DeliveryPackage,
  EvidenceVaultItem,
  PositioningThesis,
  Task,
} from '../../../types';
import type { StrategicDownstreamAction } from '../../../domain/strategicBriefCore';

export interface StrategicDownstreamGateResult {
  ok: true;
  briefId: string;
  version?: number;
  thesisId: string;
  signalIds: string[];
  evidenceIds: string[];
  planId: string;
  planItemId: string;
}

export interface DeliverySendPort {
  getPackageById(packageId: string): DeliveryPackage | undefined;
  getCurationById(refId: string): CurationEntry | undefined;
  getThesisById(clientId: string, thesisId: string): PositioningThesis | undefined;
  gateStrategicDownstream(
    clientId: string,
    briefId: string | undefined,
    action: StrategicDownstreamAction
  ): StrategicDownstreamGateResult | { ok: false; message: string };
  authorizeDeliveryItem(
    clientId: string,
    item: DeliveryItem,
    destination: CurationDestination | null | undefined
  ):
    | { ok: true; briefId: string; action: StrategicDownstreamAction; version?: number }
    | { ok: false; message: string };
  generateContentDraft(
    thesis: PositioningThesis,
    title: string,
    format: ContentItem['type']
  ): Promise<Omit<ContentItem, 'id' | 'createdAt' | 'updatedAt'>>;
  saveGeneratedContent(
    content: ContentItem,
    targetStatus: ContentItem['status'],
    comment?: string
  ): boolean;
  addTask(task: Omit<Task, 'id' | 'createdAt'>): void;
  addEvidenceItem(item: Omit<EvidenceVaultItem, 'id' | 'createdAt'>): void;
  materializeOpportunity(input: {
    clientId: string;
    planId: string;
    planItemId: string;
    thesisId: string;
    title: string;
    organization: string;
    type: 'PANEL';
    deadline: string;
    description: string;
    fitRationale: string;
    strategicBriefId: string;
    strategicBriefVersion?: number;
    signalId?: string;
    intentKey: string;
  }): void;
  markDeliverySent(packageId: string, convertedSignalIds: string[]): void;
  runInBatch(fn: () => void): void;
  createContentId(): string;
}
