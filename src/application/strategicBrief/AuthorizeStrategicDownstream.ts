import {
  canAuthorizeStrategicAction,
  type StrategicBrief,
  type StrategicDownstreamAction,
} from '../../domain/strategicBriefCore';
import { StrategicBriefError } from './errors';
import type { StrategicBriefRepository } from './ports/StrategicBriefRepository';
import {
  assertNoTenantSpoof,
  assertTrustedBriefActor,
  type TrustedBriefActorContext,
} from './trustedContext';

export interface AuthorizeStrategicDownstreamInput {
  trusted: TrustedBriefActorContext;
  briefId: string;
  requestedAction: StrategicDownstreamAction;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export interface AuthorizeStrategicDownstreamResult {
  authorized: boolean;
  briefId: string;
  version?: number;
  authorizedAction?: StrategicBrief['decision']['authorizedAction'];
  denialCode?: string;
  denialReason?: string;
}

export interface AuthorizeStrategicDownstreamDeps {
  briefs: StrategicBriefRepository;
}

export function createAuthorizeStrategicDownstream(deps: AuthorizeStrategicDownstreamDeps) {
  return function authorizeStrategicDownstream(
    input: AuthorizeStrategicDownstreamInput
  ): AuthorizeStrategicDownstreamResult {
    assertTrustedBriefActor(input.trusted, { adminOnly: false });
    assertNoTenantSpoof(input);

    if (input.trusted.actorRole !== 'ADMIN' && input.trusted.actorRole !== 'CLIENT') {
      return {
        authorized: false,
        briefId: input.briefId,
        denialCode: 'ACTOR_NOT_AUTHORIZED',
        denialReason: 'Unrecognized actor role.',
      };
    }

    const brief = deps.briefs.getById(input.briefId, {
      organizationId: input.trusted.organizationId,
      clientId: input.trusted.clientId,
    });
    if (!brief) {
      return {
        authorized: false,
        briefId: input.briefId,
        denialCode: 'BRIEF_NOT_FOUND',
        denialReason: `Brief not found: ${input.briefId}`,
      };
    }
    if (
      brief.organizationId !== input.trusted.organizationId ||
      brief.clientId !== input.trusted.clientId
    ) {
      throw new StrategicBriefError(
        'TENANT_CONTEXT_INVALID',
        'Brief tenant does not match trusted context.'
      );
    }

    if (!canAuthorizeStrategicAction(brief, input.requestedAction)) {
      const denialCode =
        brief.status !== 'APPROVED'
          ? 'BRIEF_NOT_ACTIONABLE'
          : brief.decision.authorizedAction !== input.requestedAction
            ? 'BRIEF_NOT_ACTIONABLE'
            : 'BRIEF_NOT_ACTIONABLE';
      return {
        authorized: false,
        briefId: brief.id,
        version: brief.version,
        authorizedAction: brief.decision.authorizedAction,
        denialCode,
        denialReason: `Brief does not authorize ${input.requestedAction} (status=${brief.status}).`,
      };
    }

    return {
      authorized: true,
      briefId: brief.id,
      version: brief.version,
      authorizedAction: brief.decision.authorizedAction,
    };
  };
}
