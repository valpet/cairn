import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock commander before importing CLI
const commanderCommands = new Map();

vi.mock('commander', () => {
  const createCommandMock = (name = '') => {
    const cmd = {
      name: vi.fn().mockImplementation((n) => {
        cmd._name = n;
        return cmd;
      }),
      description: vi.fn().mockReturnThis(),
      version: vi.fn().mockReturnThis(),
      command: vi.fn().mockImplementation((cmdName) => {
        const subCmd = createCommandMock(cmdName);
        commanderCommands.set(cmdName, subCmd);
        return subCmd;
      }),
      option: vi.fn().mockReturnThis(),
      action: vi.fn().mockImplementation((fn) => {
        cmd._action = fn;
        return cmd;
      }),
      parse: vi.fn(),
      _name: name,
      _action: null,
    };
    if (name) commanderCommands.set(name, cmd);
    return cmd;
  };

  const Command = vi.fn(() => {
    const rootCmd = createCommandMock();
    commanderCommands.set('root', rootCmd);
    return rootCmd;
  });

  return { Command };
});

// Mock all dependencies before importing
vi.mock('../../core/dist/index.js', () => ({
  createContainer: vi.fn(),
  TYPES: {
    IStorageService: Symbol('IStorageService'),
    IGraphService: Symbol('IGraphService'),
    ICompactionService: Symbol('ICompactionService'),
    IGitService: Symbol('IGitService'),
  },
  findCairnDir: vi.fn(),
  generateId: vi.fn(),
}));
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-id-123'),
}));
vi.mock('fs');
vi.mock('path');

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => { });
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

// Mock process.exit
const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

// Import after mocking
import { createContainer, TYPES, findCairnDir, generateId } from '../../core/dist/index.js';
import * as fs from 'fs';
import * as path from 'path';

// Import CLI dynamically to avoid process.exit during static import
const importCLI = async () => {
  // Ensure a fresh CLI module instance for each call while preserving mocks
  await vi.resetModules();
  await import('./index');
};

describe('CLI Commands', () => {
  let mockStorage: any;
  let mockGraph: any;
  let mockCompaction: any;
  let mockGit: any;
  let mockContainer: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    commanderCommands.clear();

    // Setup container mocks
    mockStorage = {
      loadIssues: vi.fn(),
      saveIssue: vi.fn(),
      updateIssues: vi.fn().mockImplementation(async (updater) => {
        const issues = await mockStorage.loadIssues();
        const updatedIssues = updater(issues);
        // In real implementation, this would save the issues
      }),
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

    mockContainer = {
      get: vi.fn((type) => {
        switch (type) {
          case TYPES.IStorageService: return mockStorage;
          case TYPES.IGraphService: return mockGraph;
          case TYPES.ICompactionService: return mockCompaction;
          default: return {};
        }
      }),
    };

    (createContainer as any).mockReturnValue(mockContainer);
    (findCairnDir as any).mockReturnValue({ cairnDir: '/test/project/.cairn', repoRoot: '/test/project' });
    (generateId as any).mockReturnValue('s-test-id-123');
    (fs.existsSync as any).mockImplementation((path: string) => {
      // Mock .cairn directory as existing
      if (path.includes('.cairn')) return true;
      return false;
    });
    (path.join as any).mockImplementation((...args: string[]) => args.join('/'));
    (path.dirname as any).mockReturnValue('/parent');

    // Mock process.cwd
    process.cwd = vi.fn(() => '/test/project');
  });

  afterEach(() => {
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
  });

  describe('CLI initialization', () => {
    it('should import CLI module without errors', async () => {
      await importCLI();
      // CLI module imports successfully
      expect(createContainer).not.toHaveBeenCalled();
    });
  });

  describe('create command', () => {
    it('should create a new issue with minimal options', async () => {
      mockStorage.loadIssues.mockResolvedValue([]);

      await importCLI();

      // Get the create command action
      const createCmd = commanderCommands.get('create <title>');
      const createAction = createCmd?._action;

      // Call the create action
      await createAction('Test Issue', {});

      expect(mockStorage.loadIssues).toHaveBeenCalled();
      expect(mockStorage.saveIssue).toHaveBeenCalledWith({
        id: 's-test-id-123',
        title: 'Test Issue',
        description: undefined,
        type: undefined,
        status: 'open',
        priority: undefined,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it('should create a new issue with all options', async () => {
      mockStorage.loadIssues.mockResolvedValue([]);

      await importCLI();

      const createCmd = commanderCommands.get('create <title>');
      const createAction = createCmd?._action;

      await createAction('Feature Issue', {
        description: 'A test description',
        type: 'feature',
        priority: 'high'
      });

      expect(mockStorage.saveIssue).toHaveBeenCalledWith({
        id: 's-test-id-123',
        title: 'Feature Issue',
        description: 'A test description',
        type: 'feature',
        status: 'open',
        priority: 'high',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it('should create a new issue with status parameter', async () => {
      mockStorage.loadIssues.mockResolvedValue([]);

      await importCLI();

      const createCmd = commanderCommands.get('create <title>');
      const createAction = createCmd?._action;

      await createAction('In Progress Task', {
        status: 'in_progress'
      });

      expect(mockStorage.saveIssue).toHaveBeenCalledWith({
        id: 's-test-id-123',
        title: 'In Progress Task',
        description: undefined,
        type: undefined,
        status: 'in_progress',
        priority: undefined,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it('should create a new issue with parent parameter and add dependency', async () => {
      const mockIssues = [{ id: 'parent-123', title: 'Parent Epic' }];
      mockStorage.loadIssues.mockResolvedValue(mockIssues);

      await importCLI();

      const createCmd = commanderCommands.get('create <title>');
      const createAction = createCmd?._action;

      await createAction('Child Task', {
        parent: 'parent-123'
      });

      expect(mockStorage.saveIssue).toHaveBeenCalledWith({
        id: 's-test-id-123',
        title: 'Child Task',
        description: undefined,
        type: undefined,
        status: 'open',
        priority: undefined,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });

      expect(mockStorage.updateIssues).toHaveBeenCalled();
      expect(mockGraph.addDependency).toHaveBeenCalledWith('s-test-id-123', 'parent-123', 'parent-child', mockIssues);
    });

    it('should create a new issue with all new parameters combined', async () => {
      const mockIssues = [{ id: 'epic-456', title: 'Test Epic' }];
      mockStorage.loadIssues.mockResolvedValue(mockIssues);

      await importCLI();

      const createCmd = commanderCommands.get('create <title>');
      const createAction = createCmd?._action;

      await createAction('Complete Feature Task', {
        description: 'Full featured task',
        type: 'feature',
        priority: 'urgent',
        status: 'in_progress',
        parent: 'epic-456'
      });

      expect(mockStorage.saveIssue).toHaveBeenCalledWith({
        id: 's-test-id-123',
        title: 'Complete Feature Task',
        description: 'Full featured task',
        type: 'feature',
        status: 'in_progress',
        priority: 'urgent',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });

      expect(mockStorage.updateIssues).toHaveBeenCalled();
      expect(mockGraph.addDependency).toHaveBeenCalledWith('s-test-id-123', 'epic-456', 'parent-child', mockIssues);
    });
  });

  describe('update command', () => {
    it('should update issue status', async () => {
      const mockIssues = [{ id: 'issue-123', title: 'Test Issue', status: 'open' }];
      mockStorage.loadIssues.mockReturnValue(mockIssues);

      await importCLI();

      const updateCmd = commanderCommands.get('update <id>');
      const updateAction = updateCmd?._action;

      await updateAction('issue-123', { status: 'in_progress' });

      expect(mockStorage.updateIssues).toHaveBeenCalled();
    });

    it('should update multiple fields', async () => {
      const mockIssues = [{ id: 'issue-456', title: 'Test Issue', status: 'open' }];
      mockStorage.loadIssues.mockReturnValue(mockIssues);

      await importCLI();

      const updateCmd = commanderCommands.get('update <id>');
      const updateAction = updateCmd?._action;

      await updateAction('issue-456', {
        status: 'closed',
        title: 'New Title',
        labels: 'bug,urgent'
      });

      expect(mockStorage.updateIssues).toHaveBeenCalled();
    });
  });

  describe('list command', () => {
    it('should list all issues', async () => {
      const mockIssues = [
        { id: '1', title: 'Issue 1', status: 'open', type: 'task' },
        { id: '2', title: 'Issue 2', status: 'closed', type: 'bug' }
      ];
      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockCompaction.compactIssues.mockReturnValue(mockIssues);

      await importCLI();

      const listCmd = commanderCommands.get('list');
      const listAction = listCmd?._action;

      await listAction({});

      expect(mockStorage.loadIssues).toHaveBeenCalled();
      expect(mockCompaction.compactIssues).toHaveBeenCalledWith(mockIssues);
      expect(mockConsoleLog).toHaveBeenCalledWith('1: Issue 1 [open] [task]');
      expect(mockConsoleLog).toHaveBeenCalledWith('2: Issue 2 [closed] [bug]');
    });

    it('should filter by status', async () => {
      const mockIssues = [
        { id: '1', title: 'Issue 1', status: 'open', type: 'task' },
        { id: '2', title: 'Issue 2', status: 'closed', type: 'bug' }
      ];
      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockCompaction.compactIssues.mockReturnValue(mockIssues);

      await importCLI();

      const listCmd = commanderCommands.get('list');
      const listAction = listCmd?._action;

      await listAction({ status: 'open' });

      expect(mockConsoleLog).toHaveBeenCalledWith('1: Issue 1 [open] [task]');
      expect(mockConsoleLog).not.toHaveBeenCalledWith('2: Issue 2 [closed] [bug]');
    });

    it('should show ready work', async () => {
      const mockIssues = [
        { id: '1', title: 'Ready Issue', status: 'open', type: 'task' }
      ];
      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockCompaction.compactIssues.mockReturnValue(mockIssues);
      mockGraph.getReadyWork.mockReturnValue([mockIssues[0]]);

      await importCLI();

      const listCmd = commanderCommands.get('list');
      const listAction = listCmd?._action;

      await listAction({ ready: true });

      expect(mockGraph.getReadyWork).toHaveBeenCalledWith(mockIssues);
      expect(mockConsoleLog).toHaveBeenCalledWith('1: Ready Issue [open] [task]');
    });
  });

  describe('dep add command', () => {
    it('should add dependency', async () => {
      mockStorage.loadIssues.mockResolvedValue([]);

      await importCLI();

      const addCmd = commanderCommands.get('add <from> <to>');
      const addAction = addCmd?._action;

      await addAction('task-1', 'task-2', { type: 'blocks' });

      expect(mockStorage.updateIssues).toHaveBeenCalled();
      expect(mockGraph.addDependency).toHaveBeenCalledWith('task-1', 'task-2', 'blocks', expect.any(Array));
    });
  });

  describe('epic commands', () => {
    it('should list epic subtasks', async () => {
      const mockIssues = [
        { id: 'epic-1', title: 'Epic', type: 'epic' },
        { id: 'sub-1', title: 'Subtask 1', status: 'open' },
        { id: 'sub-2', title: 'Subtask 2', status: 'closed' }
      ];
      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockGraph.getEpicSubtasks.mockReturnValue([mockIssues[1], mockIssues[2]]);

      await importCLI();

      const subtasksCmd = commanderCommands.get('subtasks <epicId>');
      const subtasksAction = subtasksCmd?._action;

      await subtasksAction('epic-1');

      expect(mockStorage.loadIssues).toHaveBeenCalled();
      expect(mockGraph.getEpicSubtasks).toHaveBeenCalledWith('epic-1', mockIssues);
      expect(mockConsoleLog).toHaveBeenCalledWith('Subtasks for epic epic-1:');
      expect(mockConsoleLog).toHaveBeenCalledWith('  sub-1: Subtask 1 [open]');
      expect(mockConsoleLog).toHaveBeenCalledWith('  sub-2: Subtask 2 [closed]');
    });

    it('should show epic progress', async () => {
      const mockIssues = [{ id: 'epic-1', title: 'Test Epic', type: 'epic', status: 'open' }];
      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockGraph.calculateEpicProgress.mockReturnValue({ completed: 2, total: 5, percentage: 40 });
      mockGraph.shouldCloseEpic.mockReturnValue(false);

      await importCLI();

      const progressCmd = commanderCommands.get('progress <epicId>');
      const progressAction = progressCmd?._action;

      await progressAction('epic-1');

      expect(mockGraph.calculateEpicProgress).toHaveBeenCalledWith('epic-1', mockIssues);
      expect(mockConsoleLog).toHaveBeenCalledWith('Epic: Test Epic');
      expect(mockConsoleLog).toHaveBeenCalledWith('Progress: 2/5 subtasks completed (40%)');
    });

    it('should create epic subtask', async () => {
      const mockIssues = [{ id: 'epic-1', title: 'Test Epic', type: 'epic' }];
      mockStorage.loadIssues.mockResolvedValue(mockIssues);

      await importCLI();

      const addSubtaskCmd = commanderCommands.get('add-subtask <epicId> <title>');
      const addSubtaskAction = addSubtaskCmd?._action;

      await addSubtaskAction('epic-1', 'New Subtask', { description: 'Test desc', priority: 'medium' });

      expect(mockStorage.saveIssue).toHaveBeenCalledWith({
        id: 's-test-id-123',
        title: 'New Subtask',
        description: 'Test desc',
        type: 'task',
        status: 'open',
        priority: 'medium',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
      expect(mockStorage.updateIssues).toHaveBeenCalled();
      expect(mockGraph.addDependency).toHaveBeenCalledWith('s-test-id-123', 'epic-1', 'parent-child', mockIssues);
    });
  });

  describe('review command', () => {
    it('should perform self-review on a task', async () => {
      const mockIssues = [{ id: 'task-123', title: 'Test Task' }];
      mockStorage.loadIssues.mockResolvedValue(mockIssues);

      await importCLI();

      const reviewCmd = commanderCommands.get('review <id>');
      const reviewAction = reviewCmd?._action;

      await reviewAction('task-123');

      expect(mockStorage.loadIssues).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('Reviewing issue task-123: Test Task');
      expect(mockConsoleLog).toHaveBeenCalledWith('Checklist:');
      expect(mockConsoleLog).toHaveBeenCalledWith('- Code quality: Check for best practices, readability, performance');
    });
  });
});
