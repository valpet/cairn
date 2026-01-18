import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { createContainer, TYPES, IStorageService, IGraphService } from '@horizon/core';
import { nanoid } from 'nanoid';

let container: any;
let storage: IStorageService;
let graph: IGraphService;

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
          return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Added ${inputs.type} dependency from ${inputs.from} to ${inputs.to}` }) }] };
        } catch (error) {
          const err = error as Error;
          return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `Error adding dependency: ${err.message}` }) }] };
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.lm.registerTool('horizon_comment', {
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

      let webviewReady = false;

      // Handle messages from webview - MUST BE SET UP BEFORE HTML IS LOADED
      console.log('=== Registering message handler ===');
      const disposable = panel.webview.onDidReceiveMessage(async (message) => {
        console.log('=== MESSAGE RECEIVED ===', message);
        console.log('Message type:', message.type);
        console.log('Message id:', message.id);
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
            await updateTasks(); // Refresh the list
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
            await updateTasks(); // Refresh the list
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
          } else if (message.type === 'deleteTask') {
            console.log('Delete task message received for:', message.id);
            try {
              await deleteTask(message.id);
              await updateTasks(); // Refresh the list
              console.log('Task deleted successfully');
            } catch (error) {
              console.error('Error deleting task:', error);
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
        if (!webviewReady) {
          console.log('Webview not ready yet, skipping updateTasks');
          return;
        }
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

      let webviewReady = false;
      let pendingTicketId = id;
      let saveQueue = Promise.resolve(); // Queue to serialize save operations

      // Load HTML
      const htmlPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'edit.html'));
      const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');
      panel.webview.html = htmlContent;

      // Load ticket data
      const loadTicket = async (ticketId: string) => {
        try {
          const issues = await storage.loadIssues();
          const ticket = issues.find(i => i.id === ticketId);
          
          let safeTicket;
          if (ticket) {
            // Ensure ticket has required fields with defaults
            safeTicket = {
              ...ticket,
              title: ticket.title,
              description: ticket.description,
              type: ticket.type,
              priority: ticket.priority,
              status: ticket.status
            };
          } else {
            // Ticket not found, create default data
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
            // Blockers: tasks that this task depends on (dependencies with type 'blocks')
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
            // Blocked-by: tasks that depend on this task
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
          
          console.log('Sending loadTicket message for:', ticketId, safeTicket);
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
            await loadTicket(pendingTicketId);          } else if (message.type === 'getGitUser') {
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
            });          } else if (message.type === 'getAvailableSubtasks') {
            console.log('Getting available subtasks');
            const issues = await storage.loadIssues();
            const availableSubtasks = graph.getNonParentedIssues(issues)
              .filter(issue => issue.id !== pendingTicketId) // Exclude current ticket
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
              .filter(issue => issue.id !== pendingTicketId) // Exclude current ticket
              .filter(issue => !graph.getEpicSubtasks(pendingTicketId, issues).some(s => s.id === issue.id)) // Exclude subtasks
              .filter(issue => !issue.dependencies?.some((d: any) => d.type === 'parent-child' && (d.from === pendingTicketId || d.to === pendingTicketId))) // Exclude parent-child deps
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
            // Queue the save operation to prevent concurrent saves
            saveQueue = saveQueue.then(async () => {
              console.log('Received saveTicket message:', JSON.stringify(message.ticket, null, 2));
              const ticketData = message.ticket;
              console.log('ticketData.id:', ticketData.id, 'type:', typeof ticketData.id);

              if (ticketData.id) {
                try {
                  console.log('=== STARTING SAVE OPERATION ===');
                  // Update existing ticket in a single transaction
                  let updatedIssues = await storage.loadIssues();
                  console.log('Loaded issues, count:', updatedIssues.length);

                  const currentSubtasks = graph.getEpicSubtasks(ticketData.id, updatedIssues);
                  const currentIds = new Set(currentSubtasks.map(s => s.id));
                  const newSubtasks = ticketData.subtasks as { id?: string; title: string }[];
                  const newIds = new Set(newSubtasks.filter(s => s.id).map(s => s.id!));

                  // Build all changes in memory first
                  const now = new Date().toISOString();

                  // Update main ticket
                  const originalIssue = updatedIssues.find(i => i.id === ticketData.id);
                  console.log('Original issue:', JSON.stringify(originalIssue, null, 2));

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
                      
                      // Handle closed_at timestamp
                      if (ticketData.status === 'closed' && issue.status !== 'closed') {
                        updated.closed_at = now;
                      } else if (ticketData.status !== 'closed' && issue.status === 'closed') {
                        updated.closed_at = undefined;
                      }
                      
                      console.log('Updated issue:', JSON.stringify(updated, null, 2));
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
                    
                    // Remove blockers that are no longer present
                    for (const blockerId of currentBlockers) {
                      if (!newBlockers.includes(blockerId)) {
                        updatedIssues = graph.removeDependency(ticketData.id, blockerId, updatedIssues);
                      }
                    }
                    
                    // Add new blockers
                    for (const blockerId of newBlockers) {
                      if (!currentBlockers.includes(blockerId)) {
                        updatedIssues = graph.addDependency(ticketData.id, blockerId, 'blocks', updatedIssues);
                      }
                    }
                    
                    // Remove blocked-by that are no longer present
                    for (const blockedId of currentBlockedBy) {
                      if (!newBlockedBy.includes(blockedId)) {
                        updatedIssues = graph.removeDependency(blockedId, ticketData.id, updatedIssues);
                      }
                    }
                    
                    // Add new blocked-by
                    for (const blockedId of newBlockedBy) {
                      if (!currentBlockedBy.includes(blockedId)) {
                        updatedIssues = graph.addDependency(blockedId, ticketData.id, 'blocks', updatedIssues);
                      }
                    }
                  }

                  // Single write operation
                  console.log('Calling storage.updateIssues...');
                  await storage.updateIssues(() => updatedIssues);
                  console.log('storage.updateIssues completed');
                  console.log('=== SAVE OPERATION COMPLETE ===');
                } catch (saveError) {
                  console.error('=== SAVE OPERATION FAILED ===');
                  console.error('Error during save:', saveError);
                  console.error('Stack:', saveError instanceof Error ? saveError.stack : 'No stack');

                  // Show detailed error to user
                  const errorMsg = saveError instanceof Error ? saveError.message : String(saveError);
                  vscode.window.showErrorMessage(
                    `Failed to save ticket ${ticketData.id}: ${errorMsg}`,
                    'View Logs'
                  ).then(async (selection) => {
                    if (selection === 'View Logs') {
                      vscode.commands.executeCommand('workbench.action.output.toggleOutput');
                    }
                  });

                  throw saveError;
                }
              } else {
                console.error('No ticket ID provided for save operation');
              }
            }).catch(error => {
              // Error already logged and shown above
              console.error('Queued save operation failed:', error);
            });
          } else if (message.type === 'deleteTask') {
            console.log('Delete task message received from editor for:', message.id);
            try {
              await deleteTask(message.id);
              console.log('Task deleted successfully from editor');
              // Close the editor panel
              panel.dispose();
            } catch (error) {
              console.error('Error deleting task from editor:', error);
            }
          } else if (message.type === 'addComment') {
            console.log('Add comment message received:', message);
            try {
              const comment = await storage.addComment(message.issueId, message.author, message.content);
              console.log('Comment added successfully:', comment);
              // Send the comment back to the webview
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
          console.error('=== ERROR IN MESSAGE HANDLER ===');
          console.error('Error saving ticket:', error);
          console.error('Error type:', typeof error);
          console.error('Error details:', error instanceof Error ? error.message : String(error));
          console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');

          // Show error to user
          const errorMessage = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Failed to save ticket: ${errorMessage}`, 'View Logs').then(selection => {
            if (selection === 'View Logs') {
              vscode.commands.executeCommand('workbench.action.output.toggleOutput');
            }
          });
        }
      });
    })
  );

  // Register command to create a new ticket
  context.subscriptions.push(
    vscode.commands.registerCommand('horizon.createTicket', async () => {
      try {
        console.log('=== CREATING NEW TICKET ===');
        // Create ticket immediately with placeholder values
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
        vscode.commands.executeCommand('horizon.editTicket', newId);
      } catch (error) {
        console.error('=== ERROR CREATING TICKET ===');
        console.error('Error:', error);
        console.error('Stack:', error instanceof Error ? error.stack : 'No stack');

        const errorMsg = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to create ticket: ${errorMsg}`, 'View Logs').then(selection => {
          if (selection === 'View Logs') {
            vscode.commands.executeCommand('workbench.action.output.toggleOutput');
          }
        });
      }
    })
  );
}

export function deactivate() { }

async function deleteTask(taskId: string): Promise<void> {
  console.log('=== deleteTask CALLED ===', taskId);
  try {
    console.log('Loading issues...');
    const issues = await storage.loadIssues();
    console.log('Loaded', issues.length, 'issues');

    // Find the task to delete
    const taskToDelete = issues.find(i => i.id === taskId);
    if (!taskToDelete) {
      console.error('Task not found:', taskId);
      throw new Error(`Task ${taskId} not found`);
    }
    console.log('Found task to delete:', taskToDelete.title);

    // Get all subtasks (children) of this task
    const subtasks = graph.getEpicSubtasks(taskId, issues);
    console.log('Found', subtasks.length, 'subtasks');

    // Remove parent-child dependencies for all subtasks
    let updatedIssues = issues;
    for (const subtask of subtasks) {
      console.log('Removing dependency from subtask:', subtask.id);
      updatedIssues = graph.removeDependency(subtask.id, taskId, updatedIssues);
    }

    // Remove the task itself
    console.log('Filtering out task:', taskId);
    updatedIssues = updatedIssues.filter(i => i.id !== taskId);
    console.log('Updated issues count:', updatedIssues.length);

    // Save the updated issues
    console.log('Saving updated issues...');
    await storage.updateIssues(() => updatedIssues);
    console.log('Save complete');

    const subtaskCount = subtasks.length;
    if (subtaskCount > 0) {
      vscode.window.showInformationMessage(
        `Deleted task ${taskId} and unparented ${subtaskCount} subtask${subtaskCount === 1 ? '' : 's'}`
      );
    } else {
      vscode.window.showInformationMessage(`Deleted task ${taskId}`);
    }
    console.log('=== deleteTask COMPLETE ===');
  } catch (error) {
    console.error('=== deleteTask ERROR ===');
    const err = error as Error;
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    vscode.window.showErrorMessage(`Failed to delete task: ${err.message}`);
    throw error;
  }
}

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