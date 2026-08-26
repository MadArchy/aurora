/**
 * SPEC-008 Phase 2 — Read-only source projection ports.
 * Application cannot mutate source aggregates.
 */

import type { LearningTenantScope } from './LearningTenantScope';

export interface SignalOutcomeProjection {
  signalId: string;
  organizationId: string;
  clientId: string;
  thesisId?: string;
  outcomeKind: string;
  recordedAt: string;
}

export interface ResultRecordProjection {
  resultId: string;
  organizationId: string;
  clientId: string;
  thesisId?: string;
  resultKind: string;
  recordedAt: string;
}

export interface FeedbackEventProjection {
  feedbackId: string;
  organizationId: string;
  clientId: string;
  thesisId?: string;
  feedbackKind: string;
  recordedAt: string;
}

export interface SignalOutcomeReader {
  getSignalOutcome(
    signalId: string,
    tenant: LearningTenantScope
  ): SignalOutcomeProjection | undefined;
}

export interface ResultRecordReader {
  getResultRecord(
    resultId: string,
    tenant: LearningTenantScope
  ): ResultRecordProjection | undefined;
}

export interface FeedbackEventReader {
  getFeedbackEvent(
    feedbackId: string,
    tenant: LearningTenantScope
  ): FeedbackEventProjection | undefined;
}
