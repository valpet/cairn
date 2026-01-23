import { injectable } from 'inversify';
import { Issue, DependencyType } from './types';

export interface IGraphService {
  buildGraph(issues: Issue[]): Map<string, Issue>;
  getReadyWork(issues: Issue[]): Issue[];
  getBlockedIssues(issues: Issue[]): Issue[];
  addDependency(fromId: string, toId: string, type: DependencyType, issues: Issue[]): Issue[];
  removeDependency(fromId: string, toId: string, issues: Issue[]): Issue[];
  getEpicSubtasks(epicId: string, issues: Issue[]): Issue[];
  getSubtaskEpic(subtaskId: string, issues: Issue[]): Issue | null;
  calculateEpicProgress(epicId: string, issues: Issue[]): { completed: number; total: number; percentage: number };
  shouldCloseEpic(epicId: string, issues: Issue[]): boolean;
  canCloseIssue(issueId: string, issues: Issue[]): { canClose: boolean; openSubtasks?: Issue[] };
  getNonParentedIssues(issues: Issue[]): Issue[];
}

@injectable()
export class GraphService implements IGraphService {
  buildGraph(issues: Issue[]): Map<string, Issue> {
    const graph = new Map<string, Issue>();
    for (const issue of issues) {
      graph.set(issue.id, { ...issue });
    }
    // Compute dependents
    for (const issue of issues) {
      if (issue.dependencies) {
        for (const dep of issue.dependencies) {
          const depIssue = graph.get(dep.id);
          if (depIssue) {
            if (!depIssue.dependents) depIssue.dependents = [];
            if (!depIssue.dependents.includes(issue.id)) {
              depIssue.dependents.push(issue.id);
            }
          }
        }
      }
    }
    return graph;
  }

  getReadyWork(issues: Issue[]): Issue[] {
    const graph = this.buildGraph(issues);
    return issues.filter(issue => {
      if (issue.status !== 'open') return false;
      // Check if blocked
      if (issue.dependencies) {
        for (const dep of issue.dependencies) {
          if (dep.type === 'blocks') {
            const depIssue = graph.get(dep.id);
            if (depIssue && depIssue.status !== 'closed') {
              return false;
            }
          }
        }
      }
      return true;
    });
  }

  getBlockedIssues(issues: Issue[]): Issue[] {
    const graph = this.buildGraph(issues);
    return issues.filter(issue => {
      if (issue.status === 'closed') return false;
      if (issue.dependencies) {
        for (const dep of issue.dependencies) {
          if (dep.type === 'blocks') {
            const depIssue = graph.get(dep.id);
            if (depIssue && depIssue.status !== 'closed') {
              return true;
            }
          }
        }
      }
      return false;
    });
  }

  addDependency(fromId: string, toId: string, type: DependencyType, issues: Issue[]): Issue[] {
    // Check for circular dependencies before adding
    if (this.wouldCreateCycle(fromId, toId, type, issues)) {
      throw new Error(`Adding ${type} dependency from ${fromId} to ${toId} would create a circular dependency`);
    }

    const updated = issues.map(issue => {
      if (issue.id === fromId) {
        const deps = issue.dependencies || [];
        if (!deps.some(d => d.id === toId && d.type === type)) {
          deps.push({ id: toId, type });
        }
        return { ...issue, dependencies: deps, updated_at: new Date().toISOString() };
      }
      return issue;
    });
    return updated;
  }

  private wouldCreateCycle(fromId: string, toId: string, type: DependencyType, issues: Issue[]): boolean {
    // For now, only check parent-child relationships for cycles
    // Blocks relationships can have cycles in some cases (A blocks B, B blocks A)
    // but we'll be conservative and prevent cycles for blocks too
    if (type !== 'parent-child' && type !== 'blocks') {
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

      // Find issues that current depends on with the same type
      const currentIssue = issues.find(issue => issue.id === current);
      if (currentIssue?.dependencies) {
        for (const dep of currentIssue.dependencies) {
          if (dep.type === type) {
            stack.push(dep.id);
          }
        }
      }
    }

    return false;
  }

  removeDependency(fromId: string, toId: string, issues: Issue[]): Issue[] {
    return issues.map(issue => {
      if (issue.id === fromId && issue.dependencies) {
        const deps = issue.dependencies.filter(d => d.id !== toId);
        return { ...issue, dependencies: deps, updated_at: new Date().toISOString() };
      }
      return issue;
    });
  }

  getEpicSubtasks(epicId: string, issues: Issue[]): Issue[] {
    return issues.filter(issue =>
      issue.dependencies?.some(dep => dep.id === epicId && dep.type === 'parent-child')
    );
  }

  getSubtaskEpic(subtaskId: string, issues: Issue[]): Issue | null {
    const subtask = issues.find(issue => issue.id === subtaskId);
    if (!subtask?.dependencies) return null;

    const epicDep = subtask.dependencies.find(dep => dep.type === 'parent-child');
    if (!epicDep) return null;

    return issues.find(issue => issue.id === epicDep.id) || null;
  }

  calculateEpicProgress(epicId: string, issues: Issue[]): { completed: number; total: number; percentage: number } {
    const subtasks = this.getEpicSubtasks(epicId, issues);
    const total = subtasks.length;
    if (total === 0) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    const completionPercentages = subtasks.map(st => st.completion_percentage ?? 0);
    const completed = completionPercentages.filter(cp => cp === 100).length;
    const percentage = Math.round(completionPercentages.reduce((sum, cp) => sum + cp, 0) / total);

    return { completed, total, percentage };
  }

  shouldCloseEpic(epicId: string, issues: Issue[]): boolean {
    const subtasks = this.getEpicSubtasks(epicId, issues);
    return subtasks.length > 0 && subtasks.every(subtask => subtask.status === 'closed');
  }

  canCloseIssue(issueId: string, issues: Issue[]): { canClose: boolean; openSubtasks?: Issue[] } {
    // Check if the issue exists
    const issue = issues.find(issue => issue.id === issueId);
    if (!issue) {
      return { canClose: false, openSubtasks: [] };
    }

    const subtasks = this.getEpicSubtasks(issueId, issues);
    const openSubtasks = subtasks.filter(subtask => subtask.status !== 'closed');

    // Check if issue is 100% complete
    const isComplete = issue.completion_percentage === 100;

    return {
      canClose: openSubtasks.length === 0 && isComplete,
      openSubtasks: openSubtasks.length > 0 ? openSubtasks : undefined
    };
  }

  getNonParentedIssues(issues: Issue[]): Issue[] {
    const parentedIds = new Set<string>();
    for (const issue of issues) {
      if (issue.dependencies) {
        for (const dep of issue.dependencies) {
          if (dep.type === 'parent-child') {
            parentedIds.add(issue.id);
          }
        }
      }
    }
    return issues.filter(issue => !parentedIds.has(issue.id));
  }
}