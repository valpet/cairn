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
const horizonDir = path.join(cwd, '.horizon');

// Ensure .horizon exists
if (!fs.existsSync(horizonDir)) {
  fs.mkdirSync(horizonDir, { recursive: true });
}

const container = createContainer(horizonDir, cwd);
const storage = container.get<IStorageService>(TYPES.IStorageService);
const graph = container.get<IGraphService>(TYPES.IGraphService);
const compaction = container.get<ICompactionService>(TYPES.ICompactionService);
const git = container.get<IGitService>(TYPES.IGitService);

// Create command
program
  .command('create <title>')
  .description('Create a new issue')
  .option('-d, --description <desc>', 'Description')
  .option('-p, --priority <priority>', 'Priority: low, medium, high, urgent')
  .action(async (title, options) => {
    const issues = await storage.loadIssues();
    const id = generateId(issues);
    const issue = {
      id,
      title,
      description: options.description,
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
    console.log('Horizon initialized. Start by creating your first task with `horizon create <title>`');
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
  .option('-r, --ready', 'Show only ready work')
  .action(async (options) => {
    let issues = await storage.loadIssues();
    issues = compaction.compactIssues(issues);
    if (options.ready) {
      issues = graph.getReadyWork(issues);
    } else if (options.status) {
      issues = issues.filter(i => i.status === options.status);
    }
    issues.forEach(issue => {
      console.log(`${issue.id}: ${issue.title} [${issue.status}]`);
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