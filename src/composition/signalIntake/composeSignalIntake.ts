import {
  createPollAllActiveSources,
  createPollRegisteredSource,
  createRegisterManualSignal,
  createRegisterSource,
  type PostIngestRoutingPort,
  type ProfileKeywordsPort,
  type SignalIntakePort,
  type SourceFeedPort,
  type SourceRegistryPort,
} from '../../application/signalIntake';
import {
  createDbProfileKeywordsPort,
  createDbSignalIntakePort,
  createDbSourceRegistryPort,
  createHttpSourceFeedPort,
} from '../../infrastructure/signalIntake';
import { createStrategicSignalRoutingUseCases } from '../strategicSignalRouting/composeStrategicSignalRouting';
import { StrategicRoutingError } from '../../application/strategicSignalRouting';

function createDefaultPostIngestRouting(): PostIngestRoutingPort {
  const strategicRouting = createStrategicSignalRoutingUseCases();
  return {
    scoreAndRouteAfterIngest({ signalId, trusted }) {
      try {
        strategicRouting.scoreAndRouteSignal({
          signalId,
          clientId: trusted.clientId,
          organizationId: trusted.organizationId,
        });
      } catch (error) {
        if (error instanceof StrategicRoutingError && error.code === 'SIGNAL_NOT_FOUND') {
          return;
        }
        throw error;
      }
    },
  };
}

export function composeSignalIntake(options: {
  sources?: SourceRegistryPort;
  signals?: SignalIntakePort;
  feed?: SourceFeedPort;
  profileKeywords?: ProfileKeywordsPort;
  routing?: PostIngestRoutingPort;
} = {}) {
  const sources = options.sources ?? createDbSourceRegistryPort();
  const signals = options.signals ?? createDbSignalIntakePort();
  const feed = options.feed ?? createHttpSourceFeedPort();
  const profileKeywords = options.profileKeywords ?? createDbProfileKeywordsPort();
  const routing = options.routing ?? createDefaultPostIngestRouting();
  const pollDeps = { sources, signals, feed, profileKeywords, routing };
  return {
    registerSource: createRegisterSource({ sources }),
    registerManualSignal: createRegisterManualSignal({ signals }),
    pollRegisteredSource: createPollRegisteredSource(pollDeps),
    pollAllActiveSources: createPollAllActiveSources(pollDeps),
  };
}
