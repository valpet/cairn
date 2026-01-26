# Cairn

**Persistent memory for AI agents and developers.** AI agents finally get access to professional task management - the kind developers have enjoyed with Jira and GitHub Tasks. Replace messy markdown plans with a structured task system that maintains context across long development sessions, allowing developers and agents to work on tasks together.

[![VS Code Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/valpet.cairn-extension?label=VS%20Code%20Marketplace&logo=visual-studio-code&style=flat-square)](https://marketplace.visualstudio.com/items?itemName=valpet.cairn-extension)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)


## ⚡ Quick Start

1. Install the extension from the VS Code Marketplace
2. Install the Cairn CLI: `npm install -g @valpet/cairn-cli` (or use `npx @valpet/cairn-cli init`)
3. Initialize Cairn in your project: `cairn init`
4. Open a workspace and run `Cairn: Open Task List` from the command palette
5. Create your first task with `Cairn: Create New Task`

## 🛠 Features

* **Git-Backed Storage:** Tasks stored as JSONL in `.cairn/`. Versioned, branched, and merged like code.
* **Agent-Optimized:** Native Copilot integration with language model tools for seamless AI collaboration.
* **Dependency Graph:** Track relationships between tasks (blocks, parent-child, discovered-from).
* **Long-Term Memory:** Automatic compaction summarizes old tasks to preserve context window.
* **Zero Conflict IDs:** Hash-based task IDs prevent merge collisions in multi-agent workflows.
* **Stealth Mode:** Optional gitignoring of `.cairn` folder for private task management.

## 📸 Screenshots

### Task List View
![Task List](https://raw.githubusercontent.com/valpet/cairn/main/packages/vscode-extension/assets/Screenshot_1.png)


### Task Editor
![Task List](https://raw.githubusercontent.com/valpet/cairn/main/packages/vscode-extension/assets/Screenshot_2.png)


## 📖 Essential Commands

| Command                    | Action                           |
| -------------------------- | -------------------------------- |
| `Cairn: Open Task List`    | View all tasks in your workspace |
| `Cairn: Create New Task` | Create a new task                |
| `Cairn: Edit Task`       | Modify existing tasks            |

**Keyboard Shortcuts:**
- `Ctrl+Shift+T` / `Cmd+Shift+T`: Open Task List
- `Ctrl+Shift+N` / `Cmd+Shift+N`: Create New Task

## 🔗 Task Hierarchy & Workflow

Cairn supports hierarchical task relationships:

* **Blocks:** Task A must be completed before Task B can start
* **Parent-Child:** Break down epics into manageable subtasks
* **Related:** Connect loosely related work items
* **Discovered-From:** Track new work found during development

**Stealth Mode:** Tasks stored locally without committing to git. Perfect for personal use on shared projects.

## 🤖 AI Agent Integration

Cairn provides native language model tools for GitHub Copilot:

- `cairn_create`: Create tasks with full configuration
- `cairn_list_ready`: Get unblocked tasks ready for work
- `cairn_update`: Update task status
- `cairn_dep_add`: Add dependencies between tasks

## ⭐ Reviews & Support

If Cairn helps streamline your development workflow, please consider:
- **Leaving a review** on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=valpet.cairn-extension) ⭐⭐⭐⭐⭐
- **Starring the repository** on [GitHub](https://github.com/valpet/cairn) 🌟

> *I make tools. I learn things. I make more tools. It's a cycle I cannot escape. If you like what I build, consider buying me a coffee ☕*

<div align="center">
  <a href="https://buymeacoffee.com/valpet">
    <img src="https://raw.githubusercontent.com/valpet/cairn/main/packages/vscode-extension/assets/bmc-button.png" alt="Buy me a coffee" width="150">
  </a>
</div>

## 📦 Installation

Install from the VS Code Marketplace or download the `.vsix` file and install manually.

**Requirements:** VS Code 1.90.0 or later

## 📝 Documentation

This extension is part of the Cairn monorepo. See the main repository for development setup and contribution guidelines.


## License

MIT