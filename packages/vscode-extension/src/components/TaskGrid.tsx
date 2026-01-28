import React, { useRef, useState, useEffect } from 'react';
import TreeLinesSVG from './TreeLinesSVG';
import TaskRow from './TaskRow';

interface Task {
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
  children: Task[];
}

interface TaskGridProps {
  taskTree: any[];
  allTasks: Task[];
  expandedTasks: Set<string>;
  expandedDescriptions: Set<string>;
  activeActionDropdown: string | null;
  deleteConfirmPopup: string | null;
  onToggleExpand: (taskId: string) => void;
  onToggleDescription: (taskId: string) => void;
  onStartTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onEditTask: (taskId: string) => void;
  onCreateNewTask: () => void;
  onToggleActionDropdown: (taskId: string) => void;
  onShowDeleteConfirmation: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

const TaskGrid: React.FC<TaskGridProps> = ({
  taskTree,
  allTasks,
  expandedTasks,
  expandedDescriptions,
  activeActionDropdown,
  deleteConfirmPopup,
  onToggleExpand,
  onToggleDescription,
  onStartTask,
  onCompleteTask,
  onEditTask,
  onCreateNewTask,
  onToggleActionDropdown,
  onShowDeleteConfirmation,
  onDeleteTask
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number>(200);

  // Update scrollable container height
  useEffect(() => {
    const updateHeight = () => {
      requestAnimationFrame(() => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const availableHeight = window.innerHeight - rect.top;
        const newHeight = Math.max(availableHeight, 200);
        
        setContainerHeight(newHeight);
      });
    };

    // Update on mount and when tasks change
    updateHeight();

    // Update on window resize
    window.addEventListener('resize', updateHeight);

    // Use ResizeObserver for layout changes
    const resizeObserver = new ResizeObserver(updateHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    resizeObserver.observe(document.body);

    return () => {
      window.removeEventListener('resize', updateHeight);
      resizeObserver.disconnect();
    };
  }, [taskTree]);

  return (
    <>
      {/* Header table (fixed) */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        backgroundColor: 'var(--vscode-editor-background)',
        border: '1px solid var(--vscode-panel-border)',
        borderBottom: 'none',
        borderRadius: '4px 4px 0 0'
      }}>
        <colgroup>
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th colSpan={8} style={{
              backgroundColor: 'var(--vscode-editor-background)',
              color: 'var(--vscode-foreground)',
              padding: '12px 16px',
              textAlign: 'left',
              fontWeight: 600,
              borderBottom: '1px solid var(--vscode-panel-border)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span>
                  <span style={{ fontWeight: 600 }}>Title</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                  <button
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--vscode-foreground)',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '6px 12px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      fontWeight: 400,
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                  >
                    Expand All
                  </button>
                  <button
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--vscode-foreground)',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '6px 12px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      fontWeight: 400,
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                  >
                    Collapse All
                  </button>
                  <button
                    style={{
                      backgroundColor: 'var(--vscode-button-background)',
                      color: 'var(--vscode-button-foreground)',
                      border: 'none',
                      padding: '6px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 500,
                      fontSize: '13px'
                    }}
                    onClick={onCreateNewTask}
                  >
                    Create New Task
                  </button>
                </div>
              </div>
            </th>
          </tr>
        </thead>
      </table>

      {/* Scrollable body container */}
      <div
        ref={containerRef}
        className="task-body-container"
        style={{
          overflowY: 'auto',
          border: '1px solid var(--vscode-panel-border)',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px',
          position: 'relative',
          height: `${containerHeight}px`,
          maxHeight: `${containerHeight}px`
        }}
      >
        {/* Tree lines SVG overlay */}
        <TreeLinesSVG
          taskTree={taskTree}
          allTasks={allTasks}
          expandedTasks={expandedTasks}
          expandedDescriptions={expandedDescriptions}
          containerRef={containerRef}
        />

        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: 'var(--vscode-editor-background)'
        }}>
          <colgroup>
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <tbody>
            {/* Task rows will be rendered here */}
            {taskTree.map((node, index) => (
              <TaskRow
                key={node.id}
                task={node}
                level={0}
                allTasks={allTasks}
                expandedTasks={expandedTasks}
                expandedDescriptions={expandedDescriptions}
                activeActionDropdown={activeActionDropdown}
                deleteConfirmPopup={deleteConfirmPopup}
                onToggleExpand={onToggleExpand}
                onToggleDescription={onToggleDescription}
                onStartTask={onStartTask}
                onCompleteTask={onCompleteTask}
                onEditTask={onEditTask}
                onToggleActionDropdown={onToggleActionDropdown}
                onShowDeleteConfirmation={onShowDeleteConfirmation}
                onDeleteTask={onDeleteTask}
                isLastChild={index === taskTree.length - 1}
                ancestorLines={[]}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default TaskGrid;