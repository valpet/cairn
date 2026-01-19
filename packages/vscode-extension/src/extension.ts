import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { createContainer, TYPES, IStorageService, IGraphService } from '@cairn/core';
import { nanoid } from 'nanoid';

let container: any;
let storage: IStorageService;
let graph: IGraphService;

export function activate(context: vscode.ExtensionContext) {
  console.log('Cairn extension activated');

  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    console.log('Workspace folders:', vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath));

    if (!workspaceFolder) {
      console.error('No workspace folder found');
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    console.log('Using workspace folder:', workspaceFolder.uri.fsPath);
    const startDir = workspaceFolder.uri.fsPath;
    const { cairnDir, repoRoot } = findCairnDir(startDir);
    console.log('Cairn dir:', cairnDir, 'Repo root:', repoRoot);

    if (!fs.existsSync(cairnDir)) {
      console.error('No .cairn directory found at:', cairnDir);
      vscode.window.showErrorMessage('No .cairn directory found. Run `npx cairn init` in your project root.');
      return;
    }

    console.log('Creating container...');
    container = createContainer(cairnDir, repoRoot);
    console.log('Getting storage service...');
    storage = container.get(TYPES.IStorageService);
    console.log('Getting graph service...');
    graph = container.get(TYPES.IGraphService);
    console.log('Services initialized successfully');

    // Register tools
    context.subscriptions.push(
      vscode.lm.registerTool('cairn_create', {
        invoke: async (options, token) => {
          try {
            const inputs = options.input as any;
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

            // Add parent-child dependency if parent is specified
            if (inputs.parent) {
              await storage.updateIssues(issues => {
                return graph.addDependency(id, inputs.parent, 'parent-child', issues);
              });
            }

            return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Created issue ${id}: ${inputs.title}`, id }) }] };
          } catch (error) {
            const err = error as Error;
            return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `Error creating issue: ${err.message}` }) }] };
          }
        }
      })
    );

    context.subscriptions.push(
      vscode.lm.registerTool('cairn_list_ready', {
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
      vscode.lm.registerTool('cairn_update', {
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
            return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Updated issue ${inputs.id}` }) }] };
          } catch (error) {
            const err = error as Error;
            return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `Error updating issue: ${err.message}` }) }] };
          }
        }
      })
    );

    context.subscriptions.push(
      vscode.lm.registerTool('cairn_dep_add', {
        invoke: async (options, token) => {
          try {
            const inputs = options.input as any;
            await storage.updateIssues(issues => {
              return graph.addDependency(inputs.from, inputs.to, inputs.type, issues);
            });
            return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Added ${inputs.type} dependency from ${inputs.from} to ${inputs.to}` }) }] };
          } catch (error) {
            const err = error as Error;
            return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `Error adding dependency: ${err.message}` }) }] };
          }
        }
      })
    );

    context.subscriptions.push(
      vscode.lm.registerTool('cairn_comment', {
        invoke: async (options, token) => {
          try {
            const inputs = options.input as any;
            const comment = await storage.addComment(inputs.issue_id, inputs.author || 'agent', inputs.content);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `Added comment to issue ${inputs.issue_id}`,
                  comment: {
                    id: comment.id,
                    author: comment.author,
                    created_at: comment.created_at
                  }
                })
              }]
            };
          } catch (error) {
            const err = error as Error;
            return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `Error adding comment: ${err.message}` }) }] };
          }
        }
      })
    );

    // Register command to open task list webview
    context.subscriptions.push(
      vscode.commands.registerCommand('cairn.openTaskList', async () => {
        console.log('=== cairn.openTaskList command called ===');
        try {
          console.log('Creating task list panel...');
          const panel = vscode.window.createWebviewPanel(
            'cairnTaskList',
            'Cairn Task List',
            vscode.ViewColumn.One,
            {
              enableScripts: true,
              retainContextWhenHidden: true,
              localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
            }
          );
          console.log('Panel created successfully');

          let webviewReady = false;

          // Handle messages from webview
          const disposable = panel.webview.onDidReceiveMessage(async (message) => {
            console.log('Webview message received:', message.type);
            try {
              if (message.type === 'webviewReady') {
                console.log('Task list webview ready');
                webviewReady = true;
                await updateTasks();
              } else if (message.type === 'startTask') {
                console.log('Starting task:', message.id);
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
                console.log('Completing task:', message.id);
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
                console.log('Edit ticket message received for:', message.id);
                try {
                  await vscode.commands.executeCommand('cairn.editTicket', message.id);
                } catch (error) {
                  console.error('Error executing edit command:', error);
                }
              } else if (message.type === 'createTicket') {
                console.log('Create ticket message received');
                try {
                  await vscode.commands.executeCommand('cairn.createTicket');
                } catch (error) {
                  console.error('Error executing create command:', error);
                }
              } else if (message.type === 'deleteTask') {
                console.log('Delete task message received for:', message.id);
                try {
                  await deleteTask(message.id);
                  await updateTasks();
                } catch (error) {
                  console.error('Error deleting task:', error);
                }
              }
            } catch (error) {
              console.error('Error handling webview message:', error);
            }
          });
          context.subscriptions.push(disposable);

          // Load HTML
          console.log('Loading HTML...');
          const htmlPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'index.html'));
          console.log('HTML path:', htmlPath.fsPath);
          if (fs.existsSync(htmlPath.fsPath)) {
            const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');
            panel.webview.html = htmlContent;
            console.log('HTML loaded successfully');
          } else {
            console.error('HTML file not found:', htmlPath.fsPath);
            panel.webview.html = '<html><body><h1>HTML file not found</h1></body></html>';
          }

          // Function to update tasks
          const updateTasks = async () => {
            if (!webviewReady) {
              console.log('Webview not ready yet, skipping updateTasks');
              return;
            }
            try {
              console.log('Loading issues...');
              const issues = await storage.loadIssues();
              console.log('Loaded', issues.length, 'issues');
              const allTasks = issues.map(task => ({
                id: task.id,
                title: task.title,
                status: task.status,
                priority: task.priority || 'medium',
                description: task.description || '',
                type: task.type || 'task',
                dependencies: task.dependencies || []
              }));
              console.log('Sending updateTasks with', allTasks.length, 'tasks');
              panel.webview.postMessage({
                type: 'updateTasks',
                tasks: allTasks
              });
            } catch (error) {
              console.error('Error updating tasks:', error);
            }
          };

          // Watch for file changes
          const issuesPath = path.join(cairnDir, 'issues.jsonl');
          console.log('Watching issues file:', issuesPath);
          const watcher = fs.watch(issuesPath, async (eventType) => {
            if (eventType === 'change') {
              console.log('Issues file changed, updating tasks...');
              await updateTasks();
            }
          });

          // Clean up watcher on panel disposal
          panel.onDidDispose(() => {
            console.log('Panel disposed, closing watcher');
            watcher.close();
          });

          console.log('Task list setup complete');
        } catch (error) {
          console.error('Error in cairn.openTaskList:', error);
          vscode.window.showErrorMessage(`Failed to open task list: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
    );

    // Register command to edit a ticket
    context.subscriptions.push(
      vscode.commands.registerCommand('cairn.editTicket', async (id: string, options?: { viewColumn?: vscode.ViewColumn }) => {
        console.log('cairn.editTicket called with id:', id);
        try {
          // Load ticket data first to get the title for the panel
          const issues = await storage.loadIssues();
          const ticket = issues.find(i => i.id === id);
          const displayTitle = ticket ? `${ticket.title} (#${id})` : `Edit Ticket #${id}`;

          const panel = vscode.window.createWebviewPanel(
            'cairnEditTicket',
            displayTitle,
            options?.viewColumn || vscode.ViewColumn.Beside,
            {
              enableScripts: true,
              localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
            }
          );

          let webviewReady = false;
          let pendingTicketId = id;
          let saveQueue = Promise.resolve();

          // Load HTML
          const htmlPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'edit.html'));
          if (fs.existsSync(htmlPath.fsPath)) {
            const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');
            panel.webview.html = htmlContent;
          } else {
            console.error('Edit HTML file not found:', htmlPath.fsPath);
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
                  status: ticket.status
                };
              } else {
                console.error('Ticket not found:', ticketId, '- sending default data');
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

              console.log('Sending loadTicket message for:', ticketId);
              panel.webview.postMessage({
                type: 'loadTicket',
                ticket: {
                  ...safeTicket,
                  subtasks,
                  dependencies
                }
              });
            } catch (error) {
              console.error('Error loading ticket:', error);
            }
          };

          // Handle messages from webview
          panel.webview.onDidReceiveMessage(async (message) => {
            try {
              if (message.type === 'webviewReady') {
                console.log('Webview ready, loading ticket:', pendingTicketId);
                webviewReady = true;
                await loadTicket(pendingTicketId);
              } else if (message.type === 'getGitUser') {
                console.log('Getting git user info');
                const { execSync } = require('child_process');
                let gitUserName = '';
                let gitUserEmail = '';
                try {
                  gitUserName = execSync('git config user.name', { cwd: repoRoot, encoding: 'utf-8' }).trim();
                } catch (e) {
                  console.log('Could not get git user.name');
                }
                try {
                  gitUserEmail = execSync('git config user.email', { cwd: repoRoot, encoding: 'utf-8' }).trim();
                } catch (e) {
                  console.log('Could not get git user.email');
                }
                panel.webview.postMessage({
                  type: 'gitUserInfo',
                  userName: gitUserName,
                  userEmail: gitUserEmail
                });
              } else if (message.type === 'getAvailableSubtasks') {
                console.log('Getting available subtasks');
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
                console.log('Getting available dependencies');
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
                  console.log('Received saveTicket message:', message.ticket.id);
                  const ticketData = message.ticket;

                  if (ticketData.id) {
                    try {
                      console.log('Starting save operation...');
                      let updatedIssues = await storage.loadIssues();
                      console.log('Loaded issues, count:', updatedIssues.length);

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
                      console.log('Save operation complete');

                      const updatedTicket = updatedIssues.find(i => i.id === ticketData.id);
                      if (updatedTicket) {
                        panel.title = `${updatedTicket.title} (#${ticketData.id})`;
                      }
                    } catch (saveError) {
                      console.error('Save operation failed:', saveError);
                      const errorMsg = saveError instanceof Error ? saveError.message : String(saveError);
                      vscode.window.showErrorMessage(`Failed to save ticket ${ticketData.id}: ${errorMsg}`);
                      throw saveError;
                    }
                  } else {
                    console.error('No ticket ID provided for save operation');
                  }
                }).catch(error => {
                  console.error('Queued save operation failed:', error);
                });
              } else if (message.type === 'editTicket') {
                console.log('Edit ticket message received from editor for:', message.id);
                try {
                  await vscode.commands.executeCommand('cairn.editTicket', message.id, { viewColumn: vscode.ViewColumn.Active });
                } catch (error) {
                  console.error('Error executing edit command from editor:', error);
                }
              } else if (message.type === 'deleteTask') {
                console.log('Delete task message received from editor for:', message.id);
                try {
                  await deleteTask(message.id);
                  panel.dispose();
                } catch (error) {
                  console.error('Error deleting task from editor:', error);
                }
              } else if (message.type === 'addComment') {
                console.log('Add comment message received:', message);
                try {
                  const comment = await storage.addComment(message.issueId, message.author, message.content);
                  console.log('Comment added successfully:', comment);
                  panel.webview.postMessage({
                    type: 'commentAdded',
                    comment: comment
                  });
                } catch (error) {
                  console.error('Error adding comment:', error);
                  vscode.window.showErrorMessage(`Failed to add comment: ${error instanceof Error ? error.message : String(error)}`);
                }
              }
            } catch (error) {
              console.error('Error in message handler:', error);
              const errorMessage = error instanceof Error ? error.message : String(error);
              vscode.window.showErrorMessage(`Failed to save ticket: ${errorMessage}`);
            }
          });
        } catch (error) {
          console.error('Error in cairn.editTicket:', error);
          vscode.window.showErrorMessage(`Failed to edit ticket: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
    );

    // Register command to create a new ticket
    context.subscriptions.push(
      vscode.commands.registerCommand('cairn.createTicket', async () => {
        console.log('cairn.createTicket called');
        try {
          console.log('Creating new ticket...');
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
          console.log('Saving new ticket:', newId);
          await storage.saveIssue(newTicket);
          console.log('New ticket created successfully');

          // Now open it for editing
          await vscode.commands.executeCommand('cairn.editTicket', newId);
        } catch (error) {
          console.error('Error creating ticket:', error);
          const errorMsg = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Failed to create ticket: ${errorMsg}`);
        }
      })
    );

    console.log('All Cairn commands registered successfully');
  } catch (error) {
    console.error('Error during extension activation:', error);
    vscode.window.showErrorMessage(`Cairn extension failed to activate: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function deactivate() { }

async function deleteTask(taskId: string): Promise<void> {
  console.log('deleteTask called for:', taskId);
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
    console.error('Error deleting task:', error);
    const err = error as Error;
    vscode.window.showErrorMessage(`Failed to delete task: ${err.message}`);
    throw error;
  }
}

function generateId(issues: any[]): string {
  const existingIds = new Set(issues.map(i => i.id));
  let id;
  do {
    id = 's-' + nanoid(8);
  } while (existingIds.has(id));
  return id;
}

function findCairnDir(startDir: string): { cairnDir: string; repoRoot: string } {
  let currentDir = startDir;
  while (true) {
    const cairnPath = path.join(currentDir, '.cairn');
    const issuesPath = path.join(cairnPath, 'issues.jsonl');
    if (fs.existsSync(cairnPath) && fs.existsSync(issuesPath)) {
      return { cairnDir: cairnPath, repoRoot: currentDir };
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      const fallbackCairn = path.join(startDir, '.cairn');
      return { cairnDir: fallbackCairn, repoRoot: startDir };
    }
    currentDir = parentDir;
  }
}