import { describe, expect, it } from 'vitest';
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

describe('summarizeSourceHealth', () => {
  it('marks healthy when accept rate is good', () => {
    const h = summarizeSourceHealth({ ...base, lastRunFetched: 20, lastRunAccepted: 5 });
    expect(h.status).toBe('HEALTHY');
  });

  it('marks error when source has lastError', () => {
    const h = summarizeSourceHealth({ ...base, status: 'ERROR', lastError: 'RSS_FAILED' });
    expect(h.status).toBe('ERROR');
  });

  it('marks unknown when never polled', () => {
    const h = summarizeSourceHealth(base);
    expect(h.status).toBe('UNKNOWN');
  });
});
