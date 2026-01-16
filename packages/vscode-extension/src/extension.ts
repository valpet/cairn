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
}

export function deactivate() { }

function generateId(issues: any[]): string {
  const existingIds = new Set(issues.map(i => i.id));
  let id;
  do {
    id = nanoid(8);
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