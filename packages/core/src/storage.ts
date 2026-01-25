import { injectable, inject, optional } from 'inversify';
import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { Issue, Comment } from './types';
import { validateIssue, calculateCompletionPercentage } from './utils';
import { ILogger, ConsoleLogger, LogLevel } from './logger';

export interface IStorageService {
  loadIssues(): Promise<Issue[]>;
  saveIssue(issue: Issue): Promise<void>;
  updateIssues(updater: (issues: Issue[]) => Issue[]): Promise<void>;
  addComment(issueId: string, author: string, content: string): Promise<Comment>;
  getIssuesFilePath(): string;
}

export interface StorageConfig {
  cairnDir: string;
  issuesFileName?: string;
  lockMaxRetries?: number;
  lockRetryDelay?: number;
  lockTimeout?: number;
}

@injectable()
export class StorageService implements IStorageService {
  private issuesFilePath: string;
  private lockFilePath: string;
  private writeQueue: Promise<void> = Promise.resolve(); // Serialize all write operations within this process
  private lockMaxRetries: number;
  private lockRetryDelay: number;
  private lockTimeout: number;
  private logger: ILogger;

  constructor(
    @inject('config') private config: StorageConfig,
    @inject('ILogger') @optional() logger?: ILogger
  ) {
    const issuesFileName = config.issuesFileName || 'issues.jsonl';
    const issuesFilePath = path.join(config.cairnDir, issuesFileName);
    const issuesFileParsed = path.parse(issuesFilePath);
    if (issuesFileParsed.ext !== '.jsonl') {
      throw new Error(`Invalid issues file name "${issuesFileName}". Expected extension ".jsonl".`);
    }
    this.issuesFilePath = issuesFilePath;
    const lockFilePath = path.format({
      ...issuesFileParsed,
      base: undefined,
      ext: '.lock',
    });
    this.lockFilePath = lockFilePath;
    this.lockMaxRetries = config.lockMaxRetries ?? 50;
    this.lockRetryDelay = config.lockRetryDelay ?? 100;
    this.lockTimeout = config.lockTimeout ?? 30000;

    // Fallback to console logger if not injected
    this.logger = logger || new ConsoleLogger(LogLevel.INFO);
  }

  async loadIssues(): Promise<Issue[]> {
    const issues = await this.loadIssuesInternal();

    // Calculate completion percentages for all issues with a shared visited set to handle circular dependencies
    const visited = new Set<string>();
    for (const issue of issues) {
      issue.completion_percentage = calculateCompletionPercentage(issue, issues, visited);
      visited.clear(); // Clear after each top-level calculation
    }

    return issues;
  }

  private async loadIssuesInternal(): Promise<Issue[]> {
    if (!fs.existsSync(this.issuesFilePath)) {
      return [];
    }
    const content = await fs.promises.readFile(this.issuesFilePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    const issues: Issue[] = [];
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        const issue = JSON.parse(lines[i]);
        const validation = validateIssue(issue);

        if (validation.isValid) {
          issues.push(issue);
        } else {
          errors.push(`Line ${i + 1}: ${validation.errors.join(', ')}`);
        }
      } catch (parseError) {
        errors.push(`Line ${i + 1}: Invalid JSON - ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
    }

    // Log validation errors but don't fail the load - allow partial recovery
    if (errors.length > 0) {
      this.logger.error(`Found ${errors.length} validation errors in ${this.issuesFilePath}:`);
      errors.forEach(error => this.logger.error(`  ${error}`));
      this.logger.error('Invalid issues were skipped. Consider repairing the data file.');
    }

    // Run migration to fix any old formats (status and dependencies)
    const migratedIssues = this.migrateIssues(issues);

    return migratedIssues;
  }

  async saveIssue(issue: Issue): Promise<void> {
    // Validate the issue before saving
    const validation = validateIssue(issue);
    if (!validation.isValid) {
      throw new Error(`Invalid issue data: ${validation.errors.join(', ')}`);
    }

    // Queue this write operation
    this.writeQueue = this.writeQueue.then(async () => {
      await this.withLock(async () => {
        // Check if issue already exists
        const existingIssues = await this.loadIssuesInternal();
        const existingIssue = existingIssues.find(i => i.id === issue.id);
        if (existingIssue) {
          return;
        }

        const line = JSON.stringify(issue) + '\n';
        await fs.promises.appendFile(this.issuesFilePath, line);
      });
    }).catch(err => {
      this.logger.error('saveIssue queued operation failed:', err);
      throw err;
    });
    return this.writeQueue;
  }

  async updateIssues(updater: (issues: Issue[]) => Issue[]): Promise<void> {
    this.logger.debug('=== Storage updateIssues CALLED ===');
    // Queue this write operation
    this.writeQueue = this.writeQueue.then(async () => {
      await this.withLock(async () => {
        this.logger.debug('Storage updateIssues: Inside lock');
        const issues = await this.loadIssuesInternal();
        this.logger.debug('Storage updateIssues loaded issues count:', issues.length);
        const updatedIssues = updater(issues);

        // Validate all updated issues
        const validationErrors: string[] = [];
        updatedIssues.forEach((issue, index) => {
          const validation = validateIssue(issue);
          if (!validation.isValid) {
            validationErrors.push(`Issue ${index} (${issue.id}): ${validation.errors.join(', ')}`);
          }
        });

        if (validationErrors.length > 0) {
          throw new Error(`Invalid issue data in update: ${validationErrors.join('; ')}`);
        }

        // Recalculate completion percentages for all issues BEFORE writing
        for (const issue of updatedIssues) {
          issue.completion_percentage = calculateCompletionPercentage(issue, updatedIssues);
        }

        this.logger.debug('Storage updateIssues updated issues count:', updatedIssues.length);
        const content = updatedIssues.map(i => JSON.stringify(i)).join('\n') + '\n';
        this.logger.debug('Storage writing to', this.issuesFilePath);
        await fs.promises.writeFile(this.issuesFilePath, content);
        this.logger.debug('Storage writeFile done');
      });
    }).catch(err => {
      this.logger.error('updateIssues queued operation failed:', err);
      throw err;
    });
    await this.writeQueue;
    this.logger.debug('=== Storage updateIssues COMPLETE ===');
  }

  getIssuesFilePath(): string {
    return this.issuesFilePath;
  }

  async addComment(issueId: string, author: string, content: string): Promise<Comment> {
    const comment: Comment = {
      id: nanoid(10),
      author,
      content,
      created_at: new Date().toISOString()
    };

    await this.updateIssues(issues => {
      return issues.map(issue => {
        if (issue.id === issueId) {
          const comments = issue.comments || [];
          return {
            ...issue,
            comments: [...comments, comment],
            updated_at: new Date().toISOString()
          };
        }
        return issue;
      });
    });

    return comment;
  }

  private migrateIssues(issues: Issue[]): Issue[] {
    let hasMigrations = false;
    const migratedIssues = issues.map(issue => {
      let issueUpdated = false;

      // Migration: Convert 'blocked' status to 'open' (removing blocked as a stored status)
      if ((issue as any).status === 'blocked') {
        issue.status = 'open';
        issue.updated_at = new Date().toISOString();
        hasMigrations = true;
        issueUpdated = true;
        this.logger.info(`Migrated status for issue ${issue.id}: 'blocked' -> 'open'`);
      }

      if (!issue.dependencies || issue.dependencies.length === 0) {
        return issueUpdated ? { ...issue } : issue;
      }

      // Check for any old dependency formats that need migration
      const migratedDeps = issue.dependencies
        .filter(dep => ['blocked_by', 'blocks', 'related', 'parent-child', 'discovered-from'].includes(dep.type))
        .map(dep => {
          // Convert legacy 'blocks' to stored 'blocked_by'
          if (dep.type === 'blocks') {
            hasMigrations = true;
            issueUpdated = true;
            this.logger.info(`Converted legacy dependency for issue ${issue.id}: blocks(${dep.id}) -> blocked_by(${dep.id})`);
            return { id: dep.id, type: 'blocked_by' as const };
          }
          return dep;
        });

      // Check if any dependencies were filtered out
      if (migratedDeps.length !== issue.dependencies.length) {
        hasMigrations = true;
        issueUpdated = true;
        this.logger.info(`Migrated dependencies for issue ${issue.id}: removed ${issue.dependencies.length - migratedDeps.length} invalid dependencies`);
      }

      // Check for potential bidirectional dependencies that might create duplicates
      // If issue A is blocked_by B, and B is blocked_by A (mutual block),
      // remove the redundant one and keep deterministically on the lexicographically larger issue ID
      const cleanedDeps = migratedDeps.filter((dep, index) => {
        if (dep.type === 'blocked_by') {
          // Check if the target issue also has a 'blocked_by' dependency back to this issue
          const targetIssue = issues.find(i => i.id === dep.id);
          if (targetIssue && targetIssue.dependencies) {
            const hasReverseDep = targetIssue.dependencies.some(reverseDep =>
              reverseDep.id === issue.id && (reverseDep.type === 'blocked_by' || reverseDep.type === 'blocks')
            );
            if (hasReverseDep) {
              // Mutual block: keep only on the lexicographically smaller issue ID
              if (issue.id > targetIssue.id) {
                hasMigrations = true;
                issueUpdated = true;
                this.logger.info(`Removed mutual blocked_by duplicate: ${issue.id} <- ${dep.id} (keeping on ${targetIssue.id})`);
                return false; // Remove this dependency
              }
            }
          }
        }
        return true;
      });

      if (cleanedDeps.length !== migratedDeps.length) {
        hasMigrations = true;
        issueUpdated = true;
      }

      if (issueUpdated) {
        return {
          ...issue,
          dependencies: cleanedDeps.length !== issue.dependencies.length ? cleanedDeps : issue.dependencies,
          updated_at: new Date().toISOString()
        };
      }

      return issue;
    });

    if (hasMigrations) {
      this.logger.info('Issue migration completed. Some issues were updated to fix old formats.');
      // Note: We don't auto-save here as this is called during load. The migration will be persisted
      // when issues are next saved through updateIssues.
    }

    return migratedIssues;
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < this.lockMaxRetries; attempt++) {
      try {
        // Clean up stale locks
        if (fs.existsSync(this.lockFilePath)) {
          const lockContent = await fs.promises.readFile(this.lockFilePath, 'utf-8');
          const lockData = JSON.parse(lockContent);
          const lockAge = Date.now() - lockData.timestamp;
          if (lockAge > this.lockTimeout) {
            await fs.promises.unlink(this.lockFilePath);
          }
        }

        // Try to acquire lock
        const lockData = { pid: process.pid, timestamp: Date.now() };
        await fs.promises.writeFile(this.lockFilePath, JSON.stringify(lockData), { flag: 'wx' });

        try {
          return await operation();
        } finally {
          await fs.promises.unlink(this.lockFilePath).catch(() => { });
        }
      } catch (error: any) {
        if (error.code === 'EEXIST') {
          // Lock exists, wait and retry
          if (attempt < this.lockMaxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, this.lockRetryDelay));
            continue;
          }
          throw new Error('Failed to acquire file lock after maximum retries');
        }
        throw error;
      }
    }

    throw new Error('Unexpected error in file locking');
  }
}