import { describe, expect, it } from 'vitest';
import {
  parseYoutubeProfileUrl,
  youtubeFeedUrlFromProfileUrl,
  youtubeSearchSourceUrl,
  youtubeSearchQueryFromUrl,
} from '../src/domain/youtubeUrlCore';

describe('parseYoutubeProfileUrl', () => {
  it('parses channel URLs', () => {
    expect(parseYoutubeProfileUrl('https://www.youtube.com/channel/UC1234567890123456789012')).toEqual({
      channelId: 'UC1234567890123456789012',
    });
  });

  it('parses @handle URLs', () => {
    expect(parseYoutubeProfileUrl('https://www.youtube.com/@SomeCreator')).toEqual({ handle: 'SomeCreator' });
  });
});

describe('youtubeFeedUrlFromProfileUrl', () => {
  it('resolves channel id URLs', () => {
    expect(
      youtubeFeedUrlFromProfileUrl('https://www.youtube.com/channel/UC1234567890123456789012')
    ).toBe('https://www.youtube.com/feeds/videos.xml?channel_id=UC1234567890123456789012');
  });

  it('returns null for @handle without API', () => {
    expect(youtubeFeedUrlFromProfileUrl('https://www.youtube.com/@SomeCreator')).toBeNull();
  });
});

describe('youtube search source url', () => {
  it('roundtrips query encoding', () => {
    const url = youtubeSearchSourceUrl('AI adoption patent tutorial');
    expect(youtubeSearchQueryFromUrl(url)).toBe('AI adoption patent tutorial');
  });
});
