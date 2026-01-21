import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { createContainer, TYPES, IStorageService, IGraphService, findCairnDir, generateId } from '../../core/dist/index.js';

let container: any;
let storage: IStorageService;
let graph: IGraphService;
let outputChannel: vscode.OutputChannel;

// Tool implementations
class CairnCreateTool implements vscode.LanguageModelTool<any> {
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<any>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: `Creating task: ${options.input.title}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<any>,
    _token: vscode.CancellationToken
  ) {
    try {
      const inputs = options.input;
      const issues = await storage.loadIssues();
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
      await storage.saveIssue(issue);

      if (inputs.parent) {
        await storage.updateIssues(issues => {
          return graph.addDependency(id, inputs.parent, 'parent-child', issues);
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

class CairnListReadyTool implements vscode.LanguageModelTool<any> {
  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<any>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: 'Listing ready tasks',
    };
  }

  async invoke(
    _options: vscode.LanguageModelToolInvocationOptions<any>,
    _token: vscode.CancellationToken
  ) {
    try {
      const issues = await storage.loadIssues();
      const readyIssues = graph.getReadyWork(issues);
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

class CairnUpdateTool implements vscode.LanguageModelTool<any> {
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<any>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: `Updating task ${options.input.id}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<any>,
    _token: vscode.CancellationToken
  ) {
    try {
      const inputs = options.input;

      await storage.updateIssues(issues => {
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

class CairnDepAddTool implements vscode.LanguageModelTool<any> {
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<any>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: `Adding ${options.input.type} dependency from ${options.input.from} to ${options.input.to}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<any>,
    _token: vscode.CancellationToken
  ) {
    try {
      const inputs = options.input;
      await storage.updateIssues(issues => {
        return graph.addDependency(inputs.from, inputs.to, inputs.type, issues);
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

class CairnCommentTool implements vscode.LanguageModelTool<any> {
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<any>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: `Adding comment to issue ${options.input.issue_id}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<any>,
    _token: vscode.CancellationToken
  ) {
    try {
      const inputs = options.input;
      const comment = await storage.addComment(inputs.issue_id, inputs.author || 'agent', inputs.content);
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

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Cairn');
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine('Cairn extension activated');

  // Utility function to truncate long titles with ellipsis in the middle
  function truncateTitle(title: string, id: string, maxLength = 30): string {
    const suffix = ` (#${id})`;
    const maxTitleLength = maxLength - suffix.length;

    if (title.length <= maxTitleLength) {
      return `${title}${suffix}`;
    }

    // Show first part and ellipsis, keeping ID at end
    const truncated = title.substring(0, maxTitleLength - 3) + '...';
    return `${truncated}${suffix}`;
  }

  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    outputChannel.appendLine(`Workspace folders: ${vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath).join(', ')}`);

    if (!workspaceFolder) {
      outputChannel.appendLine('ERROR: No workspace folder found');
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    outputChannel.appendLine(`Using workspace folder: ${workspaceFolder.uri.fsPath}`);
    const startDir = workspaceFolder.uri.fsPath;
    const { cairnDir, repoRoot } = findCairnDir(startDir);
    outputChannel.appendLine(`Cairn dir: ${cairnDir}, Repo root: ${repoRoot}`);

    if (!fs.existsSync(cairnDir)) {
      outputChannel.appendLine(`ERROR: No .cairn directory found at: ${cairnDir}`);
      vscode.window.showErrorMessage('No .cairn directory found. Run `npx cairn init` in your project root.');
      return;
    }

    outputChannel.appendLine('Creating container...');
    container = createContainer(cairnDir, repoRoot);
    outputChannel.appendLine('Getting storage service...');
    storage = container.get(TYPES.IStorageService);
    outputChannel.appendLine('Getting graph service...');
    graph = container.get(TYPES.IGraphService);
    outputChannel.appendLine('Services initialized successfully');

    // Register tools
    context.subscriptions.push(vscode.lm.registerTool('cairn_create', new CairnCreateTool()));
    context.subscriptions.push(vscode.lm.registerTool('cairn_list_ready', new CairnListReadyTool()));
    context.subscriptions.push(vscode.lm.registerTool('cairn_update', new CairnUpdateTool()));
    context.subscriptions.push(vscode.lm.registerTool('cairn_dep_add', new CairnDepAddTool()));
    context.subscriptions.push(vscode.lm.registerTool('cairn_comment', new CairnCommentTool()));

    // Register command to open task list webview
    context.subscriptions.push(
      vscode.commands.registerCommand('cairn.openTaskList', async () => {
        outputChannel.appendLine('=== cairn.openTaskList command called ===');
        try {
          outputChannel.appendLine('Creating task list panel...');
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
          outputChannel.appendLine('Panel created successfully');

          let webviewReady = false;

          // Handle messages from webview
          const disposable = panel.webview.onDidReceiveMessage(async (message) => {
            outputChannel.appendLine(`=== WEBVIEW MESSAGE RECEIVED ===`);
            outputChannel.appendLine(`Message type: ${message.type}`);
            outputChannel.appendLine(`Full message: ${JSON.stringify(message)}`);
            try {
              if (message.type === 'webviewReady') {
                outputChannel.appendLine('Task list webview ready');
                webviewReady = true;
                await updateTasks();
              } else if (message.type === 'startTask') {
                outputChannel.appendLine(`Starting task: ${message.id}`);
                await storage.updateIssues(issues => {
                  return issues.map(issue => {
                    if (issue.id === message.id) {
                      return { ...issue, status: 'in_progress', updated_at: new Date().toISOString() };
                    }
                    return issue;
                  });
                });
                await updateTasks();
              } else if (message.type === 'completeTask') {
                outputChannel.appendLine(`Completing task: ${message.id}`);
                await storage.updateIssues(issues => {
                  return issues.map(issue => {
                    if (issue.id === message.id) {
                      return { ...issue, status: 'closed', updated_at: new Date().toISOString(), closed_at: new Date().toISOString() };
                    }
                    return issue;
                  });
                });
                await updateTasks();
              } else if (message.type === 'editTicket') {
                outputChannel.appendLine(`Edit ticket message received for: ${message.id}`);
                try {
                  await vscode.commands.executeCommand('cairn.editTicket', message.id);
                } catch (error) {
                  outputChannel.appendLine(`ERROR executing edit command: ${error instanceof Error ? error.message : String(error)}`);
                }
              } else if (message.type === 'createTicket') {
                outputChannel.appendLine('Create ticket message received');
                try {
                  await vscode.commands.executeCommand('cairn.createTicket');
                } catch (error) {
                  outputChannel.appendLine(`ERROR executing create command: ${error instanceof Error ? error.message : String(error)}`);
                }
              } else if (message.type === 'deleteTask') {
                outputChannel.appendLine(`Delete task message received for: ${message.id}`);
                try {
                  await deleteTask(message.id);
                  await updateTasks();
                } catch (error) {
                  outputChannel.appendLine(`ERROR deleting task: ${error}`);
                }
              }
            } catch (error) {
              outputChannel.appendLine(`ERROR handling webview message: ${error instanceof Error ? error.message : String(error)}`);
              if (error instanceof Error && error.stack) {
                outputChannel.appendLine(`Stack: ${error.stack}`);
              }
            }
          });
          context.subscriptions.push(disposable);

          // Load HTML
          outputChannel.appendLine('Loading HTML...');
          const htmlPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'index.html'));
          outputChannel.appendLine(`HTML path: ${htmlPath.fsPath}`);
          if (fs.existsSync(htmlPath.fsPath)) {
            const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');
            outputChannel.appendLine(`HTML content length: ${htmlContent.length} characters`);
            outputChannel.appendLine(`HTML starts with: ${htmlContent.substring(0, 100)}`);
            panel.webview.html = htmlContent;
            outputChannel.appendLine('HTML loaded successfully');
          } else {
            outputChannel.appendLine(`ERROR: HTML file not found: ${htmlPath.fsPath}`);
            panel.webview.html = '<html><body><h1>HTML file not found</h1></body></html>';
          }

          // Function to update tasks
          const updateTasks = async () => {
            if (!webviewReady) {
              outputChannel.appendLine('Webview not ready yet, skipping updateTasks');
              return;
            }
            try {
              outputChannel.appendLine('Loading issues...');
              const issues = await storage.loadIssues();
              outputChannel.appendLine(`Loaded ${issues.length} issues`);
              outputChannel.appendLine(`Issue IDs: ${issues.map(i => i.id).join(', ')}`);
              const allTasks = issues.map(task => ({
                id: task.id,
                title: task.title,
                status: task.status,
                priority: task.priority || 'medium',
                description: task.description || '',
                type: task.type || 'task',
                dependencies: task.dependencies || []
              }));
              outputChannel.appendLine(`Sending updateTasks with ${allTasks.length} tasks`);
              outputChannel.appendLine(`Tasks data: ${JSON.stringify(allTasks.slice(0, 2))}`);
              const messageResult = panel.webview.postMessage({
                type: 'updateTasks',
                tasks: allTasks
              });
              outputChannel.appendLine(`PostMessage result: ${messageResult}`);
            } catch (error) {
              outputChannel.appendLine(`ERROR updating tasks: ${error instanceof Error ? error.message : String(error)}`);
              if (error instanceof Error && error.stack) {
                outputChannel.appendLine(`Stack: ${error.stack}`);
              }
            }
          };

          // Watch for file changes
          const issuesPath = path.join(cairnDir, 'issues.jsonl');
          outputChannel.appendLine(`Watching issues file: ${issuesPath}`);
          const watcher = fs.watch(issuesPath, async (eventType) => {
            if (eventType === 'change') {
              outputChannel.appendLine('Issues file changed, updating tasks...');
              await updateTasks();
            }
          });

          // Clean up watcher on panel disposal
          panel.onDidDispose(() => {
            outputChannel.appendLine('Panel disposed, closing watcher');
            watcher.close();
          });

          outputChannel.appendLine('Task list setup complete');
        } catch (error) {
          outputChannel.appendLine(`ERROR in cairn.openTaskList: ${error instanceof Error ? error.message : String(error)}`);
          vscode.window.showErrorMessage(`Failed to open task list: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
    );

    // Register command to edit a ticket
    context.subscriptions.push(
      vscode.commands.registerCommand('cairn.editTicket', async (id: string, options?: { viewColumn?: vscode.ViewColumn }) => {
        outputChannel.appendLine(`cairn.editTicket called with id: ${id}`);
        try {
          // Load ticket data first to get the title for the panel
          const issues = await storage.loadIssues();
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

          // Load HTML
          const htmlPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'edit.html'));
          if (fs.existsSync(htmlPath.fsPath)) {
            const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');
            panel.webview.html = htmlContent;
          } else {
            outputChannel.appendLine(`Edit HTML file not found: ${htmlPath.fsPath}`);
            panel.webview.html = '<html><body><h1>Edit HTML file not found</h1></body></html>';
          }

          // Load ticket data
          const loadTicket = async (ticketId: string) => {
            try {
              const issues = await storage.loadIssues();
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
                  acceptance_criteria: ticket.acceptance_criteria
                };
              } else {
                outputChannel.appendLine(`Ticket not found: ${ticketId} - sending default data`);
                safeTicket = {
                  id: ticketId,
                  title: 'New Ticket',
                  description: 'Add description...',
                  type: 'task',
                  priority: 'medium',
                  status: 'open',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
              }

              // Get subtasks
              const subtasks = ticket ? graph.getEpicSubtasks(ticketId, issues).map(s => ({
                id: s.id,
                title: s.title,
                type: s.type,
                status: s.status,
                priority: s.priority
              })) : [];

              // Get dependencies
              const dependencies: any[] = [];
              if (ticket) {
                const blockerDeps = ticket.dependencies?.filter((d: any) => d.type === 'blocks') || [];
                for (const dep of blockerDeps) {
                  const blocker = issues.find(i => i.id === dep.id);
                  if (blocker) {
                    dependencies.push({
                      id: blocker.id,
                      title: blocker.title,
                      type: blocker.type,
                      status: blocker.status,
                      priority: blocker.priority,
                      direction: 'blocks'
                    });
                  }
                }
                const blockedByIssues = issues.filter(i => i.dependencies?.some((d: any) => d.id === ticketId && d.type === 'blocks'));
                for (const blocked of blockedByIssues) {
                  dependencies.push({
                    id: blocked.id,
                    title: blocked.title,
                    type: blocked.type,
                    status: blocked.status,
                    priority: blocked.priority,
                    direction: 'blocked_by'
                  });
                }
              }

              outputChannel.appendLine(`Sending loadTicket message for: ${ticketId}`);
              panel.webview.postMessage({
                type: 'loadTicket',
                ticket: {
                  ...safeTicket,
                  subtasks,
                  dependencies
                }
              });
            } catch (error) {
              outputChannel.appendLine(`Error loading ticket: ${error}`);
            }
          };

          // Handle messages from webview
          panel.webview.onDidReceiveMessage(async (message) => {
            try {
              if (message.type === 'webviewReady') {
                outputChannel.appendLine(`Webview ready, loading ticket: ${pendingTicketId}`);
                webviewReady = true;
                await loadTicket(pendingTicketId);
              } else if (message.type === 'getGitUser') {
                outputChannel.appendLine('Getting git user info');
                const { execSync } = require('child_process');
                let gitUserName = '';
                let gitUserEmail = '';
                try {
                  gitUserName = execSync('git config user.name', { cwd: repoRoot, encoding: 'utf-8' }).trim();
                } catch (e) {
                  outputChannel.appendLine('Could not get git user.name');
                }
                try {
                  gitUserEmail = execSync('git config user.email', { cwd: repoRoot, encoding: 'utf-8' }).trim();
                } catch (e) {
                  outputChannel.appendLine('Could not get git user.email');
                }
                panel.webview.postMessage({
                  type: 'gitUserInfo',
                  userName: gitUserName,
                  userEmail: gitUserEmail
                });
              } else if (message.type === 'getAvailableSubtasks') {
                outputChannel.appendLine('Getting available subtasks');
                const issues = await storage.loadIssues();
                const availableSubtasks = graph.getNonParentedIssues(issues)
                  .filter(issue => issue.id !== pendingTicketId)
                  .map(issue => ({
                    id: issue.id,
                    title: issue.title,
                    type: issue.type,
                    status: issue.status,
                    priority: issue.priority,
                    description: issue.description || ''
                  }));
                panel.webview.postMessage({
                  type: 'availableSubtasks',
                  subtasks: availableSubtasks
                });
              } else if (message.type === 'getAvailableDependencies') {
                outputChannel.appendLine('Getting available dependencies');
                const issues = await storage.loadIssues();
                const availableDependencies = issues
                  .filter(issue => issue.id !== pendingTicketId)
                  .filter(issue => !graph.getEpicSubtasks(pendingTicketId, issues).some(s => s.id === issue.id))
                  .filter(issue => !issue.dependencies?.some((d: any) => d.type === 'parent-child' && (d.from === pendingTicketId || d.to === pendingTicketId)))
                  .map(issue => ({
                    id: issue.id,
                    title: issue.title,
                    type: issue.type,
                    status: issue.status,
                    priority: issue.priority,
                    description: issue.description || ''
                  }));
                panel.webview.postMessage({
                  type: 'availableDependencies',
                  dependencies: availableDependencies
                });
              } else if (message.type === 'saveTicket') {
                saveQueue = saveQueue.then(async () => {
                  outputChannel.appendLine(`Received saveTicket message: ${message.ticket.id}`);
                  const ticketData = message.ticket;

                  if (ticketData.id) {
                    try {
                      outputChannel.appendLine('Starting save operation...');
                      let updatedIssues = await storage.loadIssues();
                      outputChannel.appendLine(`Loaded issues, count: ${updatedIssues.length}`);

                      const currentSubtasks = graph.getEpicSubtasks(ticketData.id, updatedIssues);
                      const currentIds = new Set(currentSubtasks.map(s => s.id));
                      const newSubtasks = ticketData.subtasks as { id?: string; title: string }[];
                      const newIds = new Set(newSubtasks.filter(s => s.id).map(s => s.id!));

                      const now = new Date().toISOString();

                      // Update main ticket
                      const originalIssue = updatedIssues.find(i => i.id === ticketData.id);
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
                          updatedIssues = graph.removeDependency(subId, ticketData.id, updatedIssues);
                        }
                      }

                      // Add dependencies for newly added existing subtasks
                      for (const subId of newIds) {
                        if (!currentIds.has(subId)) {
                          updatedIssues = graph.addDependency(subId, ticketData.id, 'parent-child', updatedIssues);
                        }
                      }

                      // Handle dependencies
                      if (originalIssue) {
                        const currentBlockers = originalIssue.dependencies?.filter((d: any) => d.type === 'blocks').map((d: any) => d.id) || [];
                        const newBlockers = ticketData.dependencies.filter((d: any) => d.direction === 'blocks').map((d: any) => d.id);
                        const currentBlockedBy = updatedIssues.filter((i: any) => i.dependencies?.some((d: any) => d.id === ticketData.id && d.type === 'blocks')).map((i: any) => i.id);
                        const newBlockedBy = ticketData.dependencies.filter((d: any) => d.direction === 'blocked_by').map((d: any) => d.id);

                        for (const blockerId of currentBlockers) {
                          if (!newBlockers.includes(blockerId)) {
                            updatedIssues = graph.removeDependency(ticketData.id, blockerId, updatedIssues);
                          }
                        }

                        for (const blockerId of newBlockers) {
                          if (!currentBlockers.includes(blockerId)) {
                            updatedIssues = graph.addDependency(ticketData.id, blockerId, 'blocks', updatedIssues);
                          }
                        }

                        for (const blockedId of currentBlockedBy) {
                          if (!newBlockedBy.includes(blockedId)) {
                            updatedIssues = graph.removeDependency(blockedId, ticketData.id, updatedIssues);
                          }
                        }

                        for (const blockedId of newBlockedBy) {
                          if (!currentBlockedBy.includes(blockedId)) {
                            updatedIssues = graph.addDependency(blockedId, ticketData.id, 'blocks', updatedIssues);
                          }
                        }
                      }

                      await storage.updateIssues(() => updatedIssues);
                      outputChannel.appendLine('Save operation complete');

                      const updatedTicket = updatedIssues.find(i => i.id === ticketData.id);
                      if (updatedTicket) {
                        panel.title = truncateTitle(updatedTicket.title, ticketData.id);
                      }
                    } catch (saveError) {
                      outputChannel.appendLine(`Save operation failed: ${saveError}`);
                      const errorMsg = saveError instanceof Error ? saveError.message : String(saveError);
                      vscode.window.showErrorMessage(`Failed to save ticket ${ticketData.id}: ${errorMsg}`);
                      throw saveError;
                    }
                  } else {
                    outputChannel.appendLine('No ticket ID provided for save operation');
                  }
                }).catch(error => {
                  outputChannel.appendLine(`Queued save operation failed: ${error}`);
                });
              } else if (message.type === 'editTicket') {
                outputChannel.appendLine(`Edit ticket message received from editor for: ${message.id}`);
                try {
                  await vscode.commands.executeCommand('cairn.editTicket', message.id, { viewColumn: vscode.ViewColumn.Active });
                } catch (error) {
                  outputChannel.appendLine(`Error executing edit command from editor: ${error}`);
                }
              } else if (message.type === 'deleteTask') {
                outputChannel.appendLine(`Delete task message received from editor for: ${message.id}`);
                try {
                  await deleteTask(message.id);
                  panel.dispose();
                } catch (error) {
                  outputChannel.appendLine(`Error deleting task from editor: ${error}`);
                }
              } else if (message.type === 'addComment') {
                outputChannel.appendLine(`Add comment message received: ${JSON.stringify(message)}`);
                try {
                  const comment = await storage.addComment(message.issueId, message.author, message.content);
                  outputChannel.appendLine(`Comment added successfully: ${JSON.stringify(comment)}`);
                  panel.webview.postMessage({
                    type: 'commentAdded',
                    comment: comment
                  });
                } catch (error) {
                  outputChannel.appendLine(`Error adding comment: ${error}`);
                  vscode.window.showErrorMessage(`Failed to add comment: ${error instanceof Error ? error.message : String(error)}`);
                }
              }
            } catch (error) {
              outputChannel.appendLine(`Error in message handler: ${error}`);
              const errorMessage = error instanceof Error ? error.message : String(error);
              vscode.window.showErrorMessage(`Failed to save ticket: ${errorMessage}`);
            }
          });
        } catch (error) {
          outputChannel.appendLine(`Error in cairn.editTicket: ${error}`);
          vscode.window.showErrorMessage(`Failed to edit ticket: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
    );

    // Register command to create a new ticket
    context.subscriptions.push(
      vscode.commands.registerCommand('cairn.createTicket', async () => {
        outputChannel.appendLine('cairn.createTicket called');
        try {
          outputChannel.appendLine('Creating new ticket...');
          const issues = await storage.loadIssues();
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
          outputChannel.appendLine(`Saving new ticket: ${newId}`);
          await storage.saveIssue(newTicket);
          outputChannel.appendLine('New ticket created successfully');

          // Now open it for editing
          await vscode.commands.executeCommand('cairn.editTicket', newId);
        } catch (error) {
          outputChannel.appendLine(`Error creating ticket: ${error}`);
          const errorMsg = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Failed to create ticket: ${errorMsg}`);
        }
      })
    );

    outputChannel.appendLine('All Cairn commands registered successfully');
  } catch (error) {
    outputChannel.appendLine(`Error during extension activation: ${error}`);
    vscode.window.showErrorMessage(`Cairn extension failed to activate: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function deactivate() { }

async function deleteTask(taskId: string): Promise<void> {
  outputChannel.appendLine(`deleteTask called for: ${taskId}`);
  try {
    const issues = await storage.loadIssues();
    const taskToDelete = issues.find(i => i.id === taskId);
    if (!taskToDelete) {
      throw new Error(`Task ${taskId} not found`);
    }

    const subtasks = graph.getEpicSubtasks(taskId, issues);
    let updatedIssues = issues;
    for (const subtask of subtasks) {
      updatedIssues = graph.removeDependency(subtask.id, taskId, updatedIssues);
    }

    updatedIssues = updatedIssues.filter(i => i.id !== taskId);
    await storage.updateIssues(() => updatedIssues);

    const subtaskCount = subtasks.length;
    if (subtaskCount > 0) {
      vscode.window.showInformationMessage(`Deleted task ${taskId} and unparented ${subtaskCount} subtask${subtaskCount === 1 ? '' : 's'}`);
    } else {
      vscode.window.showInformationMessage(`Deleted task ${taskId}`);
    }
  } catch (error) {
    outputChannel.appendLine(`Error deleting task: ${error}`);
    const err = error as Error;
    vscode.window.showErrorMessage(`Failed to delete task: ${err.message}`);
    throw error;
  }
}
