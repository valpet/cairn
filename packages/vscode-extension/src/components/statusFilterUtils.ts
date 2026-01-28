export const getStatusIcon = (status: string): string => {
  switch (status) {
    case 'ready': return '🚀';
    case 'open': return '📋';
    case 'in_progress': return '⚡';
    case 'closed': return '✅';
    case 'blocked': return '🚫';
    default: return '📋';
  }
};

export const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'ready': return 'Ready';
    case 'open': return 'Open';
    case 'in_progress': return 'In Progress';
    case 'closed': return 'Closed';
    case 'blocked': return 'Blocked';
    default: return status;
  }
};

export const toggleStatusFilter = (status: string, selectedStatuses: Set<string>): Set<string> => {
  const newStatuses = new Set(selectedStatuses);
  if (newStatuses.has(status)) {
    newStatuses.delete(status);
  } else {
    newStatuses.add(status);
  }
  return newStatuses;
};

export const removeStatusFilter = (status: string, selectedStatuses: Set<string>): Set<string> => {
  const newStatuses = new Set(selectedStatuses);
  newStatuses.delete(status);
  return newStatuses;
};

export const clearAllFilters = (): Set<string> => {
  return new Set();
};
