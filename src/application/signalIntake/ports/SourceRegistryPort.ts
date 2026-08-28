import type { Source } from '../../../types';

/**
 * Capability port — source registry persistence only.
 * Ownership/status defaults are established by Application, not the caller.
 */
export interface SourceRegistryPort {
  add(source: Omit<Source, 'id' | 'createdAt' | 'itemCount'>): Source;
  listByClient(clientId: string): Source[];
}
