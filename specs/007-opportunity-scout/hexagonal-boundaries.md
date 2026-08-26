# Hexagonal boundaries 007 — Opportunity Scout

---

## Target layering (Phase 3 Infrastructure adapters implemented; Composition/consumer Phase 4+)

```text
Interfaces / UI (OpportunityPanel, ClientPortal, main.ts)
        ↓
Composition seam (future: opportunityScoutConsumer / composeOpportunityScout)
        ↓
Application (Register/Evaluate/Materialize/Accept/Checklist/Submit/…)
        ↓
Domain (opportunityCandidateCore, opportunityCore, opportunityScoreCore,
        opportunityGateCore, opportunityTenantCore, opportunityLifecycleCore)
        ↑
Ports ← Infrastructure (local stores, Brief/Plan readers, clock, actor,
                        optional OpportunityAdvisorPort → SPEC-005)
```

**Rule:** Consumer asks Application. UI does not authorize from displayed status alone.

---

## Domain (pure)

**Owns:** Candidate / Score / Opportunity types · lifecycle transitions · tenant validators · multi-thesis evaluation shapes · materialize predicates given authorization decision · explainability shapes · materiality

**Must not:** Import Firebase, localStorage, React, fetch, AI SDKs · Approve Brief/Plan · Mutate routing/scoring · Call AuthorizePublication · Parse JWT

---

## Application

**Owns:** Use case orchestration · Trusted actor + clock · Ports · Idempotency · Ignore caller snapshots

**Must not:** Import concrete `db.ts` / React · Direct provider calls · Embed SPEC-002 scoring algorithm · Bypass SPEC-004 gate

---

## Ports (outbound)

| Port | Purpose |
|------|---------|
| `OpportunityCandidateRepository` | Current candidate projection |
| `OpportunityRepository` | Current Opportunity projection (tenant-keyed) |
| `OpportunityHistoryPort` | Append-only material history |
| `StrategicBriefReader` | Read Brief snapshot (SPEC-003) |
| `StrategicPlanAuthorizationPort` / Plan consumer facade | Read SPEC-004 allow decision |
| `StrategicContextReader` | Optional signal/score context (001/002) |
| `TrustedActorContext` / Clock / Id | Trust + time + ids |
| `OpportunityAdvisorPort` (optional) | Advisory suggestions via SPEC-005 — never authoritative |

---

## Infrastructure (Phase 3+)

- Local-authoritative candidate/opportunity/history adapters
- Legacy `postura_opportunities_v5` compatibility reader
- No production Firestore Opportunity rule ownership in SPEC-007 Phases 1–6

---

## UI / consumers

**May:** display candidates/opportunities, request actions, show denial reasons.  
**Must not:** write Opportunity status as authority, invent thesis, set softwareAuthority, bypass Plan/Brief gates, call raw `dbService` Opportunity mutators as governance.

---

## Architecture bans (enforce in Phase 1/5 tests)

1. Domain → Infrastructure/UI/Firebase → **FAIL**
2. Application → concrete db/UI → **FAIL**
3. UI → direct Opportunity repository / storage keys → **FAIL**
4. AI actor materialize/accept/submit → **FAIL**
5. SPEC-007 mutates Brief/Plan/routing/score/claim Verification → **FAIL**
6. Implicit `theses[0]` / primary as Opportunity thesis → **FAIL**
7. `dbService.addOpportunity` as post-migration authority → **FAIL**
8. Opportunity Score replaces Strategic Score → **FAIL**
9. Materialize without SPEC-004 allow → **FAIL**
