# Cairn VS Code Extension API Documentation

## Overview

The Cairn VS Code extension provides deep integration with the VS Code editor, including webview-based task management interfaces and Copilot language model tools for AI-assisted development.

## Installation

The extension is published to the VS Code marketplace. Install via:

1. VS Code Command Palette (`Ctrl+Shift+P`)
2. Search for "Cairn Task Management"
3. Click Install

Or install via CLI:
```bash
code --install-extension cairn-extension
```

## Activation

The extension activates when:
- Opening a workspace with a `.cairn` directory
- Executing any Cairn command
- Using language model tools

## Commands

### cairn.openTaskList

Opens the main task list webview.

**Command ID:** `cairn.openTaskList`
**Keybinding:** `Ctrl+Shift+T` (Windows/Linux), `Cmd+Shift+T` (Mac)

**Description:**
- Displays all tasks in a filterable, hierarchical grid
- Shows task status, priority, dependencies
- Provides quick actions (start, complete, edit, delete)
- Real-time updates when issues file changes

### cairn.createTicket

Opens the ticket creation/editing interface for a new task.

**Command ID:** `cairn.createTicket`
**Keybinding:** `Ctrl+Shift+N` (Windows/Linux), `Cmd+Shift+N` (Mac)

**Description:**
- Creates a new task with full metadata editing
- Pre-fills with sensible defaults
- Opens in editing mode immediately

### cairn.editTicket

Opens the ticket editing interface for an existing task.

**Command ID:** `cairn.editTicket`

**Arguments:**
- `id` (string): Task ID to edit
- `viewColumn` (optional): VS Code view column for the webview

**Description:**
- Full editing interface for task metadata
- Subtask management
- Dependency relationship editing
- Comment system

### cairn.switchFile

Opens a quick pick menu to switch between issue files.

**Command ID:** `cairn.switchFile`
**Keybinding:** None (available via status bar and command palette)

**Description:**
- Shows all available issue files
- Indicates current active file with checkmark
- Allows creating new issue files
- Hot-swaps services without window reload
- Updates status bar and task list automatically

## Language Model Tools

The extension provides Copilot integration through language model tools.

### cairn_create

Creates a new task in the Cairn system.

**Tool Name:** `cairn_create`
**Display Name:** Create Task

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "description": "The title of the task"
    },
    "description": {
      "type": "string",
      "description": "Optional description of the task"
    },
    "type": {
      "type": "string",
      "enum": ["task", "bug", "feature", "epic", "chore", "docs", "refactor"],
      "description": "Type of the task"
    },
    "priority": {
      "type": "string",
      "enum": ["low", "medium", "high", "urgent"],
      "description": "Priority level"
    },
    "status": {
      "type": "string",
      "enum": ["open", "in_progress", "closed", "blocked"],
      "description": "Initial status of the task"
    },
    "parent": {
      "type": "string",
      "description": "Optional parent task ID for parent-child relationship"
    }
  },
  "required": ["title"]
}
```

**Example Usage:**
```
Create a new high-priority bug fix task for the login issue
```

### cairn_list_ready

Lists all unblocked tasks that are ready to work on.

**Tool Name:** `cairn_list_ready`
**Display Name:** List Ready Tasks

**Input Schema:**
```json
{
  "type": "object",
  "properties": {}
}
```

**Returns:**
```json
{
  "success": true,
  "readyTasks": [
    {
      "id": "task-1",
      "title": "Implement user login",
      "status": "open",
      "priority": "high"
    }
  ]
}
```

### cairn_update

Updates an existing task's status or acceptance criteria.

**Tool Name:** `cairn_update`
**Display Name:** Update Task

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "The ID of the task to update"
    },
    "status": {
      "type": "string",
      "enum": ["open", "in_progress", "closed", "blocked"],
      "description": "New status for the task"
    }
  },
  "required": ["id"]
}
```

### cairn_dep_add

Adds a dependency relationship between two tasks.

**Tool Name:** `cairn_dep_add`
**Display Name:** Add Dependency

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "from": {
      "type": "string",
      "description": "The ID of the dependent task"
    },
    "to": {
      "type": "string",
      "description": "The ID of the task it depends on"
    },
    "type": {
      "type": "string",
      "enum": ["blocks", "related", "parent-child", "discovered-from"],
      "description": "Type of dependency"
    }
  },
  "required": ["from", "to", "type"]
}
```

### cairn_comment

Adds a comment to a task for collaboration.

**Tool Name:** `cairn_comment`
**Display Name:** Add Comment

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "issue_id": {
      "type": "string",
      "description": "The ID of the task to add a comment to"
    },
    "author": {
      "type": "string",
      "description": "Author of the comment (e.g., 'agent' or developer name)"
    },
    "content": {
      "type": "string",
      "description": "The comment text content"
    }
  },
  "required": ["issue_id", "author", "content"]
}
```

## Webview APIs

### Task List Webview

The main task list interface provides a comprehensive grid view.

#### Message Protocol

**To Extension:**
```typescript
interface WebviewMessage {
  type: string;
  [key: string]: any;
}
```

**From Extension:**
```typescript
interface ExtensionMessage {
  type: string;
  [key: string]: any;
}
```

#### Supported Messages

**webviewReady**
- Direction: Webview → Extension
- Description: Signals that the webview has loaded and is ready to receive data

**updateTasks**
- Direction: Extension → Webview
- Payload: `{ tasks: Task[], currentFile: string, availableFiles: string[] }`
- Description: Updates the displayed task list and file context information

**switchFile**
- Direction: Webview → Extension
- Payload: `{ file: string }`
- Description: Requests switching to a different issue file

**startTask**
- Direction: Webview → Extension
- Payload: `{ id: string }`
- Description: Marks a task as in progress

**completeTask**
- Direction: Webview → Extension
- Payload: `{ id: string }`
- Description: Marks a task as closed

**editTicket**
- Direction: Webview → Extension
- Payload: `{ id: string }`
- Description: Opens the ticket editor for the specified task

**createTicket**
- Direction: Webview → Extension
- Description: Opens the ticket creation interface

**deleteTask**
- Direction: Webview → Extension
- Payload: `{ id: string }`
- Description: Deletes the specified task

### Ticket Editor Webview

The ticket editing interface provides full CRUD operations.

#### Supported Messages

**loadTicket**
- Direction: Extension → Webview
- Payload: `{ ticket: Task, subtasks: Task[], dependencies: DependencyInfo[] }`
- Description: Loads ticket data into the editor

**saveTicket**
- Direction: Webview → Extension
- Payload: `{ ticket: Task }`
- Description: Saves changes to the ticket

**getGitUser**
- Direction: Webview → Extension
- Response: `{ userName: string, userEmail: string }`
- Description: Gets git user information for comment attribution

**getAvailableSubtasks**
- Direction: Webview → Extension
- Response: `{ subtasks: Task[] }`
- Description: Gets issues that can be added as subtasks

**getAvailableDependencies**
- Direction: Webview → Extension
- Response: `{ dependencies: Task[] }`
- Description: Gets issues that can be added as dependencies

**editTicket**
- Direction: Webview → Extension
- Payload: `{ id: string }`
- Description: Opens another ticket for editing

**deleteTask**
- Direction: Webview → Extension
- Payload: `{ id: string }`
- Description: Deletes the current ticket

**addComment**
- Direction: Webview → Extension
- Payload: `{ issueId: string, author: string, content: string }`
- Description: Adds a comment to the ticket

**commentAdded**
- Direction: Extension → Webview
- Payload: `{ comment: Comment }`
- Description: Confirms comment was added successfully

## Configuration

The extension respects VS Code settings:

- **Editor Theme**: Automatically adapts to light/dark themes
- **Font Settings**: Uses VS Code font family and size
- **Color Scheme**: Matches VS Code color tokens

## Multiple Task Files

The extension supports working with multiple issue files for context separation.

### File Switching

**Three Ways to Switch Files:**

1. **Status Bar**: Click the status bar item showing `Cairn: {filename}` to open the file selector
2. **Command Palette**: Run `Cairn: Switch Task File` command
3. **Task List**: Use the dropdown selector at the top of the task list webview

### Smart Synchronization

When the CLI changes the active file (via `cairn use`), the extension:

1. **Detects the Change**: Monitors `.cairn/config.json` for modifications
2. **Notifies the User**: Shows an information message with the new context
3. **Offers Choice**: Provides "Switch Now" or "Stay Here" buttons
4. **Respects Decision**: Only switches if user explicitly chooses to

This prevents disruption when working while allowing easy synchronization across tools.

### Creating New Files

From the file selector quick pick:
1. Select `$(add) Create New Task File`
2. Enter a name (letters, numbers, hyphens, underscores only)
3. File is created and automatically activated

### Status Bar Indicator

The status bar always shows the current active file:
- Format: `$(file) Cairn: {filename}`
- Tooltip: Shows full filename (e.g., `issues.jsonl`, `feature-auth.jsonl`)
- Click to switch files

### File Watching

The extension automatically watches the currently active file:
- When you switch files, the watcher updates to the new file
- Changes from CLI commands are reflected in real-time
- Task list updates automatically when the file changes

## File Watching

The extension monitors the `issues.jsonl` file for changes:

- Automatic UI updates when file is modified externally
- Debounced updates to prevent excessive refreshes
- Proper cleanup when webviews are disposed

## Error Handling

The extension provides user-friendly error messages for:

- Missing `.cairn` directory
- File system permission issues
- Invalid issue IDs
- Network/API failures
- Webview communication errors

## Performance

- Lazy loading of webview resources
- Efficient DOM updates for large task lists
- File watching with debouncing
- Memory cleanup on deactivation

## Extension Architecture

```
src/extension.ts          # Main extension entry point
├── Language Model Tools  # Copilot integration
├── VS Code Commands      # User commands
├── Webview Management    # Panel creation and messaging
└── Service Integration   # Core library usage

src/components/           # React components for webviews
├── TaskList.tsx         # Main task list component
├── TaskEdit.tsx         # Ticket editor component
├── TaskGrid.tsx          # Task display grid
├── AcceptanceCriteriaSection.tsx  # AC management
├── CommentsSection.tsx   # Comment system
├── hooks/                # React hooks for state management
└── utils.ts              # Shared utilities

assets/                   # Static assets
└── cairn-icon.png        # Extension icon
```

## React Components

The extension uses React for building interactive webview interfaces. Key components include:

### Core Components

- **TaskList**: Main task list with filtering, sorting, and hierarchy display
- **TaskEdit**: Full-featured ticket editor with metadata, dependencies, and comments
- **TaskGrid**: Efficient grid layout for task display with virtual scrolling
- **FileSelector**: Dropdown for switching between issue files
- **StatusFilter**: Filter tasks by status (open, in_progress, closed, etc.)
- **AcceptanceCriteriaSection**: Interactive acceptance criteria management
- **CommentsSection**: Comment thread with real-time updates

### Hooks and Utilities

- **useTaskState**: Manages task data and synchronization
- **useTaskHierarchy**: Handles parent-child relationships and tree structure
- **useTaskInteractions**: Manages user interactions and state updates
- **useVSCodeMessaging**: Handles communication with the VS Code extension host

### State Management

The extension uses React hooks for local state management, with data synchronized through VS Code's webview messaging API. Changes are persisted to the `issues.jsonl` file via the extension host.

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Packaging

```bash
npm run package-all
```

## API Stability

- **Language Model Tools**: Stable API, follows VS Code extension guidelines
- **Commands**: Stable, follows VS Code command patterns
- **Webview Messages**: Internal API, may change between versions
- **Core Integration**: Depends on @valpet/cairn-core package versioning

## Troubleshooting

### Common Tasks

**Extension not activating:**
- Ensure `.cairn` directory exists
- Check VS Code developer console for errors

**Webview not loading:**
- Check network/firewall settings
- Verify file permissions on `.cairn` directory

**Tools not appearing in Copilot:**
- Ensure GitHub Copilot Chat extension is installed
- Check that language model tools are enabled

**File watching not working:**
- Check file system permissions
- Verify `.cairn/issues.jsonl` exists and is writable

### Debug Information

Enable debug logging in VS Code developer console:

```javascript
// In developer console
console.log('Cairn extension status:', vscode.extensions.getExtension('cairn-extension'));
```

## Contributing

The extension follows VS Code extension development best practices:

- TypeScript for type safety
- Webpack for bundling
- ESLint for code quality
- Comprehensive testing with Vitest