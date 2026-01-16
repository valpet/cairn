<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->
- This is the Horizon project: a modular TypeScript CLI tool for task management with long-horizon memory for GitHub Copilot agents.
- Use InversifyJS for dependency injection.
- Store tasks in .horizon/issues.jsonl, with git integration.
- Support stealth mode by gitignoring .horizon folder.
- Core library handles JSONL storage, dependency graphs, compaction.
- CLI provides commands: create, update, list, dep add.

## MCP Server Setup (Preferred)
- Horizon provides an MCP server as the primary method for programmatic task management.
- Configure your MCP client to use `@horizon/mcp` for direct tool integration.
- Available tools: `horizon_create_issue`, `horizon_update_issue`, `horizon_list_issues`, `horizon_add_dependency`, `horizon_get_ready_work`.
- This is the preferred approach for autonomous task management; CLI commands are available as backup.

## Agent Workflow Instructions
As a GitHub Copilot agent, you MUST work task-based using Horizon tools for all development work. This ensures long-horizon memory and prevents context overflow.

### Initialization
- If .horizon folder doesn't exist, run `horizon create "Initialize project setup"` to start.
- For stealth mode on shared projects, add .horizon to .gitignore.

### Task Management
- **Always start by checking ready work**: Use `horizon_get_ready_work` MCP tool (or `horizon list --ready` as backup) to see unblocked tasks.
- **Break down large tasks**: Use `horizon_add_dependency` MCP tool with 'parent-child' type (or `horizon dep add <subtask> <parent> --type parent-child` as backup) to create hierarchical subtasks.
- **Create new tasks**: Use `horizon_create_issue` MCP tool (or `horizon create <title> -d <description> -p <priority>` as backup) for any work discovered.
- **Track discoveries**: When finding new work, use `horizon_add_dependency` MCP tool with 'discovered-from' type (or `horizon dep add <newtask> <current> --type discovered-from` as backup).
- **Update progress**: Regularly update task status with `horizon_update_issue` MCP tool (or `horizon update <id> -s <status> -n <notes>` as backup).
- **Document implementation details**: Add detailed notes on decisions, challenges, and solutions.
- **Mark completion**: Set status to 'closed' when done, include acceptance criteria with `horizon_update_issue` MCP tool (or `horizon update <id> -c <criteria>` as backup).

### Self-Review Process
- After implementing any feature, perform a brutal self-review:
  - Run `horizon review <id>` for checklist prompts.
  - Check code quality, edge cases, error handling.
  - Update acceptance criteria if not met.
  - Add notes on what was learned or improved.
  - If issues found, create subtasks for fixes.
- Review task dependencies: Ensure no blockers remain.

### Subtasks Support
- Horizon supports subtasks via 'parent-child' dependency type.
- Create parent epics, then subtasks linked with `horizon_add_dependency` MCP tool (or `dep add <sub> <parent> --type parent-child` as backup).
- Use `horizon_get_ready_work` MCP tool (or `list --ready` as backup) to find next actionable subtasks.

### Memory Management
- Compaction automatically summarizes old closed tasks to save context.
- Git integration preserves history across sessions.
- Always document progress to recover context later.

By following this workflow, you maintain coherent, persistent task memory without losing track of complex, multi-session work.

## Horizon Task Management Instructions
As a GitHub Copilot agent, you MUST work task-based using Horizon tools for all development work. This ensures long-horizon memory and prevents context overflow.

### Initialization
- Horizon has been initialized in this project. Use `horizon_get_ready_work` MCP tool (or `horizon list --ready` as backup) to see available tasks.


