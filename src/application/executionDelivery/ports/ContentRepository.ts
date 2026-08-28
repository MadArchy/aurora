import type {
  ClaimSafetyVerdictRecord,
  ContentItem,
  ContentPipelineStatus,
  ContentStatus,
  ContentType,
  FeedbackEvent,
  FeedbackEventKind,
} from '../../../types';

export interface ContentDraftFields {
  title?: string;
  body?: string;
  type?: ContentType;
  targetPlatform?: ContentItem['targetPlatform'];
  teleprompterScript?: string;
  managerNotes?: string;
  clientFeedback?: string;
  /** Advisory projection only — never publication authority. */
  claimSafety?: ClaimSafetyVerdictRecord;
}

export interface ContentRepository {
  getById(contentId: string): ContentItem | undefined;
  saveDraft(contentId: string, fields: ContentDraftFields, updatedAt: string): ContentItem;
  transitionPipeline(input: {
    contentId: string;
    next: ContentPipelineStatus;
    actor: { uid: string; role: 'ADMIN' | 'CLIENT' | 'SYSTEM' };
    comment?: string;
  }): ContentItem;
  saveClientRevision(input: {
    contentId: string;
    title: string;
    body: string;
    actorUid: string;
    taskId?: string;
  }): FeedbackEvent | null;
  addFeedback(input: {
    organizationId: string;
    clientId: string;
    contentId: string;
    taskId?: string;
    kind: FeedbackEventKind;
    actorUid: string;
    actorRole: 'ADMIN' | 'CLIENT';
    reason?: string;
  }): FeedbackEvent;
}

/** SPEC-006 gate consumption — Execution Delivery does not own claim safety. */
export interface ContentPublicationGatePort {
  authorize(input: {
    contentId: string;
    organizationId: string;
    clientId: string;
    targetStatus: ContentStatus;
    actorId: string;
    actorRole: 'ADMIN' | 'CLIENT';
    now: string;
  }): { allowed: boolean; reason?: string; reasonCode?: string };
}
