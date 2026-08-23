import { mapFetchFailureToProviderError } from './providerErrors';

export type FetchFn = typeof fetch;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchFn: FetchFn = fetch
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } catch (error) {
    throw mapFetchFailureToProviderError({
      providerName: 'http',
      error,
      timeoutMs,
    });
  } finally {
    clearTimeout(timer);
  }
}
