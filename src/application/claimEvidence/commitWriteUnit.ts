import type { ClaimHistoryPort } from './ports/ClaimHistoryPort';
import type { ClaimRepository, ClaimWriteUnit } from './ports/ClaimRepository';
import { mapPortFailure } from './mapDomainError';

export function commitClaimWriteUnit(
  claims: ClaimRepository,
  history: ClaimHistoryPort,
  unit: ClaimWriteUnit
): void {
  try {
    claims.commitWriteUnit(unit);
    for (const entry of unit.history) {
      history.append(entry);
    }
    if (unit.overrideAudit && history.appendOverride) {
      history.appendOverride(unit.overrideAudit);
    }
  } catch (err) {
    mapPortFailure(err, 'Failed to persist Claim write unit.');
  }
}
