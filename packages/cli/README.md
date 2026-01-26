# cairn

Command-line interface for Cairn task management system.

## Installation

```bash
npm install -g @valpet/cairn-cli
```

## Usage

```bash
# Initialize a project
cairn init --stealth

# Create tasks
cairn create "Implement user authentication" -t feature -p high
cairn create "Design database schema" -t task

# Set dependencies
cairn dep add task-2 task-1 --type blocks

# View ready work
cairn list --ready

# Update task status
cairn update task-1 -s in_progress
cairn update task-1 -s closed -c "Implementation complete"

# Switch between issue files
cairn use                  # Show current file and list available files
cairn use test             # Switch to test.jsonl (creates if doesn't exist)
cairn use default          # Switch back to issues.jsonl
```

## Commands

- `cairn init` - Initialize Cairn in current directory
- `cairn create <title>` - Create a new task
- `cairn list` - List all tasks
- `cairn list --ready` - Show unblocked tasks
- `cairn update <id> [options]` - Update task status
- `cairn dep add <from> <to> --type <type>` - Add dependencies
- `cairn use` - Show current issue file and list all available files
- `cairn use <name>` - Switch to a specific issue file (creates if doesn't exist)
- `cairn comment <id> <message>` - Add comments

## Options

- `-t, --type <type>`: Task type (task, feature, bug, epic, chore, docs, refactor)
- `-p, --priority <priority>`: Priority (low, medium, high, urgent)
- `-s, --status <status>`: Status (open, in_progress, closed, blocked)
- `-d, --description <description>`: Task description
- `--stealth`: Use stealth mode (.cairn directory ignored by git)

## Integration

Cairn works seamlessly with:
- Git workflows (stealth mode)
- CI/CD pipelines
- VS Code extension
- GitHub Copilot

## Documentation

See the [full documentation](https://your-org.github.io/cairn/) for detailed usage guides.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Disclaimer

This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.