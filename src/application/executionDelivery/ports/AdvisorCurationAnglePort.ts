import type { PositioningThesis } from '../../../types';

export interface AdvisorCurationAngleResult {
  angle: string;
  usedLiveModel: boolean;
}

/** Application-facing #15 angle generation — gateway + deterministic local fallback only. */
export interface AdvisorCurationAnglePort {
  generateAngle(params: {
    thesis: PositioningThesis;
    title: string;
    snippet: string;
  }): Promise<AdvisorCurationAngleResult>;
}
