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
    const completed = subtasks.filter(subtask => subtask.status === 'closed').length;
    const total = subtasks.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  }

  shouldCloseEpic(epicId: string, issues: Issue[]): boolean {
    const subtasks = this.getEpicSubtasks(epicId, issues);
    return subtasks.length > 0 && subtasks.every(subtask => subtask.status === 'closed');
  }

  canCloseIssue(issueId: string, issues: Issue[]): { canClose: boolean; openSubtasks?: Issue[] } {
    // Check if the issue exists
    const issueExists = issues.some(issue => issue.id === issueId);
    if (!issueExists) {
      return { canClose: false, openSubtasks: [] };
    }

    const subtasks = this.getEpicSubtasks(issueId, issues);
    const openSubtasks = subtasks.filter(subtask => subtask.status !== 'closed');
    
    return {
      canClose: openSubtasks.length === 0,
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