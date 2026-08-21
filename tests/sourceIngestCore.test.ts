import { describe, expect, it } from 'vitest';
import {
  isSourceEligibleForIngest,
  isSourceIngestProxyReady,
  labelSourceRunError,
  SOURCE_ERROR_RETRY_MS,
} from '../src/domain/sourceIngestCore';

describe('sourceIngestCore', () => {
  it('blocks RSS proxy on GitHub Pages without Functions base', () => {
    expect(isSourceIngestProxyReady({ hostname: 'madarchy.github.io' })).toBe(false);
    expect(
      isSourceIngestProxyReady({
        hostname: 'madarchy.github.io',
        functionsBase: 'https://us-central1-aurora-postura-app.cloudfunctions.net',
      })
    ).toBe(true);
    expect(isSourceIngestProxyReady({ hostname: '127.0.0.1' })).toBe(true);
  });

  it('retries ERROR sources after cooldown, not immediately', () => {
    const now = Date.parse('2026-08-21T12:00:00Z');
    expect(
      isSourceEligibleForIngest(
        {
          url: 'https://example.com/feed',
          status: 'ERROR',
          lastFetchedAt: new Date(now - 60_000).toISOString(),
          fetchIntervalMinutes: 360,
        },
        now
      )
    ).toBe(false);
    expect(
      isSourceEligibleForIngest(
        {
          url: 'https://example.com/feed',
          status: 'ERROR',
          lastFetchedAt: new Date(now - SOURCE_ERROR_RETRY_MS).toISOString(),
          fetchIntervalMinutes: 360,
        },
        now
      )
    ).toBe(true);
  });

  it('labels proxy errors for the manager', () => {
    expect(labelSourceRunError('SOURCE_PROXY_UNAVAILABLE')).toMatch(/proxy/i);
  });
});
