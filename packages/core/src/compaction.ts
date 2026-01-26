import { injectable } from 'inversify';
import { Task } from './types';

export interface ICompactionService {
  compactTasks(tasks: Task[]): Task[];
}

@injectable()
export class CompactionService implements ICompactionService {
  private readonly COMPACTION_DAYS = 30;

  compactTasks(tasks: Task[]): Task[] {
    const now = new Date();
    return tasks.map(task => {
      if (task.status === 'closed' && task.closed_at) {
        const closedDate = new Date(task.closed_at);
        const daysSinceClosed = (now.getTime() - closedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceClosed > this.COMPACTION_DAYS) {
          return {
            ...task,
            description: task.description ? task.description.substring(0, 200) + '...' : undefined,
            acceptance_criteria: undefined, // remove criteria
          };
        }
      }
      return task;
    });
  }
}