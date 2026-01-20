import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock VS Code API
vi.mock('vscode', () => ({
  lm: {
    registerTool: vi.fn(),
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
  LanguageModelToolResult: vi.fn((parts) => ({ content: parts })),
  LanguageModelTextPart: vi.fn((text) => ({ text })),
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
import { lm, ExtensionContext } from 'vscode';
import { createContainer, TYPES, findCairnDir, generateId } from '../../core/dist/index.js';
import { activate } from './extension';

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

    mockContext = new ExtensionContext();

    (createContainer as any).mockReturnValue(mockContainer);
    (findCairnDir as any).mockReturnValue({ cairnDir: '/test/workspace/.cairn', repoRoot: '/test/workspace' });
    (generateId as any).mockReturnValue('s-test-id-123');

    // Activate the extension to register tools
    activate(mockContext);
  });

  describe('cairn_create tool', () => {
    it('should create a task with minimal parameters', async () => {
      mockStorage.loadIssues.mockResolvedValue([]);

      const registerToolMock = lm.registerTool as any;
      const toolRegistration = registerToolMock.mock.calls.find(call => call[0] === 'cairn_create');
      const toolHandler = toolRegistration[1].invoke;

      const result = await toolHandler({
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

      const registerToolMock = lm.registerTool as any;
      const toolRegistration = registerToolMock.mock.calls.find(call => call[0] === 'cairn_create');
      const toolHandler = toolRegistration[1].invoke;

      const result = await toolHandler({
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

      const registerToolMock = lm.registerTool as any;
      const toolRegistration = registerToolMock.mock.calls.find(call => call[0] === 'cairn_create');
      const toolHandler = toolRegistration[1].invoke;

      const result = await toolHandler({
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

      const registerToolMock = lm.registerTool as any;
      const toolRegistration = registerToolMock.mock.calls.find(call => call[0] === 'cairn_list_ready');
      const toolHandler = toolRegistration[1].invoke;

      const result = await toolHandler({}, {});

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

      const registerToolMock = lm.registerTool as any;
      const toolRegistration = registerToolMock.mock.calls.find(call => call[0] === 'cairn_update');
      const toolHandler = toolRegistration[1].invoke;

      const result = await toolHandler({
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

      const registerToolMock = lm.registerTool as any;
      const toolRegistration = registerToolMock.mock.calls.find(call => call[0] === 'cairn_update');
      const toolHandler = toolRegistration[1].invoke;

      const result = await toolHandler({
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

      const registerToolMock = lm.registerTool as any;
      const toolRegistration = registerToolMock.mock.calls.find(call => call[0] === 'cairn_update');
      const toolHandler = toolRegistration[1].invoke;

      const result = await toolHandler({
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
  });

  describe('cairn_dep_add tool', () => {
    it('should add dependency between tasks', async () => {
      const mockIssues = [{ id: 'task-1' }, { id: 'task-2' }];
      mockStorage.loadIssues.mockResolvedValue(mockIssues);
      mockStorage.updateIssues.mockImplementation(async (callback) => {
        const updatedIssues = callback(mockIssues);
        return updatedIssues;
      });

      const registerToolMock = lm.registerTool as any;
      const toolRegistration = registerToolMock.mock.calls.find(call => call[0] === 'cairn_dep_add');
      const toolHandler = toolRegistration[1].invoke;

      const result = await toolHandler({
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

      const registerToolMock = lm.registerTool as any;
      const toolRegistration = registerToolMock.mock.calls.find(call => call[0] === 'cairn_comment');
      const toolHandler = toolRegistration[1].invoke;

      const result = await toolHandler({
        input: {
          issue_id: 'task-123',
          content: 'Test comment',
        }
      }, {});

      expect(mockStorage.addComment).toHaveBeenCalledWith('task-123', 'agent', 'Test comment');
      expect(result.content[0].text).toContain('Added comment to issue task-123');
    });
  });
});