import { describe, it, expect } from 'vitest';
import { Issue } from './types';
import { ConsoleLogger, LogLevel } from './logger';

// Mock logger for testing
const mockLogger = new ConsoleLogger(LogLevel.DEBUG);

// Create a test version of the migration function
function migrateIssues(issues: Issue[]): Issue[] {
  let hasMigrations = false;
  const migratedIssues = issues.map(issue => {
    let issueUpdated = false;

    // Migration: Convert 'blocked' status to 'open' (removing blocked as a stored status)
    if (issue.status === 'blocked') {
      issue.status = 'open';
      issue.updated_at = new Date().toISOString();
      hasMigrations = true;
      issueUpdated = true;
    }

    if (!issue.dependencies || issue.dependencies.length === 0) {
      return issueUpdated ? { ...issue } : issue;
    }

    // Check for any old dependency formats that need migration
    const migratedDeps = issue.dependencies.filter(dep => {
      // Remove any invalid dependency types (keep only valid ones)
      return ['blocks', 'related', 'parent-child', 'discovered-from'].includes(dep.type);
    });

    // Check if any dependencies were filtered out
    if (migratedDeps.length !== issue.dependencies.length) {
      hasMigrations = true;
      issueUpdated = true;
    }

    // Check for potential bidirectional dependencies that might create duplicates
    // If issue A has "blocks" dependency to B, and B also has "blocks" dependency to A,
    // we should remove the redundant one (keep only on the dependent issue)
    const cleanedDeps = migratedDeps.filter((dep) => {
      if (dep.type === 'blocks') {
        // Check if the target issue also has a 'blocks' dependency back to this issue
        const targetIssue = issues.find(i => i.id === dep.id);
        if (targetIssue && targetIssue.dependencies) {
          const hasReverseDep = targetIssue.dependencies.some(reverseDep =>
            reverseDep.id === issue.id && reverseDep.type === 'blocks'
          );
          if (hasReverseDep) {
            // Both issues have 'blocks' dependencies to each other
            // Keep only on the issue with the lexicographically smaller ID (deterministic choice)
            if (issue.id > targetIssue.id) {
              hasMigrations = true;
              issueUpdated = true;
              return false; // Remove this dependency (keep on the smaller ID issue)
            }
          }
        }
      }
      return true;
    });

    if (cleanedDeps.length !== migratedDeps.length) {
      hasMigrations = true;
      issueUpdated = true;
    }

    if (issueUpdated) {
      return {
        ...issue,
        dependencies: cleanedDeps.length !== issue.dependencies.length ? cleanedDeps : issue.dependencies,
        updated_at: new Date().toISOString()
      };
    }

    return issue;
  });

  return migratedIssues;
}

describe('Issue Migration', () => {
  const createMockIssue = (id: string, deps: any[] = [], status: string = 'open'): Issue => ({
    id,
    title: `Issue ${id}`,
    status: status as any,
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-01T00:00:00.000Z',
    dependencies: deps
  });

  it('should not modify issues without dependencies and valid status', () => {
    const issues = [
      createMockIssue('issue-1'),
      createMockIssue('issue-2')
    ];

    const result = migrateIssues(issues);

    expect(result).toEqual(issues);
  });

  it('should migrate blocked status to open', () => {
    const issues = [
      createMockIssue('issue-1', [], 'blocked'),
      createMockIssue('issue-2', [], 'open')
    ];

    const result = migrateIssues(issues);

    expect(result[0].status).toBe('open');
    expect(result[0].updated_at).not.toBe('2023-01-01T00:00:00.000Z'); // Should be updated
    expect(result[1].status).toBe('open'); // Should remain unchanged
    expect(result[1].updated_at).toBe('2023-01-01T00:00:00.000Z'); // Should remain unchanged
  });

  it('should remove invalid dependency types', () => {
    const issues = [
      createMockIssue('issue-1', [
        { id: 'issue-2', type: 'blocks' },
        { id: 'issue-3', type: 'invalid-type' },
        { id: 'issue-4', type: 'blocks' }
      ]),
      createMockIssue('issue-2')
    ];

    const result = migrateIssues(issues);

    expect(result[0].dependencies).toHaveLength(2);
    expect(result[0].dependencies).toEqual([
      { id: 'issue-2', type: 'blocks' },
      { id: 'issue-4', type: 'blocks' }
    ]);
    expect(result[0].updated_at).not.toBe('2023-01-01T00:00:00.000Z'); // Should be updated
  });

  it('should remove bidirectional blocks dependencies (keep on lexicographically smaller ID)', () => {
    const issues = [
      createMockIssue('a-issue', [{ id: 'b-issue', type: 'blocks' }]),
      createMockIssue('b-issue', [{ id: 'a-issue', type: 'blocks' }])
    ];

    const result = migrateIssues(issues);

    // 'a-issue' should keep its dependency (a < b lexicographically)
    expect(result[0].dependencies).toHaveLength(1);
    expect(result[0].dependencies[0]).toEqual({ id: 'b-issue', type: 'blocks' });
    expect(result[0].updated_at).toBe('2023-01-01T00:00:00.000Z'); // No change needed

    // 'b-issue' should have its dependency removed (b > a lexicographically)
    expect(result[1].dependencies).toHaveLength(0);
    expect(result[1].updated_at).not.toBe('2023-01-01T00:00:00.000Z'); // Should be updated
  });

  it('should handle complex bidirectional scenarios', () => {
    const issues = [
      createMockIssue('a', [{ id: 'b', type: 'blocks' }, { id: 'c', type: 'blocks' }]),
      createMockIssue('b', [{ id: 'a', type: 'blocks' }]),
      createMockIssue('c', [{ id: 'a', type: 'blocks' }])
    ];

    const result = migrateIssues(issues);

    // 'a' should keep both dependencies (a < b and a < c)
    expect(result[0].dependencies).toHaveLength(2);
    expect(result[0].dependencies).toEqual(
      expect.arrayContaining([
        { id: 'b', type: 'blocks' },
        { id: 'c', type: 'blocks' }
      ])
    );

    // 'b' and 'c' should have their reverse dependencies removed
    expect(result[1].dependencies).toHaveLength(0);
    expect(result[2].dependencies).toHaveLength(0);
  });

  it('should preserve non-blocks dependencies in bidirectional scenarios', () => {
    const issues = [
      createMockIssue('a', [
        { id: 'b', type: 'blocks' },
        { id: 'c', type: 'related' }
      ]),
      createMockIssue('b', [
        { id: 'a', type: 'blocks' },
        { id: 'd', type: 'parent-child' }
      ])
    ];

    const result = migrateIssues(issues);

    // 'a' should keep its dependencies (blocks to b, and related to c)
    expect(result[0].dependencies).toHaveLength(2);
    expect(result[0].dependencies).toEqual(
      expect.arrayContaining([
        { id: 'b', type: 'blocks' },
        { id: 'c', type: 'related' }
      ])
    );

    // 'b' should keep only its non-blocks dependency
    expect(result[1].dependencies).toHaveLength(1);
    expect(result[1].dependencies[0]).toEqual({ id: 'd', type: 'parent-child' });
  });

  it('should handle issues with missing target dependencies gracefully', () => {
    const issues = [
      createMockIssue('issue-1', [{ id: 'nonexistent', type: 'blocks' }])
    ];

    const result = migrateIssues(issues);

    // Should preserve the dependency since target doesn't exist
    expect(result[0].dependencies).toHaveLength(1);
    expect(result[0].dependencies[0]).toEqual({ id: 'nonexistent', type: 'blocks' });
  });
});