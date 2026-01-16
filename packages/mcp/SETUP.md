# Horizon MCP Server Setup

## Global Installation

The Horizon MCP server can be installed globally to work with any project:

```bash
# From the horizon project root
cd packages/mcp
npm link
```

This makes the `horizon-mcp` command available globally.

## Usage

### For Any Project

1. Navigate to any project directory
2. Run: `horizon-mcp`

The server will:
- Create a `.horizon` directory in the current project
- Store issues in `.horizon/issues.jsonl`
- Integrate with the project's git repository

### MCP Client Configuration

To use Horizon with AI agents, configure your MCP client:

#### GitHub Copilot (VS Code)

Create or update your MCP configuration file (typically `~/.config/github-copilot/mcp.json` or similar):

```json
{
  "mcpServers": {
    "horizon": {
      "command": "horizon-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

#### Other MCP Clients

Configure the server with:
- Command: `horizon-mcp`
- Arguments: `[]`
- Working directory: Current project directory

## Available Tools

Once configured, AI agents can use these Horizon tools:

- `horizon_create_issue`: Create new tasks
- `horizon_update_issue`: Update existing issues
- `horizon_list_issues`: List issues with filtering
- `horizon_get_ready_work`: Get next actionable work
- `horizon_add_dependency`: Add task dependencies
- `horizon_compact_memory`: Compact completed work

## Project Isolation

Each project gets its own `.horizon` directory, so issues are isolated per project. The `.horizon` folder is automatically added to `.gitignore` for stealth mode.