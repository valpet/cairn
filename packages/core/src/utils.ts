import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { TaskStatus, Priority, TaskType, Dependency, DependencyType, Comment, AcceptanceCriteria, Task } from './types';

/**
 * Finds the .cairn directory by walking up the directory tree from startDir.
 * Returns the cairn directory path and the repository root.
 */
export function findCairnDir(startDir: string): { cairnDir: string; repoRoot: string } {
  let currentDir = startDir;
  while (true) {
    const cairnPath = path.join(currentDir, '.cairn');
    const issuesPath = path.join(cairnPath, 'issues.jsonl');
    if (fs.existsSync(cairnPath) && fs.existsSync(issuesPath)) {
      return { cairnDir: cairnPath, repoRoot: currentDir };
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached root
      break;
    }
    currentDir = parentDir;
  }
  const fallbackCairn = path.join(startDir, '.cairn');
  return { cairnDir: fallbackCairn, repoRoot: startDir };
}

/**
 * Generates a unique ID for a new task that doesn't conflict with existing tasks.
 * Uses 's-' prefix with 8-character nanoid.
 */
export function generateId(tasks: { id: string }[]): string {
  const existingIds = new Set(tasks.map(t => t.id));
  let id;
  do {
    id = 's-' + nanoid(8);
  } while (existingIds.has(id));
  return id;
}

/**
 * Type guard to check if a value is a valid TaskStatus
 */
export function isValidTaskStatus(status: any): status is TaskStatus {
  return typeof status === 'string' && ['open', 'in_progress', 'closed'].includes(status);
}

/**
 * Type guard to check if a value is a valid Priority
 */
export function isValidPriority(priority: any): priority is Priority {
  return typeof priority === 'string' && ['low', 'medium', 'high', 'urgent'].includes(priority);
}

/**
 * Type guard to check if a value is a valid TaskType
 */
export function isValidTaskType(type: any): type is TaskType {
  return typeof type === 'string' && ['epic', 'feature', 'task', 'bug', 'chore', 'docs', 'refactor'].includes(type);
}

/**
 * Type guard to check if a value is a valid DependencyType
 */
export function isValidDependencyType(type: any): type is DependencyType {
  return typeof type === 'string' && ['blocked_by', 'blocks', 'related', 'parent-child', 'discovered-from'].includes(type);
}

/**
 * Validates if a string is a valid ISO date string
 */
export function isValidISODate(dateStr: any): boolean {
  if (typeof dateStr !== 'string') return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && dateStr === date.toISOString();
}

/**
 * Validates a Comment object
 */
export function isValidComment(comment: any): comment is Comment {
  return (
    typeof comment === 'object' &&
    comment !== null &&
    typeof comment.id === 'string' &&
    comment.id.length > 0 &&
    typeof comment.author === 'string' &&
    comment.author.length > 0 &&
    typeof comment.content === 'string' &&
    isValidISODate(comment.created_at)
  );
}

/**
 * Validates an AcceptanceCriteria object
 */
export function isValidAcceptanceCriteria(criteria: any): criteria is AcceptanceCriteria {
  return (
    typeof criteria === 'object' &&
    criteria !== null &&
    typeof criteria.text === 'string' &&
    typeof criteria.completed === 'boolean'
  );
}

/**
 * Validates a Dependency object
 */
export function isValidDependency(dep: any): dep is Dependency {
  return (
    typeof dep === 'object' &&
    dep !== null &&
    typeof dep.id === 'string' &&
    dep.id.length > 0 &&
    isValidDependencyType(dep.type)
  );
}

/**
 * Comprehensive validation for Task objects with detailed error reporting
 */
export function validateTask(task: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!task || typeof task !== 'object') {
    errors.push('Task must be a non-null object');
    return { isValid: false, errors };
  }

  if (typeof task.id !== 'string' || task.id.length === 0) {
    errors.push('Task id must be a non-empty string');
  }

  if (typeof task.title !== 'string' || task.title.length === 0) {
    errors.push('Task title must be a non-empty string');
  }

  if (!isValidTaskStatus(task.status)) {
    errors.push('Task status must be one of: open, in_progress, closed, blocked');
  }

  if (!isValidISODate(task.created_at)) {
    errors.push('Task created_at must be a valid ISO date string');
  }

  if (!isValidISODate(task.updated_at)) {
    errors.push('Task updated_at must be a valid ISO date string');
  }

  // Optional fields with validation
  if (task.description !== undefined && typeof task.description !== 'string') {
    errors.push('Task description must be a string if provided');
  }

  if (task.type !== undefined && !isValidTaskType(task.type)) {
    errors.push('Task type must be one of: epic, feature, task, bug, chore, docs, refactor');
  }

  if (task.priority !== undefined && !isValidPriority(task.priority)) {
    errors.push('Task priority must be one of: low, medium, high, urgent');
  }

  if (task.assignee !== undefined && typeof task.assignee !== 'string') {
    errors.push('Task assignee must be a string if provided');
  }

  if (task.labels !== undefined) {
    if (!Array.isArray(task.labels)) {
      errors.push('Task labels must be an array if provided');
    } else if (!task.labels.every((label: string) => typeof label === 'string')) {
      errors.push('All task labels must be strings');
    }
  }

  if (task.dependencies !== undefined) {
    if (!Array.isArray(task.dependencies)) {
      errors.push('Task dependencies must be an array if provided');
    } else {
      task.dependencies.forEach((dep: any, index: number) => {
        if (!isValidDependency(dep)) {
          errors.push(`Task dependency at index ${index} is invalid`);
        }
      });
    }
  }

  if (task.comments !== undefined) {
    if (!Array.isArray(task.comments)) {
      errors.push('Task comments must be an array if provided');
    } else {
      task.comments.forEach((comment: any, index: number) => {
        if (!isValidComment(comment)) {
          errors.push(`Task comment at index ${index} is invalid`);
        }
      });
    }
  }

  if (task.acceptance_criteria !== undefined) {
    if (!Array.isArray(task.acceptance_criteria)) {
      errors.push('Task acceptance_criteria must be an array if provided');
    } else {
      task.acceptance_criteria.forEach((criteria: any, index: number) => {
        if (!isValidAcceptanceCriteria(criteria)) {
          errors.push(`Task acceptance_criteria at index ${index} is invalid`);
        }
      });
    }
  }

  // Optional date fields
  if (task.closed_at !== undefined && !isValidISODate(task.closed_at)) {
    errors.push('Task closed_at must be a valid ISO date string if provided');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Sanitizes a file path to prevent directory traversal attacks
 */
export function sanitizeFilePath(filePath: string, allowedExtensions: string[] = []): string {
  if (typeof filePath !== 'string') {
    throw new Error('File path must be a string');
  }

  // Remove any path traversal attempts
  const sanitized = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');

  // Check for allowed extensions if specified
  if (allowedExtensions.length > 0) {
    const ext = path.extname(sanitized).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      throw new Error(`File extension '${ext}' is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`);
    }
  }

  return sanitized;
}

/**
 * Calculates the completion percentage for a task based on acceptance criteria and subtasks.
 * For tasks with subtasks: averages the completion of acceptance criteria and subtask completion percentages.
 * For leaf tasks: uses acceptance criteria completion, or status-based completion if no criteria.
 * Returns percentage as number (0-100).
 */
export function calculateCompletionPercentage(task: Task, allTasks: Task[], visited = new Set<string>()): number {
  // If task is closed, it's 100% complete regardless of acceptance criteria or subtasks
  if (task.status === 'closed') {
    return 100;
  }

  if (visited.has(task.id)) {
    // Cycle detected, return 0 to break recursion
    return 0;
  }
  visited.add(task.id);

  const subtasks = allTasks.filter(t => t.dependencies?.some(d => d.id === task.id && d.type === 'parent-child'));
  const hasSubtasks = subtasks.length > 0;

  // Calculate own completion
  const acCompleted = task.acceptance_criteria?.filter(ac => ac.completed).length || 0;
  const acTotal = task.acceptance_criteria?.length || 0;
  let ownCompletion: number;
  if (acTotal > 0) {
    ownCompletion = (acCompleted / acTotal) * 100;
  } else {
    ownCompletion = 0; // Only open/in_progress tasks reach here
  }

  // Calculate subtask completion
  if (hasSubtasks) {
    const subtaskCompletions = subtasks
      .map(st => calculateCompletionPercentage(st, allTasks, visited))
      .filter(cp => cp !== null);
    const completedSubtasks = subtaskCompletions.filter(cp => cp === 100).length;
    const totalUnits = acTotal + subtasks.length;
    const completedUnits = acCompleted + completedSubtasks;
    if (totalUnits > 0) {
      visited.delete(task.id);
      return Math.round((completedUnits / totalUnits) * 100);
    } else {
      visited.delete(task.id);
      return 0;
    }
  }

  visited.delete(task.id);
  return Math.round(ownCompletion);
}