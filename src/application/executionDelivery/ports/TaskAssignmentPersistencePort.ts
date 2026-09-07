import type { Task } from '../../../types';

/** Narrow create-only persistence for CR-1 #27 AssignClientTask. */
export interface TaskAssignmentPersistencePort {
  createTask(task: Omit<Task, 'id' | 'createdAt'>): Task;
}
