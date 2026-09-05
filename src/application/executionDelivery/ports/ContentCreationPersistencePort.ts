import type { ContentItem } from '../../../types';

/** Narrow initial-create persistence — distinct from #31 SaveContentDraft edit port. */
export interface ContentCreationPersistencePort {
  createContent(content: ContentItem): void;
}
