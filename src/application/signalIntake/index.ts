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
export {
  createDiscardSignal,
  type DiscardSignalDeps,
  type DiscardSignalInput,
  type DiscardSignalResult,
} from './DiscardSignal';
export {
  createMarkSignalSaved,
  type MarkSignalSavedDeps,
  type MarkSignalSavedInput,
  type MarkSignalSavedResult,
} from './MarkSignalSaved';
export {
  createPollAllActiveSources,
  createPollRegisteredSource,
  type PollAllActiveSourcesInput,
  type PollAllActiveSourcesResult,
  type PollRegisteredSourceDeps,
  type PollRegisteredSourceInput,
  type PollRegisteredSourceResult,
} from './PollRegisteredSource';
export type { SourceRegistryPort } from './ports/SourceRegistryPort';
export type { SignalIntakePort, SignalIntakeWrite } from './ports/SignalIntakePort';
export type { SourceFeedPort } from './ports/SourceFeedPort';
export type { ProfileKeywordsPort } from './ports/ProfileKeywordsPort';
export type { PostIngestRoutingPort } from './ports/PostIngestRoutingPort';
