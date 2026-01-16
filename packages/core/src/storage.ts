import { injectable, inject } from 'inversify';
import * as fs from 'fs';
import * as path from 'path';
import { Issue } from './types';

export interface IStorageService {
  loadIssues(): Promise<Issue[]>;
  saveIssue(issue: Issue): Promise<void>;
  getIssuesFilePath(): string;
}

@injectable()
export class StorageService implements IStorageService {
  private issuesFilePath: string;

  constructor(@inject('config') private config: { horizonDir: string }) {
    this.issuesFilePath = path.join(config.horizonDir, 'issues.jsonl');
  }

  async loadIssues(): Promise<Issue[]> {
    if (!fs.existsSync(this.issuesFilePath)) {
      return [];
    }
    const content = await fs.promises.readFile(this.issuesFilePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    return lines.map(line => JSON.parse(line) as Issue);
  }

  async saveIssue(issue: Issue): Promise<void> {
    const line = JSON.stringify(issue) + '\n';
    await fs.promises.appendFile(this.issuesFilePath, line);
  }

  getIssuesFilePath(): string {
    return this.issuesFilePath;
  }
}