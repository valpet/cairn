import { useMemo } from 'react';
import { Issue } from '../types';
import { isReady } from '../taskUtils';

// Compute if an issue is blocked based on its dependencies
const isIssueBlocked = (issue: Issue, allIssues: Issue[]): boolean => {
  if (!issue.dependencies || issue.dependencies.length === 0) {
    return false;
  }
  
  // Check if any blocking dependency is not closed
  const blockingDeps = issue.dependencies.filter(d => d.type === 'blocks');
  return blockingDeps.some(dep => {
    const blocker = allIssues.find(i => i.id === dep.id);
    return blocker && blocker.status !== 'closed';
  });
};

export const useTaskFiltering = (allTasks: Issue[], selectedStatuses: Set<string>) => {
  const filteredTasks = useMemo(() => {
    if (selectedStatuses.size === 0) {
      return allTasks;
    }
    const statusArray = Array.from(selectedStatuses);
    return allTasks.filter(task => {
      // Check if issue is blocked
      const isBlocked = isIssueBlocked(task, allTasks);
      
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
      
      return false;
    });
  }, [allTasks, selectedStatuses]);

  return { filteredTasks };
};