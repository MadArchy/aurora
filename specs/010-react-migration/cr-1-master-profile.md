# CR-1 Workstream 2 — Master Profile Application

**Class:** `OPERATIONAL_APPLICATION_CANONICALIZATION`  
**Status:** `COMPLETE`  
**Umbrella:** CR-1 — Cutover-Critical Application Ownership  
**Authorized base checkpoint:** `920ba00b59997277c653c17e61aa4d54a56762f2`  
**Implementation SHA:** `198772466c3230d01f177b59d2302dc25913012d`  
**Governance / freeze SHA:** `44c964ff731c46ae36a9dc65aaae0224439f6a3a`  
**Timezone:** America/Bogota

---

## Scope

| Item | Value |
|------|--------|
| Registry ID | **#10** only |
| Command | `ApplyOnboardingStep` |
| Boundary | Master Profile Application |
| IDs 2–6 | OWNER_RESOLVED · **NOT_IMPLEMENTED** |

---

## Domain-rule stop gate

**NEW DOMAIN RULE REQUIRED = NO**

| Behavior | Classification |
|----------|----------------|
| Wizard steps 1–6 field mapping | EXISTING_PRODUCT_RULE + LEGACY_BUSINESS → Application orchestration |
| `buildFactsFromProfile` | EXISTING_DOMAIN_RULE — reused |
| `computeProfileCoverage` / `nextIncompleteOnboardingStep` | EXISTING_DOMAIN_RULE — resume/display |
| Hardcoded `profileCompleteness: 85` on step 6 | LEGACY_BUSINESS_BEHAVIOR (dead after save refresh) — **not** reintroduced; Domain refresh owns persisted completeness |
| Out-of-order / repeated steps | LEGACY_BUSINESS_BEHAVIOR — preserved for parity |

---

## Security

`requireTenantScope` → trusted org/client/actor/role.  
Caller completeness / lifecycle / org / client spoof → DENY.

---

## Adoption

| Surface | Model |
|---------|--------|
| `main.ts` form-onboarding-step | `masterProfileConsumer.applyOnboardingStep` |
| Command seam | `masterProfileCommands` |
| `dbService.applyOnboardingStep` | DEPRECATED fail-closed |
| React wizard | Still `DISPLAY_ONLY_REACT` (no React write) |
| Double authority | **0** |

---

## Out of scope

Client Lifecycle reopen · Thesis · Signal Intake · Execution Delivery · CR-2 · CR-3 · IDs 2–6 · Phase 5 · deployment

**NEXT ACTION after freeze:** `AUTHORIZE_CR1_THESIS_LIFECYCLE_WORKSTREAM`

---

## Checkpoint SHAs

| Role | SHA |
|------|-----|
| Authorized start | `920ba00b59997277c653c17e61aa4d54a56762f2` |
| Implementation | `198772466c3230d01f177b59d2302dc25913012d` |
| Governance / freeze (content) | `44c964ff731c46ae36a9dc65aaae0224439f6a3a` |
| Tip pin | points at freeze content above (not self) |
