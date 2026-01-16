import { injectable } from 'inversify';
import { Issue } from './types';

export interface ICompactionService {
  compactIssues(issues: Issue[]): Issue[];
}

@injectable()
export class CompactionService implements ICompactionService {
  private readonly COMPACTION_DAYS = 30;

  compactIssues(issues: Issue[]): Issue[] {
    const now = new Date();
    return issues.map(issue => {
      if (issue.status === 'closed' && issue.closed_at) {
        const closedDate = new Date(issue.closed_at);
        const daysSinceClosed = (now.getTime() - closedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceClosed > this.COMPACTION_DAYS) {
          return {
            ...issue,
            description: issue.description ? issue.description.substring(0, 200) + '...' : undefined,
            notes: issue.notes ? issue.notes.substring(0, 100) + '...' : undefined,
            design: undefined, // remove design
            acceptance_criteria: undefined, // remove criteria
          };
        }
      }
      return issue;
    });
  }
}