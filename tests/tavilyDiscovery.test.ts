import { describe, expect, it } from 'vitest';

const keywords = {
  coreEn: ['patent law', 'intellectual property'],
  coreEs: ['propiedad intelectual'],
  strong: ['patent', 'uspto'],
  context: ['legal', 'biotech'],
  negative: [],
};

describe('tavilyDiscovery', () => {
  it('builds a profile-aware Tavily query', async () => {
    const { buildTavilySearchQuery } = await import('../src/services/tavilyDiscovery');
    const query = buildTavilySearchQuery(
      { id: 'c1', profession: 'IP Attorney', organizationId: 'org', displayName: 'Juan' } as import('../src/types').Client,
      {
        id: 'th1',
        domain: 'Patentes y PI',
        title: 'Liderazgo en IP para tech',
      } as import('../src/types').PositioningThesis,
      keywords
    );
    expect(query).toMatch(/patent|propiedad|PI/i);
    expect(query.length).toBeLessThanOrEqual(400);
  });

  it('maps Tavily hits to site-scoped Google News feeds', async () => {
    const { mapTavilyResultsToSources } = await import('../src/services/tavilyDiscovery');
    const sources = mapTavilyResultsToSources(
      [
        {
          title: 'USPTO updates patent examination guidance',
          url: 'https://www.ipwatchdog.com/2026/02/uspto-guidance/',
          score: 0.9,
        },
        {
          title: 'IPWatchdog RSS',
          url: 'https://ipwatchdog.com/feed/',
          score: 0.8,
        },
      ],
      keywords
    );

    expect(sources.some((s) => s.kind === 'TAVILY' && s.type === 'RSS')).toBe(true);
    expect(sources.some((s) => s.url.includes('news.google.com'))).toBe(true);
    expect(sources.every((s) => s.key.startsWith('tavily_'))).toBe(true);
  });

  it('skips social and aggregator domains', async () => {
    const { mapTavilyResultsToSources } = await import('../src/services/tavilyDiscovery');
    const sources = mapTavilyResultsToSources(
      [
        { title: 'Post', url: 'https://www.linkedin.com/posts/example', score: 0.5 },
        { title: 'Wiki', url: 'https://en.wikipedia.org/wiki/Patent', score: 0.5 },
      ],
      keywords
    );
    expect(sources.length).toBe(0);
  });

  it('filters entertainment noise for legal IP profiles', async () => {
    const { mapTavilyResultsToSources } = await import('../src/services/tavilyDiscovery');
    const sources = mapTavilyResultsToSources(
      [
        {
          title: 'Movie studio AI deal',
          url: 'https://variety.com/2026/ai-deal',
          score: 0.55,
        },
        {
          title: 'Patent disputes in data centers',
          url: 'https://news.bloomberglaw.com/business-and-practice/data-center-patents',
          score: 0.78,
        },
      ],
      keywords
    );
    expect(sources.some((s) => s.url.includes('bloomberglaw'))).toBe(true);
    expect(sources.some((s) => s.url.includes('variety'))).toBe(false);
  });

  it('builds curated top 3 presets for IP legal profiles', async () => {
    const { buildCuratedTopMediaPresets, isIpLegalProfile } = await import('../src/services/tavilyDiscovery');
    const presets = buildCuratedTopMediaPresets(keywords);
    expect(presets).toHaveLength(3);
    expect(presets.every((p) => p.key.startsWith('curated_ip_legal_'))).toBe(true);
    expect(presets.every((p) => p.url.includes('news.google.com'))).toBe(true);

    const client = {
      id: 'client_juan_001',
      profession: 'Intellectual Property & AI Adoption Attorney',
    } as import('../src/types').Client;
    const thesis = { domain: 'Patentes e IP', title: 'Adopción IA' } as import('../src/types').PositioningThesis;
    expect(isIpLegalProfile(client, thesis, keywords)).toBe(true);
  });
});
