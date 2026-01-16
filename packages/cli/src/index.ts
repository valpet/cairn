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

// Update command
program
  .command('update <id>')
  .description('Update an issue')
  .option('-s, --status <status>', 'Status: open, in_progress, closed, blocked')
  .option('-t, --title <title>', 'Title')
  .option('-d, --description <desc>', 'Description')
  .action(async (id, options) => {
    let issues = await storage.loadIssues();
    issues = issues.map(issue => {
      if (issue.id === id) {
        const updated = { ...issue, updated_at: new Date().toISOString() };
        if (options.status) updated.status = options.status;
        if (options.title) updated.title = options.title;
        if (options.description) updated.description = options.description;
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

// Dep add command
program
  .command('dep add <from> <to>')
  .description('Add dependency')
  .option('-t, --type <type>', 'Type: blocks, related, parent-child, discovered-from', 'blocks')
  .action(async (from, to, options) => {
    let issues = await storage.loadIssues();
    issues = graph.addDependency(from, to, options.type, issues);
    await rewriteIssues(issues);
    console.log(`Added ${options.type} dependency from ${from} to ${to}`);
    await git.commitChanges(`Add dependency ${from} -> ${to}`);
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