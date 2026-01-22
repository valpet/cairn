import React, { useEffect, useState, useRef } from 'react';
import './IssueList.css';

// VS Code API declaration
declare const acquireVsCodeApi: () => any;

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

interface IssueListProps {
  // Props will be added as needed
}

const IssueList: React.FC<IssueListProps> = () => {
  const [allTasks, setAllTasks] = useState<Issue[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(['ready', 'open', 'in_progress']));
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [activeActionDropdown, setActiveActionDropdown] = useState<string | null>(null);
  const [deleteConfirmPopup, setDeleteConfirmPopup] = useState<string | null>(null);

  const vscode = useRef<any>(null);

  useEffect(() => {
    // Acquire VS Code API once at the beginning
    vscode.current = acquireVsCodeApi();
    console.log('Cairn issues webview script loaded');

    // Notify extension that webview is ready
    vscode.current.postMessage({ type: 'webviewReady' });
    console.log('Task list webview ready message sent');

    // Listen for messages from extension
    const messageHandler = (event: MessageEvent) => {
      console.log('Message received:', event.data);
      const message = event.data;
      if (message.type === 'updateTasks') {
        console.log('Processing updateTasks');
        setAllTasks(message.tasks || []);
        console.log('Tasks count:', message.tasks?.length || 0);
      }
    };

    window.addEventListener('message', messageHandler);

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  // Utility functions for creating components
  const createTypeBadge = (type?: string) => {
    const badgeClass = `type-badge ${type || 'task'}`;
    const badgeText = type || 'Task';
    return { className: badgeClass, text: badgeText };
  };

  const createStatusPill = (status?: string, displayText?: string) => {
    const displayStatus = status || 'open';
    const text = displayText || (displayStatus === 'in_progress' ? 'In Progress' :
      (displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)));
    const pillClass = `pill status-${displayStatus}`;
    return { className: pillClass, text };
  };

  const createPriorityPill = (priority?: string) => {
    const displayPriority = priority || 'medium';
    const pillClass = `pill priority-${displayPriority}`;
    const text = displayPriority.charAt(0).toUpperCase() + displayPriority.slice(1);
    return { className: pillClass, text };
  };

  // Function to check if a task is ready (no blocking dependencies)
  const isReady = (task: Issue, allTasks: Issue[]) => {
    if (!task.dependencies) return true;
    const taskMap = new Map(allTasks.map(t => [t.id, t]));
    return task.dependencies.every(dep => {
      if (dep.type !== 'blocks') return true;
      const depTask = taskMap.get(dep.id);
      return depTask && depTask.status === 'closed';
    });
  };

  // Function to check if a task is blocked
  const isBlocked = (task: Issue, allTasks: Issue[]) => {
    if (!task.dependencies || task.status === 'closed') return false;
    const taskMap = new Map(allTasks.map(t => [t.id, t]));
    return task.dependencies.some(dep => {
      if (dep.type !== 'blocks') return false;
      const depTask = taskMap.get(dep.id);
      return depTask && depTask.status !== 'closed';
    });
  };

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const toggleDescription = (taskId: string) => {
    setExpandedDescriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  // Get icon for status
  const getStatusIcon = (status: string) => {
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
  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      'ready': 'Ready',
      'open': 'Open',
      'in_progress': 'In Progress',
      'closed': 'Closed',
      'blocked': 'Blocked'
    };
    return labels[status] || status;
  };

  // Toggle status filter
  const toggleStatusFilter = (status: string) => {
    setSelectedStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  // Remove specific status filter
  const removeStatusFilter = (status: string) => {
    setSelectedStatuses(prev => {
      const newSet = new Set(prev);
      newSet.delete(status);
      return newSet;
    });
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedStatuses(new Set());
  };

  // Toggle popover
  const togglePopover = () => {
    setIsPopoverOpen(!isPopoverOpen);
  };

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const trigger = document.getElementById('status-filter-trigger');
      const popover = document.getElementById('status-popover');

      if (!trigger?.contains(target) && isPopoverOpen) {
        setIsPopoverOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isPopoverOpen]);

  // Close action dropdown and delete popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if click is outside action dropdown
      if (activeActionDropdown) {
        const dropdown = target.closest('.action-dropdown');
        const kebabBtn = target.closest('.kebab-menu-btn');
        if (!dropdown && !kebabBtn) {
          setActiveActionDropdown(null);
        }
      }

      // Check if click is outside delete confirmation popup
      if (deleteConfirmPopup) {
        const popup = target.closest('.delete-confirm-popup');
        if (!popup) {
          setDeleteConfirmPopup(null);
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeActionDropdown, deleteConfirmPopup]);

  // Close dropdowns on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteConfirmPopup) {
          setDeleteConfirmPopup(null);
        } else if (activeActionDropdown) {
          setActiveActionDropdown(null);
        } else if (isPopoverOpen) {
          setIsPopoverOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeActionDropdown, deleteConfirmPopup, isPopoverOpen]);

  // Task interaction functions
  const startTask = (id: string) => {
    console.log('Starting task', id);
    vscode.current?.postMessage({ type: 'startTask', id });
  };

  const completeTask = (id: string) => {
    console.log('Completing task', id);
    vscode.current?.postMessage({ type: 'completeTask', id });
  };

  const editTask = (id: string) => {
    console.log('Editing task', id);
    console.log('vscode object:', vscode.current);
    console.log('typeof vscode.postMessage:', typeof vscode.current?.postMessage);
    try {
      const message = { type: 'editTicket', id };
      console.log('Attempting to post message:', message);
      vscode.current?.postMessage(message);
      console.log('Message posted successfully');
    } catch (error) {
      console.error('Error posting message:', error);
    }
  };

  const createNewTask = () => {
    console.log('Creating new task');
    try {
      const message = { type: 'createTicket' };
      console.log('Attempting to post message:', message);
      vscode.current?.postMessage(message);
      console.log('Message posted successfully');
    } catch (error) {
      console.error('Error posting message:', error);
    }
  };

  const deleteTask = (id: string) => {
    console.log('Deleting task', id);
    vscode.current?.postMessage({ type: 'deleteTask', id });
    setDeleteConfirmPopup(null);
  };

  const toggleActionDropdown = (taskId: string) => {
    if (activeActionDropdown === taskId) {
      setActiveActionDropdown(null);
    } else {
      setActiveActionDropdown(taskId);
    }
  };

  const showDeleteConfirmation = (taskId: string) => {
    setDeleteConfirmPopup(taskId);
    setActiveActionDropdown(null);
  };

  // Filter tasks based on selected statuses
  const getFilteredTasks = () => {
    if (selectedStatuses.size === 0) {
      return allTasks;
    }
    const statusArray = Array.from(selectedStatuses);
    return allTasks.filter(task =>
      statusArray.includes(task.status) ||
      (statusArray.includes('ready') && task.status === 'open' && isReady(task, allTasks))
    );
  };

  // Build task hierarchy
  const buildTaskTree = (tasks: Issue[]) => {
    const taskMap = new Map<string, Issue & { children: Issue[] }>();
    const roots: (Issue & { children: Issue[] })[] = [];
    const hasParent = new Set<string>();

    tasks.forEach(task => {
      taskMap.set(task.id, { ...task, children: [] });
    });

    tasks.forEach(task => {
      const node = taskMap.get(task.id)!;

      // Check for parent-child relationship
      const parentDep = (task.dependencies || []).find(dep => dep.type === 'parent-child');
      if (parentDep) {
        const parent = taskMap.get(parentDep.id);
        if (parent) {
          parent.children.push(node);
          hasParent.add(task.id);
        }
      }

      // Check for blocks relationship (task is blocked by another task)
      const blocksDep = (task.dependencies || []).find(dep => dep.type === 'blocks');
      if (blocksDep && !parentDep) { // Only if not already a child via parent-child
        const blocker = taskMap.get(blocksDep.id);
        if (blocker) {
          blocker.children.push(node);
          hasParent.add(task.id);
        }
      }
    });

    // Add all tasks without parents to roots
    tasks.forEach(task => {
      if (!hasParent.has(task.id)) {
        const node = taskMap.get(task.id);
        if (node) {
          roots.push(node);
        }
      }
    });

    return roots;
  };

  const filteredTasks = getFilteredTasks();
  const taskTree = buildTaskTree(filteredTasks);

  return (
    <div style={{
      fontFamily: 'var(--vscode-font-family)',
      fontSize: 'var(--vscode-font-size)',
      backgroundColor: 'var(--vscode-sideBar-background)',
      color: 'var(--vscode-foreground)',
      margin: 0,
      padding: '20px',
      paddingBottom: 0,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ color: '#D4A556', fontSize: '24px', margin: 0 }}>Cairn Issues</h1>
      </div>

      {/* Filter Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px',
        padding: '8px 0',
        fontSize: '13px'
      }}>
        <div style={{ position: 'relative' }}>
          <button
            id="status-filter-trigger"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              border: 'none',
              borderRadius: '6px',
              color: 'var(--vscode-foreground)',
              cursor: 'pointer',
              fontSize: '13px',
              position: 'relative',
              transition: 'all 0.15s',
              backgroundColor: selectedStatuses.size > 0 ? 'rgba(255, 255, 255, 0.05)' : 'transparent'
            }}
            onClick={togglePopover}
          >
            <span style={{
              opacity: 0.5,
              fontSize: '16px',
              marginRight: '2px',
              display: 'inline-flex',
              alignItems: 'center'
            }}>
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                <path d="M19 3H5C3.58579 3 2.87868 3 2.43934 3.4122C2 3.8244 2 4.48782 2 5.81466V6.50448C2 7.54232 2 8.06124 2.2596 8.49142C2.5192 8.9216 2.99347 9.18858 3.94202 9.72255L6.85504 11.3624C7.49146 11.7206 7.80967 11.8998 8.03751 12.0976C8.51199 12.5095 8.80408 12.9935 8.93644 13.5872C9 13.8722 9 14.2058 9 14.8729L9 17.5424C9 18.452 9 18.9067 9.25192 19.2613C9.50385 19.6158 9.95128 19.7907 10.8462 20.1406C12.7248 20.875 13.6641 21.2422 14.3321 20.8244C15 20.4066 15 19.4519 15 17.5424V14.8729C15 14.2058 15 13.8722 15.0636 13.5872C15.1959 12.9935 15.488 12.5095 15.9625 12.0976C16.1903 11.8998 16.5085 11.7206 17.145 11.3624L20.058 9.72255C21.0065 9.18858 21.4808 8.9216 21.7404 8.49142C22 8.06124 22 7.54232 22 6.50448V5.81466C22 4.48782 22 3.8244 21.5607 3.4122C21.1213 3 20.4142 3 19 3Z" fill="currentColor"></path>
              </svg>
            </span>
            <span style={{ fontWeight: 500, opacity: 0.9 }}>Status:</span>
            <span style={{ opacity: 0.5, fontSize: '10px', marginLeft: '2px' }}>▼</span>
          </button>

          {/* Status Popover */}
          <div
            id="status-popover"
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              minWidth: '180px',
              backgroundColor: 'var(--vscode-dropdown-background)',
              border: '1px solid var(--vscode-dropdown-border)',
              borderRadius: '4px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              zIndex: 1000,
              padding: '6px 0',
              display: isPopoverOpen ? 'block' : 'none'
            }}
          >
            <div style={{
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              opacity: 0.6,
              letterSpacing: '0.5px'
            }}>Status</div>

            {['ready', 'open', 'in_progress', 'closed', 'blocked'].map(status => (
              <div
                key={status}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'background-color 0.1s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div
                  onClick={() => toggleStatusFilter(status)}
                  style={{
                    width: '14px',
                    height: '14px',
                    border: '1.5px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                    backgroundColor: selectedStatuses.has(status) ? 'var(--vscode-button-background)' : 'transparent',
                    borderColor: selectedStatuses.has(status) ? 'var(--vscode-button-background)' : 'var(--vscode-input-border)'
                  }}>
                  {selectedStatuses.has(status) && (
                    <span style={{
                      color: 'var(--vscode-button-foreground)',
                      fontSize: '10px',
                      fontWeight: 'bold'
                    }}>✓</span>
                  )}
                </div>
                <span onClick={() => toggleStatusFilter(status)}>{getStatusLabel(status)}</span>
              </div>
            ))}

            <div style={{
              height: '1px',
              backgroundColor: 'var(--vscode-dropdown-border)',
              margin: '4px 0'
            }}></div>

            <div
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                opacity: 0.8,
                transition: 'all 0.1s'
              }}
              onClick={clearAllFilters}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.opacity = '0.8';
              }}
            >
              Clear
            </div>
          </div>
        </div>

        {/* Filter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {Array.from(selectedStatuses).map(status => (
            <div
              key={status}
              className={`filter-chip ${status}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'default',
                transition: 'all 0.15s'
              }}
            >
              <span style={{ fontSize: '14px', lineHeight: 1 }}>{getStatusIcon(status)}</span>
              <span>{getStatusLabel(status)}</span>
              <span
                style={{
                  cursor: 'pointer',
                  opacity: 0.7,
                  fontSize: '16px',
                  lineHeight: 1,
                  padding: '0 0 0 4px',
                  transition: 'opacity 0.15s'
                }}
                onClick={() => removeStatusFilter(status)}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
              >✕</span>
            </div>
          ))}
        </div>

        {selectedStatuses.size > 0 && (
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '5px 10px',
              background: 'transparent',
              border: 'none',
              color: 'var(--vscode-foreground)',
              cursor: 'pointer',
              fontSize: '12px',
              opacity: 0.6,
              transition: 'opacity 0.15s',
              textDecoration: 'underline'
            }}
            onClick={clearAllFilters}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
          >
            Clear filters
          </button>
        )}

        <button
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 10px',
            background: 'transparent',
            border: 'none',
            borderRadius: '4px',
            color: '#58a6ff',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(88, 166, 255, 0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
          <span>Add Filter</span>
        </button>
      </div>

      {/* Task Container - This will be populated with the task grid */}
      <div id="task-container" style={{ overflow: 'hidden' }}>
        {/* Task grid will be rendered here */}
        <TaskGrid
          taskTree={taskTree}
          allTasks={allTasks}
          expandedTasks={expandedTasks}
          expandedDescriptions={expandedDescriptions}
          activeActionDropdown={activeActionDropdown}
          deleteConfirmPopup={deleteConfirmPopup}
          onToggleExpand={toggleExpand}
          onToggleDescription={toggleDescription}
          onStartTask={startTask}
          onCompleteTask={completeTask}
          onEditTask={editTask}
          onCreateNewTask={createNewTask}
          onToggleActionDropdown={toggleActionDropdown}
          onShowDeleteConfirmation={showDeleteConfirmation}
          onDeleteTask={deleteTask}
        />
      </div>
    </div>
  );
};

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
            const firstChildPos = taskPositions.get(firstChildId)!;
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

// TaskGrid component to handle the table rendering
interface TaskGridProps {
  taskTree: any[];
  allTasks: Issue[];
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
          <col style={{ width: '80px' }} />
          <col style={{ width: '120px' }} />
          <col style={{ width: '100px' }} />
          <col style={{ width: '120px' }} />
          <col style={{ width: '140px' }} />
        </colgroup>
        <thead>
          <tr>
            <th colSpan={7} style={{
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
                    Create New Issue
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
            <col style={{ width: '80px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '140px' }} />
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

// TaskRow component for individual task rows
interface TaskRowProps {
  task: Issue & { children: Issue[] };
  level: number;
  allTasks: Issue[];
  expandedTasks: Set<string>;
  expandedDescriptions: Set<string>;
  activeActionDropdown: string | null;
  deleteConfirmPopup: string | null;
  onToggleExpand: (taskId: string) => void;
  onToggleDescription: (taskId: string) => void;
  onStartTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onEditTask: (taskId: string) => void;
  onToggleActionDropdown: (taskId: string) => void;
  onShowDeleteConfirmation: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  isLastChild: boolean;
  ancestorLines: boolean[];
}

const TaskRow: React.FC<TaskRowProps> = ({
  task,
  level,
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
  onToggleActionDropdown,
  onShowDeleteConfirmation,
  onDeleteTask,
  isLastChild,
  ancestorLines
}) => {
  const hasChildren = task.children && task.children.length > 0;
  const isExpanded = expandedTasks.has(task.id);

  // Simple markdown to HTML converter
  const markdownToHtml = (markdown: string) => {
    let html = markdown;

    // Code blocks (before inline code)
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Unordered lists
    html = html.replace(/^- (.+)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Paragraphs (split by double newlines)
    const parts = html.split('\n\n');
    html = parts.map(part => {
      part = part.trim();
      if (!part) return '';
      if (part.startsWith('<h') || part.startsWith('<ul') || part.startsWith('<pre')) {
        return part;
      }
      return '<p>' + part.replace(/\n/g, '<br>') + '</p>';
    }).join('\n');

    return html;
  };

  // Check if task is blocked
  const isBlockedCheck = (task: Issue, allTasks: Issue[]) => {
    if (!task.dependencies || task.status === 'closed') return false;
    const taskMap = new Map(allTasks.map(t => [t.id, t]));
    return task.dependencies.some(dep => {
      if (dep.type !== 'blocks') return false;
      const depTask = taskMap.get(dep.id);
      return depTask && depTask.status !== 'closed';
    });
  };

  const taskIsBlocked = isBlockedCheck(task, allTasks);
  const displayStatus = taskIsBlocked ? 'blocked' : task.status;
  const displayText = taskIsBlocked ? 'Blocked' :
    (task.status === 'in_progress' ? 'In Progress' :
      (task.status.charAt(0).toUpperCase() + task.status.slice(1)));

  return (
    <>
      <tr className="task-row" style={level > 0 ? { backgroundColor: 'var(--vscode-editor-background)' } : {}} data-task-id={task.id}>
        {/* Title cell */}
        <td style={{ padding: '12px 16px', verticalAlign: 'top', position: 'relative' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            paddingLeft: `${level * 30}px`,
            position: 'relative',
            zIndex: 2
          }}>
            <span
              className={hasChildren ? (isExpanded ? 'expand-icon expanded' : 'expand-icon collapsed') : 'expand-icon empty'}
              onClick={hasChildren ? () => onToggleExpand(task.id) : undefined}
              style={{
                cursor: hasChildren ? 'pointer' : 'default',
                width: '16px',
                height: '16px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--vscode-foreground)',
                opacity: 0.7,
                flexShrink: 0,
                marginLeft: '1px'
              }}
              onMouseEnter={(e) => hasChildren && (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => hasChildren && (e.currentTarget.style.opacity = '0.7')}
            >
              {hasChildren && (isExpanded ? '▼' : '▶')}
            </span>

            <span className={`type-badge ${task.type || 'task'}`}>
              {task.type || 'Task'}
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
                  {task.id}
                </span>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '2px',
                    opacity: 0.6,
                    transition: 'opacity 0.15s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onClick={() => navigator.clipboard.writeText(task.id)}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                >
                  <svg width="12" height="12" fill="var(--vscode-editor-foreground)" viewBox="0 0 36 36">
                    <path d="M22.6,4H21.55a3.89,3.89,0,0,0-7.31,0H13.4A2.41,2.41,0,0,0,11,6.4V10H25V6.4A2.41,2.41,0,0,0,22.6,4ZM23,8H13V6.25A.25.25,0,0,1,13.25,6h2.69l.12-1.11A1.24,1.24,0,0,1,16.61,4a2,2,0,0,1,3.15,1.18l.09.84h2.9a.25.25,0,0,1,.25.25Z"/>
                    <path d="M33.25,18.06H21.33l2.84-2.83a1,1,0,1,0-1.42-1.42L17.5,19.06l5.25,5.25a1,1,0,0,0,.71.29,1,1,0,0,0,.71-1.7l-2.84-2.84H33.25a1,1,0,0,0,0-2Z"/>
                    <path d="M29,16h2V6.68A1.66,1.66,0,0,0,29.35,5H27.08V7H29Z"/>
                    <path d="M29,31H7V7H9V5H6.64A1.66,1.66,0,0,0,5,6.67V31.32A1.66,1.66,0,0,0,6.65,33H29.36A1.66,1.66,0,0,0,31,31.33V22.06H29Z"/>
                  </svg>
                </button>
              </div>
              <span
                style={{
                  color: 'var(--vscode-editor-foreground)',
                  cursor: 'pointer'
                }}
                onClick={() => onEditTask(task.id)}
              >
                {task.title}
              </span>
            </div>
          </div>
        </td>

        {/* Description cell */}
        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
          <div style={{ maxWidth: '400px', position: 'relative' }}>
            {task.description && task.description.trim() ? (
              <div
                className={`description-content ${expandedDescriptions.has(task.id) ? 'expanded' : 'collapsed'}`}
                onClick={() => onToggleDescription(task.id)}
                style={{ cursor: 'pointer' }}
                dangerouslySetInnerHTML={{
                  __html: expandedDescriptions.has(task.id)
                    ? markdownToHtml(task.description)
                    : task.description
                }}
              />
            ) : (
              <div style={{ opacity: 0.4, fontStyle: 'italic', fontSize: '12px' }}>
                No description
              </div>
            )}
          </div>
        </td>

        {/* Completion cell */}
        <td style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'top' }}>
          <span style={{
            fontSize: '13px',
            color: 'var(--vscode-foreground)',
            fontWeight: 500
          }}>
            {task.completion_percentage !== undefined ? `${task.completion_percentage}%` : '—'}
          </span>
        </td>

        {/* Status cell */}
        <td style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'top' }}>
          <span className={`pill status-${displayStatus}`}>
            {displayText}
          </span>
        </td>

        {/* Priority cell */}
        <td style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'top' }}>
          <span className={`pill priority-${task.priority || 'medium'}`}>
            {(task.priority || 'medium').charAt(0).toUpperCase() + (task.priority || 'medium').slice(1)}
          </span>
        </td>

        {/* Dependencies cell */}
        <td style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'top' }}>
          {(() => {
            const blockers = (task.dependencies || []).filter(d => d.type === 'blocks').length;
            const blockedBy = allTasks.filter(t => t.dependencies?.some(d => d.id === task.id && d.type === 'blocks')).length;
            if (blockers > 0 || blockedBy > 0) {
              const depText = [];
              if (blockers > 0) depText.push(`${blockers}←`);
              if (blockedBy > 0) depText.push(`${blockedBy}→`);
              return (
                <span style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
                  {depText.join(' ')}
                </span>
              );
            }
            return null;
          })()}
        </td>

        {/* Actions cell */}
        <td className="task-actions" style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
          <button
            className={`kebab-menu-btn ${activeActionDropdown === task.id ? 'active' : ''}`}
            title="Actions"
            onClick={(e) => {
              e.stopPropagation();
              onToggleActionDropdown(task.id);
            }}
          >
            <div className="kebab-icon">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </button>

          {/* Action Dropdown */}
          {activeActionDropdown === task.id && (
            <div className="action-dropdown visible">
              {/* Edit action */}
              <div
                className="action-dropdown-item"
                onClick={() => {
                  onToggleActionDropdown(task.id);
                  onEditTask(task.id);
                }}
              >
                <div className="action-dropdown-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 4H7.2C6.0799 4 5.51984 4 5.09202 4.21799C4.71569 4.40974 4.40973 4.7157 4.21799 5.09202C4 5.51985 4 6.0799 4 7.2V16.8C4 17.9201 4 18.4802 4.21799 18.908C4.40973 19.2843 4.71569 19.5903 5.09202 19.782C5.51984 20 6.0799 20 7.2 20H16.8C17.9201 20 18.4802 20 18.908 19.782C19.2843 19.5903 19.5903 19.2843 19.782 18.908C20 18.4802 20 17.9201 20 16.8V12.5M15.5 5.5L18.3284 8.32843M10.7627 10.2373L17.411 3.58902C18.192 2.80797 19.4584 2.80797 20.2394 3.58902C21.0205 4.37007 21.0205 5.6364 20.2394 6.41745L13.3774 13.2794C12.6158 14.0411 12.235 14.4219 11.8012 14.7247C11.4162 14.9936 11.0009 15.2162 10.564 15.3882C10.0717 15.582 9.54378 15.6885 8.48793 15.9016L8 16L8.04745 15.6678C8.21536 14.4925 8.29932 13.9048 8.49029 13.3561C8.65975 12.8692 8.89125 12.4063 9.17906 11.9786C9.50341 11.4966 9.92319 11.0768 10.7627 10.2373Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span>Edit</span>
              </div>

              {/* Start/Complete action */}
              {task.status === 'open' && (
                <div
                  className="action-dropdown-item"
                  onClick={() => {
                    onToggleActionDropdown(task.id);
                    onStartTask(task.id);
                  }}
                >
                  <div className="action-dropdown-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 5v14l11-7z" fill="currentColor" />
                    </svg>
                  </div>
                  <span>Start Task <span style={{ opacity: 0.6, fontSize: '12px' }}>(Open → In Progress)</span></span>
                </div>
              )}

              {task.status === 'in_progress' && (
                <div
                  className="action-dropdown-item"
                  onClick={() => {
                    onToggleActionDropdown(task.id);
                    onCompleteTask(task.id);
                  }}
                >
                  <div className="action-dropdown-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span>Complete Task <span style={{ opacity: 0.6, fontSize: '12px' }}>(In Progress → Closed)</span></span>
                </div>
              )}

              {/* Divider */}
              <div className="action-dropdown-divider"></div>

              {/* Delete action */}
              <div
                className="action-dropdown-item danger"
                onClick={() => onShowDeleteConfirmation(task.id)}
              >
                <div className="action-dropdown-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L17.1991 18.0129C17.129 19.065 17.0939 19.5911 16.8667 19.99C16.6666 20.3412 16.3648 20.6235 16.0011 20.7998C15.588 21 15.0607 21 14.0062 21H9.99377C8.93927 21 8.41202 21 7.99889 20.7998C7.63517 20.6235 7.33339 20.3412 7.13332 19.99C6.90607 19.5911 6.871 19.065 6.80086 18.0129L6 6M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span>Delete</span>
              </div>
            </div>
          )}

          {/* Delete Confirmation Popup */}
          {deleteConfirmPopup === task.id && (
            <div className="delete-confirm-popup visible">
              <div className="delete-confirm-text">
                Delete <strong>{task.title}</strong>?
                {task.children && task.children.length > 0 && (
                  <>
                    <br /><br />
                    This will unparent {task.children.length} subtask{task.children.length === 1 ? '' : 's'}.
                  </>
                )}
              </div>
              <div className="delete-confirm-buttons">
                <button
                  className="delete-confirm-btn cancel"
                  onClick={() => onShowDeleteConfirmation('')}
                >
                  Cancel
                </button>
                <button
                  className="delete-confirm-btn delete"
                  onClick={() => onDeleteTask(task.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </td>
      </tr>

      {/* Render children if expanded */}
      {isExpanded && task.children && task.children.map((child, index) => (
        <TaskRow
          key={child.id}
          task={child}
          level={level + 1}
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
          isLastChild={index === task.children.length - 1}
          ancestorLines={[...ancestorLines, !isLastChild]}
        />
      ))}
    </>
  );
};

export default IssueList;