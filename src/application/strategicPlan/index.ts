export { StrategicPlanError, type StrategicPlanErrorCode } from './errors';
export {
  assertTrustedPlanActor,
  assertNoTenantSpoof,
  assertSoftwareAuthority,
  resolveTrustedActorKind,
  type TrustedPlanActorContext,
} from './trustedContext';
export { createCreateStrategicPlan } from './CreateStrategicPlan';
export type {
  CreateStrategicPlanInput,
  CreateStrategicPlanResult,
  CreateStrategicPlanDeps,
} from './CreateStrategicPlan';
export { createAddPlanItem, createRemovePlanItem } from './AddPlanItem';
export type {
  AddPlanItemInput,
  AddPlanItemResult,
  RemovePlanItemInput,
  RemovePlanItemResult,
  PlanItemMutationDeps,
} from './AddPlanItem';
export { createProposeStrategicPlan } from './ProposeStrategicPlan';
export type {
  ProposeStrategicPlanInput,
  ProposeStrategicPlanResult,
  ProposeStrategicPlanDeps,
} from './ProposeStrategicPlan';
export {
  createApproveStrategicPlan,
  createRejectStrategicPlan,
} from './ApproveStrategicPlan';
export type {
  ApproveStrategicPlanInput,
  ApproveStrategicPlanResult,
  RejectStrategicPlanInput,
  RejectStrategicPlanResult,
  ApproveRejectDeps,
} from './ApproveStrategicPlan';
export { createReviseStrategicPlan } from './ReviseStrategicPlan';
export type {
  ReviseStrategicPlanInput,
  ReviseStrategicPlanResult,
  ReviseStrategicPlanDeps,
  RevisePlanItemDraft,
} from './ReviseStrategicPlan';
export { createAuthorizePlannedAction } from './AuthorizePlannedAction';
export type {
  AuthorizePlannedActionAppInput,
  AuthorizePlannedActionAppResult,
  AuthorizePlannedActionDeps,
} from './AuthorizePlannedAction';
export {
  createActivatePlanItem,
  createCompletePlanItem,
  createCancelPlanItem,
} from './ActivatePlanItem';
export type {
  PlanItemLifecycleInput,
  PlanItemLifecycleResult,
  PlanItemLifecycleDeps,
} from './ActivatePlanItem';
export { createRevalidatePlanAgainstBrief } from './RevalidatePlanAgainstBrief';
export type {
  RevalidatePlanAgainstBriefInput,
  RevalidatePlanAgainstBriefResult,
  RevalidatePlanAgainstBriefDeps,
} from './RevalidatePlanAgainstBrief';
export type {
  StrategicPlanRepository,
  PlanWriteUnit,
  PlanTenantScope,
} from './ports/StrategicPlanRepository';
export type { PlanItemStore } from './ports/PlanItemStore';
export type {
  StrategicPlanHistoryPort,
  StrategicPlanHistoryRecord,
} from './ports/StrategicPlanHistoryPort';
export type { StrategicBriefReader } from './ports/StrategicBriefReader';
export type {
  PlannerAdvisorPort,
  PlannerAdvisorSuggestion,
  PlannerAdvisorSuggestInput,
} from './ports/PlannerAdvisorPort';
export { toPlanBriefContext } from './briefProjection';
