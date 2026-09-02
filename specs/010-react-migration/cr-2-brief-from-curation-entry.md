# CR-2 — SPEC-003 Consumer Authority Remediation

**Class:** `COMPATIBILITY_SECURITY_REMEDIATION`  
**Status:** `COMPLETE`  
**Umbrella:** CR-2 — `createBriefFromCurationEntry` caller snapshot authority  
**Human governance authorization:** APPROVED  
**Authorized base checkpoint:** `85fbdb707eab531d198c154d517ae435d3fb9d45`  
**Timezone:** America/Bogota

---

## Defect remediated

| Item | Before | After |
|------|--------|-------|
| Signature | `{ entry: CurationEntry; destination; briefId?; now? }` | `{ curationEntryId; destination; briefId?; now? }` |
| Caller curation snapshot authority | Caller aggregate trusted for clientId, signalIds, territory, angle, rationale | **0** — authoritative reload via `dbService.getCurationById` |
| Trust order | `entry.clientId` → `buildTrustedBriefContext` | load entry → `entry.clientId` → `requireTenantScope` (CR-3 session org) |
| Production call sites | `main.ts` passed whole `entry` | `curationEntryId` only |
| Unsafe aggregate overload | Active | **0** |

---

## Authority removed

| Caller authority | Final |
|------------------|-------|
| Curation snapshot | **0** |
| Tenant | **0** |
| Organization | **0** |
| Client entitlement | **0** (CR-3 `requireTenantScope`) |
| Actor / role | **0** |
| Thesis | **0** |

**React business authority:** 0 · **SPEC-010 business authority:** 0

---

## Preserved (unchanged)

| Boundary | Status |
|----------|--------|
| SPEC-003 Domain | **0 modifications** |
| SPEC-003 business rules | **0 modifications** |
| CR-3 trusted context | **0 semantic modifications** |
| CR-1 cutover spine | **0 modifications** |
| CR-1 noncutover ownership | **0 modifications** |
| Persistence schema | **0 modifications** |
| New ports | **0** |

---

## Implementation path

```text
curationEntryId
→ dbService.getCurationById (fail if missing)
→ buildTrustedBriefContext(entry.clientId) via requireTenantScope
→ derive Brief input from loaded entry only
→ useCases.create (existing SPEC-003 Application)
→ setCurationStrategicBriefId
```

**Side effects on denial:** Brief creation **0** · `setCurationStrategicBriefId` **0**

---

## Special semantics preserved

| Topic | Rule |
|-------|------|
| `destination` | Caller intent; validated by existing `curationDestinationToAuthorizedAction` |
| `briefId` | Optional; defaults `brief_${entry.id}` from loaded entry |
| `#30 verified flag` | Unchanged — not in CR-2 scope |
| `#33 SaveContentDraft` | Unchanged — not in CR-2 scope |

---

## Tests

`tests/cr2BriefFromCurationEntry.test.ts` — contract, authorization, denial (zero side effects), stale snapshot, CR-3 regression.

---

## Post-remediation status

| Field | Value |
|-------|--------|
| CR-2 | **COMPLETE / FROZEN** |
| T-010-403 / T-010-404 | **BLOCKED_BY_OTHER_PRECONDITION** (#9, #18) |
| Phase 5 | **NOT_AUTHORIZED** |
| P0 / P1 | **0** |

**NEXT ACTION:** `AUTHORIZE_STAGE_B_BLOCKER_CANONICALIZATION` (separate pass for #9, #18)

---

## Checkpoint SHAs

| Role | SHA |
|------|-----|
| Authorized start | `85fbdb707eab531d198c154d517ae435d3fb9d45` |
| Implementation | `3eb548487a425e830a4758244326b78a88481521` |
| Governance content (freeze) | _(this document at freeze commit)_ |
| Tip pin | points at governance content above (not self) |
