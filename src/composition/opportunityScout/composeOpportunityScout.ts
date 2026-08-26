/**
 * SPEC-007 Phase 4 — Composition root.
 * Wires Application use cases to local-authoritative Infrastructure adapters.
 * Application must never import Infrastructure; wiring is outward-only.
 */

import {
  createAcceptOpportunity,
  createArchiveOpportunity,
  createCompleteOpportunity,
  createDeclineOpportunity,
  createEvaluateOpportunityCandidate,
  createGetOpportunity,
  createGetOpportunityCandidate,
  createListOpportunities,
  createListOpportunityCandidates,
  createMaterializeOpportunity,
  createRecommendOpportunityCandidate,
  createRegisterOpportunityCandidate,
  createReevaluateOpportunityCandidate,
  createSubmitOpportunity,
  createUpdateOpportunityChecklist,
  type OpportunityStrategicBriefReader,
  type StrategicPlanAuthorizationPort,
} from '../../application/opportunityScout';
import {
  createLocalOpportunityScoutStore,
  LocalOpportunityCandidateRepository,
  LocalOpportunityHistoryAdapter,
  LocalOpportunityRepository,
  LocalOpportunityScoutStore,
} from '../../infrastructure/opportunityScout';

export interface ComposeOpportunityScoutOptions {
  store?: LocalOpportunityScoutStore;
  /** SPEC-004 facade — required for materialization. Fail-closed if omitted in live consumer. */
  planAuth: StrategicPlanAuthorizationPort;
  briefs?: OpportunityStrategicBriefReader;
}

/**
 * Phase 4 composition: Domain ← Application ← Ports ← Infrastructure.
 * UI/main must not open postura_opportunity_* keys directly.
 */
export function composeOpportunityScout(options: ComposeOpportunityScoutOptions) {
  const store = options.store ?? createLocalOpportunityScoutStore();
  const candidates = new LocalOpportunityCandidateRepository(store);
  const opportunities = new LocalOpportunityRepository(store);
  const history = new LocalOpportunityHistoryAdapter(store);
  const briefs = options.briefs;
  const planAuth = options.planAuth;

  const candidateDeps = { candidates, history };
  const opportunityDeps = { opportunities, history };
  const materializeDeps = {
    opportunities,
    candidates,
    history,
    planAuth,
    briefs,
  };

  return {
    store,
    candidates,
    opportunities,
    history,
    planAuth,
    briefs,
    registerCandidate: createRegisterOpportunityCandidate(candidateDeps),
    evaluateCandidate: createEvaluateOpportunityCandidate(candidateDeps),
    reevaluateCandidate: createReevaluateOpportunityCandidate(candidateDeps),
    recommendCandidate: createRecommendOpportunityCandidate(candidateDeps),
    materialize: createMaterializeOpportunity(materializeDeps),
    accept: createAcceptOpportunity(opportunityDeps),
    decline: createDeclineOpportunity(opportunityDeps),
    updateChecklist: createUpdateOpportunityChecklist(opportunityDeps),
    submit: createSubmitOpportunity(opportunityDeps),
    complete: createCompleteOpportunity(opportunityDeps),
    archive: createArchiveOpportunity(opportunityDeps),
    getOpportunity: createGetOpportunity(opportunityDeps),
    listOpportunities: createListOpportunities(opportunityDeps),
    getCandidate: createGetOpportunityCandidate(candidateDeps),
    listCandidates: createListOpportunityCandidates(candidateDeps),
  };
}

export type OpportunityScoutUseCases = ReturnType<typeof composeOpportunityScout>;
