import { injectable } from 'inversify';
import { Issue, DependencyType } from './types';

export interface IGraphService {
  buildGraph(issues: Issue[]): Map<string, Issue>;
  getReadyWork(issues: Issue[]): Issue[];
  getBlockedIssues(issues: Issue[]): Issue[];
  addDependency(fromId: string, toId: string, type: DependencyType, issues: Issue[]): Issue[];
  removeDependency(fromId: string, toId: string, issues: Issue[]): Issue[];
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
}