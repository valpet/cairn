import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { createContainer, TYPES, IStorageService, IGraphService, IGitService } from '@horizon/core';
import { nanoid } from 'nanoid';

let container: any;
let storage: IStorageService;
let graph: IGraphService;
let git: IGitService;

export function activate(context: vscode.ExtensionContext) {
  console.log('Horizon extension activated');
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found');
    return;
  }

  const startDir = workspaceFolder.uri.fsPath;
  const { horizonDir, repoRoot } = findHorizonDir(startDir);
  if (!fs.existsSync(horizonDir)) {
    vscode.window.showErrorMessage('No .horizon directory found. Run `npx horizon init` in your project root.');
    return;
  }

  container = createContainer(horizonDir, repoRoot);
  storage = container.get(TYPES.IStorageService);
  graph = container.get(TYPES.IGraphService);
  git = container.get(TYPES.IGitService);

  // Register tools
  context.subscriptions.push(
    vscode.lm.registerTool('horizon_create', {
      invoke: async (options, token) => {
        try {
          const inputs = options.input as any;
          const issues = await storage.loadIssues();
          const id = generateId(issues);
          const issue = {
            id,
            title: inputs.title,
            description: inputs.description || '',
            type: 'task' as const,
            status: 'open' as const,
            priority: inputs.priority || 'medium',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await storage.saveIssue(issue);
          await git.commitChanges(`Create issue ${id}`);
          return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Created issue ${id}: ${inputs.title}`, id }) }] };
        } catch (error) {
          const err = error as Error;
          return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `Error creating issue: ${err.message}` }) }] };
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.lm.registerTool('horizon_list_ready', {
      invoke: async (options, token) => {
        try {
          const issues = await storage.loadIssues();
          const readyIssues = graph.getReadyWork(issues);
          const result = readyIssues.map(issue => ({
            id: issue.id,
            title: issue.title,
            status: issue.status,
            priority: issue.priority
          }));
          return { content: [{ type: 'text', text: JSON.stringify({ success: true, readyTasks: result }) }] };
        } catch (error) {
          const err = error as Error;
          return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `Error listing ready tasks: ${err.message}` }) }] };
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.lm.registerTool('horizon_update', {
      invoke: async (options, token) => {
        try {
          const inputs = options.input as any;
          await storage.updateIssues(issues => {
            return issues.map(issue => {
              if (issue.id === inputs.id) {
                const updated = { ...issue, updated_at: new Date().toISOString() };
                if (inputs.status) updated.status = inputs.status;
                if (inputs.notes) updated.notes = inputs.notes;
                if (inputs.acceptance_criteria) updated.acceptance_criteria = inputs.acceptance_criteria;
                if (inputs.status === 'closed') updated.closed_at = new Date().toISOString();
                return updated;
              }
              return issue;
            });
          });
          await git.commitChanges(`Update issue ${inputs.id}`);
          return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Updated issue ${inputs.id}` }) }] };
        } catch (error) {
          const err = error as Error;
          return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `Error updating issue: ${err.message}` }) }] };
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.lm.registerTool('horizon_dep_add', {
      invoke: async (options, token) => {
        try {
          const inputs = options.input as any;
          await storage.updateIssues(issues => {
            return graph.addDependency(inputs.from, inputs.to, inputs.type, issues);
          });
          await git.commitChanges(`Add dependency ${inputs.from} -> ${inputs.to}`);
          return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Added ${inputs.type} dependency from ${inputs.from} to ${inputs.to}` }) }] };
        } catch (error) {
          const err = error as Error;
          return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `Error adding dependency: ${err.message}` }) }] };
        }
      }
    })
  );

  // Register command to open task list webview
  context.subscriptions.push(
    vscode.commands.registerCommand('horizon.openTaskList', async () => {
      console.log('=== Creating task list panel ===');
      const panel = vscode.window.createWebviewPanel(
        'horizonTaskList',
        'Horizon Task List',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
        }
      );
      console.log('=== Panel created ===');

      // Handle messages from webview - MUST BE SET UP BEFORE HTML IS LOADED
      console.log('=== Registering message handler ===');
      const disposable = panel.webview.onDidReceiveMessage(async (message) => {
        console.log('=== MESSAGE RECEIVED ===', message);
        console.log('Message type:', message.type);
        console.log('Message id:', message.id);
        try {
          if (message.type === 'startTask') {
            console.log('Starting task:', message.id);
            await storage.updateIssues(issues => {
              return issues.map(issue => {
                if (issue.id === message.id) {
                  return { ...issue, status: 'in_progress', updated_at: new Date().toISOString() };
                }
                return issue;
              });
            });
            await git.commitChanges(`Start task ${message.id}`);
          } else if (message.type === 'completeTask') {
            console.log('Completing task:', message.id);
            await storage.updateIssues(issues => {
              return issues.map(issue => {
                if (issue.id === message.id) {
                  return { ...issue, status: 'closed', updated_at: new Date().toISOString(), closed_at: new Date().toISOString() };
                }
                return issue;
              });
            });
            await git.commitChanges(`Complete task ${message.id}`);
          } else if (message.type === 'editTicket') {
            console.log('Edit ticket message received for:', message.id);
            try {
              await vscode.commands.executeCommand('horizon.editTicket', message.id);
              console.log('Edit command executed successfully');
            } catch (error) {
              console.error('Error executing edit command:', error);
            }
          } else if (message.type === 'createTicket') {
            console.log('Create ticket message received');
            try {
              await vscode.commands.executeCommand('horizon.createTicket');
              console.log('Create command executed successfully');
            } catch (error) {
              console.error('Error executing create command:', error);
            }
          }
        } catch (error) {
          console.error('Error handling webview message:', error);
        }
      });
      console.log('=== Message handler registered ===');
      context.subscriptions.push(disposable);

      // Load HTML
      console.log('=== Loading HTML ===');
      const htmlPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'index.html'));
      const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');
      panel.webview.html = htmlContent;

      // Function to update tasks
      const updateTasks = async () => {
        try {
          const issues = await storage.loadIssues();
          const allTasks = issues.map(task => ({
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority || 'medium',
            description: task.description || '',
            type: task.type || 'task',
            dependencies: task.dependencies || []
          }));
          panel.webview.postMessage({
            type: 'updateTasks',
            tasks: allTasks
          });
        } catch (error) {
          console.error('Error updating tasks:', error);
        }
      };

      // Initial update
      await updateTasks();

      // Watch for file changes
      const issuesPath = path.join(horizonDir, 'issues.jsonl');
      const watcher = fs.watch(issuesPath, async (eventType) => {
        if (eventType === 'change') {
          await updateTasks();
        }
      });

      // Clean up watcher on panel disposal
      panel.onDidDispose(() => {
        watcher.close();
      });
    })
  );

  // Register command to edit a ticket
  context.subscriptions.push(
    vscode.commands.registerCommand('horizon.editTicket', async (id: string) => {
      const panel = vscode.window.createWebviewPanel(
        'horizonEditTicket',
        'Edit Ticket',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
        }
      );

      // Load HTML
      const htmlPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'edit.html'));
      const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');
      panel.webview.html = htmlContent;

      // Load ticket data
      const loadTicket = async () => {
        try {
          const issues = await storage.loadIssues();
          const ticket = issues.find(i => i.id === id);
          if (ticket) {
            // Get subtasks
            const subtasks = graph.getEpicSubtasks(id, issues).map(s => ({ id: s.id, title: s.title }));
            panel.webview.postMessage({
              type: 'loadTicket',
              ticket: {
                ...ticket,
                subtasks
              }
            });
          }
        } catch (error) {
          console.error('Error loading ticket:', error);
        }
      };

      await loadTicket();

      // Handle messages from webview
      panel.webview.onDidReceiveMessage(async (message) => {
        try {
          if (message.type === 'saveTicket') {
            const ticketData = message.ticket;
            const issues = await storage.loadIssues();
            if (ticketData.id) {
              // Update existing
              await storage.updateIssues(issues => {
                return issues.map(issue => {
                  if (issue.id === ticketData.id) {
                    return {
                      ...issue,
                      title: ticketData.title,
                      description: ticketData.description,
                      type: ticketData.type,
                      priority: ticketData.priority,
                      updated_at: new Date().toISOString()
                    };
                  }
                  return issue;
                });
              });
              // Handle subtasks
              const currentSubtasks = graph.getEpicSubtasks(ticketData.id, issues);
              const currentIds = new Set(currentSubtasks.map(s => s.id));
              const newSubtasks = ticketData.subtasks as { id?: string; title: string }[];
              const newIds = new Set(newSubtasks.filter(s => s.id).map(s => s.id!));
              // Remove dependencies for removed subtasks
              for (const subId of currentIds) {
                if (!newIds.has(subId)) {
                  await storage.updateIssues(iss => graph.removeDependency(subId, ticketData.id, iss));
                }
              }
              // Update or add subtasks
              for (const sub of newSubtasks) {
                if (sub.id) {
                  // Update title
                  await storage.updateIssues(iss => {
                    return iss.map(issue => {
                      if (issue.id === sub.id) {
                        return { ...issue, title: sub.title, updated_at: new Date().toISOString() };
                      }
                      return issue;
                    });
                  });
                } else {
                  // Create new
                  const newSubId = generateId(issues);
                  const newSub = {
                    id: newSubId,
                    title: sub.title,
                    description: '',
                    type: 'task' as const,
                    status: 'open' as const,
                    priority: 'medium' as const,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  };
                  await storage.saveIssue(newSub);
                  await storage.updateIssues(iss => graph.addDependency(newSubId, ticketData.id, 'parent-child', iss));
                }
              }
              await git.commitChanges(`Update ticket ${ticketData.id}`);
            } else {
              // Create new
              const newId = generateId(issues);
              const newTicket = {
                id: newId,
                title: ticketData.title,
                description: ticketData.description,
                type: ticketData.type,
                status: 'open' as const,
                priority: ticketData.priority,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              await storage.saveIssue(newTicket);
              // Handle subtasks for new ticket
              const newSubtasks = ticketData.subtasks as { id?: string; title: string }[];
              for (const sub of newSubtasks) {
                const newSubId = generateId([...issues, newTicket]);
                const newSub = {
                  id: newSubId,
                  title: sub.title,
                  description: '',
                  type: 'task' as const,
                  status: 'open' as const,
                  priority: 'medium' as const,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
                await storage.saveIssue(newSub);
                await storage.updateIssues(iss => graph.addDependency(newSubId, newId, 'parent-child', iss));
              }
              await git.commitChanges(`Create ticket ${newId}`);
            }
            panel.dispose(); // Close panel after save
          }
        } catch (error) {
          console.error('Error saving ticket:', error);
        }
      });
    })
  );

  // Register command to create a new ticket
  context.subscriptions.push(
    vscode.commands.registerCommand('horizon.createTicket', async () => {
      const panel = vscode.window.createWebviewPanel(
        'horizonEditTicket',
        'Create Ticket',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
        }
      );

      // Load HTML
      const htmlPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'edit.html'));
      const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');
      panel.webview.html = htmlContent;

      // No loadTicket, since new

      // Handle messages
      panel.webview.onDidReceiveMessage(async (message) => {
        try {
          if (message.type === 'saveTicket') {
            const ticketData = message.ticket;
            const issues = await storage.loadIssues();
            const newId = generateId(issues);
            const newTicket = {
              id: newId,
              title: ticketData.title,
              description: ticketData.description,
              type: ticketData.type,
              status: 'open' as const,
              priority: ticketData.priority,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            await storage.saveIssue(newTicket);
            // Handle subtasks for new ticket
            const newSubtasks = ticketData.subtasks as { id?: string; title: string }[];
            for (const sub of newSubtasks) {
              const newSubId = generateId([...issues, newTicket]);
              const newSub = {
                id: newSubId,
                title: sub.title,
                description: '',
                type: 'task' as const,
                status: 'open' as const,
                priority: 'medium' as const,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              await storage.saveIssue(newSub);
              await storage.updateIssues(iss => graph.addDependency(newSubId, newId, 'parent-child', iss));
            }
            await git.commitChanges(`Create ticket ${newId}`);
            panel.dispose(); // Close panel after save
          }
        } catch (error) {
          console.error('Error saving ticket:', error);
        }
      });
    })
  );
}

export function deactivate() { }

function generateId(issues: any[]): string {
  const existingIds = new Set(issues.map(i => i.id));
  let id;
  do {
    id = 'h-' + nanoid(8);
  } while (existingIds.has(id));
  return id;
}

function findHorizonDir(startDir: string): { horizonDir: string; repoRoot: string } {
  let currentDir = startDir;
  while (true) {
    const horizonPath = path.join(currentDir, '.horizon');
    const issuesPath = path.join(horizonPath, 'issues.jsonl');
    if (fs.existsSync(horizonPath) && fs.existsSync(issuesPath)) {
      return { horizonDir: horizonPath, repoRoot: currentDir };
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      const fallbackHorizon = path.join(startDir, '.horizon');
      return { horizonDir: fallbackHorizon, repoRoot: startDir };
    }
    currentDir = parentDir;
  }
}