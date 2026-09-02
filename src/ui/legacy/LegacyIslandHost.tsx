/**
 * SPEC-010 T-010-403 — React-hosted legacy island container.
 *
 * Presentation infrastructure only: receives shell navigation state from React,
 * mounts the existing legacy page implementation into a scoped subtree, and
 * releases it on unmount.
 */

import { useEffect, useRef } from 'react';
import {
  mountLegacyIsland,
  toLegacyClientScope,
  unmountLegacyIsland,
  type LegacyIslandMountConfig,
} from '../../controllers/legacyIslandBridge';

export function LegacyIslandHost({
  tab,
  clientId,
  campaignId,
  thesisId,
  testId,
}: LegacyIslandMountConfig & { testId: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    mountLegacyIsland(host, {
      tab,
      clientId: toLegacyClientScope(clientId),
      campaignId: campaignId ?? null,
      thesisId,
    });

    return () => {
      unmountLegacyIsland();
    };
  }, [tab, clientId, campaignId, thesisId]);

  return (
    <div
      ref={hostRef}
      className="legacy-island-host"
      data-testid={testId}
      data-legacy-island-tab={tab}
      data-legacy-island-client={clientId ?? 'all'}
    />
  );
}
