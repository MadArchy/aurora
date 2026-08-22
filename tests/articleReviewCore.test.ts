import { describe, expect, it } from 'vitest';
import {
  ARTICLE_APPROVE_PIPELINE_TARGET,
  ARTICLE_SAVE_PIPELINE_TARGET,
  hasArticleSectionMarkers,
  planClientArticleRevision,
  resolveArticleApprovePipelineSteps,
  resolveArticleSavePipelineSteps,
} from '../src/domain/articleReviewCore';

describe('articleReviewCore', () => {
  it('avanza de sent_to_client a client_in_progress al guardar', () => {
    const steps = resolveArticleSavePipelineSteps({
      status: 'CLIENT_REVIEW',
      pipelineStatus: 'sent_to_client',
    });
    expect(steps).toEqual([ARTICLE_SAVE_PIPELINE_TARGET]);
  });

  it('avanza hasta client_submitted al aprobar desde sent_to_client', () => {
    const steps = resolveArticleApprovePipelineSteps({
      status: 'CLIENT_REVIEW',
      pipelineStatus: 'sent_to_client',
    });
    expect(steps).toEqual(['client_in_progress', ARTICLE_APPROVE_PIPELINE_TARGET]);
  });

  it('detecta cambios y planifica pipeline al guardar', () => {
    const plan = planClientArticleRevision(
      {
        status: 'CLIENT_REVIEW',
        pipelineStatus: 'sent_to_client',
        body: 'Intro\nOriginal',
        clientReviewBaseline: 'Intro\nOriginal',
      },
      { body: 'Intro\nEditado por Juan' }
    );

    expect(plan.hasTextChanges).toBe(true);
    expect(plan.diffSummary).toMatchObject({ added: 1, removed: 1 });
    expect(plan.pipelineStepsOnSave).toEqual([ARTICLE_SAVE_PIPELINE_TARGET]);
    expect(plan.pipelineStepsOnApprove).toEqual(['client_in_progress', ARTICLE_APPROVE_PIPELINE_TARGET]);
  });

  it('no avanza pipeline si el texto no cambió', () => {
    const body = 'Mismo texto';
    const plan = planClientArticleRevision(
      {
        status: 'CLIENT_REVIEW',
        pipelineStatus: 'sent_to_client',
        body,
        clientReviewBaseline: body,
      },
      { body }
    );

    expect(plan.hasTextChanges).toBe(false);
    expect(plan.pipelineStepsOnSave).toEqual([]);
  });

  it('detecta marcadores de sección en guiones estructurados', () => {
    expect(hasArticleSectionMarkers('[GANCHO]\nTítulo fuerte')).toBe(true);
    expect(hasArticleSectionMarkers('Texto plano sin marcadores')).toBe(false);
  });
});
