import type { PositioningThesis, ThesisObjective, VoiceProfile } from '../types';
import {
  assertThesisReadyForReview,
  parseAudienceLines,
  parseTerritoryLines,
  thesisCompleteness,
  validateWeights,
} from './thesisModelCore';

export type ThesisEditorStep =
  | 'identity'
  | 'audiences'
  | 'territories'
  | 'objectives'
  | 'voice'
  | 'limits'
  | 'review';

export const THESIS_EDITOR_STEPS: ThesisEditorStep[] = [
  'identity',
  'audiences',
  'territories',
  'objectives',
  'voice',
  'limits',
  'review',
];

export const THESIS_EDITOR_STEP_LABELS: Record<ThesisEditorStep, string> = {
  identity: 'Identidad',
  audiences: 'Audiencias',
  territories: 'Territorios',
  objectives: 'Objetivos',
  voice: 'Voz',
  limits: 'Límites',
  review: 'Resumen',
};

/** Snapshot del formulario del editor (sin ciclo de vida). */
export interface ThesisEditorFormSnapshot {
  title: string;
  identityCurrent: string;
  expertIdentity: string;
  perceptionTarget: string;
  differentiator: string;
  audiencesText: string;
  targetAudience: string;
  territoriesText: string;
  domain: string;
  objective: string;
  objectives: ThesisObjective[];
  voiceProfile: VoiceProfile;
  voiceAvoidText: string;
  proofPoints: string[];
  hardBlocks: string[];
  softAvoid: string[];
  compliance: string;
  priority: number;
}

export function nextThesisEditorStep(current: ThesisEditorStep): ThesisEditorStep | null {
  const idx = THESIS_EDITOR_STEPS.indexOf(current);
  if (idx < 0 || idx >= THESIS_EDITOR_STEPS.length - 1) return null;
  return THESIS_EDITOR_STEPS[idx + 1];
}

export function prevThesisEditorStep(current: ThesisEditorStep): ThesisEditorStep | null {
  const idx = THESIS_EDITOR_STEPS.indexOf(current);
  if (idx <= 0) return null;
  return THESIS_EDITOR_STEPS[idx - 1];
}

export function validateThesisEditorStep(
  step: ThesisEditorStep,
  form: ThesisEditorFormSnapshot
): { ok: boolean; message?: string } {
  switch (step) {
    case 'identity':
      if (!form.title.trim()) return { ok: false, message: 'Indica un título para la tesis.' };
      if (!form.expertIdentity.trim()) return { ok: false, message: 'Define la identidad objetivo.' };
      return { ok: true };
    case 'audiences':
      if (!form.targetAudience.trim() && !form.audiencesText.trim()) {
        return { ok: false, message: 'Describe al menos una audiencia.' };
      }
      return { ok: true };
    case 'territories':
      if (!form.domain.trim()) return { ok: false, message: 'Indica el dominio temático.' };
      return { ok: true };
    case 'objectives':
      if (!form.objective.trim()) return { ok: false, message: 'Resume el objetivo estratégico.' };
      if (form.objectives.length) {
        const weights = validateWeights(form.objectives);
        if (!weights.ok) return { ok: false, message: weights.message || 'Los objetivos deben sumar 100.' };
      }
      return { ok: true };
    case 'voice':
    case 'limits':
    case 'review':
      return { ok: true };
    default:
      return { ok: true };
  }
}

/** Convierte el snapshot del formulario en una tesis para scoring/readiness. */
export function snapshotToThesis(
  form: ThesisEditorFormSnapshot,
  meta: {
    id: string;
    organizationId: string;
    clientId: string;
    status?: PositioningThesis['status'];
  }
): PositioningThesis {
  const audiences = parseAudienceLines(form.audiencesText);
  const territories = parseTerritoryLines(form.territoriesText);
  const now = new Date().toISOString();

  return {
    id: meta.id,
    organizationId: meta.organizationId,
    clientId: meta.clientId,
    title: form.title.trim(),
    expertIdentity: form.expertIdentity.trim(),
    targetAudience: form.targetAudience.trim(),
    domain: form.domain.trim(),
    objective: form.objective.trim(),
    proofPoints: form.proofPoints,
    differentiator: form.differentiator.trim() || undefined,
    voiceAndTone: form.voiceProfile.style || 'Autoritativo y claro',
    complianceRules: form.compliance.trim(),
    identityCurrent: form.identityCurrent.trim() || undefined,
    perceptionTarget: form.perceptionTarget.trim() || undefined,
    audiences: audiences.length ? audiences : undefined,
    territories: territories.length ? territories : undefined,
    objectives: form.objectives.length ? form.objectives : undefined,
    voiceProfile: {
      ...form.voiceProfile,
      avoid: form.voiceAvoidText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    },
    limits:
      form.hardBlocks.length || form.softAvoid.length
        ? { hardBlocks: form.hardBlocks, softAvoid: form.softAvoid }
        : undefined,
    priority: form.priority,
    status: meta.status || 'DRAFT',
    clientApprovalStatus: 'PENDING',
    createdAt: now,
    createdBy: 'editor',
    updatedAt: now,
    updatedBy: 'editor',
  };
}

export function evaluateThesisEditorProgress(form: ThesisEditorFormSnapshot, thesisId: string, clientId: string, orgId: string) {
  const thesis = snapshotToThesis(form, { id: thesisId, organizationId: orgId, clientId });
  const completeness = thesisCompleteness(thesis);
  const readiness = assertThesisReadyForReview(thesis);
  return { completeness, readiness };
}
