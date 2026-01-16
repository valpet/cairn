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
    storage = new StorageService({ horizonDir: tempDir });
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
});