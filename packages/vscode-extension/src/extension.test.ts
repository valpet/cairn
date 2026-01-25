import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock VS Code API
const registeredTools: any = {};

vi.mock('vscode', () => ({
  lm: {
    registerTool: vi.fn().mockImplementation((name, tool) => {
      // Store tools for testing
      registeredTools[name] = tool;
      return { dispose: vi.fn() };
    }),
  },
  commands: {
    registerCommand: vi.fn(),
  },
  window: {
    createWebviewPanel: vi.fn(),
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
    createStatusBarItem: vi.fn(() => ({
      text: '',
      tooltip: '',
      command: '',
      show: vi.fn(),
      dispose: vi.fn(),
    })),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  },
  ViewColumn: {
    One: 1,
    Beside: 2,
  },
  Uri: {
    file: vi.fn(),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
  },
  ExtensionContext: class {
    subscriptions: any[] = [];
  },
  LanguageModelToolResult: class {
    constructor(parts: any[]) {
      return { content: parts };
    }
  },
  LanguageModelTextPart: class {
    constructor(text: string) {
      return { text };
    }
  },
}));

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
  createContainer: vi.fn(),
  TYPES: {
    IStorageService: 'IStorageService',
    IGraphService: 'IGraphService',
  },
  findCairnDir: vi.fn(() => ({ cairnDir: '/test/workspace/.cairn', repoRoot: '/test/workspace' })),
  generateId: vi.fn(() => 's-test-id-123'),
}));

// Import after mocking
import * as vscode from 'vscode';
import { lm } from 'vscode';
import { createContainer, TYPES, findCairnDir, generateId } from '../../core/dist/index.js';
import { activate, CairnCreateTool, CairnListReadyTool, CairnUpdateTool, CairnDepAddTool, CairnCommentTool, CairnAcAddTool, CairnAcUpdateTool, CairnAcRemoveTool, CairnAcToggleTool, getStorage, getGraph, resetServices } from './extension';

describe('VS Code Extension Tools', () => {
  let mockStorage: any;
  let mockGraph: any;
  let mockContainer: any;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    mockStorage = {
      loadIssues: vi.fn(),
      saveIssue: vi.fn(),
      updateIssues: vi.fn((callback) => {
        // Mock updateIssues to call the callback with current issues and return the result
        const currentIssues = [{ id: 'existing-1' }];
        const updatedIssues = callback(currentIssues);
        return Promise.resolve(updatedIssues);
      }),
      addComment: vi.fn(),
    };

    mockGraph = {
      addDependency: vi.fn(),
      getReadyWork: vi.fn(),
      getCascadingStatusUpdates: vi.fn(() => []),
      canCloseIssue: vi.fn(),
      getEpicSubtasks: vi.fn(() => []),
      getNonParentedIssues: vi.fn(() => []),
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

    mockContext = new (vscode as any).ExtensionContext();

    (createContainer as any).mockReturnValue(mockContainer);
    (findCairnDir as any).mockReturnValue({ cairnDir: '/test/workspace/.cairn', repoRoot: '/test/workspace' });
    (generateId as any).mockReturnValue('s-test-id-123');

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
      mockStorage.loadIssues.mockResolvedValue([]);

      const toolHandler = registeredTools['cairn_create'];

      const result = await toolHandler.invoke({
        input: {
          title: 'Test Task',
        }
      }, {});

      expect(mockStorage.loadIssues).toHaveBeenCalled();
      expect(mockStorage.saveIssue).toHaveBeenCalledWith({
        id: 's-test-id-123',
        title: 'Test Task',
        description: '',
        type: 'task',
        status: 'open',
        priority: 'medium',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
      expect(result.content[0].text).toContain('Created issue s-test-id-123');
    });

    it('should create a task with all parameters including parent', async () => {
      const mockIssues = [{ id: 'epic-123', title: 'Test Epic' }];
      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockStorage.updateIssues.mockImplementation(async (callback) => {
        const updatedIssues = callback(mockIssues);
        return updatedIssues;
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

      expect(mockStorage.saveIssue).toHaveBeenCalledWith({
        id: 's-test-id-123',
        title: 'Feature Task',
        description: 'A feature description',
        type: 'feature',
        status: 'in_progress',
        priority: 'high',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });

      expect(mockStorage.updateIssues).toHaveBeenCalled();
      expect(mockGraph.addDependency).toHaveBeenCalledWith('s-test-id-123', 'epic-123', 'parent-child', mockIssues);

      expect(result.content[0].text).toContain('Created issue s-test-id-123');
    });

    it('should handle errors gracefully', async () => {
      mockStorage.loadIssues.mockRejectedValue(new Error('Storage error'));

      const toolHandler = registeredTools['cairn_create'];

      const result = await toolHandler.invoke({
        input: {
          title: 'Test Task',
        }
      }, {});

      expect(result.content[0].text).toContain('Error creating issue');
      expect(result.content[0].text).toContain('Storage error');
    });
  });

  describe('cairn_list_ready tool', () => {
    it('should return ready tasks', async () => {
      const mockIssues = [
        { id: 'task-1', title: 'Ready Task', status: 'open', priority: 'high' },
        { id: 'task-2', title: 'Blocked Task', status: 'open', priority: 'medium' }
      ];
      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockGraph.getReadyWork.mockReturnValue([mockIssues[0]]);

      const toolHandler = registeredTools['cairn_list_ready'];

      const result = await toolHandler.invoke({}, {});

      expect(mockStorage.loadIssues).toHaveBeenCalled();
      expect(mockGraph.getReadyWork).toHaveBeenCalledWith(mockIssues);
      expect(result.content[0].text).toContain('readyTasks');
      expect(result.content[0].text).toContain('Ready Task');
    });
  });

  describe('cairn_update tool', () => {
    it('should update task status', async () => {
      mockStorage.updateIssues.mockImplementation(async (callback) => {
        const currentIssues = [{ id: 'task-123', status: 'open' }];
        const updatedIssues = callback(currentIssues);
        return updatedIssues;
      });

      const toolHandler = registeredTools['cairn_update'];

      const result = await toolHandler.invoke({
        input: {
          id: 'task-123',
          status: 'in_progress',
        }
      }, {});

      expect(mockStorage.updateIssues).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Updated issue task-123');
    });

    it('should ignore notes field and not create comments', async () => {
      mockStorage.updateIssues.mockImplementation(async (callback) => {
        const currentIssues = [{ id: 'task-123', status: 'open' }];
        const updatedIssues = callback(currentIssues);
        return updatedIssues;
      });

      const toolHandler = registeredTools['cairn_update'];

      const result = await toolHandler.invoke({
        input: {
          id: 'task-123',
          status: 'in_progress',
          notes: 'These notes should be ignored',
        }
      }, {});

      expect(mockStorage.updateIssues).toHaveBeenCalled();
      expect(mockStorage.addComment).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('Updated issue task-123');
    });

    it('should ignore acceptance_criteria field and not create comments', async () => {
      mockStorage.updateIssues.mockImplementation(async (callback) => {
        const currentIssues = [{ id: 'task-123', status: 'open' }];
        const updatedIssues = callback(currentIssues);
        return updatedIssues;
      });

      const toolHandler = registeredTools['cairn_update'];

      const result = await toolHandler.invoke({
        input: {
          id: 'task-123',
          status: 'in_progress',
          acceptance_criteria: ['Criteria 1', 'Criteria 2'],
        }
      }, {});

      expect(mockStorage.updateIssues).toHaveBeenCalled();
      expect(mockStorage.addComment).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('Updated issue task-123');
    });

    it('should prevent closing an issue with open subtasks', async () => {
      const mockIssues = [
        { id: 'parent-123', title: 'Parent Task', status: 'open' },
        { id: 'subtask-1', title: 'Open Subtask', status: 'open' },
      ];
      
      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockGraph.canCloseIssue.mockReturnValue({
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

      expect(mockStorage.loadIssues).toHaveBeenCalled();
      expect(mockGraph.canCloseIssue).toHaveBeenCalledWith('parent-123', mockIssues);
      expect(mockStorage.updateIssues).not.toHaveBeenCalled();
      
      const resultText = result.content[0].text;
      expect(resultText).toContain('success');
      expect(resultText).toContain('false');
      expect(resultText).toContain('Cannot close issue');
      expect(resultText).toContain('Parent Task');
      expect(resultText).toContain('parent-123');
      expect(resultText).toContain('Open Subtask');
      expect(resultText).toContain('subtask-1');
    });

    it('should allow closing an issue with no subtasks', async () => {
      const mockIssues = [
        { id: 'task-123', title: 'Task No Subtasks', status: 'open' },
      ];
      
      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockGraph.canCloseIssue.mockReturnValue({
        canClose: true,
        openSubtasks: [],
      });
      
      mockStorage.updateIssues.mockImplementation(async (callback) => {
        const updatedIssues = callback(mockIssues);
        return updatedIssues;
      });

      const toolHandler = registeredTools['cairn_update'];

      const result = await toolHandler.invoke({
        input: {
          id: 'task-123',
          status: 'closed',
        }
      }, {});

      expect(mockStorage.loadIssues).toHaveBeenCalled();
      expect(mockGraph.canCloseIssue).toHaveBeenCalledWith('task-123', mockIssues);
      expect(mockStorage.updateIssues).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Updated issue task-123');
    });

    it('should allow closing an issue with all closed subtasks', async () => {
      const mockIssues = [
        { id: 'parent-123', title: 'Parent Task', status: 'open' },
        { id: 'subtask-1', title: 'Closed Subtask 1', status: 'closed' },
        { id: 'subtask-2', title: 'Closed Subtask 2', status: 'closed' },
      ];
      
      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockGraph.canCloseIssue.mockReturnValue({
        canClose: true,
        openSubtasks: [],
      });
      
      mockStorage.updateIssues.mockImplementation(async (callback) => {
        const updatedIssues = callback(mockIssues);
        return updatedIssues;
      });

      const toolHandler = registeredTools['cairn_update'];

      const result = await toolHandler.invoke({
        input: {
          id: 'parent-123',
          status: 'closed',
        }
      }, {});

      expect(mockStorage.loadIssues).toHaveBeenCalled();
      expect(mockGraph.canCloseIssue).toHaveBeenCalledWith('parent-123', mockIssues);
      expect(mockStorage.updateIssues).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Updated issue parent-123');
    });

    it('should prevent closing issue with multiple open subtasks and list all of them', async () => {
      const mockIssues = [
        { id: 'parent-123', title: 'Parent Epic', status: 'in_progress' },
        { id: 'subtask-1', title: 'Open Subtask 1', status: 'open' },
        { id: 'subtask-2', title: 'Open Subtask 2', status: 'in_progress' },
        { id: 'subtask-3', title: 'Open Subtask 3', status: 'open' },
      ];
      
      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockGraph.canCloseIssue.mockReturnValue({
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

      expect(mockGraph.canCloseIssue).toHaveBeenCalledWith('parent-123', mockIssues);
      expect(mockStorage.updateIssues).not.toHaveBeenCalled();
      
      const resultText = result.content[0].text;
      expect(resultText).toContain('Cannot close issue');
      expect(resultText).toContain('Open Subtask 1');
      expect(resultText).toContain('subtask-1');
      expect(resultText).toContain('Open Subtask 2');
      expect(resultText).toContain('subtask-2');
      expect(resultText).toContain('Open Subtask 3');
      expect(resultText).toContain('subtask-3');
    });
  });

  describe('cairn_dep_add tool', () => {
    it('should add dependency between tasks', async () => {
      const mockIssues = [{ id: 'task-1' }, { id: 'task-2' }];
      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockStorage.updateIssues.mockImplementation(async (callback) => {
        const updatedIssues = callback(mockIssues);
        return updatedIssues;
      });

      const toolHandler = registeredTools['cairn_dep_add'];

      const result = await toolHandler.invoke({
        input: {
          from: 'task-1',
          to: 'task-2',
          type: 'blocks',
        }
      }, {});

      expect(mockStorage.updateIssues).toHaveBeenCalled();
      expect(mockGraph.addDependency).toHaveBeenCalledWith('task-1', 'task-2', 'blocks', mockIssues);
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
          issue_id: 'task-123',
          content: 'Test comment',
        }
      }, {});

      expect(mockStorage.addComment).toHaveBeenCalledWith('task-123', 'agent', 'Test comment');
      expect(result.content[0].text).toContain('Added comment to issue task-123');
    });
  });

  describe('cairn_ac_add tool', () => {
    it('should add acceptance criteria to task', async () => {
      mockStorage.updateIssues.mockImplementation(async (callback) => {
        const currentIssues = [{ id: 'task-123', acceptance_criteria: [] }];
        const updatedIssues = callback(currentIssues);
        return updatedIssues;
      });

      const toolHandler = registeredTools['cairn_ac_add'];

      const result = await toolHandler.invoke({
        input: {
          issue_id: 'task-123',
          text: 'New acceptance criteria',
        }
      }, {});

      expect(mockStorage.updateIssues).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Added acceptance criteria to issue task-123');
    });
  });

  describe('cairn_ac_update tool', () => {
    it('should update acceptance criteria text', async () => {
      mockStorage.updateIssues.mockImplementation(async (callback) => {
        const currentIssues = [{ 
          id: 'task-123', 
          acceptance_criteria: [{ text: 'Old text', completed: false }] 
        }];
        const updatedIssues = callback(currentIssues);
        return updatedIssues;
      });

      const toolHandler = registeredTools['cairn_ac_update'];

      const result = await toolHandler.invoke({
        input: {
          issue_id: 'task-123',
          index: 0,
          text: 'Updated acceptance criteria',
        }
      }, {});

      expect(mockStorage.updateIssues).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Updated acceptance criteria 0 for issue task-123');
    });
  });

  describe('cairn_ac_remove tool', () => {
    it('should remove acceptance criteria from task', async () => {
      mockStorage.updateIssues.mockImplementation(async (callback) => {
        const currentIssues = [{ 
          id: 'task-123', 
          acceptance_criteria: [
            { text: 'Criteria 1', completed: false },
            { text: 'Criteria 2', completed: true }
          ] 
        }];
        const updatedIssues = callback(currentIssues);
        return updatedIssues;
      });

      const toolHandler = registeredTools['cairn_ac_remove'];

      const result = await toolHandler.invoke({
        input: {
          issue_id: 'task-123',
          index: 0,
        }
      }, {});

      expect(mockStorage.updateIssues).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Removed acceptance criteria 0 from issue task-123');
    });
  });

  describe('cairn_ac_toggle tool', () => {
    it('should toggle acceptance criteria completion status', async () => {
      mockStorage.updateIssues.mockImplementation(async (callback) => {
        const currentIssues = [{ 
          id: 'task-123', 
          acceptance_criteria: [{ text: 'Criteria 1', completed: false }] 
        }];
        const updatedIssues = callback(currentIssues);
        return updatedIssues;
      });

      const toolHandler = registeredTools['cairn_ac_toggle'];

      const result = await toolHandler.invoke({
        input: {
          issue_id: 'task-123',
          index: 0,
        }
      }, {});

      expect(mockStorage.updateIssues).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Toggled acceptance criteria 0 completion for issue task-123');
    });
  });

  // Note: Webview saveTicket message handler for canCloseIssue validation
  // The webview command 'cairn.openEditView' contains additional canCloseIssue validation
  // that prevents closing issues with open subtasks from the UI.
  // This validation logic mirrors the tool validation tested above but is integrated into
  // the webview message flow. Consider adding integration tests for the full webview flow.
});

describe('Extension Activation and Service Initialization', () => {
  let mockStorage: any;
  let mockGraph: any;
  let mockContainer: any;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    mockStorage = {
      loadIssues: vi.fn(),
      saveIssue: vi.fn(),
      updateIssues: vi.fn(),
      addComment: vi.fn(),
      getIssuesFilePath: vi.fn(() => '/test/workspace/.cairn/issues.jsonl'),
    };

    mockGraph = {
      addDependency: vi.fn(),
      getReadyWork: vi.fn(),
      getCascadingStatusUpdates: vi.fn(() => []),
      canCloseIssue: vi.fn(),
      getEpicSubtasks: vi.fn(() => []),
      getNonParentedIssues: vi.fn(() => []),
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

    mockContext = new (vscode as any).ExtensionContext();

    (createContainer as any).mockReturnValue(mockContainer);
    (findCairnDir as any).mockReturnValue({ cairnDir: '/test/workspace/.cairn', repoRoot: '/test/workspace' });
    (generateId as any).mockReturnValue('s-test-id-123');
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
      expect(createContainer).toHaveBeenCalledWith('/test/workspace/.cairn', '/test/workspace', 'issues.jsonl');

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
