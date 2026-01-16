#!/usr/bin/env node

import 'reflect-metadata';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Container } from 'inversify';
import { createContainer, TYPES, IStorageService, IGraphService, ICompactionService, IGitService, Issue } from '@horizon/core';
import * as path from 'path';
import * as fs from 'fs';

export class HorizonMCPServer {
  private server: Server;
  private container: Container;
  private horizonDir: string;

  constructor() {
    this.horizonDir = path.join(process.cwd(), '.horizon');
    if (!fs.existsSync(this.horizonDir)) {
      fs.mkdirSync(this.horizonDir, { recursive: true });
    }

    this.container = createContainer(this.horizonDir, process.cwd());
    this.server = new Server({
      name: 'horizon-mcp',
      version: '1.0.0',
    });

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'horizon_create_issue',
            description: 'Create a new issue/task in Horizon',
            inputSchema: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Issue title' },
                description: { type: 'string', description: 'Issue description' },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Priority level' },
              },
              required: ['title'],
            },
          },
          {
            name: 'horizon_update_issue',
            description: 'Update an existing issue in Horizon',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Issue ID' },
                status: { type: 'string', enum: ['open', 'in_progress', 'closed', 'blocked'], description: 'New status' },
                title: { type: 'string', description: 'New title' },
                description: { type: 'string', description: 'New description' },
                notes: { type: 'string', description: 'Additional notes' },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'New priority' },
                assignee: { type: 'string', description: 'Assignee' },
                labels: { type: 'array', items: { type: 'string' }, description: 'Labels array' },
                acceptance_criteria: { type: 'array', items: { type: 'string' }, description: 'Acceptance criteria array' },
              },
              required: ['id'],
            },
          },
          {
            name: 'horizon_list_issues',
            description: 'List issues with optional filtering',
            inputSchema: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['open', 'in_progress', 'closed', 'blocked'], description: 'Filter by status' },
                ready: { type: 'boolean', description: 'Show only ready work' },
                limit: { type: 'number', description: 'Maximum number of issues to return' },
              },
            },
          },
          {
            name: 'horizon_add_dependency',
            description: 'Add a dependency between issues',
            inputSchema: {
              type: 'object',
              properties: {
                from_id: { type: 'string', description: 'ID of the issue that depends on another' },
                to_id: { type: 'string', description: 'ID of the issue being depended on' },
                type: { type: 'string', enum: ['blocks', 'related', 'parent-child', 'discovered-from'], description: 'Dependency type' },
              },
              required: ['from_id', 'to_id', 'type'],
            },
          },
          {
            name: 'horizon_get_ready_work',
            description: 'Get issues that are ready to work on (no blocking dependencies)',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Maximum number of issues to return' },
              },
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'horizon_create_issue':
            return await this.handleCreateIssue(args);
          case 'horizon_update_issue':
            return await this.handleUpdateIssue(args);
          case 'horizon_list_issues':
            return await this.handleListIssues(args);
          case 'horizon_add_dependency':
            return await this.handleAddDependency(args);
          case 'horizon_get_ready_work':
            return await this.handleGetReadyWork(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error: ${errorMessage}` }],
          isError: true,
        };
      }
    });
  }

  private async handleCreateIssue(args: any) {
    const storage = this.container.get<IStorageService>(TYPES.IStorageService);
    const git = this.container.get<IGitService>(TYPES.IGitService);

    const issues = await storage.loadIssues();
    const id = this.generateId(issues);

    const issue = {
      id,
      title: args.title,
      description: args.description,
      status: 'open' as const,
      priority: args.priority,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await storage.saveIssue(issue);
    await git.commitChanges(`Create issue ${id}`);

    return {
      content: [{ type: 'text', text: `Created issue ${id}: ${args.title}` }],
    };
  }

  private async handleUpdateIssue(args: any) {
    const storage = this.container.get<IStorageService>(TYPES.IStorageService);
    const git = this.container.get<IGitService>(TYPES.IGitService);

    let issues = await storage.loadIssues();
    issues = issues.map((issue: Issue) => {
      if (issue.id === args.id) {
        const updated = { ...issue, updated_at: new Date().toISOString() };
        if (args.status) updated.status = args.status;
        if (args.title) updated.title = args.title;
        if (args.description) updated.description = args.description;
        if (args.notes) updated.notes = args.notes;
        if (args.priority) updated.priority = args.priority;
        if (args.assignee) updated.assignee = args.assignee;
        if (args.labels) updated.labels = args.labels;
        if (args.acceptance_criteria) updated.acceptance_criteria = args.acceptance_criteria;
        if (args.status === 'closed') updated.closed_at = new Date().toISOString();
        return updated;
      }
      return issue;
    });

    await this.rewriteIssues(issues);
    await git.commitChanges(`Update issue ${args.id}`);

    return {
      content: [{ type: 'text', text: `Updated issue ${args.id}` }],
    };
  }

  private async handleListIssues(args: any) {
    const storage = this.container.get<IStorageService>(TYPES.IStorageService);
    const graph = this.container.get<IGraphService>(TYPES.IGraphService);
    const compaction = this.container.get<ICompactionService>(TYPES.ICompactionService);

    let issues = await storage.loadIssues();
    issues = compaction.compactIssues(issues);

    if (args.ready) {
      issues = graph.getReadyWork(issues);
    } else if (args.status) {
      issues = issues.filter((i: Issue) => i.status === args.status);
    }

    if (args.limit) {
      issues = issues.slice(0, args.limit);
    }

    const result = issues.map((issue: Issue) => `${issue.id}: ${issue.title} [${issue.status}]`).join('\n');

    return {
      content: [{ type: 'text', text: result || 'No issues found' }],
    };
  }

  private async handleAddDependency(args: any) {
    const storage = this.container.get<IStorageService>(TYPES.IStorageService);
    const graph = this.container.get<IGraphService>(TYPES.IGraphService);
    const git = this.container.get<IGitService>(TYPES.IGitService);

    let issues = await storage.loadIssues();
    issues = graph.addDependency(args.from_id, args.to_id, args.type, issues);
    await this.rewriteIssues(issues);
    await git.commitChanges(`Add dependency ${args.from_id} -> ${args.to_id}`);

    return {
      content: [{ type: 'text', text: `Added ${args.type} dependency from ${args.from_id} to ${args.to_id}` }],
    };
  }

  private async handleGetReadyWork(args: any) {
    const storage = this.container.get<IStorageService>(TYPES.IStorageService);
    const graph = this.container.get<IGraphService>(TYPES.IGraphService);
    const compaction = this.container.get<ICompactionService>(TYPES.ICompactionService);

    let issues = await storage.loadIssues();
    issues = compaction.compactIssues(issues);
    issues = graph.getReadyWork(issues);

    if (args.limit) {
      issues = issues.slice(0, args.limit);
    }

    const result = issues.map((issue: Issue) => `${issue.id}: ${issue.title}`).join('\n');

    return {
      content: [{ type: 'text', text: result || 'No ready work found' }],
    };
  }

  private generateId(issues: any[]): string {
    const existingIds = new Set(issues.map(i => i.id));
    let id;
    do {
      id = 'bd-' + Math.random().toString(36).substr(2, 6);
    } while (existingIds.has(id));
    return id;
  }

  private async rewriteIssues(issues: any[]) {
    const storage = this.container.get<IStorageService>(TYPES.IStorageService);
    const filePath = storage.getIssuesFilePath();
    const content = issues.map(i => JSON.stringify(i)).join('\n') + '\n';
    await fs.promises.writeFile(filePath, content);
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Horizon MCP server started');
  }
}

// Start the server
const server = new HorizonMCPServer();
server.start().catch(console.error);