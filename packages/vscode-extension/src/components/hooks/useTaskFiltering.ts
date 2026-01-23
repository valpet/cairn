import { useMemo } from 'react';
import { Issue } from '../types';
import { isReady } from '../taskUtils';

export const useTaskFiltering = (allTasks: Issue[], selectedStatuses: Set<string>) => {
  const filteredTasks = useMemo(() => {
    if (selectedStatuses.size === 0) {
      return allTasks;
    }
    const statusArray = Array.from(selectedStatuses);
    return allTasks.filter(task =>
      statusArray.includes(task.status) ||
      (statusArray.includes('ready') && task.status === 'open' && isReady(task, allTasks))
    );
  }, [allTasks, selectedStatuses]);

  return { filteredTasks };
};