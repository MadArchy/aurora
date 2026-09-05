import type { Recommendation } from '../../../types';

export interface RecommendationReadPort {
  getById(recommendationId: string): Recommendation | undefined;
}
