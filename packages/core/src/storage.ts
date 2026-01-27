import { injectable, inject, optional } from 'inversify';
import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { Task, Comment } from './types';
import { validateTask, calculateCompletionPercentage } from './utils';
import { ILogger, ConsoleLogger, LogLevel } from './logger';

export interface IStorageService {
  loadTasks(): Promise<Task[]>;
  saveTask(task: Task): Promise<void>;
  updateTasks(updater: (tasks: Task[]) => Task[]): Promise<void>;
  addComment(taskId: string, author: string, content: string): Promise<Comment>;
  getTasksFilePath(): string;
}

export interface StorageConfig {
  cairnDir: string;
  tasksFileName?: string;
  lockMaxRetries?: number;
  lockRetryDelay?: number;
  lockTimeout?: number;
}

@injectable()
export class StorageService implements IStorageService {
  private tasksFilePath: string;
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
    const tasksFileName = config.tasksFileName || 'tasks.jsonl';
    const tasksFilePath = path.join(config.cairnDir, tasksFileName);
    const tasksFileParsed = path.parse(tasksFilePath);
    if (tasksFileParsed.ext !== '.jsonl') {
      throw new Error(`Invalid tasks file name "${tasksFileName}". Expected extension ".jsonl".`);
    }
    this.tasksFilePath = tasksFilePath;
    const lockFilePath = path.format({
      ...tasksFileParsed,
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

  async loadTasks(): Promise<Task[]> {
    const tasks = await this.loadTasksInternal();

    // Calculate completion percentages for all tasks with a shared visited set to handle circular dependencies across the batch
    const visited = new Set<string>();
    for (const task of tasks) {
      task.completion_percentage = calculateCompletionPercentage(task, tasks, visited);
    }

    return tasks;
  }

  private async loadTasksInternal(): Promise<Task[]> {
    // Check if tasks.jsonl exists, if not, try to migrate from issues.jsonl
    if (!fs.existsSync(this.tasksFilePath)) {
      const legacyIssuesFilePath = path.join(path.dirname(this.tasksFilePath), 'issues.jsonl');
      if (fs.existsSync(legacyIssuesFilePath)) {
        this.logger.info('Found legacy issues.jsonl file, migrating to tasks.jsonl...');
        try {
          await fs.promises.copyFile(legacyIssuesFilePath, this.tasksFilePath);
          this.logger.info('Successfully migrated issues.jsonl to tasks.jsonl');
        } catch (error) {
          this.logger.error('Failed to migrate issues.jsonl to tasks.jsonl:', error);
          throw error;
        }
      } else {
        return [];
      }
    }
    const content = await fs.promises.readFile(this.tasksFilePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    const tasks: Task[] = [];
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        const task = JSON.parse(lines[i]);
        const validation = validateTask(task);

        if (validation.isValid) {
          tasks.push(task);
        } else {
          errors.push(`Line ${i + 1}: ${validation.errors.join(', ')}`);
        }
      } catch (parseError) {
        errors.push(`Line ${i + 1}: Invalid JSON - ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
    }

    // Log validation errors but don't fail the load - allow partial recovery
    if (errors.length > 0) {
      this.logger.error(`Found ${errors.length} validation errors in ${this.tasksFilePath}:`);
      errors.forEach(error => this.logger.error(`  ${error}`));
      this.logger.error('Invalid tasks were skipped. Consider repairing the data file.');
    }

    // Run migration to fix any old formats (status and dependencies)
    const { migratedTasks, hasMigrations } = this.migrateTasks(tasks);

    // Persist migrations immediately if any occurred
    if (hasMigrations) {
      const content = migratedTasks.map(i => JSON.stringify(i)).join('\n') + '\n';
      await fs.promises.writeFile(this.tasksFilePath, content);
      this.logger.info('Migrated tasks persisted to disk');
    }

    return migratedTasks;
  }

  async saveTask(task: Task): Promise<void> {
    // Validate the task before saving
    const validation = validateTask(task);
    if (!validation.isValid) {
      throw new Error(`Invalid task data: ${validation.errors.join(', ')}`);
    }

    // Queue this write operation
    this.writeQueue = this.writeQueue.then(async () => {
      await this.withLock(async () => {
        // Check if task already exists
        const existingTasks = await this.loadTasksInternal();
        const existingTask = existingTasks.find(i => i.id === task.id);
        if (existingTask) {
          return;
        }

        const line = JSON.stringify(task) + '\n';
        await fs.promises.appendFile(this.tasksFilePath, line);
      });
    }).catch(err => {
      this.logger.error('saveTask queued operation failed:', err);
      throw err;
    });
    return this.writeQueue;
  }

  async updateTasks(updater: (tasks: Task[]) => Task[]): Promise<void> {
    this.logger.debug('=== Storage updateTasks CALLED ===');
    // Queue this write operation
    this.writeQueue = this.writeQueue.then(async () => {
      await this.withLock(async () => {
        this.logger.debug('Storage updateTasks: Inside lock');
        const tasks = await this.loadTasksInternal();
        this.logger.debug('Storage updateTasks loaded tasks count:', tasks.length);
        const updatedTasks = updater(tasks);

        // Validate all updated tasks
        const validationErrors: string[] = [];
        updatedTasks.forEach((task, index) => {
          const validation = validateTask(task);
          if (!validation.isValid) {
            validationErrors.push(`Task ${index} (${task.id}): ${validation.errors.join(', ')}`);
          }
        });

        if (validationErrors.length > 0) {
          throw new Error(`Invalid task data in update: ${validationErrors.join('; ')}`);
        }

        // Recalculate completion percentages for all tasks BEFORE writing
        for (const task of updatedTasks) {
          task.completion_percentage = calculateCompletionPercentage(task, updatedTasks);
        }

        this.logger.debug('Storage updateTasks updated tasks count:', updatedTasks.length);
        const content = updatedTasks.map(i => JSON.stringify(i)).join('\n') + '\n';
        this.logger.debug('Storage writing to', this.tasksFilePath);
        await fs.promises.writeFile(this.tasksFilePath, content);
        this.logger.debug('Storage writeFile done');
      });
    }).catch(err => {
      this.logger.error('updateTasks queued operation failed:', err);
      throw err;
    });
    await this.writeQueue;
    this.logger.debug('=== Storage updateTasks COMPLETE ===');
  }

  getTasksFilePath(): string {
    return this.tasksFilePath;
  }

  async addComment(taskId: string, author: string, content: string): Promise<Comment> {
    const comment: Comment = {
      id: nanoid(10),
      author,
      content,
      created_at: new Date().toISOString()
    };

    await this.updateTasks(tasks => {
      return tasks.map(task => {
        if (task.id === taskId) {
          const comments = task.comments || [];
          return {
            ...task,
            comments: [...comments, comment],
            updated_at: new Date().toISOString()
          };
        }
        return task;
      });
    });

    return comment;
  }

  private migrateTasks(tasks: Task[]): { migratedTasks: Task[], hasMigrations: boolean } {
    let hasMigrations = false;
    const migratedTasks = tasks.map(task => {
      let taskUpdated = false;

      // Migration: Convert 'blocked' status to 'open' (removing blocked as a stored status)
      if ((task as any).status === 'blocked') {
        task.status = 'open';
        task.updated_at = new Date().toISOString();
        hasMigrations = true;
        taskUpdated = true;
        this.logger.info(`Migrated status for task ${task.id}: 'blocked' -> 'open'`);
      }

      if (!task.dependencies || task.dependencies.length === 0) {
        return taskUpdated ? { ...task } : task;
      }

      // Check for any old dependency formats that need migration
      const validDependencyTypes = ['blocked_by', 'related', 'parent-child', 'discovered-from'] as const;
      const legacyDependencyTypeMap: Record<string, (typeof validDependencyTypes)[number]> = {
        // Legacy type      // Canonical stored type
        blocks: 'blocked_by',
      };

      const migratedDeps = task.dependencies
        // Keep only dependencies that are either already valid or can be migrated from a legacy format
        .filter(
          dep =>
            validDependencyTypes.includes(dep.type as any) ||
            Object.prototype.hasOwnProperty.call(legacyDependencyTypeMap, dep.type)
        )
        .map(dep => {
          const mappedType = legacyDependencyTypeMap[dep.type];
          if (mappedType) {
            // Convert legacy dependency type to the canonical stored format
            hasMigrations = true;
            taskUpdated = true;
            this.logger.info(
              `Converted legacy dependency for task ${task.id}: ${dep.type}(${dep.id}) -> ${mappedType}(${dep.id})`
            );
            return { id: dep.id, type: mappedType };
          }
          return dep;
        });

      // Check if any dependencies were filtered out
      if (migratedDeps.length !== task.dependencies.length) {
        hasMigrations = true;
        taskUpdated = true;
        this.logger.info(`Migrated dependencies for task ${task.id}: removed ${task.dependencies.length - migratedDeps.length} invalid dependencies`);
      }

      // Check for potential bidirectional dependencies that might create duplicates
      // If task A is blocked_by B, and B is blocked_by A (mutual block),
      // remove the redundant one and keep deterministically on the lexicographically larger task ID
      const cleanedDeps = migratedDeps.filter((dep, index) => {
        if (dep.type === 'blocked_by') {
          // Check if the target task also has a 'blocked_by' dependency back to this task
          const targetTask = tasks.find(i => i.id === dep.id);
          if (targetTask && targetTask.dependencies) {
            const hasReverseDep = targetTask.dependencies.some(reverseDep =>
              reverseDep.id === task.id && (reverseDep.type === 'blocked_by' || reverseDep.type === 'blocks')
            );
            if (hasReverseDep) {
              // Mutual block: keep only on the lexicographically smaller task ID
              if (task.id > targetTask.id) {
                hasMigrations = true;
                taskUpdated = true;
                this.logger.info(`Removed mutual blocked_by duplicate: ${task.id} <- ${dep.id} (keeping on ${targetTask.id})`);
                return false; // Remove this dependency
              }
            }
          }
        }
        return true;
      });

      if (cleanedDeps.length !== migratedDeps.length) {
        hasMigrations = true;
        taskUpdated = true;
      }

      if (taskUpdated) {
        return {
          ...task,
          dependencies: cleanedDeps,
          updated_at: new Date().toISOString()
        };
      }

      return task;
    });

    if (hasMigrations) {
      this.logger.info('Task migration completed. Some tasks were updated to fix old formats.');
      // Note: The migration will be persisted immediately after this method returns
    }

    return { migratedTasks, hasMigrations };
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