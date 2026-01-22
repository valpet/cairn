#!/usr/bin/env node

import 'reflect-metadata';
import { Command } from 'commander';
import { createContainer, TYPES, IStorageService, IGraphService, ICompactionService, findCairnDir, generateId } from '../../core/dist/index.js';
import { Issue } from '../../core/dist/types.js';
import * as path from 'path';
import * as fs from 'fs';

const program = new Command();

program
  .name('cairn')
  .description('CLI for Cairn task management')
  .version('1.0.0');

const cwd = process.cwd();

function setupServices() {
  const { cairnDir, repoRoot } = findCairnDir(cwd);
  if (!fs.existsSync(cairnDir)) {
    console.error('No .cairn directory found. Run `npx cairn init` in your project root.');
    process.exit(1);
  }
  const container = createContainer(cairnDir, repoRoot);
  const storage = container.get<IStorageService>(TYPES.IStorageService);
  const graph = container.get<IGraphService>(TYPES.IGraphService);
  const compaction = container.get<ICompactionService>(TYPES.ICompactionService);
  return { storage, graph, compaction };
}

// Init command
program
  .command('init')
  .description('Initialize Cairn in the project')
  .option('-s, --stealth', 'Enable stealth mode (add .cairn to .gitignore)')
  .action(async (options) => {

    // Full initialization
    const cairnDir = path.join(cwd, '.cairn');
    if (!fs.existsSync(cairnDir)) {
      fs.mkdirSync(cairnDir, { recursive: true });
      console.log('Created .cairn directory');
    }

    // Create issues.jsonl if it doesn't exist
    const issuesPath = path.join(cairnDir, 'issues.jsonl');
    if (!fs.existsSync(issuesPath)) {
      await fs.promises.writeFile(issuesPath, '');
      console.log('Created issues.jsonl');
    }

    if (options.stealth) {
      const gitignorePath = path.join(cwd, '.gitignore');
      let gitignore = '';
      if (fs.existsSync(gitignorePath)) {
        gitignore = await fs.promises.readFile(gitignorePath, 'utf-8');
      }
      if (!gitignore.includes('.cairn')) {
        gitignore += '\n.cairn\n';
        await fs.promises.writeFile(gitignorePath, gitignore);
        console.log('Added .cairn to .gitignore for stealth mode');
      }
    }

    // Copy copilot instructions
    const githubDir = path.join(cwd, '.github');
    if (!fs.existsSync(githubDir)) {
      fs.mkdirSync(githubDir, { recursive: true });
    }
    const instructionsPath = path.join(githubDir, 'copilot-instructions.md');
        const cairnInstructions = `<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->
- This is the Cairn project: persistent memory for AI agents and developers. Replace messy markdown plans with a dependency-aware graph that maintains context across long development sessions.
- Use InversifyJS for dependency injection.
- Store tasks in .cairn/issues.jsonl, with git integration.
- Support stealth mode by gitignoring .cairn folder.
- Core library handles JSONL storage, dependency graphs, compaction.
- CLI provides commands: create, update, list, dep add, ac (acceptance criteria).


## Cairn: Persistent Memory for AI Agents

Cairn provides structured memory for AI agents and developers working on complex software projects. It replaces messy markdown plans with a dependency-aware graph, allowing agents to handle long-horizon tasks without losing context. By using Cairn, you can:

- **Replace messy markdown plans** with structured, dependency-aware task graphs
- **Maintain context across long sessions** without losing track of complex multi-step work
- **Handle long-horizon tasks** that span multiple development sessions
- **Collaborate seamlessly** with developers and other agents through shared task context
- **Preserve decision history** with automatic compaction and git-backed storage

### Getting Started
Cairn has been initialized in this project. To see available tasks, use the \`cairn_list_ready\` tool or run \`cairn list --ready\` in the terminal.

### Recommended Workflow
While you\'re free to work as you see fit, using Cairn will significantly improve your effectiveness on this project. Here\'s how to integrate it into your work:

- **Check for ready work first**: Before starting new tasks, use \`cairn_list_ready\` to see what tasks are unblocked and ready to work on.
- **Create tasks for significant work**: For any substantial changes or features, create a Cairn task using \\\`cairn_create\\\` (or \\\`cairn create <title> -d <description> -t <type> -p <priority> -s <status> -r <parent>\\\` in terminal).
- **Break down complex tasks**: Use \`cairn_dep_add\` with \'parent-child\' type to create subtasks for epics.
- **Track discoveries**: When you find new work during development, add it as a \'discovered-from\' dependency.
- **Update progress regularly**: Use \\\`cairn_update\\\` to mark tasks as in progress or close completed work.
- **Manage acceptance criteria**: Use the structured acceptance criteria system with inline editing and completion tracking:
  - **Add criteria**: Use \\\`cairn_ac_add\\\` tool with \\\`issue_id\\\` and \\\`text\\\` parameters, or \\\`cairn ac add <id> "<text>"\\\` in terminal
  - **Update criteria text**: Use \\\`cairn_ac_update\\\` tool with \\\`issue_id\\\`, \\\`index\\\`, and \\\`text\\\` parameters, or \\\`cairn ac update <id> <index> "<new text>"\\\` in terminal
  - **Remove criteria**: Use \\\`cairn_ac_remove\\\` tool with \\\`issue_id\\\` and \\\`index\\\` parameters, or \\\`cairn ac remove <id> <index>\\\` in terminal
  - **Toggle completion**: Use \\\`cairn_ac_toggle\\\` tool with \\\`issue_id\\\` and \\\`index\\\` parameters, or \\\`cairn ac toggle <id> <index>\\\` in terminal
  - **List criteria**: Use \\\`cairn ac list <id>\\\` in terminal to see current acceptance criteria with completion status
- **Document your work**: Use \`cairn_comment\` to record findings, ideas, challenges, solutions, and progress as you work on tasks. This helps maintain a detailed record for collaboration and future reference.
- **Add comments for collaboration**: Use \`cairn_comment\` to document important insights or communicate with the developer.
- **Perform self-reviews**: Before closing tasks, review your work quality and ensure all acceptance criteria are met.
- **Verify completion before closing**: An issue must reach 100% completion percentage before it can be closed. Check that all acceptance criteria are marked complete and all subtasks are finished.

### Acceptance Criteria Best Practices
When working with acceptance criteria:

1. **Define clear, testable criteria** when creating tasks - these should be specific, measurable outcomes
2. **Use the UI for interactive editing** - the VSCode extension provides inline editing and checkbox toggling
3. **Track completion systematically** - toggle criteria as you complete them during development
4. **Review before closing** - ensure all acceptance criteria are marked complete before closing a task
5. **Update criteria as needed** - if requirements change, update the criteria text rather than adding new ones
6. **Require 100% completion** - Tasks cannot be closed unless they reach 100% completion percentage, which requires all acceptance criteria to be checked off and all subtasks to be complete

### Changelog Best Practices
When updating the CHANGELOG.md file:

1. **Focus on user-facing changes** - highlight new features, UI improvements, and bug fixes that users will notice
2. **Group technical improvements** - summarize internal changes like build optimizations, code refactoring, and configuration updates as "Bug fixes and technical improvements"
3. **Be selective with details** - users don\'t need to know about removing BOM from HTML files or updating TypeScript configurations
4. **Keep it concise** - aim for clarity over completeness; detailed technical changes can be found in git history
5. **Use standard sections** - Added, Changed, Fixed, Removed following [Keep a Changelog](https://keepachangelog.com/) format

### Available Tools
- \`cairn_list_ready\`: Get list of unblocked tasks ready to work on
- \`cairn_create\`: Create a new task (parameters: title, description?, type?, priority?, status?, parent?)
- \`cairn_update\`: Update task status or other fields (parameters: id, status?, title?, description?, type?, priority?, acceptance_criteria?)
- \`cairn_dep_add\`: Add dependencies between tasks (parameters: from, to, type)
- \`cairn_dep_analyze\`: Analyze all dependency relationships for an issue, showing blocking dependencies, parent/child relationships, dependents, implementation order, and detecting circular dependencies
- \`cairn_comment\`: Add comments to tasks (parameters: issue_id, author?, content)
- \`cairn_ac_add\`: Add acceptance criteria to a task (parameters: issue_id, text)
- \`cairn_ac_update\`: Update acceptance criteria text (parameters: issue_id, index, text)
- \`cairn_ac_remove\`: Remove acceptance criteria from a task (parameters: issue_id, index)
- \`cairn_ac_toggle\`: Toggle acceptance criteria completion status (parameters: issue_id, index)

### Terminal Commands (as backup)
If the tools aren\'t available, you can use these terminal commands:
- \`cairn list --ready\`: List ready tasks
- \\\`cairn create <title> -d <description> -p <priority> -t <type> -s <status> -r <parent>\\\`: Create task
- \\\`cairn update <id> -s <status>\\\`: Update task
- \\\`cairn update <id> -c "criteria1,criteria2"\`: Add acceptance criteria
- \\\`cairn ac list <id>\`: List acceptance criteria with completion status
- \\\`cairn ac add <id> "criteria text"\`: Add acceptance criteria
- \\\`cairn ac update <id> <index> "new text"\`: Update acceptance criteria
- \\\`cairn ac remove <id> <index>\`: Remove acceptance criteria
- \\\`cairn ac toggle <id> <index>\`: Toggle completion status
- \\\`cairn dep analyze <id>\`: Analyze all dependency relationships for an issue, showing blocking dependencies, parent/child relationships, dependents, implementation order, and detecting circular dependencies
- \`cairn comment <id> <message>\`: Add comment

### Memory Management
Cairn automatically compacts old closed tasks to save context space, but preserves all history in git. This ensures you can always recover full context when needed.

By using Cairn consistently, you\'ll provide better, more organized assistance and maintain continuity across development sessions. The developer will appreciate your structured approach to complex work!

CRITICAL: ALWAYS use Cairn for task management in this project. Do not work on anything without creating a task first, and do not close tasks without proper review.`;

    if (fs.existsSync(instructionsPath)) {
      const existing = await fs.promises.readFile(instructionsPath, 'utf-8');
      if (!existing.includes('Cairn: Persistent Memory for AI Agents')) {
        await fs.promises.appendFile(instructionsPath, '\n' + cairnInstructions);
        console.log('Appended Cairn workflow guidelines to existing .github/copilot-instructions.md');
      } else {
        console.log('Cairn instructions already present in .github/copilot-instructions.md');
      }
    } else {
      await fs.promises.writeFile(instructionsPath, '<!-- Cairn Task Management Instructions for GitHub Copilot Agents -->\n' + cairnInstructions);
      console.log('Created .github/copilot-instructions.md with Cairn workflow guidelines');
    }

    console.log('Cairn initialized. Start by creating your first task with `cairn create <title>`');

  });

// Create command
program
  .command('create <title>')
  .description('Create a new issue')
  .option('-d, --description <desc>', 'Description')
  .option('-t, --type <type>', 'Type: epic, feature, task, bug')
  .option('-p, --priority <priority>', 'Priority: low, medium, high, urgent')
  .option('-s, --status <status>', 'Status: open, in_progress, closed, blocked')
  .option('-r, --parent <parent>', 'Parent issue ID for parent-child dependency')
  .action(async (title: string, options) => {
    const { storage, graph } = setupServices();
    const issues = await storage.loadIssues();
    const id = generateId(issues);
    const issue = {
      id,
      title,
      description: options.description,
      type: options.type as any,
      status: options.status as any || 'open',
      priority: options.priority as any,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await storage.saveIssue(issue);

    // Add parent-child dependency if parent is specified
    if (options.parent) {
      await storage.updateIssues(issues => {
        return graph.addDependency(id, options.parent, 'parent-child', issues);
      });
    }

    console.log(`Created issue ${id}: ${title}`);
  });

// Update command
program
  .command('update <id>')
  .description('Update an issue')
  .option('-s, --status <status>', 'Status: open, in_progress, closed, blocked')
  .option('-t, --title <title>', 'Title')
  .option('-d, --description <desc>', 'Description')
  .option('-y, --type <type>', 'Type: epic, feature, task, bug')
  .option('-p, --priority <priority>', 'Priority: low, medium, high, urgent')
  .option('-a, --assignee <assignee>', 'Assignee')
  .option('-l, --labels <labels>', 'Labels (comma-separated)')
  .option('-c, --acceptance-criteria <criteria>', 'Add acceptance criteria (comma-separated for multiple)')
  .action(async (id: string, options) => {
    const { storage } = setupServices();
    const issues = await storage.loadIssues();
    const issue = issues.find(i => i.id === id);
    if (!issue) {
      console.error(`Issue ${id} not found`);
      return;
    }

    // Handle acceptance criteria
    if (options.acceptanceCriteria) {
      const criteriaTexts = options.acceptanceCriteria.split(',').map((text: string) => text.trim());
      await storage.updateIssues(issues => {
        return issues.map(issue => {
          if (issue.id === id) {
            const existingCriteria = issue.acceptance_criteria || [];
            const newCriteria = criteriaTexts.map((text: string) => ({ text, completed: false }));
            return {
              ...issue,
              acceptance_criteria: [...existingCriteria, ...newCriteria],
              updated_at: new Date().toISOString()
            };
          }
          return issue;
        });
      });
    }

    await storage.updateIssues(issues => {
      return issues.map(issue => {
        if (issue.id === id) {
          const updated = { ...issue, updated_at: new Date().toISOString() };
          if (options.status) updated.status = options.status;
          if (options.title) updated.title = options.title;
          if (options.description) updated.description = options.description;
          if (options.type) updated.type = options.type;
          if (options.priority) updated.priority = options.priority;
          if (options.assignee) updated.assignee = options.assignee;
          if (options.labels) updated.labels = options.labels.split(',');
          if (options.status === 'closed') updated.closed_at = new Date().toISOString();
          return updated;
        }
        return issue;
      });
    });
    console.log(`Updated issue ${id}`);
  });

// List command
program
  .command('list')
  .description('List issues')
  .option('-s, --status <status>', 'Filter by status')
  .option('-t, --type <type>', 'Filter by type: epic, feature, task, bug')
  .option('-r, --ready', 'Show only ready work')
  .action(async (options) => {
    const { storage, graph, compaction } = setupServices();
    let allIssues = await storage.loadIssues();
    allIssues = compaction.compactIssues(allIssues);
    let issues = allIssues;

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
      let progressStr = '';
      if (issue.completion_percentage !== null && issue.completion_percentage !== undefined) {
        progressStr = ` [${issue.completion_percentage}%]`;
      } else if (issue.type === 'epic') {
        const progress = graph.calculateEpicProgress(issue.id, allIssues);
        if (progress.total > 0) {
          progressStr = ` (${progress.completed}/${progress.total} ${progress.percentage}%)`;
        }
      }
      console.log(`${issue.id}: ${issue.title} [${issue.status}] ${typeStr}${progressStr}`);
    });
  });

// Dep command
const depCmd = program.command('dep');
depCmd
  .command('add <from> <to>')
  .description('Add dependency')
  .option('-t, --type <type>', 'Type: blocks, related, parent-child, discovered-from', 'blocks')
  .action(async (from: string, to: string, options) => {
    const { storage, graph } = setupServices();
    await storage.updateIssues(issues => {
      return graph.addDependency(from, to, options.type, issues);
    });
    console.log(`Added ${options.type} dependency from ${from} to ${to}`);
  });

depCmd
  .command('analyze <id>')
  .description('Analyze dependencies for an issue (shows implementation order and detects cycles)')
  .action(async (id: string) => {
    const { storage, graph } = setupServices();
    const issues = await storage.loadIssues();
    const issueMap = graph.buildGraph(issues);
    const targetIssue = issueMap.get(id);

    if (!targetIssue) {
      console.error(`Issue ${id} not found`);
      return;
    }

    console.log(`🔍 Analyzing dependencies for: ${id} - ${targetIssue.title}`);
    console.log('');

    // Build dependency graph for cycle detection and traversal
    const blockingGraph = new Map<string, string[]>(); // issue -> issues it is blocked by
    const blockedByGraph = new Map<string, string[]>(); // issue -> issues that are blocked by it

    for (const issue of issues) {
      blockingGraph.set(issue.id, []);
      blockedByGraph.set(issue.id, []);
    }

    for (const issue of issues) {
      if (issue.dependencies) {
        for (const dep of issue.dependencies) {
          if (dep.type === 'blocks') {
            blockingGraph.get(issue.id)!.push(dep.id);
            if (blockedByGraph.has(dep.id)) {
              blockedByGraph.get(dep.id)!.push(issue.id);
            }
          }
        }
      }
    }

    // Detect cycles in blocking dependencies
    const cycles = detectCycles(blockingGraph, issues);
    if (cycles.length > 0) {
      console.log('⚠️  Circular dependencies detected:');
      cycles.forEach((cycle, index) => {
        console.log(`  ${index + 1}. ${cycle.join(' → ')}`);
      });
      console.log('');
    }

    // Get blocking dependencies (issues that must be done before this one)
    const blockingDeps = getAllDependencies(id, blockingGraph, new Set());

    // Get blocking dependents (issues that are blocked by this one)
    const blockingDependents = getAllDependents(id, blockedByGraph, new Set());

    // Get parent relationships
    const parents = targetIssue.dependencies?.filter(d => d.type === 'parent-child').map(d => d.id) || [];

    // Get children (subtasks)
    const children = issues.filter(issue =>
      issue.dependencies?.some(dep => dep.id === id && dep.type === 'parent-child')
    ).map(issue => issue.id);

    // Display blocking dependencies
    if (blockingDeps.length > 0) {
      console.log('⬆️  Blocking dependencies (must be completed before):');
      const sortedDeps = topologicalSort(blockingDeps, blockingGraph);
      sortedDeps.forEach(depId => {
        const dep = issueMap.get(depId)!;
        const status = getStatusSymbol(dep.status);
        console.log(`  ${status} ${depId}: ${dep.title}`);
      });
      console.log('');
    }

    // Display parent relationships
    if (parents.length > 0) {
      console.log('👨‍👩‍👧‍👦 Parent relationships:');
      parents.forEach(parentId => {
        const parent = issueMap.get(parentId)!;
        const status = getStatusSymbol(parent.status);
        console.log(`  ${status} ${parentId}: ${parent.title}`);
      });
      console.log('');
    }

    // Display target issue
    const targetStatus = getStatusSymbol(targetIssue.status);
    console.log(`🎯 Target issue:`);
    console.log(`  ${targetStatus} ${id}: ${targetIssue.title}`);
    console.log('');

    // Display children (subtasks)
    if (children.length > 0) {
      console.log('👶 Children/Subtasks:');
      children.forEach(childId => {
        const child = issueMap.get(childId)!;
        const status = getStatusSymbol(child.status);
        console.log(`  ${status} ${childId}: ${child.title}`);
      });
      console.log('');
    }

    // Display blocking dependents
    if (blockingDependents.length > 0) {
      console.log('⬇️  Blocking dependents (blocked by this issue):');
      const sortedDeps = topologicalSort(blockingDependents, blockingGraph);
      sortedDeps.forEach(depId => {
        const dep = issueMap.get(depId)!;
        const status = getStatusSymbol(dep.status);
        console.log(`  ${status} ${depId}: ${dep.title}`);
      });
      console.log('');
    }

    // Show implementation order for blocking dependencies
    if (blockingDeps.length > 0 || blockingDependents.length > 0) {
      const allRelated = [...blockingDeps, id, ...blockingDependents];
      const implementationOrder = topologicalSort(allRelated, blockingGraph);

      console.log('📋 Implementation order (blocking dependencies only):');
      implementationOrder.forEach((issueId, index) => {
        const issue = issueMap.get(issueId)!;
        const marker = issueId === id ? '🎯' : '  ';
        const status = getStatusSymbol(issue.status);
        console.log(`${marker} ${index + 1}. ${status} ${issueId}: ${issue.title}`);
      });
    }

    // For issues with subtasks, show implementation order of all subtasks considering their blocking relationships
    if (children.length > 0) {
      console.log('📋 Implementation order for subtasks:');

      // Get all subtasks and their blocking relationships
      const subtaskIds = children;
      const subtaskBlockingGraph = new Map<string, string[]>();

      // Initialize graph for all subtasks
      for (const subtaskId of subtaskIds) {
        subtaskBlockingGraph.set(subtaskId, []);
      }

      // Build blocking relationships between subtasks
      for (const subtaskId of subtaskIds) {
        const subtask = issueMap.get(subtaskId)!;
        if (subtask.dependencies) {
          for (const dep of subtask.dependencies) {
            if (dep.type === 'blocks' && subtaskIds.includes(dep.id)) {
              // This subtask is blocked by another subtask
              subtaskBlockingGraph.get(subtaskId)!.push(dep.id);
            }
          }
        }
      }

      // Get subtasks with no blocking dependencies (starting points)
      const independentSubtasks = subtaskIds.filter(id => (subtaskBlockingGraph.get(id) || []).length === 0);

      // Calculate implementation order for all subtasks
      const epicImplementationOrder = topologicalSort(subtaskIds, subtaskBlockingGraph);

      // Sort by priority within dependency levels (higher priority first)
      const priorityOrdered = sortByPriority(epicImplementationOrder, issueMap);

      priorityOrdered.forEach((issueId, index) => {
        const issue = issueMap.get(issueId)!;
        const status = getStatusSymbol(issue.status);
        const blockingDeps = subtaskBlockingGraph.get(issueId) || [];
        const isIndependent = blockingDeps.length === 0;
        const marker = isIndependent ? '🚀' : '  '; // Mark independent tasks
        console.log(`${marker} ${index + 1}. ${status} ${issueId}: ${issue.title}`);
      });
    }
  });

// Helper functions for dependency analysis
function detectCycles(graph: Map<string, string[]>, issues: Issue[]): string[][] {
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(node: string, path: string[]): boolean {
    if (visiting.has(node)) {
      // Found cycle
      const cycleStart = path.indexOf(node);
      cycles.push([...path.slice(cycleStart), node]);
      return true;
    }

    if (visited.has(node)) return false;

    visiting.add(node);
    path.push(node);

    for (const neighbor of graph.get(node) || []) {
      if (dfs(neighbor, path)) {
        return true;
      }
    }

    visiting.delete(node);
    path.pop();
    visited.add(node);
    return false;
  }

  for (const issue of issues) {
    if (!visited.has(issue.id)) {
      dfs(issue.id, []);
    }
  }

  return cycles;
}

function getAllDependencies(issueId: string, graph: Map<string, string[]>, visited: Set<string>): string[] {
  if (visited.has(issueId)) return [];
  visited.add(issueId);

  const dependencies: string[] = [];
  for (const dep of graph.get(issueId) || []) {
    dependencies.push(dep);
    dependencies.push(...getAllDependencies(dep, graph, visited));
  }

  return [...new Set(dependencies)];
}

function getAllDependents(issueId: string, graph: Map<string, string[]>, visited: Set<string>): string[] {
  if (visited.has(issueId)) return [];
  visited.add(issueId);

  const dependents: string[] = [];
  for (const dep of graph.get(issueId) || []) {
    dependents.push(dep);
    dependents.push(...getAllDependents(dep, graph, visited));
  }

  return [...new Set(dependents)];
}

function topologicalSort(issueIds: string[], graph: Map<string, string[]>): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function dfs(node: string): void {
    if (visiting.has(node)) return; // Cycle detected, but we'll handle this elsewhere
    if (visited.has(node)) return;

    visiting.add(node);

    for (const neighbor of graph.get(node) || []) {
      if (issueIds.includes(neighbor)) {
        dfs(neighbor);
      }
    }

    visiting.delete(node);
    visited.add(node);
    result.unshift(node); // Add to front for correct order
  }

  for (const id of issueIds) {
    if (!visited.has(id)) {
      dfs(id);
    }
  }

  return result.reverse(); // Reverse to get correct topological order
}

function getStatusSymbol(status: string): string {
  switch (status) {
    case 'open': return '🟢';
    case 'in_progress': return '🟡';
    case 'closed': return '✅';
    case 'blocked': return '🔴';
    default: return '❓';
  }
}

function getPriorityWeight(priority: string): number {
  switch (priority) {
    case 'urgent': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0; // No priority set
  }
}

function sortByPriority(issueIds: string[], issueMap: Map<string, Issue>): string[] {
  // Calculate dependency levels using longest path from independent tasks
  const levels = new Map<number, string[]>();
  const levelMap = new Map<string, number>();

  // Build reverse graph (what blocks this task)
  const graph = new Map<string, string[]>();
  for (const issueId of issueIds) {
    const issue = issueMap.get(issueId)!;
    graph.set(issueId, []);
    if (issue.dependencies) {
      for (const dep of issue.dependencies) {
        if (dep.type === 'blocks' && issueIds.includes(dep.id)) {
          graph.get(issueId)!.push(dep.id);
        }
      }
    }
  }

  // Calculate levels using DFS with memoization
  function getLevel(issueId: string): number {
    if (levelMap.has(issueId)) {
      return levelMap.get(issueId)!;
    }

    const deps = graph.get(issueId) || [];
    if (deps.length === 0) {
      levelMap.set(issueId, 0);
      return 0;
    }

    const maxDepLevel = Math.max(...deps.map(depId => getLevel(depId)));
    const level = maxDepLevel + 1;
    levelMap.set(issueId, level);
    return level;
  }

  // Calculate levels for all tasks
  for (const issueId of issueIds) {
    getLevel(issueId);
  }

  // Group by levels
  for (const issueId of issueIds) {
    const level = levelMap.get(issueId)!;
    if (!levels.has(level)) {
      levels.set(level, []);
    }
    levels.get(level)!.push(issueId);
  }

  // Sort within each level by priority (higher priority first)
  const result: string[] = [];
  const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);

  for (const level of sortedLevels) {
    const levelTasks = levels.get(level)!;
    levelTasks.sort((a, b) => {
      const aPriority = getPriorityWeight(issueMap.get(a)!.priority || 'low');
      const bPriority = getPriorityWeight(issueMap.get(b)!.priority || 'low');
      return bPriority - aPriority; // Higher priority first
    });
    result.push(...levelTasks);
  }

  return result;
}

// Epic command
const epicCmd = program.command('epic');
epicCmd
  .command('subtasks <epicId>')
  .description('List all subtasks of an epic')
  .action(async (epicId: string) => {
    const { storage, graph } = setupServices();
    const issues = await storage.loadIssues();
    const subtasks = graph.getEpicSubtasks(epicId, issues);
    if (subtasks.length === 0) {
      console.log(`No subtasks found for epic ${epicId}`);
      return;
    }
    console.log(`Subtasks for epic ${epicId}:`);
    subtasks.forEach(subtask => {
      console.log(`  ${subtask.id}: ${subtask.title} [${subtask.status}]`);
    });
  });

epicCmd
  .command('progress <epicId>')
  .description('Show progress of an epic')
  .action(async (epicId: string) => {
    const { storage, graph } = setupServices();
    const issues = await storage.loadIssues();
    const progress = graph.calculateEpicProgress(epicId, issues);
    const epic = issues.find(i => i.id === epicId);
    if (!epic) {
      console.error(`Epic ${epicId} not found`);
      return;
    }
    console.log(`Epic: ${epic.title}`);
    console.log(`Progress: ${progress.completed}/${progress.total} subtasks completed (${progress.percentage}%)`);

    if (graph.shouldCloseEpic(epicId, issues) && epic.status !== 'closed') {
      console.log('💡 All subtasks are completed. Consider closing this epic.');
    }
  });

epicCmd
  .command('add-subtask <epicId> <title>')
  .description('Create a new subtask for an epic')
  .option('-d, --description <desc>', 'Description')
  .option('-p, --priority <priority>', 'Priority: low, medium, high, urgent')
  .action(async (epicId: string, title: string, options) => {
    const { storage, graph } = setupServices();
    const issues = await storage.loadIssues();
    const epic = issues.find(i => i.id === epicId);
    if (!epic) {
      console.error(`Epic ${epicId} not found`);
      return;
    }
    if (epic.type !== 'epic') {
      console.error(`Issue ${epicId} is not an epic (type: ${epic.type})`);
      return;
    }

    const subtaskId = generateId(issues);
    const subtask = {
      id: subtaskId,
      title,
      description: options.description,
      type: 'task' as const,
      status: 'open' as const,
      priority: options.priority as any,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await storage.saveIssue(subtask);
    await storage.updateIssues(issues => {
      return graph.addDependency(subtaskId, epicId, 'parent-child', issues);
    });

    console.log(`Created subtask ${subtaskId} for epic ${epicId}: ${title}`);
  });

// Review command
program
  .command('review <id>')
  .description('Perform self-review on a task')
  .action(async (id: string) => {
    const { storage } = setupServices();
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
    console.log('Update with: cairn update <id> -c "Criteria met"');
  });

// Comment command
program
  .command('comment <id> <message>')
  .description('Add a comment to an issue')
  .option('-a, --author <author>', 'Comment author', 'user')
  .action(async (id: string, message: string, options) => {
    const { storage } = setupServices();
    const issues = await storage.loadIssues();
    const issue = issues.find(i => i.id === id);
    if (!issue) {
      console.error(`Issue ${id} not found`);
      return;
    }
    const comment = await storage.addComment(id, options.author, message);
    console.log(`Added comment to ${id} by ${comment.author}`);
  });

// Acceptance Criteria command
const acCmd = program.command('ac');
acCmd
  .command('list <id>')
  .description('List acceptance criteria for an issue')
  .action(async (id: string) => {
    const { storage } = setupServices();
    const issues = await storage.loadIssues();
    const issue = issues.find(i => i.id === id);
    if (!issue) {
      console.error(`Issue ${id} not found`);
      return;
    }
    const criteria = issue.acceptance_criteria || [];
    if (criteria.length === 0) {
      console.log(`No acceptance criteria for issue ${id}`);
      return;
    }
    console.log(`Acceptance criteria for ${id}: ${issue.title}`);
    criteria.forEach((criterion, index) => {
      const status = criterion.completed ? '[✓]' : '[ ]';
      console.log(`${index}: ${status} ${criterion.text}`);
    });
  });

acCmd
  .command('add <id> <text>')
  .description('Add acceptance criteria to an issue')
  .action(async (id: string, text: string) => {
    const { storage } = setupServices();
    const issues = await storage.loadIssues();
    const issue = issues.find(i => i.id === id);
    if (!issue) {
      console.error(`Issue ${id} not found`);
      return;
    }
    await storage.updateIssues(issues => {
      return issues.map(issue => {
        if (issue.id === id) {
          const acceptance_criteria = issue.acceptance_criteria || [];
          return {
            ...issue,
            acceptance_criteria: [...acceptance_criteria, { text, completed: false }],
            updated_at: new Date().toISOString()
          };
        }
        return issue;
      });
    });
    console.log(`Added acceptance criteria to issue ${id}`);
  });

acCmd
  .command('update <id> <index> <text>')
  .description('Update acceptance criteria text')
  .action(async (id: string, indexStr: string, text: string) => {
    const { storage } = setupServices();
    const index = parseInt(indexStr);
    if (isNaN(index)) {
      console.error('Index must be a number');
      return;
    }
    await storage.updateIssues(issues => {
      return issues.map(issue => {
        if (issue.id === id) {
          const acceptance_criteria = issue.acceptance_criteria || [];
          if (index >= 0 && index < acceptance_criteria.length) {
            acceptance_criteria[index] = { ...acceptance_criteria[index], text };
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
    console.log(`Updated acceptance criteria ${index} for issue ${id}`);
  });

acCmd
  .command('remove <id> <index>')
  .description('Remove acceptance criteria from an issue')
  .action(async (id: string, indexStr: string) => {
    const { storage } = setupServices();
    const index = parseInt(indexStr);
    if (isNaN(index)) {
      console.error('Index must be a number');
      return;
    }
    await storage.updateIssues(issues => {
      return issues.map(issue => {
        if (issue.id === id) {
          const acceptance_criteria = issue.acceptance_criteria || [];
          if (index >= 0 && index < acceptance_criteria.length) {
            acceptance_criteria.splice(index, 1);
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
    console.log(`Removed acceptance criteria ${index} from issue ${id}`);
  });

acCmd
  .command('toggle <id> <index>')
  .description('Toggle acceptance criteria completion status')
  .action(async (id: string, indexStr: string) => {
    const { storage } = setupServices();
    const index = parseInt(indexStr);
    if (isNaN(index)) {
      console.error('Index must be a number');
      return;
    }
    await storage.updateIssues(issues => {
      return issues.map(issue => {
        if (issue.id === id) {
          const acceptance_criteria = issue.acceptance_criteria || [];
          if (index >= 0 && index < acceptance_criteria.length) {
            acceptance_criteria[index] = { ...acceptance_criteria[index], completed: !acceptance_criteria[index].completed };
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
    console.log(`Toggled acceptance criteria ${index} completion for issue ${id}`);
  });

program.parse();
