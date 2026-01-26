import { describe, it, expect, beforeEach } from 'vitest';
import { CompactionService } from './compaction';
import { Task } from './types';

describe('CompactionService', () => {
  let compactionService: CompactionService;

  beforeEach(() => {
    compactionService = new CompactionService();
  });

  it('should not compact open issues', () => {
    const issues: Task[] = [
      {
        id: 'a',
        title: 'A',
        status: 'open',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        description: 'Long description that should be compacted',
      },
    ];

    const compacted = compactionService.compactTasks(issues);
    expect(compacted[0].description).toBe('Long description that should be compacted');
  });

  it('should compact closed issues after 30 days', () => {
    const closedDate = new Date();
    closedDate.setDate(closedDate.getDate() - 31); // 31 days ago

    const issues: Task[] = [
      {
        id: 'a',
        title: 'A',
        status: 'closed',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        closed_at: closedDate.toISOString(),
        description: 'This is a very long description that should be truncated to 200 characters or less when compacted after 30 days.',
        acceptance_criteria: ['Criteria 1', 'Criteria 2'],
      },
    ];

    const compacted = compactionService.compactTasks(issues);
    expect(compacted[0].description?.length).toBeLessThanOrEqual(203); // 200 + '...'
    expect(compacted[0].description?.endsWith('...')).toBe(true);
    expect(compacted[0].acceptance_criteria).toBeUndefined();
  });

  it('should not compact recently closed issues', () => {
    const closedDate = new Date();
    closedDate.setDate(closedDate.getDate() - 10); // 10 days ago

    const issues: Task[] = [
      {
        id: 'a',
        title: 'A',
        status: 'closed',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        closed_at: closedDate.toISOString(),
        description: 'Short desc',
      },
    ];

    const compacted = compactionService.compactTasks(issues);
    expect(compacted[0].description).toBe('Short desc');
  });

  it('should handle issues with deprecated fields', () => {
    const closedDate = new Date();
    closedDate.setDate(closedDate.getDate() - 31);

    const issues: Task[] = [
      {
        id: 'a',
        title: 'A',
        status: 'closed',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        closed_at: closedDate.toISOString(),
        description: 'This is a very long description that should be truncated to 200 characters or less when compacted after 30 days.',
        notes: 'Legacy notes',
        acceptance_criteria: ['AC1', 'AC2']
      } as any,
    ];

    const compacted = compactionService.compactTasks(issues);
    expect(compacted[0].description?.length).toBeLessThanOrEqual(203); // 200 + '...'
    expect(compacted[0].description?.endsWith('...')).toBe(true);
    // Deprecated fields should be handled gracefully
  });
});