import { describe, expect, it } from 'vitest';
import { decideByChannel, resolveGateChannel } from '../src/domain/ingestGateCore';

describe('resolveGateChannel', () => {
  it('detects youtube search and feed urls as VIDEO', () => {
    expect(resolveGateChannel('RSS', 'youtube-search:ai%20law')).toBe('VIDEO');
    expect(resolveGateChannel('VIDEO', 'https://www.youtube.com/feeds/videos.xml?channel_id=UC123')).toBe('VIDEO');
  });

  it('detects academic hosts', () => {
    expect(resolveGateChannel('RSS', 'https://export.arxiv.org/api/query?search_query=all:ai')).toBe('ACADEMIC');
  });
});

describe('decideByChannel', () => {
  it('rejects weak social matches', () => {
    const decision = decideByChannel({
      channel: 'SOCIAL',
      matchedPhrases: [],
      matchedStrong: [],
      matchedContext: ['legal'],
      titleLength: 40,
    });
    expect(decision?.accepted).toBe(false);
  });

  it('accepts academic with a single context hit', () => {
    const decision = decideByChannel({
      channel: 'ACADEMIC',
      matchedPhrases: [],
      matchedStrong: [],
      matchedContext: ['fintech'],
      titleLength: 40,
    });
    expect(decision?.accepted).toBe(true);
  });
});
