/**
 * SPEC-010 · TanStack Query client.
 *
 * AUTHORITY: NONAUTHORITATIVE_CACHE.
 *
 * The cache is a presentation accelerator. It is never the source of business
 * truth, approval authority, lifecycle authority or tenant authority
 * (threats T-010-05, T-010-07, T-010-08).
 *
 * Defaults are deliberately conservative:
 * - `staleTime: 0` — cached data is always considered stale, so the UI refetches
 *   rather than presenting an old value as current.
 * - `retry: 0` — a denial must surface as a denial, not be retried into looking
 *   like a transient network fault.
 * - no `structuralSharing` tricks and no global optimistic behaviour: wave 1
 *   introduces no optimistic mutation at all.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function createUiQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
        retry: 0,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createUiQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
