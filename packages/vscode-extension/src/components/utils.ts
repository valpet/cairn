// Utility functions for TaskEdit components

interface Subtask {
  status: string;
}

interface Task {
  id: string;
  status: string;
  dependencies?: Array<{ id: string; type: string }>;
}

// Compute if a task is blocked based on its dependencies
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

// Get the computed status including blocked state
export const getComputedStatus = (task: Task, allTasks: Task[]): string => {
  if (task.status === 'closed') {
    return 'closed';
  }
  
  if (isTaskBlocked(task, allTasks)) {
    return 'blocked';
  }
  
  return task.status;
};

export const getTypeIcon = (type: string) => {
  const icons: Record<string, string> = {
    task: '•',
    bug: '🐛',
    feature: '✨',
    epic: '⚡',
    chore: '🔧',
    docs: '📝',
    refactor: '♻️'
  };
  return icons[type] || '•';
};

export const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    task: 'Task',
    bug: 'Bug',
    feature: 'Feature',
    epic: 'Epic',
    chore: 'Chore',
    docs: 'Docs',
    refactor: 'Refactor'
  };
  return labels[type] || type;
};

export const getPriorityIcon = (priority: string) => {
  const icons: Record<string, string> = {
    low: '●',
    medium: '◆',
    high: '▲',
    urgent: '⚠️'
  };
  return icons[priority] || '◆';
};

export const getPriorityLabel = (priority: string) => {
  const labels: Record<string, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent'
  };
  return labels[priority] || priority;
};

export const getStatusIcon = (status: string) => {
  const icons: Record<string, string> = {
    open: '●',
    in_progress: '◐',
    closed: '✓',
    blocked: '⛔'
  };
  return icons[status] || '●';
};

export const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    closed: 'Closed',
    blocked: 'Blocked'
  };
  return labels[status] || status;
};

export const computeSubTaskStatus = (subtasks: Subtask[]) => {
  if (!subtasks || subtasks.length === 0) return null;

  const hasInProgress = subtasks.some(subtask => subtask.status === 'in_progress');
  if (hasInProgress) return 'in_progress';

  const nonClosedSubtasks = subtasks.filter(subtask => subtask.status !== 'closed');
  if (nonClosedSubtasks.length > 0 && nonClosedSubtasks.every(subtask => subtask.status === 'blocked')) {
    return 'blocked';
  }

  if (subtasks.every(subtask => subtask.status === 'closed')) {
    return 'closed';
  }

  return null;
};

export const getComputedStatusClass = (status: string, subtasks: Subtask[]) => {
  const computedStatus = computeSubTaskStatus(subtasks);
  return computedStatus && computedStatus !== status ? computedStatus : status;
};

// Date and time formatting utilities
export const formatDate = (isoString: string) => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const formatTimestamp = (isoString: string) => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
};

// Status display utilities
export const getStatusDisplayText = (status: string, subtasks: Subtask[]) => {
  const statusLabels: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    closed: 'Closed',
    blocked: 'Blocked'
  };
  const statusText = statusLabels[status] || status;

  const computedStatus = computeSubTaskStatus(subtasks);
  if (computedStatus && computedStatus !== status) {
    const computedStatusText = statusLabels[computedStatus] || computedStatus;
    return `${statusText} / ${computedStatusText}`;
  }

  return statusText;
};

// Error handling utilities
export const showErrorMessage = (error: string, errorCode?: string) => {
  let message = error;
  if (errorCode === 'CANNOT_CLOSE_WITH_OPEN_SUBTASKS') {
    message = 'Cannot close task as it has open subtasks.';
  }

  // Create temporary error notification
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #f85149;
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    max-width: 400px;
    font-size: 13px;
    line-height: 1.4;
  `;
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);

  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.parentNode.removeChild(errorDiv);
    }
  }, 5000);
};