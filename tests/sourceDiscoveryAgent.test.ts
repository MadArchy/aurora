import { describe, expect, it, beforeEach } from 'vitest';

describe('normalizeSourceUrl', () => {
  it('deduplicates Google News queries ignoring locale params', async () => {
    const { normalizeSourceUrl } = await import('../src/services/sourceDiscovery');
    const a = 'https://news.google.com/rss/search?q=patent+law+when%3A14d&hl=en-US&gl=US';
    const b = 'https://news.google.com/rss/search?q=patent+law+when%3A14d&hl=es-419&gl=MX';
    expect(normalizeSourceUrl(a)).toBe(normalizeSourceUrl(b));
  });

  it('normalizes host paths for official feeds', async () => {
    const { normalizeSourceUrl } = await import('../src/services/sourceDiscovery');
    expect(normalizeSourceUrl('https://www.uspto.gov/rss.xml')).toBe('uspto.gov/rss.xml');
  });
});

describe('sourceDiscoveryAgent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns prioritized recommendations for Juan demo client', async () => {
    const { dbService } = await import('../src/services/db');
    const { runSourceDiscoveryAgent } = await import('../src/services/sourceDiscoveryAgent');

    const client = dbService.getClientById('client_juan_001');
    expect(client).toBeTruthy();
    const thesis = dbService.getThesesByClient('client_juan_001').find((t) => t.status === 'ACTIVE');
    const run = runSourceDiscoveryAgent(client!, thesis);
    expect(run.recommendations.length).toBeGreaterThan(0);
    expect(run.recommendations[0].agentRationale.length).toBeGreaterThan(10);
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(run.recommendations[0].priority);
  });

  it('excludes already registered sources from pending list', async () => {
    const { dbService } = await import('../src/services/db');
    const { pendingDiscoveries } = await import('../src/services/sourceDiscovery');

    const client = dbService.getClientById('client_juan_001');
    const thesis = dbService.getThesesByClient('client_juan_001').find((t) => t.status === 'ACTIVE');
    const first = pendingDiscoveries(client!, thesis)[0];
    expect(first).toBeTruthy();

    dbService.addSource({
      organizationId: client!.organizationId,
      clientId: client!.id,
      thesisId: thesis?.id,
      name: first.name,
      type: first.type,
      url: first.url,
      fetchIntervalMinutes: 360,
      status: 'ACTIVE',
      createdBy: 'test',
    });

    const pendingAfter = pendingDiscoveries(client!, thesis);
    expect(pendingAfter.some((p) => p.key === first.key)).toBe(false);
  });

  it('detects profile changes between agent runs', async () => {
    const { dbService } = await import('../src/services/db');
    const {
      profileChangedSinceLastRun,
      runSourceDiscoveryAgent,
      saveAgentRun,
    } = await import('../src/services/sourceDiscoveryAgent');

    const client = dbService.getClientById('client_juan_001');
    const thesis = dbService.getThesesByClient('client_juan_001').find((t) => t.status === 'ACTIVE');
    const run = runSourceDiscoveryAgent(client!, thesis);
    saveAgentRun(run);
    expect(profileChangedSinceLastRun(client!, thesis, run)).toBe(false);
  });
});
