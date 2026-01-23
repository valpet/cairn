// Utility functions for IssueEdit components

interface Subtask {
  status: string;
}

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

export const computeSubIssueStatus = (subtasks: Subtask[]) => {
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
  const computedStatus = computeSubIssueStatus(subtasks);
  return computedStatus && computedStatus !== status ? computedStatus : status;
};