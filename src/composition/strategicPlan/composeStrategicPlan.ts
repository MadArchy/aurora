import {
  createActivatePlanItem,
  createAddPlanItem,
  createApproveStrategicPlan,
  createAuthorizePlannedAction,
  createCancelPlanItem,
  createCompletePlanItem,
  createCreateStrategicPlan,
  createProposeStrategicPlan,
  createRejectStrategicPlan,
  createRemovePlanItem,
  createRevalidatePlanAgainstBrief,
  createReviseStrategicPlan,
} from '../../application/strategicPlan';
import {
  createLocalStrategicPlanStore,
  LocalPlanItemStore,
  LocalStrategicBriefReader,
  LocalStrategicPlanHistoryAdapter,
  LocalStrategicPlanRepository,
  LocalStrategicPlanStore,
  type StrategicBriefSource,
} from '../../infrastructure/strategicPlan';

/**
 * Phase 4 composition: wire Application use cases to local-authoritative adapters.
 * UI/main must not open postura_strategic_plan_* keys directly.
 */
export function composeStrategicPlan(options: {
  briefs: StrategicBriefSource;
  store?: LocalStrategicPlanStore;
}) {
  const store = options.store ?? createLocalStrategicPlanStore();
  const plans = new LocalStrategicPlanRepository(store);
  const history = new LocalStrategicPlanHistoryAdapter(store);
  const items = new LocalPlanItemStore(store);
  const briefs = new LocalStrategicBriefReader(options.briefs);
  const deps = { plans, history, briefs };
  return {
    store,
    plans,
    history,
    items,
    briefs,
    create: createCreateStrategicPlan(deps),
    addItem: createAddPlanItem(deps),
    removeItem: createRemovePlanItem(deps),
    propose: createProposeStrategicPlan(deps),
    approve: createApproveStrategicPlan(deps),
    reject: createRejectStrategicPlan(deps),
    revise: createReviseStrategicPlan(deps),
    authorize: createAuthorizePlannedAction(deps),
    activate: createActivatePlanItem(deps),
    complete: createCompletePlanItem(deps),
    cancel: createCancelPlanItem(deps),
    revalidate: createRevalidatePlanAgainstBrief(deps),
  };
}
