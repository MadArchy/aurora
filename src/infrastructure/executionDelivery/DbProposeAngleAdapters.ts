/**
 * TEMPORARY LEGACY ADAPTERS — CR-1 Execution Delivery #15 ProposeAngle.
 */

import type {
  AdvisorCurationAnglePort,
  CurationAnglePersistencePort,
  CurationStrategicBriefReadPort,
  CurationThesisReadPort,
} from '../../application/executionDelivery';
import {
  executeAdvisorCurationAngleViaGateway,
  isAdvisorGatewayAvailable,
} from '../../services/advisorGateway';
import { dbService } from '../../services/db';
import { getStrategicBrief } from '../../services/strategicBriefConsumer';

export function createDbCurationAnglePersistencePort(): CurationAnglePersistencePort {
  return {
    setAngle(curationEntryId, aiAngle) {
      dbService.setCurationAngle(curationEntryId, aiAngle);
    },
  };
}

export function createDbCurationStrategicBriefReadPort(): CurationStrategicBriefReadPort {
  return {
    getById(briefId, clientId) {
      return getStrategicBrief(briefId, clientId);
    },
  };
}

export function createDbCurationThesisReadPort(): CurationThesisReadPort {
  return {
    getById(clientId, thesisId) {
      return dbService.getThesisById(clientId, thesisId);
    },
  };
}

export function createDbAdvisorCurationAnglePort(): AdvisorCurationAnglePort {
  return {
    async generateAngle({ thesis, title, snippet }) {
      if (isAdvisorGatewayAvailable()) {
        try {
          const { output } = await executeAdvisorCurationAngleViaGateway({
            thesis,
            title,
            snippet,
          });
          if (output.angle) {
            return { angle: output.angle, usedLiveModel: true };
          }
        } catch {
          /* legacy gateway failure → deterministic heuristic */
        }
      }

      const audience = thesis.targetAudience || 'tu audiencia';
      const domain = thesis.domain || 'el dominio del cliente';
      return {
        angle: `Qué implica "${title}" para ${audience}: lectura desde ${domain} con las tres decisiones que deberían tomar esta semana.`,
        usedLiveModel: false,
      };
    },
  };
}
