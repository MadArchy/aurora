# CR-1 Wave B9 — Role / Reachability Acceptance Evidence Reconciliation

**Status:** `RECONCILED` · B9 formal acceptance evidence restored  
**Timezone:** America/Bogota

---

## Finding

The initial B9 closure report (`cr-1-wave-b9-create-content-draft.md`) labeled:

`ROLE/REACHABILITY GUARDS = 1/1 PASS (B9 suite)`

That count referred **only** to the single test inside:

`describe('CR-1 Wave B9 #33 — role reachability architecture guards')`

It did **not** replace the historical per-wave **4-test presentation architecture guard block** used in B5/B6, and it omitted B9 **application-layer role denial tests** already present in `describe('CR-1 Wave B9 #33 — core authority')`.

**Classification:** `B. HISTORICAL_4_RUN_BUT_REPORT_MISLABELED`

- Historical B5/B6 4-test architecture suites **still exist** and **still pass** (not deleted, not weakened).
- B9 did **not** refactor the historical suites to 1 test.
- B9 reporting under-counted B9-specific role evidence by filtering to one describe block only.

**Role guard test weakening:** `NO` (verified `68e4695..1b4864d` — no deletion/rename/reduction of B5/B6 role suites).

---

## Historical 4/4 suite (frozen reference pattern)

| File | Describe block | Tests |
|------|----------------|-------|
| `tests/cr1WaveB5ProposeAngle.test.ts` | `CR-1 Wave B5 #15 — role reachability architecture guards` | 4 |
| `tests/cr1WaveB6RemoveReopenCuration.test.ts` | `CR-1 Wave B6 #16 — role reachability architecture guards` | 4 |

**Historical test names (each wave):**

1. `ADMIN legacy main view can reach ClientWorkspace deliver surface`
2. `CLIENT portal render path does not emit [wave-specific control]`
3. `React workspace page blocks non-admin before deliver panel`
4. `missing session legacy renderMainView returns empty for unauthenticated user`

**Re-run (reconciliation):** **4/4 PASS** (B5) · **4/4 PASS** (B6)

---

## B9 role / reachability evidence (correct count)

### Presentation architecture guard (1)

| File | Test | Proves |
|------|------|--------|
| `tests/cr1WaveB9CreateContentDraft.test.ts` | `ADMIN workspace can reach generate-content modal surface` | ADMIN-only legacy workspace exposes `#33` generate entry (`btn-open-generate-content`, `showCreate: true`) |

**Re-run:** **1/1 PASS**

### Application authority guards (3 role-focused tests in core authority)

| Test | Invariants |
|------|------------|
| `ADMIN valid FORM_GENERATE — gate before generation before persist` | ADMIN valid path · write after auth · AI after auth |
| `CLIENT, missing session, and cross-tenant denied before generation` | CLIENT denied · missing session denied · cross-tenant denied · AI before auth = 0 · write before auth = 0 |
| `caller Brief/thesis/status/contentId spoof denied` | caller tenant/Brief/status/contentId authority = 0 · AI before auth = 0 |

**Re-run:** **3/3 PASS** (role-focused subset of core authority **4/4 PASS**)

### Static Application boundary guard

| Test | Invariants |
|------|------------|
| `CreateContentDraft does not mutate tasks or recommendations` | `requireAdminRole` present · no #27 mutation inside Application |

---

## Invariant coverage map

| Invariant | B9 test | Result |
|-----------|---------|--------|
| ADMIN valid path | `ADMIN valid FORM_GENERATE` | PASS |
| CLIENT denied | `CLIENT, missing session, and cross-tenant denied` | PASS |
| missing session denied | same | PASS |
| cross-tenant denied | same | PASS |
| caller tenant authority = 0 | spoof + cross-tenant tests | PASS |
| caller role authority = 0 | `requireAdminRole` + CLIENT consumer denial | PASS |
| caller actor authority = 0 | spoof denied (claimed fields rejected) | PASS |
| AI before auth = 0 | spoof/failure tests (`getGenerateCalls() === 0`) | PASS |
| write before auth = 0 | denial tests (`getCreateCalls() === 0`) | PASS |

**ROLE/REACHABILITY INVARIANT COVERAGE = COMPLETE**

---

## Combined focused re-run (reconciliation)

| Suite | Result |
|-------|--------|
| B5 historical architecture guards | **4/4 PASS** |
| B6 historical architecture guards | **4/4 PASS** |
| B9 architecture guard | **1/1 PASS** |
| B9 core authority (role-focused) | **3/3 PASS** |
| **B9-specific role evidence (non-overlapping)** | **4/4 PASS** |
| **Frozen historical architecture guards (B5+B6)** | **8/8 PASS** |

---

## Git provenance

| Role | SHA |
|------|-----|
| B9 starting checkpoint | `68e469560e648a2485faff58e5162199fc16c7b9` |
| B9 implementation | `1b4864d7abb315b2e47a1b6273fc2df25c61d9b7` |
| Reported premature acceptance | `fd77e13a079281c54ae7fc0ec35b5c0d9b13201d` (preserved, not rewritten) |
| Pre-reconciliation governance tip | `668cebfd119cbfa6815b2b545ffed7edc8d961fe` |
| B9 final acceptance reconciliation | *(this commit)* |

| Parent | SHA |
|--------|-----|
| `1b4864d^` | `68e469560e648a2485faff58e5162199fc16c7b9` |
| `fd77e13^` | `1b4864d7abb315b2e47a1b6273fc2df25c61d9b7` |
| `668cebf^` | `fd77e13a079281c54ae7fc0ec35b5c0d9b13201d` |

**Post-implementation governance commits:** production **0** · tests **0**

---

## Corrected B9 role reporting

Replace premature label:

~~`ROLE/REACHABILITY GUARDS = 1/1 PASS (B9 suite)`~~

With:

- **B9 presentation architecture guard:** 1/1 PASS  
- **B9 application role guards (core authority):** 3/3 PASS  
- **B9 role evidence total (non-overlapping):** **4/4 PASS**  
- **Frozen B5/B6 architecture guards:** 8/8 PASS (unchanged)

---

## Consequence

B9 formal acceptance is **restored** with reconciled role/reachability evidence.  
**#33** remains **CANONICALIZED_AND_FROZEN**.  
**Next action:** `CR1_WAVE_B10_27_TASK_AUTHORIZATION_REVIEW`
