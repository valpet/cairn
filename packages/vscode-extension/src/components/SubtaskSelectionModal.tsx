import React from 'react';
import { getStatusLabel, getPriorityLabel } from './utils';

interface AvailableItem {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
}

interface SubtaskSelectionModalProps {
  isOpen: boolean;
  availableSubtasks: AvailableItem[];
  selectedIds: Set<string>;
  search: string;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onSelectionChange: (id: string) => void;
  onConfirm: () => void;
  copyToClipboard: (text: string) => void;
}

const SubtaskSelectionModal: React.FC<SubtaskSelectionModalProps> = ({
  isOpen,
  availableSubtasks,
  selectedIds,
  search,
  onClose,
  onSearchChange,
  onSelectionChange,
  onConfirm,
  copyToClipboard
}) => {
  if (!isOpen) return null;

  return (
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
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <div className="subtask-list-modal">
            {availableSubtasks
              .filter(subtask =>
                `${subtask.id} ${subtask.title} ${subtask.description}`
                  .toLowerCase()
                  .includes(search.toLowerCase())
              )
              .map(subtask => (
                <div
                  key={subtask.id}
                  className={`subtask-item ${selectedIds.has(subtask.id) ? 'selected' : ''}`}
                  onClick={() => onSelectionChange(subtask.id)}
                >
                  <input
                    type="checkbox"
                    className="subtask-checkbox"
                    checked={selectedIds.has(subtask.id)}
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
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={selectedIds.size === 0}>
            Add Selected Subtasks
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubtaskSelectionModal;