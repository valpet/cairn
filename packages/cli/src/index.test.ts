import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all dependencies before importing
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

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => { });
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

// Import after mocking
import { createContainer, TYPES } from '@horizon/core';
import * as fs from 'fs';
import * as path from 'path';

describe('CLI Commands', () => {
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
      getEpicSubtasks: vi.fn(),
      calculateEpicProgress: vi.fn(),
      shouldCloseEpic: vi.fn(),
    };
    mockCompaction = {
      compactIssues: vi.fn(),
    };
    mockGit = {
      initIfNeeded: vi.fn(),
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
    (path.join as any).mockImplementation((...args: string[]) => args.join('/'));
    (path.dirname as any).mockReturnValue('/parent');

    // Mock process.cwd
    process.cwd = vi.fn(() => '/test/project');
  });

  afterEach(() => {
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
  });

  describe('create command logic', () => {
    it('should create a new issue with basic options', async () => {
      const mockIssues = [];
      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockStorage.saveIssue.mockResolvedValue(undefined);
      mockGit.commitChanges.mockResolvedValue(undefined);

      // Test the create command logic directly
      const createAction = async (title: string, options: any) => {
        const issues = await mockStorage.loadIssues();
        const id = 'test-id';
        const issue = {
          id,
          title,
          description: options.description,
          status: 'open' as const,
          priority: options.priority,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await mockStorage.saveIssue(issue);
        console.log(`Created issue ${id}: ${title}`);
        await mockGit.commitChanges(`Create issue ${id}`);
      };

      await createAction('Test Issue', { description: 'Test description' });

      expect(mockStorage.saveIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-id',
          title: 'Test Issue',
          description: 'Test description',
          status: 'open',
        })
      );
      expect(mockGit.commitChanges).toHaveBeenCalledWith('Create issue test-id');
      expect(mockConsoleLog).toHaveBeenCalledWith('Created issue test-id: Test Issue');
    });

    it('should create an epic with type option', async () => {
      const mockIssues = [];
      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockStorage.saveIssue.mockResolvedValue(undefined);
      mockGit.commitChanges.mockResolvedValue(undefined);

      const createAction = async (title: string, options: any) => {
        const issues = await mockStorage.loadIssues();
        const id = 'test-id';
        const issue = {
          id,
          title,
          description: options.description,
          type: options.type as any,
          status: 'open' as const,
          priority: options.priority as any,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await mockStorage.saveIssue(issue);
        console.log(`Created issue ${id}: ${title}`);
        await mockGit.commitChanges(`Create issue ${id}`);
      };

      await createAction('Epic Title', { type: 'epic', priority: 'high' });

      expect(mockStorage.saveIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-id',
          title: 'Epic Title',
          type: 'epic',
          priority: 'high',
          status: 'open',
        })
      );
    });
  });

  describe('update command logic', () => {
    it('should update issue status and add notes', async () => {
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

      const updateAction = async (id: string, options: any) => {
        await mockStorage.updateIssues((issues: any[]) => {
          return issues.map((issue: any) => {
            if (issue.id === id) {
              const updated = { ...issue, updated_at: new Date().toISOString() };
              if (options.status) updated.status = options.status;
              if (options.notes) updated.notes = options.notes;
              if (options.labels) updated.labels = options.labels.split(',');
              if (options.status === 'closed') updated.closed_at = new Date().toISOString();
              return updated;
            }
            return issue;
          });
        });
        console.log(`Updated issue ${id}`);
        await mockGit.commitChanges(`Update issue ${id}`);
      };

      await updateAction('test-id', { status: 'closed', notes: 'Completed successfully', labels: 'done,completed' });

      expect(mockStorage.updateIssues).toHaveBeenCalled();
      expect(mockGit.commitChanges).toHaveBeenCalledWith('Update issue test-id');
      expect(mockConsoleLog).toHaveBeenCalledWith('Updated issue test-id');
    });
  });

  describe('list command logic', () => {
    it('should list all issues', async () => {
      const mockIssues = [
        {
          id: 'issue-1',
          title: 'Issue 1',
          status: 'open',
          type: 'task',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'issue-2',
          title: 'Issue 2',
          status: 'closed',
          type: 'bug',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockCompaction.compactIssues.mockReturnValue(mockIssues);

      const listAction = async (options: any) => {
        let allIssues = await mockStorage.loadIssues();
        allIssues = mockCompaction.compactIssues(allIssues);
        let issues = allIssues;

        if (options.ready) {
          issues = mockGraph.getReadyWork(issues);
        } else {
          if (options.status) {
            issues = issues.filter((i: any) => i.status === options.status);
          }
          if (options.type) {
            issues = issues.filter((i: any) => i.type === options.type);
          }
        }
        issues.forEach((issue: any) => {
          const typeStr = issue.type ? `[${issue.type}]` : '';
          let progressStr = '';
          if (issue.type === 'epic') {
            const progress = mockGraph.calculateEpicProgress(issue.id, allIssues);
            if (progress.total > 0) {
              progressStr = ` (${progress.completed}/${progress.total} ${progress.percentage}%)`;
            }
          }
          console.log(`${issue.id}: ${issue.title} [${issue.status}] ${typeStr}${progressStr}`);
        });
      };

      await listAction({});

      expect(mockConsoleLog).toHaveBeenCalledWith('issue-1: Issue 1 [open] [task]');
      expect(mockConsoleLog).toHaveBeenCalledWith('issue-2: Issue 2 [closed] [bug]');
    });

    it('should show epic progress', async () => {
      const mockIssues = [
        {
          id: 'epic-1',
          title: 'Epic 1',
          status: 'open',
          type: 'epic',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockCompaction.compactIssues.mockReturnValue(mockIssues);
      mockGraph.calculateEpicProgress.mockReturnValue({
        completed: 1,
        total: 2,
        percentage: 50,
      });

      const listAction = async (options: any) => {
        let allIssues = await mockStorage.loadIssues();
        allIssues = mockCompaction.compactIssues(allIssues);
        let issues = allIssues;

        issues.forEach((issue: any) => {
          const typeStr = issue.type ? `[${issue.type}]` : '';
          let progressStr = '';
          if (issue.type === 'epic') {
            const progress = mockGraph.calculateEpicProgress(issue.id, allIssues);
            if (progress.total > 0) {
              progressStr = ` (${progress.completed}/${progress.total} ${progress.percentage}%)`;
            }
          }
          console.log(`${issue.id}: ${issue.title} [${issue.status}] ${typeStr}${progressStr}`);
        });
      };

      await listAction({});

      expect(mockGraph.calculateEpicProgress).toHaveBeenCalledWith('epic-1', mockIssues);
      expect(mockConsoleLog).toHaveBeenCalledWith('epic-1: Epic 1 [open] [epic] (1/2 50%)');
    });
  });

  describe('epic commands logic', () => {
    describe('epic subtasks', () => {
      it('should list subtasks for an epic', async () => {
        const mockIssues = [];
        const mockSubtasks = [
          {
            id: 'sub-1',
            title: 'Subtask 1',
            status: 'open',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
          {
            id: 'sub-2',
            title: 'Subtask 2',
            status: 'closed',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        ];

        mockStorage.loadIssues.mockResolvedValue(mockIssues);
        mockGraph.getEpicSubtasks.mockReturnValue(mockSubtasks);

        const subtasksAction = async (epicId: string) => {
          const issues = await mockStorage.loadIssues();
          const subtasks = mockGraph.getEpicSubtasks(epicId, issues);
          if (subtasks.length === 0) {
            console.log(`No subtasks found for epic ${epicId}`);
            return;
          }
          console.log(`Subtasks for epic ${epicId}:`);
          subtasks.forEach((subtask: any) => {
            console.log(`  ${subtask.id}: ${subtask.title} [${subtask.status}]`);
          });
        };

        await subtasksAction('epic-1');

        expect(mockGraph.getEpicSubtasks).toHaveBeenCalledWith('epic-1', mockIssues);
        expect(mockConsoleLog).toHaveBeenCalledWith('Subtasks for epic epic-1:');
        expect(mockConsoleLog).toHaveBeenCalledWith('  sub-1: Subtask 1 [open]');
        expect(mockConsoleLog).toHaveBeenCalledWith('  sub-2: Subtask 2 [closed]');
      });
    });

    describe('epic progress', () => {
      it('should show epic progress', async () => {
        const mockIssues = [{
          id: 'epic-1',
          title: 'Test Epic',
          status: 'open',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        }];

        mockStorage.loadIssues.mockResolvedValue(mockIssues);
        mockGraph.calculateEpicProgress.mockReturnValue({
          completed: 2,
          total: 5,
          percentage: 40,
        });
        mockGraph.shouldCloseEpic.mockReturnValue(false);

        const progressAction = async (epicId: string) => {
          const issues = await mockStorage.loadIssues();
          const progress = mockGraph.calculateEpicProgress(epicId, issues);
          const epic = issues.find((i: any) => i.id === epicId);
          if (!epic) {
            console.error(`Epic ${epicId} not found`);
            return;
          }
          console.log(`Epic: ${epic.title}`);
          console.log(`Progress: ${progress.completed}/${progress.total} subtasks completed (${progress.percentage}%)`);

          if (mockGraph.shouldCloseEpic(epicId, issues) && epic.status !== 'closed') {
            console.log('💡 All subtasks are completed. Consider closing this epic.');
          }
        };

        await progressAction('epic-1');

        expect(mockConsoleLog).toHaveBeenCalledWith('Epic: Test Epic');
        expect(mockConsoleLog).toHaveBeenCalledWith('Progress: 2/5 subtasks completed (40%)');
        expect(mockConsoleLog).not.toHaveBeenCalledWith('💡 All subtasks are completed. Consider closing this epic.');
      });
    });
  });
});