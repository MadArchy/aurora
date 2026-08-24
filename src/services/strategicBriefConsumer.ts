import {
  StrategicBriefError,
  type AuthorizeStrategicDownstreamResult,
  type CreateStrategicBriefInput,
} from '../application/strategicBrief';
import { composeStrategicBrief } from '../composition/strategicBrief/composeStrategicBrief';
import type { StrategicBrief, StrategicDownstreamAction } from '../domain/strategicBriefCore';
import {
  curationDestinationToAuthorizedAction,
  strategicDenialMessage,
} from '../domain/briefConsumerCore';
import {
  createLocalStrategicBriefStore,
  LocalStrategicBriefStore,
  type StrategicBriefContextSource,
} from '../infrastructure/strategicBrief';
import type { CurationDestination, CurationEntry } from '../types';
import { authService } from './auth';
import { dbService } from './db';
import type { TrustedBriefActorContext } from '../application/strategicBrief/trustedContext';

type BriefUseCases = ReturnType<typeof composeStrategicBrief>;

let store: LocalStrategicBriefStore = createLocalStrategicBriefStore();
let useCases: BriefUseCases = buildUseCases(store);

function buildUseCases(briefStore: LocalStrategicBriefStore): BriefUseCases {
  const signals: StrategicBriefContextSource = {
    getSignalById: (id) => dbService.getSignalById(id),
    getEvidenceById: (id) => {
      const item = dbService.getEvidenceById(id);
      if (!item) return undefined;
      return { id: item.id, organizationId: item.organizationId, clientId: item.clientId };
    },
  };
  return composeStrategicBrief({ store: briefStore, signals });
}

/** Test-only reset — not production API. */
export function resetStrategicBriefConsumerForTest(nextStore?: LocalStrategicBriefStore): void {
  store = nextStore ?? createLocalStrategicBriefStore();
  store.resetForTest();
  useCases = buildUseCases(store);
}

export function buildTrustedBriefContext(clientId: string, now?: string): TrustedBriefActorContext | undefined {
  const user = authService.getCurrentUser();
  const organizationId = dbService.getClientById(clientId)?.organizationId;
  if (!user || !organizationId) return undefined;
  return {
    actorId: user.uid,
    actorRole: user.role === 'CLIENT' ? 'CLIENT' : 'ADMIN',
    organizationId,
    clientId,
    now: now ?? new Date().toISOString(),
  };
}

export function listStrategicBriefs(clientId: string): StrategicBrief[] {
  const client = dbService.getClientById(clientId);
  if (!client) return [];
  return store.listByTenant({ organizationId: client.organizationId, clientId });
}

export function getStrategicBrief(briefId: string, clientId: string): StrategicBrief | undefined {
  const trusted = buildTrustedBriefContext(clientId);
  if (!trusted) return undefined;
  return store.getById(briefId, trusted);
}

export function authorizeStrategicDownstream(params: {
  clientId: string;
  briefId: string;
  requestedAction: StrategicDownstreamAction;
  now?: string;
}): AuthorizeStrategicDownstreamResult {
  const trusted = buildTrustedBriefContext(params.clientId, params.now);
  if (!trusted) {
    return {
      authorized: false,
      briefId: params.briefId,
      denialCode: 'ACTOR_NOT_AUTHORIZED',
      denialReason: 'Missing trusted actor context.',
    };
  }
  return useCases.authorize({
    trusted,
    briefId: params.briefId,
    requestedAction: params.requestedAction,
  });
}

export function requireStrategicAuthorization(params: {
  clientId: string;
  briefId: string | undefined;
  requestedAction: StrategicDownstreamAction;
}): AuthorizeStrategicDownstreamResult {
  if (!params.briefId?.trim()) {
    return {
      authorized: false,
      briefId: params.briefId ?? '',
      denialCode: 'BRIEF_NOT_FOUND',
      denialReason: 'strategicBriefId is required for strategic downstream actions.',
    };
  }
  return authorizeStrategicDownstream({
    clientId: params.clientId,
    briefId: params.briefId,
    requestedAction: params.requestedAction,
  });
}

export function formatAuthorizationDenial(result: AuthorizeStrategicDownstreamResult): string {
  return strategicDenialMessage(result.denialCode, result.denialReason);
}

export function createBriefFromCurationEntry(params: {
  entry: CurationEntry;
  destination: CurationDestination;
  briefId?: string;
  now?: string;
}): { brief: StrategicBrief; created: boolean } {
  const trusted = buildTrustedBriefContext(params.entry.clientId, params.now);
  if (!trusted) throw new Error('Trusted actor context required to create Strategic Brief.');
  if (!params.entry.signalId) {
    throw new Error('Curation entry must reference a signal to create a governed Brief.');
  }

  const authorizedAction = curationDestinationToAuthorizedAction(params.destination);
  if (!authorizedAction) {
    throw new Error('This curation destination does not require a Strategic Brief.');
  }

  const input: CreateStrategicBriefInput = {
    trusted,
    briefId: params.briefId ?? `brief_${params.entry.id}`,
    signalIds: [params.entry.signalId],
    primaryAudience: 'Target audience',
    geography: 'TBD',
    territory: params.entry.title.slice(0, 120),
    framework: 'Governed curation decision',
    strategicAngle: params.entry.aiAngle || params.entry.title,
    supportingEvidenceIds: [],
    riskFlags: [],
    recommendedChannel: 'LINKEDIN',
    recommendedFormat: 'ARTICLE',
    CTA: 'Review and approve',
    authorizedAction,
    decisionRationale: params.entry.managerRationale || 'Governed Brief from curation review.',
  };

  try {
    const result = useCases.create(input);
    dbService.setCurationStrategicBriefId(params.entry.id, result.brief.id);
    return { brief: result.brief, created: result.created };
  } catch (err) {
    if (err instanceof Error && 'code' in err) {
      throw err;
    }
    throw err;
  }
}

export function approveStrategicBrief(params: {
  clientId: string;
  briefId: string;
  now?: string;
}): StrategicBrief {
  const trusted = buildTrustedBriefContext(params.clientId, params.now);
  if (!trusted) throw new Error('Trusted actor context required to approve Strategic Brief.');
  const result = useCases.approve({ trusted, briefId: params.briefId });
  return result.brief;
}

export function findApprovedBriefForSignal(params: {
  clientId: string;
  signalId: string;
  action: StrategicDownstreamAction;
}): StrategicBrief | undefined {
  return listStrategicBriefs(params.clientId).find(
    (b) =>
      b.status === 'APPROVED' &&
      !b.supersededByBriefId &&
      b.decision.authorizedAction === params.action &&
      b.signalIds.includes(params.signalId)
  );
}

export { strategicDenialMessage };

export type { StrategicBriefError };
