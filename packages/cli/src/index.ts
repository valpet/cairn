#!/usr/bin/env node

import 'reflect-metadata';
import { Command } from 'commander';
import { createContainer, TYPES, IStorageService, IGraphService, ICompactionService, findCairnDir, generateId, TaskType, TaskStatus, Priority, Task } from '@valpet/cairn-core';
import * as path from 'path';
import * as fs from 'fs';

const program = new Command();

program
  .name('cairn')
  .description('CLI for Cairn task management')
  .version(require('../package.json').version);

const cwd = process.cwd();

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
    console.error('Error reading config:', error);
    return { activeFile: 'default' };
  }
}

function writeConfig(cairnDir: string, config: CairnConfig): void {
  const configPath = getConfigPath(cairnDir);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// NOTE: The logical name "default" is special: it always maps to "tasks.jsonl",
// which is the canonical / historical default tasks file for a Cairn workspace.
// To avoid ambiguity and file collisions, the logical name "tasks" is effectively
// reserved and must not be used by callers, because it would also map to
// "tasks.jsonl". This ensures we never have both a "default" mapping and a
// user-named "tasks" file attempting to coexist in the same directory.
function getTaskFileName(name: string): string {
  return name === 'default' ? 'tasks.jsonl' : `${name}.jsonl`;
}

function setupServices() {
  const { cairnDir, repoRoot } = findCairnDir(cwd);
  if (!fs.existsSync(cairnDir)) {
    console.error('No .cairn directory found. Run `npx cairn init` in your project root.');
    process.exit(1);
  }
  const config = readConfig(cairnDir);
  const tasksFileName = getTaskFileName(config.activeFile);
  const container = createContainer(cairnDir, repoRoot, tasksFileName);
  const storage = container.get<IStorageService>(TYPES.IStorageService);
  const graph = container.get<IGraphService>(TYPES.IGraphService);
  const compaction = container.get<ICompactionService>(TYPES.ICompactionService);
  return { storage, graph, compaction, cairnDir };
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

    // Create tasks.jsonl if it doesn't exist
    const tasksPath = path.join(cairnDir, 'tasks.jsonl');
    if (!fs.existsSync(tasksPath)) {
      await fs.promises.writeFile(tasksPath, '');
      console.log('Created tasks.jsonl');
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
- Store tasks in .cairn/tasks.jsonl, with git integration.
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
  - **Add criteria**: Use \\\`cairn_ac_add\\\` tool with \\\`task_id\\\` and \\\`text\\\` parameters, or \\\`cairn ac add <id> "<text>"\\\` in terminal
  - **Update criteria text**: Use \\\`cairn_ac_update\\\` tool with \\\`task_id\\\`, \\\`index\\\`, and \\\`text\\\` parameters, or \\\`cairn ac update <id> <index> "<new text>"\\\` in terminal
  - **Remove criteria**: Use \\\`cairn_ac_remove\\\` tool with \\\`task_id\\\` and \\\`index\\\` parameters, or \\\`cairn ac remove <id> <index>\\\` in terminal
  - **Toggle completion**: Use \\\`cairn_ac_toggle\\\` tool with \\\`task_id\\\` and \\\`index\\\` parameters, or \\\`cairn ac toggle <id> <index>\\\` in terminal
  - **List criteria**: Use \\\`cairn ac list <id>\\\` in terminal to see current acceptance criteria with completion status
- **Document your work**: Use \`cairn_comment\` to record findings, ideas, challenges, solutions, and progress as you work on tasks. This helps maintain a detailed record for collaboration and future reference.
- **Add comments for collaboration**: Use \`cairn_comment\` to document important insights or communicate with the developer.
- **Perform self-reviews**: Before closing tasks, review your work quality and ensure all acceptance criteria are met.
- **Verify completion before closing**: A task must reach 100% completion percentage before it can be closed. Check that all acceptance criteria are marked complete and all subtasks are finished.

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
- \`cairn_dep_analyze\`: Analyze all dependency relationships for a task, showing blocking dependencies, parent/child relationships, dependents, implementation order, and detecting circular dependencies
- \`cairn_comment\`: Add comments to tasks (parameters: task_id, author?, content)
- \`cairn_ac_add\`: Add acceptance criteria to a task (parameters: task_id, text)
- \`cairn_ac_update\`: Update acceptance criteria text (parameters: task_id, index, text)
- \`cairn_ac_remove\`: Remove acceptance criteria from a task (parameters: task_id, index)
- \`cairn_ac_toggle\`: Toggle acceptance criteria completion status (parameters: task_id, index)

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
- \\\`cairn dep analyze <id>\`: Analyze all dependency relationships for a task, showing blocking dependencies, parent/child relationships, dependents, implementation order, and detecting circular dependencies
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

    // Create default config
    const configPath = path.join(cwd, '.cairn', 'config.json');
    if (!fs.existsSync(configPath)) {
      await fs.promises.writeFile(configPath, JSON.stringify({ activeFile: 'default' }, null, 2));
      console.log('Created config.json');
    }

    console.log('Cairn initialized. Start by creating your first task with `cairn create <title>`');

  });

// Use command
program
  .command('use [name]')
  .description('Switch between task files or list available files')
  .action(async (name?: string) => {
    const { cairnDir } = setupServices();
    const config = readConfig(cairnDir);

    // If no name provided, list all files and show current
    if (!name) {
      const files = fs.readdirSync(cairnDir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => f.replace('.jsonl', ''))
        .map(f => f === 'tasks' ? 'default' : f);

      if (files.length === 0) {
        console.log('No task files found.');
        return;
      }

      console.log(`Current: ${config.activeFile} (${getTaskFileName(config.activeFile)})`);
      console.log('');
      console.log('Available task files:');
      files.forEach(file => {
        const marker = file === config.activeFile ? '  *' : '   ';
        const fileName = getTaskFileName(file);
        console.log(`${marker} ${file} (${fileName})`);
      });
      return;
    }

    // Switch to specified file
    const targetFileName = getTaskFileName(name);
    const targetPath = path.join(cairnDir, targetFileName);

    // Create file if it doesn't exist
    if (!fs.existsSync(targetPath)) {
      await fs.promises.writeFile(targetPath, '');
      console.log(`Created new task file: ${targetFileName}`);
    }

    // Update config
    config.activeFile = name;
    writeConfig(cairnDir, config);
    console.log(`Switched to: ${name} (${targetFileName})`);
  });

// Create command
program
  .command('create <title>')
  .description('Create a new task')
  .option('-d, --description <desc>', 'Description')
  .option('-t, --type <type>', 'Type: epic, feature, task, bug')
  .option('-p, --priority <priority>', 'Priority: low, medium, high, urgent')
  .option('-s, --status <status>', 'Status: open, in_progress, closed, blocked')
  .option('-r, --parent <parent>', 'Parent task ID for parent-child dependency')
  .action(async (title: string, options) => {
    const { storage, graph } = setupServices();
    const tasks = await storage.loadTasks();
    const id = generateId(tasks);
    const task = {
      id,
      title,
      description: options.description,
      type: options.type as TaskType,
      status: (options.status as TaskStatus) || 'open',
      priority: options.priority as Priority,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await storage.saveTask(task);

    // Add parent-child dependency if parent is specified
    if (options.parent) {
      await storage.updateTasks(tasks => {
        return graph.addDependency(id, options.parent, 'parent-child', tasks);
      });
    }

    console.log(`Created task ${id}: ${title}`);
  });

// Update command
program
  .command('update <id>')
  .description('Update a task')
  .option('-s, --status <status>', 'Status: open, in_progress, closed, blocked')
  .option('-t, --title <title>', 'Title')
  .option('-d, --description <desc>', 'Description')
  .option('-y, --type <type>', 'Type: epic, feature, task, bug')
  .option('-p, --priority <priority>', 'Priority: low, medium, high, urgent')
  .option('-a, --assignee <assignee>', 'Assignee')
  .option('-l, --labels <labels>', 'Labels (comma-separated)')
  .option('-c, --acceptance-criteria <criteria>', 'Add acceptance criteria (comma-separated for multiple)')
  .action(async (id: string, options) => {
    const { storage, graph } = setupServices();
    const tasks = await storage.loadTasks();
    const task = tasks.find(i => i.id === id);
    if (!task) {
      console.error(`Task ${id} not found`);
      return;
    }

    // Validate before closing task
    if (options.status === 'closed' && task.status !== 'closed') {
      const validation = graph.canCloseTask(id, tasks);
      if (!validation.canClose) {
        // Build detailed error message
        let errorMsg = `Cannot close task ${id}`;
        if (validation.reason) {
          errorMsg += ` because it ${validation.reason}`;
        }
        if (validation.completionPercentage !== undefined) {
          errorMsg += ` (currently ${validation.completionPercentage}% complete)`;
        }
        if (validation.openSubtasks && validation.openSubtasks.length > 0) {
          const subtaskList = validation.openSubtasks.map(s => `${s.id} (${s.status})`).join(', ');
          errorMsg += `\nOpen subtasks: ${subtaskList}`;
        }
        errorMsg += '.\nPlease complete all requirements before closing.';

        console.error(errorMsg);
        process.exit(1);
      }
    }

    // Handle acceptance criteria
    if (options.acceptanceCriteria) {
      const criteriaTexts = options.acceptanceCriteria.split(',').map((text: string) => text.trim());
      await storage.updateTasks(tasks => {
        return tasks.map(task => {
          if (task.id === id) {
            const existingCriteria = task.acceptance_criteria || [];
            const newCriteria = criteriaTexts.map((text: string) => ({ text, completed: false }));
            return {
              ...task,
              acceptance_criteria: [...existingCriteria, ...newCriteria],
              updated_at: new Date().toISOString()
            };
          }
          return task;
        });
      });
    }

    await storage.updateTasks(tasks => {
      return tasks.map(task => {
        if (task.id === id) {
          const updated = { ...task, updated_at: new Date().toISOString() };
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
        return task;
      });
    });
    console.log(`Updated task ${id}`);
  });

// List command
program
  .command('list')
  .description('List tasks')
  .option('-s, --status <status>', 'Filter by status')
  .option('-t, --type <type>', 'Filter by type: epic, feature, task, bug')
  .option('-r, --ready', 'Show only ready work')
  .action(async (options) => {
    const { storage, graph, compaction } = setupServices();
    let allTasks = await storage.loadTasks();
    allTasks = compaction.compactTasks(allTasks);
    let tasks = allTasks;

    if (options.ready) {
      tasks = graph.getReadyWork(tasks);
    } else {
      if (options.status) {
        tasks = tasks.filter(i => i.status === options.status);
      }
      if (options.type) {
        tasks = tasks.filter(i => i.type === options.type);
      }
    }
    tasks.forEach(task => {
      const typeStr = task.type ? `[${task.type}]` : '';
      let progressStr = '';
      if (task.completion_percentage !== null && task.completion_percentage !== undefined) {
        progressStr = ` [${task.completion_percentage}%]`;
      } else if (task.type === 'epic') {
        const progress = graph.calculateEpicProgress(task.id, allTasks);
        if (progress.total > 0) {
          progressStr = ` (${progress.completed}/${progress.total} ${progress.percentage}%)`;
        }
      }
      console.log(`${task.id}: ${task.title} [${task.status}] ${typeStr}${progressStr}`);
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
    await storage.updateTasks(tasks => {
      return graph.addDependency(from, to, options.type, tasks);
    });
    console.log(`Added ${options.type} dependency from ${from} to ${to}`);
  });

depCmd
  .command('analyze <id>')
  .description('Analyze dependencies for a task (shows implementation order and detects cycles)')
  .action(async (id: string) => {
    const { storage, graph } = setupServices();
    const tasks = await storage.loadTasks();
    const taskMap = graph.buildGraph(tasks);
    const targetTask = taskMap.get(id);

    if (!targetTask) {
      console.error(`Task ${id} not found`);
      return;
    }

    console.log(`🔍 Analyzing dependencies for: ${id} - ${targetTask.title}`);
    console.log('');

    // Build dependency graph for cycle detection and traversal
    const blockingGraph = new Map<string, string[]>(); // task -> tasks it is blocked by
    const blockedByGraph = new Map<string, string[]>(); // task -> tasks that are blocked by it

    for (const task of tasks) {
      blockingGraph.set(task.id, []);
      blockedByGraph.set(task.id, []);
    }

    for (const task of tasks) {
      if (task.dependencies) {
        for (const dep of task.dependencies) {
          if (dep.type === 'blocks') {
            blockingGraph.get(task.id)!.push(dep.id);
            if (blockedByGraph.has(dep.id)) {
              blockedByGraph.get(dep.id)!.push(task.id);
            }
          }
        }
      }
    }

    // Detect cycles in blocking dependencies
    const cycles = detectCycles(blockingGraph, tasks);
    if (cycles.length > 0) {
      console.log('⚠️  Circular dependencies detected:');
      cycles.forEach((cycle, index) => {
        console.log(`  ${index + 1}. ${cycle.join(' → ')}`);
      });
      console.log('');
    }

    // Get blocking dependencies (tasks that must be done before this one)
    const blockingDeps = getAllDependencies(id, blockingGraph, new Set());

    // Get blocking dependents (tasks that are blocked by this one)
    const blockingDependents = getAllDependents(id, blockedByGraph, new Set());

    // Get parent relationships
    const parents = targetTask.dependencies?.filter(d => d.type === 'parent-child').map(d => d.id) || [];

    // Get children (subtasks)
    const children = tasks.filter(task =>
      task.dependencies?.some(dep => dep.id === id && dep.type === 'parent-child')
    ).map(task => task.id);

    // Display blocking dependencies
    if (blockingDeps.length > 0) {
      console.log('⬆️  Blocking dependencies (must be completed before):');
      const sortedDeps = topologicalSort(blockingDeps, blockingGraph);
      sortedDeps.forEach(depId => {
        const dep = taskMap.get(depId)!;
        const status = getStatusSymbol(dep.status);
        console.log(`  ${status} ${depId}: ${dep.title}`);
      });
      console.log('');
    }

    // Display parent relationships
    if (parents.length > 0) {
      console.log('👨‍👩‍👧‍👦 Parent relationships:');
      parents.forEach(parentId => {
        const parent = taskMap.get(parentId)!;
        const status = getStatusSymbol(parent.status);
        console.log(`  ${status} ${parentId}: ${parent.title}`);
      });
      console.log('');
    }

    // Display target task
    const targetStatus = getStatusSymbol(targetTask.status);
    console.log(`🎯 Target task:`);
    console.log(`  ${targetStatus} ${id}: ${targetTask.title}`);
    console.log('');

    // Display children (subtasks)
    if (children.length > 0) {
      console.log('👶 Children/Subtasks:');
      children.forEach(childId => {
        const child = taskMap.get(childId)!;
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
        const dep = taskMap.get(depId)!;
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
      implementationOrder.forEach((taskId, index) => {
        const task = taskMap.get(taskId)!;
        const marker = taskId === id ? '🎯' : '  ';
        const status = getStatusSymbol(task.status);
        console.log(`${marker} ${index + 1}. ${status} ${taskId}: ${task.title}`);
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
        const subtask = taskMap.get(subtaskId)!;
        if (subtask.dependencies) {
          for (const dep of subtask.dependencies) {
            if (dep.type === 'blocks' && subtaskIds.includes(dep.id)) {
              // This subtask is blocked by another subtask
              subtaskBlockingGraph.get(subtaskId)!.push(dep.id);
            }
          }
        }
      }

      // Calculate implementation order for all subtasks
      const epicImplementationOrder = topologicalSort(subtaskIds, subtaskBlockingGraph);

      // Sort by priority within dependency levels (higher priority first)
      const priorityOrdered = sortByPriority(epicImplementationOrder, taskMap);

      priorityOrdered.forEach((taskId, index) => {
        const task = taskMap.get(taskId)!;
        const status = getStatusSymbol(task.status);
        const blockingDeps = subtaskBlockingGraph.get(taskId) || [];
        const isIndependent = blockingDeps.length === 0;
        const marker = isIndependent ? '🚀' : '  '; // Mark independent tasks
        console.log(`${marker} ${index + 1}. ${status} ${taskId}: ${task.title}`);
      });
    }
  });

// Helper functions for dependency analysis
function detectCycles(graph: Map<string, string[]>, tasks: Task[]): string[][] {
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

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      dfs(task.id, []);
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

function topologicalSort(taskIds: string[], graph: Map<string, string[]>): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function dfs(node: string): void {
    if (visiting.has(node)) return; // Cycle detected, but we'll handle this elsewhere
    if (visited.has(node)) return;

    visiting.add(node);

    for (const neighbor of graph.get(node) || []) {
      if (taskIds.includes(neighbor)) {
        dfs(neighbor);
      }
    }

    visiting.delete(node);
    visited.add(node);
    result.unshift(node); // Add to front for correct order
  }

  for (const id of taskIds) {
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

function sortByPriority(taskIds: string[], taskMap: Map<string, Task>): string[] {
  // Calculate dependency levels using longest path from independent tasks
  const levels = new Map<number, string[]>();
  const levelMap = new Map<string, number>();

  // Build reverse graph (what blocks this task)
  const graph = new Map<string, string[]>();
  for (const taskId of taskIds) {
    const task = taskMap.get(taskId)!;
    graph.set(taskId, []);
    if (task.dependencies) {
      for (const dep of task.dependencies) {
        if (dep.type === 'blocks' && taskIds.includes(dep.id)) {
          graph.get(taskId)!.push(dep.id);
        }
      }
    }
  }

  // Calculate levels using DFS with memoization
  function getLevel(taskId: string): number {
    if (levelMap.has(taskId)) {
      return levelMap.get(taskId)!;
    }

    const deps = graph.get(taskId) || [];
    if (deps.length === 0) {
      levelMap.set(taskId, 0);
      return 0;
    }

    const maxDepLevel = Math.max(...deps.map(depId => getLevel(depId)));
    const level = maxDepLevel + 1;
    levelMap.set(taskId, level);
    return level;
  }

  // Calculate levels for all tasks
  for (const taskId of taskIds) {
    getLevel(taskId);
  }

  // Group by levels
  for (const taskId of taskIds) {
    const level = levelMap.get(taskId)!;
    if (!levels.has(level)) {
      levels.set(level, []);
    }
    levels.get(level)!.push(taskId);
  }

  // Sort within each level by priority (higher priority first)
  const result: string[] = [];
  const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);

  for (const level of sortedLevels) {
    const levelTasks = levels.get(level)!;
    levelTasks.sort((a, b) => {
      const aPriority = getPriorityWeight(taskMap.get(a)!.priority || 'low');
      const bPriority = getPriorityWeight(taskMap.get(b)!.priority || 'low');
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
    const tasks = await storage.loadTasks();
    const subtasks = graph.getEpicSubtasks(epicId, tasks);
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
    const tasks = await storage.loadTasks();
    const progress = graph.calculateEpicProgress(epicId, tasks);
    const epic = tasks.find(i => i.id === epicId);
    if (!epic) {
      console.error(`Epic ${epicId} not found`);
      return;
    }
    console.log(`Epic: ${epic.title}`);
    console.log(`Progress: ${progress.completed}/${progress.total} subtasks completed (${progress.percentage}%)`);

    if (graph.shouldCloseEpic(epicId, tasks) && epic.status !== 'closed') {
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
    const tasks = await storage.loadTasks();
    const epic = tasks.find(i => i.id === epicId);
    if (!epic) {
      console.error(`Epic ${epicId} not found`);
      return;
    }
    if (epic.type !== 'epic') {
      console.error(`Task ${epicId} is not an epic (type: ${epic.type})`);
      return;
    }

    const subtaskId = generateId(tasks);
    const subtask = {
      id: subtaskId,
      title,
      description: options.description,
      type: 'task' as const,
      status: 'open' as const,
      priority: options.priority as Priority,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await storage.saveTask(subtask);
    await storage.updateTasks(tasks => {
      return graph.addDependency(subtaskId, epicId, 'parent-child', tasks);
    });

    console.log(`Created subtask ${subtaskId} for epic ${epicId}: ${title}`);
  });

// Review command
program
  .command('review <id>')
  .description('Perform self-review on a task')
  .action(async (id: string) => {
    const { storage } = setupServices();
    const tasks = await storage.loadTasks();
    const task = tasks.find(i => i.id === id);
    if (!task) {
      console.error(`Task ${id} not found`);
      return;
    }
    console.log(`Reviewing task ${id}: ${task.title}`);
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
  .description('Add a comment to a task')
  .option('-a, --author <author>', 'Comment author', 'user')
  .action(async (id: string, message: string, options) => {
    const { storage } = setupServices();
    const tasks = await storage.loadTasks();
    const task = tasks.find(i => i.id === id);
    if (!task) {
      console.error(`Task ${id} not found`);
      return;
    }
    const comment = await storage.addComment(id, options.author, message);
    console.log(`Added comment to ${id} by ${comment.author}`);
  });

// Acceptance Criteria command
const acCmd = program.command('ac');
acCmd
  .command('list <id>')
  .description('List acceptance criteria for a task')
  .action(async (id: string) => {
    const { storage } = setupServices();
    const tasks = await storage.loadTasks();
    const task = tasks.find(i => i.id === id);
    if (!task) {
      console.error(`Task ${id} not found`);
      return;
    }
    const criteria = task.acceptance_criteria || [];
    if (criteria.length === 0) {
      console.log(`No acceptance criteria for task ${id}`);
      return;
    }
    console.log(`Acceptance criteria for ${id}: ${task.title}`);
    criteria.forEach((criterion, index) => {
      const status = criterion.completed ? '[✓]' : '[ ]';
      console.log(`${index}: ${status} ${criterion.text}`);
    });
  });

acCmd
  .command('add <id> <text>')
  .description('Add acceptance criteria to a task')
  .action(async (id: string, text: string) => {
    const { storage } = setupServices();
    const tasks = await storage.loadTasks();
    const task = tasks.find(i => i.id === id);
    if (!task) {
      console.error(`Task ${id} not found`);
      return;
    }
    await storage.updateTasks(tasks => {
      return tasks.map(task => {
        if (task.id === id) {
          const acceptance_criteria = task.acceptance_criteria || [];
          return {
            ...task,
            acceptance_criteria: [...acceptance_criteria, { text, completed: false }],
            updated_at: new Date().toISOString()
          };
        }
        return task;
      });
    });
    console.log(`Added acceptance criteria to task ${id}`);
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
    await storage.updateTasks(tasks => {
      return tasks.map(task => {
        if (task.id === id) {
          const acceptance_criteria = task.acceptance_criteria || [];
          if (index >= 0 && index < acceptance_criteria.length) {
            acceptance_criteria[index] = { ...acceptance_criteria[index], text };
          }
          return {
            ...task,
            acceptance_criteria,
            updated_at: new Date().toISOString()
          };
        }
        return task;
      });
    });
    console.log(`Updated acceptance criteria ${index} for task ${id}`);
  });

acCmd
  .command('remove <id> <index>')
  .description('Remove acceptance criteria from a task')
  .action(async (id: string, indexStr: string) => {
    const { storage } = setupServices();
    const index = parseInt(indexStr);
    if (isNaN(index)) {
      console.error('Index must be a number');
      return;
    }
    await storage.updateTasks(tasks => {
      return tasks.map(task => {
        if (task.id === id) {
          const acceptance_criteria = task.acceptance_criteria || [];
          if (index >= 0 && index < acceptance_criteria.length) {
            acceptance_criteria.splice(index, 1);
          }
          return {
            ...task,
            acceptance_criteria,
            updated_at: new Date().toISOString()
          };
        }
        return task;
      });
    });
    console.log(`Removed acceptance criteria ${index} from task ${id}`);
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
    await storage.updateTasks(tasks => {
      return tasks.map(task => {
        if (task.id === id) {
          const acceptance_criteria = task.acceptance_criteria || [];
          if (index >= 0 && index < acceptance_criteria.length) {
            acceptance_criteria[index] = { ...acceptance_criteria[index], completed: !acceptance_criteria[index].completed };
          }
          return {
            ...task,
            acceptance_criteria,
            updated_at: new Date().toISOString()
          };
        }
        return task;
      });
    });
    console.log(`Toggled acceptance criteria ${index} completion for task ${id}`);
  });

program.parse();
