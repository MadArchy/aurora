# Hexagonal boundaries 006 — Evidence Claim Linking

---

## Target layering (design — not implemented)

```text
Interfaces / UI (ClaimSafetyPanel, Modals, ManagerCockpit, main.ts)
        ↓
Composition seam (future: src/services/claimEvidenceConsumer.ts or equivalent)
        ↓
Composition root (future: src/composition/claimEvidence/…)
        ↓
Application (ExtractClaims, RegisterClaim, LinkEvidenceToClaim,
             RequireEvidence, VerifyClaim, RejectClaimVerification,
             ReviewClaim, OverrideClaimGate, AuthorizePublication)
        ↓
Domain (claimCore, evidenceCore, verificationCore, claimLinkCore,
        claimTenantCore, claimGateCore, claimMaterialityCore)
        ↑
Ports ← Infrastructure (local stores, EvidenceVault adapter,
                        optional SPEC-005 suggestion adapter, clock, actor)
```

**Rule:** Consumer asks Application. Application decides. UI does not authorize publication from displayed badge/status alone.

---

## Domain (pure)

**Owns:**

- Claim / Evidence / Verification / Source / ClaimEvidenceLink types
- ClaimStatus transitions (including EVIDENCE_REQUIRED / RESEARCH_REQUIRED)
- Tenant reference validation (pure — receives resolved entities)
- Publication eligibility predicates given Claim set + target status
- Override eligibility (hard-block non-override)
- Material change detection for claim text / links / verification
- Explainability projection shapes

**Must not:**

- Import Firebase, localStorage, React, fetch, AI SDKs
- Call SPEC-003 Brief use cases
- Mutate routing/scoring
- Treat Brief supportingEvidenceIds as verified
- Parse auth JWT / set custom claims (SPEC-009)

---

## Application

**Owns:**

- Use cases listed in `plan.md` / `tasks.md`
- Orchestration across ports
- Idempotency / error mapping
- Trust boundary: actor from trusted auth context only

**Must not:**

- Contain regex pattern libraries as sole authority without Domain types (patterns may live in Domain extractors)
- Write Firestore directly
- Approve StrategicBrief

---

## Ports (outbound)

| Port | Purpose |
|------|---------|
| `ClaimRepository` | Current Claim projection |
| `ClaimHistoryPort` | Append-only claim/verification/link history |
| `EvidenceReader` / `EvidenceWriter` | Vault adaptation |
| `VerificationStore` | Authoritative verification records |
| `ClaimEvidenceLinkStore` | Links |
| `ContentClaimReader` | Read content body + hash + Brief refs |
| `ClockPort` / `IdPort` | Time / ids |
| `ActorContextPort` | Trusted actor |
| `ClaimSuggestionPort` (optional) | Advisory AI extraction — never authoritative |

---

## Infrastructure

| Adapter | Classification |
|---------|----------------|
| `LocalClaimEvidenceStore` + `LocalClaimRepository` | Phase 3 LOCAL_AUTHORITATIVE — **IMPLEMENTED** |
| `LocalVerificationStore` | Phase 3 current Verification projection — **IMPLEMENTED** |
| `LocalClaimHistoryAdapter` | Append-only history + override — **IMPLEMENTED** |
| `LocalEvidenceVaultAdapter` / `LocalEvidenceWriter` | Vault ADAPT + local Evidence write — **IMPLEMENTED** |
| `LocalClaimContentReader` | Read-only content context — **IMPLEMENTED** |
| `composeClaimEvidence` | Test/composition seam only (no UI/main wire) — **IMPLEMENTED** |
| `db.ts` EvidenceVault | LEGACY source for vault adapter |
| SPEC-005 gateway suggestion | OPTIONAL advisory |
| Firestore Claim rules | REMOTE_FUTURE / SPEC-009 |

**Dependency direction:** Infrastructure → Application ports + Domain. Domain/Application → Infrastructure = **0**.

---

## UI

**May:** display Claim statuses, evidence links, verification summary, request actions.

**Must not:** set Verification result, clear EVIDENCE_REQUIRED, forge override, mutate Claim status via DOM alone.

Legacy `ClaimSafetyPanel` = **ADAPT** display surface (COMPATIBILITY_ONLY; Phase 4).

Consumer publication seam: `authorizeContentPublicationGate` → Application `AuthorizePublication`.

---

## Cross-SPEC ownership

| Concern | Owner |
|---------|-------|
| Brief authorization | SPEC-003 |
| AI draft generation | SPEC-005 |
| Claim verification / publication claim gate | **SPEC-006** |
| Auth claims / production rules | SPEC-009 |
| Thesis hard blocks text | Thesis model (read by SPEC-006 Domain) |

---

## Architecture bans (enforce in Phase 1/5 tests)

1. Domain imports infrastructure / UI / Firebase → **FAIL**
2. Application imports concrete `db.ts` → **FAIL**
3. UI writes Verification without Application → **FAIL**
4. AI actor sets Verification → **FAIL**
5. SPEC-006 imports mutate Brief/routing/score modules as writers → **FAIL**
6. Confusing SPEC-009 `posturaClaims` into SPEC-006 Domain → **FAIL**
