import { injectable } from 'inversify';
import { Task, DependencyType } from './types';
import { calculateCompletionPercentage } from './utils';

export interface IGraphService {
  buildGraph(tasks: Task[]): Map<string, Task>;
  getReadyWork(tasks: Task[]): Task[];
  getBlockedTasks(tasks: Task[]): Task[];
  addDependency(fromId: string, toId: string, type: DependencyType, tasks: Task[]): Task[];
  removeDependency(fromId: string, toId: string, tasks: Task[]): Task[];
  getEpicSubtasks(epicId: string, tasks: Task[]): Task[];
  getSubtaskEpic(subtaskId: string, tasks: Task[]): Task | null;
  calculateEpicProgress(epicId: string, tasks: Task[]): { completed: number; total: number; percentage: number };
  shouldCloseEpic(epicId: string, tasks: Task[]): boolean;
  canCloseTask(taskId: string, tasks: Task[]): { canClose: boolean; openSubtasks?: Task[]; reason?: string; completionPercentage?: number };
  getNonParentedTasks(tasks: Task[]): Task[];
  wouldCreateCycle(fromId: string, toId: string, type: DependencyType, tasks: Task[]): boolean;
}

@injectable()
export class GraphService implements IGraphService {
  buildGraph(tasks: Task[]): Map<string, Task> {
    const graph = new Map<string, Task>();
    for (const task of tasks) {
      graph.set(task.id, { ...task });
    }
    // Compute dependents
    for (const task of tasks) {
      if (task.dependencies) {
        for (const dep of task.dependencies) {
          const depTask = graph.get(dep.id);
          if (depTask) {
            if (!depTask.dependents) depTask.dependents = [];
            if (!depTask.dependents.includes(task.id)) {
              depTask.dependents.push(task.id);
            }
          }
        }
      }
    }
    return graph;
  }

  getReadyWork(tasks: Task[]): Task[] {
    const graph = this.buildGraph(tasks);
    return tasks.filter(task => {
      if (task.status !== 'open') return false;
      // Check if blocked
      if (task.dependencies) {
        for (const dep of task.dependencies) {
          if (dep.type === 'blocked_by' || dep.type === 'blocks') {
            const depTask = graph.get(dep.id);
            if (depTask && depTask.status !== 'closed') {
              return false;
            }
          }
        }
      }
      return true;
    });
  }

  getBlockedTasks(tasks: Task[]): Task[] {
    const graph = this.buildGraph(tasks);
    return tasks.filter(task => {
      if (task.status === 'closed') return false;
      if (task.dependencies) {
        for (const dep of task.dependencies) {
          if (dep.type === 'blocked_by' || dep.type === 'blocks') {
            const depTask = graph.get(dep.id);
            if (depTask && depTask.status !== 'closed') {
              return true;
            }
          }
        }
      }
      return false;
    });
  }

  addDependency(fromId: string, toId: string, type: DependencyType, tasks: Task[]): Task[] {
    // Check for circular dependencies before adding
    if (this.wouldCreateCycle(fromId, toId, type, tasks)) {
      throw new Error(`Adding ${type} dependency from ${fromId} to ${toId} would create a circular dependency`);
    }

    const updated = tasks.map(task => {
      if (task.id === fromId) {
        const deps = task.dependencies || [];
        if (!deps.some(d => d.id === toId && d.type === type)) {
          deps.push({ id: toId, type });
        }
        return { ...task, dependencies: deps, updated_at: new Date().toISOString() };
      }
      return task;
    });
    return updated;
  }

  /**
   * Determines whether adding a dependency from one issue to another would introduce
   * a cycle in the dependency graph.
   *
   * This method does not modify the provided issues; it conceptually simulates adding
   * a dependency of the given {@link DependencyType} from {@code fromId} to {@code toId}
   * and checks if that relationship would create a cyclic dependency.
   *
   * @param fromId The ID of the issue that would gain a new dependency.
   * @param toId The ID of the issue that would be depended on.
   * @param type The type of dependency being added.
   * @param issues The full set of issues used to build the dependency graph.
   * @returns {@code true} if adding this dependency would create a cycle in the graph,
   *          {@code false} otherwise (including when the edge is effectively a no-op
   *          or the IDs do not correspond to existing issues).
   */
  wouldCreateCycle(fromId: string, toId: string, type: DependencyType, tasks: Task[]): boolean {
    // For now, only check parent-child relationships for cycles
    // Blocks relationships can have cycles in some cases (A blocks B, B blocks A)
    // but we'll be conservative and prevent cycles for blocks too
    if (type !== 'parent-child' && type !== 'blocked_by' && type !== 'blocks') {
      return false; // Other types don't create cycles we're concerned about
    }

    const visited = new Set<string>();
    const stack = [toId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      if (current === fromId) {
        return true; // Found a path from toId to fromId, so adding fromId -> toId would create a cycle
      }

      // Find tasks that current depends on with the same type (treat blocks/blocked_by equivalently)
      const currentTask = tasks.find(task => task.id === current);
      if (currentTask?.dependencies) {
        for (const dep of currentTask.dependencies) {
          if (type === 'parent-child' ? dep.type === 'parent-child' : (dep.type === 'blocked_by' || dep.type === 'blocks')) {
            stack.push(dep.id);
          }
        }
      }
    }

    return false;
  }

  removeDependency(fromId: string, toId: string, tasks: Task[]): Task[] {
    return tasks.map(task => {
      if (task.id === fromId && task.dependencies) {
        const deps = task.dependencies.filter(d => d.id !== toId);
        return { ...task, dependencies: deps, updated_at: new Date().toISOString() };
      }
      return task;
    });
  }

  getEpicSubtasks(epicId: string, tasks: Task[]): Task[] {
    return tasks.filter(task =>
      task.dependencies?.some(dep => dep.id === epicId && dep.type === 'parent-child')
    );
  }

  getSubtaskEpic(subtaskId: string, tasks: Task[]): Task | null {
    const subtask = tasks.find(task => task.id === subtaskId);
    if (!subtask?.dependencies) return null;

    const epicDep = subtask.dependencies.find(dep => dep.type === 'parent-child');
    if (!epicDep) return null;

    return tasks.find(task => task.id === epicDep.id) || null;
  }

  calculateEpicProgress(epicId: string, tasks: Task[]): { completed: number; total: number; percentage: number } {
    const subtasks = this.getEpicSubtasks(epicId, tasks);
    const total = subtasks.length;
    if (total === 0) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    const completionPercentages = subtasks.map(st => st.completion_percentage ?? 0);
    const completed = completionPercentages.filter(cp => cp === 100).length;
    const percentage = Math.round(completionPercentages.reduce((sum, cp) => sum + cp, 0) / total);

    return { completed, total, percentage };
  }

  shouldCloseEpic(epicId: string, tasks: Task[]): boolean {
    const subtasks = this.getEpicSubtasks(epicId, tasks);
    return subtasks.length > 0 && subtasks.every(subtask => subtask.status === 'closed');
  }

  canCloseTask(taskId: string, tasks: Task[]): { canClose: boolean; openSubtasks?: Task[]; reason?: string; completionPercentage?: number } {
    // Check if the task exists
    const task = tasks.find(task => task.id === taskId);
    if (!task) {
      return { canClose: false, openSubtasks: [], reason: 'Task not found' };
    }

    // If already closed, it's valid
    if (task.status === 'closed') {
      return { canClose: true, completionPercentage: 100 };
    }

    const subtasks = this.getEpicSubtasks(taskId, tasks);
    const openSubtasks = subtasks.filter(subtask => subtask.status !== 'closed');

    // Check for open subtasks first
    if (openSubtasks.length > 0) {
      return {
        canClose: false,
        openSubtasks,
        reason: `has ${openSubtasks.length} open subtask(s)`
      };
    }

    // Check acceptance criteria
    const hasIncompleteAC = task.acceptance_criteria && task.acceptance_criteria.length > 0 
      && !task.acceptance_criteria.every(ac => ac.completed);
    
    if (hasIncompleteAC) {
      const incompleteCount = task.acceptance_criteria!.filter(ac => !ac.completed).length;
      return {
        canClose: false,
        reason: `has ${incompleteCount} incomplete acceptance criteria`
      };
    }

    // Verify completion percentage would be 100%
    // Calculate what completion would be if this task were marked as closed
    const tempTask = { ...task, status: 'closed' as const };
    const tempTasks = tasks.map(i => i.id === taskId ? tempTask : i);
    const completionPct = calculateCompletionPercentage(tempTask, tempTasks);
    
    if (completionPct < 100) {
      return {
        canClose: false,
        completionPercentage: completionPct,
        reason: `completion percentage is ${completionPct}% (must be 100%)`
      };
    }

    return { canClose: true, completionPercentage: 100 };
  }

  getNonParentedTasks(tasks: Task[]): Task[] {
    const parentedIds = new Set<string>();
    for (const task of tasks) {
      if (task.dependencies) {
        for (const dep of task.dependencies) {
          if (dep.type === 'parent-child') {
            parentedIds.add(task.id);
          }
        }
      }
    }
    return tasks.filter(task => !parentedIds.has(task.id));
  }
}