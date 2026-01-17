import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageService } from './storage';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('StorageService', () => {
  let tempDir: string;
  let storage: StorageService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'horizon-test-'));
    storage = new StorageService({
      horizonDir: tempDir,
      lockMaxRetries: 20,
      lockRetryDelay: 50,
      lockTimeout: 1000 // 1 second for tests
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should load empty issues when file does not exist', async () => {
    const issues = await storage.loadIssues();
    expect(issues).toEqual([]);
  });

  it('should save and load issues', async () => {
    const issue = {
      id: 'test-1',
      title: 'Test Issue',
      status: 'open' as const,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    };

    await storage.saveIssue(issue);
    const issues = await storage.loadIssues();
    expect(issues).toEqual([issue]);
  });

  it('should append multiple issues', async () => {
    const issue1 = {
      id: 'test-1',
      title: 'Test Issue 1',
      status: 'open' as const,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    };
    const issue2 = {
      id: 'test-2',
      title: 'Test Issue 2',
      status: 'closed' as const,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      closed_at: '2023-01-01T00:00:00Z',
    };

    await storage.saveIssue(issue1);
    await storage.saveIssue(issue2);
    const issues = await storage.loadIssues();
    expect(issues).toEqual([issue1, issue2]);
  });

  it('should return correct file path', () => {
    expect(storage.getIssuesFilePath()).toBe(path.join(tempDir, 'issues.jsonl'));
  });

  describe('Locking mechanism', () => {
    it('should handle concurrent writes from same process', async () => {
      const issue1 = {
        id: 'test-1',
        title: 'Test Issue 1',
        status: 'open' as const,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };
      const issue2 = {
        id: 'test-2',
        title: 'Test Issue 2',
        status: 'open' as const,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      // Start both saves simultaneously
      await Promise.all([
        storage.saveIssue(issue1),
        storage.saveIssue(issue2)
      ]);

      const issues = await storage.loadIssues();
      expect(issues).toHaveLength(2);
      expect(issues).toContainEqual(issue1);
      expect(issues).toContainEqual(issue2);
    });

    it('should handle concurrent updates from same process', async () => {
      const issue1 = {
        id: 'test-1',
        title: 'Test Issue 1',
        status: 'open' as const,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };
      await storage.saveIssue(issue1);

      // Run multiple updates concurrently
      await Promise.all([
        storage.updateIssues(issues => issues.map(i => ({ ...i, title: 'Updated 1' }))),
        storage.updateIssues(issues => issues.map(i => ({ ...i, status: 'closed' as const }))),
        storage.updateIssues(issues => issues.map(i => ({ ...i, updated_at: '2023-01-02T00:00:00Z' })))
      ]);

      const issues = await storage.loadIssues();
      expect(issues).toHaveLength(1);
      // The last update in the queue should win
      expect(issues[0].updated_at).toBe('2023-01-02T00:00:00Z');
    });

    it('should clean up stale locks', async () => {
      const lockPath = path.join(tempDir, 'issues.lock');

      // Create a stale lock (older than our 1s test timeout)
      const staleLockData = {
        pid: 99999,
        timestamp: Date.now() - 1100
      };
      await fs.promises.writeFile(lockPath, JSON.stringify(staleLockData));

      const issue = {
        id: 'test-1',
        title: 'Test Issue',
        status: 'open' as const,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      // This should clean up the stale lock and succeed
      await storage.saveIssue(issue);

      const issues = await storage.loadIssues();
      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual(issue);
    });

    it('should retry when lock is held by another process', async () => {
      const lockPath = path.join(tempDir, 'issues.lock');

      // Create a fresh lock (simulating another process)
      const freshLockData = {
        pid: 99999,
        timestamp: Date.now()
      };
      await fs.promises.writeFile(lockPath, JSON.stringify(freshLockData));

      const issue = {
        id: 'test-1',
        title: 'Test Issue',
        status: 'open' as const,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      // Release the lock after 100ms to simulate another process finishing
      setTimeout(async () => {
        try {
          await fs.promises.unlink(lockPath);
        } catch (e) {
          // Ignore if already released
        }
      }, 100);

      const startTime = Date.now();
      await storage.saveIssue(issue);
      const elapsedTime = Date.now() - startTime;

      // Should have waited for the lock to be released
      expect(elapsedTime).toBeGreaterThanOrEqual(100);

      const issues = await storage.loadIssues();
      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual(issue);
    });

    it('should eventually succeed after retries', async () => {
      const lockPath = path.join(tempDir, 'issues.lock');

      // Create a lock that will be fresh for first few retries
      const lockData = {
        pid: 99999,
        timestamp: Date.now()
      };
      await fs.promises.writeFile(lockPath, JSON.stringify(lockData));

      const issue = {
        id: 'test-1',
        title: 'Test Issue',
        status: 'open' as const,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      // Release the lock after 300ms (before it becomes stale at 1000ms)
      setTimeout(async () => {
        try {
          await fs.promises.unlink(lockPath);
        } catch (e) {
          // Ignore if already released
        }
      }, 300);

      await storage.saveIssue(issue);
      const issues = await storage.loadIssues();
      expect(issues).toHaveLength(1);
    });
  });
});