import React, { useState, useEffect } from 'react';

interface Issue {
  id: string;
  title: string;
  description?: string;
  type?: string;
  status: string;
  priority?: string;
  completion_percentage?: number;
  dependencies?: Array<{
    id: string;
    type: string;
  }>;
  children: Issue[];
}

// TreeLinesSVG component for rendering relationship lines
interface TreeLinesSVGProps {
  taskTree: any[];
  allTasks: Issue[];
  expandedTasks: Set<string>;
  expandedDescriptions: Set<string>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const TreeLinesSVG: React.FC<TreeLinesSVGProps> = ({ taskTree, allTasks, expandedTasks, expandedDescriptions, containerRef }) => {
  const [lines, setLines] = useState<Array<{x1: number, y1: number, x2: number, y2: number}>>([]);

  useEffect(() => {
    const calculateLines = () => {
      if (!containerRef.current) return;

      const lines: Array<{x1: number, y1: number, x2: number, y2: number}> = [];
      const taskPositions = new Map<string, { centerY: number, level: number }>();

      // Calculate positions of all visible tasks
      const calculatePositions = (nodes: any[], level: number = 0) => {
        nodes.forEach((node) => {
          const element = document.querySelector(`[data-task-id="${node.id}"]`) as HTMLElement;
          if (element && containerRef.current) {
            // Use offsetTop for position relative to the scrollable container
            const centerY = element.offsetTop + element.offsetHeight / 2;
            taskPositions.set(node.id, { centerY, level });

            if (expandedTasks.has(node.id) && node.children) {
              calculatePositions(node.children, level + 1);
            }
          }
        });
      };

      calculatePositions(taskTree);

      // Build parent-child relationships
      const childrenMap = new Map<string, string[]>();
      allTasks.forEach(task => {
        if (task.dependencies) {
          task.dependencies.forEach(dep => {
            if (dep.type === 'parent-child') {
              if (!childrenMap.has(dep.id)) {
                childrenMap.set(dep.id, []);
              }
              childrenMap.get(dep.id)!.push(task.id);
            }
          });
        }
      });

      // Draw lines between connected tasks
      taskPositions.forEach((pos, taskId) => {
        const { centerY, level } = pos;
        const x = level * 30 + 8 + 17; // Caret center position

        // Draw connection to parent (horizontal line)
        if (level > 0) {
          const parentX = (level - 1) * 30 + 8 + 18;
          lines.push({
            x1: parentX,
            y1: centerY,
            x2: x - 8,
            y2: centerY
          });
        }

        // Draw vertical line to children if expanded
        if (expandedTasks.has(taskId)) {
          const children = childrenMap.get(taskId) || [];
          const visibleChildren = children.filter(childId => taskPositions.has(childId));

          if (visibleChildren.length > 0) {
            const firstChildId = visibleChildren[0];
            const lastChildId = visibleChildren[visibleChildren.length - 1];
            const lastChildPos = taskPositions.get(lastChildId)!;

            lines.push({
              x1: x,
              y1: centerY + 8,
              x2: x,
              y2: lastChildPos.centerY
            });
          }
        }
      });

      setLines(lines);
    };

    // Calculate lines after layout has stabilized
    const calculateLinesWithDelay = () => {
      // Use requestAnimationFrame to wait for layout to settle
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          calculateLines();
        });
      });
    };

    // Initial calculation
    calculateLinesWithDelay();

    // Recalculate on scroll
    const container = containerRef.current;
    if (container) {
      const handleScroll = () => {
        calculateLines();
      };
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [taskTree, allTasks, expandedTasks, expandedDescriptions, containerRef]);

  return (
    <svg
      className="tree-lines-svg"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
        overflow: 'visible'
      }}
    >
      {lines.map((line, index) => (
        <line
          key={index}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth="2"
          fill="none"
        />
      ))}
    </svg>
  );
};

export default TreeLinesSVG;