import { describe, expect, it } from 'vitest';
import { gateItem } from '../src/services/ingestFilter';
import type { Source } from '../src/types';

const baseSource: Source = {
  id: 'src_1',
  organizationId: 'org_aurora_01',
  clientId: 'client_juan_001',
  name: 'Google News',
  url: 'https://news.google.com/rss/search?q=ai+regulation',
  type: 'MEDIA',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: 'system',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'system',
};

const keywords = {
  coreEn: ['artificial intelligence regulation'],
  coreEs: ['regulacion de inteligencia artificial'],
  strong: ['nist', 'uspto', 'compliance'],
  context: ['fintech', 'healthcare', 'legal'],
  negative: [] as string[],
};

describe('gateItem', () => {
  it('requires profile match for Google News query feeds', () => {
    const unrelated = gateItem(
      { title: 'Sports championship finals recap', snippet: 'Scores and highlights' },
      keywords,
      baseSource
    );
    expect(unrelated.accepted).toBe(false);

    const related = gateItem(
      { title: 'New NIST compliance guidance for AI systems', snippet: 'Regulation update' },
      keywords,
      baseSource
    );
    expect(related.accepted).toBe(true);
  });

  it('rejects very short titles', () => {
    const result = gateItem({ title: 'Short' }, keywords, { ...baseSource, url: 'https://example.com/rss' });
    expect(result.accepted).toBe(false);
  });

  it('rejects items matching topicsToAvoid from profile', () => {
    const withAvoid = {
      ...keywords,
      negative: ['experts in artificial intelligence', 'patent attorney only'],
    };
    const result = gateItem(
      { title: 'New trends for experts in artificial intelligence hype cycle', snippet: 'Market report' },
      withAvoid,
      baseSource
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/evitar/i);
  });

  it('applies stricter VIDEO channel rules', () => {
    const videoSource = { ...baseSource, type: 'VIDEO' as const, url: 'youtube-search:ai%20patent', name: 'YouTube API' };
    const weak = gateItem(
      { title: 'Casual vlog about office furniture and coffee setups', snippet: 'Daily life' },
      keywords,
      videoSource
    );
    expect(weak.accepted).toBe(false);

    const strong = gateItem(
      { title: 'NIST compliance guidance for AI systems explained', snippet: 'Tutorial on regulation' },
      keywords,
      videoSource
    );
    expect(strong.accepted).toBe(true);
  });

  it('is more permissive for ACADEMIC sources', () => {
    const academic = {
      ...baseSource,
      type: 'ACADEMIC' as const,
      url: 'https://export.arxiv.org/api/query?search_query=all:ai',
      name: 'arXiv',
    };
    const result = gateItem(
      { title: 'A survey of fintech risk models in regulated markets', snippet: 'Working paper' },
      keywords,
      academic
    );
    expect(result.accepted).toBe(true);
  });
});
