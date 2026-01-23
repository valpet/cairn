import React, { useEffect, useState, useRef } from 'react';
import './IssueList.css';
import TreeLinesSVG from './TreeLinesSVG';

// VS Code API declaration
declare const acquireVsCodeApi: () => any;

import TreeLinesSVG from './TreeLinesSVG';
import TaskRow from './TaskRow';
import TaskGrid from './TaskGrid';

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

export default IssueList;