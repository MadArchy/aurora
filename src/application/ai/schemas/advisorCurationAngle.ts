import { z } from 'zod';

/** proposeAngle LLM JSON (tmpl_curation_angle_v1). */
export const AdvisorCurationAngleOutputSchema = z
  .object({
    angle: z.string().min(1),
  })
  .strict();

export type AdvisorCurationAngleOutput = z.infer<typeof AdvisorCurationAngleOutputSchema>;

export const ADVISOR_CURATION_ANGLE_SCHEMA_ID = 'advisor.curationAngle';
export const ADVISOR_CURATION_ANGLE_SCHEMA_VERSION = '1';
