# SPEC-005 Phase 1H — Hexagonal Boundaries Migration Matrix

Phase 1 code moved from monolithic `src/domain/aiGateway/` into domain, application, ports, and composition layers. Functional contracts unchanged.

| Current file (Phase 1) | Current responsibility | Target layer | Target path | Reason |
|------------------------|------------------------|--------------|-------------|--------|
| `constants.ts` | `MAX_REPAIR_ATTEMPTS`, secret sanitization patterns | DOMAIN | `src/domain/ai/constants.ts` | Framework-independent invariants |
| `operations.ts` | 7 `AiOperation` values + guards | DOMAIN | `src/domain/ai/operations.ts` | Core taxonomy |
| `validationState.ts` | `ValidationStatus` enum/guards | DOMAIN | `src/domain/ai/validationState.ts` | Domain lifecycle states |
| `modelRole.ts` | Logical model roles + operation map | DOMAIN | `src/domain/ai/modelRole.ts` | Capability abstraction (no provider IDs) |
| `promptIdentity.ts` | `PromptIdentity` type (+ Zod in Phase 1) | DOMAIN (types) + APPLICATION (Zod) | `src/domain/ai/promptIdentity.ts`, `src/application/ai/validation/promptIdentitySchema.ts` | Identity is domain; runtime validation is application |
| `schemaIdentity.ts` | `SchemaIdentity` type (+ Zod in Phase 1) | DOMAIN (types only) | `src/domain/ai/schemaIdentity.ts` | Pure identity concept |
| `tenantContext.ts` | Tenant types + Zod validation | DOMAIN (types) + APPLICATION (Zod) | `src/domain/ai/tenantContext.ts`, `src/application/ai/validation/tenantContextValidation.ts` | Validation uses Zod → application boundary |
| `errors.ts` | Error codes + safe message helpers | DOMAIN | `src/domain/ai/errors.ts` | Domain-safe error taxonomy |
| `request.ts` | `AiGatewayRequest` contract | APPLICATION | `src/application/ai/contracts/request.ts` | Orchestration input DTO |
| `result.ts` | `AiGatewayResult`, trust marker | APPLICATION | `src/application/ai/contracts/result.ts` | Application trust boundary |
| `schemas/*.ts` (7 files) | Strict Zod output schemas | APPLICATION | `src/application/ai/schemas/*.ts` | Runtime AI transport validation, not intrinsic domain |
| `outputRegistry.ts` | Operation → schema registry | APPLICATION | `src/application/ai/schemas/outputRegistry.ts` | Application orchestration |
| `parseRawJson.ts` | Markdown fence JSON extraction | APPLICATION | `src/application/ai/validation/parseRawJson.ts` | Provider raw compatibility parsing |
| `validateOutput.ts` | Zod validate single pass | APPLICATION | `src/application/ai/validation/validateOutput.ts` | Validation pipeline primitive |
| `validationPipeline.ts` | RAW → VALID/REPAIR/REJECTED loop | APPLICATION | `src/application/ai/validation/validationPipeline.ts` | Bounded repair orchestration |
| `gatewayContract.ts` | `AiGateway` interface + stub | APPLICATION (inbound port + use case) | `src/application/ai/ports/inbound/AiGatewayPort.ts`, `src/application/ai/use-cases/UnimplementedAiGateway.ts` | Explicit inbound port |
| `index.ts` | Barrel export | APPLICATION + DOMAIN | `src/domain/ai/index.ts`, `src/application/ai/index.ts` | Layer-specific public surfaces |

## New artifacts (Phase 1H)

| Artifact | Layer | Path | Reason |
|----------|-------|------|--------|
| `AiProviderPort` | APPLICATION PORT (outbound) | `src/application/ai/ports/outbound/AiProviderPort.ts` | Provider-neutral completion contract |
| `ModelRegistryPort` | APPLICATION PORT (outbound) | `src/application/ai/ports/outbound/ModelRegistryPort.ts` | Logical role → model config |
| `PromptRegistryPort` | APPLICATION PORT (outbound) | `src/application/ai/ports/outbound/PromptRegistryPort.ts` | Prompt resolution/versioning hook |
| `AiRunRepositoryPort` | APPLICATION PORT (outbound) | `src/application/ai/ports/outbound/AiRunRepositoryPort.ts` | Persistence contract only |
| Test composition root | COMPOSITION | `src/composition/ai/testGatewayComposition.ts` | Deterministic wiring without live adapters |
| Architecture tests | TEST | `tests/aiGatewayArchitecture.test.ts` | Enforce import boundaries |

## Phase 2 infrastructure (2026-08-23)

| Layer | Path | Status |
|-------|------|--------|
| Infrastructure | `src/infrastructure/ai/providers/` | OpenAiAdapter, AnthropicAdapter, RoutingAiProviderPort |
| Infrastructure | `src/infrastructure/ai/registry/` | ModelRegistryAdapter, PromptRegistryAdapter |
| Infrastructure | `src/infrastructure/ai/configuration/` | providerSecrets, providerTimeout |
| Interface | `src/interfaces/ai/` | aiComplete handler, tenant resolution, `AICOMPLETE_ADMIN_ONLY` |
| Composition | `src/composition/ai/serverGatewayComposition.ts` | Production server wiring |
| Functions | `functions/src/ai/runAiComplete.ts` | CF bridge |

**Provider routing (production registry):** all logical roles → `openai` / `gpt-4o-mini`. Anthropic adapter implemented + tested but not selected by default registry.

**promptHash:** full SHA-256 hex digest (64 characters), per Phase-1 `PromptIdentitySchema`.

**Retry:** Phase 3 executes bounded retry in Application (`MAX_PROVIDER_RETRIES=1`). Adapters remain single-attempt.

**Repair:** Phase 3 executes one repair provider call via registered prompt `ai_output_repair@1` using `FAST_STRUCTURED` model role. `promptHash` = SHA-256 of canonical template (placeholders), not rendered execution. Same Zod pipeline after repair.

**Global budget:** `MAX_PROVIDER_CALLS_PER_EXECUTION=4`; `MAX_GATEWAY_EXECUTION_MS=270000` (30s below `AI_COMPLETE_FUNCTION_TIMEOUT_SECONDS=300`).

## Phase 4 infrastructure (2026-08-23)

| Layer | Path | Status |
|-------|------|--------|
| Application | `src/application/ai/audit/` | buildAiRunPersistenceRecord, sanitize, validateAiRunEnvelope, renderedPromptHash |
| Infrastructure | `src/infrastructure/ai/persistence/` | FirestoreAiRunRepository, mapAiRunToFirestore |
| Composition | `serverGatewayComposition.ts` | wires `FirestoreAiRunRepository` into `ExecuteAiOperation` |
| Tests | `tests/aiGatewayPhase4.test.ts` | 27 deterministic audit/persistence tests |

**Persistence path:** `clients/{clientId}/aiRuns/{runId}` (SPEC-009 tenant envelope).

**Lifecycle:** one aiRun per gateway execution; stable `runId` (UUID); idempotent `save()` overwrites same doc.

**Pre-provider auth failures** (`handleAiCompleteRequest`): no aiRun (gateway not invoked).

## Phase 5 browser migration (2026-08-23)

| Layer | Path | Status |
|-------|------|--------|
| Browser client | `AiCompleteHttpClient` | shared (5A+) |
| CONTENT_DRAFT | `contentDraftGateway.ts` | **MIGRATED** |
| Thesis/signal | `thesisSignalGateway.ts` + mappers | **MIGRATED** (5B) |
| Advisor | `advisorGateway.ts` + mappers | **MIGRATED** (5C) |
| Prompt catalog | legacy-equivalent render for 5A/5B/5C ops | **DONE** |
| Remaining | comparative dual-provider via session | **BLOCKED** (5C semantic conflict) |

## Deferred (Phase 5D)

| Layer | Target path | Status |
|-------|-------------|--------|
| INTERFACE | `src/interfaces/ai/` (CLIENT CF access) | Future — aiComplete is ADMIN-only |
| Browser migration | `ANALYSIS_COMPARATIVE` | Requires multi-provider orchestration contract |
| Legacy cleanup | session UI, `/api/ai/complete`, `runAgentJson` | Phase 5D when zero consumers |

## Dependency rule summary

```text
INTERFACES / COMPOSITION
        ↓
   APPLICATION (ports, use-cases, validation, schemas)
        ↓
      DOMAIN (pure concepts)
        ↑
INFRASTRUCTURE implements outbound ports (Phase 2+)
```

Dependencies point inward. Domain imports nothing from Firebase, provider SDKs, Zod, or infrastructure.
