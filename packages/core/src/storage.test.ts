import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageService } from './storage';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('StorageService', () => {
  let tempDir: string;
  let storage: StorageService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cairn-test-'));
    storage = new StorageService({
      cairnDir: tempDir,
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

  it('should load issues with deprecated fields gracefully', async () => {
    // Simulate old data that still contains deprecated fields
    const oldIssueData = JSON.stringify({
      id: 'legacy-1',
      title: 'Legacy Issue',
      status: 'open',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      notes: 'These are legacy notes',
      acceptance_criteria: ['Criteria 1', 'Criteria 2']
    });

    // Write the old format directly to the file
    const issuesPath = path.join(tempDir, 'issues.jsonl');
    await fs.promises.writeFile(issuesPath, oldIssueData + '\n');

    const issues = await storage.loadIssues();
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('legacy-1');
    expect(issues[0].title).toBe('Legacy Issue');
    expect(issues[0].status).toBe('open');
    // The deprecated fields should be loaded but not cause errors
    expect((issues[0] as any).notes).toBe('These are legacy notes');
    expect((issues[0] as any).acceptance_criteria).toEqual(['Criteria 1', 'Criteria 2']);
  });

  it('should save and reload issues with deprecated fields', async () => {
    // Create an issue with deprecated fields (simulating migration scenario)
    const issueWithDeprecated = {
      id: 'test-1',
      title: 'Test Issue',
      status: 'open' as const,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      notes: 'Legacy notes field',
      acceptance_criteria: ['AC1', 'AC2']
    } as any; // Cast to any to bypass type checking

    // Save it (this should work even with deprecated fields)
    await storage.saveIssue(issueWithDeprecated);

    // Load it back
    const issues = await storage.loadIssues();
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('test-1');
    // The deprecated fields should be preserved
    expect((issues[0] as any).notes).toBe('Legacy notes field');
    expect((issues[0] as any).acceptance_criteria).toEqual(['AC1', 'AC2']);
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

  describe('Comment management', () => {
    it('should add a comment to an issue', async () => {
      const issue = {
        id: 'test-1',
        title: 'Test Issue',
        status: 'open' as const,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      await storage.saveIssue(issue);
      const comment = await storage.addComment('test-1', 'agent', 'This is a test comment');

      expect(comment.id).toBeTruthy();
      expect(comment.author).toBe('agent');
      expect(comment.content).toBe('This is a test comment');
      expect(comment.created_at).toBeTruthy();

      const issues = await storage.loadIssues();
      expect(issues[0].comments).toHaveLength(1);
      expect(issues[0].comments![0]).toEqual(comment);
    });

    it('should add multiple comments to an issue', async () => {
      const issue = {
        id: 'test-1',
        title: 'Test Issue',
        status: 'open' as const,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      await storage.saveIssue(issue);
      await storage.addComment('test-1', 'user', 'First comment');
      await storage.addComment('test-1', 'agent', 'Second comment');
      await storage.addComment('test-1', 'user', 'Third comment');

      const issues = await storage.loadIssues();
      expect(issues[0].comments).toHaveLength(3);
      expect(issues[0].comments![0].content).toBe('First comment');
      expect(issues[0].comments![1].content).toBe('Second comment');
      expect(issues[0].comments![2].content).toBe('Third comment');
    });

    it('should update issue timestamp when adding comment', async () => {
      const issue = {
        id: 'test-1',
        title: 'Test Issue',
        status: 'open' as const,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      await storage.saveIssue(issue);
      const beforeUpdate = issue.updated_at;

      // Wait a tiny bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      await storage.addComment('test-1', 'agent', 'Test comment');

      const issues = await storage.loadIssues();
      expect(issues[0].updated_at).not.toBe(beforeUpdate);
    });
  });
});