/**
 * SPEC-008 Phase 4 — Composition root.
 * Wires Application use cases to local-authoritative Infrastructure adapters.
 */

import {
  createApplyApprovedRecommendation,
  createApproveStrategicRecommendation,
  createBuildLearningAssessment,
  createBuildLearningEvidence,
  createGenerateStrategicRecommendation,
  createGetLearningMetrics,
  createGetStrategicRecommendation,
  createListStrategicRecommendations,
  createRegisterLearningObservation,
  createRejectStrategicRecommendation,
  createReviewStrategicRecommendation,
  createSupersedeLearningObservation,
  createTargetSpecApplyPortRegistry,
} from '../../application/learningLoop';
import {
  createLocalLearningLoopStore,
  LocalLearningEvidenceRepository,
  LocalLearningHistoryAdapter,
  LocalLearningObservationRepository,
  LocalRecommendationDecisionAdapter,
  LocalStrategicRecommendationRepository,
  type LocalLearningLoopStore,
} from '../../infrastructure/learningLoop';
import { LocalOpportunityOutcomeReader } from '../../infrastructure/learningLoop/LocalOpportunityOutcomeReader';

export interface ComposeLearningLoopOptions {
  store?: LocalLearningLoopStore;
  opportunityOutcomes?: LocalOpportunityOutcomeReader;
}

/**
 * Phase 4 composition: Domain ← Application ← Ports ← Infrastructure.
 * UI/main must not open postura_learning_* keys directly.
 */
export function composeLearningLoop(options: ComposeLearningLoopOptions = {}) {
  const store = options.store ?? createLocalLearningLoopStore();
  const observations = new LocalLearningObservationRepository(store);
  const evidence = new LocalLearningEvidenceRepository(store);
  const recommendations = new LocalStrategicRecommendationRepository(store);
  const history = new LocalLearningHistoryAdapter(store);
  const decisions = new LocalRecommendationDecisionAdapter(store);
  const opportunityOutcomes =
    options.opportunityOutcomes ?? new LocalOpportunityOutcomeReader();

  const obsDeps = { observations, history };
  const evDeps = { observations, evidence, history };
  const recDeps = { evidence, recommendations, history };
  const decisionDeps = { recommendations, history, decisions };
  const applyDeps = {
    recommendations,
    history,
    targetApplyRegistry: createTargetSpecApplyPortRegistry([]),
  };

  return {
    store,
    observations,
    evidence,
    recommendations,
    history,
    decisions,
    opportunityOutcomes,
    registerObservation: createRegisterLearningObservation(obsDeps),
    supersedeObservation: createSupersedeLearningObservation(obsDeps),
    buildEvidence: createBuildLearningEvidence(evDeps),
    buildAssessment: createBuildLearningAssessment({ evidence }),
    generateRecommendation: createGenerateStrategicRecommendation(recDeps),
    reviewRecommendation: createReviewStrategicRecommendation(decisionDeps),
    approveRecommendation: createApproveStrategicRecommendation(decisionDeps),
    rejectRecommendation: createRejectStrategicRecommendation(decisionDeps),
    applyRecommendation: createApplyApprovedRecommendation(applyDeps),
    getLearningMetrics: createGetLearningMetrics({ evidence }),
    listRecommendations: createListStrategicRecommendations({ recommendations }),
    getRecommendation: createGetStrategicRecommendation({ recommendations }),
  };
}

export type LearningLoopUseCases = ReturnType<typeof composeLearningLoop>;
