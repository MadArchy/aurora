import type { CurationDestination } from '../types';
import type { StrategicDownstreamAction, StrategicAuthorizedAction } from './strategicBriefCore';

/** Maps curation destination to Brief authorizedAction when creating a governed Brief. */
export function curationDestinationToAuthorizedAction(
  destination: CurationDestination
): StrategicAuthorizedAction | undefined {
  switch (destination) {
    case 'TASK_VIDEO':
    case 'TASK_ARTICLE':
      return 'CREATE_CONTENT';
    case 'OPPORTUNITY':
      return 'CREATE_OPPORTUNITY';
    case 'REFERENCE_READING':
      return 'CREATE_TASK';
    default:
      return undefined;
  }
}

/** Downstream authorization action required to materialize a curation destination. */
export function curationDestinationToDownstreamAction(
  destination: CurationDestination
): StrategicDownstreamAction | undefined {
  switch (destination) {
    case 'TASK_VIDEO':
    case 'TASK_ARTICLE':
      return 'CREATE_CONTENT';
    case 'OPPORTUNITY':
      return 'CREATE_OPPORTUNITY';
    case 'REFERENCE_READING':
      return 'CREATE_TASK';
    default:
      return undefined;
  }
}

export function curationDestinationRequiresBrief(destination: CurationDestination | null | undefined): boolean {
  return curationDestinationToDownstreamAction(destination ?? 'DISCARD') !== undefined;
}

export function strategicDenialMessage(code?: string, reason?: string): string {
  switch (code) {
    case 'BRIEF_NOT_FOUND':
      return 'Strategic Brief required — create and approve a Brief for this signal first.';
    case 'BRIEF_NOT_ACTIONABLE':
      return reason?.includes('status=DRAFT')
        ? 'Brief awaiting approval — approve the Strategic Brief before proceeding.'
        : reason?.includes('status=SUPERSEDED')
          ? 'Brief superseded — create a new revision and approve before proceeding.'
          : reason?.includes('status=REJECTED')
            ? 'Brief was rejected — create a new Strategic Brief.'
            : 'Brief action not authorized for this operation.';
    case 'ACTOR_NOT_AUTHORIZED':
      return 'You are not authorized to perform this strategic action.';
    case 'ROUTING_NOT_CLEAR':
      return 'Routing must be resolved first — signal needs CLEAR governed routing.';
    default:
      return reason || 'Strategic Brief authorization denied.';
  }
}
