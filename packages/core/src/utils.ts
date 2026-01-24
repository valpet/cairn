import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { IssueStatus, Priority, IssueType, Dependency, DependencyType, Comment, AcceptanceCriteria, Issue } from './types';

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
 * Generates a unique ID for a new issue that doesn't conflict with existing issues.
 * Uses 's-' prefix with 8-character nanoid.
 */
export function generateId(issues: { id: string }[]): string {
  const existingIds = new Set(issues.map(i => i.id));
  let id;
  do {
    id = 's-' + nanoid(8);
  } while (existingIds.has(id));
  return id;
}

/**
 * Type guard to check if a value is a valid IssueStatus
 */
export function isValidIssueStatus(status: any): status is IssueStatus {
  return typeof status === 'string' && ['open', 'in_progress', 'closed'].includes(status);
}

/**
 * Type guard to check if a value is a valid Priority
 */
export function isValidPriority(priority: any): priority is Priority {
  return typeof priority === 'string' && ['low', 'medium', 'high', 'urgent'].includes(priority);
}

/**
 * Type guard to check if a value is a valid IssueType
 */
export function isValidIssueType(type: any): type is IssueType {
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
 * Comprehensive validation for Issue objects with detailed error reporting
 */
export function validateIssue(issue: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!issue || typeof issue !== 'object') {
    errors.push('Issue must be a non-null object');
    return { isValid: false, errors };
  }

  if (typeof issue.id !== 'string' || issue.id.length === 0) {
    errors.push('Issue id must be a non-empty string');
  }

  if (typeof issue.title !== 'string' || issue.title.length === 0) {
    errors.push('Issue title must be a non-empty string');
  }

  if (!isValidIssueStatus(issue.status)) {
    errors.push('Issue status must be one of: open, in_progress, closed, blocked');
  }

  if (!isValidISODate(issue.created_at)) {
    errors.push('Issue created_at must be a valid ISO date string');
  }

  if (!isValidISODate(issue.updated_at)) {
    errors.push('Issue updated_at must be a valid ISO date string');
  }

  // Optional fields with validation
  if (issue.description !== undefined && typeof issue.description !== 'string') {
    errors.push('Issue description must be a string if provided');
  }

  if (issue.type !== undefined && !isValidIssueType(issue.type)) {
    errors.push('Issue type must be one of: epic, feature, task, bug, chore, docs, refactor');
  }

  if (issue.priority !== undefined && !isValidPriority(issue.priority)) {
    errors.push('Issue priority must be one of: low, medium, high, urgent');
  }

  if (issue.assignee !== undefined && typeof issue.assignee !== 'string') {
    errors.push('Issue assignee must be a string if provided');
  }

  if (issue.labels !== undefined) {
    if (!Array.isArray(issue.labels)) {
      errors.push('Issue labels must be an array if provided');
    } else if (!issue.labels.every((label: string) => typeof label === 'string')) {
      errors.push('All issue labels must be strings');
    }
  }

  if (issue.dependencies !== undefined) {
    if (!Array.isArray(issue.dependencies)) {
      errors.push('Issue dependencies must be an array if provided');
    } else {
      issue.dependencies.forEach((dep: any, index: number) => {
        if (!isValidDependency(dep)) {
          errors.push(`Issue dependency at index ${index} is invalid`);
        }
      });
    }
  }

  if (issue.comments !== undefined) {
    if (!Array.isArray(issue.comments)) {
      errors.push('Issue comments must be an array if provided');
    } else {
      issue.comments.forEach((comment: any, index: number) => {
        if (!isValidComment(comment)) {
          errors.push(`Issue comment at index ${index} is invalid`);
        }
      });
    }
  }

  if (issue.acceptance_criteria !== undefined) {
    if (!Array.isArray(issue.acceptance_criteria)) {
      errors.push('Issue acceptance_criteria must be an array if provided');
    } else {
      issue.acceptance_criteria.forEach((criteria: any, index: number) => {
        if (!isValidAcceptanceCriteria(criteria)) {
          errors.push(`Issue acceptance_criteria at index ${index} is invalid`);
        }
      });
    }
  }

  // Optional date fields
  if (issue.closed_at !== undefined && !isValidISODate(issue.closed_at)) {
    errors.push('Issue closed_at must be a valid ISO date string if provided');
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
 * Calculates the completion percentage for an issue based on acceptance criteria and subtasks.
 * For issues with subtasks: averages the completion of acceptance criteria and subtask completion percentages.
 * For leaf issues: uses acceptance criteria completion, or status-based completion if no criteria.
 * Returns percentage as number (0-100).
 */
export function calculateCompletionPercentage(issue: Issue, allIssues: Issue[], visited = new Set<string>()): number {
  // If issue is closed, it's 100% complete regardless of acceptance criteria or subtasks
  if (issue.status === 'closed') {
    return 100;
  }

  if (visited.has(issue.id)) {
    // Cycle detected, return 0 to break recursion
    return 0;
  }
  visited.add(issue.id);

  const subtasks = allIssues.filter(i => i.dependencies?.some(d => d.id === issue.id && d.type === 'parent-child'));
  const hasSubtasks = subtasks.length > 0;

  // Calculate own completion
  const acCompleted = issue.acceptance_criteria?.filter(ac => ac.completed).length || 0;
  const acTotal = issue.acceptance_criteria?.length || 0;
  let ownCompletion: number;
  if (acTotal > 0) {
    ownCompletion = (acCompleted / acTotal) * 100;
  } else {
    ownCompletion = 0; // Only open/in_progress issues reach here
  }

  // Calculate subtask completion average
  if (hasSubtasks) {
    const subtaskCompletions = subtasks
      .map(st => calculateCompletionPercentage(st, allIssues, visited))
      .filter(cp => cp !== null);
    if (subtaskCompletions.length > 0) {
      const avgSubtaskCompletion = subtaskCompletions.reduce((sum, cp) => sum + cp, 0) / subtaskCompletions.length;
      const average = (ownCompletion + avgSubtaskCompletion) / 2;
      visited.delete(issue.id);
      return Math.round(average);
    }
  }

  visited.delete(issue.id);
  return Math.round(ownCompletion);
}