# Cairn Documentation

## Overview

Cairn is a comprehensive task management system designed for AI agents and developers working on complex software projects. It replaces messy markdown plans with a dependency-aware graph that maintains context across long development sessions.

## Architecture

Cairn consists of three main components:

### Core Library (`@valpet/cairn-core`)
The foundational library providing data structures, storage, and business logic.

- **Storage**: JSONL-based persistence with file locking
- **Graph**: Dependency relationship management
- **Compaction**: Automatic data optimization
- **Types**: Complete TypeScript interfaces

[📖 Core API Documentation](./api/)

### CLI Tool (`cairn`)
Command-line interface for comprehensive task management.

- **Commands**: Create, update, list, dependencies, epics
- **Auto-discovery**: Finds `.cairn` directories automatically
- **Git Integration**: Stealth mode and workflow instructions

[📖 CLI Documentation](./cli/)

### VS Code Extension
Deep IDE integration with webviews and Copilot tools.

- **Webviews**: Rich task list and editing interfaces
- **Language Model Tools**: Copilot integration for AI assistance
- **Real-time Updates**: File watching and live synchronization

[📖 Extension Documentation](./extension/)

## Quick Start

### 1. Initialize a Project

```bash
# Install CLI globally
npm install -g cairn

# Initialize in your project
cd my-project
cairn init --stealth
```

### 2. Create Your First Tasks

```bash
# Create an epic
cairn create "User Authentication System" -t epic

# Add subtasks
cairn epic add-subtask epic-1 "Design API endpoints"
cairn epic add-subtask epic-1 "Implement login flow"

# Set dependencies
cairn dep add task-2 task-1 --type blocks
```

### 3. Start Working

```bash
# See what's ready to work on
cairn list --ready

# Start a task
cairn update task-1 -s in_progress

# Complete it
cairn update task-1 -s closed
```

### 4. Install VS Code Extension

```bash
code --install-extension cairn-extension
```

Use `Ctrl+Shift+T` to open the task list or Copilot tools for AI-assisted task management.

## Key Concepts

### Issues and Tasks

Everything in Cairn revolves around **Issues** - structured tasks with metadata:

- **Types**: epic, feature, task, bug, chore, docs, refactor
- **Statuses**: open, in_progress, closed, blocked
- **Priorities**: low, medium, high, urgent
- **Dependencies**: blocks, related, parent-child, discovered-from

### Epics and Subtasks

**Epics** are large bodies of work broken down into **subtasks**:

```bash
# Epic contains multiple subtasks
Epic: User Management System
├── Design user schema
├── Implement registration
├── Add password reset
└── Create admin panel
```

### Dependencies

Tasks can have relationships:

- **Blocks**: Task A must be completed before Task B can start
- **Parent-Child**: Epic-subtask relationships
- **Related**: General associations
- **Discovered-From**: Tasks found during development

### Ready Work

Cairn automatically identifies **ready work** - tasks that are:
- Open (not completed)
- Not blocked by dependencies
- Available to start immediately

## Workflows

### AI-Assisted Development

1. **Planning**: Create epics and break them into subtasks
2. **Prioritization**: Use dependencies to establish work order
3. **Daily Work**: Check `cairn list --ready` for available tasks
4. **Progress Tracking**: Update status as work completes
5. **Collaboration**: Use comments for coordination

### Developer Workflow

```bash
# Morning: Check what's ready
cairn list --ready

# Start working on a task
cairn update task-5 -s in_progress

# Document findings
cairn comment task-5 "Found edge case with empty input"

# Complete work
cairn update task-5 -s closed
```

### Epic Management

```bash
# Create epic
cairn create "New Feature Implementation" -t epic

# Add subtasks
cairn epic add-subtask epic-1 "API design"
cairn epic add-subtask epic-1 "Frontend implementation"
cairn epic add-subtask epic-1 "Testing"

# Track progress
cairn epic progress epic-1
```

## Integration

### Git Integration

- **Stealth Mode**: `.cairn` directory ignored by git
- **History Preservation**: All changes tracked in git
- **Workflow Instructions**: Auto-generates Copilot guidelines

### VS Code Integration

- **Webviews**: Rich editing interfaces
- **Copilot Tools**: AI assistance for task management
- **File Watching**: Real-time UI updates
- **Keyboard Shortcuts**: Quick access commands

### CI/CD Integration

The CLI can be used in automated workflows:

```yaml
# .github/workflows/cairn-check.yml
name: Cairn Validation
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install -g cairn
      - run: cairn list --ready > ready-tasks.txt
```

## Data Storage

### JSONL Format

Tasks are stored in `.cairn/issues.jsonl`:

```jsonl
{"id":"task-1","title":"Implement login","status":"open","type":"feature"}
{"id":"task-2","title":"Design database","status":"closed","type":"task"}
```

### File Locking

- Prevents corruption during concurrent access
- Automatic cleanup of stale locks
- Write operation queuing

### Compaction

Old closed issues are automatically compacted:
- Descriptions truncated after 30 days
- Design docs and acceptance criteria removed
- Core metadata preserved

## Best Practices

### Task Creation

- **Be Specific**: Clear, actionable titles
- **Add Context**: Use descriptions for important details
- **Set Dependencies**: Establish work ordering
- **Use Types**: Choose appropriate issue types

### Epic Management

- **Break Down Work**: Divide epics into manageable subtasks
- **Track Progress**: Use `cairn epic progress` regularly
- **Close When Done**: Auto-detect completion

### Collaboration

- **Use Comments**: Document decisions and findings
- **Update Status**: Keep progress current
- **Review Work**: Use `cairn review` for self-checks

### Performance

- **Compact Regularly**: Let compaction manage old data
- **Batch Updates**: Use single commands for multiple changes
- **Clean Dependencies**: Remove unnecessary relationships

## Troubleshooting

### Common Issues

**"No .cairn directory found"**
```bash
cairn init
```

**Tasks not showing in VS Code**
- Ensure extension is installed and activated
- Check `.cairn` directory exists and is readable

**Copilot tools not available**
- Install GitHub Copilot Chat extension
- Ensure VS Code is updated

**File locking errors**
- Wait for other Cairn processes to complete
- Check file permissions

### Debug Information

Enable verbose logging:

```bash
# CLI debug
DEBUG=cairn cairn list

# VS Code: Check developer console
# Help → Toggle Developer Tools
```

## Contributing

Cairn is open source and welcomes contributions:

1. **Core Library**: Extend data models or add services
2. **CLI**: Add commands or improve UX
3. **Extension**: Enhance webviews or add tools

See individual package READMEs for development setup.

## License

MIT License - see [LICENSE](../LICENSE) file for details.

## Disclaimer

This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.

The software is intended for development and productivity purposes. Users are responsible for their own use of this software and should exercise appropriate caution and judgment.

## Contributing

Cairn is open source and welcomes contributions:

1. **Core Library**: Extend data models or add services
2. **CLI**: Add commands or improve UX
3. **Extension**: Enhance webviews or add tools

See individual package READMEs for development setup.