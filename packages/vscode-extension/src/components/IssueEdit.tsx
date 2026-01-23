import React, { useState, useEffect, useRef } from 'react';
import './IssueEdit.css';
import EditableField from './EditableField';
import { UserIcon, AgentIcon } from './Icons';
import MetadataDropdown from './MetadataDropdown';
import TaskList from './TaskList';
import {
  getTypeIcon,
  getTypeLabel,
  getPriorityIcon,
  getPriorityLabel,
  getStatusIcon,
  getStatusLabel,
  computeSubIssueStatus,
  getComputedStatusClass
} from './utils';

interface Issue {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  comments: Comment[];
  subtasks: Subtask[];
  dependencies: Dependency[];
  acceptance_criteria: AcceptanceCriteria[];
  completion_percentage: number;
}

interface Comment {
  author: string;
  content: string;
  created_at: string;
}

interface Subtask {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  completion_percentage: number;
}

interface Dependency {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  direction: 'blocks' | 'blocked_by';
  completion_percentage: number;
}

interface AcceptanceCriteria {
  text: string;
  completed: boolean;
}

interface AvailableItem {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
}

interface IssueEditProps {
  vscode: any;
}

const IssueEdit: React.FC<IssueEditProps> = ({ vscode }) => {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentDescription, setCurrentDescription] = useState('');
  const [currentType, setCurrentType] = useState('task');
  const [currentPriority, setCurrentPriority] = useState('medium');
  const [currentStatus, setCurrentStatus] = useState('open');
  const [previousStatus, setPreviousStatus] = useState('open');
  const [comments, setComments] = useState<Comment[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<AcceptanceCriteria[]>([]);
  const [currentCommentAuthor, setCurrentCommentAuthor] = useState('user');
  const [newComment, setNewComment] = useState('');

  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Modal states
  const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);
  const [dependencyModalOpen, setDependencyModalOpen] = useState(false);
  const [availableSubtasks, setAvailableSubtasks] = useState<AvailableItem[]>([]);
  const [availableDependencies, setAvailableDependencies] = useState<AvailableItem[]>([]);
  const [selectedSubtaskIds, setSelectedSubtaskIds] = useState<Set<string>>(new Set());
  const [selectedDependencyIds, setSelectedDependencyIds] = useState<Set<string>>(new Set());
  const [subtaskSearch, setSubtaskSearch] = useState('');
  const [dependencySearch, setDependencySearch] = useState('');
  const [dependencyDirection, setDependencyDirection] = useState<'blocks' | 'blocked_by'>('blocks');

  // Collapsible sections
  const [sectionsCollapsed, setSectionsCollapsed] = useState<Record<string, boolean>>({
    overview: false,
    acceptanceCriteria: false,
    subtasks: false,
    dependencies: false,
    comments: false,
  });

  // Delete confirmation
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  // Editable field states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    // Notify extension that webview is ready
    vscode.postMessage({ type: 'webviewReady' });
    vscode.postMessage({ type: 'getGitUser' });

    // Listen for messages from extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      console.log('Webview received message:', message);

      if (message.type === 'loadTicket') {
        const ticket = message.ticket;
        setIssue(ticket);
        setCurrentTitle(ticket.title || '');
        setCurrentDescription(ticket.description || '');
        setCurrentType(ticket.type || 'task');
        setCurrentPriority(ticket.priority || 'medium');
        setCurrentStatus(ticket.status || 'open');
        setPreviousStatus(ticket.status || 'open');
        setComments(ticket.comments || []);
        setSubtasks(ticket.subtasks || []);
        setDependencies(ticket.dependencies || []);
        setAcceptanceCriteria(ticket.acceptance_criteria || []);
      } else if (message.type === 'availableSubtasks') {
        setAvailableSubtasks(message.subtasks);
        setSubtaskModalOpen(true);
        setSubtaskSearch('');
      } else if (message.type === 'availableDependencies') {
        setAvailableDependencies(message.dependencies);
        setDependencyModalOpen(true);
        setDependencySearch('');
      } else if (message.type === 'commentAdded') {
        setComments(prev => [...prev, message.comment]);
        setNewComment('');
      } else if (message.type === 'gitUserInfo') {
        let authorName = 'user';
        if (message.userName) {
          authorName = message.userName;
        } else if (message.userEmail) {
          authorName = message.userEmail;
        }
        setCurrentCommentAuthor(authorName);
      } else if (message.type === 'saveFailed') {
        // Revert status on save failure
        setCurrentStatus(previousStatus);
        showErrorMessage(message.error, message.errorCode);
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, [vscode]);

  const showErrorMessage = (error: string, errorCode?: string) => {
    let message = error;
    if (errorCode === 'CANNOT_CLOSE_WITH_OPEN_SUBTASKS') {
      message = 'Cannot close issue as it has open sub-issues.';
    }

    // Create temporary error notification
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: #f85149;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      max-width: 400px;
      font-size: 13px;
      line-height: 1.4;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 5000);
  };

  const saveTicket = (overrides?: Partial<{ type: string; priority: string; status: string }>) => {
    if (!issue) return;

    const ticket = {
      id: issue.id,
      title: currentTitle,
      description: currentDescription,
      comments,
      type: overrides?.type ?? currentType,
      priority: overrides?.priority ?? currentPriority,
      status: overrides?.status ?? currentStatus,
      subtasks,
      dependencies,
      acceptance_criteria: acceptanceCriteria,
    };

    vscode.postMessage({ type: 'saveTicket', ticket });
  };

  const selectMetadata = (type: string, value: string) => {
    if (type === 'type') {
      setCurrentType(value);
      saveTicket({ type: value });
    } else if (type === 'priority') {
      setCurrentPriority(value);
      saveTicket({ priority: value });
    } else if (type === 'status') {
      setPreviousStatus(currentStatus);
      setCurrentStatus(value);
      onStatusChange(value);
      saveTicket({ status: value });
    }
    setActiveDropdown(null);
  };

  const onStatusChange = (status: string) => {
    // Handle closed date display logic
    // This would be handled by the extension
  };

  const toggleSection = (sectionName: string) => {
    setSectionsCollapsed(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const toggleDropdown = (dropdownType: string) => {
    setActiveDropdown(activeDropdown === dropdownType ? null : dropdownType);
  };

  const handleFieldEdit = (fieldName: string, value: string) => {
    if (fieldName === 'title') {
      setCurrentTitle(value);
    } else if (fieldName === 'description') {
      setCurrentDescription(value);
    } else if (fieldName === 'commentAuthor') {
      setCurrentCommentAuthor(value || 'user');
    } else if (fieldName.startsWith('acceptance-criteria-')) {
      const index = parseInt(fieldName.split('-')[2]);
      setAcceptanceCriteria(prev => {
        const newCriteria = [...prev];
        newCriteria[index].text = value;
        return newCriteria;
      });
    }
    saveTicket();
  };

  const addAcceptanceCriteria = () => {
    setAcceptanceCriteria(prev => [...prev, { text: 'New acceptance criteria', completed: false }]);
    saveTicket();
  };

  const toggleAcceptanceCriteria = (index: number) => {
    setAcceptanceCriteria(prev => {
      const newCriteria = [...prev];
      newCriteria[index].completed = !newCriteria[index].completed;
      return newCriteria;
    });
    saveTicket();
  };

  const removeAcceptanceCriteria = (index: number) => {
    setAcceptanceCriteria(prev => prev.filter((_, i) => i !== index));
    saveTicket();
  };

  const addComment = () => {
    if (!newComment.trim()) return;

    vscode.postMessage({
      type: 'addComment',
      issueId: issue?.id,
      author: currentCommentAuthor,
      content: newComment.trim()
    });
  };

  const removeSubtask = (id: string) => {
    setSubtasks(prev => prev.filter(s => s.id !== id));
    saveTicket();
  };

  const removeDependency = (id: string) => {
    setDependencies(prev => prev.filter(d => d.id !== id));
    saveTicket();
  };

  const editTask = (taskId: string) => {
    vscode.postMessage({ type: 'editTicket', id: taskId });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleSubtaskSelection = () => {
    if (selectedSubtaskIds.size > 0) {
      const selectedSubtasks = availableSubtasks
        .filter(s => selectedSubtaskIds.has(s.id))
        .map(s => ({
          id: s.id,
          title: s.title,
          type: s.type,
          status: s.status,
          priority: s.priority,
          completion_percentage: 0, // Would be calculated by extension
        }));
      const updatedSubtasks = [...subtasks, ...selectedSubtasks];
      setSubtasks(updatedSubtasks);

      // Save with the updated subtasks
      const ticket = {
        id: issue!.id,
        title: currentTitle,
        description: currentDescription,
        comments,
        type: currentType,
        priority: currentPriority,
        status: currentStatus,
        subtasks: updatedSubtasks,
        dependencies,
        acceptance_criteria: acceptanceCriteria,
      };
      vscode.postMessage({ type: 'saveTicket', ticket });
    }
    setSubtaskModalOpen(false);
    setSelectedSubtaskIds(new Set());
  };

  const handleDependencySelection = () => {
    if (selectedDependencyIds.size > 0) {
      const selectedDeps = availableDependencies
        .filter(d => selectedDependencyIds.has(d.id))
        .map(d => ({
          id: d.id,
          title: d.title,
          type: d.type,
          status: d.status,
          priority: d.priority,
          direction: dependencyDirection,
          completion_percentage: 0, // Would be calculated by extension
        }));
      const updatedDependencies = [...dependencies, ...selectedDeps];
      setDependencies(updatedDependencies);

      // Save with the updated dependencies
      const ticket = {
        id: issue!.id,
        title: currentTitle,
        description: currentDescription,
        comments,
        type: currentType,
        priority: currentPriority,
        status: currentStatus,
        subtasks,
        dependencies: updatedDependencies,
        acceptance_criteria: acceptanceCriteria,
      };
      vscode.postMessage({ type: 'saveTicket', ticket });
    }
    setDependencyModalOpen(false);
    setSelectedDependencyIds(new Set());
  };

  const deleteTask = () => {
    if (issue) {
      vscode.postMessage({ type: 'deleteTask', id: issue.id });
    }
  };

  // Utility functions
  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
  };

  const getStatusDisplayText = (status: string, subtasks: Subtask[]) => {
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

  if (!issue) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {/* Header Section */}
      <div className="header-row">
        <div className="header-left">
          <h1>
            Edit Issue <span id="headerTicketId">#{issue.id}</span>
            <button
              className="copy-id-btn"
              title="Copy ID to clipboard"
              onClick={() => copyToClipboard(issue.id)}
            >
              <svg fill="#000000" viewBox="0 0 36 36" version="1.1" preserveAspectRatio="xMidYMidMeet" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.6,4H21.55a3.89,3.89,0,0,0-7.31,0H13.4A2.41,2.41,0,0,0,11,6.4V10H25V6.4A2.41,2.41,0,0,0,22.6,4ZM23,8H13V6.25A.25.25,0,0,1,13.25,6h2.69l.12-1.11A1.24,1.24,0,0,1,16.61,4a2,2,0,0,1,3.15,1.18l.09.84h2.9a.25.25,0,0,1,.25.25Z" />
                <path d="M33.25,18.06H21.33l2.84-2.83a1,1,0,1,0-1.42-1.42L17.5,19.06l5.25,5.25a1,1,0,0,0,.71.29,1,1,0,0,0,.71-1.7l-2.84-2.84H33.25a1,1,0,0,0,0-2Z" />
                <path d="M29,16h2V6.68A1.66,1.66,0,0,0,29.35,5H27.08V7H29Z" />
                <path d="M29,31H7V7H9V5H6.64A1.66,1.66,0,0,0,5,6.67V31.32A1.66,1.66,0,0,0,6.65,33H29.36A1.66,1.66,0,0,0,31,31.33V22.06H29Z" />
                <rect x="0" y="0" width="36" height="36" fillOpacity="0" />
              </svg>
            </button>
            <span className="completion-percentage">[{issue.completion_percentage}%]</span>
          </h1>
        </div>
        <div className="header-metadata">
          <div className="header-metadata-item">
            <span className="header-metadata-label">Created:</span>
            <div className="header-metadata-value">{formatDate(issue.created_at)}</div>
          </div>
          <div className="header-metadata-item">
            <span className="header-metadata-label">Updated:</span>
            <div className="header-metadata-value">{formatDate(issue.updated_at)}</div>
          </div>
          {issue.closed_at && (
            <div className="header-metadata-item">
              <span className="header-metadata-label">Closed:</span>
              <div className="header-metadata-value">{formatDate(issue.closed_at)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Property Row */}
      <div className="property-row">
        <MetadataDropdown
          label="Type"
          currentValue={currentType}
          className={`type-${currentType}`}
          options={['task', 'bug', 'feature', 'epic', 'chore', 'docs', 'refactor'].map(type => ({ value: type, label: getTypeLabel(type) }))}
          getIcon={getTypeIcon}
          onSelect={(value) => selectMetadata('type', value)}
          activeDropdown={activeDropdown}
          onToggle={toggleDropdown}
        />
        <MetadataDropdown
          label="Priority"
          currentValue={currentPriority}
          className={`priority-${currentPriority}`}
          options={['low', 'medium', 'high', 'urgent'].map(priority => ({ value: priority, label: getPriorityLabel(priority) }))}
          getIcon={getPriorityIcon}
          onSelect={(value) => selectMetadata('priority', value)}
          activeDropdown={activeDropdown}
          onToggle={toggleDropdown}
        />
        <MetadataDropdown
          label="Status"
          currentValue={currentStatus}
          className={`status-${getComputedStatusClass(currentStatus, subtasks)}`}
          options={['open', 'in_progress', 'closed', 'blocked'].map(status => ({ value: status, label: getStatusLabel(status) }))}
          getIcon={getStatusIcon}
          onSelect={(value) => selectMetadata('status', value)}
          activeDropdown={activeDropdown}
          onToggle={toggleDropdown}
          displayText={getStatusDisplayText(currentStatus, subtasks)}
        />
      </div>

      <form>
        <div className="editor-layout">
          <div className="main-content">
            {/* Overview Section */}
            <div className="title-description-section collapsible-section">
              <div
                className={`collapsible-header ${sectionsCollapsed.overview ? 'collapsed' : ''}`}
                onClick={() => toggleSection('overview')}
              >
                <h3>Overview</h3>
                <svg className="collapsible-caret" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z" />
                </svg>
              </div>
              <div className={`collapsible-body ${sectionsCollapsed.overview ? 'collapsed' : ''}`}>
                <div className="collapsible-content">
                  <EditableField
                    fieldName="title"
                    placeholder="Click to add title..."
                    value={currentTitle}
                    onSave={(value) => handleFieldEdit('title', value)}
                  />
                  <EditableField
                    fieldName="description"
                    placeholder="Click to add description..."
                    isTextarea={true}
                    value={currentDescription}
                    onSave={(value) => handleFieldEdit('description', value)}
                  />
                </div>
              </div>
            </div>

            {/* Acceptance Criteria Section */}
            <div className="acceptance-criteria-section collapsible-section">
              <div
                className={`collapsible-header ${sectionsCollapsed.acceptanceCriteria ? 'collapsed' : ''}`}
                onClick={() => toggleSection('acceptanceCriteria')}
              >
                <h3>Acceptance Criteria</h3>
                <svg className="collapsible-caret" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z" />
                </svg>
              </div>
              <div className={`collapsible-body ${sectionsCollapsed.acceptanceCriteria ? 'collapsed' : ''}`}>
                <div className="collapsible-content">
                  <div className="acceptance-criteria-list">
                    {acceptanceCriteria.length === 0 ? (
                      <div className="acceptance-criteria-empty">
                        No acceptance criteria yet. Add criteria to define what needs to be completed.
                      </div>
                    ) : (
                      acceptanceCriteria.map((criteria, index) => (
                        <div key={index} className="acceptance-criteria-item">
                          <input
                            type="checkbox"
                            className="acceptance-criteria-checkbox"
                            checked={criteria.completed}
                            onChange={() => toggleAcceptanceCriteria(index)}
                          />
                          <div className="acceptance-criteria-content">
                            <div className="acceptance-criteria-text-container">
                              <EditableField
                                fieldName={`acceptance-criteria-${index}`}
                                placeholder="Click to add acceptance criteria..."
                                value={criteria.text}
                                onSave={(value) => handleFieldEdit(`acceptance-criteria-${index}`, value)}
                              />
                            </div>
                            <div className="acceptance-criteria-actions">
                              <button
                                type="button"
                                className="icon-button remove"
                                title="Remove acceptance criteria"
                                onClick={() => removeAcceptanceCriteria(index)}
                              >
                                <svg viewBox="0 0 1024 1024" fill="currentColor">
                                  <path d="M195.2 195.2a64 64 0 0 1 90.496 0L512 421.504 738.304 195.2a64 64 0 0 1 90.496 90.496L602.496 512 828.8 738.304a64 64 0 0 1-90.496 90.496L512 602.496 285.696 828.8a64 64 0 0 1-90.496-90.496L421.504 512 195.2 285.696a64 64 0 0 1 0-90.496z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <button type="button" className="secondary" onClick={addAcceptanceCriteria}>
                    Add Acceptance Criteria
                  </button>
                </div>
              </div>
            </div>

            {/* Subtasks Section */}
            <div className="subtasks-section collapsible-section">
              <div
                className={`collapsible-header ${sectionsCollapsed.subtasks ? 'collapsed' : ''}`}
                onClick={() => toggleSection('subtasks')}
              >
                <h3>Sub-issues</h3>
                <svg className="collapsible-caret" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z" />
                </svg>
              </div>
              <div className={`collapsible-body ${sectionsCollapsed.subtasks ? 'collapsed' : ''}`}>
                <div className="collapsible-content">
                  <div className="subtask-list">
                    <TaskList
                      tasks={subtasks}
                      onEdit={editTask}
                      onRemove={removeSubtask}
                      copyToClipboard={copyToClipboard}
                      emptyMessage="No sub-issues yet. Break this task down into smaller, manageable pieces."
                    />
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => vscode.postMessage({ type: 'getAvailableSubtasks' })}
                  >
                    Add Sub-issue
                  </button>
                </div>
              </div>
            </div>

            {/* Dependencies Section */}
            <div className="dependencies-section collapsible-section">
              <div
                className={`collapsible-header ${sectionsCollapsed.dependencies ? 'collapsed' : ''}`}
                onClick={() => toggleSection('dependencies')}
              >
                <h3>Dependencies</h3>
                <svg className="collapsible-caret" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z" />
                </svg>
              </div>
              <div className={`collapsible-body ${sectionsCollapsed.dependencies ? 'collapsed' : ''}`}>
                <div className="collapsible-content">
                  <div className="dependency-section">
                    <h4>Blocked by</h4>
                    <div className="dependency-list">
                      <TaskList
                        tasks={dependencies.filter(dep => dep.direction === 'blocks')}
                        onEdit={editTask}
                        onRemove={removeDependency}
                        copyToClipboard={copyToClipboard}
                        emptyMessage="No blocking dependencies. This issue can be worked on independently."
                      />
                    </div>
                  </div>
                  <div className="dependency-section">
                    <h4>This issue is blocking</h4>
                    <div className="dependency-list">
                      <TaskList
                        tasks={dependencies.filter(dep => dep.direction === 'blocked_by')}
                        onEdit={editTask}
                        onRemove={removeDependency}
                        copyToClipboard={copyToClipboard}
                        emptyMessage="This issue doesn't block any other work."
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => vscode.postMessage({ type: 'getAvailableDependencies' })}
                  >
                    Add Dependency
                  </button>
                </div>
              </div>
            </div>

            {/* Comments Section */}
            <div className="comments-section collapsible-section">
              <div
                className={`collapsible-header ${sectionsCollapsed.comments ? 'collapsed' : ''}`}
                onClick={() => toggleSection('comments')}
              >
                <h3 className="comments-header">Comments</h3>
                <svg className="collapsible-caret" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z" />
                </svg>
              </div>
              <div className={`collapsible-body ${sectionsCollapsed.comments ? 'collapsed' : ''}`}>
                <div className="collapsible-content">
                  <div className="comments-thread">
                    {comments.length === 0 ? (
                      <div className="comments-empty">
                        No comments yet. Add a comment below to start the conversation.
                      </div>
                    ) : (
                      comments.map((comment, index) => (
                        <div key={index} className="comment-item">
                          <div className="comment-header">
                            {comment.author === 'agent' || comment.author === 'developer' ? (
                              <AgentIcon />
                            ) : (
                              <UserIcon />
                            )}
                            <span className={`comment-author ${comment.author === 'agent' ? 'agent' : ''}`}>
                              {comment.author === 'agent' ? 'Agent' : comment.author}
                            </span>
                            <span>•</span>
                            <span className="comment-timestamp">{formatTimestamp(comment.created_at)}</span>
                          </div>
                          <div className="comment-content">{comment.content}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="add-comment-form">
                    <div className="add-comment-header">
                      <UserIcon />
                      <label>Commenting as:</label>
                      <div className="commenting-as-field">
                        <EditableField
                          fieldName="commentAuthor"
                          placeholder="your-name"
                          value={currentCommentAuthor}
                          onSave={(value) => handleFieldEdit('commentAuthor', value)}
                        />
                      </div>
                    </div>
                    <textarea
                      id="commentInput"
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                    />
                    <div className="add-comment-actions">
                      <button type="button" onClick={addComment}>Add Comment</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Button */}
        <button
          type="button"
          className="delete-ticket-btn"
          ref={deleteButtonRef}
          onClick={() => setDeleteConfirmVisible(true)}
        >
          Delete Ticket
        </button>

        {/* Delete Confirmation Popup */}
        {deleteConfirmVisible && (
          <div className="delete-confirm-popup visible">
            <div className="delete-confirm-text">
              Delete <strong>{currentTitle}</strong>?<br /><br />
              This will unparent {subtasks.length} subtask{subtasks.length === 1 ? '' : 's'}.
            </div>
            <div className="delete-confirm-buttons">
              <button
                className="delete-confirm-btn cancel"
                onClick={() => setDeleteConfirmVisible(false)}
              >
                Cancel
              </button>
              <button
                className="delete-confirm-btn delete"
                onClick={() => {
                  setDeleteConfirmVisible(false);
                  deleteTask();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Subtask Selection Modal */}
      {subtaskModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Select Subtasks</h2>
            </div>
            <div className="modal-body">
              <input
                type="text"
                className="search-input"
                placeholder="Search by ID, title, or description..."
                value={subtaskSearch}
                onChange={(e) => setSubtaskSearch(e.target.value)}
              />
              <div className="subtask-list-modal">
                {availableSubtasks
                  .filter(subtask =>
                    `${subtask.id} ${subtask.title} ${subtask.description}`
                      .toLowerCase()
                      .includes(subtaskSearch.toLowerCase())
                  )
                  .map(subtask => (
                    <div
                      key={subtask.id}
                      className={`subtask-item ${selectedSubtaskIds.has(subtask.id) ? 'selected' : ''}`}
                      onClick={() => {
                        const newSelected = new Set(selectedSubtaskIds);
                        if (newSelected.has(subtask.id)) {
                          newSelected.delete(subtask.id);
                        } else {
                          newSelected.add(subtask.id);
                        }
                        setSelectedSubtaskIds(newSelected);
                      }}
                    >
                      <input
                        type="checkbox"
                        className="subtask-checkbox"
                        checked={selectedSubtaskIds.has(subtask.id)}
                        onChange={() => { }} // Handled by onClick
                      />
                      <div className="subtask-content">
                        <div className="subtask-info">
                          <span className={`type-badge ${subtask.type}`}>{subtask.type}</span>
                          <div className="task-id-container">
                            <div className="task-id">
                              {subtask.id}
                              <button
                                className="copy-id-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(subtask.id);
                                }}
                              >
                                <svg fill="#000000" viewBox="0 0 36 36">
                                  <path d="M22.6,4H21.55a3.89,3.89,0,0,0-7.31,0H13.4A2.41,2.41,0,0,0,11,6.4V10H25V6.4A2.41,2.41,0,0,0,22.6,4ZM23,8H13V6.25A.25.25,0,0,1,13.25,6h2.69l.12-1.11A1.24,1.24,0,0,1,16.61,4a2,2,0,0,1,3.15,1.18l.09.84h2.9a.25.25,0,0,1,.25.25Z" />
                                  <path d="M33.25,18.06H21.33l2.84-2.83a1,1,0,1,0-1.42-1.42L17.5,19.06l5.25,5.25a1,1,0,0,0,.71.29,1,1,0,0,0,.71-1.7l-2.84-2.84H33.25a1,1,0,0,0,0-2Z" />
                                  <path d="M29,16h2V6.68A1.66,1.66,0,0,0,29.35,5H27.08V7H29Z" />
                                  <path d="M29,31H7V7H9V5H6.64A1.66,1.66,0,0,0,5,6.67V31.32A1.66,1.66,0,0,0,6.65,33H29.36A1.66,1.66,0,0,0,31,31.33V22.06H29Z" />
                                </svg>
                              </button>
                            </div>
                            <span className="subtask-title">{subtask.title}</span>
                          </div>
                        </div>
                        <span className={`subtask-status ${subtask.status}`}>{getStatusLabel(subtask.status)}</span>
                        <span className={`subtask-priority ${subtask.priority}`}>{getPriorityLabel(subtask.priority)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary" onClick={() => setSubtaskModalOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={handleSubtaskSelection} disabled={selectedSubtaskIds.size === 0}>
                Add Selected Subtasks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dependency Selection Modal */}
      {dependencyModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Select Dependencies</h2>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>
                  Dependency Direction:
                </label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="dependencyDirection"
                      value="blocks"
                      checked={dependencyDirection === 'blocks'}
                      onChange={(e) => setDependencyDirection(e.target.value as 'blocks' | 'blocked_by')}
                    />
                    This task depends on selected tasks (Blocked by)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="dependencyDirection"
                      value="blocked_by"
                      checked={dependencyDirection === 'blocked_by'}
                      onChange={(e) => setDependencyDirection(e.target.value as 'blocks' | 'blocked_by')}
                    />
                    Selected tasks depend on this task (Blocking)
                  </label>
                </div>
              </div>
              <input
                type="text"
                className="search-input"
                placeholder="Search by ID, title, or description..."
                value={dependencySearch}
                onChange={(e) => setDependencySearch(e.target.value)}
              />
              <div className="dependency-list-modal">
                {availableDependencies
                  .filter(dep =>
                    `${dep.id} ${dep.title} ${dep.description}`
                      .toLowerCase()
                      .includes(dependencySearch.toLowerCase())
                  )
                  .map(dep => (
                    <div
                      key={dep.id}
                      className={`dependency-item ${selectedDependencyIds.has(dep.id) ? 'selected' : ''}`}
                      onClick={() => {
                        const newSelected = new Set(selectedDependencyIds);
                        if (newSelected.has(dep.id)) {
                          newSelected.delete(dep.id);
                        } else {
                          newSelected.add(dep.id);
                        }
                        setSelectedDependencyIds(newSelected);
                      }}
                    >
                      <input
                        type="checkbox"
                        className="dependency-checkbox"
                        checked={selectedDependencyIds.has(dep.id)}
                        onChange={() => { }} // Handled by onClick
                      />
                      <div className="dependency-content">
                        <div className="dependency-info">
                          <span className={`type-badge ${dep.type}`}>{dep.type}</span>
                          <div className="task-id-container">
                            <div className="task-id">
                              {dep.id}
                              <button
                                className="copy-id-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(dep.id);
                                }}
                              >
                                <svg fill="#000000" viewBox="0 0 36 36">
                                  <path d="M22.6,4H21.55a3.89,3.89,0,0,0-7.31,0H13.4A2.41,2.41,0,0,0,11,6.4V10H25V6.4A2.41,2.41,0,0,0,22.6,4ZM23,8H13V6.25A.25.25,0,0,1,13.25,6h2.69l.12-1.11A1.24,1.24,0,0,1,16.61,4a2,2,0,0,1,3.15,1.18l.09.84h2.9a.25.25,0,0,1,.25.25Z" />
                                  <path d="M33.25,18.06H21.33l2.84-2.83a1,1,0,1,0-1.42-1.42L17.5,19.06l5.25,5.25a1,1,0,0,0,.71.29,1,1,0,0,0,.71-1.7l-2.84-2.84H33.25a1,1,0,0,0,0-2Z" />
                                  <path d="M29,16h2V6.68A1.66,1.66,0,0,0,29.35,5H27.08V7H29Z" />
                                  <path d="M29,31H7V7H9V5H6.64A1.66,1.66,0,0,0,5,6.67V31.32A1.66,1.66,0,0,0,6.65,33H29.36A1.66,1.66,0,0,0,31,31.33V22.06H29Z" />
                                </svg>
                              </button>
                            </div>
                            <span className="dependency-title">{dep.title}</span>
                          </div>
                        </div>
                        <span className={`dependency-status ${dep.status}`}>{getStatusLabel(dep.status)}</span>
                        <span className={`dependency-priority ${dep.priority}`}>{getPriorityLabel(dep.priority)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary" onClick={() => setDependencyModalOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={handleDependencySelection} disabled={selectedDependencyIds.size === 0}>
                Add Selected Dependencies
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IssueEdit;