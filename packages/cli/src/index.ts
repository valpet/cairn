#!/usr/bin/env node

import 'reflect-metadata';
import { Command } from 'commander';
import { createContainer, TYPES, IStorageService, IGraphService, ICompactionService, IGitService } from '@horizon/core';
import * as path from 'path';
import * as fs from 'fs';

const program = new Command();

program
  .name('horizon')
  .description('CLI for Horizon task management')
  .version('1.0.0');

const cwd = process.cwd();
const { horizonDir, repoRoot } = findHorizonDir(cwd);

console.log('CWD:', cwd);
console.log('Horizon dir:', horizonDir);
console.log('Repo root:', repoRoot);

// Ensure .horizon exists
if (!fs.existsSync(horizonDir)) {
  console.error('No .horizon directory found. Run `npx horizon init` in your project root.');
  process.exit(1);
}

const container = createContainer(horizonDir, repoRoot);
const storage = container.get<IStorageService>(TYPES.IStorageService);
const graph = container.get<IGraphService>(TYPES.IGraphService);
const compaction = container.get<ICompactionService>(TYPES.ICompactionService);
const git = container.get<IGitService>(TYPES.IGitService);

// Create command
program
  .command('create <title>')
  .description('Create a new issue')
  .option('-d, --description <desc>', 'Description')
  .option('-t, --type <type>', 'Type: epic, feature, task, bug')
  .option('-p, --priority <priority>', 'Priority: low, medium, high, urgent')
  .action(async (title, options) => {
    const issues = await storage.loadIssues();
    const id = generateId(issues);
    const issue = {
      id,
      title,
      description: options.description,
      type: options.type as any,
      status: 'open' as const,
      priority: options.priority as any,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await storage.saveIssue(issue);
    console.log(`Created issue ${id}: ${title}`);
    await git.commitChanges(`Create issue ${id}`);
  });

// Init command
program
  .command('init')
  .description('Initialize Horizon in the project')
  .option('-s, --stealth', 'Enable stealth mode (add .horizon to .gitignore)')
  .action(async (options) => {
    // .horizon already created above
    if (options.stealth) {
      const gitignorePath = path.join(cwd, '.gitignore');
      let gitignore = '';
      if (fs.existsSync(gitignorePath)) {
        gitignore = await fs.promises.readFile(gitignorePath, 'utf-8');
      }
      if (!gitignore.includes('.horizon')) {
        gitignore += '\n.horizon\n';
        await fs.promises.writeFile(gitignorePath, gitignore);
        console.log('Added .horizon to .gitignore for stealth mode');
      }
    }

    // Copy copilot instructions
    const githubDir = path.join(cwd, '.github');
    if (!fs.existsSync(githubDir)) {
      fs.mkdirSync(githubDir, { recursive: true });
    }
    const instructionsPath = path.join(githubDir, 'copilot-instructions.md');
    const horizonInstructions = `
## Horizon Task Management Instructions
As a GitHub Copilot agent, you MUST work task-based using Horizon tools for all development work. This ensures long-horizon memory and prevents context overflow.

### Initialization
- Horizon has been initialized in this project. Use \`horizon_get_ready_work\` MCP tool (or \`horizon list --ready\` as backup) to see available tasks.

### Task Management
- **Always start by checking ready work**: Use \`horizon_get_ready_work\` MCP tool (or \`horizon list --ready\` as backup) to see unblocked tasks.
- **Break down large tasks**: Use \`horizon_add_dependency\` MCP tool with 'parent-child' type (or \`horizon dep add <subtask> <parent> --type parent-child\` as backup) to create hierarchical subtasks.
- **Create new tasks**: Use \`horizon_create_issue\` MCP tool (or \`horizon create <title> -d <description> -p <priority>\` as backup) for any work discovered.
- **Track discoveries**: When finding new work, use \`horizon_add_dependency\` MCP tool with 'discovered-from' type (or \`horizon dep add <newtask> <current> --type discovered-from\` as backup).
- **Update progress**: Regularly update task status with \`horizon_update_issue\` MCP tool (or \`horizon update <id> -s <status> -n <notes>\` as backup).
- **Document implementation details**: Add detailed notes on decisions, challenges, and solutions.
- **Mark completion**: Set status to 'closed' when done, include acceptance criteria with \`horizon_update_issue\` MCP tool (or \`horizon update <id> -c <criteria>\` as backup).

### Self-Review Process
- After implementing any feature, perform a brutal self-review:
  - Run \`horizon review <id>\` for checklist prompts.
  - Check code quality, edge cases, error handling.
  - Update acceptance criteria if not met.
  - Add notes on what was learned or improved.
  - If issues found, create subtasks for fixes.
- Review task dependencies: Ensure no blockers remain.

### Subtasks Support
- Horizon supports subtasks via 'parent-child' dependency type.
- Create parent epics, then subtasks linked with \`horizon_add_dependency\` MCP tool (or \`dep add <sub> <parent> --type parent-child\` as backup).
- Use \`horizon_get_ready_work\` MCP tool (or \`list --ready\` as backup) to find next actionable subtasks.

### Memory Management
- Compaction automatically summarizes old closed tasks to save context.
- Git integration preserves history across sessions.
- Always document progress to recover context later.

By following this workflow, you maintain coherent, persistent task memory without losing track of complex, multi-session work.`;

    if (fs.existsSync(instructionsPath)) {
      const existing = await fs.promises.readFile(instructionsPath, 'utf-8');
      if (!existing.includes('Horizon Task Management Instructions')) {
        await fs.promises.appendFile(instructionsPath, '\n' + horizonInstructions);
        console.log('Appended Horizon workflow guidelines to existing .github/copilot-instructions.md');
      } else {
        console.log('Horizon instructions already present in .github/copilot-instructions.md');
      }
    } else {
      await fs.promises.writeFile(instructionsPath, '<!-- Horizon Task Management Instructions for GitHub Copilot Agents -->\n' + horizonInstructions);
      console.log('Created .github/copilot-instructions.md with Horizon workflow guidelines');
    }

    console.log('Horizon initialized. Start by creating your first task with \`horizon create <title>\`');
    console.log('For programmatic access, configure your MCP client to use the Horizon MCP server for seamless task management.');
    await git.initIfNeeded();
    await git.commitChanges('Initialize Horizon');
  });

// Update command
program
  .command('update <id>')
  .description('Update an issue')
  .option('-s, --status <status>', 'Status: open, in_progress, closed, blocked')
  .option('-t, --title <title>', 'Title')
  .option('-d, --description <desc>', 'Description')
  .option('-y, --type <type>', 'Type: epic, feature, task, bug')
  .option('-n, --notes <notes>', 'Notes')
  .option('-p, --priority <priority>', 'Priority: low, medium, high, urgent')
  .option('-a, --assignee <assignee>', 'Assignee')
  .option('-l, --labels <labels>', 'Labels (comma-separated)')
  .option('-c, --acceptance-criteria <criteria>', 'Acceptance criteria (comma-separated)')
  .action(async (id, options) => {
    let issues = await storage.loadIssues();
    issues = issues.map(issue => {
      if (issue.id === id) {
        const updated = { ...issue, updated_at: new Date().toISOString() };
        if (options.status) updated.status = options.status;
        if (options.title) updated.title = options.title;
        if (options.description) updated.description = options.description;
        if (options.type) updated.type = options.type;
        if (options.notes) updated.notes = options.notes;
        if (options.priority) updated.priority = options.priority;
        if (options.assignee) updated.assignee = options.assignee;
        if (options.labels) updated.labels = options.labels.split(',');
        if (options.acceptanceCriteria) updated.acceptance_criteria = options.acceptanceCriteria.split(',');
        if (options.status === 'closed') updated.closed_at = new Date().toISOString();
        return updated;
      }
      return issue;
    });
    // Rewrite file
    await rewriteIssues(issues);
    console.log(`Updated issue ${id}`);
    await git.commitChanges(`Update issue ${id}`);
  });

// List command
program
  .command('list')
  .description('List issues')
  .option('-s, --status <status>', 'Filter by status')
  .option('-t, --type <type>', 'Filter by type: epic, feature, task, bug')
  .option('-r, --ready', 'Show only ready work')
  .action(async (options) => {
    let issues = await storage.loadIssues();
    issues = compaction.compactIssues(issues);
    if (options.ready) {
      issues = graph.getReadyWork(issues);
    } else {
      if (options.status) {
        issues = issues.filter(i => i.status === options.status);
      }
      if (options.type) {
        issues = issues.filter(i => i.type === options.type);
      }
    }
    issues.forEach(issue => {
      const typeStr = issue.type ? `[${issue.type}]` : '';
      console.log(`${issue.id}: ${issue.title} [${issue.status}] ${typeStr}`);
    });
  });

// Dep command
const depCmd = program.command('dep');
depCmd
  .command('add <from> <to>')
  .description('Add dependency')
  .option('-t, --type <type>', 'Type: blocks, related, parent-child, discovered-from', 'blocks')
  .action(async (from, to, options) => {
    let issues = await storage.loadIssues();
    issues = graph.addDependency(from, to, options.type, issues);
    await rewriteIssues(issues);
    console.log(`Added ${options.type} dependency from ${from} to ${to}`);
    await git.commitChanges(`Add dependency ${from} -> ${to}`);
  });

// Review command
program
  .command('review <id>')
  .description('Perform self-review on a task')
  .action(async (id) => {
    const issues = await storage.loadIssues();
    const issue = issues.find(i => i.id === id);
    if (!issue) {
      console.error(`Issue ${id} not found`);
      return;
    }
    console.log(`Reviewing issue ${id}: ${issue.title}`);
    console.log('Checklist:');
    console.log('- Code quality: Check for best practices, readability, performance');
    console.log('- Edge cases: Ensure all scenarios handled');
    console.log('- Error handling: Proper error management');
    console.log('- Tests: Adequate test coverage');
    console.log('- Dependencies: No blockers remain');
    console.log('Update with: horizon update <id> -n "Review notes" -c "Criteria met"');
  });

program.parse();

function generateId(issues: any[]): string {
  const existingIds = new Set(issues.map(i => i.id));
  let id;
  do {
    id = 'bd-' + Math.random().toString(36).substr(2, 6);
  } while (existingIds.has(id));
  return id;
}

async function rewriteIssues(issues: any[]) {
  const filePath = storage.getIssuesFilePath();
  const content = issues.map(i => JSON.stringify(i)).join('\n') + '\n';
  await fs.promises.writeFile(filePath, content);
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
      // Reached root
      const fallbackHorizon = path.join(startDir, '.horizon');
      return { horizonDir: fallbackHorizon, repoRoot: startDir };
    }
    currentDir = parentDir;
  }
}