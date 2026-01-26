import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  isValidTaskStatus,
  isValidPriority,
  isValidTaskType,
  isValidDependencyType,
  isValidISODate,
  isValidComment,
  isValidAcceptanceCriteria,
  isValidDependency,
  validateTask,
  sanitizeFilePath,
  generateId,
  findCairnDir,
  calculateCompletionPercentage
} from './utils';
import { TaskStatus, Priority, TaskType, DependencyType } from './types';

describe('Validation Functions', () => {
  describe('isValidTaskStatus', () => {
    it('should return true for valid statuses', () => {
      expect(isValidTaskStatus('open')).toBe(true);
      expect(isValidTaskStatus('in_progress')).toBe(true);
      expect(isValidTaskStatus('closed')).toBe(true);
    });

    it('should return false for invalid statuses', () => {
      expect(isValidTaskStatus('pending')).toBe(false);
      expect(isValidTaskStatus('blocked')).toBe(false);
      expect(isValidTaskStatus('')).toBe(false);
      expect(isValidTaskStatus(null)).toBe(false);
      expect(isValidTaskStatus(undefined)).toBe(false);
      expect(isValidTaskStatus(123)).toBe(false);
    });
  });

  describe('isValidPriority', () => {
    it('should return true for valid priorities', () => {
      expect(isValidPriority('low')).toBe(true);
      expect(isValidPriority('medium')).toBe(true);
      expect(isValidPriority('high')).toBe(true);
      expect(isValidPriority('urgent')).toBe(true);
    });

    it('should return false for invalid priorities', () => {
      expect(isValidPriority('critical')).toBe(false);
      expect(isValidPriority('')).toBe(false);
      expect(isValidPriority(null)).toBe(false);
      expect(isValidPriority(undefined)).toBe(false);
      expect(isValidPriority(123)).toBe(false);
    });
  });

  describe('isValidTaskType', () => {
    it('should return true for valid types', () => {
      expect(isValidTaskType('epic')).toBe(true);
      expect(isValidTaskType('feature')).toBe(true);
      expect(isValidTaskType('task')).toBe(true);
      expect(isValidTaskType('bug')).toBe(true);
      expect(isValidTaskType('chore')).toBe(true);
      expect(isValidTaskType('docs')).toBe(true);
      expect(isValidTaskType('refactor')).toBe(true);
    });

    it('should return false for invalid types', () => {
      expect(isValidTaskType('story')).toBe(false);
      expect(isValidTaskType('')).toBe(false);
      expect(isValidTaskType(null)).toBe(false);
      expect(isValidTaskType(undefined)).toBe(false);
      expect(isValidTaskType(123)).toBe(false);
    });
  });

  describe('isValidDependencyType', () => {
    it('should return true for valid dependency types', () => {
      expect(isValidDependencyType('blocks')).toBe(true);
      expect(isValidDependencyType('related')).toBe(true);
      expect(isValidDependencyType('parent-child')).toBe(true);
      expect(isValidDependencyType('discovered-from')).toBe(true);
    });

    it('should return false for invalid dependency types', () => {
      expect(isValidDependencyType('depends')).toBe(false);
      expect(isValidDependencyType('')).toBe(false);
      expect(isValidDependencyType(null)).toBe(false);
      expect(isValidDependencyType(undefined)).toBe(false);
      expect(isValidDependencyType(123)).toBe(false);
    });
  });

  describe('isValidISODate', () => {
    it('should return true for valid ISO date strings', () => {
      expect(isValidISODate('2023-01-01T00:00:00.000Z')).toBe(true);
      expect(isValidISODate('2023-12-31T23:59:59.999Z')).toBe(true);
      expect(isValidISODate(new Date().toISOString())).toBe(true);
    });

    it('should return false for invalid date strings', () => {
      expect(isValidISODate('2023-01-01')).toBe(false);
      expect(isValidISODate('not-a-date')).toBe(false);
      expect(isValidISODate('')).toBe(false);
      expect(isValidISODate(null)).toBe(false);
      expect(isValidISODate(undefined)).toBe(false);
      expect(isValidISODate(123)).toBe(false);
    });
  });

  describe('isValidComment', () => {
    it('should return true for valid comments', () => {
      const validComment = {
        id: 'comment-1',
        author: 'user',
        content: 'This is a comment',
        created_at: new Date().toISOString()
      };
      expect(isValidComment(validComment)).toBe(true);
    });

    it('should return false for invalid comments', () => {
      expect(isValidComment(null)).toBe(false);
      expect(isValidComment({})).toBe(false);
      expect(isValidComment({ id: '', author: 'user', content: 'test', created_at: 'invalid' })).toBe(false);
      expect(isValidComment({ id: 'comment-1', author: '', content: 'test', created_at: '2023-01-01T00:00:00.000Z' })).toBe(false);
      expect(isValidComment({ id: 'comment-1', author: 'user', content: 123, created_at: '2023-01-01T00:00:00.000Z' })).toBe(false);
    });
  });

  describe('isValidAcceptanceCriteria', () => {
    it('should return true for valid acceptance criteria', () => {
      expect(isValidAcceptanceCriteria({ text: 'Criteria 1', completed: false })).toBe(true);
      expect(isValidAcceptanceCriteria({ text: 'Criteria 2', completed: true })).toBe(true);
    });

    it('should return false for invalid acceptance criteria', () => {
      expect(isValidAcceptanceCriteria(null)).toBe(false);
      expect(isValidAcceptanceCriteria({})).toBe(false);
      expect(isValidAcceptanceCriteria({ text: 123, completed: false })).toBe(false);
      expect(isValidAcceptanceCriteria({ text: 'test', completed: 'yes' })).toBe(false);
    });
  });

  describe('isValidDependency', () => {
    it('should return true for valid dependencies', () => {
      expect(isValidDependency({ id: 'dep-1', type: 'blocks' })).toBe(true);
      expect(isValidDependency({ id: 'dep-2', type: 'related' })).toBe(true);
    });

    it('should return false for invalid dependencies', () => {
      expect(isValidDependency(null)).toBe(false);
      expect(isValidDependency({})).toBe(false);
      expect(isValidDependency({ id: '', type: 'blocks' })).toBe(false);
      expect(isValidDependency({ id: 'dep-1', type: 'invalid' })).toBe(false);
    });
  });

  describe('validateTask', () => {
    const validTask = {
      id: 's-test123',
      title: 'Test Task',
      status: 'open' as TaskStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    it('should validate a minimal valid issue', () => {
      const result = validateTask(validTask);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a complete valid issue', () => {
      const completeTask = {
        ...validTask,
        description: 'Test description',
        type: 'task' as TaskType,
        priority: 'medium' as Priority,
        assignee: 'user',
        labels: ['bug', 'urgent'],
        dependencies: [{ id: 'dep-1', type: 'blocks' as DependencyType }],
        comments: [{
          id: 'comment-1',
          author: 'user',
          content: 'Comment',
          created_at: new Date().toISOString()
        }],
        acceptance_criteria: [{ text: 'Criteria 1', completed: false }],
        closed_at: new Date().toISOString()
      };

      const result = validateTask(completeTask);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid issues', () => {
      // Test null/undefined
      expect(validateTask(null).isValid).toBe(false);
      expect(validateTask(undefined).isValid).toBe(false);

      // Test missing required fields
      expect(validateTask({}).isValid).toBe(false);

      // Test invalid types
      const invalidTask = {
        id: '',
        title: '',
        status: 'invalid',
        created_at: 'invalid-date',
        updated_at: 'invalid-date'
      };
      const result = validateTask(invalidTask);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate optional fields correctly', () => {
      // Valid with optional fields
      const issueWithOptionals = {
        ...validTask,
        description: 'desc',
        type: 'bug',
        priority: 'high'
      };
      expect(validateTask(issueWithOptionals).isValid).toBe(true);

      // Invalid optional fields
      const issueWithInvalidOptionals = {
        ...validTask,
        description: 123,
        type: 'invalid',
        priority: 'invalid'
      };
      const result = validateTask(issueWithInvalidOptionals);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task description must be a string if provided');
      expect(result.errors).toContain('Task type must be one of: epic, feature, task, bug, chore, docs, refactor');
      expect(result.errors).toContain('Task priority must be one of: low, medium, high, urgent');
    });
  });

  describe('sanitizeFilePath', () => {
    it('should sanitize basic paths', () => {
      expect(sanitizeFilePath('file.txt')).toBe('file.txt');
      expect(sanitizeFilePath('path/to/file.txt')).toBe(`path${path.sep}to${path.sep}file.txt`);
    });

    it('should prevent directory traversal', () => {
      expect(sanitizeFilePath('../../../etc/passwd')).toBe(`etc${path.sep}passwd`);
      // Test with forward slashes (works on all platforms)
      expect(sanitizeFilePath('../../../windows/system32')).toBe(`windows${path.sep}system32`);
    });

    it('should validate file extensions when specified', () => {
      expect(() => sanitizeFilePath('file.txt', ['.txt'])).not.toThrow();
      expect(() => sanitizeFilePath('file.jpg', ['.txt'])).toThrow('File extension \'.jpg\' is not allowed');
    });

    it('should throw error for non-string input', () => {
      expect(() => sanitizeFilePath(null as any)).toThrow('File path must be a string');
      expect(() => sanitizeFilePath(123 as any)).toThrow('File path must be a string');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const issues = [{ id: 's-existing' }];
      const id = generateId(issues);
      expect(id).toMatch(/^s-[a-zA-Z0-9_-]{8,9}$/);
      expect(id).not.toBe('s-existing');
    });

    it('should avoid conflicts with multiple existing IDs', () => {
      const issues = [
        { id: 's-test1' },
        { id: 's-test2' },
        { id: 's-test3' }
      ];
      const id = generateId(issues);
      expect(issues.find(i => i.id === id)).toBeUndefined();
    });
  });

  describe('findCairnDir', () => {
    // Note: These tests would require setting up mock file system
    // For now, we'll test the basic logic
    it('should return fallback when no .cairn directory found', () => {
      const result = findCairnDir('/nonexistent/path');
      expect(result.cairnDir).toContain('.cairn');
      expect(result.repoRoot).toBe('/nonexistent/path');
    });
  });

  describe('calculateCompletionPercentage', () => {
    const mockTask = (id: string, ac?: any[], deps?: any[]): any => ({
      id,
      title: 'Test Task',
      status: 'open',
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z',
      acceptance_criteria: ac,
      dependencies: deps
    });

    it('should return 0% for open leaf issue with no AC', () => {
      const issue = mockTask('1');
      issue.status = 'open';
      const allTasks = [issue];
      expect(calculateCompletionPercentage(issue, allTasks)).toBe(0);
    });

    it('should return 100% for closed leaf issue with incomplete AC', () => {
      const issue = mockTask('1', [
        { text: 'AC1', completed: false },
        { text: 'AC2', completed: false }
      ]);
      issue.status = 'closed';
      const allTasks = [issue];
      expect(calculateCompletionPercentage(issue, allTasks)).toBe(100);
    });

    it('should calculate percentage based on completed AC', () => {
      const issue = mockTask('1', [
        { text: 'AC1', completed: true },
        { text: 'AC2', completed: false },
        { text: 'AC3', completed: true }
      ]);
      const allTasks = [issue];
      expect(calculateCompletionPercentage(issue, allTasks)).toBe(67); // 2/3
    });

    it('should calculate percentage based on completed subtasks', () => {
      const parent = mockTask('1');
      const child1 = mockTask('2', [], [{ id: '1', type: 'parent-child' }]);
      child1.status = 'closed';
      child1.completion_percentage = 100; // closed leaf
      const child2 = mockTask('3', [], [{ id: '1', type: 'parent-child' }]);
      child2.status = 'open';
      child2.completion_percentage = 0; // open leaf
      const allTasks = [parent, child1, child2];
      expect(calculateCompletionPercentage(parent, allTasks)).toBe(50); // (0 AC + 1 subtask) / (0 AC + 2 subtasks) = 1/2
    });

    it('should calculate percentage with mixed AC and subtasks', () => {
      const parent = mockTask('1', [
        { text: 'AC1', completed: true },
        { text: 'AC2', completed: false }
      ]);
      const child1 = mockTask('2', [], [{ id: '1', type: 'parent-child' }]);
      child1.status = 'closed';
      child1.completion_percentage = 100;
      const child2 = mockTask('3', [], [{ id: '1', type: 'parent-child' }]);
      child2.status = 'open';
      child2.completion_percentage = 0;
      const allTasks = [parent, child1, child2];
      expect(calculateCompletionPercentage(parent, allTasks)).toBe(50); // (1 AC + 1 subtask) / (2 AC + 2 subtasks) = 2/4
    });

    it('should handle edge case of empty AC array', () => {
      const issue = mockTask('1', []);
      const allTasks = [issue];
      expect(calculateCompletionPercentage(issue, allTasks)).toBe(0); // open leaf with empty AC
    });

    it('should round percentage correctly', () => {
      const issue = mockTask('1', [
        { text: 'AC1', completed: true },
        { text: 'AC2', completed: false },
        { text: 'AC3', completed: false }
      ]);
      const allTasks = [issue];
      expect(calculateCompletionPercentage(issue, allTasks)).toBe(33); // 1/3 ≈ 33.33, rounds to 33
    });

    it('should handle cycle detection and return 0 for cyclic dependencies', () => {
      const issueA = mockTask('A', [], [{ id: 'B', type: 'parent-child' }]);
      const issueB = mockTask('B', [], [{ id: 'A', type: 'parent-child' }]);
      const allTasks = [issueA, issueB];
      expect(calculateCompletionPercentage(issueA, allTasks)).toBe(0);
      expect(calculateCompletionPercentage(issueB, allTasks)).toBe(0);
    });

    it('should handle self-referencing cycle', () => {
      const issue = mockTask('1', [], [{ id: '1', type: 'parent-child' }]);
      const allTasks = [issue];
      expect(calculateCompletionPercentage(issue, allTasks)).toBe(0);
    });

    it('should handle complex cycle with multiple issues', () => {
      const issueA = mockTask('A', [], [{ id: 'B', type: 'parent-child' }]);
      const issueB = mockTask('B', [], [{ id: 'C', type: 'parent-child' }]);
      const issueC = mockTask('C', [], [{ id: 'A', type: 'parent-child' }]);
      const allTasks = [issueA, issueB, issueC];
      expect(calculateCompletionPercentage(issueA, allTasks)).toBe(0);
      expect(calculateCompletionPercentage(issueB, allTasks)).toBe(0);
      expect(calculateCompletionPercentage(issueC, allTasks)).toBe(0);
    });

    it('should calculate correctly for acyclic graphs even with cycles elsewhere', () => {
      const issueA = mockTask('A', [], [{ id: 'B', type: 'parent-child' }]);
      const issueB = mockTask('B', [], [{ id: 'C', type: 'parent-child' }]);
      const issueC = mockTask('C', [], [{ id: 'A', type: 'parent-child' }]); // cycle A->B->C->A
      const issueD = mockTask('D');
      const issueE = mockTask('E', [{ text: 'AC1', completed: true }], [{ id: 'D', type: 'parent-child' }]);
      const allTasks = [issueA, issueB, issueC, issueD, issueE];
      // D should calculate correctly despite cycle in A-B-C
      expect(calculateCompletionPercentage(issueD, allTasks)).toBe(100); // (0 AC + 1 subtask) / (0 AC + 1 subtask) = 1/1
    });
  });
});
