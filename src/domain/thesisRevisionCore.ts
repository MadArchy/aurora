import type {
  PositioningThesis,
  ThesisEditableFields,
  ThesisPendingRevision,
} from '../types';
import { assertThesisReadyForReview } from './thesisModelCore';

export type ThesisSaveIntent = 'draft' | 'submit_review';

/** Extrae los campos que el manager puede editar sin tocar el ciclo de vida. */
export function extractEditableFields(thesis: PositioningThesis): ThesisEditableFields {
  return {
    title: thesis.title,
    expertIdentity: thesis.expertIdentity,
    targetAudience: thesis.targetAudience,
    secondaryAudience: thesis.secondaryAudience,
    domain: thesis.domain,
    objective: thesis.objective,
    proofPoints: thesis.proofPoints,
    differentiator: thesis.differentiator,
    voiceAndTone: thesis.voiceAndTone,
    complianceRules: thesis.complianceRules,
    identityCurrent: thesis.identityCurrent,
    perceptionTarget: thesis.perceptionTarget,
    audiences: thesis.audiences,
    territories: thesis.territories,
    objectives: thesis.objectives,
    voiceProfile: thesis.voiceProfile,
    limits: thesis.limits,
    priority: thesis.priority,
  };
}

/**
 * Decide cómo persistir una edición.
 * Si la tesis ya está ACTIVE, conserva el estado operativo y guarda un borrador.
 */
export function planThesisSave(
  existing: PositioningThesis | undefined,
  nextFields: ThesisEditableFields,
  actor: string,
  now = new Date().toISOString(),
  intent: ThesisSaveIntent = 'draft'
): {
  keepActive: boolean;
  status: PositioningThesis['status'];
  clientApprovalStatus: PositioningThesis['clientApprovalStatus'];
  pendingRevision?: ThesisPendingRevision;
  toast: string;
  notifyClient: boolean;
} {
  const pendingRevision: ThesisPendingRevision = {
    proposed: nextFields,
    createdAt: now,
    createdBy: actor,
  };

  if (existing?.status === 'ACTIVE') {
    if (intent === 'submit_review') {
      return {
        keepActive: true,
        status: 'ACTIVE',
        clientApprovalStatus: 'PENDING',
        pendingRevision,
        toast: 'Revisión enviada al cliente. La tesis ACTIVE sigue operativa hasta que apruebe.',
        notifyClient: true,
      };
    }
    return {
      keepActive: true,
      status: 'ACTIVE',
      clientApprovalStatus: existing.clientApprovalStatus,
      pendingRevision,
      toast: 'Borrador de revisión guardado. La tesis ACTIVE no cambió para el cliente.',
      notifyClient: false,
    };
  }

  if (intent === 'submit_review') {
    return {
      keepActive: false,
      status: 'UNDER_REVIEW',
      clientApprovalStatus: 'PENDING',
      pendingRevision: undefined,
      toast: 'Tesis enviada a revisión del cliente.',
      notifyClient: true,
    };
  }

  return {
    keepActive: false,
    status: 'DRAFT',
    clientApprovalStatus: existing?.clientApprovalStatus || 'PENDING',
    pendingRevision: undefined,
    toast: 'Borrador guardado. El cliente aún no la ve.',
    notifyClient: false,
  };
}

/** Aplica la revisión pendiente sobre una tesis ACTIVE ya aprobada. */
export function applyPendingRevision(thesis: PositioningThesis): PositioningThesis {
  const revision = thesis.pendingRevision;
  if (!revision) {
    return {
      ...thesis,
      clientApprovalStatus: 'APPROVED',
      pendingRevision: undefined,
      clientFeedback: undefined,
    };
  }

  return {
    ...thesis,
    ...revision.proposed,
    clientApprovalStatus: 'APPROVED',
    pendingRevision: undefined,
    clientFeedback: undefined,
  };
}

export interface ThesisActivationCheck {
  ok: boolean;
  blockers: string[];
}

/** FLOW-18: precondiciones para activar una tesis aprobada por el cliente. */
export function canActivateThesis(thesis: PositioningThesis): ThesisActivationCheck {
  if (thesis.status === 'ACTIVE') {
    return { ok: false, blockers: ['La tesis ya está activa.'] };
  }
  if (thesis.clientApprovalStatus !== 'APPROVED') {
    return { ok: false, blockers: ['El cliente aún no ha aprobado la tesis.'] };
  }
  if (thesis.status !== 'UNDER_REVIEW' && thesis.status !== 'DRAFT') {
    return { ok: false, blockers: ['Estado no elegible para activación.'] };
  }

  const readiness = assertThesisReadyForReview(thesis);
  if (!readiness.ready) {
    return { ok: false, blockers: readiness.blockers };
  }

  return { ok: true, blockers: [] };
}

/** FLOW-18 — el manager activa la tesis; no confundir con la aprobación del cliente. */
export function activateThesisByManager(
  thesis: PositioningThesis,
  actor: string,
  now = new Date().toISOString()
): PositioningThesis {
  const check = canActivateThesis(thesis);
  if (!check.ok) {
    throw new Error(check.blockers[0] || 'No se puede activar la tesis.');
  }

  return {
    ...thesis,
    status: 'ACTIVE',
    activatedAt: now,
    updatedAt: now,
    updatedBy: actor,
    clientFeedback: undefined,
  };
}

export interface ClientThesisApprovalResult {
  thesis: PositioningThesis;
  appliedRevision: boolean;
  /** true cuando el cliente aprobó pero el manager debe pulsar Activar. */
  awaitsManagerActivation: boolean;
}

/** FLOW-17 — el cliente aprueba; la activación operativa la hace el manager. */
export function approveThesisByClient(
  thesis: PositioningThesis,
  actor: string,
  now = new Date().toISOString()
): ClientThesisApprovalResult {
  if (thesis.status === 'ACTIVE' && thesis.pendingRevision) {
    const applied = applyPendingRevision({
      ...thesis,
      updatedAt: now,
      updatedBy: actor,
    });
    return {
      thesis: { ...applied, clientApprovedAt: now },
      appliedRevision: true,
      awaitsManagerActivation: false,
    };
  }

  if (thesis.status === 'UNDER_REVIEW') {
    return {
      thesis: {
        ...thesis,
        clientApprovalStatus: 'APPROVED',
        clientApprovedAt: now,
        clientFeedback: undefined,
        updatedAt: now,
        updatedBy: actor,
      },
      appliedRevision: false,
      awaitsManagerActivation: true,
    };
  }

  const applied = applyPendingRevision({
    ...thesis,
    status: thesis.status === 'ACTIVE' ? 'ACTIVE' : thesis.status,
    updatedAt: now,
    updatedBy: actor,
  });
  return {
    thesis: { ...applied, clientApprovedAt: now },
    appliedRevision: Boolean(thesis.pendingRevision),
    awaitsManagerActivation: false,
  };
}

/** Tesis que el cliente puede revisar o aprobar. */
export function thesesAwaitingClientAction(theses: PositioningThesis[]): PositioningThesis[] {
  return theses.filter(
    (t) =>
      (t.status === 'UNDER_REVIEW' && t.clientApprovalStatus === 'PENDING') ||
      (t.status === 'ACTIVE' && t.pendingRevision && t.clientApprovalStatus === 'PENDING')
  );
}

/** El cliente pide cambios. La versión ACTIVE vigente no se toca. */
export function rejectThesisByClient(
  thesis: PositioningThesis,
  feedback?: string,
  actor?: string,
  now = new Date().toISOString()
): PositioningThesis {
  const trimmed = feedback?.trim();
  if (thesis.status === 'ACTIVE') {
    return {
      ...thesis,
      status: 'ACTIVE',
      clientApprovalStatus: 'CHANGES_REQUESTED',
      pendingRevision: undefined,
      clientFeedback: trimmed || thesis.clientFeedback,
      updatedAt: now,
      updatedBy: actor || thesis.updatedBy,
    };
  }

  return {
    ...thesis,
    status: 'DRAFT',
    clientApprovalStatus: 'CHANGES_REQUESTED',
    pendingRevision: undefined,
    clientFeedback: trimmed || thesis.clientFeedback,
    updatedAt: now,
    updatedBy: actor || thesis.updatedBy,
  };
}

/** @deprecated Use rejectThesisByClient */
export function rejectPendingRevision(
  thesis: PositioningThesis,
  feedback?: string
): PositioningThesis {
  return rejectThesisByClient(thesis, feedback);
}

/** Vista que debe ver el cliente: la revisión pendiente si existe. */
export function thesisForClientReview(thesis: PositioningThesis): PositioningThesis {
  if (!thesis.pendingRevision) return thesis;
  return { ...thesis, ...thesis.pendingRevision.proposed };
}
