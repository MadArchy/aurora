import type { FeedItem } from '../../../services/ingestFilter';

export interface SourceFeedPort {
  fetch(url: string): Promise<{ items: FeedItem[]; error?: string }>;
}
