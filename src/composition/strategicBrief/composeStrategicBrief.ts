import {
  createApproveStrategicBrief,
  createAuthorizeStrategicDownstream,
  createCreateStrategicBrief,
  createOverrideStrategicBrief,
  createRejectStrategicBrief,
  createReviseStrategicBrief,
} from '../../application/strategicBrief';
import {
  createLocalStrategicBriefStore,
  LocalStrategicBriefHistoryAdapter,
  LocalStrategicBriefRepository,
  LocalStrategicBriefStore,
  LocalStrategicContextReader,
  type StrategicBriefContextSource,
} from '../../infrastructure/strategicBrief';

/**
 * Phase 3 composition: wire Application use cases to local-authoritative adapters.
 * Does not hook content UI, sendDelivery, Planner, or Opportunity writers.
 * Callers supply the SPEC-001/002 read source (tests: memory; future UI: dbService).
 */
export function composeStrategicBrief(options: {
  signals: StrategicBriefContextSource;
  store?: LocalStrategicBriefStore;
}) {
  const store = options.store ?? createLocalStrategicBriefStore();
  const briefs = new LocalStrategicBriefRepository(store);
  const history = new LocalStrategicBriefHistoryAdapter(store);
  const context = new LocalStrategicContextReader(options.signals);
  const deps = { briefs, history, context };
  return {
    create: createCreateStrategicBrief(deps),
    approve: createApproveStrategicBrief(deps),
    reject: createRejectStrategicBrief({ briefs, history }),
    revise: createReviseStrategicBrief(deps),
    override: createOverrideStrategicBrief(deps),
    authorize: createAuthorizeStrategicDownstream({ briefs }),
  };
}
