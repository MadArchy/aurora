/**
 * SPEC-010 · onboarding step input schemas (wave 2, T-010-205).
 *
 * AUTHORITY: NONE. These are Zod **input-shape** schemas, and that is their only
 * job. They decide whether a field is syntactically usable — present, trimmed,
 * a plausible URL — and they decide nothing about the business (acceptance A13).
 *
 * What is deliberately absent, and must stay absent:
 *   - no onboarding-completion rule (the domain owns `nextIncompleteOnboardingStep`)
 *   - no profile-coverage threshold (the domain owns `computeProfileCoverage`)
 *   - no tenant, actor or role field of any kind (acceptance A18)
 *   - no status, verdict or lifecycle value
 *
 * A schema passing is never permission to persist. The onboarding step is applied
 * by the legacy controller, which re-reads and re-validates; if a schema here
 * were ever loosened, nothing downstream would become more permissive.
 */

import { z } from 'zod';

const required = (label: string) => z.string().trim().min(1, `${label} es obligatorio`);
const optional = z.string().trim().optional().or(z.literal(''));
const optionalUrl = z
  .string()
  .trim()
  .url('Debe ser una URL válida (https://…)')
  .optional()
  .or(z.literal(''));

export const onboardingStep1Schema = z.object({
  displayName: required('El nombre'),
  profession: required('La profesión'),
  currentRole: optional,
  company: optional,
  selfDescription: optional,
});

export const onboardingStep2Schema = z.object({
  primaryGoal: required('El objetivo principal'),
  secondaryGoals: optional,
});

export const onboardingStep3Schema = z.object({
  targetAudience: required('La audiencia primaria'),
  industries: optional,
  countries: optional,
});

export const onboardingStep4Schema = z.object({
  education: optional,
  highlights: optional,
});

export const onboardingStep5Schema = z.object({
  linkedin: optionalUrl,
  website: optionalUrl,
});

export const onboardingStep6Schema = z.object({
  tone: optional,
  topicsToAvoid: optional,
  complianceGuidelines: optional,
});

export const ONBOARDING_STEP_SCHEMAS = [
  onboardingStep1Schema,
  onboardingStep2Schema,
  onboardingStep3Schema,
  onboardingStep4Schema,
  onboardingStep5Schema,
  onboardingStep6Schema,
] as const;

export const ONBOARDING_STEPS = [
  { num: 1, title: 'Identidad', code: 'ONB-01' },
  { num: 2, title: 'Objetivos', code: 'ONB-02' },
  { num: 3, title: 'Audiencia', code: 'ONB-03' },
  { num: 4, title: 'Autoridad & Evidencia', code: 'ONB-04' },
  { num: 5, title: 'Presencia Digital', code: 'ONB-05' },
  { num: 6, title: 'Voz & Compliance', code: 'ONB-06' },
] as const;

export function onboardingSchemaForStep(step: number) {
  return ONBOARDING_STEP_SCHEMAS[Math.min(Math.max(step, 1), 6) - 1];
}
