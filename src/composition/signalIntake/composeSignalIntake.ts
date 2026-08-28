import {
  createRegisterManualSignal,
  createRegisterSource,
  type SignalIntakePort,
  type SourceRegistryPort,
} from '../../application/signalIntake';
import {
  createDbSignalIntakePort,
  createDbSourceRegistryPort,
} from '../../infrastructure/signalIntake';

export function composeSignalIntake(options: {
  sources?: SourceRegistryPort;
  signals?: SignalIntakePort;
} = {}) {
  const sources = options.sources ?? createDbSourceRegistryPort();
  const signals = options.signals ?? createDbSignalIntakePort();
  return {
    registerSource: createRegisterSource({ sources }),
    registerManualSignal: createRegisterManualSignal({ signals }),
  };
}
