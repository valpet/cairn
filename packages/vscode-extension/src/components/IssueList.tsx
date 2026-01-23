import React from 'react';
import './IssueList.css';
import TreeLinesSVG from './TreeLinesSVG';
import TaskRow from './TaskRow';
import TaskGrid from './TaskGrid';
import StatusFilter from './StatusFilter';
import { createTypeBadge, createStatusPill, createPriorityPill, isReady, isBlocked, getStatusIcon, getStatusLabel } from './taskUtils';
import { Issue, IssueListProps } from './types';
import { useVSCodeMessaging } from './hooks/useVSCodeMessaging';
import { useTaskState } from './hooks/useTaskState';
import { useTaskInteractions } from './hooks/useTaskInteractions';
import { useTaskFiltering } from './hooks/useTaskFiltering';
import { useTaskHierarchy } from './hooks/useTaskHierarchy';

const IssueList: React.FC<IssueListProps> = () => {
  const { postMessage } = useVSCodeMessaging();
  const {
    allTasks,
    selectedStatuses,
    setSelectedStatuses,
    expandedTasks,
    expandedDescriptions,
    toggleExpand,
    toggleDescription,
  } = useTaskState();

  const {
    activeActionDropdown,
    deleteConfirmPopup,
    startTask,
    completeTask,
    editTask,
    createNewTask,
    deleteTask,
    toggleActionDropdown,
    showDeleteConfirmation,
  } = useTaskInteractions(postMessage);

  const { filteredTasks } = useTaskFiltering(allTasks, selectedStatuses);
  const { taskTree } = useTaskHierarchy(filteredTasks);

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