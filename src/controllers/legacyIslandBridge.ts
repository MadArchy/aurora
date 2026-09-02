/**
 * SPEC-010 T-010-403 — legacy island mount seam.
 *
 * React-owned shell mounts legacy page surfaces into a declared container. The
 * legacy controller renders island-local DOM and handlers only; it does not own
 * global sidebar, shell lifecycle or top-level navigation in normal Stage-B mode.
 */

import { PORTFOLIO_SCOPE } from './appUiState';

export type LegacyIslandMountConfig = {
  readonly tab: string;
  readonly clientId?: string;
  readonly campaignId?: string | null;
  readonly thesisId?: string;
};

type LegacyIslandController = {
  mountIsland(host: HTMLElement, config: LegacyIslandMountConfig): void;
  unmountIsland(): void;
  refreshIsland(): void;
};

let controller: LegacyIslandController | null = null;

export function registerLegacyIslandController(next: LegacyIslandController): void {
  controller = next;
}

export function mountLegacyIsland(host: HTMLElement, config: LegacyIslandMountConfig): void {
  if (!controller) return;
  controller.mountIsland(host, config);
}

export function unmountLegacyIsland(): void {
  controller?.unmountIsland();
}

export function refreshLegacyIsland(): void {
  controller?.refreshIsland();
}

/** Normalizes React shell client scope to legacy presentation state. */
export function toLegacyClientScope(clientId: string | undefined): string {
  if (!clientId || clientId === 'all') return PORTFOLIO_SCOPE;
  return clientId;
}
