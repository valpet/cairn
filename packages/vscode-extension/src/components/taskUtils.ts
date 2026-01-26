import { Task } from './types';

export interface BadgeInfo {
  className: string;
  text: string;
}

// Utility functions for creating components
export const createTypeBadge = (type?: string): BadgeInfo => {
  const badgeClass = `type-badge ${type || 'task'}`;
  const badgeText = type || 'Task';
  return { className: badgeClass, text: badgeText };
};

export const createStatusPill = (status?: string, displayText?: string): BadgeInfo => {
  const displayStatus = status || 'open';
  const text = displayText || (displayStatus === 'in_progress' ? 'In Progress' :
    (displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)));
  const pillClass = `pill status-${displayStatus}`;
  return { className: pillClass, text };
};

export const createPriorityPill = (priority?: string): BadgeInfo => {
  const displayPriority = priority || 'medium';
  const pillClass = `pill priority-${displayPriority}`;
  const text = displayPriority.charAt(0).toUpperCase() + displayPriority.slice(1);
  return { className: pillClass, text };
};

// Function to check if a task is ready (no blocking dependencies)
export const isReady = (task: Task, allTasks: Task[]): boolean => {
  if (!task.dependencies) return true;
  const taskMap = new Map(allTasks.map(t => [t.id, t]));
  return task.dependencies.every(dep => {
    if (dep.type !== 'blocks') return true;
    const depTask = taskMap.get(dep.id);
    return depTask && depTask.status === 'closed';
  });
};

// Function to check if a task is blocked
export const isBlocked = (task: Task, allTasks: Task[]): boolean => {
  if (!task.dependencies || task.status === 'closed') return false;
  const taskMap = new Map(allTasks.map(t => [t.id, t]));
  return task.dependencies.some(dep => {
    if (dep.type !== 'blocks') return false;
    const depTask = taskMap.get(dep.id);
    return depTask && depTask.status !== 'closed';
  });
};

// Get icon for status
export const getStatusIcon = (status: string): string => {
  const icons: { [key: string]: string } = {
    'ready': '✓',
    'open': '●',
    'in_progress': '◐',
    'closed': '✓',
    'blocked': '⊘'
  };
  return icons[status] || '●';
};

// Get display label for status
export const getStatusLabel = (status: string): string => {
  const labels: { [key: string]: string } = {
    'ready': 'Ready',
    'open': 'Open',
    'in_progress': 'In Progress',
    'closed': 'Closed',
    'blocked': 'Blocked'
  };
  return labels[status] || status;
};