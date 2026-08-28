import type { Task, TaskStatus } from '../../../types';

export interface TaskRepository {
  getById(taskId: string): Task | undefined;
  listByClient(clientId: string): Task[];
  saveStatus(input: {
    taskId: string;
    status: TaskStatus;
    evidenceUrl?: string;
    clientNotes?: string;
    completedAt?: string;
  }): Task;
  saveEvidence(input: {
    taskId: string;
    evidenceUrl: string;
    clientNotes?: string;
  }): Task;
  /** Notes-only update without status or evidence mutation. */
  saveNotes(input: { taskId: string; clientNotes: string }): Task;
}
