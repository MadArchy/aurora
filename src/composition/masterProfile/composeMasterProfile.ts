import {
  createApplyOnboardingStep,
  type MasterProfileRepository,
} from '../../application/masterProfile';
import { createDbMasterProfileRepository } from '../../infrastructure/masterProfile';

export function composeMasterProfile(options: { profiles?: MasterProfileRepository } = {}) {
  const profiles = options.profiles ?? createDbMasterProfileRepository();
  return {
    applyOnboardingStep: createApplyOnboardingStep({ profiles }),
  };
}
