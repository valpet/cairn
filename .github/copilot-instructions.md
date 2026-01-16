<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->
- This is the Horizon project: a modular TypeScript CLI tool for task management with long-horizon memory for GitHub Copilot agents.
- Use InversifyJS for dependency injection.
- Store tasks in .horizon/issues.jsonl, with git integration.
- Support stealth mode by gitignoring .horizon folder.
- Core library handles JSONL storage, dependency graphs, compaction.
- CLI provides commands: create, update, list, dep add.
