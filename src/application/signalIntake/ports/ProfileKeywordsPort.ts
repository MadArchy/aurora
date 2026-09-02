import type { ProfileKeywords } from '../../../services/sourceDiscovery';

export interface ProfileKeywordsPort {
  forClient(clientId: string): ProfileKeywords;
}
