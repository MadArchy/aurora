import type { Client, ClientProfile } from '../../types';
import { buildFactsFromProfile } from '../../domain/profileFacts';
import { MasterProfileError } from './errors';

/** Wizard product steps — EXISTING_PRODUCT_RULE (ONBOARDING_STEPS / legacy wizard). */
export const MASTER_ONBOARDING_STEP_COUNT = 6;

export type OnboardingFieldMap = Record<string, string>;

export interface OnboardingStepApplicationResult {
  profile: ClientProfile;
  clientPatches: Array<Partial<Client>>;
  completed: boolean;
}

/**
 * Applies one onboarding wizard step onto the current profile.
 *
 * Field mapping is existing product/legacy wizard behavior moved into Application
 * orchestration — not a new Domain invariant. Fact materialization uses Domain
 * `buildFactsFromProfile`. Completeness is NOT invented here; persistence adapter
 * refreshes it via Domain `computeProfileCoverage` on save.
 */
export function applyOnboardingStepToProfile(params: {
  existing: ClientProfile | null;
  organizationId: string;
  clientId: string;
  step: number;
  fields: OnboardingFieldMap;
  now: string;
  actorId: string;
}): OnboardingStepApplicationResult {
  const { step, fields, now, actorId } = params;
  if (!Number.isInteger(step) || step < 1 || step > MASTER_ONBOARDING_STEP_COUNT) {
    throw new MasterProfileError(
      'INVALID_STEP',
      `Onboarding step must be an integer from 1 to ${MASTER_ONBOARDING_STEP_COUNT}.`
    );
  }

  const existing: ClientProfile = params.existing || {
    organizationId: params.organizationId,
    clientId: params.clientId,
    identity: {},
    goals: {},
    audience: {},
    career: {},
    education: [],
    careerHistory: [],
    ventures: [],
    keyPublications: [],
    socialLinks: {},
    voicePreferences: {
      tone: 'authoritative',
      preferredPhrases: [],
      topicsToAvoid: [],
      complianceGuidelines: '',
    },
    onboardingCompleted: false,
    onboardingCurrentStep: step,
    updatedAt: now,
  };

  if (existing.organizationId !== params.organizationId || existing.clientId !== params.clientId) {
    throw new MasterProfileError(
      'TENANT_CONTEXT_INVALID',
      'Profile tenant envelope does not match trusted context.'
    );
  }

  const profile: ClientProfile = {
    ...existing,
    identity: { ...existing.identity },
    goals: { ...existing.goals },
    audience: { ...existing.audience },
    career: { ...existing.career },
    education: [...(existing.education || [])],
    careerHistory: [...(existing.careerHistory || [])],
    ventures: [...(existing.ventures || [])],
    keyPublications: [...(existing.keyPublications || [])],
    socialLinks: { ...existing.socialLinks },
    voicePreferences: { ...existing.voicePreferences },
    facts: existing.facts ? [...existing.facts] : undefined,
  };

  const clientPatches: Array<Partial<Client>> = [];

  if (step === 1) {
    profile.identity = {
      ...profile.identity,
      selfDescription: fields.selfDescription,
      professionalHeadline: fields.profession,
    };
    profile.career = {
      ...profile.career,
      profession: fields.profession,
      currentRole: fields.role,
      currentCompany: fields.company,
    };
    if (fields.displayName?.trim()) {
      const parts = fields.displayName.trim().split(/\s+/);
      clientPatches.push({
        displayName: fields.displayName.trim(),
        firstName: parts[0],
        lastName: parts.slice(1).join(' ') || parts[0],
        profession: fields.profession,
        company: fields.company,
        onboardingStatus: 'IN_PROGRESS',
        updatedBy: actorId,
      });
    } else {
      clientPatches.push({
        profession: fields.profession,
        company: fields.company,
        onboardingStatus: 'IN_PROGRESS',
        updatedBy: actorId,
      });
    }
  }

  if (step === 2) {
    profile.goals = {
      primaryGoal: fields.primaryGoal,
      secondaryGoals: fields.secondaryGoals
        ? fields.secondaryGoals.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    };
  }

  if (step === 3) {
    profile.audience = {
      targetAudienceDescription: fields.targetAudience,
      targetIndustries: fields.industries
        ? fields.industries.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      targetCountries: fields.countries
        ? fields.countries.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    };
    clientPatches.push({
      targetMarket: fields.targetAudience,
      updatedBy: actorId,
    });
  }

  if (step === 4) {
    profile.education = (fields.education || '')
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => {
        const [degree, rest] = line.split(' - ');
        return { degree: degree?.trim() || line, institution: rest?.trim() || '', year: '' };
      });
    profile.careerHistory = (fields.highlights || '')
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => ({ role: line, organization: '', period: '', highlight: line }));
  }

  if (step === 5) {
    profile.socialLinks = {
      ...profile.socialLinks,
      linkedin: fields.linkedin,
      website: fields.website,
    };
  }

  const completed = step === MASTER_ONBOARDING_STEP_COUNT;
  if (completed) {
    profile.voicePreferences = {
      tone: (fields.tone as ClientProfile['voicePreferences']['tone']) || 'authoritative',
      preferredPhrases: profile.voicePreferences.preferredPhrases,
      topicsToAvoid: fields.avoid
        ? fields.avoid.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      complianceGuidelines: fields.compliance || '',
    };
    profile.onboardingCompleted = true;
    // Completeness is Domain-derived on save (computeProfileCoverage via adapter).
    // Do not invent a new completeness Domain rule; do not reintroduce dead legacy 85.
    clientPatches.push({
      onboardingStatus: 'COMPLETED',
      status: 'ACTIVE',
      updatedBy: actorId,
    });
  }

  profile.onboardingCurrentStep = step;
  profile.updatedAt = now;

  const preserved = (profile.facts || []).filter(
    (fact) => fact.status === 'candidate' || (fact.source === 'manual' && fact.status === 'confirmed')
  );
  const structured = buildFactsFromProfile(profile);
  const seen = new Set<string>();
  profile.facts = [...structured, ...preserved].filter((fact) => {
    const key = `${fact.section}:${fact.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { profile, clientPatches, completed };
}
