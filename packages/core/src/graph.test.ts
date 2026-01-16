import { describe, it, expect, beforeEach } from 'vitest'; import { GraphService } from './graph';
import { Issue } from '../types';

describe('GraphService', () => {
  let graphService: GraphService;

  beforeEach(() => {
    graphService = new GraphService();
  });

  describe('buildGraph', () => {
    it('should build graph with dependents', () => {
      const issues: Issue[] = [
        {
          id: 'a',
          title: 'A',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          dependencies: [{ id: 'b', type: 'blocks' }],
        },
        {
          id: 'b',
          title: 'B',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      const graph = graphService.buildGraph(issues);
      expect(graph.get('a')?.dependencies).toEqual([{ id: 'b', type: 'blocks' }]);
      expect(graph.get('b')?.dependents).toEqual(['a']);
    });
  });

  describe('getReadyWork', () => {
    it('should return open issues with no blocking dependencies', () => {
      const issues: Issue[] = [
        {
          id: 'a',
          title: 'A',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'b',
          title: 'B',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          dependencies: [{ id: 'a', type: 'blocks' }],
        },
      ];

      const ready = graphService.getReadyWork(issues);
      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe('a');
    });

    it('should return issues when blocking dependencies are closed', () => {
      const issues: Issue[] = [
        {
          id: 'a',
          title: 'A',
          status: 'closed',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          closed_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'b',
          title: 'B',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          dependencies: [{ id: 'a', type: 'blocks' }],
        },
      ];

      const ready = graphService.getReadyWork(issues);
      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe('b');
    });

    it('should not return closed issues', () => {
      const issues: Issue[] = [
        {
          id: 'a',
          title: 'A',
          status: 'closed',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          closed_at: '2023-01-01T00:00:00Z',
        },
      ];

      const ready = graphService.getReadyWork(issues);
      expect(ready).toHaveLength(0);
    });
  });

  describe('addDependency', () => {
    it('should add dependency to issue', () => {
      const issues: Issue[] = [
        {
          id: 'a',
          title: 'A',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'b',
          title: 'B',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      const updated = graphService.addDependency('a', 'b', 'blocks', issues);
      expect(updated[0].dependencies).toEqual([{ id: 'b', type: 'blocks' }]);
      expect(updated[0].updated_at).not.toBe('2023-01-01T00:00:00Z');
    });

    it('should not add duplicate dependency', () => {
      const issues: Issue[] = [
        {
          id: 'a',
          title: 'A',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          dependencies: [{ id: 'b', type: 'blocks' }],
        },
      ];

      const updated = graphService.addDependency('a', 'b', 'blocks', issues);
      expect(updated[0].dependencies).toHaveLength(1);
    });

    it('should add parent-child dependency for epic relationships', () => {
      const issues: Issue[] = [
        {
          id: 'sub-1',
          title: 'Subtask 1',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'epic-1',
          title: 'Epic 1',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      const updated = graphService.addDependency('sub-1', 'epic-1', 'parent-child', issues);
      expect(updated[0].dependencies).toEqual([{ id: 'epic-1', type: 'parent-child' }]);
      expect(updated[0].updated_at).not.toBe('2023-01-01T00:00:00Z');
    });

    it('should allow multiple dependency types on same issue', () => {
      const issues: Issue[] = [
        {
          id: 'sub-1',
          title: 'Subtask 1',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          dependencies: [{ id: 'task-a', type: 'blocks' }],
        },
        {
          id: 'epic-1',
          title: 'Epic 1',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      const updated = graphService.addDependency('sub-1', 'epic-1', 'parent-child', issues);
      expect(updated[0].dependencies).toHaveLength(2);
      expect(updated[0].dependencies).toEqual([
        { id: 'task-a', type: 'blocks' },
        { id: 'epic-1', type: 'parent-child' }
      ]);
    });
  });

  describe('removeDependency', () => {
    it('should remove dependency from issue', () => {
      const issues: Issue[] = [
        {
          id: 'a',
          title: 'A',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          dependencies: [{ id: 'b', type: 'blocks' }],
        },
      ];

      const updated = graphService.removeDependency('a', 'b', issues);
      expect(updated[0].dependencies).toEqual([]);
    });

    it('should remove parent-child dependency', () => {
      const issues: Issue[] = [
        {
          id: 'sub-1',
          title: 'Subtask 1',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          dependencies: [
            { id: 'task-a', type: 'blocks' },
            { id: 'epic-1', type: 'parent-child' }
          ],
        },
      ];

      const updated = graphService.removeDependency('sub-1', 'epic-1', issues);
      expect(updated[0].dependencies).toHaveLength(1);
      expect(updated[0].dependencies).toEqual([{ id: 'task-a', type: 'blocks' }]);
    });

    it('should not affect other dependencies when removing specific one', () => {
      const issues: Issue[] = [
        {
          id: 'sub-1',
          title: 'Subtask 1',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          dependencies: [
            { id: 'task-a', type: 'blocks' },
            { id: 'epic-1', type: 'parent-child' },
            { id: 'task-b', type: 'related' }
          ],
        },
      ];

      const updated = graphService.removeDependency('sub-1', 'epic-1', issues);
      expect(updated[0].dependencies).toHaveLength(2);
      expect(updated[0].dependencies).toEqual([
        { id: 'task-a', type: 'blocks' },
        { id: 'task-b', type: 'related' }
      ]);
    });
  });

  describe('Epic functionality', () => {
    describe('getEpicSubtasks', () => {
      it('should return subtasks that have parent-child dependency to the epic', () => {
        const issues: Issue[] = [
          {
            id: 'epic-1',
            title: 'Epic 1',
            status: 'open',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
          {
            id: 'sub-1',
            title: 'Subtask 1',
            status: 'open',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            dependencies: [{ id: 'epic-1', type: 'parent-child' }],
          },
          {
            id: 'sub-2',
            title: 'Subtask 2',
            status: 'open',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            dependencies: [{ id: 'epic-1', type: 'parent-child' }],
          },
          {
            id: 'other',
            title: 'Other task',
            status: 'open',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        ];

        const subtasks = graphService.getEpicSubtasks('epic-1', issues);
        expect(subtasks).toHaveLength(2);
        expect(subtasks.map(s => s.id)).toEqual(['sub-1', 'sub-2']);
      });

      it('should return empty array when epic has no subtasks', () => {
        const issues: Issue[] = [
          {
            id: 'epic-1',
            title: 'Epic 1',
            status: 'open',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        ];

        const subtasks = graphService.getEpicSubtasks('epic-1', issues);
        expect(subtasks).toHaveLength(0);
      });
    });

    describe('getSubtaskEpic', () => {
      it('should return the epic that a subtask belongs to', () => {
        const issues: Issue[] = [
          {
            id: 'epic-1',
            title: 'Epic 1',
            status: 'open',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
          {
            id: 'sub-1',
            title: 'Subtask 1',
            status: 'open',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            dependencies: [{ id: 'epic-1', type: 'parent-child' }],
          },
        ];

        const epic = graphService.getSubtaskEpic('sub-1', issues);
        expect(epic?.id).toBe('epic-1');
        expect(epic?.title).toBe('Epic 1');
      });

      it('should return null when subtask has no parent-child dependency', () => {
        const issues: Issue[] = [
          {
            id: 'sub-1',
            title: 'Subtask 1',
            status: 'open',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        ];

        const epic = graphService.getSubtaskEpic('sub-1', issues);
        expect(epic).toBeNull();
      });

      it('should return null when subtask does not exist', () => {
        const issues: Issue[] = [];

        const epic = graphService.getSubtaskEpic('nonexistent', issues);
        expect(epic).toBeNull();
      });
    });

    describe('calculateEpicProgress', () => {
      it('should calculate progress when some subtasks are completed', () => {
        const issues: Issue[] = [
          {
            id: 'epic-1',
            title: 'Epic 1',
            status: 'open',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
          {
            id: 'sub-1',
            title: 'Subtask 1',
            status: 'closed',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            closed_at: '2023-01-01T00:00:00Z',
            dependencies: [{ id: 'epic-1', type: 'parent-child' }],
          },
          {
            id: 'sub-2',
            title: 'Subtask 2',
            status: 'open',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            dependencies: [{ id: 'epic-1', type: 'parent-child' }],
          },
          {
            id: 'sub-3',
            title: 'Subtask 3',
            status: 'closed',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            closed_at: '2023-01-01T00:00:00Z',
            dependencies: [{ id: 'epic-1', type: 'parent-child' }],
          },
        ];

        const progress = graphService.calculateEpicProgress('epic-1', issues);
        expect(progress.completed).toBe(2);
        expect(progress.total).toBe(3);
        expect(progress.percentage).toBe(67); // Math.round(2/3 * 100)
      });

      it('should return 100% when all subtasks are completed', () => {
        const issues: Issue[] = [
          {
            id: 'epic-1',
            title: 'Epic 1',
            status: 'open',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
          {
            id: 'sub-1',
            title: 'Subtask 1',
            status: 'closed',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            closed_at: '2023-01-01T00:00:00Z',
            dependencies: [{ id: 'epic-1', type: 'parent-child' }],
          },
        ];

        const progress = graphService.calculateEpicProgress('epic-1', issues);
        expect(progress.completed).toBe(1);
        expect(progress.total).toBe(1);
        expect(progress.percentage).toBe(100);
      });

      it('should return 0% when epic has no subtasks', () => {
        const issues: Issue[] = [
          {
            id: 'epic-1',
            title: 'Epic 1',
            status: 'open',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        ];

        const progress = graphService.calculateEpicProgress('epic-1', issues);
        expect(progress.completed).toBe(0);
        expect(progress.total).toBe(0);
        expect(progress.percentage).toBe(0);
      });
    });

    describe('shouldCloseEpic', () => {
      it('should return true when all subtasks are closed', () => {
        const issues: Issue[] = [
          {
            id: 'epic-1',
            title: 'Epic 1',
            status: 'open',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
          {
            id: 'sub-1',
            title: 'Subtask 1',
            status: 'closed',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            closed_at: '2023-01-01T00:00:00Z',
            dependencies: [{ id: 'epic-1', type: 'parent-child' }],
          },
          {
            id: 'sub-2',
            title: 'Subtask 2',
            status: 'closed',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            closed_at: '2023-01-01T00:00:00Z',
            dependencies: [{ id: 'epic-1', type: 'parent-child' }],
          },
        ];

        const shouldClose = graphService.shouldCloseEpic('epic-1', issues);
        expect(shouldClose).toBe(true);
      });

      it('should return false when some subtasks are still open', () => {
        const issues: Issue[] = [
          {
            id: 'epic-1',
            title: 'Epic 1',
            status: 'open',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
          {
            id: 'sub-1',
            title: 'Subtask 1',
            status: 'closed',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            closed_at: '2023-01-01T00:00:00Z',
            dependencies: [{ id: 'epic-1', type: 'parent-child' }],
          },
          {
            id: 'sub-2',
            title: 'Subtask 2',
            status: 'open',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            dependencies: [{ id: 'epic-1', type: 'parent-child' }],
          },
        ];

        const shouldClose = graphService.shouldCloseEpic('epic-1', issues);
        expect(shouldClose).toBe(false);
      });

      it('should return false when epic has no subtasks', () => {
        const issues: Issue[] = [
          {
            id: 'epic-1',
            title: 'Epic 1',
            status: 'open',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        ];

        const shouldClose = graphService.shouldCloseEpic('epic-1', issues);
        expect(shouldClose).toBe(false);
      });
    });
  });
});