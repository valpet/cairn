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
  });
});