import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { createContainer, TYPES, IStorageService, IGraphService, Container, AcceptanceCriteria, Task, Dependency, findCairnDir, generateId, validateTask } from '../../core/dist/index.js';

let container: Container | undefined;
let storage: IStorageService | undefined;
let graph: IGraphService | undefined;
let outputChannel: vscode.OutputChannel | undefined;
let cairnDir: string | undefined;
let repoRoot: string | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let configWatcher: vscode.FileSystemWatcher | undefined;
let lastKnownActiveFile: string = 'default';
let internalChangeCount: number = 0;
let lastInternalWriteTime: number = 0;
let taskListPanels: Map<vscode.WebviewPanel, () => Promise<void>> = new Map();

export function getStorage(): IStorageService {
  if (!storage) {
    throw new Error('Storage service has not been initialized yet. Ensure activate() has been called before using this service.');
  }
  return storage;
}

export function getGraph(): IGraphService {
  if (!graph) {
    throw new Error('Graph service has not been initialized yet. Ensure activate() has been called before using this service.');
  }
  return graph;
}

/**
 * Resets all extension-level services and state to an uninitialized state.
 *
 * This function is intended for automated testing only and must not be used
 * in production or normal extension runtime code.
 */
export function resetServices() {
  container = undefined;
  storage = undefined;
  graph = undefined;
  outputChannel = undefined;
  cairnDir = undefined;
  repoRoot = undefined;
  statusBarItem = undefined;
  configWatcher = undefined;
  lastKnownActiveFile = 'default';
  internalChangeCount = 0;
  lastInternalWriteTime = 0;
  taskListPanels.clear();
}

// Config file management
interface CairnConfig {
  activeFile: string;
}

function getConfigPath(cairnDir: string): string {
  return path.join(cairnDir, 'config.json');
}

function readConfig(cairnDir: string): CairnConfig {
  const configPath = getConfigPath(cairnDir);
  if (!fs.existsSync(configPath)) {
    return { activeFile: 'default' };
  }
  try {
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { activeFile: 'default' };
  }
}

// NOTE: The logical name "default" is special: it always maps to "tasks.jsonl",
// which is the canonical / historical default tasks file for a Cairn workspace.
// To avoid ambiguity and file collisions, the logical name "tasks" is effectively
// reserved and must not be used by callers, because it would also map to
// "tasks.jsonl". This ensures we never have both a "default" mapping and a
// user-named "tasks" file attempting to coexist in the same directory.
/**
 * Converts a logical task file name to its actual filename.
 *
 * @param name - The logical name of the task file (e.g., 'default', 'feature-auth')
 * @returns The actual filename (e.g., 'tasks.jsonl', 'feature-auth.jsonl')
 *
 * @remarks
 * The logical name "default" is special: it always maps to "tasks.jsonl",
 * which is the canonical/historical default tasks file for a Cairn workspace.
 *
 * To avoid ambiguity and file collisions, the logical name "tasks" is effectively
 * reserved and must not be used by callers, because it would also map to
 * "tasks.jsonl". This ensures we never have both a "default" mapping and a
 * user-named "tasks" file attempting to coexist in the same directory.
 */
function getTaskFileName(name: string): string {
  return name === 'default' ? 'tasks.jsonl' : `${name}.jsonl`;
}

function writeConfig(cairnDir: string, config: CairnConfig): void {
  const configPath = getConfigPath(cairnDir);
  internalChangeCount++;
  lastInternalWriteTime = Date.now();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  // File watcher will ignore changes for a short time after internal writes
}

function truncateTitle(title: string, id: string): string {
  const maxTitleLength = 50;
  const truncatedTitle = title.length > maxTitleLength ? title.substring(0, maxTitleLength) + '...' : title;
  return `${truncatedTitle} (${id})`;
}

function getAvailableTaskFiles(cairnDir: string): string[] {
  return fs.readdirSync(cairnDir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => f.replace('.jsonl', ''))
    .map(f => f === 'tasks' ? 'default' : f)
    .sort((a, b) => {
      if (a === 'default') return -1;
      if (b === 'default') return 1;
      return a.localeCompare(b);
    });
}

function reinitializeServices(tasksFileName: string) {
  outputChannel!.appendLine(`Reinitializing services with file: ${tasksFileName}`);
  container = createContainer(cairnDir!, repoRoot!, tasksFileName);
  storage = container.get(TYPES.IStorageService);
  graph = container.get(TYPES.IGraphService);
  outputChannel!.appendLine('Services reinitialized successfully');
}

function updateStatusBar(activeFile: string) {
  statusBarItem!.text = `$(file) Cairn: ${activeFile}`;
  statusBarItem!.tooltip = `Current task file: ${getTaskFileName(activeFile)}\nClick to switch files`;
}

// Webview interfaces
interface WebviewDependency {
  id: string;
  title: string;
  type?: string;
  status: string;
  priority?: string;
  direction: 'blocked_by' | 'blocks';
  completion_percentage?: number | null;
}
interface CreateToolInput {
  title: string;
  description?: string;
  type?: string;
  status?: string;
  priority?: string;
  parent?: string;
}

interface ListReadyToolInput {
  // No inputs required
}

interface UpdateToolInput {
  id: string;
  status?: string;
  title?: string;
  description?: string;
  type?: string;
  priority?: string;
  assignee?: string;
  labels?: string[];
  acceptance_criteria?: AcceptanceCriteria[];
}

interface DepAddToolInput {
  from: string;
  to: string;
  type: string;
}

interface CommentToolInput {
  task_id: string;
  author?: string;
  content: string;
}

interface AcAddToolInput {
  task_id: string;
  text: string;
}

interface AcUpdateToolInput {
  task_id: string;
  index: number;
  text: string;
}

interface AcRemoveToolInput {
  task_id: string;
  index: number;
}

interface AcToggleToolInput {
  task_id: string;
  index: number;
}

// Tool implementations
export class CairnCreateTool implements vscode.LanguageModelTool<CreateToolInput> {
  constructor(private storageService: IStorageService, private graphService: IGraphService) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<CreateToolInput>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: `Creating task: ${options.input.title}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<CreateToolInput>,
    _token: vscode.CancellationToken
  ) {
    try {
      const inputs = options.input;
      const tasks = await this.storageService.loadTasks();
      const id = generateId(tasks);
      const task = {
        id,
        title: inputs.title,
        description: inputs.description || '',
        type: inputs.type || 'task',
        status: inputs.status || 'open',
        priority: inputs.priority || 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await this.storageService.saveTask(task);

      if (inputs.parent) {
        await this.storageService.updateTasks(tasks => {
          return this.graphService.addDependency(id, inputs.parent, 'parent-child', tasks);
        });
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: true, message: `Created task ${id}: ${inputs.title}`, id }))
      ]);
    } catch (error) {
      const err = error as Error;
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: false, message: `Error creating task: ${err.message}` }))
      ]);
    }
  }
}

export class CairnListReadyTool implements vscode.LanguageModelTool<ListReadyToolInput> {
  constructor(private storageService: IStorageService, private graphService: IGraphService) {}

  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<ListReadyToolInput>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: 'Listing ready tasks',
    };
  }

  async invoke(
    _options: vscode.LanguageModelToolInvocationOptions<ListReadyToolInput>,
    _token: vscode.CancellationToken
  ) {
    try {
      const tasks = await this.storageService.loadTasks();
      const readyTasks = this.graphService.getReadyWork(tasks);
      const result = readyTasks.map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority
      }));
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: true, readyTasks: result }))
      ]);
    } catch (error) {
      const err = error as Error;
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: false, message: `Error listing ready tasks: ${err.message}` }))
      ]);
    }
  }
}

export class CairnUpdateTool implements vscode.LanguageModelTool<UpdateToolInput> {
  constructor(private storageService: IStorageService, private graphService: IGraphService) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<UpdateToolInput>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: `Updating task ${options.input.id}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<UpdateToolInput>,
    _token: vscode.CancellationToken
  ) {
    try {
      const inputs = options.input;

      // Check if trying to close a task with open subtasks
      if (inputs.status === 'closed') {
const tasks = await this.storageService.loadTasks();
        const validation = this.graphService.canCloseTask(inputs.id, tasks);

        if (!validation.canClose) {
          const currentTask = tasks.find(i => i.id === inputs.id);
          let errorMsg = `Cannot close task "${currentTask?.title || inputs.id}" (${inputs.id})`;
          
          if (validation.reason) {
            errorMsg += ` because it ${validation.reason}`;
          }
          if (validation.completionPercentage !== undefined) {
            errorMsg += ` (currently ${validation.completionPercentage}% complete)`;
          }
          if (validation.openSubtasks && validation.openSubtasks.length > 0) {
            const subtaskList = validation.openSubtasks.map(subtask =>
              `- ${subtask.title} (${subtask.id}) - ${subtask.status}`
            ).join('\n');
            errorMsg += `:\n${subtaskList}`;
          }
          errorMsg += '.\n\nPlease complete all requirements before closing this task.';

          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify({
              success: false,
              message: errorMsg
            }))
          ]);
        }
      }

      await this.storageService.updateTasks(tasks => {
        return tasks.map(task => {
          if (task.id === inputs.id) {
            const updated = { ...task, updated_at: new Date().toISOString() };
            if (inputs.status) updated.status = inputs.status;
            if (inputs.title) updated.title = inputs.title;
            if (inputs.description) updated.description = inputs.description;
            if (inputs.type) updated.type = inputs.type;
            if (inputs.priority) updated.priority = inputs.priority;
            if (inputs.assignee) updated.assignee = inputs.assignee;
            if (inputs.labels) updated.labels = inputs.labels;
            if (inputs.acceptance_criteria) updated.acceptance_criteria = inputs.acceptance_criteria;
            if (inputs.status === 'closed') updated.closed_at = new Date().toISOString();
            return updated;
          }
          return task;
        });
      });
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: true, message: `Updated task ${inputs.id}` }))
      ]);
    } catch (error) {
      const err = error as Error;
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: false, message: `Error updating task: ${err.message}` }))
      ]);
    }
  }
}

export class CairnDepAddTool implements vscode.LanguageModelTool<DepAddToolInput> {
  constructor(private storageService: IStorageService, private graphService: IGraphService) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<DepAddToolInput>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: `Adding ${options.input.type} dependency from ${options.input.from} to ${options.input.to}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<DepAddToolInput>,
    _token: vscode.CancellationToken
  ) {
    try {
      const inputs = options.input;
      await this.storageService.updateTasks(tasks => {
        return this.graphService.addDependency(inputs.from, inputs.to, inputs.type, tasks);
      });
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: true, message: `Added ${inputs.type} dependency from ${inputs.from} to ${inputs.to}` }))
      ]);
    } catch (error) {
      const err = error as Error;
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: false, message: `Error adding dependency: ${err.message}` }))
      ]);
    }
  }
}

export class CairnCommentTool implements vscode.LanguageModelTool<CommentToolInput> {
  constructor(private storageService: IStorageService) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<CommentToolInput>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: `Adding comment to task ${options.input.task_id}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<CommentToolInput>,
    _token: vscode.CancellationToken
  ) {
    try {
      const inputs = options.input;
      const comment = await this.storageService.addComment(inputs.task_id, inputs.author || 'agent', inputs.content);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({
          success: true,
          message: `Added comment to task ${inputs.task_id}`,
          comment: {
            id: comment.id,
            author: comment.author,
            created_at: comment.created_at
          }
        }))
      ]);
    } catch (error) {
      const err = error as Error;
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: false, message: `Error adding comment: ${err.message}` }))
      ]);
    }
  }
}

export class CairnAcAddTool implements vscode.LanguageModelTool<AcAddToolInput> {
  constructor(private storageService: IStorageService) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<AcAddToolInput>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: `Adding acceptance criteria to task ${options.input.task_id}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AcAddToolInput>,
    _token: vscode.CancellationToken
  ) {
    try {
      const inputs = options.input;
      await this.storageService.updateTasks(tasks => {
        return tasks.map(task => {
          if (task.id === inputs.task_id) {
            const acceptance_criteria = task.acceptance_criteria || [];
            return {
              ...task,
              acceptance_criteria: [...acceptance_criteria, { text: inputs.text, completed: false }],
              updated_at: new Date().toISOString()
            };
          }
          return task;
        });
      });
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: true, message: `Added acceptance criteria to task ${inputs.task_id}` }))
      ]);
    } catch (error) {
      const err = error as Error;
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: false, message: `Error adding acceptance criteria: ${err.message}` }))
      ]);
    }
  }
}

export class CairnAcUpdateTool implements vscode.LanguageModelTool<AcUpdateToolInput> {
  constructor(private storageService: IStorageService) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<AcUpdateToolInput>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: `Updating acceptance criteria ${options.input.index} for task ${options.input.task_id}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AcUpdateToolInput>,
    _token: vscode.CancellationToken
  ) {
    try {
      const inputs = options.input;
      await this.storageService.updateTasks(tasks => {
        return tasks.map(task => {
          if (task.id === inputs.task_id) {
            const acceptance_criteria = task.acceptance_criteria || [];
            if (inputs.index >= 0 && inputs.index < acceptance_criteria.length) {
              acceptance_criteria[inputs.index] = { ...acceptance_criteria[inputs.index], text: inputs.text };
            }
            return {
              ...task,
              acceptance_criteria,
              updated_at: new Date().toISOString()
            };
          }
          return task;
        });
      });
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: true, message: `Updated acceptance criteria ${inputs.index} for task ${inputs.task_id}` }))
      ]);
    } catch (error) {
      const err = error as Error;
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: false, message: `Error updating acceptance criteria: ${err.message}` }))
      ]);
    }
  }
}

export class CairnAcRemoveTool implements vscode.LanguageModelTool<AcRemoveToolInput> {
  constructor(private storageService: IStorageService) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<AcRemoveToolInput>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: `Removing acceptance criteria ${options.input.index} from task ${options.input.task_id}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AcRemoveToolInput>,
    _token: vscode.CancellationToken
  ) {
    try {
      const inputs = options.input;
      await this.storageService.updateTasks(tasks => {
        return tasks.map(task => {
          if (task.id === inputs.task_id) {
            const acceptance_criteria = task.acceptance_criteria || [];
            if (inputs.index >= 0 && inputs.index < acceptance_criteria.length) {
              acceptance_criteria.splice(inputs.index, 1);
            }
            return {
              ...task,
              acceptance_criteria,
              updated_at: new Date().toISOString()
            };
          }
          return task;
        });
      });
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: true, message: `Removed acceptance criteria ${inputs.index} from task ${inputs.task_id}` }))
      ]);
    } catch (error) {
      const err = error as Error;
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: false, message: `Error removing acceptance criteria: ${err.message}` }))
      ]);
    }
  }
}

export class CairnAcToggleTool implements vscode.LanguageModelTool<AcToggleToolInput> {
  constructor(private storageService: IStorageService) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<AcToggleToolInput>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: `Toggling acceptance criteria ${options.input.index} completion for task ${options.input.task_id}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AcToggleToolInput>,
    _token: vscode.CancellationToken
  ) {
    try {
      const inputs = options.input;
      await this.storageService.updateTasks(tasks => {
        return tasks.map(task => {
          if (task.id === inputs.task_id) {
            const acceptance_criteria = task.acceptance_criteria || [];
            if (inputs.index >= 0 && inputs.index < acceptance_criteria.length) {
              acceptance_criteria[inputs.index] = { ...acceptance_criteria[inputs.index], completed: !acceptance_criteria[inputs.index].completed };
            }
            return {
              ...task,
              acceptance_criteria,
              updated_at: new Date().toISOString()
            };
          }
          return task;
        });
      });
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: true, message: `Toggled acceptance criteria ${inputs.index} completion for task ${inputs.task_id}` }))
      ]);
    } catch (error) {
      const err = error as Error;
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: false, message: `Error toggling acceptance criteria: ${err.message}` }))
      ]);
    }
  }
}

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Cairn');
  context.subscriptions.push(outputChannel);
  outputChannel!.appendLine('Cairn extension activated');

  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    outputChannel!.appendLine(`Workspace folders: ${vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath).join(', ')}`);

    if (!workspaceFolder) {
      outputChannel!.appendLine('ERROR: No workspace folder found');
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    outputChannel!.appendLine(`Using workspace folder: ${workspaceFolder.uri.fsPath}`);
    const startDir = workspaceFolder.uri.fsPath;
    const cairnDirResult = findCairnDir(startDir);
    cairnDir = cairnDirResult.cairnDir;
    repoRoot = cairnDirResult.repoRoot;
    outputChannel!.appendLine(`Cairn dir: ${cairnDir}, Repo root: ${repoRoot}`);

    if (!fs.existsSync(cairnDir)) {
      outputChannel!.appendLine(`ERROR: No .cairn directory found at: ${cairnDir}`);
      vscode.window.showErrorMessage('No .cairn directory found. Run `npx cairn init` in your project root.');
      return;
    }

    outputChannel!.appendLine('Creating container...');
    const config = readConfig(cairnDir);
    const tasksFileName = getTaskFileName(config.activeFile);
    lastKnownActiveFile = config.activeFile;
    container = createContainer(cairnDir, repoRoot, tasksFileName);
    outputChannel!.appendLine(`Using task file: ${tasksFileName}`);
    outputChannel!.appendLine('Getting storage service...');
    storage = container.get(TYPES.IStorageService);
    outputChannel!.appendLine('Getting graph service...');
    graph = container.get(TYPES.IGraphService);
    outputChannel!.appendLine('Services initialized successfully');

    // Check for and migrate legacy issues.jsonl to tasks.jsonl if it exists
    const legacyIssuesPath = path.join(cairnDir, 'issues.jsonl');
    const defaultTasksPath = path.join(cairnDir, 'tasks.jsonl');
    if (fs.existsSync(legacyIssuesPath) && !fs.existsSync(defaultTasksPath)) {
      outputChannel!.appendLine('Found legacy issues.jsonl file, migrating to tasks.jsonl...');
      try {
        await fs.promises.copyFile(legacyIssuesPath, defaultTasksPath);
        await fs.promises.unlink(legacyIssuesPath);
        outputChannel!.appendLine('Successfully migrated issues.jsonl to tasks.jsonl');
      } catch (error) {
        outputChannel!.appendLine(`Failed to migrate issues.jsonl to tasks.jsonl: ${error}`);
      }
    }

    // Create status bar item
    outputChannel!.appendLine('Creating status bar item...');
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    updateStatusBar(config.activeFile);
    statusBarItem.command = 'cairn.switchFile';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    outputChannel!.appendLine('Status bar created');

    // Watch config file for changes
    const configPath = getConfigPath(cairnDir);
    configWatcher = vscode.workspace.createFileSystemWatcher(configPath);
    configWatcher.onDidChange(() => {
      // Ignore changes that occur shortly after an internal write to handle multiple events
      const timeSinceLastWrite = Date.now() - lastInternalWriteTime;
      if (timeSinceLastWrite < 200) { // 200ms debounce window
        outputChannel!.appendLine('Config changed by extension (debounced), ignoring');
        return;
      }

      const newConfig = readConfig(cairnDir!);
      if (newConfig.activeFile !== lastKnownActiveFile) {
        outputChannel!.appendLine(`External config change detected: ${lastKnownActiveFile} -> ${newConfig.activeFile}`);
        const newFileName = getTaskFileName(newConfig.activeFile);

        vscode.window.showInformationMessage(
          `Cairn context changed to: ${newConfig.activeFile} (${newFileName})`,
          'Switch Now',
          'Stay Here'
        ).then(selection => {
          if (selection === 'Switch Now') {
            lastKnownActiveFile = newConfig.activeFile;
            reinitializeServices(newFileName);
            updateStatusBar(newConfig.activeFile);

            // Update file indicators in all open task list panels (not the tasks themselves)
            taskListPanels.forEach((updateFn, panel) => {
              panel.webview.postMessage({
                type: 'updateActiveFile',
                currentFile: newConfig.activeFile,
                availableFiles: getAvailableTaskFiles(cairnDir!)
              });
            });

            vscode.window.showInformationMessage(`Switched to ${newConfig.activeFile}`);
          }
        });
      }
    });
    context.subscriptions.push(configWatcher);

    outputChannel!.appendLine('About to register tools');

    // Register tools
    context.subscriptions.push(vscode.lm.registerTool('cairn_create', new CairnCreateTool(getStorage(), getGraph())));
    context.subscriptions.push(vscode.lm.registerTool('cairn_list_ready', new CairnListReadyTool(getStorage(), getGraph())));
    context.subscriptions.push(vscode.lm.registerTool('cairn_update', new CairnUpdateTool(getStorage(), getGraph())));
    context.subscriptions.push(vscode.lm.registerTool('cairn_dep_add', new CairnDepAddTool(getStorage(), getGraph())));
    context.subscriptions.push(vscode.lm.registerTool('cairn_comment', new CairnCommentTool(getStorage())));
    context.subscriptions.push(vscode.lm.registerTool('cairn_ac_add', new CairnAcAddTool(getStorage())));
    context.subscriptions.push(vscode.lm.registerTool('cairn_ac_update', new CairnAcUpdateTool(getStorage())));
    context.subscriptions.push(vscode.lm.registerTool('cairn_ac_remove', new CairnAcRemoveTool(getStorage())));
    context.subscriptions.push(vscode.lm.registerTool('cairn_ac_toggle', new CairnAcToggleTool(getStorage())));

    outputChannel!.appendLine('Tools registered successfully');

    // Register command to switch task files
    context.subscriptions.push(
      vscode.commands.registerCommand('cairn.switchFile', async () => {
        try {
          const availableFiles = getAvailableTaskFiles(cairnDir!);
          const currentConfig = readConfig(cairnDir!);
          
          const items = availableFiles.map(file => ({
            label: file === currentConfig.activeFile ? `$(check) ${file}` : file,
            description: getTaskFileName(file),
            detail: file === currentConfig.activeFile ? 'Currently active' : undefined,
            file: file
          }));
          
          items.push({
            label: '$(add) Create New Task File',
            description: 'Create a new .jsonl file',
            detail: undefined,
            file: '__new__'
          });
          
          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a task file to switch to',
            title: 'Cairn Task Files'
          });
          
          if (!selected) return;
          
          let targetFile = selected.file;
          
          if (targetFile === '__new__') {
            const newFileName = await vscode.window.showInputBox({
              prompt: 'Enter name for new task file (without .jsonl extension)',
              placeHolder: 'e.g., feature-auth, bugfixes, sprint-2',
              validateInput: (value) => {
                if (!value) return 'Name cannot be empty';
                if (value === 'tasks') return 'The name "tasks" is reserved. Use "default" to access tasks.jsonl';
                if (!/^[a-zA-Z0-9_-]+$/.test(value)) return 'Name can only contain letters, numbers, hyphens, and underscores';
                return null;
              }
            });
            
            if (!newFileName) return;
            targetFile = newFileName;
            
            // Create the new file
            const newFilePath = path.join(cairnDir!, getTaskFileName(newFileName));
            if (!fs.existsSync(newFilePath)) {
              fs.writeFileSync(newFilePath, '');
              outputChannel!.appendLine(`Created new task file: ${getTaskFileName(newFileName)}`);
            }
          }
          
          if (targetFile === currentConfig.activeFile) {
            vscode.window.showInformationMessage(`Already using ${targetFile}`);
            return;
          }
          
          // Update config
          writeConfig(cairnDir!, { activeFile: targetFile });
          lastKnownActiveFile = targetFile;
          
          // Reinitialize services
          const newFileName = getTaskFileName(targetFile);
          reinitializeServices(newFileName);
          updateStatusBar(targetFile);
          
          // Update file indicators in all open task list panels (not the tasks themselves)
          taskListPanels.forEach((updateFn, panel) => {
            panel.webview.postMessage({
              type: 'updateActiveFile',
              currentFile: targetFile,
              availableFiles: getAvailableTaskFiles(cairnDir!)
            });
          });
          
          vscode.window.showInformationMessage(`Switched to ${targetFile} (${newFileName})`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to switch file: ${error}`);
          outputChannel!.appendLine(`Error switching file: ${error}`);
        }
      })
    );

    // Register command to open task list webview
    context.subscriptions.push(
      vscode.commands.registerCommand('cairn.openTaskList', async () => {
        outputChannel!.appendLine('=== cairn.openTaskList command called ===');
        outputChannel!.show();
        try {
          outputChannel!.appendLine('Creating task list panel...');
          const panel = vscode.window.createWebviewPanel(
            'cairnTaskList',
            'Cairn Tasks',
            vscode.ViewColumn.One,
            {
              enableScripts: true,
              retainContextWhenHidden: true,
              localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
            }
          );
          outputChannel!.appendLine('Panel created successfully');

          let webviewReady = false;
          const noopWatcher = { close: () => { /* no-op */ } } as unknown as fs.FSWatcher;
          let watcher: fs.FSWatcher = noopWatcher;

          // Handle messages from webview
          const disposable = panel.webview.onDidReceiveMessage(async (message) => {
            outputChannel!.appendLine(`=== WEBVIEW MESSAGE RECEIVED ===`);
            outputChannel!.appendLine(`Message type: ${message.type}`);
            outputChannel!.appendLine(`Full message: ${JSON.stringify(message)}`);
            try {
              if (message.type === 'webviewReady') {
                outputChannel!.appendLine('Task list webview ready');
                webviewReady = true;
                await updateTasks();
              } else if (message.type === 'startTask') {
                outputChannel!.appendLine(`Starting task: ${message.id}`);
                await getStorage().updateTasks(tasks => {
                  return tasks.map(task => {
                    if (task.id === message.id) {
                      return { ...task, status: 'in_progress', updated_at: new Date().toISOString() };
                    }
                    return task;
                  });
                });
                await updateTasks();
              } else if (message.type === 'completeTask') {
                outputChannel!.appendLine(`Completing task: ${message.id}`);
                const tasks = await getStorage().loadTasks();
                const validation = getGraph().canCloseTask(message.id, tasks);

                if (!validation.canClose) {
                  let errorMsg = `Cannot close task "${message.id}"`;
                  
                  if (validation.reason) {
                    errorMsg += ` because it ${validation.reason}`;
                  }
                  if (validation.completionPercentage !== undefined) {
                    errorMsg += ` (currently ${validation.completionPercentage}% complete)`;
                  }
                  errorMsg += '. Please complete all requirements before closing this task.';

                  vscode.window.showErrorMessage(errorMsg);
                  return;
                }

                await getStorage().updateTasks(tasks => {
                  return tasks.map(task => {
                    if (task.id === message.id) {
                      return { ...task, status: 'closed', updated_at: new Date().toISOString(), closed_at: new Date().toISOString() };
                    }
                    return task;
                  });
                });
                await updateTasks();
              } else if (message.type === 'switchViewingFile') {
                outputChannel!.appendLine(`Switch viewing file message received: ${message.file}`);
                // Load tasks from the requested file without updating system config
                const newFileName = getTaskFileName(message.file);
                const tempTasksPath = path.join(cairnDir!, newFileName);
                
                try {
                  let viewTasks: Task[] = [];
                  if (fs.existsSync(tempTasksPath)) {
                    const content = fs.readFileSync(tempTasksPath, 'utf-8');
                    viewTasks = content.trim().split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
                  }
                  
                  const currentConfig = readConfig(cairnDir!);
                  const availableFiles = getAvailableTaskFiles(cairnDir!);
                  
                  // Send tasks for viewing, but keep system active file unchanged
                  panel.webview.postMessage({
                    type: 'updateViewTasks',
                    tasks: viewTasks,
                    viewingFile: message.file,
                    systemActiveFile: currentConfig.activeFile,
                    availableFiles: availableFiles
                  });
                } catch (error) {
                  outputChannel!.appendLine(`Error loading view file: ${error}`);
                }
              } else if (message.type === 'switchFile') {
                outputChannel!.appendLine(`Switch file message received: ${message.file}`);
                const currentConfig = readConfig(cairnDir!);
                
                if (message.file === currentConfig.activeFile) {
                  outputChannel!.appendLine('File matches system active file');
                  // Just reload tasks from this file
                  await updateTasks();
                  return;
                }
                
                // Update config to match what user is viewing
                writeConfig(cairnDir!, { activeFile: message.file });
                lastKnownActiveFile = message.file;
                
                // Reinitialize services
                const newFileName = getTaskFileName(message.file);
                reinitializeServices(newFileName);
                updateStatusBar(message.file);
                
                // Update file watcher to watch the new file
                watcher.close();
                const newTasksPath = getStorage().getTasksFilePath();
                outputChannel!.appendLine(`Switching watcher to: ${newTasksPath}`);
                watcher = fs.watch(newTasksPath, async (eventType) => {
                  if (eventType === 'change') {
                    outputChannel!.appendLine('Tasks file changed, updating tasks...');
                    await updateTasks();
                  }
                });
                
                // Update indicators in other panels
                taskListPanels.forEach((updateFn, otherPanel) => {
                  if (otherPanel !== panel) {
                    otherPanel.webview.postMessage({
                      type: 'updateActiveFile',
                      currentFile: message.file,
                      availableFiles: getAvailableTaskFiles(cairnDir!)
                    });
                  }
                });
                
                // Reload tasks in THIS webview
                await updateTasks();
                
                vscode.window.showInformationMessage(`Switched to ${message.file} (${newFileName})`);
              } else if (message.type === 'editTask') {
                outputChannel!.appendLine(`Edit task message received for: ${message.id}`);
                try {
                  await vscode.commands.executeCommand('cairn.editTask', message.id);
                } catch (error) {
                  outputChannel!.appendLine(`ERROR executing edit command: ${error instanceof Error ? error.message : String(error)}`);
                }
              } else if (message.type === 'createTask') {
                outputChannel!.appendLine('Create task message received');
                try {
                  await vscode.commands.executeCommand('cairn.createTask');
                } catch (error) {
                  outputChannel!.appendLine(`ERROR executing create command: ${error instanceof Error ? error.message : String(error)}`);
                }
              } else if (message.type === 'deleteTask') {
                outputChannel!.appendLine(`Delete task message received for: ${message.id}`);
                try {
                  await deleteTask(message.id);
                  await updateTasks();
                } catch (error) {
                  outputChannel!.appendLine(`ERROR deleting task: ${error}`);
                }
              }
            } catch (error) {
              outputChannel!.appendLine(`ERROR handling webview message: ${error instanceof Error ? error.message : String(error)}`);
              if (error instanceof Error && error.stack) {
                outputChannel!.appendLine(`Stack: ${error.stack}`);
              }
            }
          });
          context.subscriptions.push(disposable);

          // Generate HTML programmatically
          const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'index.js')));
          const cssUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'index.css')));
          const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${panel.webview.cspSource}; style-src ${panel.webview.cspSource};">
  <title>Cairn Task List</title>
  <link rel="stylesheet" href="${cssUri}">
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
          panel.webview.html = htmlContent;

          // Function to update tasks
          const updateTasks = async () => {
            if (!webviewReady) {
              outputChannel!.appendLine('Webview not ready yet, skipping updateTasks');
              return;
            }
            try {
              outputChannel!.appendLine('Loading tasks...');
              const tasks = await getStorage().loadTasks();
              outputChannel!.appendLine(`Loaded ${tasks.length} tasks`);
              outputChannel!.appendLine(`Task IDs: ${tasks.map(t => t.id).join(', ')}`);
              
              // IMPORTANT: Map tasks to the format expected by the webview
              const allTasks = tasks.map(task => ({
                id: task.id,
                title: task.title,
                status: task.status,
                priority: task.priority || 'medium',
                description: task.description || '',
                type: task.type || 'task',
                completion_percentage: task.completion_percentage,
                acceptance_criteria: task.acceptance_criteria || [],
                dependencies: task.dependencies || [],
                subtasks: getGraph().getEpicSubtasks(task.id, tasks).map(s => ({
                  id: s.id,
                  title: s.title,
                  type: s.type,
                  status: s.status,
                  priority: s.priority,
                  completion_percentage: s.completion_percentage
                }))
              }));
              outputChannel!.appendLine(`Mapped to ${allTasks.length} tasks for webview`);
              outputChannel!.appendLine(`Sending updateTasks with ${allTasks.length} tasks`);
              outputChannel!.appendLine(`First task: ${JSON.stringify(allTasks[0])}`);
              
              // Get file context info
              const currentConfig = readConfig(cairnDir!);
              const availableFiles = getAvailableTaskFiles(cairnDir!);
              
              outputChannel!.appendLine(`Current file from config: ${currentConfig.activeFile}`);
              outputChannel!.appendLine(`Available files: ${availableFiles.join(', ')}`);
              
              const messageResult = panel.webview.postMessage({
                type: 'updateTasks',
                tasks: allTasks,
                currentFile: currentConfig.activeFile,
                availableFiles: availableFiles
              });
              outputChannel!.appendLine(`PostMessage result: ${messageResult}`);
            } catch (error) {
              outputChannel!.appendLine(`ERROR updating tasks: ${error instanceof Error ? error.message : String(error)}`);
              if (error instanceof Error && error.stack) {
                outputChannel!.appendLine(`Stack: ${error.stack}`);
              }
            }
          };

          // Watch for file changes - use the current active file
          const currentTasksPath = getStorage().getTasksFilePath();
          outputChannel!.appendLine(`Watching tasks file: ${currentTasksPath}`);
          watcher = fs.watch(currentTasksPath, async (eventType) => {
            if (eventType === 'change') {
              outputChannel!.appendLine('Tasks file changed, updating tasks...');
              await updateTasks();
            }
          });

          // Clean up watcher on panel disposal
          panel.onDidDispose(() => {
            outputChannel!.appendLine('Panel disposed, closing watcher');
            watcher.close();
            taskListPanels.delete(panel);
          });
          
          // Register this panel and its update function
          taskListPanels.set(panel, updateTasks);

          outputChannel!.appendLine('Task list setup complete');
        } catch (error) {
          outputChannel!.appendLine(`ERROR in cairn.openTaskList: ${error instanceof Error ? error.message : String(error)}`);
          vscode.window.showErrorMessage(`Failed to open task list: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
    );

    // Register command to edit a task
    context.subscriptions.push(
      vscode.commands.registerCommand('cairn.editTask', async (id: string, options?: { viewColumn?: vscode.ViewColumn }) => {
        outputChannel!.appendLine(`cairn.editTask called with id: ${id}`);
        try {
          // Load task data first to get the title for the panel
          const tasks = await getStorage().loadTasks();
          const task = tasks.find(t => t.id === id);
          const displayTitle = task ? truncateTitle(task.title, id) : `Edit Task #${id}`;

          const panel = vscode.window.createWebviewPanel(
            'cairnEditTask',
            displayTitle,
            options?.viewColumn || vscode.ViewColumn.Beside,
            {
              enableScripts: true,
              localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
            }
          );

          const pendingTaskId = id;
          let webviewReady = false;
          let saveQueue = Promise.resolve();

          // Generate HTML programmatically
          const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'edit.js')));
          const cssUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'edit.css')));
          const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Edit Task</title>
  <link rel="stylesheet" href="${cssUri}">
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
          panel.webview.html = htmlContent;

          // Load task data
          const loadTask = async (taskId: string) => {
            try {
              const tasks = await getStorage().loadTasks();
              const task = tasks.find(t => t.id === taskId);

              let safeTask;
              if (task) {
                safeTask = {
                  ...task,
                  title: task.title,
                  description: task.description,
                  type: task.type,
                  priority: task.priority,
                  status: task.status,
                  acceptance_criteria: task.acceptance_criteria || [],
                  completion_percentage: task.completion_percentage
                };
              } else {
                outputChannel!.appendLine(`Task not found: ${taskId} - sending default data`);
                safeTask = {
                  id: taskId,
                  title: 'New Task',
                  description: 'Add description...',
                  type: 'task',
                  priority: 'medium',
                  status: 'open',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  completion_percentage: null
                };
              }

              // Get subtasks
              const subtasks = task ? getGraph().getEpicSubtasks(taskId, tasks).map(s => ({
                id: s.id,
                title: s.title,
                type: s.type,
                status: s.status,
                priority: s.priority,
                completion_percentage: s.completion_percentage
              })) : [];

              // Get dependencies
              const dependencies: WebviewDependency[] = [];
              if (task) {
                // Get tasks that block this task (blocked_by stored)
                const blockerDeps = task.dependencies?.filter((d: Dependency) => d.type === 'blocked_by' || d.type === 'blocks') || [];
                for (const dep of blockerDeps) {
                  const blocker = tasks.find(t => t.id === dep.id);
                  if (blocker) {
                    dependencies.push({
                      id: blocker.id,
                      title: blocker.title,
                      type: blocker.type,
                      status: blocker.status,
                      priority: blocker.priority,
                      direction: 'blocked_by', // This task is blocked by these
                      completion_percentage: blocker.completion_percentage
                    });
                  }
                }
                
                // Get tasks that this task blocks (blocking) - COMPUTED from other tasks' 'blocked_by' dependencies
                const blockedByTasks = tasks.filter(t => 
                  t.dependencies?.some((d: Dependency) => d.id === taskId && (d.type === 'blocked_by' || d.type === 'blocks'))
                );
                for (const blocked of blockedByTasks) {
                  dependencies.push({
                    id: blocked.id,
                    title: blocked.title,
                    type: blocked.type,
                    status: blocked.status,
                    priority: blocked.priority,
                    direction: 'blocks', // This task blocks these
                    completion_percentage: blocked.completion_percentage
                  });
                }
              }

              outputChannel!.appendLine(`Sending loadTask message for: ${taskId}`);
              panel.webview.postMessage({
                type: 'loadTask',
                task: {
                  ...safeTask,
                  subtasks,
                  dependencies
                }
              });
            } catch (error) {
              outputChannel!.appendLine(`Error loading task: ${error}`);
            }
          };

          // Handle messages from webview
          panel.webview.onDidReceiveMessage(async (message) => {
            try {
              if (message.type === 'webviewReady') {
                outputChannel!.appendLine(`Webview ready, loading task: ${pendingTaskId}`);
                webviewReady = true;
                await loadTask(pendingTaskId);
              } else if (message.type === 'getGitUser') {
                outputChannel!.appendLine('Getting git user info');
                const { execSync } = require('child_process');
                let gitUserName = '';
                let gitUserEmail = '';
                try {
                  gitUserName = execSync('git config user.name', { cwd: repoRoot, encoding: 'utf-8' }).trim();
                } catch (e) {
                  outputChannel!.appendLine('Could not get git user.name');
                }
                try {
                  gitUserEmail = execSync('git config user.email', { cwd: repoRoot, encoding: 'utf-8' }).trim();
                } catch (e) {
                  outputChannel!.appendLine('Could not get git user.email');
                }
                panel.webview.postMessage({
                  type: 'gitUserInfo',
                  userName: gitUserName,
                  userEmail: gitUserEmail
                });
              } else if (message.type === 'getAvailableSubtasks') {
                outputChannel!.appendLine('Getting available subtasks');
                const tasks = await getStorage().loadTasks();
                const availableSubtasks = getGraph().getNonParentedTasks(tasks)
                  .filter(task => task.id !== pendingTaskId)
                  .filter(task => {
                    // Check if adding this as a subtask would create a circular dependency
                    return !getGraph().wouldCreateCycle(task.id, pendingTaskId, 'parent-child', tasks);
                  })
                  .map(task => ({
                    id: task.id,
                    title: task.title,
                    type: task.type,
                    status: task.status,
                    priority: task.priority,
                    description: task.description || '',
                    wouldCreateCycle: false // All remaining items are safe
                  }));
                panel.webview.postMessage({
                  type: 'availableSubtasks',
                  subtasks: availableSubtasks
                });
              } else if (message.type === 'getAvailableDependencies') {
                outputChannel!.appendLine('Getting available dependencies');
                const tasks = await getStorage().loadTasks();
                const availableDependencies = tasks
                  .filter(task => task.id !== pendingTaskId)
                  .filter(task => !getGraph().getEpicSubtasks(pendingTaskId, tasks).some(s => s.id === task.id))
                  .filter(task => !task.dependencies?.some((d: Dependency) => d.type === 'parent-child' && (d.from === pendingTaskId || d.to === pendingTaskId)))
                  .map(task => {
                    // Check if adding this as a dependency would create a circular dependency
                    let wouldCreateCycle = false;
                    try {
                      // For blocked_by dependencies, we need to check cycles
                      // This is a simplified check - we'll mark items that would create cycles
                      getGraph().addDependency(pendingTaskId, task.id, 'blocked_by', tasks);
                    } catch (error) {
                      wouldCreateCycle = true;
                    }
                    return {
                      id: task.id,
                      title: task.title,
                      type: task.type,
                      status: task.status,
                      priority: task.priority,
                      description: task.description || '',
                      wouldCreateCycle
                    };
                  });
                panel.webview.postMessage({
                  type: 'availableDependencies',
                  dependencies: availableDependencies
                });
              } else if (message.type === 'saveTask') {
                saveQueue = saveQueue.then(async () => {
                  outputChannel!.appendLine(`Received saveTask message: ${message.task.id}`);
                  const taskData = message.task;

                  if (taskData.id) {
                    try {
                      outputChannel!.appendLine('Starting save operation...');
                      let updatedTasks = await getStorage().loadTasks();
                      outputChannel!.appendLine(`Loaded tasks, count: ${updatedTasks.length}`);

                      const currentSubtasks = getGraph().getEpicSubtasks(taskData.id, updatedTasks);
                      const currentIds = new Set(currentSubtasks.map(s => s.id));
                      const newSubtasks = taskData.subtasks as { id?: string; title: string }[];
                      const newIds = new Set(newSubtasks.filter(s => s.id).map(s => s.id!));

                      const now = new Date().toISOString();

                      // Update main task
                      const originalTask = updatedTasks.find(i => i.id === taskData.id);
                      
                      // Check if trying to CHANGE status to closed (not just saving an already-closed task)
                      const isChangingToClosed = taskData.status === 'closed' && originalTask?.status !== 'closed';
                      if (isChangingToClosed) {
                        const validation = getGraph().canCloseTask(taskData.id, updatedTasks);

                        if (!validation.canClose) {
                          // Send simplified error message to webview to revert UI state
                          panel.webview.postMessage({
                            type: 'saveFailed',
                            error: 'Cannot close task as it is not 100% complete.',
                            errorCode: 'CANNOT_CLOSE_INCOMPLETE'
                          });

                          const currentTask = updatedTasks.find(i => i.id === taskData.id);
                          let errorMsg = `Cannot close task "${currentTask?.title || taskData.id}" (${taskData.id})`;
                          
                          if (validation.reason) {
                            errorMsg += ` because it ${validation.reason}`;
                          }
                          if (validation.completionPercentage !== undefined) {
                            errorMsg += ` (currently ${validation.completionPercentage}% complete)`;
                          }
                          errorMsg += '. Please complete all requirements before closing this task.';

                          vscode.window.showErrorMessage(errorMsg);
                          return; // Don't save the task
                        }
                      }
                      updatedTasks = updatedTasks.map(task => {
                        if (task.id === taskData.id) {
                          const updated = {
                            ...task,
                            title: taskData.title,
                            description: taskData.description,
                            comments: taskData.comments,
                            type: taskData.type || 'task',
                            priority: taskData.priority || 'medium',
                            status: taskData.status || 'open',
                            acceptance_criteria: taskData.acceptance_criteria,
                            updated_at: now
                          };

                          if (taskData.status === 'closed' && task.status !== 'closed') {
                            updated.closed_at = now;
                          } else if (taskData.status !== 'closed' && task.status === 'closed') {
                            updated.closed_at = undefined;
                          }

                          return updated;
                        }
                        return task;
                      });

                      // Update existing subtask titles
                      updatedTasks = updatedTasks.map(task => {
                        const subtask = newSubtasks.find(s => s.id === task.id);
                        if (subtask) {
                          return { ...task, title: subtask.title, updated_at: now };
                        }
                        return task;
                      });

                      // Remove dependencies for deleted subtasks
                      for (const subId of currentIds) {
                        if (!newIds.has(subId)) {
                          updatedTasks = getGraph().removeDependency(subId, taskData.id, updatedTasks);
                        }
                      }

                      // Add dependencies for newly added existing subtasks
                      for (const subId of newIds) {
                        if (!currentIds.has(subId)) {
                          updatedTasks = getGraph().addDependency(subId, taskData.id, 'parent-child', updatedTasks);
                        }
                      }

                      // Handle dependencies
                      if (originalTask) {
                        // Get current blockers (what blocks this task)
                        const currentBlockers = originalTask.dependencies?.filter((d: Dependency) => d.type === 'blocked_by' || d.type === 'blocks').map((d: Dependency) => d.id) || [];
                        // Get new blockers from UI (only 'blocked_by' direction is stored)
                        const newBlockers = taskData.dependencies.filter((d: WebviewDependency) => d.direction === 'blocked_by').map((d: WebviewDependency) => d.id);
                        
                        // Note: We ignore 'blocks' direction from UI since that's computed
                        // The 'blocks' list in the UI shows tasks that this one blocks,
                        // but we never modify those relationships from this task's save

                        // Remove blockers that were deleted
                        for (const blockerId of currentBlockers) {
                          if (!newBlockers.includes(blockerId)) {
                            updatedTasks = getGraph().removeDependency(taskData.id, blockerId, updatedTasks);
                          }
                        }

                        // Add new blockers
                        for (const blockerId of newBlockers) {
                          if (!currentBlockers.includes(blockerId)) {
                            updatedTasks = getGraph().addDependency(taskData.id, blockerId, 'blocked_by', updatedTasks);
                          }
                        }
                      }

                      await getStorage().updateTasks(() => updatedTasks);
                      outputChannel!.appendLine('Save operation complete');

                      const updatedTask = updatedTasks.find(i => i.id === taskData.id);
                      if (updatedTask) {
                        panel.title = truncateTitle(updatedTask.title, taskData.id);
                      }

                      // Reload task data from storage to get recalculated completion percentage
                      outputChannel!.appendLine('Reloading task data after save to get updated completion percentage');
                      await loadTask(pendingTaskId);
                    } catch (saveError) {
                      outputChannel!.appendLine(`Save operation failed: ${saveError}`);
                      const errorMsg = saveError instanceof Error ? saveError.message : String(saveError);
                      vscode.window.showErrorMessage(`Failed to save task ${taskData.id}: ${errorMsg}`);
                      throw saveError;
                    }
                  } else {
                    outputChannel!.appendLine('No task ID provided for save operation');
                  }
                }).catch(error => {
                  outputChannel!.appendLine(`Queued save operation failed: ${error}`);
                });
              } else if (message.type === 'editTask') {
                outputChannel!.appendLine(`Edit task message received from editor for: ${message.id}`);
                try {
                  await vscode.commands.executeCommand('cairn.editTask', message.id, { viewColumn: vscode.ViewColumn.Active });
                } catch (error) {
                  outputChannel!.appendLine(`Error executing edit command from editor: ${error}`);
                }
              } else if (message.type === 'deleteTask') {
                outputChannel!.appendLine(`Delete task message received from editor for: ${message.id}`);
                try {
                  await deleteTask(message.id);
                  panel.dispose();
                } catch (error) {
                  outputChannel!.appendLine(`Error deleting task from editor: ${error}`);
                }
              } else if (message.type === 'addComment') {
                outputChannel!.appendLine(`Add comment message received: ${JSON.stringify(message)}`);
                try {
                  const comment = await getStorage().addComment(message.taskId, message.author, message.content);
                  outputChannel!.appendLine(`Comment added successfully: ${JSON.stringify(comment)}`);
                  panel.webview.postMessage({
                    type: 'commentAdded',
                    comment: comment
                  });
                } catch (error) {
                  outputChannel!.appendLine(`Error adding comment: ${error}`);
                  vscode.window.showErrorMessage(`Failed to add comment: ${error instanceof Error ? error.message : String(error)}`);
                }
              }
            } catch (error) {
              outputChannel!.appendLine(`Error in message handler: ${error}`);
              const errorMessage = error instanceof Error ? error.message : String(error);
              vscode.window.showErrorMessage(`Failed to save task: ${errorMessage}`);
            }
          });
        } catch (error) {
          outputChannel!.appendLine(`Error in cairn.editTask: ${error}`);
          vscode.window.showErrorMessage(`Failed to edit task: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
    );

    // Register command to create a new task
    context.subscriptions.push(
      vscode.commands.registerCommand('cairn.createTask', async () => {
        outputChannel!.appendLine('cairn.createTask called');
        try {
          outputChannel!.appendLine('Creating new task...');
          const tasks = await getStorage().loadTasks();
          const newId = generateId(tasks);
          const newTask = {
            id: newId,
            title: 'New Task',
            description: 'Add description...',
            type: 'task' as const,
            status: 'open' as const,
            priority: 'medium' as const,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          outputChannel!.appendLine(`Saving new task: ${newId}`);
          await getStorage().saveTask(newTask);
          outputChannel!.appendLine('New task created successfully');

          // Now open it for editing
          await vscode.commands.executeCommand('cairn.editTask', newId);
        } catch (error) {
          outputChannel!.appendLine(`Error creating task: ${error}`);
          const errorMsg = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Failed to create task: ${errorMsg}`);
        }
      })
    );

    outputChannel!.appendLine('All Cairn commands registered successfully');
  } catch (error) {
    outputChannel!.appendLine(`Error during extension activation: ${error}`);
    vscode.window.showErrorMessage(`Cairn extension failed to activate: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function deactivate() { }

async function deleteTask(taskId: string): Promise<void> {
  outputChannel!.appendLine(`deleteTask called for: ${taskId}`);
  try {
    const tasks = await getStorage().loadTasks();
    const taskToDelete = tasks.find(i => i.id === taskId);
    if (!taskToDelete) {
      throw new Error(`Task ${taskId} not found`);
    }

    const subtasks = getGraph().getEpicSubtasks(taskId, tasks);
    let updatedTasks = tasks;
    for (const subtask of subtasks) {
      updatedTasks = getGraph().removeDependency(subtask.id, taskId, updatedTasks);
    }

    updatedTasks = updatedTasks.filter(i => i.id !== taskId);
    await getStorage().updateTasks(() => updatedTasks);

    const subtaskCount = subtasks.length;
    if (subtaskCount > 0) {
      vscode.window.showInformationMessage(`Deleted task ${taskId} and unparented ${subtaskCount} subtask${subtaskCount === 1 ? '' : 's'}`);
    } else {
      vscode.window.showInformationMessage(`Deleted task ${taskId}`);
    }
  } catch (error) {
    outputChannel!.appendLine(`Error deleting task: ${error}`);
    const err = error as Error;
    vscode.window.showErrorMessage(`Failed to delete task: ${err.message}`);
    throw error;
  }
}
