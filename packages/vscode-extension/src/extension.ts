import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { createContainer, TYPES, IStorageService, IGraphService, Container, AcceptanceCriteria, Issue, Dependency, findCairnDir, generateId } from '../../core/dist/index.js';

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

// NOTE: The logical name "default" is special: it always maps to "issues.jsonl",
// which is the canonical / historical default issues file for a Cairn workspace.
// To avoid ambiguity and file collisions, the logical name "issues" is effectively
// reserved and must not be used by callers, because it would also map to
// "issues.jsonl". This ensures we never have both a "default" mapping and a
// user-named "issues" file attempting to coexist in the same directory.
/**
 * Converts a logical issue file name to its actual filename.
 *
 * @param name - The logical name of the issue file (e.g., 'default', 'feature-auth')
 * @returns The actual filename (e.g., 'issues.jsonl', 'feature-auth.jsonl')
 *
 * @remarks
 * The logical name "default" is special: it always maps to "issues.jsonl",
 * which is the canonical/historical default issues file for a Cairn workspace.
 *
 * To avoid ambiguity and file collisions, the logical name "issues" is effectively
 * reserved and must not be used by callers, because it would also map to
 * "issues.jsonl". This ensures we never have both a "default" mapping and a
 * user-named "issues" file attempting to coexist in the same directory.
 */
function getIssueFileName(name: string): string {
  return name === 'default' ? 'issues.jsonl' : `${name}.jsonl`;
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

function getAvailableIssueFiles(cairnDir: string): string[] {
  return fs.readdirSync(cairnDir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => f.replace('.jsonl', ''))
    .map(f => f === 'issues' ? 'default' : f)
    .sort((a, b) => {
      if (a === 'default') return -1;
      if (b === 'default') return 1;
      return a.localeCompare(b);
    });
}

function reinitializeServices(issuesFileName: string) {
  outputChannel!.appendLine(`Reinitializing services with file: ${issuesFileName}`);
  container = createContainer(cairnDir!, repoRoot!, issuesFileName);
  storage = container.get(TYPES.IStorageService);
  graph = container.get(TYPES.IGraphService);
  outputChannel!.appendLine('Services reinitialized successfully');
}

function updateStatusBar(activeFile: string) {
  statusBarItem!.text = `$(file) Cairn: ${activeFile}`;
  statusBarItem!.tooltip = `Current issue file: ${getIssueFileName(activeFile)}\nClick to switch files`;
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
  issue_id: string;
  author?: string;
  content: string;
}

interface AcAddToolInput {
  issue_id: string;
  text: string;
}

interface AcUpdateToolInput {
  issue_id: string;
  index: number;
  text: string;
}

interface AcRemoveToolInput {
  issue_id: string;
  index: number;
}

interface AcToggleToolInput {
  issue_id: string;
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
      const issues = await this.storageService.loadIssues();
      const id = generateId(issues);
      const issue = {
        id,
        title: inputs.title,
        description: inputs.description || '',
        type: inputs.type || 'task',
        status: inputs.status || 'open',
        priority: inputs.priority || 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await this.storageService.saveIssue(issue);

      if (inputs.parent) {
        await this.storageService.updateIssues(issues => {
          return this.graphService.addDependency(id, inputs.parent, 'parent-child', issues);
        });
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: true, message: `Created issue ${id}: ${inputs.title}`, id }))
      ]);
    } catch (error) {
      const err = error as Error;
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: false, message: `Error creating issue: ${err.message}` }))
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
      const issues = await this.storageService.loadIssues();
      const readyIssues = this.graphService.getReadyWork(issues);
      const result = readyIssues.map(issue => ({
        id: issue.id,
        title: issue.title,
        status: issue.status,
        priority: issue.priority
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

      // Check if trying to close an issue with open subtasks
      if (inputs.status === 'closed') {
        const issues = await this.storageService.loadIssues();
        const validation = this.graphService.canCloseIssue(inputs.id, issues);

        if (!validation.canClose) {
          const currentIssue = issues.find(i => i.id === inputs.id);
          let errorMsg = `Cannot close issue "${currentIssue?.title || inputs.id}" (${inputs.id})`;
          
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
          errorMsg += '.\n\nPlease complete all requirements before closing this issue.';

          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify({
              success: false,
              message: errorMsg
            }))
          ]);
        }
      }

      await this.storageService.updateIssues(issues => {
        return issues.map(issue => {
          if (issue.id === inputs.id) {
            const updated = { ...issue, updated_at: new Date().toISOString() };
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
          return issue;
        });
      });
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: true, message: `Updated issue ${inputs.id}` }))
      ]);
    } catch (error) {
      const err = error as Error;
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: false, message: `Error updating issue: ${err.message}` }))
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
      await this.storageService.updateIssues(issues => {
        return this.graphService.addDependency(inputs.from, inputs.to, inputs.type, issues);
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
      invocationMessage: `Adding comment to issue ${options.input.issue_id}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<CommentToolInput>,
    _token: vscode.CancellationToken
  ) {
    try {
      const inputs = options.input;
      const comment = await this.storageService.addComment(inputs.issue_id, inputs.author || 'agent', inputs.content);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({
          success: true,
          message: `Added comment to issue ${inputs.issue_id}`,
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
      invocationMessage: `Adding acceptance criteria to issue ${options.input.issue_id}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AcAddToolInput>,
    _token: vscode.CancellationToken
  ) {
    try {
      const inputs = options.input;
      await this.storageService.updateIssues(issues => {
        return issues.map(issue => {
          if (issue.id === inputs.issue_id) {
            const acceptance_criteria = issue.acceptance_criteria || [];
            return {
              ...issue,
              acceptance_criteria: [...acceptance_criteria, { text: inputs.text, completed: false }],
              updated_at: new Date().toISOString()
            };
          }
          return issue;
        });
      });
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: true, message: `Added acceptance criteria to issue ${inputs.issue_id}` }))
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
      invocationMessage: `Updating acceptance criteria ${options.input.index} for issue ${options.input.issue_id}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AcUpdateToolInput>,
    _token: vscode.CancellationToken
  ) {
    try {
      const inputs = options.input;
      await this.storageService.updateIssues(issues => {
        return issues.map(issue => {
          if (issue.id === inputs.issue_id) {
            const acceptance_criteria = issue.acceptance_criteria || [];
            if (inputs.index >= 0 && inputs.index < acceptance_criteria.length) {
              acceptance_criteria[inputs.index] = { ...acceptance_criteria[inputs.index], text: inputs.text };
            }
            return {
              ...issue,
              acceptance_criteria,
              updated_at: new Date().toISOString()
            };
          }
          return issue;
        });
      });
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: true, message: `Updated acceptance criteria ${inputs.index} for issue ${inputs.issue_id}` }))
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
      invocationMessage: `Removing acceptance criteria ${options.input.index} from issue ${options.input.issue_id}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AcRemoveToolInput>,
    _token: vscode.CancellationToken
  ) {
    try {
      const inputs = options.input;
      await this.storageService.updateIssues(issues => {
        return issues.map(issue => {
          if (issue.id === inputs.issue_id) {
            const acceptance_criteria = issue.acceptance_criteria || [];
            if (inputs.index >= 0 && inputs.index < acceptance_criteria.length) {
              acceptance_criteria.splice(inputs.index, 1);
            }
            return {
              ...issue,
              acceptance_criteria,
              updated_at: new Date().toISOString()
            };
          }
          return issue;
        });
      });
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: true, message: `Removed acceptance criteria ${inputs.index} from issue ${inputs.issue_id}` }))
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
      invocationMessage: `Toggling acceptance criteria ${options.input.index} completion for issue ${options.input.issue_id}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AcToggleToolInput>,
    _token: vscode.CancellationToken
  ) {
    try {
      const inputs = options.input;
      await this.storageService.updateIssues(issues => {
        return issues.map(issue => {
          if (issue.id === inputs.issue_id) {
            const acceptance_criteria = issue.acceptance_criteria || [];
            if (inputs.index >= 0 && inputs.index < acceptance_criteria.length) {
              acceptance_criteria[inputs.index] = { ...acceptance_criteria[inputs.index], completed: !acceptance_criteria[inputs.index].completed };
            }
            return {
              ...issue,
              acceptance_criteria,
              updated_at: new Date().toISOString()
            };
          }
          return issue;
        });
      });
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: true, message: `Toggled acceptance criteria ${inputs.index} completion for issue ${inputs.issue_id}` }))
      ]);
    } catch (error) {
      const err = error as Error;
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ success: false, message: `Error toggling acceptance criteria: ${err.message}` }))
      ]);
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
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
    const issuesFileName = getIssueFileName(config.activeFile);
    lastKnownActiveFile = config.activeFile;
    container = createContainer(cairnDir, repoRoot, issuesFileName);
    outputChannel!.appendLine(`Using issue file: ${issuesFileName}`);
    outputChannel!.appendLine('Getting storage service...');
    storage = container.get(TYPES.IStorageService);
    outputChannel!.appendLine('Getting graph service...');
    graph = container.get(TYPES.IGraphService);
    outputChannel!.appendLine('Services initialized successfully');

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
        const newFileName = getIssueFileName(newConfig.activeFile);

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
                availableFiles: getAvailableIssueFiles(cairnDir!)
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

    // Register command to switch issue files
    context.subscriptions.push(
      vscode.commands.registerCommand('cairn.switchFile', async () => {
        try {
          const availableFiles = getAvailableIssueFiles(cairnDir!);
          const currentConfig = readConfig(cairnDir!);
          
          const items = availableFiles.map(file => ({
            label: file === currentConfig.activeFile ? `$(check) ${file}` : file,
            description: getIssueFileName(file),
            detail: file === currentConfig.activeFile ? 'Currently active' : undefined,
            file: file
          }));
          
          items.push({
            label: '$(add) Create New Issue File',
            description: 'Create a new .jsonl file',
            detail: undefined,
            file: '__new__'
          });
          
          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select an issue file to switch to',
            title: 'Cairn Issue Files'
          });
          
          if (!selected) return;
          
          let targetFile = selected.file;
          
          if (targetFile === '__new__') {
            const newFileName = await vscode.window.showInputBox({
              prompt: 'Enter name for new issue file (without .jsonl extension)',
              placeHolder: 'e.g., feature-auth, bugfixes, sprint-2',
              validateInput: (value) => {
                if (!value) return 'Name cannot be empty';
                if (value === 'issues') return 'The name "issues" is reserved. Use "default" to access issues.jsonl';
                if (!/^[a-zA-Z0-9_-]+$/.test(value)) return 'Name can only contain letters, numbers, hyphens, and underscores';
                return null;
              }
            });
            
            if (!newFileName) return;
            targetFile = newFileName;
            
            // Create the new file
            const newFilePath = path.join(cairnDir!, getIssueFileName(newFileName));
            if (!fs.existsSync(newFilePath)) {
              fs.writeFileSync(newFilePath, '');
              outputChannel!.appendLine(`Created new issue file: ${getIssueFileName(newFileName)}`);
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
          const newFileName = getIssueFileName(targetFile);
          reinitializeServices(newFileName);
          updateStatusBar(targetFile);
          
          // Update file indicators in all open task list panels (not the tasks themselves)
          taskListPanels.forEach((updateFn, panel) => {
            panel.webview.postMessage({
              type: 'updateActiveFile',
              currentFile: targetFile,
              availableFiles: getAvailableIssueFiles(cairnDir!)
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
            'Cairn Issues',
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
                await getStorage().updateIssues(issues => {
                  return issues.map(issue => {
                    if (issue.id === message.id) {
                      return { ...issue, status: 'in_progress', updated_at: new Date().toISOString() };
                    }
                    return issue;
                  });
                });
                await updateTasks();
              } else if (message.type === 'completeTask') {
                outputChannel!.appendLine(`Completing task: ${message.id}`);
                const issues = await getStorage().loadIssues();
                const validation = getGraph().canCloseIssue(message.id, issues);

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

                await getStorage().updateIssues(issues => {
                  return issues.map(issue => {
                    if (issue.id === message.id) {
                      return { ...issue, status: 'closed', updated_at: new Date().toISOString(), closed_at: new Date().toISOString() };
                    }
                    return issue;
                  });
                });
                await updateTasks();
              } else if (message.type === 'switchViewingFile') {
                outputChannel!.appendLine(`Switch viewing file message received: ${message.file}`);
                // Load tasks from the requested file without updating system config
                const newFileName = getIssueFileName(message.file);
                const tempIssuesPath = path.join(cairnDir!, newFileName);
                
                try {
                  let viewTasks: Issue[] = [];
                  if (fs.existsSync(tempIssuesPath)) {
                    const content = fs.readFileSync(tempIssuesPath, 'utf-8');
                    viewTasks = content.trim().split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
                  }
                  
                  const currentConfig = readConfig(cairnDir!);
                  const availableFiles = getAvailableIssueFiles(cairnDir!);
                  
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
                const newFileName = getIssueFileName(message.file);
                reinitializeServices(newFileName);
                updateStatusBar(message.file);
                
                // Update file watcher to watch the new file
                watcher.close();
                const newIssuesPath = getStorage().getIssuesFilePath();
                outputChannel!.appendLine(`Switching watcher to: ${newIssuesPath}`);
                watcher = fs.watch(newIssuesPath, async (eventType) => {
                  if (eventType === 'change') {
                    outputChannel!.appendLine('Issues file changed, updating tasks...');
                    await updateTasks();
                  }
                });
                
                // Update indicators in other panels
                taskListPanels.forEach((updateFn, otherPanel) => {
                  if (otherPanel !== panel) {
                    otherPanel.webview.postMessage({
                      type: 'updateActiveFile',
                      currentFile: message.file,
                      availableFiles: getAvailableIssueFiles(cairnDir!)
                    });
                  }
                });
                
                // Reload tasks in THIS webview
                await updateTasks();
                
                vscode.window.showInformationMessage(`Switched to ${message.file} (${newFileName})`);
              } else if (message.type === 'editTicket') {
                outputChannel!.appendLine(`Edit ticket message received for: ${message.id}`);
                try {
                  await vscode.commands.executeCommand('cairn.editTicket', message.id);
                } catch (error) {
                  outputChannel!.appendLine(`ERROR executing edit command: ${error instanceof Error ? error.message : String(error)}`);
                }
              } else if (message.type === 'createTicket') {
                outputChannel!.appendLine('Create ticket message received');
                try {
                  await vscode.commands.executeCommand('cairn.createTicket');
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
              outputChannel!.appendLine('Loading issues...');
              const issues = await getStorage().loadIssues();
              outputChannel!.appendLine(`Loaded ${issues.length} issues`);
              outputChannel!.appendLine(`Issue IDs: ${issues.map(i => i.id).join(', ')}`);
              
              // IMPORTANT: Map issues to the format expected by the webview
              const allTasks = issues.map(task => ({
                id: task.id,
                title: task.title,
                status: task.status,
                priority: task.priority || 'medium',
                description: task.description || '',
                type: task.type || 'task',
                completion_percentage: task.completion_percentage,
                acceptance_criteria: task.acceptance_criteria || [],
                dependencies: task.dependencies || [],
                subtasks: getGraph().getEpicSubtasks(task.id, issues).map(s => ({
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
              const availableFiles = getAvailableIssueFiles(cairnDir!);
              
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
          const currentIssuesPath = getStorage().getIssuesFilePath();
          outputChannel!.appendLine(`Watching issues file: ${currentIssuesPath}`);
          watcher = fs.watch(currentIssuesPath, async (eventType) => {
            if (eventType === 'change') {
              outputChannel!.appendLine('Issues file changed, updating tasks...');
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

    // Register command to edit a ticket
    context.subscriptions.push(
      vscode.commands.registerCommand('cairn.editTicket', async (id: string, options?: { viewColumn?: vscode.ViewColumn }) => {
        outputChannel!.appendLine(`cairn.editTicket called with id: ${id}`);
        try {
          // Load ticket data first to get the title for the panel
          const issues = await getStorage().loadIssues();
          const ticket = issues.find(i => i.id === id);
          const displayTitle = ticket ? truncateTitle(ticket.title, id) : `Edit Ticket #${id}`;

          const panel = vscode.window.createWebviewPanel(
            'cairnEditTicket',
            displayTitle,
            options?.viewColumn || vscode.ViewColumn.Beside,
            {
              enableScripts: true,
              localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
            }
          );

          const pendingTicketId = id;
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
  <title>Edit Issue</title>
  <link rel="stylesheet" href="${cssUri}">
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
          panel.webview.html = htmlContent;

          // Load ticket data
          const loadTicket = async (ticketId: string) => {
            try {
              const issues = await getStorage().loadIssues();
              const ticket = issues.find(i => i.id === ticketId);

              let safeTicket;
              if (ticket) {
                safeTicket = {
                  ...ticket,
                  title: ticket.title,
                  description: ticket.description,
                  type: ticket.type,
                  priority: ticket.priority,
                  status: ticket.status,
                  acceptance_criteria: ticket.acceptance_criteria || [],
                  completion_percentage: ticket.completion_percentage
                };
              } else {
                outputChannel!.appendLine(`Ticket not found: ${ticketId} - sending default data`);
                safeTicket = {
                  id: ticketId,
                  title: 'New Ticket',
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
              const subtasks = ticket ? getGraph().getEpicSubtasks(ticketId, issues).map(s => ({
                id: s.id,
                title: s.title,
                type: s.type,
                status: s.status,
                priority: s.priority,
                completion_percentage: s.completion_percentage
              })) : [];

              // Get dependencies
              const dependencies: WebviewDependency[] = [];
              if (ticket) {
                // Get issues that block this issue (blocked_by stored)
                const blockerDeps = ticket.dependencies?.filter((d: Dependency) => d.type === 'blocked_by' || d.type === 'blocks') || [];
                for (const dep of blockerDeps) {
                  const blocker = issues.find(i => i.id === dep.id);
                  if (blocker) {
                    dependencies.push({
                      id: blocker.id,
                      title: blocker.title,
                      type: blocker.type,
                      status: blocker.status,
                      priority: blocker.priority,
                      direction: 'blocked_by', // This issue is blocked by these
                      completion_percentage: blocker.completion_percentage
                    });
                  }
                }
                
                // Get issues that this issue blocks (blocking) - COMPUTED from other issues' 'blocked_by' dependencies
                const blockedByIssues = issues.filter(i => 
                  i.dependencies?.some((d: Dependency) => d.id === ticketId && (d.type === 'blocked_by' || d.type === 'blocks'))
                );
                for (const blocked of blockedByIssues) {
                  dependencies.push({
                    id: blocked.id,
                    title: blocked.title,
                    type: blocked.type,
                    status: blocked.status,
                    priority: blocked.priority,
                    direction: 'blocks', // This issue blocks these
                    completion_percentage: blocked.completion_percentage
                  });
                }
              }

              outputChannel!.appendLine(`Sending loadTicket message for: ${ticketId}`);
              panel.webview.postMessage({
                type: 'loadTicket',
                ticket: {
                  ...safeTicket,
                  subtasks,
                  dependencies
                }
              });
            } catch (error) {
              outputChannel!.appendLine(`Error loading ticket: ${error}`);
            }
          };

          // Handle messages from webview
          panel.webview.onDidReceiveMessage(async (message) => {
            try {
              if (message.type === 'webviewReady') {
                outputChannel!.appendLine(`Webview ready, loading ticket: ${pendingTicketId}`);
                webviewReady = true;
                await loadTicket(pendingTicketId);
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
                const issues = await getStorage().loadIssues();
                const availableSubtasks = getGraph().getNonParentedIssues(issues)
                  .filter(issue => issue.id !== pendingTicketId)
                  .filter(issue => {
                    // Check if adding this as a subtask would create a circular dependency
                    return !getGraph().wouldCreateCycle(issue.id, pendingTicketId, 'parent-child', issues);
                  })
                  .map(issue => ({
                    id: issue.id,
                    title: issue.title,
                    type: issue.type,
                    status: issue.status,
                    priority: issue.priority,
                    description: issue.description || '',
                    wouldCreateCycle: false // All remaining items are safe
                  }));
                panel.webview.postMessage({
                  type: 'availableSubtasks',
                  subtasks: availableSubtasks
                });
              } else if (message.type === 'getAvailableDependencies') {
                outputChannel!.appendLine('Getting available dependencies');
                const issues = await getStorage().loadIssues();
                const availableDependencies = issues
                  .filter(issue => issue.id !== pendingTicketId)
                  .filter(issue => !getGraph().getEpicSubtasks(pendingTicketId, issues).some(s => s.id === issue.id))
                  .filter(issue => !issue.dependencies?.some((d: Dependency) => d.type === 'parent-child' && (d.from === pendingTicketId || d.to === pendingTicketId)))
                  .map(issue => {
                    // Check if adding this as a dependency would create a circular dependency
                    let wouldCreateCycle = false;
                    try {
                      // For blocked_by dependencies, we need to check cycles
                      // This is a simplified check - we'll mark items that would create cycles
                      getGraph().addDependency(pendingTicketId, issue.id, 'blocked_by', issues);
                    } catch (error) {
                      wouldCreateCycle = true;
                    }
                    return {
                      id: issue.id,
                      title: issue.title,
                      type: issue.type,
                      status: issue.status,
                      priority: issue.priority,
                      description: issue.description || '',
                      wouldCreateCycle
                    };
                  });
                panel.webview.postMessage({
                  type: 'availableDependencies',
                  dependencies: availableDependencies
                });
              } else if (message.type === 'saveTicket') {
                saveQueue = saveQueue.then(async () => {
                  outputChannel!.appendLine(`Received saveTicket message: ${message.ticket.id}`);
                  const ticketData = message.ticket;

                  if (ticketData.id) {
                    try {
                      outputChannel!.appendLine('Starting save operation...');
                      let updatedIssues = await getStorage().loadIssues();
                      outputChannel!.appendLine(`Loaded issues, count: ${updatedIssues.length}`);

                      const currentSubtasks = getGraph().getEpicSubtasks(ticketData.id, updatedIssues);
                      const currentIds = new Set(currentSubtasks.map(s => s.id));
                      const newSubtasks = ticketData.subtasks as { id?: string; title: string }[];
                      const newIds = new Set(newSubtasks.filter(s => s.id).map(s => s.id!));

                      const now = new Date().toISOString();

                      // Update main ticket
                      const originalIssue = updatedIssues.find(i => i.id === ticketData.id);
                      
                      // Check if trying to CHANGE status to closed (not just saving an already-closed issue)
                      const isChangingToClosed = ticketData.status === 'closed' && originalIssue?.status !== 'closed';
                      if (isChangingToClosed) {
                        const validation = getGraph().canCloseIssue(ticketData.id, updatedIssues);

                        if (!validation.canClose) {
                          // Send simplified error message to webview to revert UI state
                          panel.webview.postMessage({
                            type: 'saveFailed',
                            error: 'Cannot close issue as it is not 100% complete.',
                            errorCode: 'CANNOT_CLOSE_INCOMPLETE'
                          });

                          const currentIssue = updatedIssues.find(i => i.id === ticketData.id);
                          let errorMsg = `Cannot close issue "${currentIssue?.title || ticketData.id}" (${ticketData.id})`;
                          
                          if (validation.reason) {
                            errorMsg += ` because it ${validation.reason}`;
                          }
                          if (validation.completionPercentage !== undefined) {
                            errorMsg += ` (currently ${validation.completionPercentage}% complete)`;
                          }
                          errorMsg += '. Please complete all requirements before closing this issue.';

                          vscode.window.showErrorMessage(errorMsg);
                          return; // Don't save the ticket
                        }
                      }
                      updatedIssues = updatedIssues.map(issue => {
                        if (issue.id === ticketData.id) {
                          const updated = {
                            ...issue,
                            title: ticketData.title,
                            description: ticketData.description,
                            comments: ticketData.comments,
                            type: ticketData.type || 'task',
                            priority: ticketData.priority || 'medium',
                            status: ticketData.status || 'open',
                            acceptance_criteria: ticketData.acceptance_criteria,
                            updated_at: now
                          };

                          if (ticketData.status === 'closed' && issue.status !== 'closed') {
                            updated.closed_at = now;
                          } else if (ticketData.status !== 'closed' && issue.status === 'closed') {
                            updated.closed_at = undefined;
                          }

                          return updated;
                        }
                        return issue;
                      });

                      // Update existing subtask titles
                      updatedIssues = updatedIssues.map(issue => {
                        const subtask = newSubtasks.find(s => s.id === issue.id);
                        if (subtask) {
                          return { ...issue, title: subtask.title, updated_at: now };
                        }
                        return issue;
                      });

                      // Remove dependencies for deleted subtasks
                      for (const subId of currentIds) {
                        if (!newIds.has(subId)) {
                          updatedIssues = getGraph().removeDependency(subId, ticketData.id, updatedIssues);
                        }
                      }

                      // Add dependencies for newly added existing subtasks
                      for (const subId of newIds) {
                        if (!currentIds.has(subId)) {
                          updatedIssues = getGraph().addDependency(subId, ticketData.id, 'parent-child', updatedIssues);
                        }
                      }

                      // Handle dependencies
                      if (originalIssue) {
                        // Get current blockers (what blocks this issue)
                        const currentBlockers = originalIssue.dependencies?.filter((d: Dependency) => d.type === 'blocked_by' || d.type === 'blocks').map((d: Dependency) => d.id) || [];
                        // Get new blockers from UI (only 'blocked_by' direction is stored)
                        const newBlockers = ticketData.dependencies.filter((d: WebviewDependency) => d.direction === 'blocked_by').map((d: WebviewDependency) => d.id);
                        
                        // Note: We ignore 'blocks' direction from UI since that's computed
                        // The 'blocks' list in the UI shows issues that this one blocks,
                        // but we never modify those relationships from this issue's save

                        // Remove blockers that were deleted
                        for (const blockerId of currentBlockers) {
                          if (!newBlockers.includes(blockerId)) {
                            updatedIssues = getGraph().removeDependency(ticketData.id, blockerId, updatedIssues);
                          }
                        }

                        // Add new blockers
                        for (const blockerId of newBlockers) {
                          if (!currentBlockers.includes(blockerId)) {
                            updatedIssues = getGraph().addDependency(ticketData.id, blockerId, 'blocked_by', updatedIssues);
                          }
                        }
                      }

                      await getStorage().updateIssues(() => updatedIssues);
                      outputChannel!.appendLine('Save operation complete');

                      const updatedTicket = updatedIssues.find(i => i.id === ticketData.id);
                      if (updatedTicket) {
                        panel.title = truncateTitle(updatedTicket.title, ticketData.id);
                      }

                      // Reload ticket data from storage to get recalculated completion percentage
                      outputChannel!.appendLine('Reloading ticket data after save to get updated completion percentage');
                      await loadTicket(pendingTicketId);
                    } catch (saveError) {
                      outputChannel!.appendLine(`Save operation failed: ${saveError}`);
                      const errorMsg = saveError instanceof Error ? saveError.message : String(saveError);
                      vscode.window.showErrorMessage(`Failed to save ticket ${ticketData.id}: ${errorMsg}`);
                      throw saveError;
                    }
                  } else {
                    outputChannel!.appendLine('No ticket ID provided for save operation');
                  }
                }).catch(error => {
                  outputChannel!.appendLine(`Queued save operation failed: ${error}`);
                });
              } else if (message.type === 'editTicket') {
                outputChannel!.appendLine(`Edit ticket message received from editor for: ${message.id}`);
                try {
                  await vscode.commands.executeCommand('cairn.editTicket', message.id, { viewColumn: vscode.ViewColumn.Active });
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
                  const comment = await getStorage().addComment(message.issueId, message.author, message.content);
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
              vscode.window.showErrorMessage(`Failed to save ticket: ${errorMessage}`);
            }
          });
        } catch (error) {
          outputChannel!.appendLine(`Error in cairn.editTicket: ${error}`);
          vscode.window.showErrorMessage(`Failed to edit ticket: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
    );

    // Register command to create a new ticket
    context.subscriptions.push(
      vscode.commands.registerCommand('cairn.createTicket', async () => {
        outputChannel!.appendLine('cairn.createTicket called');
        try {
          outputChannel!.appendLine('Creating new ticket...');
          const issues = await getStorage().loadIssues();
          const newId = generateId(issues);
          const newTicket = {
            id: newId,
            title: 'New Ticket',
            description: 'Add description...',
            type: 'task' as const,
            status: 'open' as const,
            priority: 'medium' as const,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          outputChannel!.appendLine(`Saving new ticket: ${newId}`);
          await getStorage().saveIssue(newTicket);
          outputChannel!.appendLine('New ticket created successfully');

          // Now open it for editing
          await vscode.commands.executeCommand('cairn.editTicket', newId);
        } catch (error) {
          outputChannel!.appendLine(`Error creating ticket: ${error}`);
          const errorMsg = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Failed to create ticket: ${errorMsg}`);
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
    const issues = await getStorage().loadIssues();
    const taskToDelete = issues.find(i => i.id === taskId);
    if (!taskToDelete) {
      throw new Error(`Task ${taskId} not found`);
    }

    const subtasks = getGraph().getEpicSubtasks(taskId, issues);
    let updatedIssues = issues;
    for (const subtask of subtasks) {
      updatedIssues = getGraph().removeDependency(subtask.id, taskId, updatedIssues);
    }

    updatedIssues = updatedIssues.filter(i => i.id !== taskId);
    await getStorage().updateIssues(() => updatedIssues);

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
