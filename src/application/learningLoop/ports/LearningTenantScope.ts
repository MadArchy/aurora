/**
 * SPEC-008 Phase 2 — Shared tenant scope for repository ports.
 */

export interface LearningTenantScope {
  organizationId: string;
  clientId: string;
}

export interface LearningIdempotencyRecord {
  key: string;
  aggregateKind: 'OBSERVATION' | 'EVIDENCE' | 'RECOMMENDATION';
  aggregateId: string;
  organizationId: string;
  clientId: string;
  materialFingerprint: string;
  at: string;
}

export interface LearningWriteUnit {
  observations?: import('../../../domain/learningObservationCore').LearningObservation[];
  evidence?: import('../../../domain/learningEvidenceCore').LearningEvidence[];
  recommendations?: import('../../../domain/strategicRecommendationCore').StrategicRecommendation[];
  history: import('./LearningHistoryPort').LearningHistoryRecord[];
  decisions?: import('../../../domain/recommendationDecisionCore').RecommendationDecision[];
  idempotencyKeys?: LearningIdempotencyRecord[];
}
