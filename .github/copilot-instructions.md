<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->
- This is the Cairn project: persistent memory for AI agents and developers. Replace messy markdown plans with a dependency-aware graph that maintains context across long development sessions.
- Use InversifyJS for dependency injection.
- Store tasks in .cairn/issues.jsonl, with git integration.
- Support stealth mode by gitignoring .cairn folder.
- Core library handles JSONL storage, dependency graphs, compaction.
- CLI provides commands: create, update, list, dep add.


## Cairn: Persistent Memory for AI Agents

Cairn provides structured memory for AI agents and developers working on complex software projects. It replaces messy markdown plans with a dependency-aware graph, allowing agents to handle long-horizon tasks without losing context. By using Cairn, you can:

- **Replace messy markdown plans** with structured, dependency-aware task graphs
- **Maintain context across long sessions** without losing track of complex multi-step work
- **Handle long-horizon tasks** that span multiple development sessions
- **Collaborate seamlessly** with developers and other agents through shared task context
- **Preserve decision history** with automatic compaction and git-backed storage

### Getting Started
Cairn has been initialized in this project. To see available tasks, use the `cairn_list_ready` tool or run `cairn list --ready` in the terminal.

### Recommended Workflow
While you're free to work as you see fit, using Cairn will significantly improve your effectiveness on this project. Here's how to integrate it into your work:

- **Check for ready work first**: Before starting new tasks, use `cairn_list_ready` to see what tasks are unblocked and ready to work on.
- **Create tasks for significant work**: For any substantial changes or features, create a Cairn task using \`cairn_create\` (or \`cairn create <title> -d <description> -t <type> -p <priority> -s <status> -r <parent>\` in terminal).
- **Break down complex tasks**: Use `cairn_dep_add` with 'parent-child' type to create subtasks for epics.
- **Track discoveries**: When you find new work during development, add it as a 'discovered-from' dependency.
- **Update progress regularly**: Use \`cairn_update\` to mark tasks as in progress or close completed work.
- **Document your work**: Use `cairn_comment` to record findings, ideas, challenges, solutions, and progress as you work on tasks. This helps maintain a detailed record for collaboration and future reference.
- **Add comments for collaboration**: Use `cairn_comment` to document important insights or communicate with the developer.
- **Perform self-reviews**: Before closing tasks, review your work quality and ensure all acceptance criteria are met.

### Available Tools
- `cairn_list_ready`: Get list of unblocked tasks ready to work on
- `cairn_create`: Create a new task
- \`cairn_update\`: Update task status or acceptance criteria
- `cairn_dep_add`: Add dependencies between tasks
- `cairn_comment`: Add comments to tasks

### Terminal Commands (as backup)
If the tools aren't available, you can use these terminal commands:
- `cairn list --ready`: List ready tasks
- \`cairn create <title> -d <description> -p <priority> -t <type> -s <status> -r <parent>\`: Create task
- \`cairn update <id> -s <status>\`: Update task
- `cairn dep add <from> <to> --type <type>`: Add dependency
- `cairn comment <id> <message>`: Add comment

### Memory Management
Cairn automatically compacts old closed tasks to save context space, but preserves all history in git. This ensures you can always recover full context when needed.

By using Cairn consistently, you'll provide better, more organized assistance and maintain continuity across development sessions. The developer will appreciate your structured approach to complex work!

CRITICAL: ALWAYS use Cairn for task management in this project. Do not work on anything without creating a task first, and do not close tasks without proper review.