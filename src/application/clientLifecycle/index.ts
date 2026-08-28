export { ClientLifecycleError, type ClientLifecycleErrorCode } from './errors';
export {
  assertNoOrganizationSpoof,
  assertTrustedAdminActor,
  type TrustedClientLifecycleAdminContext,
} from './trustedContext';
export {
  createCreateClientWithInvite,
  type CreateClientWithInviteDeps,
  type CreateClientWithInviteInput,
  type CreateClientWithInviteResult,
} from './CreateClientWithInvite';
export {
  createAcceptClientInvitation,
  type AcceptClientInvitationDeps,
  type AcceptClientInvitationInput,
  type AcceptClientInvitationResult,
} from './AcceptClientInvitation';
export type { ClientShellPort, ClientCreateFields } from './ports/ClientShellPort';
export type { InvitationPort } from './ports/InvitationPort';
export type { PendingAccountPort } from './ports/PendingAccountPort';
export type { ClientIdentityActivationPort } from './ports/ClientIdentityActivationPort';
