import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test interfaces
interface MockTool {
  [key: string]: unknown; // Tool properties
}

interface MockContext {
  subscriptions: unknown[];
}

// Mock VS Code API - registered tools are tracked  in the vscode mock

// Mock file system
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true), // Mock .cairn directory exists
  readFileSync: vi.fn(() => 'mock html content'),
  watch: vi.fn(() => ({ close: vi.fn() })),
}));

// Mock path
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  dirname: vi.fn(() => '/parent'),
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-id-123'),
}));

// Mock @valpet/cairn-core
vi.mock('../../core/dist/index.js', () => ({
  TYPES: {
    IStorageService: 'IStorageService',
    IGraphService: 'IGraphService',
  },
  createContainer: vi.fn(),
  findCairnDir: vi.fn().mockReturnValue({ cairnDir: '/test/workspace/.cairn', repoRoot: '/test/workspace' }),
  generateId: vi.fn().mockReturnValue('s-test-id-123'),
}));

// Import after mocking
import * as vscode from 'vscode';
import { lm, registeredTools } from 'vscode';
import { createContainer, TYPES, findCairnDir, generateId, IStorageService, IGraphService } from '../../core/dist/index.js';
import { Container } from 'inversify';
import {
  activate,
  getStorage,
  getGraph,
  resetServices,
  loadFilterState,
} from './extension';
import {
  CairnCreateTool,
  CairnListReadyTool,
  CairnUpdateTool,
  CairnDepAddTool,
  CairnCommentTool,
  CairnAcAddTool,
  CairnAcUpdateTool,
  CairnAcRemoveTool,
  CairnAcToggleTool,
} from './extension';

describe('VS Code Extension Tools', () => {
  let mockStorage: IStorageService;
  let mockGraph: IGraphService;
  let mockContainer: Container;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    mockStorage = {
      loadTasks: vi.fn().mockResolvedValue([]),
      saveTask: vi.fn().mockResolvedValue(undefined),
      updateTasks: vi.fn().mockImplementation(async (callback) => {
        // Mock updateTasks to call the callback with current tasks and return the result
        const currentTasks = [{ id: 'existing-1' }];
        const updatedTasks = callback(currentTasks);
        return Promise.resolve(updatedTasks);
      }),
      addComment: vi.fn().mockResolvedValue({ id: 'comment-123', author: 'agent', content: 'Test comment', created_at: '2026-01-18T00:00:00.000Z' }),
    };

    mockGraph = {
      addDependency: vi.fn(),
      getReadyWork: vi.fn(),
      getCascadingStatusUpdates: vi.fn(() => []),
      canCloseTask: vi.fn(),
      getEpicSubtasks: vi.fn(() => []),
      getNonParentedTasks: vi.fn(() => []),
    };

    mockContainer = {
      get: vi.fn((type) => {
        switch (type) {
          case TYPES.IStorageService: return mockStorage;
          case TYPES.IGraphService: return mockGraph;
          default: return {};
        }
      }),
    };

    mockContext = new vscode.ExtensionContext();

    // Setup createContainer mock to return our mockContainer
    vi.mocked(createContainer).mockReturnValue(mockContainer as any);

    vi.mocked(findCairnDir).mockReturnValue({ cairnDir: '/test/workspace/.cairn', repoRoot: '/test/workspace' });
    vi.mocked(generateId).mockReturnValue('s-test-id-123');

    // Manually register tools for testing
    registeredTools['cairn_create'] = new CairnCreateTool(mockStorage, mockGraph);
    registeredTools['cairn_list_ready'] = new CairnListReadyTool(mockStorage, mockGraph);
    registeredTools['cairn_update'] = new CairnUpdateTool(mockStorage, mockGraph);
    registeredTools['cairn_dep_add'] = new CairnDepAddTool(mockStorage, mockGraph);
    registeredTools['cairn_comment'] = new CairnCommentTool(mockStorage);
    registeredTools['cairn_ac_add'] = new CairnAcAddTool(mockStorage);
    registeredTools['cairn_ac_update'] = new CairnAcUpdateTool(mockStorage);
    registeredTools['cairn_ac_remove'] = new CairnAcRemoveTool(mockStorage);
    registeredTools['cairn_ac_toggle'] = new CairnAcToggleTool(mockStorage);
  });

  describe('cairn_create tool', () => {
    it('should create a task with minimal parameters', async () => {
      mockStorage.loadTasks.mockResolvedValue([]);

      const toolHandler = registeredTools['cairn_create'];

      const result = await toolHandler.invoke({
        input: {
          title: 'Test Task',
        }
      }, {});

      expect(mockStorage.loadTasks).toHaveBeenCalled();
      expect(mockStorage.saveTask).toHaveBeenCalledWith({
        id: 's-test-id-123',
        title: 'Test Task',
        description: '',
        type: 'task',
        status: 'open',
        priority: 'medium',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
      expect(result.content[0].text).toContain('Created task s-test-id-123');
    });

    it('should create a task with all parameters including parent', async () => {
      const mockTasks = [{ id: 'epic-123', title: 'Test Epic' }];
      mockStorage.loadTasks.mockResolvedValue(mockTasks);
      mockStorage.updateTasks.mockImplementation(async (callback) => {
        const updatedTasks = callback(mockTasks);
        return updatedTasks;
      });

      const toolHandler = registeredTools['cairn_create'];

      const result = await toolHandler.invoke({
        input: {
          title: 'Feature Task',
          description: 'A feature description',
          type: 'feature',
          priority: 'high',
          status: 'in_progress',
          parent: 'epic-123',
        }
      }, {});

      expect(mockStorage.saveTask).toHaveBeenCalledWith({
        id: 's-test-id-123',
        title: 'Feature Task',
        description: 'A feature description',
        type: 'feature',
        status: 'in_progress',
        priority: 'high',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });

      expect(mockStorage.updateTasks).toHaveBeenCalled();
      expect(mockGraph.addDependency).toHaveBeenCalledWith('s-test-id-123', 'epic-123', 'parent-child', mockTasks);

      expect(result.content[0].text).toContain('Created task s-test-id-123');
    });

    it('should handle errors gracefully', async () => {
      mockStorage.loadTasks.mockRejectedValue(new Error('Storage error'));

      const toolHandler = registeredTools['cairn_create'];

      const result = await toolHandler.invoke({
        input: {
          title: 'Test Task',
        }
      }, {});

      expect(result.content[0].text).toContain('Error creating task');
      expect(result.content[0].text).toContain('Storage error');
    });
  });

  describe('cairn_list_ready tool', () => {
    it('should return ready tasks', async () => {
      const mockTasks = [
        { id: 'task-1', title: 'Ready Task', status: 'open', priority: 'high' },
        { id: 'task-2', title: 'Blocked Task', status: 'open', priority: 'medium' }
      ];
      mockStorage.loadTasks.mockResolvedValue(mockTasks);
      mockGraph.getReadyWork.mockReturnValue([mockTasks[0]]);

      const toolHandler = registeredTools['cairn_list_ready'];

      const result = await toolHandler.invoke({}, {});

      expect(mockStorage.loadTasks).toHaveBeenCalled();
      expect(mockGraph.getReadyWork).toHaveBeenCalledWith(mockTasks);
      expect(result.content[0].text).toContain('readyTasks');
      expect(result.content[0].text).toContain('Ready Task');
    });
  });

  describe('cairn_update tool', () => {
    it('should update task status', async () => {
      mockStorage.updateTasks.mockImplementation(async (callback) => {
        const currentTasks = [{ id: 'task-123', status: 'open' }];
        const updatedTasks = callback(currentTasks);
        return updatedTasks;
      });

      const toolHandler = registeredTools['cairn_update'];

      const result = await toolHandler.invoke({
        input: {
          id: 'task-123',
          status: 'in_progress',
        }
      }, {});

      expect(mockStorage.updateTasks).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Updated task task-123');
    });

    it('should ignore notes field and not create comments', async () => {
      mockStorage.updateTasks.mockImplementation(async (callback) => {
        const currentTasks = [{ id: 'task-123', status: 'open' }];
        const updatedTasks = callback(currentTasks);
        return updatedTasks;
      });

      const toolHandler = registeredTools['cairn_update'];

      const result = await toolHandler.invoke({
        input: {
          id: 'task-123',
          status: 'in_progress',
          notes: 'These notes should be ignored',
        }
      }, {});

      expect(mockStorage.updateTasks).toHaveBeenCalled();
      expect(mockStorage.addComment).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('Updated task task-123');
    });

    it('should ignore acceptance_criteria field and not create comments', async () => {
      mockStorage.updateTasks.mockImplementation(async (callback) => {
        const currentTasks = [{ id: 'task-123', status: 'open' }];
        const updatedTasks = callback(currentTasks);
        return updatedTasks;
      });

      const toolHandler = registeredTools['cairn_update'];

      const result = await toolHandler.invoke({
        input: {
          id: 'task-123',
          status: 'in_progress',
          acceptance_criteria: ['Criteria 1', 'Criteria 2'],
        }
      }, {});

      expect(mockStorage.updateTasks).toHaveBeenCalled();
      expect(mockStorage.addComment).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('Updated task task-123');
    });

    it('should prevent closing a task with open subtasks', async () => {
      const mockTasks = [
        { id: 'parent-123', title: 'Parent Task', status: 'open' },
        { id: 'subtask-1', title: 'Open Subtask', status: 'open' },
      ];

      mockStorage.loadTasks.mockResolvedValue(mockTasks);
      mockGraph.canCloseTask.mockReturnValue({
        canClose: false,
        openSubtasks: [{ id: 'subtask-1', title: 'Open Subtask', status: 'open' }],
        reason: 'has 1 open subtask(s)'
      });

      const toolHandler = registeredTools['cairn_update'];

      const result = await toolHandler.invoke({
        input: {
          id: 'parent-123',
          status: 'closed',
        }
      }, {});

      expect(mockStorage.loadTasks).toHaveBeenCalled();
      expect(mockGraph.canCloseTask).toHaveBeenCalledWith('parent-123', mockTasks);
      expect(mockStorage.updateTasks).not.toHaveBeenCalled();

      const resultText = result.content[0].text;
      expect(resultText).toContain('success');
      expect(resultText).toContain('false');
      expect(resultText).toContain('Cannot close task');
      expect(resultText).toContain('Parent Task');
      expect(resultText).toContain('parent-123');
      expect(resultText).toContain('Open Subtask');
      expect(resultText).toContain('subtask-1');
    });

    it('should allow closing a task with no subtasks', async () => {
      const mockTasks = [
        { id: 'task-123', title: 'Task No Subtasks', status: 'open' },
      ];

      mockStorage.loadTasks.mockResolvedValue(mockTasks);
      mockGraph.canCloseTask.mockReturnValue({
        canClose: true,
        openSubtasks: [],
      });

      mockStorage.updateTasks.mockImplementation(async (callback) => {
        const updatedTasks = callback(mockTasks);
        return updatedTasks;
      });

      const toolHandler = registeredTools['cairn_update'];

      const result = await toolHandler.invoke({
        input: {
          id: 'task-123',
          status: 'closed',
        }
      }, {});

      expect(mockStorage.loadTasks).toHaveBeenCalled();
      expect(mockGraph.canCloseTask).toHaveBeenCalledWith('task-123', mockTasks);
      expect(mockStorage.updateTasks).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Updated task task-123');
    });

    it('should allow closing a task with all closed subtasks', async () => {
      const mockTasks = [
        { id: 'parent-123', title: 'Parent Task', status: 'open' },
        { id: 'subtask-1', title: 'Closed Subtask 1', status: 'closed' },
        { id: 'subtask-2', title: 'Closed Subtask 2', status: 'closed' },
      ];

      mockStorage.loadTasks.mockResolvedValue(mockTasks);
      mockGraph.canCloseTask.mockReturnValue({
        canClose: true,
        openSubtasks: [],
      });

      mockStorage.updateTasks.mockImplementation(async (callback) => {
        const updatedTasks = callback(mockTasks);
        return updatedTasks;
      });

      const toolHandler = registeredTools['cairn_update'];

      const result = await toolHandler.invoke({
        input: {
          id: 'parent-123',
          status: 'closed',
        }
      }, {});

      expect(mockStorage.loadTasks).toHaveBeenCalled();
      expect(mockGraph.canCloseTask).toHaveBeenCalledWith('parent-123', mockTasks);
      expect(mockStorage.updateTasks).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Updated task parent-123');
    });

    it('should prevent closing task with multiple open subtasks and list all of them', async () => {
      const mockTasks = [
        { id: 'parent-123', title: 'Parent Epic', status: 'in_progress' },
        { id: 'subtask-1', title: 'Open Subtask 1', status: 'open' },
        { id: 'subtask-2', title: 'Open Subtask 2', status: 'in_progress' },
        { id: 'subtask-3', title: 'Open Subtask 3', status: 'open' },
      ];

      mockStorage.loadTasks.mockResolvedValue(mockTasks);
      mockGraph.canCloseTask.mockReturnValue({
        canClose: false,
        openSubtasks: [
          { id: 'subtask-1', title: 'Open Subtask 1', status: 'open' },
          { id: 'subtask-2', title: 'Open Subtask 2', status: 'in_progress' },
          { id: 'subtask-3', title: 'Open Subtask 3', status: 'open' },
        ],
        reason: 'has 3 open subtask(s)'
      });

      const toolHandler = registeredTools['cairn_update'];

      const result = await toolHandler.invoke({
        input: {
          id: 'parent-123',
          status: 'closed',
        }
      }, {});

      expect(mockGraph.canCloseTask).toHaveBeenCalledWith('parent-123', mockTasks);
      expect(mockStorage.updateTasks).not.toHaveBeenCalled();

      const resultText = result.content[0].text;
      expect(resultText).toContain('Cannot close task');
      expect(resultText).toContain('Open Subtask 1');
      expect(resultText).toContain('Cannot close task');
      expect(resultText).toContain('Open Subtask 2');
      expect(resultText).toContain('subtask-2');
      expect(resultText).toContain('Open Subtask 3');
      expect(resultText).toContain('subtask-3');
    });
  });

  describe('cairn_dep_add tool', () => {
    it('should add dependency between tasks', async () => {
      const mockTasks = [{ id: 'task-1' }, { id: 'task-2' }];
      mockStorage.loadTasks.mockResolvedValue(mockTasks);
      mockStorage.updateTasks.mockImplementation(async (callback) => {
        const updatedTasks = callback(mockTasks);
        return updatedTasks;
      });

      const toolHandler = registeredTools['cairn_dep_add'];

      const result = await toolHandler.invoke({
        input: {
          from: 'task-1',
          to: 'task-2',
          type: 'blocks',
        }
      }, {});

      expect(mockStorage.updateTasks).toHaveBeenCalled();
      expect(mockGraph.addDependency).toHaveBeenCalledWith('task-1', 'task-2', 'blocks', mockTasks);
      expect(result.content[0].text).toContain('Added blocks dependency');
    });
  });

  describe('cairn_comment tool', () => {
    it('should add comment to task', async () => {
      mockStorage.addComment.mockResolvedValue({
        id: 'comment-123',
        author: 'agent',
        content: 'Test comment',
        created_at: '2026-01-18T00:00:00.000Z',
      });

      const toolHandler = registeredTools['cairn_comment'];

      const result = await toolHandler.invoke({
        input: {
          task_id: 'task-123',
          content: 'Test comment',
        }
      }, {});

      expect(mockStorage.addComment).toHaveBeenCalledWith('task-123', 'agent', 'Test comment');
      expect(result.content[0].text).toContain('Added comment to task task-123');
    });
  });

  describe('cairn_ac_add tool', () => {
    it('should add acceptance criteria to task', async () => {
      mockStorage.updateTasks.mockImplementation(async (callback) => {
        const currentTasks = [{ id: 'task-123', acceptance_criteria: [] }];
        const updatedTasks = callback(currentTasks);
        return updatedTasks;
      });

      const toolHandler = registeredTools['cairn_ac_add'];

      const result = await toolHandler.invoke({
        input: {
          task_id: 'task-123',
          text: 'New acceptance criteria',
        }
      }, {});

      expect(mockStorage.updateTasks).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Added acceptance criteria to task task-123');
    });
  });

  describe('cairn_ac_update tool', () => {
    it('should update acceptance criteria text', async () => {
      mockStorage.updateTasks.mockImplementation(async (callback) => {
        const currentTasks = [{
          id: 'task-123',
          acceptance_criteria: [{ text: 'Old text', completed: false }]
        }];
        const updatedTasks = callback(currentTasks);
        return updatedTasks;
      });

      const toolHandler = registeredTools['cairn_ac_update'];

      const result = await toolHandler.invoke({
        input: {
          task_id: 'task-123',
          index: 0,
          text: 'Updated acceptance criteria',
        }
      }, {});

      expect(mockStorage.updateTasks).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Updated acceptance criteria 0 for task task-123');
    });
  });

  describe('cairn_ac_remove tool', () => {
    it('should remove acceptance criteria from task', async () => {
      mockStorage.updateTasks.mockImplementation(async (callback) => {
        const currentTasks = [{
          id: 'task-123',
          acceptance_criteria: [
            { text: 'Criteria 1', completed: false },
            { text: 'Criteria 2', completed: true }
          ]
        }];
        const updatedTasks = callback(currentTasks);
        return updatedTasks;
      });

      const toolHandler = registeredTools['cairn_ac_remove'];

      const result = await toolHandler.invoke({
        input: {
          task_id: 'task-123',
          index: 0,
        }
      }, {});

      expect(mockStorage.updateTasks).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Removed acceptance criteria 0 from task task-123');
    });
  });

  describe('cairn_ac_toggle tool', () => {
    it('should toggle acceptance criteria completion status', async () => {
      mockStorage.updateTasks.mockImplementation(async (callback) => {
        const currentTasks = [{
          id: 'task-123',
          acceptance_criteria: [{ text: 'Criteria 1', completed: false }]
        }];
        const updatedTasks = callback(currentTasks);
        return updatedTasks;
      });

      const toolHandler = registeredTools['cairn_ac_toggle'];

      const result = await toolHandler.invoke({
        input: {
          task_id: 'task-123',
          index: 0,
        }
      }, {});

      expect(mockStorage.updateTasks).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Toggled acceptance criteria 0 completion for task task-123');
    });
  });

  // Note: Webview saveTicket message handler for canCloseTask validation
  // The webview command 'cairn.openEditView' contains additional canCloseTask validation
  // that prevents closing issues with open subtasks from the UI.
  // This validation logic mirrors the tool validation tested above but is integrated into
  // the webview message flow. Consider adding integration tests for the full webview flow.
});

describe('Extension Activation and Service Initialization', () => {
  let mockStorage: IStorageService;
  let mockGraph: IGraphService;
  let mockContainer: Container;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    mockStorage = {
      loadTasks: vi.fn(),
      saveTask: vi.fn(),
      updateTasks: vi.fn(),
      addComment: vi.fn(),
      getTasksFilePath: vi.fn(() => '/test/workspace/.cairn/tasks.jsonl'),
    };

    mockGraph = {
      addDependency: vi.fn(),
      getReadyWork: vi.fn(),
      getCascadingStatusUpdates: vi.fn(() => []),
      canCloseTask: vi.fn(),
      getEpicSubtasks: vi.fn(() => []),
      getNonParentedTasks: vi.fn(() => []),
    };

    mockContainer = {
      get: vi.fn((type) => {
        switch (type) {
          case TYPES.IStorageService: return mockStorage;
          case TYPES.IGraphService: return mockGraph;
          default: return {};
        }
      }),
    };

    mockContext = new vscode.ExtensionContext();

    // Setup createContainer mock to return our mockContainer
    vi.mocked(createContainer).mockReturnValue(mockContainer as any);

    vi.mocked(findCairnDir).mockReturnValue({ cairnDir: '/test/workspace/.cairn', repoRoot: '/test/workspace' });
    vi.mocked(generateId).mockReturnValue('s-test-id-123');
  });

  describe('activate() function', () => {
    it('should initialize services correctly', async () => {
      // Reset services to clean state
      resetServices();

      // Mock fs.existsSync to return true for .cairn directory
      const fs = await import('fs');
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('{"activeFile": "default"}');

      await activate(mockContext);

      // Verify container was created with correct parameters
      expect(createContainer).toHaveBeenCalledWith('/test/workspace/.cairn', '/test/workspace', 'tasks.jsonl');

      // Verify services were retrieved from container
      expect(mockContainer.get).toHaveBeenCalledWith(TYPES.IStorageService);
      expect(mockContainer.get).toHaveBeenCalledWith(TYPES.IGraphService);

      // Note: Tool registration testing is not feasible in this test environment
      // due to VS Code API mocking complexities. The tool registration code exists
      // and works in the actual VS Code environment, but the vscode.lm API cannot
      // be properly mocked for unit testing. Tool functionality is tested separately.
    });

    it('should handle missing .cairn directory gracefully', async () => {
      // Reset services to clean state
      resetServices();

      // Mock fs.existsSync to return false for .cairn directory
      const fs = await import('fs');
      (fs.existsSync as any).mockReturnValue(false);

      // Mock showErrorMessage
      const showErrorMessageSpy = vi.spyOn(vscode.window, 'showErrorMessage');

      await activate(mockContext);

      expect(showErrorMessageSpy).toHaveBeenCalledWith('No .cairn directory found. Run `npx cairn init` in your project root.');
      expect(createContainer).not.toHaveBeenCalled();
    });

    it('should handle missing workspace gracefully', async () => {
      // Reset services to clean state
      resetServices();

      // Mock workspace without workspaceFolders
      const originalWorkspaceFolders = (vscode.workspace as any).workspaceFolders;
      (vscode.workspace as any).workspaceFolders = undefined;

      // Mock showErrorMessage
      const showErrorMessageSpy = vi.spyOn(vscode.window, 'showErrorMessage');

      await activate(mockContext);

      expect(showErrorMessageSpy).toHaveBeenCalledWith('No workspace folder found');
      expect(createContainer).not.toHaveBeenCalled();

      // Restore original workspaceFolders
      (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
    });
  });

  describe('Service Getter Functions', () => {
    beforeEach(() => {
      // Reset module-level variables by clearing any existing services
      // This simulates the state before activation
      resetServices();
    });

    it('should throw error when getStorage() is called before initialization', async () => {
      expect(() => getStorage()).toThrow('Storage service has not been initialized yet.');
    });

    it('should throw error when getGraph() is called before initialization', async () => {
      expect(() => getGraph()).toThrow('Graph service has not been initialized yet.');
    });

    it('should return initialized services after activation', async () => {
      // Mock fs.existsSync to return true for .cairn directory
      const fs = await import('fs');
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('{"activeFile": "default"}');

      await activate(mockContext);

      const storageService = getStorage();
      const graphService = getGraph();

      expect(storageService).toBe(mockStorage);
      expect(graphService).toBe(mockGraph);
    });
  });
});

describe('loadFilterState function', () => {
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock context with workspaceState
    mockContext = {
      workspaceState: {
        get: vi.fn(),
        update: vi.fn(),
      },
      subscriptions: [],
    } as any;
  });

  it('should return valid filter state when all properties are correct', () => {
    const validState = {
      selectedStatuses: ['ready', 'open', 'in_progress'],
      showRecentlyClosed: true,
      recentlyClosedDuration: '120',
      timeFilter: '24h'
    };

    mockContext.workspaceState.get.mockReturnValue(validState);

    const result = loadFilterState(mockContext);

    expect(result).toEqual({
      selectedStatuses: ['ready', 'open', 'in_progress'],
      showRecentlyClosed: true,
      recentlyClosedDuration: '120',
      timeFilter: '24h'
    });
  });

  it('should return defaults when no saved state exists', () => {
    mockContext.workspaceState.get.mockReturnValue(undefined);

    const result = loadFilterState(mockContext);

    expect(result).toEqual({
      selectedStatuses: ['ready', 'open', 'in_progress'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: 'all'
    });
  });

  it('should validate selectedStatuses array and fall back to defaults for invalid type', () => {
    const invalidState = {
      selectedStatuses: 'not-an-array', // Should be array
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(invalidState);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready', 'open', 'in_progress']); // Should use defaults
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all');
  });

  it('should validate selectedStatuses array elements and fall back to defaults for non-string elements', () => {
    const invalidState = {
      selectedStatuses: ['ready', 123, 'open'], // Mixed types
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(invalidState);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready', 'open', 'in_progress']); // Should use defaults
  });

  it('should validate showRecentlyClosed boolean and fall back to default for invalid type', () => {
    const invalidState = {
      selectedStatuses: ['ready', 'open'],
      showRecentlyClosed: 'not-a-boolean', // Should be boolean
      recentlyClosedDuration: '60',
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(invalidState);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready', 'open']);
    expect(result.showRecentlyClosed).toBe(false); // Should use default
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all');
  });

  it('should validate recentlyClosedDuration string and fall back to default for invalid type', () => {
    const invalidState = {
      selectedStatuses: ['ready', 'open'],
      showRecentlyClosed: false,
      recentlyClosedDuration: 123, // Should be string
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(invalidState);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready', 'open']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('60'); // Should use default
    expect(result.timeFilter).toBe('all');
  });

  it('should validate timeFilter string and fall back to default for invalid type', () => {
    const invalidState = {
      selectedStatuses: ['ready', 'open'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: { invalid: 'object' } // Should be string
    };

    mockContext.workspaceState.get.mockReturnValue(invalidState);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready', 'open']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all'); // Should use default
  });

  it('should handle missing properties by using defaults', () => {
    const partialState = {
      selectedStatuses: ['ready'], // Only one property
    };

    mockContext.workspaceState.get.mockReturnValue(partialState);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(false); // Default
    expect(result.recentlyClosedDuration).toBe('60'); // Default
    expect(result.timeFilter).toBe('all'); // Default
  });

  it('should handle array data type and fall back to defaults', () => {
    mockContext.workspaceState.get.mockReturnValue(['invalid', 'array']);

    const result = loadFilterState(mockContext);

    expect(result).toEqual({
      selectedStatuses: ['ready', 'open', 'in_progress'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: 'all'
    });
  });

  it('should handle primitive data types and fall back to defaults', () => {
    mockContext.workspaceState.get.mockReturnValue('invalid string');

    const result = loadFilterState(mockContext);

    expect(result).toEqual({
      selectedStatuses: ['ready', 'open', 'in_progress'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: 'all'
    });
  });

  it('should handle null data and fall back to defaults', () => {
    mockContext.workspaceState.get.mockReturnValue(null);

    const result = loadFilterState(mockContext);

    expect(result).toEqual({
      selectedStatuses: ['ready', 'open', 'in_progress'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: 'all'
    });
  });

  it('should use valid properties and defaults for invalid ones', () => {
    const mixedState = {
      selectedStatuses: ['ready', 'open'], // Valid
      showRecentlyClosed: 'invalid', // Invalid
      recentlyClosedDuration: '120', // Valid
      timeFilter: 123, // Invalid
    };

    mockContext.workspaceState.get.mockReturnValue(mixedState);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready', 'open']); // Valid, kept
    expect(result.showRecentlyClosed).toBe(false); // Invalid, default
    expect(result.recentlyClosedDuration).toBe('120'); // Valid, kept
    expect(result.timeFilter).toBe('all'); // Invalid, default
  });

  it('should handle empty array for selectedStatuses', () => {
    const stateWithEmptyArray = {
      selectedStatuses: [], // Empty array
      showRecentlyClosed: true,
      recentlyClosedDuration: '30',
      timeFilter: '1h'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithEmptyArray);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual([]); // Empty array is valid
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('30');
    expect(result.timeFilter).toBe('1h');
  });

  it('should handle array with only valid strings for selectedStatuses', () => {
    const stateWithValidArray = {
      selectedStatuses: ['ready', 'open', 'in_progress', 'closed', 'blocked'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '90',
      timeFilter: '24h'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithValidArray);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready', 'open', 'in_progress', 'closed', 'blocked']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('90');
    expect(result.timeFilter).toBe('24h');
  });

  it('should handle array with null/undefined elements in selectedStatuses', () => {
    const stateWithNullElements = {
      selectedStatuses: ['ready', null, 'open', undefined, 'closed'],
      showRecentlyClosed: true,
      recentlyClosedDuration: '45',
      timeFilter: '6h'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithNullElements);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready', 'open', 'in_progress']); // Falls back to defaults due to invalid elements
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('45');
    expect(result.timeFilter).toBe('6h');
  });

  it('should handle boolean false for showRecentlyClosed', () => {
    const stateWithFalseBoolean = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: false, // Explicit false
      recentlyClosedDuration: '120',
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithFalseBoolean);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('120');
    expect(result.timeFilter).toBe('all');
  });

  it('should handle boolean true for showRecentlyClosed', () => {
    const stateWithTrueBoolean = {
      selectedStatuses: ['open'],
      showRecentlyClosed: true, // Explicit true
      recentlyClosedDuration: '30',
      timeFilter: '1h'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithTrueBoolean);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['open']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('30');
    expect(result.timeFilter).toBe('1h');
  });

  it('should handle empty string for recentlyClosedDuration', () => {
    const stateWithEmptyString = {
      selectedStatuses: ['ready', 'open'],
      showRecentlyClosed: true,
      recentlyClosedDuration: '', // Empty string
      timeFilter: '24h'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithEmptyString);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready', 'open']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe(''); // Empty string is valid
    expect(result.timeFilter).toBe('24h');
  });

  it('should handle numeric string for recentlyClosedDuration', () => {
    const stateWithNumericString = {
      selectedStatuses: ['closed'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '123', // Numeric string
      timeFilter: '3d'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithNumericString);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['closed']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('123');
    expect(result.timeFilter).toBe('3d');
  });

  it('should handle empty string for timeFilter', () => {
    const stateWithEmptyTimeFilter = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: true,
      recentlyClosedDuration: '60',
      timeFilter: '' // Empty string
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithEmptyTimeFilter);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe(''); // Empty string is valid
  });

  it('should handle object with extra properties', () => {
    const stateWithExtraProps = {
      selectedStatuses: ['ready', 'open'],
      showRecentlyClosed: true,
      recentlyClosedDuration: '90',
      timeFilter: '12h',
      extraProperty: 'ignored',
      anotherExtra: { nested: 'object' }
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithExtraProps);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready', 'open']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('90');
    expect(result.timeFilter).toBe('12h');
  });

  it('should handle deeply nested invalid objects', () => {
    const stateWithNestedInvalid = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: { nested: { value: true } }, // Invalid nested object
      recentlyClosedDuration: '60',
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithNestedInvalid);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(false); // Falls back to default
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all');
  });

  it('should handle array of objects for selectedStatuses', () => {
    const stateWithObjectArray = {
      selectedStatuses: [{ status: 'ready' }, { status: 'open' }], // Array of objects
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithObjectArray);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready', 'open', 'in_progress']); // Falls back to defaults
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all');
  });

  it('should handle number 0 for showRecentlyClosed', () => {
    const stateWithZeroBoolean = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: 0, // Number 0 (falsy but not boolean)
      recentlyClosedDuration: '60',
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithZeroBoolean);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(false); // Falls back to default
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all');
  });

  it('should handle number 1 for showRecentlyClosed', () => {
    const stateWithOneBoolean = {
      selectedStatuses: ['open'],
      showRecentlyClosed: 1, // Number 1 (truthy but not boolean)
      recentlyClosedDuration: '60',
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithOneBoolean);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['open']);
    expect(result.showRecentlyClosed).toBe(false); // Falls back to default
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all');
  });

  it('should handle string "false" for showRecentlyClosed', () => {
    const stateWithStringFalse = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: 'false', // String "false"
      recentlyClosedDuration: '60',
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithStringFalse);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(false); // Falls back to default
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all');
  });

  it('should handle string "true" for showRecentlyClosed', () => {
    const stateWithStringTrue = {
      selectedStatuses: ['open'],
      showRecentlyClosed: 'true', // String "true"
      recentlyClosedDuration: '60',
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithStringTrue);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['open']);
    expect(result.showRecentlyClosed).toBe(false); // Falls back to default
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all');
  });

  it('should handle number for recentlyClosedDuration', () => {
    const stateWithNumberDuration = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: true,
      recentlyClosedDuration: 120, // Number instead of string
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithNumberDuration);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('60'); // Falls back to default
    expect(result.timeFilter).toBe('all');
  });

  it('should handle boolean for recentlyClosedDuration', () => {
    const stateWithBooleanDuration = {
      selectedStatuses: ['open'],
      showRecentlyClosed: false,
      recentlyClosedDuration: true, // Boolean instead of string
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithBooleanDuration);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['open']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('60'); // Falls back to default
    expect(result.timeFilter).toBe('all');
  });

  it('should handle array for recentlyClosedDuration', () => {
    const stateWithArrayDuration = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: true,
      recentlyClosedDuration: ['60'], // Array instead of string
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithArrayDuration);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('60'); // Falls back to default
    expect(result.timeFilter).toBe('all');
  });

  it('should handle object for timeFilter', () => {
    const stateWithObjectTimeFilter = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: { value: '24h' } // Object instead of string
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithObjectTimeFilter);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all'); // Falls back to default
  });

  it('should handle array for timeFilter', () => {
    const stateWithArrayTimeFilter = {
      selectedStatuses: ['open'],
      showRecentlyClosed: true,
      recentlyClosedDuration: '30',
      timeFilter: ['24h'] // Array instead of string
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithArrayTimeFilter);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['open']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('30');
    expect(result.timeFilter).toBe('all'); // Falls back to default
  });

  it('should handle number for timeFilter', () => {
    const stateWithNumberTimeFilter = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: 24 // Number instead of string
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithNumberTimeFilter);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all'); // Falls back to default
  });

  it('should handle boolean for timeFilter', () => {
    const stateWithBooleanTimeFilter = {
      selectedStatuses: ['closed'],
      showRecentlyClosed: true,
      recentlyClosedDuration: '90',
      timeFilter: false // Boolean instead of string
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithBooleanTimeFilter);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['closed']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('90');
    expect(result.timeFilter).toBe('all'); // Falls back to default
  });

  it('should handle very long string for timeFilter', () => {
    const longTimeFilter = 'a'.repeat(1000);
    const stateWithLongTimeFilter = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: longTimeFilter
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithLongTimeFilter);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe(longTimeFilter); // Long string is still valid
  });

  it('should handle string with special characters for timeFilter', () => {
    const specialTimeFilter = '24h-with-dashes_and_underscores.123';
    const stateWithSpecialTimeFilter = {
      selectedStatuses: ['open'],
      showRecentlyClosed: true,
      recentlyClosedDuration: '45',
      timeFilter: specialTimeFilter
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithSpecialTimeFilter);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['open']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('45');
    expect(result.timeFilter).toBe(specialTimeFilter);
  });

  it('should handle unicode string for timeFilter', () => {
    const unicodeTimeFilter = '24h-测试-🚀';
    const stateWithUnicodeTimeFilter = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: unicodeTimeFilter
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithUnicodeTimeFilter);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe(unicodeTimeFilter);
  });

  it('should handle very large array for selectedStatuses', () => {
    const largeArray = Array.from({ length: 1000 }, (_, i) => `status-${i}`);
    const stateWithLargeArray = {
      selectedStatuses: largeArray,
      showRecentlyClosed: true,
      recentlyClosedDuration: '120',
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithLargeArray);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(largeArray);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('120');
    expect(result.timeFilter).toBe('all');
  });

  it('should handle array with duplicate strings for selectedStatuses', () => {
    const stateWithDuplicates = {
      selectedStatuses: ['ready', 'ready', 'open', 'open', 'ready'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: '24h'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithDuplicates);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready', 'ready', 'open', 'open', 'ready']); // Duplicates are allowed
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('24h');
  });

  it('should handle object with prototype properties', () => {
    const objWithProto = Object.create({ inheritedProp: 'inherited' });
    objWithProto.selectedStatuses = ['ready'];
    objWithProto.showRecentlyClosed = true;
    objWithProto.recentlyClosedDuration = '30';
    objWithProto.timeFilter = '1h';

    mockContext.workspaceState.get.mockReturnValue(objWithProto);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('30');
    expect(result.timeFilter).toBe('1h');
  });

  it('should handle frozen object', () => {
    const frozenState = Object.freeze({
      selectedStatuses: ['ready', 'open'],
      showRecentlyClosed: true,
      recentlyClosedDuration: '90',
      timeFilter: '12h'
    });

    mockContext.workspaceState.get.mockReturnValue(frozenState);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready', 'open']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('90');
    expect(result.timeFilter).toBe('12h');
  });

  it('should handle sealed object', () => {
    const sealedState = Object.seal({
      selectedStatuses: ['closed'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: 'all'
    });

    mockContext.workspaceState.get.mockReturnValue(sealedState);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['closed']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all');
  });

  it('should handle object with non-enumerable properties', () => {
    const objWithNonEnum = {};
    Object.defineProperty(objWithNonEnum, 'selectedStatuses', {
      value: ['ready'],
      enumerable: false
    });
    Object.defineProperty(objWithNonEnum, 'showRecentlyClosed', {
      value: true,
      enumerable: true
    });
    Object.defineProperty(objWithNonEnum, 'recentlyClosedDuration', {
      value: '45',
      enumerable: true
    });
    Object.defineProperty(objWithNonEnum, 'timeFilter', {
      value: '6h',
      enumerable: true
    });

    mockContext.workspaceState.get.mockReturnValue(objWithNonEnum);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']); // Non-enumerable properties are still accessible by direct access
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('45');
    expect(result.timeFilter).toBe('6h');
  });

  it('should handle object with getter properties', () => {
    const objWithGetter = {};
    let callCount = 0;
    Object.defineProperty(objWithGetter, 'selectedStatuses', {
      get() {
        callCount++;
        return ['ready'];
      },
      enumerable: true
    });
    Object.defineProperty(objWithGetter, 'showRecentlyClosed', {
      get() {
        callCount++;
        return false;
      },
      enumerable: true
    });
    Object.defineProperty(objWithGetter, 'recentlyClosedDuration', {
      get() {
        callCount++;
        return '60';
      },
      enumerable: true
    });
    Object.defineProperty(objWithGetter, 'timeFilter', {
      get() {
        callCount++;
        return '24h';
      },
      enumerable: true
    });

    mockContext.workspaceState.get.mockReturnValue(objWithGetter);

    const result = loadFilterState(mockContext);

    // Verify getters work correctly by checking the result values
    expect(callCount).toBeGreaterThan(0); // Getters are called during validation and assignment
    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('24h');
  });

  it('should handle object with setter properties', () => {
    const objWithSetter = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: true,
      recentlyClosedDuration: '30',
      timeFilter: '1h'
    };

    let setterCalled = false;
    Object.defineProperty(objWithSetter, 'extraProp', {
      set(value) {
        setterCalled = true;
      },
      enumerable: true
    });

    mockContext.workspaceState.get.mockReturnValue(objWithSetter);

    const result = loadFilterState(mockContext);

    expect(setterCalled).toBe(false); // Setter should not be called during reading
    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('30');
    expect(result.timeFilter).toBe('1h');
  });

  it('should handle circular reference objects', () => {
    const circularObj: any = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: 'all'
    };
    circularObj.self = circularObj; // Create circular reference

    mockContext.workspaceState.get.mockReturnValue(circularObj);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all');
  });

  it('should handle Date object for timeFilter', () => {
    const dateObj = new Date();
    const stateWithDate = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: true,
      recentlyClosedDuration: '60',
      timeFilter: dateObj // Date object instead of string
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithDate);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all'); // Falls back to default (Date is not a string)
  });

  it('should handle RegExp object for timeFilter', () => {
    const regexObj = /24h/;
    const stateWithRegex = {
      selectedStatuses: ['open'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '90',
      timeFilter: regexObj // RegExp object instead of string
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithRegex);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['open']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('90');
    expect(result.timeFilter).toBe('all'); // Falls back to default (RegExp is not a string)
  });

  it('should handle Symbol for timeFilter', () => {
    const symbolValue = Symbol('24h');
    const stateWithSymbol = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: true,
      recentlyClosedDuration: '45',
      timeFilter: symbolValue // Symbol instead of string
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithSymbol);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('45');
    expect(result.timeFilter).toBe('all'); // Falls back to default (Symbol is not a string)
  });

  it('should handle BigInt for recentlyClosedDuration', () => {
    const bigintValue = 60n;
    const stateWithBigInt = {
      selectedStatuses: ['closed'],
      showRecentlyClosed: false,
      recentlyClosedDuration: bigintValue, // BigInt instead of string
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithBigInt);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['closed']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('60'); // Falls back to default (BigInt is not a string)
    expect(result.timeFilter).toBe('all');
  });

  it('should handle NaN for showRecentlyClosed', () => {
    const stateWithNaN = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: NaN, // NaN instead of boolean
      recentlyClosedDuration: '60',
      timeFilter: '24h'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithNaN);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(false); // Falls back to default (NaN is not boolean)
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('24h');
  });

  it('should handle Infinity for recentlyClosedDuration', () => {
    const stateWithInfinity = {
      selectedStatuses: ['open'],
      showRecentlyClosed: true,
      recentlyClosedDuration: Infinity, // Infinity instead of string
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithInfinity);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['open']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('60'); // Falls back to default (Infinity is not a string)
    expect(result.timeFilter).toBe('all');
  });

  it('should handle -Infinity for timeFilter', () => {
    const stateWithNegInfinity = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '30',
      timeFilter: -Infinity // -Infinity instead of string
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithNegInfinity);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('30');
    expect(result.timeFilter).toBe('all'); // Falls back to default (-Infinity is not a string)
  });

  it('should handle function for selectedStatuses', () => {
    const func = () => ['ready'];
    const stateWithFunction = {
      selectedStatuses: func, // Function instead of array
      showRecentlyClosed: true,
      recentlyClosedDuration: '60',
      timeFilter: '24h'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithFunction);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready', 'open', 'in_progress']); // Falls back to default (function is not array)
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('24h');
  });

  it('should handle Map for selectedStatuses', () => {
    const map = new Map([['status', 'ready']]);
    const stateWithMap = {
      selectedStatuses: map, // Map instead of array
      showRecentlyClosed: false,
      recentlyClosedDuration: '90',
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithMap);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready', 'open', 'in_progress']); // Falls back to default (Map is not array)
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('90');
    expect(result.timeFilter).toBe('all');
  });

  it('should handle Set for selectedStatuses', () => {
    const set = new Set(['ready', 'open']);
    const stateWithSet = {
      selectedStatuses: set, // Set instead of array
      showRecentlyClosed: true,
      recentlyClosedDuration: '45',
      timeFilter: '12h'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithSet);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready', 'open', 'in_progress']); // Falls back to default (Set is not array)
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('45');
    expect(result.timeFilter).toBe('12h');
  });

  it('should handle WeakMap for timeFilter', () => {
    const weakMap = new WeakMap();
    const stateWithWeakMap = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: weakMap // WeakMap instead of string
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithWeakMap);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all'); // Falls back to default (WeakMap is not string)
  });

  it('should handle WeakSet for showRecentlyClosed', () => {
    const weakSet = new WeakSet();
    const stateWithWeakSet = {
      selectedStatuses: ['open'],
      showRecentlyClosed: weakSet, // WeakSet instead of boolean
      recentlyClosedDuration: '30',
      timeFilter: '6h'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithWeakSet);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['open']);
    expect(result.showRecentlyClosed).toBe(false); // Falls back to default (WeakSet is not boolean)
    expect(result.recentlyClosedDuration).toBe('30');
    expect(result.timeFilter).toBe('6h');
  });

  it('should handle Promise for recentlyClosedDuration', () => {
    const promise = Promise.resolve('60');
    const stateWithPromise = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: true,
      recentlyClosedDuration: promise, // Promise instead of string
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithPromise);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('60'); // Falls back to default (Promise is not string)
    expect(result.timeFilter).toBe('all');
  });

  it('should handle Error object for timeFilter', () => {
    const error = new Error('test error');
    const stateWithError = {
      selectedStatuses: ['closed'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '120',
      timeFilter: error // Error instead of string
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithError);

    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['closed']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('120');
    expect(result.timeFilter).toBe('all'); // Falls back to default (Error is not string)
  });

  // Edge case tests for security and error handling
  it('should handle getter that throws error', () => {
    const objWithThrowingGetter = {};
    Object.defineProperty(objWithThrowingGetter, 'selectedStatuses', {
      get() {
        throw new Error('Getter error');
      },
      enumerable: true
    });

    mockContext.workspaceState.get.mockReturnValue(objWithThrowingGetter);

    // Should not throw and should return defaults
    const result = loadFilterState(mockContext);

    expect(result).toEqual({
      selectedStatuses: ['ready', 'open', 'in_progress'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: 'all'
    });
  });

  it('should ignore __proto__ property to prevent prototype pollution', () => {
    const maliciousState = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: true,
      recentlyClosedDuration: '60',
      timeFilter: 'all',
      '__proto__': { polluted: true }
    };

    mockContext.workspaceState.get.mockReturnValue(maliciousState);

    const result = loadFilterState(mockContext);

    // Should ignore __proto__ and return valid state
    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all');
    
    // Verify prototype pollution didn't occur
    expect((Object.prototype as any).polluted).toBeUndefined();
  });

  it('should ignore constructor property to prevent prototype pollution', () => {
    const maliciousState = {
      selectedStatuses: ['open'],
      showRecentlyClosed: false,
      recentlyClosedDuration: '30',
      timeFilter: '24h',
      'constructor': { prototype: { polluted: true } }
    };

    mockContext.workspaceState.get.mockReturnValue(maliciousState);

    const result = loadFilterState(mockContext);

    // Should ignore constructor and return valid state
    expect(result.selectedStatuses).toEqual(['open']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('30');
    expect(result.timeFilter).toBe('24h');
  });

  it('should ignore prototype property to prevent prototype pollution', () => {
    const maliciousState = {
      selectedStatuses: ['ready', 'open'],
      showRecentlyClosed: true,
      recentlyClosedDuration: '90',
      timeFilter: '12h',
      'prototype': { polluted: true }
    };

    mockContext.workspaceState.get.mockReturnValue(maliciousState);

    const result = loadFilterState(mockContext);

    // Should ignore prototype and return valid state
    expect(result.selectedStatuses).toEqual(['ready', 'open']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('90');
    expect(result.timeFilter).toBe('12h');
  });

  it('should handle deeply nested circular reference in selectedStatuses array', () => {
    const circularArray: any[] = ['ready'];
    circularArray.push(circularArray); // Circular reference within array

    const stateWithCircularArray = {
      selectedStatuses: circularArray,
      showRecentlyClosed: false,
      recentlyClosedDuration: '60',
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithCircularArray);

    // Should fall back to defaults due to validation failure (array contains non-string)
    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready', 'open', 'in_progress']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all');
  });

  it('should handle object with toString that throws error', () => {
    const objWithBadToString = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: true,
      recentlyClosedDuration: '45',
      timeFilter: {
        toString() {
          throw new Error('toString error');
        }
      }
    };

    mockContext.workspaceState.get.mockReturnValue(objWithBadToString);

    // Should fall back to default for timeFilter
    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('45');
    expect(result.timeFilter).toBe('all');
  });

  it('should handle very deeply nested object structure', () => {
    let deepObj: any = { value: 'leaf' };
    // Create deep nesting (1000 levels)
    for (let i = 0; i < 1000; i++) {
      deepObj = { nested: deepObj };
    }

    const stateWithDeepNesting = {
      selectedStatuses: ['open'],
      showRecentlyClosed: true,
      recentlyClosedDuration: '120',
      timeFilter: deepObj // Very deeply nested object instead of string
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithDeepNesting);

    // Should fall back to default for timeFilter (not a string)
    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['open']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('120');
    expect(result.timeFilter).toBe('all');
  });

  it('should handle Symbol values', () => {
    const stateWithSymbol = {
      selectedStatuses: ['ready'],
      showRecentlyClosed: true,
      recentlyClosedDuration: Symbol('duration'), // Symbol instead of string
      timeFilter: 'all'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithSymbol);

    // Should fall back to default for recentlyClosedDuration
    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['ready']);
    expect(result.showRecentlyClosed).toBe(true);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('all');
  });

  it('should handle BigInt values', () => {
    const stateWithBigInt = {
      selectedStatuses: ['open'],
      showRecentlyClosed: false,
      recentlyClosedDuration: BigInt(60), // BigInt instead of string
      timeFilter: '24h'
    };

    mockContext.workspaceState.get.mockReturnValue(stateWithBigInt);

    // Should fall back to default for recentlyClosedDuration
    const result = loadFilterState(mockContext);

    expect(result.selectedStatuses).toEqual(['open']);
    expect(result.showRecentlyClosed).toBe(false);
    expect(result.recentlyClosedDuration).toBe('60');
    expect(result.timeFilter).toBe('24h');
  });
});
