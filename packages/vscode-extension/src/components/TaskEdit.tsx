/// <reference lib="dom" />
import React, { useState, useRef, useEffect } from 'react';
import './TaskEdit.css';
import EditableField from './EditableField';
import MetadataDropdown from './MetadataDropdown';
import SubtaskList from './SubtaskList';
import HeaderSection from './HeaderSection';
import CollapsibleSection from './CollapsibleSection';
import AcceptanceCriteriaSection from './AcceptanceCriteriaSection';
import CommentsSection from './CommentsSection';
import DeleteConfirmation from './DeleteConfirmation';
import SubtaskSelectionModal from './SubtaskSelectionModal';
import DependencySelectionModal from './DependencySelectionModal';
import { useVSCodeMessaging } from './useVSCodeMessaging';
import {
  TaskEditProps
} from './types';
import {
  getTypeIcon,
  getTypeLabel,
  getPriorityIcon,
  getPriorityLabel,
  getStatusIcon,
  getStatusLabel,
  getComputedStatusClass,
  getStatusDisplayText
} from './utils';

const TaskEdit: React.FC<TaskEditProps> = ({ vscode }: TaskEditProps) => {
  const {
    task,
    comments,
    subtasks,
    dependencies,
    acceptanceCriteria,
    availableSubtasks,
    availableDependencies,
    currentCommentAuthor,
    newComment,
    subtaskModalOpen,
    dependencyModalOpen,
    subtaskSearch,
    dependencySearch,
    setSubtasks,
    setDependencies,
    setAcceptanceCriteria,
    setCurrentCommentAuthor,
    setNewComment,
    setSubtaskModalOpen,
    setDependencyModalOpen,
    setSubtaskSearch,
    setDependencySearch,
  } = useVSCodeMessaging(vscode);

  const [currentTitle, setCurrentTitle] = useState('');
  const [currentDescription, setCurrentDescription] = useState('');
  const [currentType, setCurrentType] = useState('task');
  const [currentPriority, setCurrentPriority] = useState('medium');
  const [currentStatus, setCurrentStatus] = useState('open');

  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Modal states
  const [selectedSubtaskIds, setSelectedSubtaskIds] = useState<Set<string>>(new Set());
  const [selectedDependencyIds, setSelectedDependencyIds] = useState<Set<string>>(new Set());

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

  // Sync form state when task loads
  useEffect(() => {
    if (task) {
      setCurrentTitle(task.title || '');
      setCurrentDescription(task.description || '');
      setCurrentType(task.type || 'task');
      setCurrentPriority(task.priority || 'medium');
      setCurrentStatus(task.status || 'open');
    }
  }, [task]);

  const saveTask = (subtasksOverride?: TaskEditTask['subtasks'], dependenciesOverride?: TaskEditTask['dependencies'], overrides?: Partial<{ type: string; priority: string; status: string }>) => {
    if (!task) return;

    const taskData = {
      id: task.id,
      title: currentTitle,
      description: currentDescription,
      comments,
      type: overrides?.type ?? currentType,
      priority: overrides?.priority ?? currentPriority,
      status: overrides?.status ?? currentStatus,
      subtasks: subtasksOverride ?? subtasks,
      dependencies: dependenciesOverride ?? dependencies,
      acceptance_criteria: acceptanceCriteria,
    };

    vscode.postMessage({ type: 'saveTask', task: taskData });
  };

  const selectMetadata = (type: string, value: string) => {
    if (type === 'type') {
      setCurrentType(value);
      saveTask(undefined, undefined, { type: value });
    } else if (type === 'priority') {
      setCurrentPriority(value);
      saveTask(undefined, undefined, { priority: value });
    } else if (type === 'status') {
      setCurrentStatus(value);
      onStatusChange(value);
      saveTask(undefined, undefined, { status: value });
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
    let updatedTitle = currentTitle;
    let updatedDescription = currentDescription;
    let updatedAcceptanceCriteria = acceptanceCriteria;

    if (fieldName === 'title') {
      updatedTitle = value;
      setCurrentTitle(value);
    } else if (fieldName === 'description') {
      updatedDescription = value;
      setCurrentDescription(value);
    } else if (fieldName === 'commentAuthor') {
      setCurrentCommentAuthor(value || 'user');
    } else if (fieldName.startsWith('acceptance-criteria-')) {
      const index = parseInt(fieldName.split('-')[2]);
      updatedAcceptanceCriteria = acceptanceCriteria.map((criteria, i) =>
        i === index ? { ...criteria, text: value } : criteria
      );
      setAcceptanceCriteria(updatedAcceptanceCriteria);
    }

    // Save with the updated values
    const taskData = {
      id: task!.id,
      title: updatedTitle,
      description: updatedDescription,
      comments,
      type: currentType,
      priority: currentPriority,
      status: currentStatus,
      subtasks,
      dependencies,
      acceptance_criteria: updatedAcceptanceCriteria,
    };
    vscode.postMessage({ type: 'saveTask', task: taskData });
  };

  const addAcceptanceCriteria = (text: string) => {
    const updatedCriteria = [...acceptanceCriteria, { text, completed: false }];
    setAcceptanceCriteria(updatedCriteria);

    // Save with the updated acceptance criteria
    const taskData = {
      id: task!.id,
      title: currentTitle,
      description: currentDescription,
      comments,
      type: currentType,
      priority: currentPriority,
      status: currentStatus,
      subtasks,
      dependencies,
      acceptance_criteria: updatedCriteria,
    };
    vscode.postMessage({ type: 'saveTask', task: taskData });
  };

  const toggleAcceptanceCriteria = (index: number) => {
    const updatedCriteria = acceptanceCriteria.map((criteria, i) =>
      i === index ? { ...criteria, completed: !criteria.completed } : criteria
    );
    setAcceptanceCriteria(updatedCriteria);

    // Save with the updated acceptance criteria
    const taskData = {
      id: task!.id,
      title: currentTitle,
      description: currentDescription,
      comments,
      type: currentType,
      priority: currentPriority,
      status: currentStatus,
      subtasks,
      dependencies,
      acceptance_criteria: updatedCriteria,
    };
    vscode.postMessage({ type: 'saveTask', task: taskData });
  };

  const removeAcceptanceCriteria = (index: number) => {
    const updatedCriteria = acceptanceCriteria.filter((_, i) => i !== index);
    setAcceptanceCriteria(updatedCriteria);

    // Save with the updated acceptance criteria
    const taskData = {
      id: task!.id,
      title: currentTitle,
      description: currentDescription,
      comments,
      type: currentType,
      priority: currentPriority,
      status: currentStatus,
      subtasks,
      dependencies,
      acceptance_criteria: updatedCriteria,
    };
    vscode.postMessage({ type: 'saveTask', task: taskData });
  };

  const addComment = () => {
    if (!newComment.trim()) return;

    vscode.postMessage({
      type: 'addComment',
      issueId: task?.id,
      author: currentCommentAuthor,
      content: newComment.trim()
    });
  };

  const removeSubtask = (id: string) => {
    const updatedSubtasks = subtasks.filter(s => s.id !== id);
    setSubtasks(updatedSubtasks);
    saveTask(updatedSubtasks);
  };

  const removeDependency = (id: string) => {
    const updatedDependencies = dependencies.filter(d => d.id !== id);
    setDependencies(updatedDependencies);
    saveTask(undefined, updatedDependencies);
  };

  const editTask = (taskId: string) => {
    vscode.postMessage({ type: 'editTask', id: taskId });
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
      const taskData = {
        id: task!.id,
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
      vscode.postMessage({ type: 'saveTask', task: taskData });
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
          direction: 'blocks' as const, // Always 'blocks' - this issue is blocked by the selected dependencies
          completion_percentage: 0, // Would be calculated by extension
        }));
      const updatedDependencies = [...dependencies, ...selectedDeps];
      setDependencies(updatedDependencies);

      // Save with the updated dependencies
      const taskData = {
        id: task!.id,
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
      vscode.postMessage({ type: 'saveTask', task: taskData });
    }
    setDependencyModalOpen(false);
    setSelectedDependencyIds(new Set());
  };

  const deleteTask = () => {
    if (task) {
      vscode.postMessage({ type: 'deleteTask', id: task.id });
    }
  };

  if (!task) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <HeaderSection task={task} copyToClipboard={copyToClipboard} />

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
          options={['open', 'in_progress', 'closed'].map(status => ({ value: status, label: getStatusLabel(status) }))}
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
              title="Sub-tasks"
              isCollapsed={sectionsCollapsed.subtasks}
              onToggle={() => toggleSection('subtasks')}
              className="subtasks-section"
            >
              <div className="subtask-list">
                <SubtaskList
                  tasks={subtasks}
                  onEdit={editTask}
                  onRemove={removeSubtask}
                  copyToClipboard={copyToClipboard}
                  emptyMessage="No sub-tasks yet. Break this task down into smaller, manageable pieces."
                />
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => vscode.postMessage({ type: 'getAvailableSubtasks' })}
              >
                Add Sub-task
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
                  <SubtaskList
                    tasks={dependencies.filter(dep => dep.direction === 'blocked_by')}
                    onEdit={editTask}
                    onRemove={removeDependency}
                    copyToClipboard={copyToClipboard}
                    emptyMessage="No blocking dependencies. This task can be worked on independently."
                  />
                </div>
              </div>
              <div className="dependency-section">
                <h4>This task is blocking</h4>
                <div className="dependency-list">
                  <SubtaskList
                    tasks={dependencies.filter(dep => dep.direction === 'blocks')}
                    onEdit={editTask}
                    onRemove={null}
                    copyToClipboard={copyToClipboard}
                    emptyMessage="This task doesn't block any other work."
                  />
                </div>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => vscode.postMessage({ type: 'getAvailableDependencies' })}
              >
                Add Blocked by
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
          className="delete-task-btn"
          ref={deleteButtonRef}
          onClick={() => setDeleteConfirmVisible(true)}
        >
          Delete Task
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
        onClose={() => setDependencyModalOpen(false)}
        onSearchChange={setDependencySearch}
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

export default TaskEdit;