import { useMemo } from 'react';
import { Task } from '../types';
import { isReady } from '../taskUtils';
import { isWithinTimeFilter, getDurationInMs, isTaskBlocked, parseValidDate } from './taskFilterUtils';

export const useTaskFiltering = (allTasks: Task[], selectedStatuses: Set<string>, showRecentlyClosed: boolean, recentlyClosedDuration: string, timeFilter: string) => {
  const filteredTasks = useMemo(() => {
    if (selectedStatuses.size === 0) {
      // When no status filters are selected, still apply recently closed logic if enabled
      let tasks = allTasks;
      if (showRecentlyClosed) {
        const now = new Date();
        const durationMs = getDurationInMs(recentlyClosedDuration);
        tasks = tasks.filter(task => {
          if (task.status === 'closed' && task.closed_at) {
            const closedAt = parseValidDate(task.closed_at);
            if (!closedAt) {
              return false; // Exclude tasks with invalid closed_at timestamps
            }
            return (now.getTime() - closedAt.getTime()) <= durationMs;
          }
          return true; // Include all non-closed tasks
        });
      }
      // Apply time filter
      return tasks.filter(task => isWithinTimeFilter(task, timeFilter));
    }
    const statusArray = Array.from(selectedStatuses);
    let tasks = allTasks.filter(task => {
      // Check if issue is blocked
      const isBlocked = isTaskBlocked(task, allTasks);
      
      // If issue is blocked, only show if 'blocked' is explicitly selected
      if (isBlocked) {
        return statusArray.includes('blocked');
      }
      
      // For non-blocked issues, check stored status
      if (statusArray.includes(task.status)) {
        return true;
      }
      
      // Check ready status
      if (statusArray.includes('ready') && task.status === 'open' && isReady(task, allTasks)) {
        return true;
      }
      
      // Check recently closed if enabled and not already included
      if (showRecentlyClosed && task.status === 'closed' && task.closed_at) {
        const now = new Date();
        const durationMs = getDurationInMs(recentlyClosedDuration);
        const closedAt = parseValidDate(task.closed_at);
        if (!closedAt) {
          return false; // Exclude tasks with invalid closed_at timestamps
        }
        return (now.getTime() - closedAt.getTime()) <= durationMs;
      }
      
      return false;
    });
    
    // Apply time filter to the status-filtered tasks
    return tasks.filter(task => isWithinTimeFilter(task, timeFilter));
  }, [allTasks, selectedStatuses, showRecentlyClosed, recentlyClosedDuration, timeFilter]);

  return { filteredTasks };
};