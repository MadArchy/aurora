export { SignalIntakeError, type SignalIntakeErrorCode } from './errors';
export {
  assertNoSignalIntakeSpoof,
  assertTrustedSignalIntakeContext,
  requireAdminRole,
  type TrustedSignalIntakeContext,
} from './trustedContext';
export {
  createRegisterSource,
  type RegisterSourceDeps,
  type RegisterSourceInput,
  type RegisterSourceResult,
} from './RegisterSource';
export {
  createRegisterManualSignal,
  type RegisterManualSignalDeps,
  type RegisterManualSignalInput,
  type RegisterManualSignalResult,
} from './RegisterManualSignal';
export type { SourceRegistryPort } from './ports/SourceRegistryPort';
export type { SignalIntakePort, SignalIntakeWrite } from './ports/SignalIntakePort';
