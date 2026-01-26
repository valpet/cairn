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

  const Command = class {
    constructor() {
      const rootCmd = createCommandMock();
      commanderCommands.set('root', rootCmd);
      return rootCmd;
    }
  };

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
import { createContainer, TYPES, findCairnDir, generateId, IStorageService, IGraphService, ICompactionService } from '../../core/dist/index.js';
import { Container } from 'inversify';
import * as fs from 'fs';
import * as path from 'path';

// Import CLI dynamically to avoid process.exit during static import
const importCLI = async () => {
  // Ensure a fresh CLI module instance for each call while preserving mocks
  await vi.resetModules();
  await import('./index');
};

// Import after mocking
import { createContainer, TYPES, findCairnDir, generateId, IStorageService, IGraphService, ICompactionService } from '../../core/dist/index.js';
import { Container } from 'inversify';
import * as fs from 'fs';
import * as path from 'path';

// Define a simple interface for the git service (not implemented in core yet)
interface IGitService {
  // Placeholder interface - add methods as needed
}

describe('CLI Commands', () => {
  let mockStorage: IStorageService;
  let mockGraph: IGraphService;
  let mockCompaction: ICompactionService;
  let mockGit: IGitService;
  let mockContainer: Container;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    commanderCommands.clear();

    // Setup container mocks
    mockStorage = {
      loadTasks: vi.fn(),
      saveTask: vi.fn(),
      updateTasks: vi.fn().mockImplementation(async (updater) => {
        const issues = await mockStorage.loadTasks();
        const updatedTasks = updater(issues);
        // In real implementation, this would save the issues
      }),
    };
    mockGraph = {
      getReadyWork: vi.fn(),
      addDependency: vi.fn(),
      getEpicSubtasks: vi.fn(),
      calculateEpicProgress: vi.fn(),
      shouldCloseEpic: vi.fn(),
      canCloseTask: vi.fn(),
    };
    mockCompaction = {
      compactTasks: vi.fn(),
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
    (fs.readFileSync as any).mockImplementation((path: string, encoding?: string) => {
      if (path.includes('config.json')) {
        return JSON.stringify({ activeFile: 'default' });
      }
      return '';
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
      mockStorage.loadTasks.mockResolvedValue([]);

      await importCLI();

      // Get the create command action
      const createCmd = commanderCommands.get('create <title>');
      const createAction = createCmd?._action;

      // Call the create action
      await createAction('Test Task', {});

      expect(mockStorage.loadTasks).toHaveBeenCalled();
      expect(mockStorage.saveTask).toHaveBeenCalledWith({
        id: 's-test-id-123',
        title: 'Test Task',
        description: undefined,
        type: undefined,
        status: 'open',
        priority: undefined,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it('should create a new issue with all options', async () => {
      mockStorage.loadTasks.mockResolvedValue([]);

      await importCLI();

      const createCmd = commanderCommands.get('create <title>');
      const createAction = createCmd?._action;

      await createAction('Feature Task', {
        description: 'A test description',
        type: 'feature',
        priority: 'high'
      });

      expect(mockStorage.saveTask).toHaveBeenCalledWith({
        id: 's-test-id-123',
        title: 'Feature Task',
        description: 'A test description',
        type: 'feature',
        status: 'open',
        priority: 'high',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it('should create a new issue with status parameter', async () => {
      mockStorage.loadTasks.mockResolvedValue([]);

      await importCLI();

      const createCmd = commanderCommands.get('create <title>');
      const createAction = createCmd?._action;

      await createAction('In Progress Task', {
        status: 'in_progress'
      });

      expect(mockStorage.saveTask).toHaveBeenCalledWith({
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
      const mockTasks = [{ id: 'parent-123', title: 'Parent Epic' }];
      mockStorage.loadTasks.mockResolvedValue(mockTasks);

      await importCLI();

      const createCmd = commanderCommands.get('create <title>');
      const createAction = createCmd?._action;

      await createAction('Child Task', {
        parent: 'parent-123'
      });

      expect(mockStorage.saveTask).toHaveBeenCalledWith({
        id: 's-test-id-123',
        title: 'Child Task',
        description: undefined,
        type: undefined,
        status: 'open',
        priority: undefined,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });

      expect(mockStorage.updateTasks).toHaveBeenCalled();
      expect(mockGraph.addDependency).toHaveBeenCalledWith('s-test-id-123', 'parent-123', 'parent-child', mockTasks);
    });

    it('should create a new issue with all new parameters combined', async () => {
      const mockTasks = [{ id: 'epic-456', title: 'Test Epic' }];
      mockStorage.loadTasks.mockResolvedValue(mockTasks);

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

      expect(mockStorage.saveTask).toHaveBeenCalledWith({
        id: 's-test-id-123',
        title: 'Complete Feature Task',
        description: 'Full featured task',
        type: 'feature',
        status: 'in_progress',
        priority: 'urgent',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });

      expect(mockStorage.updateTasks).toHaveBeenCalled();
      expect(mockGraph.addDependency).toHaveBeenCalledWith('s-test-id-123', 'epic-456', 'parent-child', mockTasks);
    });
  });

  describe('update command', () => {
    it('should update issue status', async () => {
      const mockTasks = [{ id: 'issue-123', title: 'Test Task', status: 'open' }];
      mockStorage.loadTasks.mockReturnValue(mockTasks);

      await importCLI();

      const updateCmd = commanderCommands.get('update <id>');
      const updateAction = updateCmd?._action;

      await updateAction('issue-123', { status: 'in_progress' });

      expect(mockStorage.updateTasks).toHaveBeenCalled();
    });

    it('should update multiple fields', async () => {
      const mockTasks = [{ id: 'issue-456', title: 'Test Task', status: 'open' }];
      mockStorage.loadTasks.mockReturnValue(mockTasks);
      mockGraph.canCloseTask.mockReturnValue({ canClose: true });

      await importCLI();

      const updateCmd = commanderCommands.get('update <id>');
      const updateAction = updateCmd?._action;

      await updateAction('issue-456', {
        status: 'closed',
        title: 'New Title',
        labels: 'bug,urgent'
      });

      expect(mockGraph.canCloseTask).toHaveBeenCalledWith('issue-456', mockTasks);
      expect(mockStorage.updateTasks).toHaveBeenCalled();
    });

    it('should prevent closing issue with open subtasks', async () => {
      const mockTasks = [
        { id: 'parent-123', title: 'Parent Task', status: 'open' },
        { id: 'sub-1', title: 'Open Subtask', status: 'open' }
      ];
      mockStorage.loadTasks.mockReturnValue(mockTasks);
      mockGraph.canCloseTask.mockReturnValue({
        canClose: false,
        openSubtasks: [{ id: 'sub-1', title: 'Open Subtask', status: 'open' }],
        reason: 'has 1 open subtask(s)'
      });

      await importCLI();

      const updateCmd = commanderCommands.get('update <id>');
      const updateAction = updateCmd?._action;

      await expect(async () => {
        await updateAction('parent-123', { status: 'closed' });
      }).rejects.toThrow('process.exit called');

      expect(mockGraph.canCloseTask).toHaveBeenCalledWith('parent-123', mockTasks);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Cannot close task parent-123 because it has 1 open subtask(s)')
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockStorage.updateTasks).not.toHaveBeenCalled();
    });

    it('should prevent closing issue with incomplete acceptance criteria', async () => {
      const mockTasks = [
        {
          id: 'task-789',
          title: 'Task with AC',
          status: 'open',
          acceptance_criteria: [
            { text: 'AC 1', completed: true },
            { text: 'AC 2', completed: false }
          ]
        }
      ];
      mockStorage.loadTasks.mockReturnValue(mockTasks);
      mockGraph.canCloseTask.mockReturnValue({
        canClose: false,
        openSubtasks: undefined,
        reason: 'has 1 incomplete acceptance criteria'
      });

      await importCLI();

      const updateCmd = commanderCommands.get('update <id>');
      const updateAction = updateCmd?._action;

      await expect(async () => {
        await updateAction('task-789', { status: 'closed' });
      }).rejects.toThrow('process.exit called');

      expect(mockGraph.canCloseTask).toHaveBeenCalledWith('task-789', mockTasks);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Cannot close task task-789 because it has 1 incomplete acceptance criteria')
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(mockStorage.updateTasks).not.toHaveBeenCalled();
    });

    it('should allow closing issue when all requirements are met', async () => {
      const mockTasks = [
        {
          id: 'task-complete',
          title: 'Complete Task',
          status: 'open',
          acceptance_criteria: [
            { text: 'AC 1', completed: true },
            { text: 'AC 2', completed: true }
          ]
        }
      ];
      mockStorage.loadTasks.mockReturnValue(mockTasks);
      mockGraph.canCloseTask.mockReturnValue({ canClose: true });

      await importCLI();

      const updateCmd = commanderCommands.get('update <id>');
      const updateAction = updateCmd?._action;

      await updateAction('task-complete', { status: 'closed' });

      expect(mockGraph.canCloseTask).toHaveBeenCalledWith('task-complete', mockTasks);
      expect(mockStorage.updateTasks).toHaveBeenCalled();
      expect(mockConsoleError).not.toHaveBeenCalled();
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should not validate when issue is already closed', async () => {
      const mockTasks = [
        {
          id: 'already-closed',
          title: 'Closed Task',
          status: 'closed',
          closed_at: '2023-01-01T00:00:00Z'
        }
      ];
      mockStorage.loadTasks.mockReturnValue(mockTasks);

      await importCLI();

      const updateCmd = commanderCommands.get('update <id>');
      const updateAction = updateCmd?._action;

      await updateAction('already-closed', { status: 'closed' });

      expect(mockGraph.canCloseTask).not.toHaveBeenCalled();
      expect(mockStorage.updateTasks).toHaveBeenCalled();
    });

    it('should allow updating other fields without validation when not changing to closed', async () => {
      const mockTasks = [
        { id: 'task-xyz', title: 'Some Task', status: 'in_progress' }
      ];
      mockStorage.loadTasks.mockReturnValue(mockTasks);

      await importCLI();

      const updateCmd = commanderCommands.get('update <id>');
      const updateAction = updateCmd?._action;

      await updateAction('task-xyz', { title: 'Updated Title', priority: 'high' });

      expect(mockGraph.canCloseTask).not.toHaveBeenCalled();
      expect(mockStorage.updateTasks).toHaveBeenCalled();
    });
  });

  describe('list command', () => {
    it('should list all issues', async () => {
      const mockTasks = [
        { id: '1', title: 'Task 1', status: 'open', type: 'task', completion_percentage: null },
        { id: '2', title: 'Task 2', status: 'closed', type: 'bug', completion_percentage: 75 }
      ];
      mockStorage.loadTasks.mockResolvedValue(mockTasks);
      mockCompaction.compactTasks.mockReturnValue(mockTasks);

      await importCLI();

      const listCmd = commanderCommands.get('list');
      const listAction = listCmd?._action;

      await listAction({});

      expect(mockStorage.loadTasks).toHaveBeenCalled();
      expect(mockCompaction.compactTasks).toHaveBeenCalledWith(mockTasks);
      expect(mockConsoleLog).toHaveBeenCalledWith('1: Task 1 [open] [task]');
      expect(mockConsoleLog).toHaveBeenCalledWith('2: Task 2 [closed] [bug] [75%]');
    });

    it('should filter by status', async () => {
      const mockTasks = [
        { id: '1', title: 'Task 1', status: 'open', type: 'task', completion_percentage: null },
        { id: '2', title: 'Task 2', status: 'closed', type: 'bug', completion_percentage: 50 }
      ];
      mockStorage.loadTasks.mockResolvedValue(mockTasks);
      mockCompaction.compactTasks.mockReturnValue(mockTasks);

      await importCLI();

      const listCmd = commanderCommands.get('list');
      const listAction = listCmd?._action;

      await listAction({ status: 'open' });

      expect(mockConsoleLog).toHaveBeenCalledWith('1: Task 1 [open] [task]');
      expect(mockConsoleLog).not.toHaveBeenCalledWith('2: Task 2 [closed] [bug] [50%]');
    });

    it('should show ready work', async () => {
      const mockTasks = [
        { id: '1', title: 'Ready Task', status: 'open', type: 'task', completion_percentage: 25 }
      ];
      mockStorage.loadTasks.mockResolvedValue(mockTasks);
      mockCompaction.compactTasks.mockReturnValue(mockTasks);
      mockGraph.getReadyWork.mockReturnValue([mockTasks[0]]);

      await importCLI();

      const listCmd = commanderCommands.get('list');
      const listAction = listCmd?._action;

      await listAction({ ready: true });

      expect(mockGraph.getReadyWork).toHaveBeenCalledWith(mockTasks);
      expect(mockConsoleLog).toHaveBeenCalledWith('1: Ready Task [open] [task] [25%]');
    });
  });

  describe('dep add command', () => {
    it('should add dependency', async () => {
      mockStorage.loadTasks.mockResolvedValue([]);

      await importCLI();

      const addCmd = commanderCommands.get('add <from> <to>');
      const addAction = addCmd?._action;

      await addAction('task-1', 'task-2', { type: 'blocks' });

      expect(mockStorage.updateTasks).toHaveBeenCalled();
      expect(mockGraph.addDependency).toHaveBeenCalledWith('task-1', 'task-2', 'blocks', expect.any(Array));
    });
  });

  describe('epic commands', () => {
    it('should list epic subtasks', async () => {
      const mockTasks = [
        { id: 'epic-1', title: 'Epic', type: 'epic' },
        { id: 'sub-1', title: 'Subtask 1', status: 'open' },
        { id: 'sub-2', title: 'Subtask 2', status: 'closed' }
      ];
      mockStorage.loadTasks.mockResolvedValue(mockTasks);
      mockGraph.getEpicSubtasks.mockReturnValue([mockTasks[1], mockTasks[2]]);

      await importCLI();

      const subtasksCmd = commanderCommands.get('subtasks <epicId>');
      const subtasksAction = subtasksCmd?._action;

      await subtasksAction('epic-1');

      expect(mockStorage.loadTasks).toHaveBeenCalled();
      expect(mockGraph.getEpicSubtasks).toHaveBeenCalledWith('epic-1', mockTasks);
      expect(mockConsoleLog).toHaveBeenCalledWith('Subtasks for epic epic-1:');
      expect(mockConsoleLog).toHaveBeenCalledWith('  sub-1: Subtask 1 [open]');
      expect(mockConsoleLog).toHaveBeenCalledWith('  sub-2: Subtask 2 [closed]');
    });

    it('should show epic progress', async () => {
      const mockTasks = [{ id: 'epic-1', title: 'Test Epic', type: 'epic', status: 'open' }];
      mockStorage.loadTasks.mockResolvedValue(mockTasks);
      mockGraph.calculateEpicProgress.mockReturnValue({ completed: 2, total: 5, percentage: 40 });
      mockGraph.shouldCloseEpic.mockReturnValue(false);

      await importCLI();

      const progressCmd = commanderCommands.get('progress <epicId>');
      const progressAction = progressCmd?._action;

      await progressAction('epic-1');

      expect(mockGraph.calculateEpicProgress).toHaveBeenCalledWith('epic-1', mockTasks);
      expect(mockConsoleLog).toHaveBeenCalledWith('Epic: Test Epic');
      expect(mockConsoleLog).toHaveBeenCalledWith('Progress: 2/5 subtasks completed (40%)');
    });

    it('should create epic subtask', async () => {
      const mockTasks = [{ id: 'epic-1', title: 'Test Epic', type: 'epic' }];
      mockStorage.loadTasks.mockResolvedValue(mockTasks);

      await importCLI();

      const addSubtaskCmd = commanderCommands.get('add-subtask <epicId> <title>');
      const addSubtaskAction = addSubtaskCmd?._action;

      await addSubtaskAction('epic-1', 'New Subtask', { description: 'Test desc', priority: 'medium' });

      expect(mockStorage.saveTask).toHaveBeenCalledWith({
        id: 's-test-id-123',
        title: 'New Subtask',
        description: 'Test desc',
        type: 'task',
        status: 'open',
        priority: 'medium',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
      expect(mockStorage.updateTasks).toHaveBeenCalled();
      expect(mockGraph.addDependency).toHaveBeenCalledWith('s-test-id-123', 'epic-1', 'parent-child', mockTasks);
    });
  });

  describe('review command', () => {
    it('should perform self-review on a task', async () => {
      const mockTasks = [{ id: 'task-123', title: 'Test Task' }];
      mockStorage.loadTasks.mockResolvedValue(mockTasks);

      await importCLI();

      const reviewCmd = commanderCommands.get('review <id>');
      const reviewAction = reviewCmd?._action;

      await reviewAction('task-123');

      expect(mockStorage.loadTasks).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('Reviewing task task-123: Test Task');
      expect(mockConsoleLog).toHaveBeenCalledWith('Checklist:');
      expect(mockConsoleLog).toHaveBeenCalledWith('- Code quality: Check for best practices, readability, performance');
    });
  });
});
