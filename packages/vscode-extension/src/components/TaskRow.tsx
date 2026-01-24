import React from 'react';
import { ProgressPie } from './Icons';

interface Issue {
  id: string;
  title: string;
  description?: string;
  type?: string;
  status: string;
  priority?: string;
  completion_percentage?: number;
  acceptance_criteria?: Array<{
    text: string;
    completed: boolean;
  }>;
  dependencies?: Array<{
    id: string;
    type: string;
  }>;
  children: Issue[];
}

// Get composed status display text (shows "Open / In Progress" when subtasks have different status)
const getStatusDisplayText = (status: string, subtasks: Issue[]) => {
  const statusLabels: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    closed: 'Closed',
    blocked: 'Blocked'
  };
  const statusText = statusLabels[status] || status;

  const computedStatus = computeSubIssueStatus(subtasks);
  if (computedStatus && computedStatus !== status) {
    const computedStatusText = statusLabels[computedStatus] || computedStatus;
    return `${statusText} / ${computedStatusText}`;
  }

  return statusText;
};

// Compute the status based on subtasks
const computeSubIssueStatus = (subtasks: Issue[]) => {
  if (!subtasks || subtasks.length === 0) return null;

  // If any subtask is in progress, show in progress
  const hasInProgress = subtasks.some(subtask => subtask.status === 'in_progress');
  if (hasInProgress) return 'in_progress';

  // If any subtask is closed, show closed (even if others are open)
  const hasClosed = subtasks.some(subtask => subtask.status === 'closed');
  if (hasClosed) return 'closed';

  // If all remaining subtasks are blocked, show blocked
  const nonClosedSubtasks = subtasks.filter(subtask => subtask.status !== 'closed');
  if (nonClosedSubtasks.length > 0 && nonClosedSubtasks.every(subtask => subtask.status === 'blocked')) {
    return 'blocked';
  }

  return null;
};

// Get all subtasks recursively from children
const getAllSubtasks = (task: Issue & { children: Issue[] }, allTasks: Issue[]): Issue[] => {
  const subtasks: Issue[] = [];
  const visited = new Set<string>();
  
  function collectSubtasks(taskId: string) {
    if (visited.has(taskId)) {
      return; // Prevent infinite recursion on circular dependencies
    }
    visited.add(taskId);
    
    allTasks.forEach(task => {
      const parentDep = (task.dependencies || []).find(dep => dep.type === 'parent-child');
      if (parentDep && parentDep.id === taskId) {
        subtasks.push(task);
        collectSubtasks(task.id);
      }
    });
  }
  
  collectSubtasks(task.id);
  return subtasks;
};

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
  const subtasks = getAllSubtasks(task, allTasks);
  const computedStatus = computeSubIssueStatus(subtasks);
  const displayStatus = taskIsBlocked ? 'blocked' : (computedStatus || task.status);
  const displayText = taskIsBlocked ? 'Blocked' : getStatusDisplayText(task.status, subtasks);

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
                    : `<span>${task.description.replace(/\n/g, ' ').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`
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
          {task.completion_percentage !== undefined ? (
            <ProgressPie 
              percentage={task.completion_percentage} 
              size={16}
              tooltip={`${task.completion_percentage}%\n${(task.acceptance_criteria?.filter(ac => ac.completed).length || 0)}/${(task.acceptance_criteria?.length || 0)} acceptance criteria\n${subtasks.filter(st => st.status === 'closed').length}/${subtasks.length} sub-issues`}
            />
          ) : (
            <span style={{
              fontSize: '13px',
              color: 'var(--vscode-foreground)',
              fontWeight: 500
            }}>
              —
            </span>
          )}
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

export default TaskRow;