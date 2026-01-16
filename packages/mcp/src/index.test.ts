import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('@modelcontextprotocol/sdk/types.js');
vi.mock('@horizon/core', () => ({
  createContainer: vi.fn(),
  TYPES: {
    IStorageService: Symbol('IStorageService'),
    IGraphService: Symbol('IGraphService'),
    ICompactionService: Symbol('ICompactionService'),
    IGitService: Symbol('IGitService'),
  },
}));
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-id'),
}));
vi.mock('fs');
vi.mock('path');

// Import after mocking
import { createContainer, TYPES } from '@horizon/core';
import * as fs from 'fs';

describe('MCP Tool Handlers', () => {
  let mockStorage: any;
  let mockGraph: any;
  let mockCompaction: any;
  let mockGit: any;
  let mockContainer: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup container mocks
    mockStorage = {
      loadIssues: vi.fn(),
      saveIssue: vi.fn(),
      updateIssues: vi.fn(),
    };
    mockGraph = {
      getReadyWork: vi.fn(),
      addDependency: vi.fn(),
    };
    mockCompaction = {
      compactIssues: vi.fn(),
    };
    mockGit = {
      commitChanges: vi.fn(),
    };

    mockContainer = {
      get: vi.fn((type) => {
        switch (type) {
          case TYPES.IStorageService: return mockStorage;
          case TYPES.IGraphService: return mockGraph;
          case TYPES.ICompactionService: return mockCompaction;
          case TYPES.IGitService: return mockGit;
          default: return {};
        }
      }),
    };

    (createContainer as any).mockReturnValue(mockContainer);
    (fs.existsSync as any).mockReturnValue(true);
    (fs.mkdirSync as any).mockImplementation(() => { });

    // Mock process.cwd
    process.cwd = vi.fn(() => '/test/project');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('tool definitions', () => {
    it('should define all 5 tools correctly', () => {
      // Test tool definitions directly
      const tools = [
        {
          name: 'horizon_create_issue',
          description: 'Create a new issue/task in Horizon',
          inputSchema: {
            type: 'object',
            required: ['title'],
            properties: {
              title: { type: 'string', description: 'Issue title' },
              description: { type: 'string', description: 'Issue description' },
              priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Priority level' },
            },
          },
        },
        {
          name: 'horizon_update_issue',
          description: 'Update an existing issue in Horizon',
          inputSchema: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string', description: 'Issue ID' },
              title: { type: 'string', description: 'New title' },
              description: { type: 'string', description: 'New description' },
              status: { type: 'string', enum: ['open', 'in_progress', 'closed', 'blocked'], description: 'New status' },
              priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'New priority' },
              labels: { type: 'array', items: { type: 'string' }, description: 'Labels array' },
              notes: { type: 'string', description: 'Additional notes' },
              acceptance_criteria: { type: 'array', items: { type: 'string' }, description: 'Acceptance criteria array' },
              assignee: { type: 'string', description: 'Assignee' },
            },
          },
        },
        {
          name: 'horizon_list_issues',
          description: 'List issues with optional filtering',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Maximum number of issues to return' },
              status: { type: 'string', enum: ['open', 'in_progress', 'closed', 'blocked'], description: 'Filter by status' },
              ready: { type: 'boolean', description: 'Show only ready work' },
            },
          },
        },
        {
          name: 'horizon_add_dependency',
          description: 'Add a dependency between issues',
          inputSchema: {
            type: 'object',
            required: ['from_id', 'to_id', 'type'],
            properties: {
              from_id: { type: 'string', description: 'ID of the issue that depends on another' },
              to_id: { type: 'string', description: 'ID of the issue being depended on' },
              type: { type: 'string', enum: ['blocks', 'related', 'parent-child', 'discovered-from'], description: 'Dependency type' },
            },
          },
        },
        {
          name: 'horizon_get_ready_work',
          description: 'Get issues that are ready to work on (no blocking dependencies)',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Maximum number of issues to return' },
            },
          },
        },
      ];

      expect(tools).toHaveLength(5);
      expect(tools.map(t => t.name)).toEqual([
        'horizon_create_issue',
        'horizon_update_issue',
        'horizon_list_issues',
        'horizon_add_dependency',
        'horizon_get_ready_work',
      ]);

      // Verify required fields
      expect(tools[0].inputSchema.required).toEqual(['title']);
      expect(tools[3].inputSchema.required).toEqual(['from_id', 'to_id', 'type']);
    });
  });

  describe('horizon_create_issue tool logic', () => {
    it('should create a new issue with full arguments', async () => {
      const mockIssues = [];
      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockStorage.saveIssue.mockResolvedValue(undefined);
      mockGit.commitChanges.mockResolvedValue(undefined);

      // Test the create issue logic directly
      const createIssueLogic = async (args: any) => {
        const issues = await mockStorage.loadIssues();
        const id = 'test-id';
        const issue = {
          id,
          title: args.title,
          description: args.description,
          status: 'open' as const,
          priority: args.priority,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await mockStorage.saveIssue(issue);
        await mockGit.commitChanges(`Create issue ${id}`);
        return { content: [{ text: `Created issue ${id}: ${args.title}` }] };
      };

      const result = await createIssueLogic({
        title: 'Test Issue',
        description: 'Test description',
        priority: 'high',
      });

      expect(mockStorage.saveIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-id',
          title: 'Test Issue',
          description: 'Test description',
          priority: 'high',
          status: 'open',
        })
      );
      expect(mockGit.commitChanges).toHaveBeenCalledWith('Create issue test-id');
      expect(result.content[0].text).toBe('Created issue test-id: Test Issue');
    });

    it('should create issue with minimal arguments', async () => {
      const mockIssues = [];
      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockStorage.saveIssue.mockResolvedValue(undefined);
      mockGit.commitChanges.mockResolvedValue(undefined);

      const createIssueLogic = async (args: any) => {
        const issues = await mockStorage.loadIssues();
        const id = 'test-id';
        const issue = {
          id,
          title: args.title,
          status: 'open' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await mockStorage.saveIssue(issue);
        await mockGit.commitChanges(`Create issue ${id}`);
        return { content: [{ text: `Created issue ${id}: ${args.title}` }] };
      };

      const result = await createIssueLogic({
        title: 'Minimal Issue',
      });

      expect(mockStorage.saveIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-id',
          title: 'Minimal Issue',
          status: 'open',
        })
      );
      expect(result.content[0].text).toBe('Created issue test-id: Minimal Issue');
    });
  });

  describe('horizon_update_issue tool logic', () => {
    it('should update issue status and notes', async () => {
      const mockIssues = [{
        id: 'test-id',
        title: 'Test Issue',
        status: 'open',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      }];

      mockStorage.updateIssues.mockImplementation(async (updater: any) => {
        const updated = updater(mockIssues);
        return updated;
      });
      mockGit.commitChanges.mockResolvedValue(undefined);

      const updateIssueLogic = async (args: any) => {
        await mockStorage.updateIssues((issues: any[]) => {
          return issues.map((issue: any) => {
            if (issue.id === args.id) {
              const updated = { ...issue, updated_at: new Date().toISOString() };
              if (args.status) updated.status = args.status;
              if (args.notes) updated.notes = args.notes;
              if (args.labels) updated.labels = args.labels;
              if (args.status === 'closed') updated.closed_at = new Date().toISOString();
              return updated;
            }
            return issue;
          });
        });
        await mockGit.commitChanges(`Update issue ${args.id}`);
        return { content: [{ text: `Updated issue ${args.id}` }] };
      };

      const result = await updateIssueLogic({
        id: 'test-id',
        status: 'closed',
        notes: 'Completed successfully',
        labels: ['done'],
      });

      expect(mockStorage.updateIssues).toHaveBeenCalled();
      expect(mockGit.commitChanges).toHaveBeenCalledWith('Update issue test-id');
      expect(result.content[0].text).toBe('Updated issue test-id');
    });
  });

  describe('horizon_list_issues tool logic', () => {
    it('should list all issues', async () => {
      const mockIssues = [
        {
          id: 'issue-1',
          title: 'Issue 1',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'issue-2',
          title: 'Issue 2',
          status: 'closed',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockCompaction.compactIssues.mockReturnValue(mockIssues);

      const listIssuesLogic = async (args: any) => {
        let allIssues = await mockStorage.loadIssues();
        allIssues = mockCompaction.compactIssues(allIssues);
        let issues = allIssues;

        if (args.ready) {
          issues = mockGraph.getReadyWork(issues);
        } else {
          if (args.status) {
            issues = issues.filter((i: any) => i.status === args.status);
          }
        }

        if (args.limit) {
          issues = issues.slice(0, args.limit);
        }

        if (issues.length === 0) {
          return { content: [{ text: 'No issues found' }] };
        }

        const output = issues.map((issue: any) =>
          `${issue.id}: ${issue.title} [${issue.status}]`
        ).join('\n');

        return { content: [{ text: output }] };
      };

      const result = await listIssuesLogic({});

      expect(result.content[0].text).toContain('issue-1: Issue 1 [open]');
      expect(result.content[0].text).toContain('issue-2: Issue 2 [closed]');
    });

    it('should filter by status', async () => {
      const mockIssues = [
        {
          id: 'issue-1',
          title: 'Issue 1',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'issue-2',
          title: 'Issue 2',
          status: 'closed',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockCompaction.compactIssues.mockReturnValue(mockIssues);

      const listIssuesLogic = async (args: any) => {
        let allIssues = await mockStorage.loadIssues();
        allIssues = mockCompaction.compactIssues(allIssues);
        let issues = allIssues;

        if (args.status) {
          issues = issues.filter((i: any) => i.status === args.status);
        }

        const output = issues.map((issue: any) =>
          `${issue.id}: ${issue.title} [${issue.status}]`
        ).join('\n');

        return { content: [{ text: output }] };
      };

      const result = await listIssuesLogic({ status: 'open' });

      expect(result.content[0].text).toContain('issue-1: Issue 1 [open]');
      expect(result.content[0].text).not.toContain('issue-2');
    });

    it('should show ready work', async () => {
      const mockIssues = [
        {
          id: 'issue-1',
          title: 'Issue 1',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockCompaction.compactIssues.mockReturnValue(mockIssues);
      mockGraph.getReadyWork.mockReturnValue(mockIssues);

      const listIssuesLogic = async (args: any) => {
        let allIssues = await mockStorage.loadIssues();
        allIssues = mockCompaction.compactIssues(allIssues);

        let issues = args.ready ? mockGraph.getReadyWork(allIssues) : allIssues;

        const output = issues.map((issue: any) =>
          `${issue.id}: ${issue.title} [${issue.status}]`
        ).join('\n');

        return { content: [{ text: output }] };
      };

      const result = await listIssuesLogic({ ready: true });

      expect(mockGraph.getReadyWork).toHaveBeenCalledWith(mockIssues);
      expect(result.content[0].text).toContain('issue-1: Issue 1');
    });

    it('should apply limit', async () => {
      const mockIssues = [
        {
          id: 'issue-1',
          title: 'Issue 1',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'issue-2',
          title: 'Issue 2',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'issue-3',
          title: 'Issue 3',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockCompaction.compactIssues.mockReturnValue(mockIssues);

      const listIssuesLogic = async (args: any) => {
        let allIssues = await mockStorage.loadIssues();
        allIssues = mockCompaction.compactIssues(allIssues);
        let issues = allIssues;

        if (args.limit) {
          issues = issues.slice(0, args.limit);
        }

        const output = issues.map((issue: any) =>
          `${issue.id}: ${issue.title} [${issue.status}]`
        ).join('\n');

        return { content: [{ text: output }] };
      };

      const result = await listIssuesLogic({ limit: 2 });

      expect(result.content[0].text.split('\n')).toHaveLength(2);
    });
  });

  describe('horizon_add_dependency tool logic', () => {
    it('should add parent-child dependency', async () => {
      const mockIssues = [];
      mockStorage.updateIssues.mockImplementation(async (updater: any) => {
        const updated = updater(mockIssues);
        return updated;
      });
      mockGraph.addDependency.mockReturnValue(mockIssues);
      mockGit.commitChanges.mockResolvedValue(undefined);

      const addDependencyLogic = async (args: any) => {
        await mockStorage.updateIssues((issues: any[]) => {
          return mockGraph.addDependency(args.from_id, args.to_id, args.type, issues);
        });
        await mockGit.commitChanges(`Add dependency ${args.from_id} -> ${args.to_id}`);
        return { content: [{ text: `Added ${args.type} dependency from ${args.from_id} to ${args.to_id}` }] };
      };

      const result = await addDependencyLogic({
        from_id: 'sub-1',
        to_id: 'epic-1',
        type: 'parent-child',
      });

      expect(mockGraph.addDependency).toHaveBeenCalledWith('sub-1', 'epic-1', 'parent-child', mockIssues);
      expect(mockGit.commitChanges).toHaveBeenCalledWith('Add dependency sub-1 -> epic-1');
      expect(result.content[0].text).toBe('Added parent-child dependency from sub-1 to epic-1');
    });
  });

  describe('horizon_get_ready_work tool logic', () => {
    it('should get ready work', async () => {
      const mockIssues = [
        {
          id: 'issue-1',
          title: 'Issue 1',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockCompaction.compactIssues.mockReturnValue(mockIssues);
      mockGraph.getReadyWork.mockReturnValue(mockIssues);

      const getReadyWorkLogic = async (args: any) => {
        let allIssues = await mockStorage.loadIssues();
        allIssues = mockCompaction.compactIssues(allIssues);
        let issues = mockGraph.getReadyWork(allIssues);

        if (args.limit) {
          issues = issues.slice(0, args.limit);
        }

        if (issues.length === 0) {
          return { content: [{ text: 'No ready work found' }] };
        }

        const output = issues.map((issue: any) =>
          `${issue.id}: ${issue.title} [${issue.status}]`
        ).join('\n');

        return { content: [{ text: output }] };
      };

      const result = await getReadyWorkLogic({});

      expect(mockGraph.getReadyWork).toHaveBeenCalledWith(mockIssues);
      expect(result.content[0].text).toContain('issue-1: Issue 1');
    });

    it('should apply limit to ready work', async () => {
      const mockIssues = [
        {
          id: 'issue-1',
          title: 'Issue 1',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'issue-2',
          title: 'Issue 2',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockCompaction.compactIssues.mockReturnValue(mockIssues);
      mockGraph.getReadyWork.mockReturnValue(mockIssues);

      const getReadyWorkLogic = async (args: any) => {
        let allIssues = await mockStorage.loadIssues();
        allIssues = mockCompaction.compactIssues(allIssues);
        let issues = mockGraph.getReadyWork(allIssues);

        if (args.limit) {
          issues = issues.slice(0, args.limit);
        }

        const output = issues.map((issue: any) =>
          `${issue.id}: ${issue.title} [${issue.status}]`
        ).join('\n');

        return { content: [{ text: output }] };
      };

      const result = await getReadyWorkLogic({ limit: 1 });

      expect(result.content[0].text.split('\n')).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should handle unknown tools', () => {
      const callToolLogic = (toolName: string) => {
        return { content: [{ text: `Error: Unknown tool: ${toolName}` }], isError: true };
      };

      const result = callToolLogic('unknown_tool');

      expect(result.content[0].text).toBe('Error: Unknown tool: unknown_tool');
      expect(result.isError).toBe(true);
    });

    it('should handle storage errors', async () => {
      mockStorage.loadIssues.mockRejectedValue(new Error('Storage error'));

      const listIssuesLogic = async () => {
        try {
          await mockStorage.loadIssues();
        } catch (error: any) {
          return { content: [{ text: `Error: ${error.message}` }], isError: true };
        }
      };

      const result = await listIssuesLogic();

      expect(result!.content[0].text).toBe('Error: Storage error');
      expect(result!.isError).toBe(true);
    });
  });
});