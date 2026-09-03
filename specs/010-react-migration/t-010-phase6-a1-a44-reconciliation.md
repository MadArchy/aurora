# SPEC-010 T-601 — A1–A44 acceptance matrix reconciliation

**Task:** T-010-601 · **Reconciled:** 44/44 · **False promotions:** 0  
**Evidence parent:** `t-010-phase6-pre-removal-gates.md`

Legend — **Blocks T601/T602:** reconciliation task itself (not criterion failure).  
**Must PASS for CODE_COMPLETE:** all Required (A\*) per `acceptance.md`.

| ID | Requirement (short) | Entry | Current evidence | Status | Owner | Remaining condition | External dep | T603 dep | T604 dep | CODE_COMPLETE? | Blk T601 | Blk T602 | Blk T603 | Blk T604 |
|----|---------------------|-------|------------------|--------|-------|---------------------|--------------|----------|----------|----------------|----------|----------|----------|----------|
| A1 | Constitutional strangler purpose | PASS | spec.md, §23–26 | **PASS** | Gov | — | — | No | No | Yes | No | No | No | No |
| A2 | Exact target stack | PASS | T-101, package.json | **PASS** | P1 | — | — | No | No | Yes | No | No | No | No |
| A3 | No big-bang | PASS | toggle coexistence | **PASS** | Gov | — | — | No | No | Yes | No | No | No | No |
| A4 | §24 seven-step order | PASS | ui-architecture mapping | **PASS** | Gov | — | — | No | No | Yes | No | No | No | No |
| A5 | Behavior preserved | PARTIAL | E2E rollback; 0 logic rewrite | **PARTIAL** | P5/P6 | Per-module cutover parity | — | **Yes** | Indirect | Yes | No | No | Yes | Yes |
| A6 | UI write authority 0 | PARTIAL | ARCH scans | **PARTIAL** | P1–5 | Widen per wave | — | No | No | Yes | No | No | No | Yes |
| A7 | No new domain aggregate | PASS | no domain-model | **PASS** | P0 | — | — | No | No | Yes | No | No | No | No |
| A8 | React→dbService 0 | PARTIAL | facade-only in ui | **PARTIAL** | P2–5 | Scope widens | — | No | No | Yes | No | No | No | Yes |
| A9 | Canonical read boundary | PARTIAL | hooks→facade | **PARTIAL** | P2–5 | All reads declared | — | No | No | Yes | No | No | No | Yes |
| A10 | Canonical command boundary | PARTIAL | commandSeam | **PARTIAL** | P2–5 | Strategic cmds partial | — | No | No | Yes | No | No | No | Yes |
| A11 | Cache non-authoritative | PARTIAL | staleTime 0; T-502 | **PARTIAL** | P2/5 | — | — | No | No | Yes | No | No | No | Yes |
| A12 | Presentation state non-auth | PARTIAL | tab/filter only | **PARTIAL** | P2 | — | — | No | No | Yes | No | No | No | Yes |
| A13 | Form/Zod non-auth | PARTIAL | T-501 shape-only | **PARTIAL** | P2/5 | — | — | No | No | Yes | No | No | No | Yes |
| A14 | No optimistic mutations | PARTIAL | ARCH 0 optimistic | **PARTIAL** | P2 | — | — | No | No | Yes | No | No | No | Yes |
| A15 | No stale cache authority | PARTIAL | T-502 | **PARTIAL** | P2/5 | — | — | No | No | Yes | No | No | No | Yes |
| A16 | Trusted tenant | PARTIAL | T-501; branded scope | **PARTIAL** | P1/5 | — | — | No | No | Yes | No | No | No | Yes |
| A17 | Trusted actor | PARTIAL | T-501; no setter | **PARTIAL** | P1/5 | — | — | No | No | Yes | No | No | No | Yes |
| A18 | No role escalation | PARTIAL | T-501 | **PARTIAL** | P1/5 | — | — | No | No | Yes | No | No | No | Yes |
| A19 | Tenant-safe query keys | PARTIAL | T-502 runtime | **PARTIAL** | P2/5 | — | — | No | No | Yes | No | No | No | Yes |
| A20 | Multi-thesis native | PARTIAL | T-507 | **PARTIAL** | P2/5 | — | — | No | No | Yes | No | No | No | Yes |
| A21 | Non-auth defaults | PARTIAL | empty selectors | **PARTIAL** | P3 | Full command set | — | No | No | Yes | No | No | No | Yes |
| A22 | SPEC-001 preserved | PARTIAL | display routingState | **PARTIAL** | P3 | — | — | No | No | Yes | No | No | No | Yes |
| A23 | SPEC-002 preserved | PARTIAL | T-505 0 formulas | **PARTIAL** | P3/5 | — | — | No | No | Yes | No | No | No | Yes |
| A24 | SPEC-003 preserved | PARTIAL | brief consumer; CR-2 closed | **PARTIAL** | P3 | Brief creation UI legacy | CR-2 done | No | No | Yes | No | No | No | Yes |
| A25 | SPEC-004 preserved | **PENDING** | no plan React surface | **PENDING** | **SPEC-004 / product** | Planner UI | **Planner** | No | **Yes** | Yes | No | No | No | **Yes** |
| A26 | SPEC-005 preserved | PARTIAL | 0 provider in ui | **PARTIAL** | P1 | — | — | No | No | Yes | No | No | No | Yes |
| A27 | SPEC-006 preserved | PARTIAL | display verdict only | **PARTIAL** | P3 | Publication gate legacy | — | No | No | Yes | No | No | No | Yes |
| A28 | SPEC-007 preserved | PARTIAL | canonical consumer | **PARTIAL** | P2 | — | — | No | No | Yes | No | No | No | Yes |
| A29 | SPEC-008 preserved | PARTIAL | intent only; T-504 | **PARTIAL** | P3/5 | — | — | No | No | Yes | No | No | No | Yes |
| A30 | SPEC010→008 mutation 0 | PARTIAL | registerSignalOutcomeIntent | **PARTIAL** | P3 | — | — | No | No | Yes | No | No | No | Yes |
| A31 | SPEC-009 boundary | **PENDING** | rules 91/91 local | **PENDING** | **SPEC-009 prod** | Production security review | **Production** | No | **Yes** | Yes | No | No | No | **Yes** |
| A32 | React→store write 0 | PARTIAL | ARCH | **PARTIAL** | P2/5 | — | — | No | No | Yes | No | No | No | Yes |
| A33 | React→Firestore write 0 | PARTIAL | ARCH | **PARTIAL** | P2/5 | — | — | No | No | Yes | No | No | No | Yes |
| A34 | No logic in hooks | PARTIAL | T-505 duplication 0 | **PARTIAL** | P5 | Cutover not required for proof | — | No | No | Yes | No | No | No | Yes |
| A35 | No dual command | PARTIAL | T-506 | **PARTIAL** | P4/5 | — | — | No | No | Yes | No | No | No | Yes |
| A36 | No dual read | PARTIAL | one source per hook | **PARTIAL** | P2 | — | — | No | No | Yes | No | No | No | Yes |
| A37 | Single auth authority | PARTIAL | T-506 | **PARTIAL** | P1/5 | — | — | No | No | Yes | No | No | No | Yes |
| A38 | No competing DOM | PASS | ARCH + E2E + T-508 | **PASS** | P1/5 | — | — | No | No | Yes | No | No | No | No |
| A39 | main.ts bootstrap | PASS | T-404; 15 lines | **PASS** | P4 | — | — | No | No | Yes | No | No | No | No |
| A40 | Migration matrix | PASS | migration-matrix.md | **PASS** | P0 | Update at T-603 | — | Yes | No | Yes | No | No | Yes | Yes |
| A41 | Behavioral parity | PARTIAL | 12/18 dims; T-508 | **PARTIAL** | P5/P6 | 0 FULL CUTOVER | — | **Yes** | Yes | Yes | No | No | Yes | Yes |
| A42 | E2E harness | PARTIAL | **21/21** Playwright | **PARTIAL** | P5 | Full cutover journeys | — | No | No | Yes | No | No | No | Yes |
| A43 | Legacy removed after gate | PARTIAL | rollback proven; 0 removed | **PARTIAL** | P6 | **T-603** | CR-1 subset | **Yes** | Yes | Yes | No | No | **Yes** | Yes |
| A44 | Full regression CODE_COMPLETE | **PENDING** | T-602 gate PASS | **PENDING** | P6 | Required A* + T-604 | — | No | **Yes** | Yes | No | No | No | **Yes** |

**T602 REGRESSION_GATE_PASS** · **A44_FORMAL_PASS = NO** (Required A* incomplete).
