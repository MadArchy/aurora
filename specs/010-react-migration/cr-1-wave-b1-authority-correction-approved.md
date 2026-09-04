# CR-1 Wave B1 — #21a Authority Correction (Human Approval)

**Class:** `GOVERNANCE_AUTHORITY_CORRECTION`  
**Status:** `HUMAN_APPROVED` · **B1 IMPLEMENTATION = NOT AUTHORIZED**  
**Authorized base checkpoint:** `2230ffeb5e8464d4d853d4bd6dc0be8b51121ab6`  
**Wave scope:** **#21a signal-backed radar path only** — advisor path **DEFERRED (B2)**  
**Timezone:** America/Bogota

---

## Human governance approval

Human governance authority explicitly approves the CR-1 Wave B1 authority correction described in the **Stale-Authority Governance Decision Package** (read-only review at checkpoint `2230ffeb5e8464d4d853d4bd6dc0be8b51121ab6`).

This approval authorizes **governance correction only**. It does **not** authorize B1 code implementation.

---

## DECISION A — AUTHORIZE_FAIL_CLOSED_AUTHORITATIVE_RELOAD

For the signal-backed `#21a AddToCuration` canonical Application path:

| Requirement | Value |
|---|---|
| Authoritative Signal reload before CurationEntry create | **REQUIRED** |
| Caller / presentation Signal snapshot authority | **0** |
| Signal missing at authoritative reload | CurationEntry write **0** |
| Frozen #21b invocation | **0** |
| Audit | **0** |
| Success toast | **0** |
| Refresh | **0** |
| Caller-snapshot fallback | **PROHIBITED** |
| Handler presentation | Existing-compatible **warning/error** only (no false success) |

**Stale-signal race classification:** `INTENTIONAL_GOVERNED_AUTHORITY_CORRECTION` — legacy orphan/stale CurationEntry from in-memory snapshot is **not** required legacy parity.

---

## DECISION B — AUTHORIZE_WRITE_TIME_EXISTING_DEDUP_RECHECK

| Requirement | Value |
|---|---|
| Application recheck | Existing `clientId + signalId` condition (`isSignalInCuration` semantics) at canonical write authority |
| Classification | `EXISTING_RULE_CANONICALIZATION` — **not** a new Domain rule |
| New DB uniqueness / global invariant / dedup algorithm | **NOT AUTHORIZED** |
| Duplicate detected | second write **0** · #21b **0** · audit **0** · refresh **0** |
| Duplicate UI | info `'Esta señal ya está en la mesa de curación.'` |

**Duplicate-race classification:** `INTENTIONAL_GOVERNED_AUTHORITY_CORRECTION`

---

## Ratified constants

| Constant | Value |
|---|---|
| `CALLER SNAPSHOT AUTHORITY` | **0** |
| `ORPHAN CURATION FROM STALE SIGNAL` | **0** |
| `CONCURRENT DUPLICATE CURATION` | **0** (under existing rule) |
| `NEW DOMAIN RULE` | **0** |
| `NEW APPLICATION BUSINESS BOUNDARY` | **0** |
| `#21b CONTRACT CHANGE` | **0** |

---

## Normal path (unchanged)

`scoreSignal?` (presentation) → canonical `#21a` → frozen `#21b` → `SIGNAL_TO_CURATION` audit → success toast `'Enviada a curación'` → `refreshMain`

Wave A2 `#21b` missing-signal compat shim (after successful `#21a` persist) remains **frozen** and **unchanged**.

---

## B1 Application contract (pre-implementation pin)

**Input:** `{ signalId: string }` — consumer `requestedClientId` as scope hint only, never authority.

**Application derives** from authoritative persisted Signal after gates: organization, client, thesis, title, source, snippet, score, priorityBand, suggestedAction, createdBy.

**Required tests (implementation authorization):**

- TOCTOU: Signal at preload → gone before Application reload → fail-closed, no false success
- Dedup race: presentation check passes → entry appears → Application recheck → duplicate info behavior
- Normal path, cross-tenant, unauthorized role, field mapping, `#21a` → `#21b` order, advisor path unchanged

---

## Explicitly NOT authorized

Advisor `#21a` (B2) · #14 · #15 · #16-R · #16-O · #17 · frozen #20 modifications · frozen #21b modifications · scoring/routing semantic changes · React product work · legacy deletion · host cutover · T-010-603 · T-010-604 · Planner · SPEC-009 production · deployment

---

## Frozen references (unchanged)

| Item | Status |
|---|---|
| #20 | `CANONICALIZED_AND_FROZEN` |
| #21b | `CANONICALIZED_AND_FROZEN` |
| #21a | `DEFERRED` (implementation not started) |
| Registry #21 `CU?` | **NO** until composite complete |

---

## Next action

**AUTHORIZE_CR1_WAVE_B1_SIGNAL_BACKED_ADDTOCURATION** — narrowly scoped implementation authorization only; do not auto-implement Wave B2 or other Execution Delivery IDs.
