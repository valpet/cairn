<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->
- This is the Horizon project: a modular TypeScript CLI tool for task management with long-horizon memory for GitHub Copilot agents.
- Use InversifyJS for dependency injection.
- Store tasks in .horizon/issues.jsonl, with git integration.
- Support stealth mode by gitignoring .horizon folder.
- Core library handles JSONL storage, dependency graphs, compaction.
- CLI provides commands: create, update, list, dep add.


## Horizon Task Management for GitHub Copilot Agents

Horizon is a powerful task management system designed to help AI agents like you maintain long-term memory and collaborate effectively on complex software development projects. By using Horizon, you can:

- **Track progress systematically** across multiple sessions
- **Maintain context** for complex, multi-step tasks
- **Collaborate seamlessly** with developers and other agents
- **Avoid losing track** of work in progress
- **Document decisions and challenges** for future reference

### Getting Started
Horizon has been initialized in this project. To see available tasks, use the `horizon_list_ready` tool or run `horizon list --ready` in the terminal.

### Recommended Workflow
While you're free to work as you see fit, using Horizon will significantly improve your effectiveness on this project. Here's how to integrate it into your work:

- **Check for ready work first**: Before starting new tasks, use `horizon_list_ready` to see what tasks are unblocked and ready to work on.
- **Create tasks for significant work**: For any substantial changes or features, create a Horizon task using \`horizon_create\` (or \`horizon create <title> -d <description> -t <type> -p <priority> -s <status> -r <parent>\` in terminal).
- **Break down complex tasks**: Use `horizon_dep_add` with 'parent-child' type to create subtasks for epics.
- **Track discoveries**: When you find new work during development, add it as a 'discovered-from' dependency.
- **Update progress regularly**: Use `horizon_update` to mark tasks as in progress, add notes, or close completed work.
- **Document your work**: Use `horizon_comment` to record findings, ideas, challenges, solutions, and progress as you work on tasks. This helps maintain a detailed record for collaboration and future reference.
- **Add comments for collaboration**: Use `horizon_comment` to document important insights or communicate with the developer.
- **Perform self-reviews**: Before closing tasks, review your work quality and ensure all acceptance criteria are met.

### Available Tools
- `horizon_list_ready`: Get list of unblocked tasks ready to work on
- `horizon_create`: Create a new task
- `horizon_update`: Update task status, notes, or acceptance criteria
- `horizon_dep_add`: Add dependencies between tasks
- `horizon_comment`: Add comments to tasks

### Terminal Commands (as backup)
If the tools aren't available, you can use these terminal commands:
- `horizon list --ready`: List ready tasks
- \`horizon create <title> -d <description> -p <priority> -t <type> -s <status> -r <parent>\`: Create task
- `horizon update <id> -s <status> -n <notes>`: Update task
- `horizon dep add <from> <to> --type <type>`: Add dependency
- `horizon comment <id> <message>`: Add comment

### Memory Management
Horizon automatically compacts old closed tasks to save context space, but preserves all history in git. This ensures you can always recover full context when needed.

By using Horizon consistently, you'll provide better, more organized assistance and maintain continuity across development sessions. The developer will appreciate your structured approach to complex work!