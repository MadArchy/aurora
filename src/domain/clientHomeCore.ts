import type { ContentItem, Task } from '../types';

export function isLinkedInReviewTask(task: Task, content?: ContentItem | null): boolean {
  if (task.type !== 'REVIEW_ARTICLE' || !task.contentItemId) return false;
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
  if (!content) return false;
  return content.type === 'LINKEDIN_ARTICLE' && content.targetPlatform === 'LinkedIn';
}

/** Día del plan que corresponde al lunes de la semana calendario actual. */
export function planWeekStartDay(currentPlanDay: number, now = new Date()): number {
  const mondayOffset = (now.getDay() + 6) % 7;
  return currentPlanDay - mondayOffset;
}

/** Post LinkedIn de la semana más relevante para aprobar/editar desde el home. */
export function pickWeeklyLinkedInPostTask(
  tasks: Task[],
  contents: ContentItem[],
  currentPlanDay: number,
  now = new Date()
): { task: Task; content: ContentItem } | null {
  const byId = new Map(contents.map((c) => [c.id, c]));
  const weekStart = planWeekStartDay(currentPlanDay, now);
  const weekEnd = weekStart + 6;

  const candidates = tasks
    .map((task) => {
      const content = task.contentItemId ? byId.get(task.contentItemId) : undefined;
      return isLinkedInReviewTask(task, content) ? { task, content: content! } : null;
    })
    .filter((row): row is { task: Task; content: ContentItem } => row !== null);

  if (!candidates.length) return null;

  const score = (entry: { task: Task; content: ContentItem }) => {
    let s = 0;
    const day = entry.task.campaignDay ?? entry.content.campaignDay;
    if (day !== undefined && day >= weekStart && day <= weekEnd) s += 100;
    if (entry.content.format === 'checklist') s += 50;
    if (entry.task.deadline) {
      const daysLeft = Math.floor((new Date(entry.task.deadline).getTime() - now.getTime()) / 86400000);
      s += Math.max(0, 30 - daysLeft);
    }
    return s;
  };

  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}
