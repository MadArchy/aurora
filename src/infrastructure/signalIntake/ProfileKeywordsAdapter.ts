import type { ProfileKeywordsPort } from '../../application/signalIntake';
import { buildMergedProfileKeywords } from '../../services/sourceDiscovery';
import { dbService } from '../../services/db';

export function createDbProfileKeywordsPort(): ProfileKeywordsPort {
  return {
    forClient(clientId) {
      const client = dbService.getClientById(clientId);
      if (!client) {
        return { coreEn: [], coreEs: [], strong: [], context: [], negative: [] };
      }
      return buildMergedProfileKeywords(client, dbService.getActiveTheses(client.id));
    },
  };
}
