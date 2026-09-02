import type { Source, SourceRunOutcome } from '../../../types';

/**
 * Capability port — source registry persistence only.
 * Ownership/status defaults are established by Application, not the caller.
 */
export interface SourceRegistryPort {
  add(source: Omit<Source, 'id' | 'createdAt' | 'itemCount'>): Source;
  listByClient(clientId: string): Source[];
  getById(sourceId: string): Source | undefined;
  listPollableByClient(clientId: string): Source[];
  recordSourceRun(sourceId: string, outcome: SourceRunOutcome): void;
}
