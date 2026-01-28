import { Task } from '../types';
import { isReady } from '../taskUtils';

/**
 * Safely parse a date string and return a valid Date object or null
 * @param dateString - The date string to parse
 * @returns A valid Date object or null if the date string is invalid
 */
export const parseValidDate = (dateString: string | undefined): Date | null => {
  if (!dateString) {
    return null;
  }
  
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
};

export const isWithinTimeFilter = (task: Task, timeFilter: string): boolean => {
  if (timeFilter === 'all') return true;
  
  const updatedAt = new Date(task.updated_at);
  if (isNaN(updatedAt.getTime())) {
    return false;
  }
  
  const now = new Date(Date.now());
  
  switch (timeFilter) {
    case 'hour':
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      return updatedAt >= hourAgo;
    case '6hours':
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      return updatedAt >= sixHoursAgo;
    case '12hours':
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      return updatedAt >= twelveHoursAgo;
    case '24hours':
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return updatedAt >= twentyFourHoursAgo;
    case '3days':
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      return updatedAt >= threeDaysAgo;
    case 'today':
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return updatedAt >= startOfToday;
    case 'yesterday':
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const startOfToday2 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return updatedAt >= startOfYesterday && updatedAt < startOfToday2;
    case 'week':
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return updatedAt >= weekAgo;
    case 'month':
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return updatedAt >= monthAgo;
    default:
      return true;
  }
};

export const getDurationInMs = (duration: string): number => {
  const now = new Date();
  switch (duration) {
    case '5':
      return 5 * 60 * 1000; // 5 minutes
    case '60':
      return 60 * 60 * 1000; // 60 minutes
    case 'today':
      // Milliseconds since midnight today
      return now.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    case 'yesterday':
      // Full 24 hours for yesterday (from yesterday midnight to today midnight)
      return 24 * 60 * 60 * 1000;
    case 'week':
      return 7 * 24 * 60 * 60 * 1000; // 7 days
    default:
      return 60 * 60 * 1000; // Default to 60 minutes
  }
};

export const isTaskBlocked = (task: Task, allTasks: Task[]): boolean => {
  if (!task.dependencies || task.dependencies.length === 0) {
    return false;
  }
  
  // Check if any blocking dependency is not closed
  const blockingDeps = task.dependencies.filter(d => d.type === 'blocks');
  return blockingDeps.some(dep => {
    const blocker = allTasks.find(i => i.id === dep.id);
    return blocker && blocker.status !== 'closed';
  });
};


