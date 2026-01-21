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

#### Issue

The central data structure representing a task or issue.

```typescript
interface Issue {
  id: string;
  title: string;
  description?: string;
  type?: IssueType;
  status: IssueStatus;
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
}
```

**Properties:**
- `id`: Unique identifier (generated using nanoid)
- `title`: Task title
- `description`: Optional detailed description
- `type`: Issue type (epic, feature, task, bug, chore, docs, refactor)
- `status`: Current status (open, in_progress, closed, blocked)
- `priority`: Priority level (low, medium, high, urgent)
- `assignee`: Assigned user
- `labels`: Array of label strings
- `dependencies`: Array of dependency relationships
- `dependents`: Computed array of dependent issue IDs
- `created_at`: ISO timestamp of creation
- `updated_at`: ISO timestamp of last update
- `closed_at`: ISO timestamp when closed (if applicable)
- `design`: Design notes or specifications
- `notes`: Legacy notes field (deprecated, use comments)
- `comments`: Array of comment objects

#### Comment

Represents a comment on an issue.

```typescript
interface Comment {
  id: string;
  author: string;
  content: string;
  created_at: string;
}
```

#### Dependency

Represents a relationship between issues.

```typescript
interface Dependency {
  id: string;
  type: DependencyType;
}
```

**Types:**
- `blocks`: This issue blocks the referenced issue
- `related`: General relationship
- `parent-child`: Epic-subtask relationship
- `discovered-from`: Issue discovered while working on another

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
  loadIssues(): Promise<Issue[]>;
  saveIssue(issue: Issue): Promise<void>;
  updateIssues(updater: (issues: Issue[]) => Issue[]): Promise<void>;
  addComment(issueId: string, author: string, content: string): Promise<Comment>;
  getIssuesFilePath(): string;
}
```

#### Methods

##### loadIssues()

Loads all issues from storage.

```typescript
loadIssues(): Promise<Issue[]>
```

**Returns:** Promise resolving to array of all issues

##### saveIssue(issue)

Saves a new issue to storage.

```typescript
saveIssue(issue: Issue): Promise<void>
```

**Parameters:**
- `issue`: The issue to save

**Throws:** Error if issue with same ID already exists

##### updateIssues(updater)

Atomically updates issues using a function.

```typescript
updateIssues(updater: (issues: Issue[]) => Issue[]): Promise<void>
```

**Parameters:**
- `updater`: Function that takes current issues and returns updated issues

**Example:**
```typescript
await storage.updateIssues(issues =>
  issues.map(issue =>
    issue.id === 'task-1'
      ? { ...issue, status: 'closed', closed_at: new Date().toISOString() }
      : issue
  )
);
```

##### addComment(issueId, author, content)

Adds a comment to an issue.

```typescript
addComment(issueId: string, author: string, content: string): Promise<Comment>
```

**Parameters:**
- `issueId`: ID of the issue to comment on
- `author`: Comment author
- `content`: Comment text

**Returns:** The created comment object

##### getIssuesFilePath()

Gets the path to the issues storage file.

```typescript
getIssuesFilePath(): string
```

**Returns:** Absolute path to the issues.jsonl file

### Graph Service

#### IGraphService

Interface for dependency graph operations.

```typescript
interface IGraphService {
  buildGraph(issues: Issue[]): Map<string, Issue>;
  getReadyWork(issues: Issue[]): Issue[];
  getBlockedIssues(issues: Issue[]): Issue[];
  addDependency(fromId: string, toId: string, type: DependencyType, issues: Issue[]): Issue[];
  removeDependency(fromId: string, toId: string, issues: Issue[]): Issue[];
  getEpicSubtasks(epicId: string, issues: Issue[]): Issue[];
  getSubtaskEpic(subtaskId: string, issues: Issue[]): Issue | null;
  calculateEpicProgress(epicId: string, issues: Issue[]): { completed: number; total: number; percentage: number };
  shouldCloseEpic(epicId: string, issues: Issue[]): boolean;
  getNonParentedIssues(issues: Issue[]): Issue[];
}
```

#### Methods

##### buildGraph(issues)

Builds a dependency graph from issues.

```typescript
buildGraph(issues: Issue[]): Map<string, Issue>
```

**Parameters:**
- `issues`: Array of issues

**Returns:** Map of issue ID to issue with computed dependents

##### getReadyWork(issues)

Gets issues that are ready to work on (open and not blocked).

```typescript
getReadyWork(issues: Issue[]): Issue[]
```

**Parameters:**
- `issues`: Array of issues

**Returns:** Array of unblocked open issues

##### getBlockedIssues(issues)

Gets issues that are currently blocked.

```typescript
getBlockedIssues(issues: Issue[]): Issue[]
```

**Parameters:**
- `issues`: Array of issues

**Returns:** Array of blocked issues

##### addDependency(fromId, toId, type, issues)

Adds a dependency relationship between issues.

```typescript
addDependency(fromId: string, toId: string, type: DependencyType, issues: Issue[]): Issue[]
```

**Parameters:**
- `fromId`: ID of the dependent issue
- `toId`: ID of the issue it depends on
- `type`: Type of dependency
- `issues`: Current issues array

**Returns:** Updated issues array

##### removeDependency(fromId, toId, issues)

Removes a dependency relationship.

```typescript
removeDependency(fromId: string, toId: string, issues: Issue[]): Issue[]
```

**Parameters:**
- `fromId`: ID of the dependent issue
- `toId`: ID of the issue it depends on
- `issues`: Current issues array

**Returns:** Updated issues array

##### getEpicSubtasks(epicId, issues)

Gets all subtasks of an epic.

```typescript
getEpicSubtasks(epicId: string, issues: Issue[]): Issue[]
```

**Parameters:**
- `epicId`: ID of the epic
- `issues`: Array of issues

**Returns:** Array of subtask issues

##### getSubtaskEpic(subtaskId, issues)

Gets the epic that a subtask belongs to.

```typescript
getSubtaskEpic(subtaskId: string, issues: Issue[]): Issue | null
```

**Parameters:**
- `subtaskId`: ID of the subtask
- `issues`: Array of issues

**Returns:** Epic issue or null if not found

##### calculateEpicProgress(epicId, issues)

Calculates progress percentage for an epic.

```typescript
calculateEpicProgress(epicId: string, issues: Issue[]): { completed: number; total: number; percentage: number }
```

**Parameters:**
- `epicId`: ID of the epic
- `issues`: Array of issues

**Returns:** Object with completed count, total count, and percentage

##### shouldCloseEpic(epicId, issues)

Determines if an epic should be closed (all subtasks completed).

```typescript
shouldCloseEpic(epicId: string, issues: Issue[]): boolean
```

**Parameters:**
- `epicId`: ID of the epic
- `issues`: Array of issues

**Returns:** True if all subtasks are closed

##### getNonParentedIssues(issues)

Gets issues that are not subtasks (no parent-child dependencies).

```typescript
getNonParentedIssues(issues: Issue[]): Issue[]
```

**Parameters:**
- `issues`: Array of issues

**Returns:** Array of issues without parent relationships

### Compaction Service

#### ICompactionService

Interface for data compaction operations.

```typescript
interface ICompactionService {
  compactIssues(issues: Issue[]): Issue[];
}
```

#### Methods

##### compactIssues(issues)

Compacts old closed issues to save space.

```typescript
compactIssues(issues: Issue[]): Issue[]
```

**Parameters:**
- `issues`: Array of issues

**Returns:** Array with old issues truncated

**Behavior:**
- Issues closed more than 30 days ago have their description/notes truncated
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

await storage.saveIssue(task);

// Get ready work
const readyTasks = graph.getReadyWork(await storage.loadIssues());
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

await storage.saveIssue(epic);

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

await storage.saveIssue(subtask1);

// Add dependency
await storage.updateIssues(issues =>
  graph.addDependency('task-2', 'epic-1', 'parent-child', issues)
);

// Check epic progress
const progress = graph.calculateEpicProgress('epic-1', await storage.loadIssues());
console.log(`Epic progress: ${progress.completed}/${progress.total} (${progress.percentage}%)`);
```

### Dependency Management

```typescript
// Task A blocks Task B
await storage.updateIssues(issues =>
  graph.addDependency('task-b', 'task-a', 'blocks', issues)
);

// Get blocked issues
const blocked = graph.getBlockedIssues(await storage.loadIssues());
console.log('Blocked tasks:', blocked.map(t => t.title));

// Get ready work (unblocked)
const ready = graph.getReadyWork(await storage.loadIssues());
console.log('Ready tasks:', ready.map(t => t.title));
```

## Error Handling

The API methods may throw errors in various scenarios:

- **Storage Errors**: File system issues, permission problems, corruption
- **Validation Errors**: Invalid issue IDs, malformed data
- **Concurrency Errors**: File locking timeouts, concurrent modification conflicts

Always wrap API calls in try-catch blocks:

```typescript
try {
  await storage.saveIssue(newIssue);
} catch (error) {
  console.error('Failed to save issue:', error.message);
}
```

## Data Persistence

Issues are stored in JSONL format (JSON Lines) in `.cairn/issues.jsonl`:

```
{"id":"task-1","title":"Example Task","status":"open",...}
{"id":"task-2","title":"Another Task","status":"closed",...}
```

- Each line is a valid JSON object
- File is append-only for new issues
- Updates rewrite the entire file
- File locking prevents corruption during concurrent access

## Thread Safety

The storage service uses file locking and write queuing to ensure thread safety:

- Write operations are serialized
- File locks prevent concurrent file access
- Stale locks are automatically cleaned up
- Lock timeouts prevent indefinite blocking

## Performance Considerations

- **Memory Usage**: All issues are loaded into memory
- **File I/O**: Updates require full file rewrites
- **Graph Operations**: O(n) complexity for graph traversals
- **Compaction**: Runs on every load operation

For large projects (>1000 issues), consider:
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