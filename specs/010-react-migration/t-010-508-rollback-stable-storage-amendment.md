# T-010-508 — Rollback Stable Storage Governance Amendment

**Human decision:** `DECISION B = AUTHORIZE_CANONICAL_JSON_OBJECT_KEY_NORMALIZATION`  
**Classification:** `NARROW T508 GOVERNANCE AMENDMENT` (not a test flake fix)  
**Starting checkpoint:** `34b5660a3440ad2d1d88c5d25ed57fa2b297ab7c`  
**T508 stability patch SHA:** `1f6bab09b1a52e6a3c9f97ed224bfecf0b709b3b`

---

## Post-amendment evidence (@ patch SHA)

| Gate | Result |
|------|--------|
| Focused comparator (`tests/e2eRollbackStableSnapshot.test.ts`) | **13/13 PASS** |
| Isolated T508 rollback test (previously failing) | **1/1 PASS** |
| Full T508 Playwright | **10/10 PASS** |
| Combined Stage-B + T508 | **21/21 PASS** |

**Production files modified:** **0**

## Frozen business invariant (unchanged)

T508 rollback must not mutate **canonical business/storage state** during React ↔ legacy presentation rollback.

Rollback remains a presentation switch only. No data migration. No business-field mutation tolerance.

---

## Representation rule (amended)

| Value type | Comparison rule |
|------------|-----------------|
| Valid JSON in stable rollback keys | Parse → recursively canonicalize **object** key order → preserve **array** order and all values → compare canonical serialized form |
| Non-JSON stable values | Exact raw string equality |

This amendment permits **JSON object property order normalization only**.

It does **not** authorize:

- array order normalization
- timestamp / ID / count / field-value masking
- LOGIN / LOGOUT / audit filtering
- excluding `postura_audit_logs` or notifications
- new volatile-key exclusions beyond the frozen three

---

## Authorized volatile-key exclusions (unchanged)

| Key | Reason |
|-----|--------|
| `postura_ui_mode` | Presentation toggle |
| `postura_source_agent_v1` | Presentation-only scheduler cache |
| `postura_source_automation_v1` | Presentation-only scheduler cache |

---

## Implementation surface (test-only)

| File | Role |
|------|------|
| `e2e/helpers/spec010Auth.ts` | `canonicalizeJsonStorageValue`, `canonicalizeRollbackStableSnapshot`, canonicalized `rollbackStableSnapshot()` |
| `tests/e2eRollbackStableSnapshot.test.ts` | Focused comparator PASS/FAIL invariant tests |

**Production files modified by this amendment:** **0**

---

## Evidence context

Deterministic failure before amendment: `postura_notifications_v4` differed only in JSON object key insertion order after auth-bootstrap re-serialization; semantic notification content unchanged. `postura_audit_logs` byte-identical at reproduction HEAD. B6 implementation did not touch notification/auth/audit persistence.
