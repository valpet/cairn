import React, { useState, useEffect, useRef } from 'react';
import './IssueEdit.css';

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

  const saveTicket = () => {
    if (!issue) return;

    const ticket = {
      id: issue.id,
      title: currentTitle,
      description: currentDescription,
      comments,
      type: currentType,
      priority: currentPriority,
      status: currentStatus,
      subtasks,
      dependencies,
      acceptance_criteria: acceptanceCriteria,
    };

    vscode.postMessage({ type: 'saveTicket', ticket });
  };

  const selectMetadata = (type: string, value: string) => {
    if (type === 'type') {
      setCurrentType(value);
    } else if (type === 'priority') {
      setCurrentPriority(value);
    } else if (type === 'status') {
      setPreviousStatus(currentStatus);
      setCurrentStatus(value);
      onStatusChange(value);
    }
    setActiveDropdown(null);
    saveTicket();
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

  const removeSubtask = (index: number) => {
    setSubtasks(prev => prev.filter((_, i) => i !== index));
    saveTicket();
  };

  const removeDependency = (index: number) => {
    setDependencies(prev => prev.filter((_, i) => i !== index));
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
                <path d="M22.6,4H21.55a3.89,3.89,0,0,0-7.31,0H13.4A2.41,2.41,0,0,0,11,6.4V10H25V6.4A2.41,2.41,0,0,0,22.6,4ZM23,8H13V6.25A.25.25,0,0,1,13.25,6h2.69l.12-1.11A1.24,1.24,0,0,1,16.61,4a2,2,0,0,1,3.15,1.18l.09.84h2.9a.25.25,0,0,1,.25.25Z"/>
                <path d="M33.25,18.06H21.33l2.84-2.83a1,1,0,1,0-1.42-1.42L17.5,19.06l5.25,5.25a1,1,0,0,0,.71.29,1,1,0,0,0,.71-1.7l-2.84-2.84H33.25a1,1,0,0,0,0-2Z"/>
                <path d="M29,16h2V6.68A1.66,1.66,0,0,0,29.35,5H27.08V7H29Z"/>
                <path d="M29,31H7V7H9V5H6.64A1.66,1.66,0,0,0,5,6.67V31.32A1.66,1.66,0,0,0,6.65,33H29.36A1.66,1.66,0,0,0,31,31.33V22.06H29Z"/>
                <rect x="0" y="0" width="36" height="36" fillOpacity="0"/>
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
        <div className="property-item">
          <label className="property-label">Type</label>
          <div className="property-value">
            <button
              type="button"
              className={`metadata-dropdown-button type-${currentType}`}
              onClick={() => toggleDropdown('type')}
            >
              <span className="button-content">
                <span className="button-icon">{getTypeIcon(currentType)}</span>
                <span>{getTypeLabel(currentType)}</span>
              </span>
              <span className="metadata-dropdown-caret">▼</span>
            </button>
            {activeDropdown === 'type' && (
              <div className="metadata-dropdown-menu visible">
                {['task', 'bug', 'feature', 'epic', 'chore', 'docs', 'refactor'].map(type => (
                  <button
                    key={type}
                    type="button"
                    className={`metadata-dropdown-item ${currentType === type ? 'selected' : ''}`}
                    onClick={() => selectMetadata('type', type)}
                  >
                    {getTypeLabel(type)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="property-item">
          <label className="property-label">Priority</label>
          <div className="property-value">
            <button
              type="button"
              className={`metadata-dropdown-button priority-${currentPriority}`}
              onClick={() => toggleDropdown('priority')}
            >
              <span className="button-content">
                <span className="button-icon">{getPriorityIcon(currentPriority)}</span>
                <span>{getPriorityLabel(currentPriority)}</span>
              </span>
              <span className="metadata-dropdown-caret">▼</span>
            </button>
            {activeDropdown === 'priority' && (
              <div className="metadata-dropdown-menu visible">
                {['low', 'medium', 'high', 'urgent'].map(priority => (
                  <button
                    key={priority}
                    type="button"
                    className={`metadata-dropdown-item ${currentPriority === priority ? 'selected' : ''}`}
                    onClick={() => selectMetadata('priority', priority)}
                  >
                    {getPriorityLabel(priority)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="property-item">
          <label className="property-label">Status</label>
          <div className="property-value">
            <button
              type="button"
              className={`metadata-dropdown-button status-${getComputedStatusClass(currentStatus, subtasks)}`}
              onClick={() => toggleDropdown('status')}
            >
              <span className="button-content">
                <span className="button-icon">{getStatusIcon(currentStatus)}</span>
                <span>{getStatusDisplayText(currentStatus, subtasks)}</span>
              </span>
              <span className="metadata-dropdown-caret">▼</span>
            </button>
            {activeDropdown === 'status' && (
              <div className="metadata-dropdown-menu visible">
                {['open', 'in_progress', 'closed', 'blocked'].map(status => (
                  <button
                    key={status}
                    type="button"
                    className={`metadata-dropdown-item ${currentStatus === status ? 'selected' : ''}`}
                    onClick={() => selectMetadata('status', status)}
                  >
                    {getStatusLabel(status)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
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
                  <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
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
                  <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
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
                                  <path d="M195.2 195.2a64 64 0 0 1 90.496 0L512 421.504 738.304 195.2a64 64 0 0 1 90.496 90.496L602.496 512 828.8 738.304a64 64 0 0 1-90.496 90.496L512 602.496 285.696 828.8a64 64 0 0 1-90.496-90.496L421.504 512 195.2 285.696a64 64 0 0 1 0-90.496z"/>
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
                  <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
                </svg>
              </div>
              <div className={`collapsible-body ${sectionsCollapsed.subtasks ? 'collapsed' : ''}`}>
                <div className="collapsible-content">
                  <div className="subtask-list">
                    {subtasks.length === 0 ? (
                      <div className="subtasks-empty">
                        No sub-issues yet. Break this task down into smaller, manageable pieces.
                      </div>
                    ) : (
                      subtasks.map((subtask, index) => (
                        <div key={subtask.id} className="subtask">
                          <div className="subtask-info">
                            <span className={`type-badge ${subtask.type}`}>{subtask.type}</span>
                            <div className="task-id-container">
                              <div className="task-id">
                                {subtask.id}
                                <button
                                  className="copy-id-btn"
                                  title="Copy ID to clipboard"
                                  onClick={() => copyToClipboard(subtask.id)}
                                >
                                  <svg fill="#000000" viewBox="0 0 36 36">
                                    <path d="M22.6,4H21.55a3.89,3.89,0,0,0-7.31,0H13.4A2.41,2.41,0,0,0,11,6.4V10H25V6.4A2.41,2.41,0,0,0,22.6,4ZM23,8H13V6.25A.25.25,0,0,1,13.25,6h2.69l.12-1.11A1.24,1.24,0,0,1,16.61,4a2,2,0,0,1,3.15,1.18l.09.84h2.9a.25.25,0,0,1,.25.25Z"/>
                                    <path d="M33.25,18.06H21.33l2.84-2.83a1,1,0,1,0-1.42-1.42L17.5,19.06l5.25,5.25a1,1,0,0,0,.71.29,1,1,0,0,0,.71-1.7l-2.84-2.84H33.25a1,1,0,0,0,0-2Z"/>
                                    <path d="M29,16h2V6.68A1.66,1.66,0,0,0,29.35,5H27.08V7H29Z"/>
                                    <path d="M29,31H7V7H9V5H6.64A1.66,1.66,0,0,0,5,6.67V31.32A1.66,1.66,0,0,0,6.65,33H29.36A1.66,1.66,0,0,0,31,31.33V22.06H29Z"/>
                                  </svg>
                                </button>
                              </div>
                              <span
                                className="subtask-title"
                                style={{ cursor: 'pointer' }}
                                onClick={() => editTask(subtask.id)}
                              >
                                {subtask.title}
                              </span>
                            </div>
                          </div>
                          <span className="completion-percentage">{subtask.completion_percentage}%</span>
                          <span className={`subtask-status ${subtask.status}`}>{getStatusLabel(subtask.status)}</span>
                          <span className={`subtask-priority ${subtask.priority}`}>{getPriorityLabel(subtask.priority)}</span>
                          <button
                            type="button"
                            className="icon-button remove"
                            title="Remove subtask"
                            onClick={() => removeSubtask(index)}
                          >
                            <svg viewBox="0 0 1024 1024" fill="currentColor">
                              <path d="M195.2 195.2a64 64 0 0 1 90.496 0L512 421.504 738.304 195.2a64 64 0 0 1 90.496 90.496L602.496 512 828.8 738.304a64 64 0 0 1-90.496 90.496L512 602.496 285.696 828.8a64 64 0 0 1-90.496-90.496L421.504 512 195.2 285.696a64 64 0 0 1 0-90.496z"/>
                            </svg>
                          </button>
                        </div>
                      ))
                    )}
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
                  <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
                </svg>
              </div>
              <div className={`collapsible-body ${sectionsCollapsed.dependencies ? 'collapsed' : ''}`}>
                <div className="collapsible-content">
                  <div className="dependency-section">
                    <h4>Blocked by</h4>
                    <div className="dependency-list">
                      {dependencies.filter(dep => dep.direction === 'blocks').length === 0 ? (
                        <div className="dependencies-empty">
                          No blocking dependencies. This issue can be worked on independently.
                        </div>
                      ) : (
                        dependencies.filter(dep => dep.direction === 'blocks').map((dep, index) => (
                          <div key={dep.id} className="dependency">
                            <div className="dependency-info">
                              <span className={`type-badge ${dep.type}`}>{dep.type}</span>
                              <div className="task-id-container">
                                <div className="task-id">
                                  {dep.id}
                                  <button
                                    className="copy-id-btn"
                                    title="Copy ID to clipboard"
                                    onClick={() => copyToClipboard(dep.id)}
                                  >
                                    <svg fill="#000000" viewBox="0 0 36 36">
                                      <path d="M22.6,4H21.55a3.89,3.89,0,0,0-7.31,0H13.4A2.41,2.41,0,0,0,11,6.4V10H25V6.4A2.41,2.41,0,0,0,22.6,4ZM23,8H13V6.25A.25.25,0,0,1,13.25,6h2.69l.12-1.11A1.24,1.24,0,0,1,16.61,4a2,2,0,0,1,3.15,1.18l.09.84h2.9a.25.25,0,0,1,.25.25Z"/>
                                      <path d="M33.25,18.06H21.33l2.84-2.83a1,1,0,1,0-1.42-1.42L17.5,19.06l5.25,5.25a1,1,0,0,0,.71.29,1,1,0,0,0,.71-1.7l-2.84-2.84H33.25a1,1,0,0,0,0-2Z"/>
                                      <path d="M29,16h2V6.68A1.66,1.66,0,0,0,29.35,5H27.08V7H29Z"/>
                                      <path d="M29,31H7V7H9V5H6.64A1.66,1.66,0,0,0,5,6.67V31.32A1.66,1.66,0,0,0,6.65,33H29.36A1.66,1.66,0,0,0,31,31.33V22.06H29Z"/>
                                    </svg>
                                  </button>
                                </div>
                                <span
                                  className="dependency-title"
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => editTask(dep.id)}
                                >
                                  {dep.title}
                                </span>
                              </div>
                            </div>
                            <span className={`dependency-status ${dep.status}`}>{getStatusLabel(dep.status)}</span>
                            <span className={`dependency-priority ${dep.priority}`}>{getPriorityLabel(dep.priority)}</span>
                            <span className="completion-percentage">{dep.completion_percentage}%</span>
                            <button
                              type="button"
                              className="icon-button remove"
                              title="Remove dependency"
                              onClick={() => removeDependency(dependencies.findIndex(d => d.id === dep.id))}
                            >
                              <svg viewBox="0 0 1024 1024" fill="currentColor">
                                <path d="M195.2 195.2a64 64 0 0 1 90.496 0L512 421.504 738.304 195.2a64 64 0 0 1 90.496 90.496L602.496 512 828.8 738.304a64 64 0 0 1-90.496 90.496L512 602.496 285.696 828.8a64 64 0 0 1-90.496-90.496L421.504 512 195.2 285.696a64 64 0 0 1 0-90.496z"/>
                              </svg>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="dependency-section">
                    <h4>This issue is blocking</h4>
                    <div className="dependency-list">
                      {dependencies.filter(dep => dep.direction === 'blocked_by').length === 0 ? (
                        <div className="dependencies-empty">
                          This issue doesn't block any other work.
                        </div>
                      ) : (
                        dependencies.filter(dep => dep.direction === 'blocked_by').map((dep, index) => (
                          <div key={dep.id} className="dependency">
                            <div className="dependency-info">
                              <span className={`type-badge ${dep.type}`}>{dep.type}</span>
                              <div className="task-id-container">
                                <div className="task-id">
                                  {dep.id}
                                  <button
                                    className="copy-id-btn"
                                    title="Copy ID to clipboard"
                                    onClick={() => copyToClipboard(dep.id)}
                                  >
                                    <svg fill="#000000" viewBox="0 0 36 36">
                                      <path d="M22.6,4H21.55a3.89,3.89,0,0,0-7.31,0H13.4A2.41,2.41,0,0,0,11,6.4V10H25V6.4A2.41,2.41,0,0,0,22.6,4ZM23,8H13V6.25A.25.25,0,0,1,13.25,6h2.69l.12-1.11A1.24,1.24,0,0,1,16.61,4a2,2,0,0,1,3.15,1.18l.09.84h2.9a.25.25,0,0,1,.25.25Z"/>
                                      <path d="M33.25,18.06H21.33l2.84-2.83a1,1,0,1,0-1.42-1.42L17.5,19.06l5.25,5.25a1,1,0,0,0,.71.29,1,1,0,0,0,.71-1.7l-2.84-2.84H33.25a1,1,0,0,0,0-2Z"/>
                                      <path d="M29,16h2V6.68A1.66,1.66,0,0,0,29.35,5H27.08V7H29Z"/>
                                      <path d="M29,31H7V7H9V5H6.64A1.66,1.66,0,0,0,5,6.67V31.32A1.66,1.66,0,0,0,6.65,33H29.36A1.66,1.66,0,0,0,31,31.33V22.06H29Z"/>
                                    </svg>
                                  </button>
                                </div>
                                <span
                                  className="dependency-title"
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => editTask(dep.id)}
                                >
                                  {dep.title}
                                </span>
                              </div>
                            </div>
                            <span className={`dependency-status ${dep.status}`}>{getStatusLabel(dep.status)}</span>
                            <span className={`dependency-priority ${dep.priority}`}>{getPriorityLabel(dep.priority)}</span>
                            <span className="completion-percentage">{dep.completion_percentage}%</span>
                            <button
                              type="button"
                              className="icon-button remove"
                              title="Remove dependency"
                              onClick={() => removeDependency(dependencies.findIndex(d => d.id === dep.id))}
                            >
                              <svg viewBox="0 0 1024 1024" fill="currentColor">
                                <path d="M195.2 195.2a64 64 0 0 1 90.496 0L512 421.504 738.304 195.2a64 64 0 0 1 90.496 90.496L602.496 512 828.8 738.304a64 64 0 0 1-90.496 90.496L512 602.496 285.696 828.8a64 64 0 0 1-90.496-90.496L421.504 512 195.2 285.696a64 64 0 0 1 0-90.496z"/>
                              </svg>
                            </button>
                          </div>
                        ))
                      )}
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
                  <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
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
              Delete <strong>{currentTitle}</strong>?<br/><br/>
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
                        onChange={() => {}} // Handled by onClick
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
                                  <path d="M22.6,4H21.55a3.89,3.89,0,0,0-7.31,0H13.4A2.41,2.41,0,0,0,11,6.4V10H25V6.4A2.41,2.41,0,0,0,22.6,4ZM23,8H13V6.25A.25.25,0,0,1,13.25,6h2.69l.12-1.11A1.24,1.24,0,0,1,16.61,4a2,2,0,0,1,3.15,1.18l.09.84h2.9a.25.25,0,0,1,.25.25Z"/>
                                  <path d="M33.25,18.06H21.33l2.84-2.83a1,1,0,1,0-1.42-1.42L17.5,19.06l5.25,5.25a1,1,0,0,0,.71.29,1,1,0,0,0,.71-1.7l-2.84-2.84H33.25a1,1,0,0,0,0-2Z"/>
                                  <path d="M29,16h2V6.68A1.66,1.66,0,0,0,29.35,5H27.08V7H29Z"/>
                                  <path d="M29,31H7V7H9V5H6.64A1.66,1.66,0,0,0,5,6.67V31.32A1.66,1.66,0,0,0,6.65,33H29.36A1.66,1.66,0,0,0,31,31.33V22.06H29Z"/>
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
                        onChange={() => {}} // Handled by onClick
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
                                  <path d="M22.6,4H21.55a3.89,3.89,0,0,0-7.31,0H13.4A2.41,2.41,0,0,0,11,6.4V10H25V6.4A2.41,2.41,0,0,0,22.6,4ZM23,8H13V6.25A.25.25,0,0,1,13.25,6h2.69l.12-1.11A1.24,1.24,0,0,1,16.61,4a2,2,0,0,1,3.15,1.18l.09.84h2.9a.25.25,0,0,1,.25.25Z"/>
                                  <path d="M33.25,18.06H21.33l2.84-2.83a1,1,0,1,0-1.42-1.42L17.5,19.06l5.25,5.25a1,1,0,0,0,.71.29,1,1,0,0,0,.71-1.7l-2.84-2.84H33.25a1,1,0,0,0,0-2Z"/>
                                  <path d="M29,16h2V6.68A1.66,1.66,0,0,0,29.35,5H27.08V7H29Z"/>
                                  <path d="M29,31H7V7H9V5H6.64A1.66,1.66,0,0,0,5,6.67V31.32A1.66,1.66,0,0,0,6.65,33H29.36A1.66,1.66,0,0,0,31,31.33V22.06H29Z"/>
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

// Helper Components
const EditableField: React.FC<{
  fieldName: string;
  placeholder: string;
  isTextarea?: boolean;
  value: string;
  onSave: (value: string) => void;
}> = ({ fieldName, placeholder, isTextarea = false, value, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const startEditing = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const save = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const cancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isTextarea) {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  return (
    <div className="editable-field">
      {!isEditing ? (
        <div className="field-display" onClick={startEditing}>
          <div className={`field-text ${!value ? 'placeholder' : ''}`}>
            {value || placeholder}
          </div>
          <svg className="edit-icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.23 1h-1.46L3.52 9.25l-.16.22L2 13.59l4.12-1.36.22-.16L14.59 3.23V1.77L13.23 1zM2.41 13.59l.72-2.17 1.45 1.45-2.17.72zm2.5-2.07L3.53 10.1 10.8 2.83l1.38 1.38-7.27 7.27z"/>
          </svg>
        </div>
      ) : (
        <div className="field-edit">
          {isTextarea ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => setIsEditing(false), 100)}
              rows={4}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => setIsEditing(false), 100)}
            />
          )}
          <div className="edit-actions">
            <button type="button" className="icon-button accept" onClick={save} title="Save">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.764.646z"/>
              </svg>
            </button>
            <button type="button" className="icon-button cancel" onClick={cancel} title="Cancel">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const UserIcon: React.FC = () => (
  <svg className="user-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2" />
    <path d="M16.807 19.0112C15.4398 19.9504 13.7841 20.5 12 20.5C10.2159 20.5 8.56023 19.9503 7.193 19.0111C6.58915 18.5963 6.33109 17.8062 6.68219 17.1632C7.41001 15.8302 8.90973 15 12 15C15.0903 15 16.59 15.8303 17.3178 17.1632C17.6689 17.8062 17.4108 18.5964 16.807 19.0112Z" fill="currentColor" />
    <path d="M12 12C13.6569 12 15 10.6569 15 9C15 7.34315 13.6569 6 12 6C10.3432 6 9.00004 7.34315 9.00004 9C9.00004 10.6569 10.3432 12 12 12Z" fill="currentColor" />
  </svg>
);

const AgentIcon: React.FC = () => (
  <svg className="comment-icon agent-icon" viewBox="0 0 512 416" fill="currentColor" preserveAspectRatio="xMidYMid meet">
    <path d="M181.33 266.143c0-11.497 9.32-20.818 20.818-20.818 11.498 0 20.819 9.321 20.819 20.818v38.373c0 11.497-9.321 20.818-20.819 20.818-11.497 0-20.818-9.32-20.818-20.818v-38.373zM308.807 245.325c-11.477 0-20.798 9.321-20.798 20.818v38.373c0 11.497 9.32 20.818 20.798 20.818 11.497 0 20.818-9.32 20.818-20.818v-38.373c0-11.497-9.32-20.818-20.818-20.818z"/>
    <path d="M512.002 246.393v57.384c-.02 7.411-3.696 14.638-9.67 19.011C431.767 374.444 344.695 416 256 416c-98.138 0-196.379-56.542-246.33-93.21-5.975-4.374-9.65-11.6-9.671-19.012v-57.384a35.347 35.347 0 016.857-20.922l15.583-21.085c8.336-11.312 20.757-14.31 33.98-14.31 4.988-56.953 16.794-97.604 45.024-127.354C155.194 5.77 226.56 0 256 0c29.441 0 100.807 5.77 154.557 62.722 28.19 29.75 40.036 70.401 45.025 127.354 13.263 0 25.602 2.936 33.958 14.31l15.583 21.127c4.476 6.077 6.878 13.345 6.878 20.88zm-97.666-26.075c-.677-13.058-11.292-18.19-22.338-21.824-11.64 7.309-25.848 10.183-39.46 10.183-14.454 0-41.432-3.47-63.872-25.869-5.667-5.625-9.527-14.454-12.155-24.247a212.902 212.902 0 00-20.469-1.088c-6.098 0-13.099.349-20.551 1.088-2.628 9.793-6.509 18.622-12.155 24.247-22.4 22.4-49.418 25.87-63.872 25.87-13.612 0-27.86-2.855-39.501-10.184-11.005 3.613-21.558 8.828-22.277 21.824-1.17 24.555-1.272 49.11-1.375 73.645-.041 12.318-.082 24.658-.288 36.976.062 7.166 4.374 13.818 10.882 16.774 52.97 24.124 103.045 36.278 149.137 36.278 46.01 0 96.085-12.154 149.014-36.278 6.508-2.956 10.84-9.608 10.881-16.774.637-36.832.124-73.809-1.642-110.62h.041zM107.521 168.97c8.643 8.623 24.966 14.392 42.56 14.392 13.448 0 39.03-2.874 60.156-24.329 9.28-8.951 15.05-31.35 14.413-54.079-.657-18.231-5.769-33.28-13.448-39.665-8.315-7.371-27.203-10.574-48.33-8.644-22.399 2.238-41.267 9.588-50.875 19.833-20.798 22.728-16.323 80.317-4.476 92.492zm130.556-56.008c.637 3.51.965 7.35 1.273 11.517 0 2.875 0 5.77-.308 8.952 6.406-.636 11.847-.636 16.959-.636s10.553 0 16.959.636c-.329-3.182-.329-6.077-.329-8.952.329-4.167.657-8.007 1.294-11.517-6.735-.637-12.812-.965-17.924-.965s-11.21.328-17.924.965zm49.275-8.008c-.637 22.728 5.133 45.128 14.413 54.08 21.105 21.454 46.708 24.328 60.155 24.328 17.596 0 33.918-5.769 42.561-14.392 11.847-12.175 16.322-69.764-4.476-92.492-9.608-10.245-28.476-17.595-50.875-19.833-21.127-1.93-40.015 1.273-48.33 8.644-7.679 6.385-12.791 21.434-13.448 39.665z"/>
  </svg>
);

// Utility functions
const getTypeIcon = (type: string) => {
  const icons: Record<string, string> = {
    task: '•',
    bug: '🐛',
    feature: '✨',
    epic: '⚡',
    chore: '🔧',
    docs: '📝',
    refactor: '♻️'
  };
  return icons[type] || '•';
};

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    task: 'Task',
    bug: 'Bug',
    feature: 'Feature',
    epic: 'Epic',
    chore: 'Chore',
    docs: 'Docs',
    refactor: 'Refactor'
  };
  return labels[type] || type;
};

const getPriorityIcon = (priority: string) => {
  const icons: Record<string, string> = {
    low: '●',
    medium: '◆',
    high: '▲',
    urgent: '⚠️'
  };
  return icons[priority] || '◆';
};

const getPriorityLabel = (priority: string) => {
  const labels: Record<string, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent'
  };
  return labels[priority] || priority;
};

const getStatusIcon = (status: string) => {
  const icons: Record<string, string> = {
    open: '●',
    in_progress: '◐',
    closed: '✓',
    blocked: '⛔'
  };
  return icons[status] || '●';
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    closed: 'Closed',
    blocked: 'Blocked'
  };
  return labels[status] || status;
};

const computeSubIssueStatus = (subtasks: Subtask[]) => {
  if (!subtasks || subtasks.length === 0) return null;

  const hasInProgress = subtasks.some(subtask => subtask.status === 'in_progress');
  if (hasInProgress) return 'in_progress';

  const nonClosedSubtasks = subtasks.filter(subtask => subtask.status !== 'closed');
  if (nonClosedSubtasks.length > 0 && nonClosedSubtasks.every(subtask => subtask.status === 'blocked')) {
    return 'blocked';
  }

  if (subtasks.every(subtask => subtask.status === 'closed')) {
    return 'closed';
  }

  return null;
};

const getComputedStatusClass = (status: string, subtasks: Subtask[]) => {
  const computedStatus = computeSubIssueStatus(subtasks);
  return computedStatus && computedStatus !== status ? computedStatus : status;
};

export default IssueEdit;