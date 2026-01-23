import React, { useState, useEffect, useRef } from 'react';
import './IssueEdit.css';
import EditableField from './EditableField';
import { UserIcon, AgentIcon } from './Icons';
import MetadataDropdown from './MetadataDropdown';
import TaskList from './TaskList';
import HeaderSection from './HeaderSection';
import CollapsibleSection from './CollapsibleSection';
import AcceptanceCriteriaSection from './AcceptanceCriteriaSection';
import CommentsSection from './CommentsSection';
import DeleteConfirmation from './DeleteConfirmation';
import SubtaskSelectionModal from './SubtaskSelectionModal';
import DependencySelectionModal from './DependencySelectionModal';
import {
  getTypeIcon,
  getTypeLabel,
  getPriorityIcon,
  getPriorityLabel,
  getStatusIcon,
  getStatusLabel,
  computeSubIssueStatus,
  getComputedStatusClass,
  getStatusDisplayText,
  showErrorMessage
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

  if (!issue) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <HeaderSection issue={issue} copyToClipboard={copyToClipboard} />

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
            <CollapsibleSection
              title="Overview"
              isCollapsed={sectionsCollapsed.overview}
              onToggle={() => toggleSection('overview')}
            >
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
            </CollapsibleSection>

            {/* Acceptance Criteria Section */}
            <CollapsibleSection
              title="Acceptance Criteria"
              isCollapsed={sectionsCollapsed.acceptanceCriteria}
              onToggle={() => toggleSection('acceptanceCriteria')}
              className="acceptance-criteria-section"
            >
              <AcceptanceCriteriaSection
                acceptanceCriteria={acceptanceCriteria}
                onAdd={addAcceptanceCriteria}
                onToggle={toggleAcceptanceCriteria}
                onRemove={removeAcceptanceCriteria}
                onEdit={handleFieldEdit}
              />
            </CollapsibleSection>

            {/* Subtasks Section */}
            <CollapsibleSection
              title="Sub-issues"
              isCollapsed={sectionsCollapsed.subtasks}
              onToggle={() => toggleSection('subtasks')}
              className="subtasks-section"
            >
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
            </CollapsibleSection>

            {/* Dependencies Section */}
            <CollapsibleSection
              title="Dependencies"
              isCollapsed={sectionsCollapsed.dependencies}
              onToggle={() => toggleSection('dependencies')}
              className="dependencies-section"
            >
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
            </CollapsibleSection>

            {/* Comments Section */}
            <CollapsibleSection
              title="Comments"
              isCollapsed={sectionsCollapsed.comments}
              onToggle={() => toggleSection('comments')}
              className="comments-section"
            >
              <CommentsSection
                comments={comments}
                currentCommentAuthor={currentCommentAuthor}
                newComment={newComment}
                onAuthorChange={(value) => handleFieldEdit('commentAuthor', value)}
                onCommentChange={(value) => setNewComment(value)}
                onAddComment={addComment}
              />
            </CollapsibleSection>
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
        <DeleteConfirmation
          isVisible={deleteConfirmVisible}
          title={currentTitle}
          subtaskCount={subtasks.length}
          onCancel={() => setDeleteConfirmVisible(false)}
          onConfirm={() => {
            setDeleteConfirmVisible(false);
            deleteTask();
          }}
        />
      </form>

      {/* Subtask Selection Modal */}
      <SubtaskSelectionModal
        isOpen={subtaskModalOpen}
        availableSubtasks={availableSubtasks}
        selectedIds={selectedSubtaskIds}
        search={subtaskSearch}
        onClose={() => setSubtaskModalOpen(false)}
        onSearchChange={setSubtaskSearch}
        onSelectionChange={(id) => {
          const newSelected = new Set(selectedSubtaskIds);
          if (newSelected.has(id)) {
            newSelected.delete(id);
          } else {
            newSelected.add(id);
          }
          setSelectedSubtaskIds(newSelected);
        }}
        onConfirm={handleSubtaskSelection}
        copyToClipboard={copyToClipboard}
      />

      {/* Dependency Selection Modal */}
      <DependencySelectionModal
        isOpen={dependencyModalOpen}
        availableDependencies={availableDependencies}
        selectedIds={selectedDependencyIds}
        search={dependencySearch}
        direction={dependencyDirection}
        onClose={() => setDependencyModalOpen(false)}
        onSearchChange={setDependencySearch}
        onDirectionChange={setDependencyDirection}
        onSelectionChange={(id) => {
          const newSelected = new Set(selectedDependencyIds);
          if (newSelected.has(id)) {
            newSelected.delete(id);
          } else {
            newSelected.add(id);
          }
          setSelectedDependencyIds(newSelected);
        }}
        onConfirm={handleDependencySelection}
        copyToClipboard={copyToClipboard}
      />
    </div>
  );
};

export default IssueEdit;