import { injectable, inject } from 'inversify';
import * as fs from 'fs';
import * as path from 'path';
import { Issue } from './types';

export interface IStorageService {
  loadIssues(): Promise<Issue[]>;
  saveIssue(issue: Issue): Promise<void>;
  updateIssues(updater: (issues: Issue[]) => Issue[]): Promise<void>;
  getIssuesFilePath(): string;
}

@injectable()
export class StorageService implements IStorageService {
  private issuesFilePath: string;
  private lockFilePath: string;
  private lockDepth: number = 0;

  constructor(@inject('config') private config: { horizonDir: string }) {
    this.issuesFilePath = path.join(config.horizonDir, 'issues.jsonl');
    this.lockFilePath = path.join(config.horizonDir, 'issues.lock');
  }

  async loadIssues(): Promise<Issue[]> {
    return await this.withLock(async () => {
      if (!fs.existsSync(this.issuesFilePath)) {
        return [];
      }
      const content = await fs.promises.readFile(this.issuesFilePath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      return lines.map(line => JSON.parse(line) as Issue);
    });
  }

  async saveIssue(issue: Issue): Promise<void> {
    await this.withLock(async () => {
      const line = JSON.stringify(issue) + '\n';
      await fs.promises.appendFile(this.issuesFilePath, line);
    });
  }

  async updateIssues(updater: (issues: Issue[]) => Issue[]): Promise<void> {
    await this.withLock(async () => {
      const issues = await this.loadIssues();
      const updatedIssues = updater(issues);
      const content = updatedIssues.map(i => JSON.stringify(i)).join('\n') + '\n';
      await fs.promises.writeFile(this.issuesFilePath, content);
    });
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    // Check if we already hold the lock (re-entrant call)
    if (this.lockDepth > 0) {
      this.lockDepth++;
      try {
        return await operation();
      } finally {
        this.lockDepth--;
      }
    }

    const maxRetries = 10;
    const retryDelay = 100; // ms
    const lockTimeout = 30000; // 30 seconds

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Check for and clean up stale locks
        await this.cleanupStaleLock(lockTimeout);

        // Try to acquire lock
        const lockData = {
          pid: process.pid,
          timestamp: Date.now()
        };
        await fs.promises.writeFile(this.lockFilePath, JSON.stringify(lockData), { flag: 'wx' });

        this.lockDepth = 1;
        try {
          // Execute operation while holding lock
          return await operation();
        } finally {
          this.lockDepth--;
          if (this.lockDepth === 0) {
            // Release lock only when we're back to depth 0
            try {
              await fs.promises.unlink(this.lockFilePath);
            } catch (error) {
              const err = error as NodeJS.ErrnoException;
              if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
                // Lock file was already removed, likely by another process in a concurrent scenario
                console.warn(
                  `Lock file at ${this.lockFilePath} was already removed when attempting to release it. ` +
                  'This is expected in some concurrent access scenarios.',
                  err,
                );
              } else {
                // Unexpected file system issue when trying to remove the lock file
                console.error(
                  `Failed to release lock file at ${this.lockFilePath} due to an unexpected file system error. ` +
                  'This may indicate permission problems, a full disk, or other file system issues and should be investigated. ' +
                  'Proceeding because the protected operation has already completed.',
                  error,
                );
              }
            }
          }
        }
      } catch (error: any) {
        if (error.code === 'EEXIST') {
          // Lock exists, wait and retry
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
            continue;
          }
          throw new Error('Failed to acquire file lock after maximum retries');
        }
        throw error;
      }
    }

    throw new Error('Unexpected error in file locking');
  }

  private async cleanupStaleLock(timeoutMs: number): Promise<void> {
    try {
      if (!fs.existsSync(this.lockFilePath)) {
        return; // No lock file exists
      }

      const lockContent = await fs.promises.readFile(this.lockFilePath, 'utf-8');
      const lockData = JSON.parse(lockContent);

      // Only handle new format lock files (JSON with timestamp and pid)
      if (typeof lockData.timestamp === 'number' && typeof lockData.pid === 'number') {
        const lockAge = Date.now() - lockData.timestamp;
        if (lockAge > timeoutMs) {
          // Lock is stale, try to remove it
          try {
            await fs.promises.unlink(this.lockFilePath);
            console.warn(`Cleaned up stale lock file (age: ${lockAge}ms, pid: ${lockData.pid})`);
          } catch (unlinkError) {
            // Another process might have removed it or the process is still alive
            console.warn(
              `Failed to remove stale lock file at ${this.lockFilePath} (age: ${lockAge}ms, pid: ${lockData.pid}). ` +
              'Another process may have already cleaned it up or the owning process is still active.',
              unlinkError,
            );
          }
        }
      } else {
        // Invalid or old format lock file - clean it up
        try {
          await fs.promises.unlink(this.lockFilePath);
          console.warn(`Cleaned up invalid lock file at ${this.lockFilePath}. Expected JSON format with timestamp and pid.`);
        } catch (unlinkError) {
          console.warn(
            `Failed to remove invalid lock file at ${this.lockFilePath}. ` +
            'Manual intervention may be required.',
            unlinkError,
          );
        }
      }
    } catch (error) {
      // If we can't read or parse the lock file, it's probably corrupted
      // Try to remove it
      try {
        await fs.promises.unlink(this.lockFilePath);
        console.warn(`Cleaned up corrupted lock file at ${this.lockFilePath}. The file could not be parsed or read.`, error);
      } catch (unlinkError) {
        // Ignore cleanup errors
        console.warn(
          `Failed to clean up corrupted lock file at ${this.lockFilePath}. ` +
          'The lock file appears corrupted but cannot be removed. Manual intervention may be required.',
          { parseError: error, unlinkError: unlinkError },
        );
      }
    }
  }

  getIssuesFilePath(): string {
    return this.issuesFilePath;
  }
}