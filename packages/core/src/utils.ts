import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';

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
      const fallbackCairn = path.join(startDir, '.cairn');
      return { cairnDir: fallbackCairn, repoRoot: startDir };
    }
    currentDir = parentDir;
  }
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