import type { SourceType } from '../../types';
import { assessSourceQuality, gateItem } from '../../services/ingestFilter';
import { SignalIntakeError } from './errors';
import type { PostIngestRoutingPort } from './ports/PostIngestRoutingPort';
import type { ProfileKeywordsPort } from './ports/ProfileKeywordsPort';
import type { SignalIntakePort } from './ports/SignalIntakePort';
import type { SourceFeedPort } from './ports/SourceFeedPort';
import type { SourceRegistryPort } from './ports/SourceRegistryPort';
import {
  assertTrustedSignalIntakeContext,
  requireAdminRole,
  type TrustedSignalIntakeContext,
} from './trustedContext';

export interface PollRegisteredSourceInput {
  trusted: TrustedSignalIntakeContext;
  /** Caller identifies intent only — Application reloads authoritative Source. */
  sourceId: string;
}

export interface PollRegisteredSourceResult {
  sourceId: string;
  fetched: number;
  accepted: number;
  rejected: number;
  duplicates: number;
  /** Signals newly persisted (non-duplicate). */
  created: number;
  error?: string;
}

export interface PollRegisteredSourceDeps {
  sources: SourceRegistryPort;
  signals: SignalIntakePort;
  feed: SourceFeedPort;
  profileKeywords: ProfileKeywordsPort;
  routing: PostIngestRoutingPort;
}

function mapSourceType(type: SourceType): import('../../types').Signal['sourceType'] {
  switch (type) {
    case 'REGULATORY':
      return 'REGULATORY';
    case 'ACADEMIC':
      return 'ACADEMIC';
    case 'VIDEO':
      return 'VIDEO';
    case 'SOCIAL':
      return 'SOCIAL';
    default:
      return 'RSS';
  }
}

/**
 * CR-1 #9 — PollRegisteredSource.
 * Source polling / ingestion orchestration. No routing/scoring/thesis authority.
 */
export function createPollRegisteredSource(deps: PollRegisteredSourceDeps) {
  return async function pollRegisteredSource(
    input: PollRegisteredSourceInput
  ): Promise<PollRegisteredSourceResult> {
    assertTrustedSignalIntakeContext(input.trusted);
    requireAdminRole(input.trusted);

    const source = deps.sources.getById(input.sourceId);
    if (!source) {
      throw new SignalIntakeError('SOURCE_NOT_FOUND', `Source not found: ${input.sourceId}`);
    }
    if (source.clientId !== input.trusted.clientId) {
      throw new SignalIntakeError(
        'TENANT_CONTEXT_INVALID',
        'Source does not belong to the trusted client entitlement.'
      );
    }
    if (source.organizationId !== input.trusted.organizationId) {
      throw new SignalIntakeError(
        'TENANT_CONTEXT_INVALID',
        'Source does not belong to the trusted organization.'
      );
    }
    if (!source.url?.trim()) {
      return {
        sourceId: source.id,
        fetched: 0,
        accepted: 0,
        rejected: 0,
        duplicates: 0,
        created: 0,
      };
    }
    if (source.status === 'ARCHIVED' || source.status === 'PAUSED') {
      return {
        sourceId: source.id,
        fetched: 0,
        accepted: 0,
        rejected: 0,
        duplicates: 0,
        created: 0,
      };
    }

    const keywords = deps.profileKeywords.forClient(input.trusted.clientId);
    let items: import('../../services/ingestFilter').FeedItem[] = [];

    try {
      const fetched = await deps.feed.fetch(source.url);
      if (fetched.error) throw new Error(fetched.error);
      items = fetched.items;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'RSS_FAILED';
      deps.sources.recordSourceRun(source.id, {
        fetched: 0,
        accepted: 0,
        rejected: 0,
        duplicates: 0,
        error: message,
      });
      throw new SignalIntakeError('SOURCE_POLL_FAILED', message);
    }

    let accepted = 0;
    let rejected = 0;
    let duplicates = 0;

    for (const item of items) {
      const gate = gateItem(item, keywords, source);
      if (!gate.accepted) {
        rejected += 1;
        continue;
      }

      const organizationId = source.organizationId?.trim() || input.trusted.organizationId;
      if (!organizationId) {
        rejected += 1;
        continue;
      }

      const result = deps.signals.add({
        organizationId,
        clientId: input.trusted.clientId,
        sourceId: source.id,
        title: item.title,
        sourceType: mapSourceType(source.type),
        sourceName: source.name,
        sourceUrl: item.link,
        contentSnippet: item.snippet || item.title,
        status: 'NEW',
        aiStatus: 'PENDING_AI',
        managerDecision: 'UNREVIEWED',
        sourceQuality: assessSourceQuality(source, item),
      });

      if (result.isDuplicate) {
        duplicates += 1;
        continue;
      }

      deps.routing.scoreAndRouteAfterIngest({
        signalId: result.signal.id,
        trusted: input.trusted,
      });
      accepted += 1;
    }

    deps.sources.recordSourceRun(source.id, {
      fetched: items.length,
      accepted,
      rejected,
      duplicates,
    });

    return {
      sourceId: source.id,
      fetched: items.length,
      accepted,
      rejected,
      duplicates,
      created: accepted,
    };
  };
}

export interface PollAllActiveSourcesInput {
  trusted: TrustedSignalIntakeContext;
}

export interface PollAllActiveSourcesResult {
  created: number;
  failed: number;
  rejected: number;
  polled: number;
}

export function createPollAllActiveSources(deps: PollRegisteredSourceDeps) {
  const pollOne = createPollRegisteredSource(deps);
  return async function pollAllActiveSources(
    input: PollAllActiveSourcesInput
  ): Promise<PollAllActiveSourcesResult> {
    assertTrustedSignalIntakeContext(input.trusted);
    requireAdminRole(input.trusted);

    const sources = deps.sources.listPollableByClient(input.trusted.clientId);
    let created = 0;
    let failed = 0;
    let rejected = 0;

    for (const source of sources) {
      try {
        const outcome = await pollOne({ trusted: input.trusted, sourceId: source.id });
        created += outcome.created;
        rejected += outcome.rejected;
      } catch {
        failed += 1;
      }
    }

    return { created, failed, rejected, polled: sources.length };
  };
}
