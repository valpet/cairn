# Horizon MCP Server

The Horizon MCP (Model Context Protocol) server enables autonomous task management for AI agents without requiring manual CLI approval.

## Available Tools

### horizon_create_issue
Creates a new issue/task in Horizon.

**Parameters:**
- `title` (string, required): Issue title
- `description` (string, optional): Issue description
- `priority` (string, optional): Priority level ('low', 'medium', 'high', 'urgent')

### horizon_update_issue
Updates an existing issue in Horizon.

**Parameters:**
- `id` (string, required): Issue ID to update
- `title` (string, optional): New title
- `description` (string, optional): New description
- `status` (string, optional): New status ('todo', 'in-progress', 'done', 'blocked')
- `priority` (string, optional): New priority ('low', 'medium', 'high', 'urgent')

### horizon_list_issues
Lists issues in Horizon, optionally filtered by status.

**Parameters:**
- `status` (string, optional): Filter by status ('todo', 'in-progress', 'done', 'blocked')

### horizon_get_ready_work
Gets the next ready work item based on dependency graph.

**Parameters:** None

### horizon_add_dependency
Adds a dependency between two issues.

**Parameters:**
- `fromId` (string, required): ID of the issue that depends on another
- `toId` (string, required): ID of the issue being depended on

### horizon_compact_memory
Compacts issue memory by summarizing completed issues.

**Parameters:** None

## Usage

The MCP server runs as a stdio-based service that AI agents can connect to. It automatically manages the `.horizon` directory in the current working directory for storing issues.

## Integration

To integrate with AI agents, configure them to use the MCP server at the path to the built `dist/index.js` file.