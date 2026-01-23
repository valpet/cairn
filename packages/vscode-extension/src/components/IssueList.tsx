import React, { useEffect, useState, useRef } from 'react';
import './IssueList.css';
import TreeLinesSVG from './TreeLinesSVG';
import TaskRow from './TaskRow';
import TaskGrid from './TaskGrid';
import StatusFilter from './StatusFilter';
import { createTypeBadge, createStatusPill, createPriorityPill, isReady, isBlocked, getStatusIcon, getStatusLabel } from './taskUtils';
import { Issue, IssueListProps } from './types';

// VS Code API declaration
declare const acquireVsCodeApi: () => any;

const IssueList: React.FC<IssueListProps> = () => {
  const [allTasks, setAllTasks] = useState<Issue[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(['ready', 'open', 'in_progress']));
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
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
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeActionDropdown, deleteConfirmPopup]);

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

      <StatusFilter
        selectedStatuses={selectedStatuses}
        onStatusChange={setSelectedStatuses}
      />

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