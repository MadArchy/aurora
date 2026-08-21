import { describe, expect, it } from 'vitest';
import {
  countUnhealthySources,
  sourceHealthTip,
  sourceRemediationActions,
} from '../src/domain/sourceHealthActionsCore';
import { summarizeSourceHealth } from '../src/services/sourceHealth';
import type { Source } from '../src/types';

const base: Source = {
  id: 'src_1',
  organizationId: 'org',
  clientId: 'c1',
  name: 'Test',
  type: 'RSS',
  url: 'https://example.com/feed',
  fetchIntervalMinutes: 360,
  status: 'ACTIVE',
  itemCount: 0,
  createdAt: '2026-01-01',
  createdBy: 'system',
};

describe('sourceHealthActionsCore', () => {
  it('sugiere pausar fuentes activas y reactivar las pausadas', () => {
    const health = summarizeSourceHealth(base);
    expect(sourceRemediationActions(base, health)).toContain('pause');
    expect(sourceRemediationActions({ ...base, status: 'PAUSED' }, health)).toContain('resume');
    expect(sourceRemediationActions({ ...base, status: 'PAUSED' }, health)).not.toContain('pause');
  });

  it('muestra tip para feeds en error', () => {
    const health = summarizeSourceHealth({ ...base, status: 'ERROR', lastError: 'RSS_FAILED' });
    expect(sourceHealthTip({ ...base, status: 'ERROR', lastError: 'RSS_FAILED' }, health)).toMatch(/reactiva/i);
  });

  it('cuenta fuentes problemáticas', () => {
    const counts = countUnhealthySources(
      [
        base,
        { ...base, id: 'src_2', status: 'ERROR', lastError: 'fail' },
        { ...base, id: 'src_3', status: 'PAUSED' },
        { ...base, id: 'src_4', lastRunFetched: 10, lastRunAccepted: 0 },
      ],
      summarizeSourceHealth
    );
    expect(counts.errors).toBe(1);
    expect(counts.paused).toBe(1);
    expect(counts.degraded).toBeGreaterThanOrEqual(1);
  });
});
