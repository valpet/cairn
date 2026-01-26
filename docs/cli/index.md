# Cairn CLI API Documentation

## Overview

The Cairn CLI provides command-line access to all Cairn task management functionality. It automatically discovers `.cairn` directories and provides comprehensive task operations.

## Installation

```bash
npm install -g @valpet/cairn-cli
# or
npx @valpet/cairn-cli
```

## Commands

### init

Initialize Cairn in a project directory.

```bash
cairn init [options]
```

**Options:**
- `-s, --stealth`: Enable stealth mode (add .cairn to .gitignore)

**Description:**
- Creates `.cairn` directory
- Initializes `issues.jsonl` file
- Adds Copilot workflow instructions to `.github/copilot-instructions.md`
- Optionally adds `.cairn` to `.gitignore`

### create

Create a new task or issue.

```bash
cairn create <title> [options]
```

**Options:**
- `-d, --description <desc>`: Task description
- `-t, --type <type>`: Task type (task, epic, feature, bug, chore, docs, refactor)
- `-p, --priority <priority>`: Priority (low, medium, high, urgent)
- `-s, --status <status>`: Initial status (open, in_progress, closed, blocked)
- `-r, --parent <parent>`: Parent issue ID for parent-child dependency

**Examples:**
```bash
cairn create "Implement user login"
cairn create "Fix authentication bug" -t bug -p high
cairn create "Design system" -t epic -d "High-level system design"
```

### update

Update an existing issue.

```bash
cairn update <id> [options]
```

**Options:**
- `-s, --status <status>`: New status
- `-t, --title <title>`: New title
- `-d, --description <desc>`: New description
- `-y, --type <type>`: New type
- `-n, --notes <notes>`: Notes (deprecated, use comments)
- `-p, --priority <priority>`: New priority
- `-a, --assignee <assignee>`: Assignee
- `-l, --labels <labels>`: Labels (comma-separated)
- `-c, --acceptance-criteria <criteria>`: Acceptance criteria (comma-separated)

**Examples:**
```bash
cairn update task-1 -s in_progress
cairn update task-1 -t "Updated task title"
cairn update task-1 -p high -a "john.doe"
```

### list

List issues with filtering options.

```bash
cairn list [options]
```

**Options:**
- `-s, --status <status>`: Filter by status
- `-t, --type <type>`: Filter by type
- `-r, --ready`: Show only ready work (unblocked open issues)

**Examples:**
```bash
cairn list
cairn list --ready
cairn list -s open -t bug
```

**Output Format:**
```
task-1: Implement user login [open] [feature]
epic-1: User Management System [open] [epic] (1/3 33%)
```

### use

Switch between multiple issue files or list available files.

```bash
cairn use [name]
```

**Arguments:**
- `name` (optional): Name of the issue file to switch to

**Description:**
- Without arguments: Lists all available issue files and shows the current active file
- With a file name: Switches to the specified issue file (creates it if it doesn't exist)
- File naming: `default` uses `issues.jsonl`, other names use `{name}.jsonl`
- Active file selection persists in `.cairn/config.json`

**Examples:**
```bash
# Show current file and list all available files
cairn use

# Output:
# Current: default (issues.jsonl)
#
# Available issue files:
#   * default (issues.jsonl)
#     feature-auth (feature-auth.jsonl)
#     bugfixes (bugfixes.jsonl)

# Switch to a different file
cairn use feature-auth

# Switch back to default
cairn use default

# Create and switch to a new file
cairn use sprint-2
```

**Use Cases:**
- **Context Switching**: Separate work streams (features, bugs, experiments)
- **Team Organization**: Different files for different teams or projects
- **Temporary Work**: Isolate experimental or temporary tasks
- **Feature Branches**: Align issue files with git branches

**Notes:**
- The VS Code extension automatically respects the active file
- All cairn commands operate on the currently active file
- File selection persists across terminal sessions

### dep add

Add a dependency relationship between issues.

```bash
cairn dep add <from> <to> [options]
```

**Options:**
- `-t, --type <type>`: Dependency type (blocks, related, parent-child, discovered-from)

**Examples:**
```bash
cairn dep add task-2 task-1 --type blocks
cairn dep add subtask-1 epic-1 --type parent-child
```

### epic subtasks

List all subtasks of an epic.

```bash
cairn epic subtasks <epicId>
```

**Example:**
```bash
cairn epic subtasks epic-1
```

**Output:**
```
Subtasks for epic epic-1:
  task-2: Design user interface [open]
  task-3: Implement backend API [in_progress]
```

### epic progress

Show progress of an epic.

```bash
cairn epic progress <epicId>
```

**Example:**
```bash
cairn epic progress epic-1
```

**Output:**
```
Epic: User Management System
Progress: 2/5 subtasks completed (40%)
💡 All subtasks are completed. Consider closing this epic.
```

### epic add-subtask

Create a new subtask for an epic.

```bash
cairn epic add-subtask <epicId> <title> [options]
```

**Options:**
- `-d, --description <desc>`: Subtask description
- `-p, --priority <priority>`: Subtask priority

**Example:**
```bash
cairn epic add-subtask epic-1 "Implement user registration" -p high
```

### review

Perform a self-review checklist for a task.

```bash
cairn review <id>
```

**Output:**
```
Reviewing issue task-1: Implement user login
Checklist:
- Code quality: Check for best practices, readability, performance
- Edge cases: Ensure all scenarios handled
- Error handling: Proper error management
- Tests: Adequate test coverage
- Dependencies: No blockers remain
Update with: cairn update <id> -n "Review notes" -c "Criteria met"
```

### comment

Add a comment to an issue.

```bash
cairn comment <id> <message> [options]
```

**Options:**
- `-a, --author <author>`: Comment author (default: "user")

**Examples:**
```bash
cairn comment task-1 "This looks good, ready for testing"
cairn comment task-1 "Found an edge case" -a "reviewer"
```

## Directory Discovery

The CLI automatically finds the `.cairn` directory by:

1. Starting from current working directory
2. Walking up directory tree looking for `.cairn/issues.jsonl`
3. Falling back to `./.cairn` if not found

This allows running commands from any subdirectory of a Cairn-enabled project.

## Exit Codes

- `0`: Success
- `1`: Error (missing .cairn directory, invalid arguments, etc.)

## Environment Variables

- `CAIRN_DIR`: Override automatic .cairn directory discovery
- `CAIRN_REPO_ROOT`: Override repository root detection

## Examples

### Complete Workflow

```bash
# Initialize project
cairn init --stealth

# Create epic
cairn create "User Authentication System" -t epic -d "Complete auth implementation"

# Create subtasks
cairn epic add-subtask epic-1 "Design API endpoints" -p high
cairn epic add-subtask epic-1 "Implement login flow"
cairn epic add-subtask epic-1 "Add password reset"

# Set dependencies
cairn dep add task-2 task-1 --type blocks

# Start working
cairn list --ready
cairn update task-1 -s in_progress

# Complete work
cairn update task-1 -s closed
cairn comment task-1 "Implementation complete, all tests passing"

# Check progress
cairn epic progress epic-1
```

### Daily Workflow

```bash
# See what's ready to work on
cairn list --ready

# Start a task
cairn update task-5 -s in_progress

# Add notes during development
cairn comment task-5 "Found edge case with empty passwords"

# Complete task
cairn update task-5 -s closed -c "All acceptance criteria met"
```

### Multiple Task Files Workflow

```bash
# Work on main feature development
cairn use default
cairn create "Implement new feature" -t feature

# Switch to bug fixes context
cairn use bugfixes
cairn create "Fix login issue" -t bug -p high

# Check what files you have
cairn use

# Work on experimental features without cluttering main file
cairn use experiments
cairn create "Try new architecture" -t task

# Switch back to main work
cairn use default
```

## Multiple Task Files

Cairn supports managing multiple issue files, allowing you to separate different work contexts.

### Configuration

The active file is stored in `.cairn/config.json`:

```json
{
  "activeFile": "default"
}
```

### File Naming Convention

- `default` → `issues.jsonl` (backward compatible)
- Any other name → `{name}.jsonl`

**Valid file names:**
- Letters, numbers, hyphens, underscores only
- Examples: `feature-auth`, `bugfixes`, `sprint-2`, `team-mobile`

### VS Code Integration

The VS Code extension provides seamless file switching:

1. **Status Bar**: Shows current file, click to switch
2. **Command Palette**: `Cairn: Switch Task File`
3. **Task List**: Dropdown selector at the top of the task list
4. **Smart Notifications**: Alerts when CLI changes the active file

### Use Cases

**Context Separation:**
```bash
cairn use features      # Main feature work
cairn use bugs          # Bug tracking
cairn use tech-debt     # Technical debt items
```

**Team Organization:**
```bash
cairn use team-backend  # Backend team tasks
cairn use team-mobile   # Mobile team tasks
cairn use team-design   # Design team tasks
```

**Development Phases:**
```bash
cairn use planning      # Planning phase
cairn use development   # Active development
cairn use testing       # QA and testing
```

## Integration

The CLI is designed to work seamlessly with:

- **Git workflows**: Stealth mode prevents repository pollution
- **CI/CD**: Can be used in automated scripts
- **Editors**: Output format works well with IDE terminals
- **Copilot**: Auto-generates workflow instructions

## Error Messages

Common error messages and solutions:

- `"No .cairn directory found"`: Run `cairn init` in project root
- `"Task <id> not found"`: Check issue ID spelling
- `"Invalid status/type/priority"`: Use valid enum values
- `"Failed to acquire file lock"`: Wait for other Cairn processes to finish