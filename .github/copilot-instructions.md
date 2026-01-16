<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->
- This is the Horizon project: a modular TypeScript CLI tool for task management with long-horizon memory for GitHub Copilot agents.
- Use InversifyJS for dependency injection.
- Store tasks in .horizon/issues.jsonl, with git integration.
- Support stealth mode by gitignoring .horizon folder.
- Core library handles JSONL storage, dependency graphs, compaction.
- CLI provides commands: create, update, list, dep add.


## Horizon Task Management Instructions
As a GitHub Copilot agent, you MUST work task-based using Horizon CLI commands for all development work. This ensures long-horizon memory and prevents context overflow.

### Initialization
- Horizon has been initialized in this project. Use `horizon list --ready` to see available tasks.

### Task Management
- **Always start by checking ready work**: Use `horizon list --ready` to see unblocked tasks.
- **Break down large tasks**: Use `horizon dep add <subtask> <parent> --type parent-child` to create hierarchical subtasks.
- **Create new tasks**: Use `horizon create <title> -d <description> -p <priority>` for any work discovered.
- **Track discoveries**: When finding new work, use `horizon dep add <newtask> <current> --type discovered-from`.
- **Update progress**: Regularly update task status with `horizon update <id> -s <status> -n <notes>`.
- **Document implementation details**: Add detailed notes on decisions, challenges, and solutions.
- **Mark completion**: Set status to 'closed' when done, include acceptance criteria with `horizon update <id> -c <criteria>`.

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
- Create parent epics, then subtasks linked with `horizon dep add <sub> <parent> --type parent-child`.
- Use `horizon list --ready` to find next actionable subtasks.

### Memory Management
- Compaction automatically summarizes old closed tasks to save context.
- Git integration preserves history across sessions.
- Always document progress to recover context later.

By following this workflow, you maintain coherent, persistent task memory without losing track of complex, multi-session work.