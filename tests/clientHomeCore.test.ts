import { describe, expect, it } from 'vitest';
import {
  isLinkedInReviewTask,
  pickWeeklyLinkedInPostTask,
  planWeekStartDay,
} from '../src/domain/clientHomeCore';
import type { ContentItem, Task } from '../src/types';

const baseTask: Task = {
  id: 'task_1',
  organizationId: 'org_1',
  clientId: 'client_1',
  thesisId: 'th_1',
  type: 'REVIEW_ARTICLE',
  title: 'Revisar post',
  description: 'body',
  estimatedMinutes: 10,
  status: 'ASSIGNED',
  contentItemId: 'cnt_1',
  createdAt: '2026-08-20T10:00:00Z',
};

const baseContent: ContentItem = {
  id: 'cnt_1',
  organizationId: 'org_1',
  clientId: 'client_1',
  thesisId: 'th_1',
  type: 'LINKEDIN_ARTICLE',
  title: 'Post semanal',
  body: 'Texto del post',
  targetPlatform: 'LinkedIn',
  status: 'CLIENT_REVIEW',
  createdAt: '2026-08-20T10:00:00Z',
  updatedAt: '2026-08-20T10:00:00Z',
};

describe('clientHomeCore', () => {
  it('detecta tareas de revisión LinkedIn', () => {
    expect(isLinkedInReviewTask(baseTask, baseContent)).toBe(true);
    expect(isLinkedInReviewTask({ ...baseTask, type: 'RECORD_VIDEO' }, baseContent)).toBe(false);
  });

  it('calcula el lunes de la semana del plan', () => {
    const wednesday = new Date('2026-08-19T12:00:00Z');
    expect(planWeekStartDay(12, wednesday)).toBe(10);
  });

  it('prioriza post checklist de la semana actual', () => {
    const monday = new Date('2026-08-17T12:00:00Z');
    const tasks: Task[] = [
      { ...baseTask, id: 'task_old', contentItemId: 'cnt_old', campaignDay: 3 },
      { ...baseTask, id: 'task_week', contentItemId: 'cnt_week', campaignDay: 12 },
      { ...baseTask, id: 'task_check', contentItemId: 'cnt_check', campaignDay: 13 },
    ];
    const contents: ContentItem[] = [
      { ...baseContent, id: 'cnt_old', format: 'viewpoint' },
      { ...baseContent, id: 'cnt_week', format: 'viewpoint', campaignDay: 12 },
      { ...baseContent, id: 'cnt_check', format: 'checklist', campaignDay: 13, title: 'Checklist GC' },
    ];

    const pick = pickWeeklyLinkedInPostTask(tasks, contents, 12, monday);
    expect(pick?.content.id).toBe('cnt_check');
  });
});
