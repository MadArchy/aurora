import type { SourceFeedPort } from '../../application/signalIntake';
import { fetchSourceItems } from '../../services/sourceApi';

export function createHttpSourceFeedPort(): SourceFeedPort {
  return {
    async fetch(url) {
      const { items, error } = await fetchSourceItems(url);
      return { items, error };
    },
  };
}
