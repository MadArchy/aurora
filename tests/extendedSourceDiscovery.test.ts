import { describe, expect, it } from 'vitest';
import { buildExtendedSources } from '../src/domain/extendedSourceDiscoveryCore';
import { youtubeFeedUrlFromProfileUrl } from '../src/domain/youtubeUrlCore';
import type { ProfileKeywords } from '../src/services/sourceDiscovery';

const sampleKeywords: ProfileKeywords = {
  coreEn: ['intellectual property', 'AI adoption', 'patent law'],
  coreEs: ['propiedad intelectual', 'adopción de inteligencia artificial'],
  strong: ['patent', 'uspto', 'ai', 'ia'],
  context: ['legal', 'technology'],
  negative: [],
};

describe('youtubeFeedUrlFromProfileUrl', () => {
  it('resolves channel id URLs', () => {
    expect(
      youtubeFeedUrlFromProfileUrl('https://www.youtube.com/channel/UC1234567890123456789012')
    ).toBe('https://www.youtube.com/feeds/videos.xml?channel_id=UC1234567890123456789012');
  });

  it('resolves playlist URLs', () => {
    expect(
      youtubeFeedUrlFromProfileUrl('https://www.youtube.com/playlist?list=PLabc123xyz')
    ).toBe('https://www.youtube.com/feeds/videos.xml?playlist_id=PLabc123xyz');
  });

  it('returns null for @handle without channel id', () => {
    expect(youtubeFeedUrlFromProfileUrl('https://www.youtube.com/@SomeCreator')).toBeNull();
  });
});

describe('buildExtendedSources', () => {
  it('includes social, youtube and academic kinds', () => {
    const sources = buildExtendedSources(sampleKeywords, { domainBlob: 'intellectual property and AI adoption' });
    const kinds = new Set(sources.map((s) => s.kind));
    expect(kinds.has('SOCIAL')).toBe(true);
    expect(kinds.has('YOUTUBE')).toBe(true);
    expect(kinds.has('ACADEMIC')).toBe(true);
  });

  it('builds pubmed feed for health-related domains', () => {
    const sources = buildExtendedSources(sampleKeywords, { domainBlob: 'medical device patents and health AI' });
    expect(sources.some((s) => s.key === 'academic_pubmed')).toBe(true);
  });

  it('adds YouTube RSS when profile has channel URL', () => {
    const sources = buildExtendedSources(sampleKeywords, {
      profile: { socialLinks: { youtube: 'https://www.youtube.com/channel/UC1234567890123456789012' } },
      domainBlob: 'AI adoption',
    });
    expect(sources.some((s) => s.key === 'youtube_channel_profile')).toBe(true);
  });
});
