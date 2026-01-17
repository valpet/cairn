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
  private writeQueue: Promise<void> = Promise.resolve(); // Serialize all write operations within this process

  constructor(@inject('config') private config: { horizonDir: string }) {
    this.issuesFilePath = path.join(config.horizonDir, 'issues.jsonl');
    this.lockFilePath = path.join(config.horizonDir, 'issues.lock');
  }

  async loadIssues(): Promise<Issue[]> {
    return await this.loadIssuesInternal();
  }

  private async loadIssuesInternal(): Promise<Issue[]> {
    if (!fs.existsSync(this.issuesFilePath)) {
      return [];
    }
    const content = await fs.promises.readFile(this.issuesFilePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    return lines.map(line => JSON.parse(line) as Issue);
  }

  async saveIssue(issue: Issue): Promise<void> {
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
      console.error('saveIssue queued operation failed:', err);
      throw err;
    });
    return this.writeQueue;
  }

  async updateIssues(updater: (issues: Issue[]) => Issue[]): Promise<void> {
    console.error('=== Storage updateIssues CALLED ===');
    // Queue this write operation
    this.writeQueue = this.writeQueue.then(async () => {
      await this.withLock(async () => {
        console.error('Storage updateIssues: Inside lock');
        const issues = await this.loadIssuesInternal();
        console.error('Storage updateIssues loaded issues count:', issues.length);
        const updatedIssues = updater(issues);
        console.error('Storage updateIssues updated issues count:', updatedIssues.length);
        const content = updatedIssues.map(i => JSON.stringify(i)).join('\n') + '\n';
        console.error('Storage writing to', this.issuesFilePath);
        await fs.promises.writeFile(this.issuesFilePath, content);
        console.error('Storage writeFile done');
      });
    }).catch(err => {
      console.error('updateIssues queued operation failed:', err);
      throw err;
    });
    await this.writeQueue;
    console.error('=== Storage updateIssues COMPLETE ===');
  }

  getIssuesFilePath(): string {
    return this.issuesFilePath;
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const maxRetries = 50;
    const retryDelay = 100; // ms
    const lockTimeout = 30000; // 30 seconds

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Clean up stale locks
        if (fs.existsSync(this.lockFilePath)) {
          const lockContent = await fs.promises.readFile(this.lockFilePath, 'utf-8');
          const lockData = JSON.parse(lockContent);
          const lockAge = Date.now() - lockData.timestamp;
          if (lockAge > lockTimeout) {
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
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
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