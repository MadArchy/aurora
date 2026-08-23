# SPEC-009 Phase 4 / 4.1 — Secret exposure review (sanitized)

**Scanner:** `npm run secret:scan` (local inventory; gitleaks not on PATH).  
**Dates:** 2026-08-22 (Phase 4) · 2026-08-22 (Phase 4.1 ops closure)  
**Rule:** This file must never contain private key material.

## Findings (post Phase 4.1)

| Classification | Category | Location | Rotation required |
|----------------|----------|----------|-------------------|
| VALID SECRET NOT EXPOSED | firebase-service-account | known SA paths (gitignore; not in git index) | **NO** |
| VALID SECRET NOT EXPOSED | firebase-service-account-history | git history for known SA paths | **NO** (no commits) |
| DEMO/NON-SECRET | firebase-service-account-local | repo tree | **NO** — **no in-repo SA file** after ops closure |
| FALSE POSITIVE | private-key-pattern | tracked text files | **NO** |
| DEMO/NON-SECRET | archives | repo tree | **NO** (no zip/rar/7z under clone) |

## Ops closure (Phase 4.1)

- Active credential relocated to **external** directory category: `%USERPROFILE%\.firebase-credentials\` (outside clone).
- `GOOGLE_APPLICATION_CREDENTIALS` points at that external file.
- In-repo `AURORA/secrets/firebase-sa.json` **removed** after external copy verified.
- `npm run firebase:prep` with external path: **PASS**.
- Prep-check previously rejected the in-repo copy while it still existed (`Service account NOT inside repo tree` FAIL) — policy proven without restoring the file.

## Decision

- **Confirmed exposed valid credential in git/history/archives:** **NO**
- **Production credential rotation required:** **NO**
- **SEC-009-012 / A10 physical closure:** **PASS** (credential not inside repository tree)

## Commands

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="$env:USERPROFILE\.firebase-credentials\firebase-sa.json"
npm run firebase:prep
npm run secret:scan
```
