# Migration matrix 004 — Strategic Planner

**Phase 4 exit inventory.** Upstream baselines: SPEC-003 @ `e162806…` · SPEC-006 @ `d98c98c…`

---

## Cross-SPEC contract table

| SPEC | Consumed contract | R/W | Authority owner | Mutation by 004? | Failure |
|------|-------------------|-----|-----------------|------------------|---------|
| 001 | thesis via Brief.thesisId | R | SPEC-001 | **No** | Fail closed if missing on Brief |
| 002 | score context via Brief snapshot only | R | SPEC-002 | **No** | No rescore / winner |
| 003 | Brief id/version/status/authorizedAction/thesis/signals/… | R | SPEC-003 | **No** | Stale/non-APPROVED deny |
| 005 | Advisory Gateway ops | R (suggest) | SPEC-005 | **No** new ops | Advisory failure non-blocking |
| 006 | AuthorizePublication for claim-bearing publish | call existing | SPEC-006 | **No** | Publication deny unchanged |
| 009 | Tenant/auth claims production | — | SPEC-009 | **No** | DEFERRED_UNCHANGED |

---

## Legacy / adjacent surface inventory (Phase 4 exit)

| Location | Previous authority | Canonical replacement | Compatibility | Remaining fallback | Status |
|----------|--------------------|----------------------|---------------|--------------------|--------|
| `src/main.ts` `gateStrategicDownstream` | SPEC-003 Brief only | `requirePlannedAuthorization` (Brief + Plan) | — | **0** | **MIGRATED** |
| `src/main.ts` `sendDelivery` | Brief authorize callback | Plan authorize via `requirePlannedAuthorization` | Curation ref for briefId intake only | **0** | **MIGRATED** |
| `src/main.ts` content generate | Brief gate | Plan + Brief gate | Display | **0** | **MIGRATED** |
| `src/main.ts` scientific article | `approved[0]` Brief pick | Unique Brief required; Plan gate | — | **0** | **MIGRATED** |
| `src/main.ts` CREATE_TASK from rec | Brief find | Unique Brief + Plan gate | — | **0** | **MIGRATED** |
| `src/services/strategicPlanConsumer.ts` | — | Composition facade | — | — | **ADDED** |
| `src/composition/strategicPlan/*` | — | Wire App → Infra | — | — | **ADDED** |
| `src/domain/deliveryCore.ts` | Packaging rules | Keep packaging; authorize injected | OTHER_SPEC | — | **KEEP_OTHER_SPEC** |
| `src/domain/contentPipeline.ts` | Content lifecycle | Downstream of Plan | OTHER_SPEC | — | **KEEP_OTHER_SPEC** |
| `src/domain/contentPublishCore.ts` | Content | Downstream; SPEC-006 gate | OTHER_SPEC | — | **KEEP_OTHER_SPEC** |
| `src/domain/workPipeline.ts` | Work | Downstream CREATE_TASK | OTHER_SPEC | — | **KEEP_OTHER_SPEC** |
| `src/domain/stateMachine.ts` curationLifecycle | Legacy curation states | Compatibility display | COMPATIBILITY | — | **COMPATIBILITY** |
| CurationEntry | Split planner-adjacent | Intake only; `assertCurationNotPlanAuthority` | COMPATIBILITY | **0 strategic** | **DEMOTED** |
| DeliveryPackage | Downstream packaging | Not Plan authority | OTHER_SPEC | **0 strategic** | **KEEP_OTHER_SPEC** |
| ContentItem | Content + SPEC-006 | Downstream CREATE_CONTENT; Plan refs preserved | OTHER_SPEC | **0 Plan authority** | **KEEP_OTHER_SPEC** |
| Opportunity / Task | Downstream | Downstream of PlanItem | OTHER_SPEC | **0 Plan authority** | **KEEP_OTHER_SPEC** |
| Manager / Client UI | Display + triggers | Triggers via main → Plan consumer | Display | **0 direct Plan mutate** | **ADAPTED** |
| Advisor curation angle | SPEC-005 advisory | Advisory only | COMPATIBILITY | **0 execution** | **COMPATIBILITY** |

---

## Artifact classifications (Phase 4)

| Artifact | Classification |
|----------|----------------|
| **CurationEntry** | **COMPATIBILITY / intake** — may seed Brief id; **not** Plan APPROVED/ACTIVE authority |
| **DeliveryPackage** | **Downstream packaging** (OTHER_SPEC) — not Plan |
| **ContentItem** | **Downstream execution output** — publication = SPEC-006 |
| **Opportunity** | **Downstream** of `CREATE_OPPORTUNITY` PlanItem |
| **Task / work pipeline** | **Downstream** of `CREATE_TASK` |

---

## Exit criteria evidence

- Executable strategic paths go through SPEC-004 `requirePlannedAuthorization`
- CurationEntry not treated as Plan APPROVED
- SPEC-003 Brief gate preserved inside Plan consumer
- SPEC-006 `authorizeContentPublicationGate` / `saveContentWithClaimGate` preserved
- No `approved[0]` / `plans[0]` planner authority in main
- Missing Plan → DENY (no legacy fallback)

**F-004-03:** **RESOLVED** (executable legacy planning authority = 0)

---

## Findings linkage

| Audit | Formal ID | Disposition |
|-------|-----------|-------------|
| AUDIT-004-01 | F-004-01 | **RESOLVED** Phase 0 |
| AUDIT-004-02 | F-004-03 | **RESOLVED** Phase 4 |
| AUDIT-004-03 | F-004-03 | **RESOLVED** Phase 4 |
| AUDIT-004-04 | F-004-04 | **OPEN_NONBLOCKING** |
