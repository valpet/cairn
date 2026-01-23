import { useMemo } from 'react';
import { Issue } from '../types';

export const useTaskHierarchy = (filteredTasks: Issue[]) => {
  const taskTree = useMemo(() => {
    const taskMap = new Map<string, Issue & { children: Issue[] }>();
    const roots: (Issue & { children: Issue[] })[] = [];
    const hasParent = new Set<string>();

    filteredTasks.forEach(task => {
      taskMap.set(task.id, { ...task, children: [] });
    });

    // Function to check if adding parent would create a cycle
    const wouldCreateCycle = (childId: string, parentId: string): boolean => {
      const visited = new Set<string>();
      const stack = [parentId];
      
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);
        
        if (current === childId) return true;
        
        const currentTask = taskMap.get(current);
        if (currentTask) {
          // Check parent-child dependencies
          for (const dep of currentTask.dependencies || []) {
            if (dep.type === 'parent-child') {
              stack.push(dep.id);
            }
          }
        }
      }
      return false;
    };

    filteredTasks.forEach(task => {
      const node = taskMap.get(task.id)!;

      // Check for parent-child relationship
      const parentDep = (task.dependencies || []).find(dep => dep.type === 'parent-child');
      if (parentDep && !wouldCreateCycle(task.id, parentDep.id)) {
        const parent = taskMap.get(parentDep.id);
        if (parent) {
          parent.children.push(node);
          hasParent.add(task.id);
        }
      }

      // Check for blocks relationship (task is blocked by another task)
      const blocksDep = (task.dependencies || []).find(dep => dep.type === 'blocks');
      if (blocksDep && !parentDep && !wouldCreateCycle(task.id, blocksDep.id)) { // Only if not already a child via parent-child
        const blocker = taskMap.get(blocksDep.id);
        if (blocker) {
          blocker.children.push(node);
          hasParent.add(task.id);
        }
      }
    });

    // Add all tasks without parents to roots
    filteredTasks.forEach(task => {
      if (!hasParent.has(task.id)) {
        const node = taskMap.get(task.id);
        if (node) {
          roots.push(node);
        }
      }
    });

    return roots;
  }, [filteredTasks]);

  return { taskTree };
};