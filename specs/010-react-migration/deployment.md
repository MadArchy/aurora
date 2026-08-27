# Deployment 010 — React migration

**Status:** **NOT_STARTED** · requires separate authorization
**Baseline:** SPEC-008 frozen @ `642ae9390700a254fa390ba09a959bab3c37d616`

---

## Constitutional separation

**CODE_COMPLETE ≠ DEPLOYMENT ≠ DEPLOYED ≠ DONE.**

SPEC-010 may reach CODE_COMPLETE with deployment **NOT_STARTED**. Deployment is authorized separately and
coordinated with SPEC-009, which remains the owner of production security controls.

| State | Value at Phase 0 |
|-------|------------------|
| DEPLOYMENT | **NOT_STARTED** |
| DEPLOYED | **NO** |
| DONE | **NO** |
| SPEC-009 PRODUCTION | **DEFERRED_UNCHANGED** |

## Deployment tasks

| Task | Title | Scope | Status |
|------|-------|-------|--------|
| **D1** | Frontend rollout strategy | staged React exposure, toggle governance, audience scoping | **NOT_STARTED** |
| **D2** | Frontend rollback / observation procedure in production | revert presentation without data migration; observation window | **NOT_STARTED** |
| **D3** | Production cutover verification (SPEC-009 coordination) | auth, tenant isolation, rules contracts verified post-cutover | **NOT_STARTED** |

## Rollback model

Rollback is a **presentation switch**, never a data operation.

| Requirement | Rule |
|-------------|------|
| Mechanism | per-wave toggle between legacy and React presentation |
| Canonical state | **unchanged** by rollback |
| Data migration | **never required** to roll back UI |
| Destructive steps | **prohibited** |
| Evidence | rollback exercised in Phase 5 (T-010-508) before any production exposure |
| Legacy availability | retained until the parity gate passes (Phase 6) |

If a rollback would require a data migration, the wave design is invalid and must be corrected before
cutover.

## Explicitly excluded from SPEC-010

- production Firestore changes
- production rules or claims changes
- managed backup or production backfill
- authentication or RBAC redefinition
- any SPEC-009 production action

## Hosting

The repository already provides `firebase:deploy:hosting` (`npm run build && firebase deploy --only
hosting`). SPEC-010 introduces no new deployment mechanism; D1–D3 govern **when and how** the React
presentation is exposed, not a new pipeline. `npm run build` runs `typecheck` first, so a type-unsafe
React build cannot ship.
