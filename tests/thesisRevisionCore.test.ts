import { describe, expect, it } from 'vitest';
import {
  activateThesisByManager,
  applyPendingRevision,
  approveThesisByClient,
  canActivateThesis,
  extractEditableFields,
  planThesisSave,
  rejectThesisByClient,
  thesisForClientReview,
} from '../src/domain/thesisRevisionCore';
import type { PositioningThesis } from '../src/types';

function baseThesis(overrides: Partial<PositioningThesis> = {}): PositioningThesis {
  return {
    id: 'thesis_1',
    organizationId: 'org_1',
    clientId: 'client_1',
    title: 'Patent Strategy',
    expertIdentity: 'Patent counsel',
    targetAudience: 'GCs',
    domain: 'IP',
    objective: 'Thought leadership',
    proofPoints: ['USPTO'],
    voiceAndTone: 'Precise',
    complianceRules: 'no guarantees',
    status: 'ACTIVE',
    clientApprovalStatus: 'APPROVED',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'admin',
    priority: 80,
    ...overrides,
  };
}

describe('planThesisSave', () => {
  it('keeps an ACTIVE thesis operational and stores a pending revision on draft', () => {
    const existing = baseThesis();
    const next = { ...extractEditableFields(existing), title: 'Patent Strategy 2.0' };
    const plan = planThesisSave(existing, next, 'manager_1', '2026-08-21T12:00:00.000Z', 'draft');

    expect(plan.keepActive).toBe(true);
    expect(plan.status).toBe('ACTIVE');
    expect(plan.clientApprovalStatus).toBe('APPROVED');
    expect(plan.pendingRevision?.proposed.title).toBe('Patent Strategy 2.0');
    expect(plan.notifyClient).toBe(false);
  });

  it('notifies the client when submitting an ACTIVE revision', () => {
    const existing = baseThesis();
    const next = extractEditableFields(existing);
    const plan = planThesisSave(existing, next, 'manager_1', undefined, 'submit_review');

    expect(plan.keepActive).toBe(true);
    expect(plan.clientApprovalStatus).toBe('PENDING');
    expect(plan.notifyClient).toBe(true);
  });

  it('saves a non-active thesis as DRAFT without notifying', () => {
    const existing = baseThesis({ status: 'DRAFT', clientApprovalStatus: 'CHANGES_REQUESTED' });
    const next = extractEditableFields(existing);
    const plan = planThesisSave(existing, next, 'manager_1', undefined, 'draft');

    expect(plan.keepActive).toBe(false);
    expect(plan.status).toBe('DRAFT');
    expect(plan.pendingRevision).toBeUndefined();
    expect(plan.notifyClient).toBe(false);
  });

  it('sends a non-active thesis to UNDER_REVIEW on submit', () => {
    const existing = baseThesis({ status: 'DRAFT', clientApprovalStatus: 'CHANGES_REQUESTED' });
    const next = extractEditableFields(existing);
    const plan = planThesisSave(existing, next, 'manager_1', undefined, 'submit_review');

    expect(plan.keepActive).toBe(false);
    expect(plan.status).toBe('UNDER_REVIEW');
    expect(plan.notifyClient).toBe(true);
  });

  it('creates a new thesis as DRAFT by default', () => {
    const next = extractEditableFields(baseThesis({ status: 'DRAFT' }));
    const plan = planThesisSave(undefined, next, 'manager_1', undefined, 'draft');

    expect(plan.status).toBe('DRAFT');
    expect(plan.notifyClient).toBe(false);
  });
});

describe('applyPendingRevision', () => {
  it('merges the pending proposal onto the live thesis', () => {
    const thesis = baseThesis({
      pendingRevision: {
        proposed: { ...extractEditableFields(baseThesis()), title: 'Revised title' },
        createdAt: '2026-08-21T12:00:00.000Z',
        createdBy: 'manager_1',
      },
      clientApprovalStatus: 'PENDING',
    });

    const applied = applyPendingRevision(thesis);
    expect(applied.title).toBe('Revised title');
    expect(applied.status).toBe('ACTIVE');
    expect(applied.clientApprovalStatus).toBe('APPROVED');
    expect(applied.pendingRevision).toBeNull();
  });
});

describe('rejectThesisByClient', () => {
  it('keeps ACTIVE thesis operational when rejecting a pending revision', () => {
    const thesis = baseThesis({
      pendingRevision: {
        proposed: extractEditableFields(baseThesis()),
        createdAt: '2026-08-21T12:00:00.000Z',
        createdBy: 'manager_1',
      },
    });

    const rejected = rejectThesisByClient(thesis, 'Ajusta el territorio de consumer AI');
    expect(rejected.status).toBe('ACTIVE');
    expect(rejected.clientApprovalStatus).toBe('CHANGES_REQUESTED');
    expect(rejected.pendingRevision).toBeNull();
    expect(rejected.clientFeedback).toContain('consumer AI');
  });

  it('returns UNDER_REVIEW thesis to DRAFT when changes are requested', () => {
    const thesis = baseThesis({ status: 'UNDER_REVIEW', clientApprovalStatus: 'PENDING' });
    const rejected = rejectThesisByClient(thesis, 'Más foco en GC');
    expect(rejected.status).toBe('DRAFT');
    expect(rejected.clientApprovalStatus).toBe('CHANGES_REQUESTED');
  });
});

describe('approveThesisByClient + activateThesisByManager', () => {
  it('client approval on UNDER_REVIEW does not activate until manager activates', () => {
    const thesis = baseThesis({
      status: 'UNDER_REVIEW',
      clientApprovalStatus: 'PENDING',
      identityCurrent: 'Known counsel',
      perceptionTarget: 'Trusted advisor',
      audiences: [{ id: 'a1', name: 'GC', tier: 'COMMERCIAL', weight: 100, keywords: [] }],
      territories: [{ id: 't1', name: 'IP', pillar: 'IP', weight: 100, keywords: [] }],
      objectives: [{ id: 'o1', kind: 'BUSINESS', weight: 100 }],
      voiceProfile: {
        authority: 80,
        technicalDepth: 75,
        academic: 60,
        executive: 80,
        accessible: 55,
        provocative: 25,
        commercial: 50,
        legalPrecision: 85,
        humor: 15,
      },
      limits: { hardBlocks: ['no hype'], softAvoid: [] },
      proofPoints: ['USPTO', 'Committee Chair'],
    });

    const approved = approveThesisByClient(thesis, 'client_1');
    expect(approved.awaitsManagerActivation).toBe(true);
    expect(approved.thesis.status).toBe('UNDER_REVIEW');
    expect(approved.thesis.clientApprovalStatus).toBe('APPROVED');
    expect(approved.thesis.clientApprovedAt).toBeTruthy();

    const activation = canActivateThesis(approved.thesis);
    expect(activation.ok).toBe(true);
    const active = activateThesisByManager(approved.thesis, 'manager_1');
    expect(active.status).toBe('ACTIVE');
    expect(active.activatedAt).toBeTruthy();
  });
});

describe('thesisForClientReview', () => {
  it('shows the pending proposal to the client when present', () => {
    const thesis = baseThesis({
      pendingRevision: {
        proposed: { ...extractEditableFields(baseThesis()), title: 'Pending title' },
        createdAt: '2026-08-21T12:00:00.000Z',
        createdBy: 'manager_1',
      },
    });
    expect(thesisForClientReview(thesis).title).toBe('Pending title');
  });
});
