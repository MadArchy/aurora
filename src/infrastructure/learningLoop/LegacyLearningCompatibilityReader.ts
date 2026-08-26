/**
 * SPEC-008 Phase 3 — Legacy signal_outcomes / results / feedback COMPATIBILITY readers.
 * Does NOT become canonical authority. Ambiguous rows → MIGRATION_REVIEW_REQUIRED.
 * Does not modify db.ts / consumer wiring.
 */

import type { StorageLike } from './LocalLearningLoopStore';
import {
  LEGACY_FEEDBACK_V1_KEY,
  LEGACY_RESULTS_V5_KEY,
  LEGACY_SIGNAL_OUTCOMES_KEY,
} from './storeKeys';

export type LegacyLearningMigrationDisposition =
  | 'MAPPED'
  | 'MIGRATION_REVIEW_REQUIRED'
  | 'SKIPPED_MALFORMED';

export interface LegacyLearningCompatibilityRecord {
  legacyId: string;
  legacyKind: 'SIGNAL_OUTCOME' | 'RESULT_RECORD' | 'FEEDBACK_EVENT';
  organizationId?: string;
  clientId?: string;
  thesisId?: string;
  disposition: LegacyLearningMigrationDisposition;
  reason?: string;
  /** Never treated as LearningObservation authority. */
  authority: 'COMPATIBILITY_ONLY';
}

function readLegacyArray(kv: StorageLike, key: string): unknown[] | 'MALFORMED' {
  const raw = kv.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return 'MALFORMED';
    return parsed;
  } catch {
    return 'MALFORMED';
  }
}

function mapRow(
  row: unknown,
  legacyKind: LegacyLearningCompatibilityRecord['legacyKind'],
  legacyIdField: string
): LegacyLearningCompatibilityRecord {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return {
      legacyId: 'unknown',
      legacyKind,
      disposition: 'SKIPPED_MALFORMED',
      reason: 'non-object legacy row',
      authority: 'COMPATIBILITY_ONLY',
    };
  }
  const record = row as Record<string, unknown>;
  const legacyId =
    typeof record[legacyIdField] === 'string'
      ? record[legacyIdField]
      : typeof record.id === 'string'
        ? record.id
        : 'unknown';
  const organizationId =
    typeof record.organizationId === 'string' ? record.organizationId : undefined;
  const clientId = typeof record.clientId === 'string' ? record.clientId : undefined;
  const thesisId =
    typeof record.thesisId === 'string'
      ? record.thesisId
      : typeof record.thesis === 'string'
        ? record.thesis
        : undefined;

  if (!organizationId || !clientId) {
    return {
      legacyId,
      legacyKind,
      organizationId,
      clientId,
      thesisId,
      disposition: 'MIGRATION_REVIEW_REQUIRED',
      reason: 'missing tenant envelope on legacy row',
      authority: 'COMPATIBILITY_ONLY',
    };
  }

  if (!thesisId && legacyKind !== 'FEEDBACK_EVENT') {
    return {
      legacyId,
      legacyKind,
      organizationId,
      clientId,
      disposition: 'MIGRATION_REVIEW_REQUIRED',
      reason: 'ambiguous thesis scope on legacy row',
      authority: 'COMPATIBILITY_ONLY',
    };
  }

  return {
    legacyId,
    legacyKind,
    organizationId,
    clientId,
    thesisId,
    disposition: 'MAPPED',
    authority: 'COMPATIBILITY_ONLY',
  };
}

/**
 * Read-only compatibility projection of legacy outcome/result/feedback stores.
 */
export class LegacyLearningCompatibilityReader {
  constructor(private readonly kv: StorageLike) {}

  listSignalOutcomeCompatibility(): LegacyLearningCompatibilityRecord[] {
    const rows = readLegacyArray(this.kv, LEGACY_SIGNAL_OUTCOMES_KEY);
    if (rows === 'MALFORMED') {
      return [
        {
          legacyId: '*',
          legacyKind: 'SIGNAL_OUTCOME',
          disposition: 'SKIPPED_MALFORMED',
          reason: 'legacy signal outcomes JSON malformed',
          authority: 'COMPATIBILITY_ONLY',
        },
      ];
    }
    return rows.map((row) => mapRow(row, 'SIGNAL_OUTCOME', 'signalId'));
  }

  listResultRecordCompatibility(): LegacyLearningCompatibilityRecord[] {
    const rows = readLegacyArray(this.kv, LEGACY_RESULTS_V5_KEY);
    if (rows === 'MALFORMED') {
      return [
        {
          legacyId: '*',
          legacyKind: 'RESULT_RECORD',
          disposition: 'SKIPPED_MALFORMED',
          reason: 'legacy results JSON malformed',
          authority: 'COMPATIBILITY_ONLY',
        },
      ];
    }
    return rows.map((row) => mapRow(row, 'RESULT_RECORD', 'resultId'));
  }

  listFeedbackEventCompatibility(): LegacyLearningCompatibilityRecord[] {
    const rows = readLegacyArray(this.kv, LEGACY_FEEDBACK_V1_KEY);
    if (rows === 'MALFORMED') {
      return [
        {
          legacyId: '*',
          legacyKind: 'FEEDBACK_EVENT',
          disposition: 'SKIPPED_MALFORMED',
          reason: 'legacy feedback JSON malformed',
          authority: 'COMPATIBILITY_ONLY',
        },
      ];
    }
    return rows.map((row) => mapRow(row, 'FEEDBACK_EVENT', 'feedbackId'));
  }

  listAllCompatibilityRecords(): LegacyLearningCompatibilityRecord[] {
    return [
      ...this.listSignalOutcomeCompatibility(),
      ...this.listResultRecordCompatibility(),
      ...this.listFeedbackEventCompatibility(),
    ];
  }
}

export function createLegacyLearningCompatibilityReader(
  kv: StorageLike
): LegacyLearningCompatibilityReader {
  return new LegacyLearningCompatibilityReader(kv);
}
