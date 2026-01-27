import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Task } from '../types';
import { isReady } from '../taskUtils';
import { isWithinTimeFilter, getDurationInMs, isTaskBlocked, parseValidDate } from './taskFilterUtils';

// Mock the taskUtils module
vi.mock('../taskUtils');

describe('Task Filtering Utilities', () => {
  let dateNowSpy: ReturnType<typeof vi.spyOn>;
  
  beforeEach(() => {
    // Mock Date.now() to return a fixed timestamp for consistent testing
    dateNowSpy = vi.spyOn(Date, 'now');
    const fixedDate = new Date('2025-01-27T12:00:00Z');
    dateNowSpy.mockReturnValue(fixedDate.getTime());
  });
  
  afterEach(() => {
    dateNowSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('isWithinTimeFilter', () => {
    it('should return true for "all" filter', () => {
      const task: Task = {
        id: '1',
        title: 'Test',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now() - 1000 * 60 * 60 * 25, // 25 hours ago
      };
      expect(isWithinTimeFilter(task, 'all')).toBe(true);
    });

    it('should filter tasks within the last hour', () => {
      const taskWithinHour: Task = {
        id: '1',
        title: 'Recent',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now() - 30 * 60 * 1000, // 30 minutes ago
      };
      const taskOlderThanHour: Task = {
        id: '2',
        title: 'Old',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now() - 90 * 60 * 1000, // 90 minutes ago
      };
      
      expect(isWithinTimeFilter(taskWithinHour, 'hour')).toBe(true);
      expect(isWithinTimeFilter(taskOlderThanHour, 'hour')).toBe(false);
    });

    it('should filter tasks within the last 6 hours', () => {
      const taskWithin6Hours: Task = {
        id: '1',
        title: 'Recent',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now() - 5 * 60 * 60 * 1000, // 5 hours ago
      };
      const taskOlderThan6Hours: Task = {
        id: '2',
        title: 'Old',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now() - 7 * 60 * 60 * 1000, // 7 hours ago
      };
      
      expect(isWithinTimeFilter(taskWithin6Hours, '6hours')).toBe(true);
      expect(isWithinTimeFilter(taskOlderThan6Hours, '6hours')).toBe(false);
    });

    it('should filter tasks within the last 12 hours', () => {
      const taskWithin12Hours: Task = {
        id: '1',
        title: 'Recent',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now() - 10 * 60 * 60 * 1000, // 10 hours ago
      };
      const taskOlderThan12Hours: Task = {
        id: '2',
        title: 'Old',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now() - 13 * 60 * 60 * 1000, // 13 hours ago
      };
      
      expect(isWithinTimeFilter(taskWithin12Hours, '12hours')).toBe(true);
      expect(isWithinTimeFilter(taskOlderThan12Hours, '12hours')).toBe(false);
    });

    it('should filter tasks within the last 24 hours', () => {
      const taskWithin24Hours: Task = {
        id: '1',
        title: 'Recent',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now() - 20 * 60 * 60 * 1000, // 20 hours ago
      };
      const taskOlderThan24Hours: Task = {
        id: '2',
        title: 'Old',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      };
      
      expect(isWithinTimeFilter(taskWithin24Hours, '24hours')).toBe(true);
      expect(isWithinTimeFilter(taskOlderThan24Hours, '24hours')).toBe(false);
    });

    it('should filter tasks within the last 3 days', () => {
      const taskWithin3Days: Task = {
        id: '1',
        title: 'Recent',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
      };
      const taskOlderThan3Days: Task = {
        id: '2',
        title: 'Old',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now() - 4 * 24 * 60 * 60 * 1000, // 4 days ago
      };
      
      expect(isWithinTimeFilter(taskWithin3Days, '3days')).toBe(true);
      expect(isWithinTimeFilter(taskOlderThan3Days, '3days')).toBe(false);
    });

    it('should filter tasks updated today', () => {
      const now = new Date(Date.now());
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      
      const taskToday: Task = {
        id: '1',
        title: 'Today',
        status: 'open',
        created_at: Date.now(),
        updated_at: startOfToday + 1000, // Just after midnight
      };
      const taskYesterday: Task = {
        id: '2',
        title: 'Yesterday',
        status: 'open',
        created_at: Date.now(),
        updated_at: startOfToday - 1000, // Just before midnight
      };
      
      expect(isWithinTimeFilter(taskToday, 'today')).toBe(true);
      expect(isWithinTimeFilter(taskYesterday, 'today')).toBe(false);
    });

    it('should filter tasks updated yesterday', () => {
      const now = new Date(Date.now());
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
      
      const taskYesterday: Task = {
        id: '1',
        title: 'Yesterday',
        status: 'open',
        created_at: Date.now(),
        updated_at: startOfYesterday + 1000, // During yesterday
      };
      const taskToday: Task = {
        id: '2',
        title: 'Today',
        status: 'open',
        created_at: Date.now(),
        updated_at: startOfToday + 1000, // Today
      };
      const taskTwoDaysAgo: Task = {
        id: '3',
        title: 'Two days ago',
        status: 'open',
        created_at: Date.now(),
        updated_at: startOfYesterday - 1000, // Before yesterday
      };
      
      expect(isWithinTimeFilter(taskYesterday, 'yesterday')).toBe(true);
      expect(isWithinTimeFilter(taskToday, 'yesterday')).toBe(false);
      expect(isWithinTimeFilter(taskTwoDaysAgo, 'yesterday')).toBe(false);
    });

    it('should filter tasks within the last week', () => {
      const taskWithinWeek: Task = {
        id: '1',
        title: 'Recent',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days ago
      };
      const taskOlderThanWeek: Task = {
        id: '2',
        title: 'Old',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
      };
      
      expect(isWithinTimeFilter(taskWithinWeek, 'week')).toBe(true);
      expect(isWithinTimeFilter(taskOlderThanWeek, 'week')).toBe(false);
    });

    it('should filter tasks within the last month', () => {
      const taskWithinMonth: Task = {
        id: '1',
        title: 'Recent',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now() - 25 * 24 * 60 * 60 * 1000, // 25 days ago
      };
      const taskOlderThanMonth: Task = {
        id: '2',
        title: 'Old',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now() - 31 * 24 * 60 * 60 * 1000, // 31 days ago
      };
      
      expect(isWithinTimeFilter(taskWithinMonth, 'month')).toBe(true);
      expect(isWithinTimeFilter(taskOlderThanMonth, 'month')).toBe(false);
    });

    it('should exclude tasks with invalid timestamps', () => {
      const invalidTask: Task = {
        id: '1',
        title: 'Invalid',
        status: 'open',
        created_at: Date.now(),
        updated_at: 'invalid-date' as any,
      };
      
      expect(isWithinTimeFilter(invalidTask, 'hour')).toBe(false);
      expect(isWithinTimeFilter(invalidTask, 'today')).toBe(false);
    });

    it('should treat unknown filters as "all"', () => {
      const task: Task = {
        id: '1',
        title: 'Test',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now() - 1000 * 60 * 60 * 100, // Very old
      };
      
      expect(isWithinTimeFilter(task, 'unknown-filter' as any)).toBe(true);
    });
  });

  describe('getDurationInMs', () => {
    it('should return correct milliseconds for "5" (5 minutes)', () => {
      expect(getDurationInMs('5')).toBe(5 * 60 * 1000);
    });

    it('should return correct milliseconds for "60" (60 minutes)', () => {
      expect(getDurationInMs('60')).toBe(60 * 60 * 1000);
    });

    it('should return correct milliseconds for "week"', () => {
      expect(getDurationInMs('week')).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should return default 60 minutes for unknown duration', () => {
      expect(getDurationInMs('unknown')).toBe(60 * 60 * 1000);
    });

    it('should handle "today" duration (time since midnight)', () => {
      const result = getDurationInMs('today');
      // Should be less than 24 hours worth of milliseconds
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(24 * 60 * 60 * 1000);
    });

    it('should return 24 hours for "yesterday"', () => {
      expect(getDurationInMs('yesterday')).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('isTaskBlocked', () => {
    it('should return false for task with no dependencies', () => {
      const task: Task = {
        id: '1',
        title: 'Test',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      
      expect(isTaskBlocked(task, [])).toBe(false);
    });

    it('should return false for task with empty dependencies array', () => {
      const task: Task = {
        id: '1',
        title: 'Test',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now(),
        dependencies: [],
      };
      
      expect(isTaskBlocked(task, [])).toBe(false);
    });

    it('should return true when task has blocking dependency that is not closed', () => {
      const blocker: Task = {
        id: '2',
        title: 'Blocker',
        status: 'in_progress',
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      
      const blocked: Task = {
        id: '1',
        title: 'Blocked',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now(),
        dependencies: [{ id: '2', type: 'blocks' }],
      };
      
      expect(isTaskBlocked(blocked, [blocker, blocked])).toBe(true);
    });

    it('should return false when blocking dependency is closed', () => {
      const blocker: Task = {
        id: '2',
        title: 'Blocker',
        status: 'closed',
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      
      const task: Task = {
        id: '1',
        title: 'Task',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now(),
        dependencies: [{ id: '2', type: 'blocks' }],
      };
      
      expect(isTaskBlocked(task, [blocker, task])).toBe(false);
    });

    it('should return false for non-blocking dependencies', () => {
      const relatedTask: Task = {
        id: '2',
        title: 'Related',
        status: 'in_progress',
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      
      const task: Task = {
        id: '1',
        title: 'Task',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now(),
        dependencies: [{ id: '2', type: 'related' }],
      };
      
      expect(isTaskBlocked(task, [relatedTask, task])).toBe(false);
    });

    it('should handle dependency on non-existent task', () => {
      const task: Task = {
        id: '1',
        title: 'Task',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now(),
        dependencies: [{ id: '999', type: 'blocks' }],
      };
      
      expect(isTaskBlocked(task, [task])).toBe(false);
    });

    it('should return true if any blocking dependency is not closed', () => {
      const closedBlocker: Task = {
        id: '2',
        title: 'Closed Blocker',
        status: 'closed',
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      
      const openBlocker: Task = {
        id: '3',
        title: 'Open Blocker',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      
      const blocked: Task = {
        id: '1',
        title: 'Blocked',
        status: 'open',
        created_at: Date.now(),
        updated_at: Date.now(),
        dependencies: [
          { id: '2', type: 'blocks' },
          { id: '3', type: 'blocks' },
        ],
      };
      
      expect(isTaskBlocked(blocked, [closedBlocker, openBlocker, blocked])).toBe(true);
    });
  });

  describe('parseValidDate', () => {
    it('should return Date object for valid date string', () => {
      const result = parseValidDate('2025-01-27T12:00:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(new Date('2025-01-27T12:00:00Z').getTime());
    });

    it('should return null for invalid date string', () => {
      const result = parseValidDate('not-a-date');
      expect(result).toBeNull();
    });

    it('should return null for undefined input', () => {
      const result = parseValidDate(undefined);
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = parseValidDate('');
      expect(result).toBeNull();
    });

    it('should handle ISO 8601 date strings', () => {
      const isoDate = '2025-01-15T08:30:45.123Z';
      const result = parseValidDate(isoDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(isoDate);
    });

    it('should handle various date formats', () => {
      const formats = [
        '2025-01-27',
        '2025/01/27',
        'Jan 27, 2025',
        '01/27/2025',
      ];
      
      formats.forEach(format => {
        const result = parseValidDate(format);
        expect(result).toBeInstanceOf(Date);
        expect(isNaN(result!.getTime())).toBe(false);
      });
    });

    it('should return null for Invalid Date strings like "Invalid Date"', () => {
      const result = parseValidDate('Invalid Date');
      expect(result).toBeNull();
    });
  });
});
