# Cairn Core API Documentation

## Overview

The Cairn Core library provides the fundamental data structures and services for task management in AI-assisted development workflows. It offers persistent memory through a dependency-aware graph that maintains context across long development sessions.

## Installation

```bash
npm install @valpet/cairn-core
```

## Architecture

The core library is built around several key components:

- **Types**: Data models and interfaces
- **Storage**: JSONL-based persistence with concurrency control
- **Graph**: Dependency relationship management
- **Compaction**: Automatic data optimization
- **Container**: Dependency injection setup

## API Reference

### Types

#### Task

The central data structure representing a task or issue.

```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  type?: TaskType;
  status: TaskStatus;
  priority?: Priority;
  assignee?: string;
  labels?: string[];
  dependencies?: Dependency[];
  dependents?: string[]; // computed
  created_at: string;
  updated_at: string;
  closed_at?: string;
  design?: string;
  notes?: string; // deprecated: use comments instead
  comments?: Comment[];
  acceptance_criteria?: AcceptanceCriteria[];
  completion_percentage?: number; // computed
}
```

**Properties:**
- `id`: Unique identifier (generated using nanoid)
- `title`: Task title
- `description`: Optional detailed description
- `type`: Task type (epic, feature, task, bug, chore, docs, refactor)
- `status`: Current status (open, in_progress, closed, blocked)
- `priority`: Priority level (low, medium, high, urgent)
- `assignee`: Assigned user
- `labels`: Array of label strings
- `dependencies`: Array of dependency relationships
- `dependents`: Computed array of dependent task IDs
- `created_at`: ISO timestamp of creation
- `updated_at`: ISO timestamp of last update
- `closed_at`: ISO timestamp when closed (if applicable)
- `design`: Design notes or specifications
- `notes`: Legacy notes field (deprecated, use comments)
- `comments`: Array of comment objects
- `acceptance_criteria`: Array of acceptance criteria
- `completion_percentage`: Computed completion percentage

#### Comment

Represents a comment on a task.

```typescript
interface Comment {
  id: string;
  author: string;
  content: string;
  created_at: string;
}
```

#### Dependency

Represents a relationship between tasks.

```typescript
interface Dependency {
  id: string;
  type: DependencyType;
}
```

**Types:**
- `blocks`: This task blocks the referenced task
- `related`: General relationship
- `parent-child`: Epic-subtask relationship
- `discovered-from`: Task discovered while working on another

#### CairnConfig

Configuration for Cairn initialization.

```typescript
interface CairnConfig {
  cairnDir: string;
  gitEnabled: boolean;
}
```

### Storage Service

#### IStorageService

Interface for data persistence operations.

```typescript
interface IStorageService {
  loadTasks(): Promise<Task[]>;
  saveTask(task: Task): Promise<void>;
  updateTasks(updater: (tasks: Task[]) => Task[]): Promise<void>;
  addComment(taskId: string, author: string, content: string): Promise<Comment>;
  getTasksFilePath(): string;
}
```

#### Methods

##### loadTasks()

Loads all tasks from storage.

```typescript
loadTasks(): Promise<Task[]>
```

**Returns:** Promise resolving to array of all tasks

##### saveTask(task)

Saves a new task to storage.

```typescript
saveTask(task: Task): Promise<void>
```

**Parameters:**
- `task`: The task to save

**Throws:** Error if task with same ID already exists

##### updateTasks(updater)

Atomically updates tasks using a function.

```typescript
updateTasks(updater: (tasks: Task[]) => Task[]): Promise<void>
```

**Parameters:**
- `updater`: Function that takes current tasks and returns updated tasks

**Example:**
```typescript
await storage.updateTasks(tasks =>
  tasks.map(task =>
    task.id === 'task-1'
      ? { ...task, status: 'closed', closed_at: new Date().toISOString() }
      : task
  )
);
```

##### addComment(taskId, author, content)

Adds a comment to a task.

```typescript
addComment(taskId: string, author: string, content: string): Promise<Comment>
```

**Parameters:**
- `taskId`: ID of the task to comment on
- `author`: Comment author
- `content`: Comment text

**Returns:** The created comment object

##### getTasksFilePath()

Gets the path to the tasks storage file.

```typescript
getTasksFilePath(): string
```

**Returns:** Absolute path to the tasks.jsonl file

### Graph Service

#### IGraphService

Interface for dependency graph operations.

```typescript
interface IGraphService {
  buildGraph(tasks: Task[]): Map<string, Task>;
  getReadyWork(tasks: Task[]): Task[];
  getBlockedTasks(tasks: Task[]): Task[];
  addDependency(fromId: string, toId: string, type: DependencyType, tasks: Task[]): Task[];
  removeDependency(fromId: string, toId: string, tasks: Task[]): Task[];
  getEpicSubtasks(epicId: string, tasks: Task[]): Task[];
  getSubtaskEpic(subtaskId: string, tasks: Task[]): Task | null;
  calculateEpicProgress(epicId: string, tasks: Task[]): { completed: number; total: number; percentage: number };
  shouldCloseEpic(epicId: string, tasks: Task[]): boolean;
  getNonParentedTasks(tasks: Task[]): Task[];
}
```

#### Methods

##### buildGraph(tasks)

Builds a dependency graph from tasks.

```typescript
buildGraph(tasks: Task[]): Map<string, Task>
```

**Parameters:**
- `tasks`: Array of tasks

**Returns:** Map of task ID to task with computed dependents

##### getReadyWork(tasks)

Gets tasks that are ready to work on (open and not blocked).

```typescript
getReadyWork(tasks: Task[]): Task[]
```

**Parameters:**
- `tasks`: Array of tasks

**Returns:** Array of unblocked open tasks

##### getBlockedTasks(tasks)

Gets tasks that are currently blocked.

```typescript
getBlockedTasks(tasks: Task[]): Task[]
```

**Parameters:**
- `tasks`: Array of tasks

**Returns:** Array of blocked tasks

##### addDependency(fromId, toId, type, tasks)

Adds a dependency relationship between tasks.

```typescript
addDependency(fromId: string, toId: string, type: DependencyType, tasks: Task[]): Task[]
```

**Parameters:**
- `fromId`: ID of the dependent task
- `toId`: ID of the task it depends on
- `type`: Type of dependency
- `tasks`: Current tasks array

**Returns:** Updated tasks array

##### removeDependency(fromId, toId, tasks)

Removes a dependency relationship.

```typescript
removeDependency(fromId: string, toId: string, tasks: Task[]): Task[]
```

**Parameters:**
- `fromId`: ID of the dependent task
- `toId`: ID of the task it depends on
- `tasks`: Current tasks array

**Returns:** Updated tasks array

##### getEpicSubtasks(epicId, tasks)

Gets all subtasks of an epic.

```typescript
getEpicSubtasks(epicId: string, tasks: Task[]): Task[]
```

**Parameters:**
- `epicId`: ID of the epic
- `tasks`: Array of tasks

**Returns:** Array of subtask tasks

##### getSubtaskEpic(subtaskId, tasks)

Gets the epic that a subtask belongs to.

```typescript
getSubtaskEpic(subtaskId: string, tasks: Task[]): Task | null
```

**Parameters:**
- `subtaskId`: ID of the subtask
- `tasks`: Array of tasks

**Returns:** Epic task or null if not found

##### calculateEpicProgress(epicId, tasks)

Calculates progress percentage for an epic.

```typescript
calculateEpicProgress(epicId: string, tasks: Task[]): { completed: number; total: number; percentage: number }
```

**Parameters:**
- `epicId`: ID of the epic
- `tasks`: Array of tasks

**Returns:** Object with completed count, total count, and percentage

##### shouldCloseEpic(epicId, tasks)

Determines if an epic should be closed (all subtasks completed).

```typescript
shouldCloseEpic(epicId: string, tasks: Task[]): boolean
```

**Parameters:**
- `epicId`: ID of the epic
- `tasks`: Array of tasks

**Returns:** True if all subtasks are closed

##### getNonParentedTasks(tasks)

Gets tasks that are not subtasks (no parent-child dependencies).

```typescript
getNonParentedTasks(tasks: Task[]): Task[]
```

**Parameters:**
- `tasks`: Array of tasks

**Returns:** Array of tasks without parent relationships

### Compaction Service

#### ICompactionService

Interface for data compaction operations.

```typescript
interface ICompactionService {
  compactTasks(issues: Task[]): Task[];
}
```

#### Methods

##### compactTasks(tasks)

Compacts old closed tasks to save space.

```typescript
compactTasks(tasks: Task[]): Task[]
```

**Parameters:**
- `tasks`: Array of tasks

**Returns:** Array with old tasks truncated

**Behavior:**
- Tasks closed more than 30 days ago have their description/notes truncated
- Design field is removed
- Other fields are preserved

### Container Setup

#### createContainer(cairnDir, repoPath)

Creates and configures the dependency injection container.

```typescript
function createContainer(cairnDir: string, repoPath: string): Container
```

**Parameters:**
- `cairnDir`: Path to the .cairn directory
- `repoPath`: Path to the repository root

**Returns:** Configured Inversify container

**Example:**
```typescript
import { createContainer, TYPES, IStorageService, IGraphService } from '@valpet/cairn-core';

const container = createContainer('/path/to/.cairn', '/path/to/repo');
const storage = container.get<IStorageService>(TYPES.IStorageService);
const graph = container.get<IGraphService>(TYPES.IGraphService);
```

## Usage Examples

### Basic Task Management

```typescript
import { createContainer, TYPES, IStorageService, IGraphService } from '@valpet/cairn-core';

const container = createContainer('./.cairn', './');
const storage = container.get<IStorageService>(TYPES.IStorageService);
const graph = container.get<IGraphService>(TYPES.IGraphService);

// Create a new task
const task = {
  id: 'task-1',
  title: 'Implement user authentication',
  status: 'open',
  type: 'feature',
  priority: 'high',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

await storage.saveTask(task);

// Get ready work
const readyTasks = graph.getReadyWork(await storage.loadTasks());
console.log('Ready to work on:', readyTasks.map(t => t.title));
```

### Epic Management

```typescript
// Create an epic
const epic = {
  id: 'epic-1',
  title: 'User Management System',
  status: 'open',
  type: 'epic',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

await storage.saveTask(epic);

// Create subtasks
const subtask1 = {
  id: 'task-2',
  title: 'Design user schema',
  status: 'open',
  type: 'task',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  dependencies: [{ id: 'epic-1', type: 'parent-child' }]
};

await storage.saveTask(subtask1);

// Add dependency
await storage.updateTasks(tasks =>
  graph.addDependency('task-2', 'epic-1', 'parent-child', tasks)
);

// Check epic progress
const progress = graph.calculateEpicProgress('epic-1', await storage.loadTasks());
console.log(`Epic progress: ${progress.completed}/${progress.total} (${progress.percentage}%)`);
```

### Dependency Management

```typescript
// Task A blocks Task B
await storage.updateTasks(tasks =>
  graph.addDependency('task-b', 'task-a', 'blocks', tasks)
);

// Get blocked tasks
const blocked = graph.getBlockedTasks(await storage.loadTasks());
console.log('Blocked tasks:', blocked.map(t => t.title));

// Get ready work (unblocked)
const ready = graph.getReadyWork(await storage.loadTasks());
console.log('Ready tasks:', ready.map(t => t.title));
```

## Error Handling

The API methods may throw errors in various scenarios:

- **Storage Errors**: File system issues, permission problems, corruption
- **Validation Errors**: Invalid task IDs, malformed data
- **Concurrency Errors**: File locking timeouts, concurrent modification conflicts

Always wrap API calls in try-catch blocks:

```typescript
try {
  await storage.saveTask(newTask);
} catch (error) {
  console.error('Failed to save task:', error.message);
}
```

## Data Persistence

Tasks are stored in JSONL format (JSON Lines) in `.cairn/tasks.jsonl`:

```
{"id":"task-1","title":"Example Task","status":"open",...}
{"id":"task-2","title":"Another Task","status":"closed",...}
```

- Each line is a valid JSON object
- File is append-only for new tasks
- Updates rewrite the entire file
- File locking prevents corruption during concurrent access

## Thread Safety

The storage service uses file locking and write queuing to ensure thread safety:

- Write operations are serialized
- File locks prevent concurrent file access
- Stale locks are automatically cleaned up
- Lock timeouts prevent indefinite blocking

## Performance Considerations

- **Memory Usage**: All tasks are loaded into memory
- **File I/O**: Updates require full file rewrites
- **Graph Operations**: O(n) complexity for graph traversals
- **Compaction**: Runs on every load operation

For large projects (>1000 tasks), consider:
- Implementing pagination
- Using database storage instead of JSONL
- Caching frequently accessed data

## Migration and Versioning

The current API is version 1.0.0. Future versions may include:

- Schema migrations for data structure changes
- Performance optimizations
- Additional dependency types
- Enhanced search and filtering

Breaking changes will be communicated through:
- Version number increments
- Migration guides
- Deprecation warnings