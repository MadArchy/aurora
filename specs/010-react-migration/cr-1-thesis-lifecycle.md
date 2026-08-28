# CR-1 Workstream 3 — Thesis Lifecycle Application

**Class:** `OPERATIONAL_APPLICATION_CANONICALIZATION`  
**Status:** `COMPLETE`  
**Umbrella:** CR-1 — Cutover-Critical Application Ownership  
**Authorized base checkpoint:** `9957b14d8d9648b1aa08699b24745c0b080536d0`  
**Implementation SHA:** `9cfbb1520bdc19f3f9ce584cb8f95fef6192638c`  
**Timezone:** America/Bogota

---

## Scope

| Item | Value |
|------|--------|
| Registry IDs | **#11**, **#12**, **#13** |
| Commands | `SaveThesis`, `DecideThesisClientReview`, `ActivateThesis` |
| Boundary | Thesis Lifecycle Application |
| New Domain rules | **NO** — stop gate not triggered |
| New SPEC ID | **NO** |

---

## Domain-rule stop gate

**NEW DOMAIN RULE REQUIRED = NO**

| Behavior | Classification |
|----------|----------------|
| Draft / submit_review plan | EXISTING_DOMAIN_RULE — `planThesisSave` |
| Review readiness | EXISTING_DOMAIN_RULE — `assertThesisReadyForReview` |
| Client approve / request changes | EXISTING_DOMAIN_RULE — `approveThesisByClient` / `rejectThesisByClient` |
| Manager activation | EXISTING_DOMAIN_RULE — `activateThesisByManager` / `canActivateThesis` |
| Status / approval matrices | Domain-owned — not reimplemented in Application / React / main |

---

## Security

`requireTenantScope` → trusted org/client/actor/role.  
ADMIN for save + activate; CLIENT for review.  
Caller org / client / status / approval spoof → DENY.  
Explicit `thesisId` — no `theses[0]` / primary / positional authority.

---

## Adoption

| Surface | Model |
|---------|--------|
| `main.ts` thesis editor save | `thesisLifecycleConsumer.saveThesis` |
| `main.ts` activate | `thesisLifecycleConsumer.activateThesis` |
| `main.ts` portal approve / request changes | `thesisLifecycleConsumer.decideThesisClientReview` |
| Command seam | `thesisLifecycleCommands` |
| Persistence | `DbThesisLifecycleAdapter` → `dbService.saveThesis` (persistence only) |
| React pages | Still `DISPLAY_ONLY_REACT` (no React write) |
| Double authority | **0** |

---

## SPEC-001 separation

Thesis Lifecycle owns draft → review → client decision → activation.  
SPEC-001 owns signal → thesis strategic routing and may consume **ACTIVE** theses.  
**SPEC-001 BEHAVIOR MODIFICATIONS = 0** · **SPEC-001 LIFECYCLE AUTHORITY = 0**.

---

## Out of scope

Client Lifecycle reopen · Master Profile reopen · Signal Intake · Execution Delivery · CR-2 · CR-3 · Phase 5 · deployment · new Domain transitions

**NEXT ACTION after freeze:** `AUTHORIZE_CR1_SIGNAL_INTAKE_WORKSTREAM`

---

## Prior freezes preserved

| Workstream | Implementation | Frozen content |
|------------|----------------|----------------|
| Client Lifecycle | `63e8db8543bf2a13ae29249b71748402007f959a` | `cf9350fb6de3a9b392b207d34e50714f49c13deb` |
| Master Profile | `198772466c3230d01f177b59d2302dc25913012d` | `44c964ff731c46ae36a9dc65aaae0224439f6a3a` |

---

## Checkpoint SHAs

| Role | SHA |
|------|-----|
| Authorized start | `9957b14d8d9648b1aa08699b24745c0b080536d0` |
| Implementation | `9cfbb1520bdc19f3f9ce584cb8f95fef6192638c` |
| Governance / freeze (content) | *(this commit)* |
| Tip pin | points at freeze content (not self) |

---

## Cutover after WS3

| Item | Value |
|------|--------|
| Canonicalized IDs | `1, 10, 11, 12, 13, 34` |
| Remaining spine | `8, 24, 26, 28, 31, 32` (6) |
| T-010-403 / T-010-404 | `BLOCKED_BY_PRECONDITION` |
| Phase 5 | `NOT_AUTHORIZED` |
